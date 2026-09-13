import test from 'node:test';
import assert from 'node:assert/strict';
import {attachProductionCommercial} from '../melkak/production-commercial.js';
const art='data:image/jpeg;base64,YQ==';
const data=()=>({title:'Campaign',advertiserName:'Advertiser',description:'Details',cta:'Visit',image:art,targetUrl:'https://example.com/path',countryTarget:'AE',placement:'hero',priority:10,startAt:Date.now()-1000,endAt:Date.now()+86400000});
function harness(role='super_admin'){
 const rows=new Map(),writes=[];let seq=0,refreshes=0;
 const ref=(collection,id)=>({id,path:collection+'/'+id,parent:{id:collection}});
 const sdk={collection:(_db,name)=>({id:name}),doc:(a,b,c)=>c?ref(b,c):ref(a.id,'id'+(++seq)),serverTimestamp:()=>123456,
  setDoc:async(r,d)=>{rows.set(r.path,structuredClone(d));writes.push(r.path);},
  runTransaction:async(_db,fn)=>{const pending=[];let writing=false;await fn({get:async r=>{assert.equal(writing,false,'all reads must precede writes');const d=rows.get(r.path);return {exists:()=>!!d,data:()=>structuredClone(d)};},set:(r,d)=>{writing=true;pending.push([r,d]);},update:(r,d)=>{writing=true;assert.ok(rows.has(r.path));pending.push([r,{...rows.get(r.path),...d}]);}});for(const [r,d]of pending){rows.set(r.path,structuredClone(d));writes.push(r.path);}}};
 const auth={state:{actor:{uid:'admin',status:'active',ready:true,role}}},config={writesEnabled:true};
 const store={state:{},refresh:async()=>refreshes++};attachProductionCommercial(store,{sdk,db:{},auth,config});return {store,rows,writes,auth,config,get refreshes(){return refreshes;}};
}
test('approval publishes separate public metadata and image with linked audit; pause/reapprove/reject stay atomic',async()=>{
 const h=harness();const {id}=await h.store.requestCommercial(data());const request=h.rows.get('marketplaceRequests/'+id);assert.equal(request.status,'pending');assert.equal(h.rows.has('marketplaceCommercialAds/'+id),false);
 await h.store.reviewCommercial(id,'approved','Valid campaign');
 const pub=h.rows.get('marketplaceCommercialAds/'+id),image=h.rows.get('marketplaceCommercialImages/'+id),approved=h.rows.get('marketplaceRequests/'+id);
 assert.equal(pub.status,'approved');assert.equal(pub.requestId,id);assert.equal(pub.ownerUid,'admin');assert.equal('image' in pub,false);assert.equal('data' in pub,false);assert.equal(image.imageData,art);assert.equal(pub.auditId,approved.auditId);assert.equal(h.rows.get('marketplaceAuditLogs/'+pub.auditId).action,'commercial-approved');
 for(const decision of ['paused','approved','rejected']){await h.store.reviewCommercial(id,decision,'Admin reviewed');assert.equal(h.rows.get('marketplaceCommercialAds/'+id).status,decision);assert.equal(h.rows.get('marketplaceRequests/'+id).status,decision);}
 assert.equal(h.rows.get('marketplaceRequests/'+id).createdAt,request.createdAt);assert.equal(h.refreshes,5);
});
test('admin edit preserves request provenance, edits publication and image, and requires audit reason',async()=>{
 const h=harness();const {id}=await h.store.requestCommercial(data());await h.store.reviewCommercial(id,'approved','Valid campaign');
 h.auth.state.actor.uid='other-admin';await h.store.editCommercial(id,{...data(),title:'Edited',image:'data:image/jpeg;base64,Yg=='},'Correct artwork');
 const request=h.rows.get('marketplaceRequests/'+id),pub=h.rows.get('marketplaceCommercialAds/'+id);
 assert.equal(request.ownerUid,'admin');assert.equal(pub.ownerUid,'admin');assert.equal(pub.title,'Edited');assert.equal(request.data.title,'Edited');assert.equal(pub.status,'approved');assert.equal(h.rows.get('marketplaceCommercialImages/'+id).imageData,'data:image/jpeg;base64,Yg==');assert.equal(h.rows.get('marketplaceAuditLogs/'+pub.auditId).action,'commercial-edited');
 const count=h.writes.length;await assert.rejects(h.store.editCommercial(id,data(),'x'),{code:'REASON'});assert.equal(h.writes.length,count);
});
test('invalid artwork, URLs, schedules, permissions, expiry and disabled writes produce no mutations',async()=>{
 const h=harness();for(const patch of [{image:'data:image/jpeg;base64,'+'A'.repeat(110001)},{targetUrl:'http://example.com'},{targetUrl:'https://u:p@example.com'},{endAt:0},{priority:0},{countryTarget:'XX'}])await assert.rejects(h.store.requestCommercial({...data(),...patch}));assert.equal(h.writes.length,0);
 const {id}=await h.store.requestCommercial(data());h.auth.state.actor.role='admin_assistant';await assert.rejects(h.store.reviewCommercial(id,'approved','Valid reason'),{code:'PERMISSION'});h.auth.state.actor.role='super_admin';h.auth.state.actor.status='suspended';await assert.rejects(h.store.reviewCommercial(id,'approved','Valid reason'),{code:'ACCOUNT'});h.auth.state.actor.status='active';h.config.writesEnabled=false;await assert.rejects(h.store.requestCommercial(data()),{code:'WRITES_DISABLED'});h.config.writesEnabled=true;
 h.rows.get('marketplaceRequests/'+id).data.endAt=Date.now()-1;const count=h.writes.length;await assert.rejects(h.store.reviewCommercial(id,'approved','Valid reason'),{code:'STATE'});assert.equal(h.writes.length,count);
});
test('editing pending request keeps it private, rejection of pending does not publish image',async()=>{
 const h=harness();const {id}=await h.store.requestCommercial(data());await h.store.editCommercial(id,{...data(),title:'Pending edit'},'Correct title');assert.equal(h.rows.has('marketplaceCommercialAds/'+id),false);await h.store.reviewCommercial(id,'rejected','Not appropriate');assert.equal(h.rows.has('marketplaceCommercialImages/'+id),false);
});
