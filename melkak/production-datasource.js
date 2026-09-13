import {CATEGORIES} from './config.js';
import {can} from '../admin-permissions.js';
import {publicAdQuery,publicAdWindow,visibleAd} from '../commercial-model.js';
import {featured} from './model.js';
import {normalizeProductionListing,normalizeProductionLegacy,normalizeProductionRecord,validProductionImage} from './production-model.js';

/** Bounded read-only datasource. All Firebase capabilities are injected by the trusted bootstrap. */
export async function createProductionDatasource({sdk,db,auth,countries={},config={}}={}){
 if(!sdk?.getDocs||!db||!auth?.subscribe)throw new Error('DATASOURCE_CONFIGURATION');
 const max=Math.min(100,Math.max(1,Number(config.readLimit)||60));
 const state={listings:[],users:[],categories:CATEGORIES.map((c,i)=>({...c,enabled:true,order:i,featured:false})),ads:[],publicAds:[],services:[],reports:[],audit:[],legacy:{},version:0,capabilities:{},bounded:true};
 const listeners=new Set(),images=new Map();let publicRows=[],ownRows=[],adminRows=[],adminAds=[],disposed=false,epoch=0,publicVersion=0,ownVersion=0,adminVersion=0;
 const actor=()=>auth.state?.actor||{};
 const publish=()=>{if(disposed)return;state.listings=[...new Map([...publicRows,...ownRows,...adminRows].map(r=>[r.id,r])).values()];state.ads=[...new Map([...state.publicAds,...adminAds].map(a=>[a.id,a])).values(),...state.services.filter(r=>r.type==='commercial')];state.version++;for(const fn of listeners)fn(state);};
 const commercialOwner=()=>actor().uid&&actor().status==='active'&&actor().ready===true&&actor().role==='super_admin';
 const allowed=p=>actor().uid&&actor().status==='active'&&actor().ready===true&&can(actor(),p);
 function bounded(name,...constraints){return sdk.query(sdk.collection(db,name),...constraints,sdk.limit(max));}
 async function read(name,query,valid=()=>!disposed){
  try{const result=await sdk.getDocs(query);const rows=result.docs.map(doc=>({id:doc.id,data:doc.data()}));if(valid())state.capabilities[name]={status:rows.length?'available':'empty',count:rows.length,bounded:true};return rows;}
  catch(error){if(valid())state.capabilities[name]={status:String(error.code).includes('permission-denied')?'denied':'error',code:String(error.code||'READ_FAILED'),bounded:true};return [];}
 }
 const listing=(rows,legacy)=>rows.map(r=>(legacy?normalizeProductionLegacy:normalizeProductionListing)(r.id,r.data,countries));
 const records=(rows,name)=>rows.map(r=>normalizeProductionRecord(r.id,r.data,name));
 async function refreshPublic(){
  const version=++publicVersion,valid=()=>!disposed&&version===publicVersion;
  const [modern,legacy,categories,ads]=await Promise.all([
   read('marketplaceListings',bounded('marketplaceListings',sdk.where('status','==','active')),valid),
   read('animals',bounded('animals',sdk.where('status','==','active')),valid),
   read('marketplaceCategories',bounded('marketplaceCategories'),valid),
   read('commercialAds',publicAdQuery({...sdk,db},publicAdWindow()),valid)
  ]);
  if(!valid())return;
  publicRows=[...listing(modern,false),...listing(legacy,true)].filter(r=>r.status==='active'&&r.saleType!=='auction');
  state.categories=CATEGORIES.map((c,i)=>{const remote=categories.find(r=>r.id===c.id)?.data;return {...c,enabled:remote?.enabled!==false,order:Number.isInteger(remote?.order)?remote.order:i,featured:remote?.featured===true};});
  state.publicAds=records(ads,'commercialAds').filter(ad=>visibleAd(ad)).map(ad=>({...ad,imageData:images.get(ad.id)||'',asset:images.get(ad.id)||ad.asset||''}));publish();
 }
 async function loadOwn(){
  const uid=actor().uid,token=epoch,version=++ownVersion,valid=()=>!disposed&&token===epoch&&version===ownVersion&&actor().uid===uid;
  if(!uid)return;
  const [modern,legacy,requests]=await Promise.all([
   read('marketplaceListings',bounded('marketplaceListings',sdk.where('ownerUid','==',uid)),valid),
   read('animals',bounded('animals',sdk.where('sellerId','==',uid)),valid),
   read('marketplaceRequests',bounded('marketplaceRequests',sdk.where('ownerUid','==',uid)),valid)
  ]);
  if(!valid())return;
  ownRows=[...listing(modern,false),...listing(legacy,true)].filter(r=>r.ownerUid===uid);
  const rows=records(requests,'marketplaceRequests');state.services=rows.filter(r=>r.type!=='report');state.reports=rows.filter(r=>r.type==='report');
  const profile=auth.state.profile;if(profile)state.users=[normalizeProductionRecord(uid,profile,'users')];publish();
 }
 async function loadAdmin(){
  const token=epoch,version=++adminVersion,valid=()=>!disposed&&token===epoch&&version===adminVersion;
  const jobs=[];
  if(commercialOwner())jobs.push(read('commercialAds',bounded('commercialAds'),valid).then(rows=>{if(valid()&&commercialOwner())adminAds=records(rows,'commercialAds').map(ad=>({...ad,publicEligible:false,asset:images.get(ad.id)||ad.asset||''}));}));
  function job(name,permission,apply){if(allowed(permission))jobs.push(read(name,bounded(name),valid).then(rows=>{if(valid()&&allowed(permission))apply(rows);}));}
  job('users','users_view',rows=>state.users=records(rows,'users'));
  job('marketplaceListings','listings_view',rows=>adminRows=listing(rows,false));
  for(const [permission,key,operator,type] of [['reports_view','reports','==','report'],['services_view','services','in',['featured','commercial']]])if(allowed(permission))jobs.push(read('marketplaceRequests',bounded('marketplaceRequests',sdk.where('type',operator,type)),valid).then(rows=>{if(valid()&&allowed(permission))state[key]=records(rows,'marketplaceRequests').filter(r=>key==='reports'?r.type==='report':r.type!=='report');}));
  job('serviceRequests','services_view',rows=>state.legacy.serviceRequests=records(rows,'serviceRequests'));
  job('marketplaceAuditLogs','admin_log_view',rows=>state.audit=records(rows,'marketplaceAuditLogs'));
  job('adminAccess','assistants_view',rows=>state.legacy.adminAccess=records(rows,'adminAccess'));
  await Promise.all(jobs);if(valid())publish();
 }
 async function loadAdImages(ids=[]){
  const token=epoch;
  await Promise.all([...new Set(ids)].slice(0,2).filter(id=>(state.publicAds.some(a=>a.id===id)||(commercialOwner()&&adminAds.some(a=>a.id===id)))&&!images.has(id)).map(async id=>{
   try{const snap=await sdk.getDoc(sdk.doc(db,'commercialAdImages',id)),data=snap.data();if(!disposed&&token===epoch&&validProductionImage(data?.imageData)){images.set(id,data.imageData);for(const ad of [...state.publicAds,...adminAds].filter(a=>a.id===id)){ad.imageData=data.imageData;ad.asset=data.imageData;}}}catch{/* Metadata remains usable; unavailable artwork is never fabricated. */}
  }));publish();return state.ads;
 }
 const unsubscribe=auth.subscribe(()=>{epoch++;ownVersion++;adminVersion++;ownRows=[];adminRows=[];adminAds=[];images.clear();state.users=[];state.services=[];state.reports=[];state.audit=[];state.legacy={};for(const name of ['users','marketplaceRequests','marketplaceAuditLogs','serviceRequests','adminAccess'])delete state.capabilities[name];publish();});
 const store={state,subscribe(fn){listeners.add(fn);fn(state);return()=>listeners.delete(fn);},refreshPublic,loadOwn,loadAdmin,loadAdImages,async refresh(){await refreshPublic();await loadOwn();await loadAdmin();},statistics(country=''){const rows=state.listings.filter(r=>r.saleType!=='auction'&&(!country||r.country===country));return {bounded:true,total:rows.length,...Object.fromEntries(['active','sold','hidden','rejected','pending','archived'].map(status=>[status,rows.filter(r=>r.status===status).length])),featured:rows.filter(r=>featured(r)).length,soon:rows.filter(r=>featured(r)&&r.featuredEndAt-Date.now()<48*3600000).length,reports:state.reports.filter(r=>r.status==='open'&&rows.some(a=>a.id===r.listingId)).length,users:state.users.filter(r=>!country||r.country===country).length};},dispose(){disposed=true;epoch++;unsubscribe();listeners.clear();ownRows=[];adminRows=[];adminAds=[];images.clear();state.users=[];state.services=[];state.reports=[];state.audit=[];state.legacy={};state.listings=publicRows;state.ads=state.publicAds;}};
 await refreshPublic();return store;
}
