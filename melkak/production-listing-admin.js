import {timestampMillis} from './production-model.js';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const reasonText=value=>{if(typeof value!=='string'||value.trim().length<3||value.length>500)fail('REASON');return value.trim();};

export function attachProductionListingAdmin(store,{sdk,db,auth,config={}}={}){
 const actor=()=>{if(config.writesEnabled!==true)fail('WRITES_DISABLED');const a=auth?.state?.actor;if(!a?.uid)fail('AUTH');if(a.status!=='active')fail('ACCOUNT');if(a.role!=='super_admin'||a.ready!==true)fail('PERMISSION');return a;};
 const raw=id=>{if(typeof id!=='string'||id.startsWith('legacy-'))fail('LEGACY');const item=store.state?.listings?.find(r=>r.id===id);if(item?.legacy||item?.readOnly||item?.sourceCollection==='animals')fail('LEGACY');const value=item?.sourceId||id.replace(/^marketplace-/,'');if(!value||value.includes('/')||value.length>1500)fail('FIELDS');return value;};
 const freshLog=()=>sdk.doc(sdk.collection(db,'marketplaceAuditLogs'));
 const audit=(tx,log,a,id,action,reason,result)=>tx.set(log,{actorUid:a.uid,action,targetCollection:'marketplaceListings',targetId:id,reason,timestamp:sdk.serverTimestamp(),result});
 async function read(tx,ref,a){const snapshot=await tx.get(ref);if(!snapshot.exists())fail('MISSING');if(actor().uid!==a.uid)fail('AUTH');return snapshot.data();}
 store.setFeaturedPriority=async(id,priority,reason)=>{
  const a=actor(),key=raw(id);reason=reasonText(reason);if(!Number.isInteger(priority)||priority<0||priority>100)fail('FIELDS');const ref=sdk.doc(db,'marketplaceListings',key);
  await sdk.runTransaction(db,async tx=>{const listing=await read(tx,ref,a);if(listing.status!=='active'||listing.featured!==true||listing.featuredStatus!=='approved'||timestampMillis(listing.featuredEndAt)<=Date.now())fail('STATE');const log=freshLog();tx.update(ref,{featuredPriority:priority,auditId:log.id,updatedAt:sdk.serverTimestamp()});audit(tx,log,a,key,'featured-priority',reason,'updated');});
  await store.refresh?.();
 };
 store.adminDeleteListing=async(id,reason)=>{
  const a=actor(),key=raw(id);reason=reasonText(reason);const ref=sdk.doc(db,'marketplaceListings',key);
  const archived=await sdk.runTransaction(db,async tx=>{const listing=await read(tx,ref,a);if(listing.hasHistory!==false)return true;
   if(typeof listing.ownerUid!=='string'||!listing.ownerUid)fail('STATE');
   const log=freshLog();tx.delete(ref);tx.set(sdk.doc(db,'marketplaceDeletions',key),{listingId:key,ownerUid:listing.ownerUid,actorUid:a.uid,reason,auditId:log.id,timestamp:sdk.serverTimestamp()});audit(tx,log,a,key,'listing-deleted',reason,'deleted');return false;
  });
  if(archived){await store.moderate(id,'archived',reason);return {archived:true,deleted:false};}
  await store.refresh?.();return {archived:false,deleted:true};
 };
 return store;
}
