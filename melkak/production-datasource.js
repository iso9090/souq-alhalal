import {CATEGORIES} from './config.js';
import {can} from '../admin-permissions.js';
import {publicAdQuery,publicAdWindow,visibleAd} from '../commercial-model.js';
import {featured} from './model.js';
import {normalizeProductionListing,normalizeProductionLegacy,normalizeProductionRecord,validProductionImage} from './production-model.js';

/** Bounded read-only datasource. All Firebase capabilities are injected by the trusted bootstrap. */
export async function createProductionDatasource({sdk,db,auth,countries={},config={}}={}){
 if(!sdk?.getDocs||!db||!auth?.subscribe)throw new Error('DATASOURCE_CONFIGURATION');
 const max=Math.min(100,Math.max(1,Number(config.readLimit)||60));
 const modernMode=config.modernCommercial===true,baseRegions=Object.fromEntries(Object.entries(countries).map(([id,c])=>[id,structuredClone(c.regions||{})]));
 const state={listings:[],users:[],categories:CATEGORIES.map((c,i)=>({...c,enabled:true,order:i,featured:false})),ads:[],publicAds:[],services:[],reports:[],audit:[],settings:{},cities:[],counts:{},publicPage:{hasMore:false,loading:false,filters:{}},legacy:{},version:0,capabilities:{},bounded:true};
 let publicCursor=null,publicFilters={},countVersion=0;const ownCursors={},adminCursors={},deepRows=new Map(),deepVersions=new Map();state.ownPages={};state.adminPages={};
 const listeners=new Set(),images=new Map(),imageRevisions=new Map();let publicRows=[],ownRows=[],adminRows=[],adminAds=[],disposed=false,epoch=0,publicVersion=0,ownVersion=0,adminVersion=0;
 const actor=()=>auth.state?.actor||{};
 const publish=()=>{if(disposed)return;state.listings=[...new Map([...publicRows,...ownRows,...adminRows,...deepRows.values()].map(r=>[r.id,r])).values()];const ads=new Map();for(const a of [...state.services.filter(r=>r.type==='commercial'),...state.publicAds,...adminAds]){const previous=ads.get(a.id)||{};if(a.imageDocument&&previous.imageDocument&&(a.updatedAt||0)<(previous.updatedAt||0))continue;const sameRevision=!a.imageDocument||(a.updatedAt||0)===(previous.updatedAt||0),art=images.get(a.id)||a.imageData||a.asset||(sameRevision?(previous.imageData||previous.asset):'')||'';ads.set(a.id,{...previous,...a,imageData:art,asset:art});}state.ads=[...ads.values()];state.version++;for(const fn of listeners)fn(state);};
 const commercialOwner=()=>actor().uid&&actor().status==='active'&&actor().ready===true&&actor().role==='super_admin';
 const allowed=p=>actor().uid&&actor().status==='active'&&actor().ready===true&&can(actor(),p);
 function bounded(name,...constraints){return sdk.query(sdk.collection(db,name),...constraints,sdk.limit(max));}
 async function read(name,query,valid=()=>!disposed){
  try{const result=await sdk.getDocs(query);const rows=result.docs.map(doc=>({id:doc.id,data:doc.data(),snapshot:doc}));if(valid())state.capabilities[name]={status:rows.length?'available':'empty',count:rows.length,bounded:true};return rows;}
  catch(error){if(valid())state.capabilities[name]={status:String(error.code).includes('permission-denied')?'denied':'error',code:String(error.code||'READ_FAILED'),bounded:true};return [];}
 }
 const listing=(rows,legacy)=>rows.map(r=>(legacy?normalizeProductionLegacy:normalizeProductionListing)(r.id,r.data,countries));
 const records=(rows,name)=>rows.map(r=>{const record=normalizeProductionRecord(r.id,r.data,name);if(['marketplaceCommercialAds','commercialAds'].includes(name)){const revision=record.updatedAt||0,previous=imageRevisions.get(record.id);if(previous===undefined||revision>previous){imageRevisions.set(record.id,revision);if(previous!==undefined){images.delete(record.id);for(const ad of [...state.publicAds,...adminAds].filter(a=>a.id===record.id)){ad.imageData='';if(ad.imageDocument)ad.asset='';}}}}return record;});
 const merge=(before,next)=>[...new Map([...before,...next].map(row=>[row.id,row])).values()];
 const pageState=rows=>({hasMore:rows.length===max,loading:false});
 async function loadListing(id){
  if(typeof id!=='string'||!id||id.includes('/')||id==='.'||id==='..')return null;
  const legacy=id.startsWith('legacy-');if(legacy&&config.includeLegacy===false)return null;
  const sourceId=id.replace(legacy?/^legacy-/:/^marketplace-/,''),name=legacy?'animals':'marketplaceListings';if(!sourceId)return null;
  const token=epoch,version=(deepVersions.get(id)||0)+1;deepVersions.set(id,version);const valid=()=>!disposed&&token===epoch&&deepVersions.get(id)===version;
  try{const snapshot=await sdk.getDoc(sdk.doc(db,name,sourceId));if(!valid())return null;if(!snapshot.exists()){deepRows.delete(id);state.capabilities['listing:'+id]={status:'empty',bounded:true};publish();return null;}const row=(legacy?normalizeProductionLegacy:normalizeProductionListing)(sourceId,snapshot.data(),countries);if(row.saleType==='auction'||(row.status!=='active'&&row.ownerUid!==actor().uid&&!allowed('listings_view')&&!allowed('listings_manage')))return null;deepRows.set(row.id,row);if(deepRows.size>8)deepRows.delete(deepRows.keys().next().value);state.capabilities['listing:'+id]={status:'available',bounded:true};publish();return row;}
  catch(error){if(valid()){deepRows.delete(id);state.capabilities['listing:'+id]={status:String(error.code).includes('permission-denied')?'denied':'error',code:String(error.code||'READ_FAILED'),bounded:true};publish();}return null;}
 }
 function listingQuery(cursor){return bounded('marketplaceListings',sdk.where('status','==','active'),...(modernMode?[...(publicFilters.country?[sdk.where('country','==',publicFilters.country)]:[]),...(publicFilters.category?[sdk.where('category','==',publicFilters.category)]:[]),sdk.orderBy('updatedAt','desc'),...(cursor?[sdk.startAfter(cursor)]:[])]:[]));}
 function featuredQuery(){const at=Date.now();return sdk.query(sdk.collection(db,'marketplaceListings'),sdk.where('status','==','active'),sdk.where('featured','==',true),sdk.where('featuredStatus','==','approved'),sdk.where('featuredStartAt','<=',at),sdk.where('featuredEndAt','>',at),...(publicFilters.country?[sdk.where('country','==',publicFilters.country)]:[]),sdk.limit(20));}
 async function publicConfiguration(valid){
  if(!modernMode)return;
  const [settings,cities]=await Promise.all([Promise.resolve().then(()=>sdk.getDoc(sdk.doc(db,'marketplaceSettings','public'))).then(snap=>{if(valid())state.capabilities.marketplaceSettings={status:snap.exists()?'available':'empty',bounded:true};return snap.exists()?snap.data():{};}).catch(error=>{if(valid())state.capabilities.marketplaceSettings={status:String(error.code).includes('permission-denied')?'denied':'error',code:String(error.code||'READ_FAILED'),bounded:true};return null;}),read('marketplaceCities',bounded('marketplaceCities'),valid)]);
  if(!valid())return;if(settings)state.settings=settings;
  if(['available','empty'].includes(state.capabilities.marketplaceCities?.status)){state.cities=records(cities,'marketplaceCities');for(const [id,c]of Object.entries(countries))c.regions=structuredClone(baseRegions[id]);for(const city of state.cities){if(city.enabled!==true||!countries[city.country]||typeof city.region!=='string'||!city.region.trim()||typeof city.name!=='string'||!city.name.trim())continue;const regions=countries[city.country].regions;regions[city.region]??=[];if(!regions[city.region].includes(city.name))regions[city.region].push(city.name);}}
 }
 async function refreshPublic(filters){
  if(filters&&modernMode){publicFilters={country:Object.hasOwn(countries,filters.country)?filters.country:'',category:CATEGORIES.some(c=>c.id===filters.category)?filters.category:''};}
  const version=++publicVersion,valid=()=>!disposed&&version===publicVersion;
  state.publicPage={hasMore:false,loading:true,filters:{...publicFilters}};
  const [modern,legacy,categories,ads,promoted]=await Promise.all([
   read('marketplaceListings',listingQuery(),valid),
   config.includeLegacy===false?Promise.resolve([]):read('animals',bounded('animals',sdk.where('status','==','active')),valid),
   read('marketplaceCategories',bounded('marketplaceCategories'),valid),
   config.modernCommercial===true?read('marketplaceCommercialAds',bounded('marketplaceCommercialAds',sdk.where('status','==','approved'),sdk.where('startAt','<=',Date.now()-30000),sdk.where('endAt','>',Date.now()+30000)),valid):read('commercialAds',publicAdQuery({...sdk,db},publicAdWindow()),valid),modernMode?read('marketplaceFeaturedListings',featuredQuery(),valid):Promise.resolve([]),publicConfiguration(valid)
  ]);
  if(!valid())return;
  publicRows=merge([...listing(modern,false),...listing(legacy,true)],listing(promoted,false).filter(row=>featured(row)&&(!publicFilters.category||row.category===publicFilters.category))).filter(r=>r.status==='active'&&r.saleType!=='auction');
  publicCursor=modern.at(-1)?.snapshot||null;state.publicPage={hasMore:modernMode&&modern.length===max,loading:false,filters:{...publicFilters}};
  state.categories=CATEGORIES.map((c,i)=>{const remote=categories.find(r=>r.id===c.id)?.data;return {...c,enabled:remote?.enabled!==false,order:Number.isInteger(remote?.order)?remote.order:i,featured:remote?.featured===true,icon:remote?.icon||c.icon};});
  state.publicAds=records(ads,config.modernCommercial===true?'marketplaceCommercialAds':'commercialAds').filter(ad=>visibleAd(ad)).map(ad=>({...ad,imageData:images.get(ad.id)||'',asset:images.get(ad.id)||ad.asset||''}));publish();
 }
 async function loadMorePublic(){
  if(!modernMode||!state.publicPage.hasMore||state.publicPage.loading||!publicCursor)return state.publicPage;
  const version=publicVersion,valid=()=>!disposed&&version===publicVersion;state.publicPage.loading=true;
  const rows=await read('marketplaceListings',listingQuery(publicCursor),valid);if(!valid())return state.publicPage;
  if(['available','empty'].includes(state.capabilities.marketplaceListings?.status)){publicRows=[...new Map([...publicRows,...listing(rows,false).filter(r=>r.status==='active'&&r.saleType!=='auction')].map(r=>[r.id,r])).values()];publicCursor=rows.at(-1)?.snapshot||publicCursor;state.publicPage.hasMore=rows.length===max;}
  state.publicPage.loading=false;publish();return state.publicPage;
 }
 async function loadOwn(){
  const uid=actor().uid,token=epoch,version=++ownVersion,valid=()=>!disposed&&token===epoch&&version===ownVersion&&actor().uid===uid;
  if(!uid)return;
  const [modern,legacy,requests]=await Promise.all([
   read('marketplaceListings',bounded('marketplaceListings',sdk.where('ownerUid','==',uid)),valid),
   config.includeLegacy===false?Promise.resolve([]):read('animals',bounded('animals',sdk.where('sellerId','==',uid)),valid),
   read('marketplaceRequests',bounded('marketplaceRequests',sdk.where('ownerUid','==',uid)),valid)
  ]);
  if(!valid())return;
  ownRows=[...listing(modern,false),...listing(legacy,true)].filter(r=>r.ownerUid===uid);
  if(modernMode){ownCursors.listings=modern.at(-1)?.snapshot;ownCursors.requests=requests.at(-1)?.snapshot;state.ownPages={listings:pageState(modern),requests:pageState(requests)};}
  const rows=records(requests,'marketplaceRequests');state.services=rows.filter(r=>r.type!=='report');state.reports=rows.filter(r=>r.type==='report');
  const profile=auth.state.profile;if(profile)state.users=[normalizeProductionRecord(uid,profile,'users')];publish();
 }
 async function loadMoreOwn(section='listings'){
  const uid=actor().uid,page=state.ownPages[section],cursor=ownCursors[section];if(!modernMode||!uid||!['listings','requests'].includes(section)||!page?.hasMore||page.loading||!cursor)return page;
  const token=epoch,version=ownVersion,valid=()=>!disposed&&token===epoch&&version===ownVersion&&actor().uid===uid;page.loading=true;
  const name=section==='listings'?'marketplaceListings':'marketplaceRequests',rows=await read(name,bounded(name,sdk.where('ownerUid','==',uid),sdk.startAfter(cursor)),valid);if(!valid())return null;
  if(['available','empty'].includes(state.capabilities[name]?.status)){ownCursors[section]=rows.at(-1)?.snapshot||cursor;Object.assign(page,pageState(rows));if(section==='listings')ownRows=merge(ownRows,listing(rows,false).filter(row=>row.ownerUid===uid));else{const normalized=records(rows,name).filter(row=>row.ownerUid===uid);state.services=merge(state.services,normalized.filter(row=>row.type!=='report'));state.reports=merge(state.reports,normalized.filter(row=>row.type==='report'));}}page.loading=false;publish();return page;
 }
 function adminSpec(section){
  const specs={listings:['marketplaceListings','listings_view'],users:['users','users_view'],services:['marketplaceRequests','services_view',sdk.where('type','in',['featured','bump','commercial'])],reports:['marketplaceRequests','reports_view',sdk.where('type','==','report')],ads:['marketplaceCommercialAds','super_admin'],audit:['marketplaceAuditLogs','admin_log_view'],assistants:['adminAccess','assistants_view'],legacyAudit:['adminAuditLogs','admin_log_view']};
  const spec=specs[section];return spec&&(spec[1]==='super_admin'?commercialOwner():allowed(spec[1]))?spec:null;
 }
 function applyAdminPage(section,name,rows,append=false){
  const normalized=section==='listings'?listing(rows,false):records(rows,name),combine=before=>append?merge(before,normalized):normalized;
  if(section==='listings')adminRows=combine(adminRows);else if(section==='ads')adminAds=combine(adminAds);else if(section==='assistants')state.legacy.adminAccess=combine(state.legacy.adminAccess||[]);else if(['audit','legacyAudit'].includes(section)){state.audit=merge(state.audit.filter(row=>append||row.sourceCollection!==name),normalized).sort((a,b)=>b.timestamp-a.timestamp);}else state[section]=combine(state[section]);
 }
 async function loadModernAdmin(){
  const token=epoch,version=++adminVersion,valid=()=>!disposed&&token===epoch&&version===adminVersion;state.adminPages={};
  await Promise.all(['listings','users','services','reports','ads','audit','assistants','legacyAudit'].map(async section=>{const spec=adminSpec(section);if(!spec)return;const [name,,...filters]=spec,rows=await read(name,bounded(name,...filters),valid);if(!valid()||!adminSpec(section))return;adminCursors[section]=rows.at(-1)?.snapshot;state.adminPages[section]=pageState(rows);applyAdminPage(section,name,rows);}));if(valid())publish();
 }
 async function loadMoreAdmin(section='listings'){
  const spec=adminSpec(section),page=state.adminPages[section],cursor=adminCursors[section];if(!modernMode||!spec||!page?.hasMore||page.loading||!cursor)return page;
  const token=epoch,version=adminVersion,valid=()=>!disposed&&token===epoch&&version===adminVersion&&!!adminSpec(section);page.loading=true;
  const [name,,...filters]=spec,rows=await read(name,bounded(name,...filters,sdk.startAfter(cursor)),valid);if(!valid())return null;
  if(['available','empty'].includes(state.capabilities[name]?.status)){adminCursors[section]=rows.at(-1)?.snapshot||cursor;Object.assign(page,pageState(rows));applyAdminPage(section,name,rows,true);}page.loading=false;publish();return page;
 }
 async function loadAdmin(){
  if(modernMode)return loadModernAdmin();
  const token=epoch,version=++adminVersion,valid=()=>!disposed&&token===epoch&&version===adminVersion;
  const jobs=[];
  if(commercialOwner()&&config.includeLegacy!==false)jobs.push(read('commercialAds',bounded('commercialAds'),valid).then(rows=>{if(valid()&&commercialOwner())adminAds=records(rows,'commercialAds').map(ad=>({...ad,publicEligible:false,asset:images.get(ad.id)||ad.asset||''}));}));
  function job(name,permission,apply){if(allowed(permission))jobs.push(read(name,bounded(name),valid).then(rows=>{if(valid()&&allowed(permission))apply(rows);}));}
  job('users','users_view',rows=>state.users=records(rows,'users'));
  job('marketplaceListings','listings_view',rows=>adminRows=listing(rows,false));
  for(const [permission,key,operator,type] of [['reports_view','reports','==','report'],['services_view','services','in',modernMode?['featured','bump','commercial']:['featured','commercial']]])if(allowed(permission))jobs.push(read('marketplaceRequests',bounded('marketplaceRequests',sdk.where('type',operator,type)),valid).then(rows=>{if(valid()&&allowed(permission))state[key]=records(rows,'marketplaceRequests').filter(r=>key==='reports'?r.type==='report':r.type!=='report');}));
  if(config.includeLegacy!==false)job('serviceRequests','services_view',rows=>state.legacy.serviceRequests=records(rows,'serviceRequests'));
  if(config.modernCommercial===true&&commercialOwner())jobs.push(read('marketplaceCommercialAds',bounded('marketplaceCommercialAds'),valid).then(rows=>{if(valid())adminAds=records(rows,'marketplaceCommercialAds');}));
  job('marketplaceAuditLogs','admin_log_view',rows=>state.audit=records(rows,'marketplaceAuditLogs'));
  job('adminAccess','assistants_view',rows=>state.legacy.adminAccess=records(rows,'adminAccess'));
  await Promise.all(jobs);if(valid()&&config.includeLegacy===false&&allowed('admin_log_view')){const oldAudit=await read('adminAuditLogs',bounded('adminAuditLogs'),valid);if(valid())state.audit=[...state.audit,...records(oldAudit,'adminAuditLogs')].sort((a,b)=>b.timestamp-a.timestamp);}
  if(valid())publish();
 }
 async function loadAdImages(ids=[]){
  const token=epoch;
  await Promise.all([...new Set(ids)].slice(0,2).filter(id=>(state.publicAds.some(a=>a.id===id)||(commercialOwner()&&adminAds.some(a=>a.id===id)))&&!images.has(id)).map(async id=>{
   const revision=imageRevisions.get(id);
   try{const snap=await sdk.getDoc(sdk.doc(db,config.modernCommercial===true?'marketplaceCommercialImages':'commercialAdImages',id)),data=snap.data();if(!disposed&&token===epoch&&revision===imageRevisions.get(id)&&validProductionImage(data?.imageData)){images.set(id,data.imageData);for(const ad of [...state.publicAds,...adminAds].filter(a=>a.id===id)){ad.imageData=data.imageData;ad.asset=data.imageData;}}}catch{/* Metadata remains usable; unavailable artwork is never fabricated. */}
  }));publish();return state.ads;
 }
 async function loadCounts(country=''){
  if(country&&!Object.hasOwn(countries,country))throw Error('COUNTRY');
  const token=epoch,version=++countVersion,key=country||'ALL',valid=()=>!disposed&&token===epoch&&version===countVersion,values={},fields={},jobs=[];
  const countryFilter=country?[sdk.where('country','==',country)]:[];
  const count=(name,collection,filters)=>{if(!sdk.getCountFromServer){fields[name]={status:'unavailable',code:'COUNT_UNSUPPORTED'};return;}jobs.push(Promise.resolve().then(()=>sdk.getCountFromServer(sdk.query(sdk.collection(db,collection),...filters))).then(result=>{const n=result.data().count;if(!Number.isInteger(n)||n<0)throw Error('INVALID_COUNT');values[name]=n;fields[name]={status:'exact'};}).catch(error=>{fields[name]={status:String(error.code).includes('permission-denied')?'denied':'error',code:String(error.code||error.message||'COUNT_FAILED')};}));};
  if(allowed('listings_view')||allowed('listings_manage')){
   count('total','marketplaceListings',countryFilter);
   for(const status of ['active','sold','hidden','rejected','pending','archived'])count(status,'marketplaceListings',[...countryFilter,sdk.where('status','==',status)]);
   const at=Date.now(),featuredFilters=[...countryFilter,sdk.where('status','==','active'),sdk.where('featured','==',true),sdk.where('featuredStatus','==','approved'),sdk.where('featuredStartAt','<=',at),sdk.where('featuredEndAt','>',at)];
   count('featured','marketplaceListings',featuredFilters);count('soon','marketplaceListings',[...featuredFilters,sdk.where('featuredEndAt','<',at+48*3600000)]);
  }
  if(allowed('users_view'))count('users','users',countryFilter);
  if(allowed('reports_view')||allowed('reports_manage')){if(country)fields.reports={status:'unavailable',code:'COUNTRY_JOIN_REQUIRED'};else count('reports','marketplaceRequests',[sdk.where('type','==','report'),sdk.where('status','==','open')]);}
  await Promise.all(jobs);if(!valid())return null;
  const exactFields=Object.keys(values);state.counts[key]={status:exactFields.length&&Object.values(fields).every(f=>f.status==='exact')?'exact':'partial',values,fields,exactFields,updatedAt:Date.now()};publish();return {...values,exactFields,fields,bounded:state.counts[key].status!=='exact'};
 }
 function statistics(country=''){
  const rows=state.listings.filter(r=>r.saleType!=='auction'&&(!country||r.country===country));
  const boundedValues={total:rows.length,...Object.fromEntries(['active','sold','hidden','rejected','pending','archived'].map(status=>[status,rows.filter(r=>r.status===status).length])),featured:rows.filter(r=>featured(r)).length,soon:rows.filter(r=>featured(r)&&r.featuredEndAt-Date.now()<48*3600000).length,reports:state.reports.filter(r=>r.status==='open'&&(!country||rows.some(a=>a.id===r.listingId))).length,users:state.users.filter(r=>!country||r.country===country).length};
  const counts=state.counts[country||'ALL'],exactFields=counts?.exactFields||[];
  return {...boundedValues,...counts?.values,bounded:Object.keys(boundedValues).some(key=>!exactFields.includes(key)),exactFields,countFields:counts?.fields||{}};
 }
 const unsubscribe=auth.subscribe(()=>{epoch++;ownVersion++;adminVersion++;countVersion++;ownRows=[];adminRows=[];adminAds=[];images.clear();imageRevisions.clear();state.users=[];state.services=[];state.reports=[];state.audit=[];state.counts={};state.ownPages={};state.adminPages={};deepRows.clear();deepVersions.clear();for(const key of Object.keys(ownCursors))delete ownCursors[key];for(const key of Object.keys(adminCursors))delete adminCursors[key];state.legacy={};for(const name of ['users','marketplaceRequests','marketplaceAuditLogs','serviceRequests','adminAccess'])delete state.capabilities[name];publish();});
 const store={state,subscribe(fn){listeners.add(fn);fn(state);return()=>listeners.delete(fn);},refreshPublic,loadMorePublic,loadListing,loadOwn,loadMoreOwn,loadAdmin,loadMoreAdmin,loadAdImages,loadCounts,async refresh(){const countKeys=Object.keys(state.counts),deepIds=[...deepRows.keys()];deepRows.clear();await refreshPublic();await loadOwn();await loadAdmin();for(const id of deepIds)await loadListing(id);if(modernMode)for(const key of countKeys.length?countKeys:['ALL'])await loadCounts(key==='ALL'?'':key);},statistics,dispose(){disposed=true;epoch++;unsubscribe();listeners.clear();ownRows=[];adminRows=[];adminAds=[];images.clear();imageRevisions.clear();state.users=[];state.services=[];state.reports=[];state.audit=[];state.legacy={};state.listings=publicRows;state.ads=state.publicAds;}};
 await refreshPublic();return store;
}
