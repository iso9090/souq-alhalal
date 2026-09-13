import {PLACEMENTS} from '../commercial-model.js';
import {safeTarget} from './marketplace-services.js';

export const COMMERCIAL_IMAGE_LIMIT=110000;
const countries=['ALL','AE','SA','EG','OM','JO','MA'];
const fail=code=>{throw Object.assign(new Error(code),{code});};
const reasonText=value=>{if(typeof value!=='string'||value.trim().length<3||value.length>500)fail('REASON');return value.trim();};
const date=value=>typeof value==='number'?value:Date.parse(value);
function clean(data={}) {
 const result={};
 for(const [key,max] of [['title',100],['advertiserName',100],['description',500],['cta',50]]){
  if(typeof data[key]!=='string'||data[key].length>max||(key!=='description'&&!data[key].trim()))fail('FIELDS');
  result[key]=data[key].trim();
 }
 result.targetUrl=safeTarget(data.targetUrl);if(!result.targetUrl||result.targetUrl.length>2000)fail('FIELDS');
 if(!PLACEMENTS.includes(data.placement)||!countries.includes(data.countryTarget))fail('FIELDS');
 Object.assign(result,{placement:data.placement,countryTarget:data.countryTarget,startAt:date(data.startAt),endAt:date(data.endAt),priority:Number(data.priority)});
 if(!Number.isFinite(result.startAt)||!Number.isFinite(result.endAt)||result.endAt<=result.startAt||result.endAt-result.startAt>365*86400000||!Number.isInteger(result.priority)||result.priority<1||result.priority>10)fail('DURATION');
 if(typeof data.image!=='string'||data.image.length>COMMERCIAL_IMAGE_LIMIT||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(data.image))fail('IMAGES');
 result.image=data.image;return result;
}

/** Free, audited campaign publication. Public documents never contain the private request payload. */
export function attachProductionCommercial(store,{sdk,db,auth,config={}}={}) {
 const actor=()=>{if(config.writesEnabled!==true)fail('WRITES_DISABLED');const a=auth?.state?.actor;if(!a?.uid)fail('AUTH');if(a.status!=='active')fail('ACCOUNT');return a;};
 const admin=()=>{const a=actor();if(a.role!=='super_admin'||a.ready!==true)fail('PERMISSION');return a;};
 const fresh=name=>sdk.doc(sdk.collection(db,name));
 const ref=(name,id)=>{if(typeof id!=='string'||!id||id.includes('/'))fail('MISSING');return sdk.doc(db,name,id);};
 const refresh=async value=>{await store.refresh?.();return value;};
 const read=async(tx,r)=>{const snap=await tx.get(r);if(!snap.exists())fail('MISSING');return snap.data();};
 function audit(tx,request,patch,a,action,reason,status,log){
  tx.update(request,{...patch,auditId:log.id,updatedAt:sdk.serverTimestamp()});
  tx.set(log,{actorUid:a.uid,action,targetId:request.id,targetCollection:'marketplaceRequests',reason,timestamp:sdk.serverTimestamp(),result:status});
 }
 function publication(tx,id,data,ownerUid,status,auditId){
  const {image,...metadata}=data;
  tx.set(ref('marketplaceCommercialAds',id),{...metadata,status,ownerUid,requestId:id,updatedAt:sdk.serverTimestamp(),auditId});
  tx.set(ref('marketplaceCommercialImages',id),{imageData:image,updatedAt:sdk.serverTimestamp()});
 }
 store.requestCommercial=async data=>{
  const a=actor(),body=clean(data),r=fresh('marketplaceRequests');
  await sdk.setDoc(r,{type:'commercial',ownerUid:a.uid,status:'pending',createdAt:sdk.serverTimestamp(),data:body});
  return refresh({id:r.id});
 };
 store.reviewCommercial=async(id,decision,reason)=>{
  const a=admin(),explanation=reasonText(reason);if(!['approved','rejected','paused'].includes(decision))fail('STATE');
  const request=ref('marketplaceRequests',id),publicRef=ref('marketplaceCommercialAds',id),log=fresh('marketplaceAuditLogs');
  await sdk.runTransaction(db,async tx=>{
   const row=await read(tx,request),published=await tx.get(publicRef);
   if(row.type!=='commercial'||!({pending:['approved','rejected'],approved:['paused','rejected'],paused:['approved','rejected']}[row.status]||[]).includes(decision))fail('STATE');
   const body=clean(row.data);if(decision==='approved'&&body.endAt<=Date.now())fail('STATE');admin();
   if(decision==='approved'||published.exists())publication(tx,id,body,row.ownerUid,decision,log.id);
   audit(tx,request,{status:decision},a,'commercial-'+decision,explanation,decision,log);
  });return refresh({id,status:decision});
 };
 store.editCommercial=async(id,data,reason)=>{
  const a=admin(),body=clean(data),explanation=reasonText(reason),request=ref('marketplaceRequests',id),publicRef=ref('marketplaceCommercialAds',id),log=fresh('marketplaceAuditLogs');
  let status;
  await sdk.runTransaction(db,async tx=>{
   const row=await read(tx,request),published=await tx.get(publicRef);status=row.status;
   if(row.type!=='commercial'||!['pending','approved','paused','rejected'].includes(status)||status==='approved'&&body.endAt<=Date.now())fail('STATE');admin();
   if(status==='approved'||published.exists())publication(tx,id,body,row.ownerUid,status,log.id);
   audit(tx,request,{data:body},a,'commercial-edited',explanation,'edited',log);
  });return refresh({id,status});
 };
 return store;
}
