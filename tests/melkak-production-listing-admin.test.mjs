import assert from 'node:assert/strict';
import {attachProductionListingAdmin} from '../melkak/production-listing-admin.js';
function setup({role='super_admin',enabled=true,listing={}}={}){const records=new Map([['marketplaceListings/item',{ownerUid:'seller',status:'active',createdAt:1,hasHistory:false,images:['inline-private-image'],featured:true,featuredStatus:'approved',featuredEndAt:Date.now()+86400000,...listing}]]),archives=[];let n=0;const sdk={doc:(base,name,id)=>id?{id,path:name+'/'+id}:{id:String(++n),path:base.path+'/'+n},collection:(_,path)=>({path}),serverTimestamp:()=>123,runTransaction:async(_,fn)=>{const writes=[];const result=await fn({get:async ref=>({exists:()=>records.has(ref.path),data:()=>structuredClone(records.get(ref.path))}),update:(r,d)=>writes.push(()=>records.set(r.path,{...records.get(r.path),...d})),set:(r,d)=>writes.push(()=>records.set(r.path,d)),delete:r=>writes.push(()=>records.delete(r.path))});writes.forEach(fn=>fn());return result;}};const store={state:{listings:[]},refresh:async()=>{},moderate:async(...a)=>archives.push(a)};attachProductionListingAdmin(store,{sdk,db:{},auth:{state:{actor:{uid:'boss',role,status:'active',ready:true}}},config:{writesEnabled:enabled}});return {store,records,archives};}
{
 const f=setup();await f.store.setFeaturedPriority('marketplace-item',20,'Reviewed order');const d=f.records.get('marketplaceListings/item');assert.equal(d.featuredPriority,20);assert.equal(d.createdAt,1);assert.equal(f.records.get('marketplaceAuditLogs/1').action,'featured-priority');
}
{
 const f=setup();await f.store.adminDeleteListing('marketplace-item','Remove clean listing');assert.ok(!f.records.has('marketplaceListings/item'));const tomb=f.records.get('marketplaceDeletions/item');assert.deepEqual(Object.keys(tomb).sort(),['listingId','ownerUid','actorUid','reason','auditId','timestamp'].sort());assert.equal(tomb.ownerUid,'seller');assert.equal(f.records.get('marketplaceAuditLogs/1').result,'deleted');assert.ok(!JSON.stringify([...f.records]).includes('inline-private-image'));
}
{
 const f=setup({listing:{hasHistory:true}});await f.store.adminDeleteListing('marketplace-item','Preserve historical record');assert.deepEqual(f.archives,[]);assert.equal(f.records.get('marketplaceListings/item').removed,true);assert.equal(f.records.get('marketplaceListings/item').moderationLocked,true);assert.equal(f.records.get('marketplaceAuditLogs/1').action,'listing-removed');assert.ok(f.records.has('marketplaceListings/item'));assert.ok(!f.records.has('marketplaceDeletions/item'));
}
for(const priority of [-1,101,0.5,'3'])await assert.rejects(()=>setup().store.setFeaturedPriority('item',priority,'reason'),{code:'FIELDS'});
for(const listing of [{status:'hidden'},{featured:false},{featuredStatus:'pending'},{featuredEndAt:1}])await assert.rejects(()=>setup({listing}).store.setFeaturedPriority('item',1,'reason'),{code:'STATE'});
await assert.rejects(()=>setup({role:'admin_assistant'}).store.adminDeleteListing('item','reason'),{code:'PERMISSION'});
await assert.rejects(()=>setup({enabled:false}).store.adminDeleteListing('item','reason'),{code:'WRITES_DISABLED'});
await assert.rejects(()=>setup().store.adminDeleteListing('item','   '),{code:'REASON'});
await assert.rejects(()=>setup().store.adminDeleteListing('legacy-item','reason'),{code:'LEGACY'});
console.log('PASS listing admin priority, clean deletion tombstone, history archive and permission boundaries');
