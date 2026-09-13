import test from 'node:test';
import assert from 'node:assert/strict';
const {ensureMarketplaceProfile}=await import('../melkak/profile-bootstrap.js');
function setup(existing){const writes=[];const sdk={doc:(_db,...p)=>p.join('/'),serverTimestamp:()=>123,runTransaction:async(_db,fn)=>fn({get:async()=>({exists:()=>!!existing,data:()=>existing}),set:(p,d)=>writes.push({p,d})})};return {sdk,writes,db:{}};}
const user={uid:'real-uid',displayName:'New member',email:'person@example.test',phoneNumber:null,providerData:[{providerId:'google.com'}]};
test('disabled bootstrap does not write',async()=>{const h=setup();await ensureMarketplaceProfile({...h,user,enabled:false});assert.equal(h.writes.length,0);});
test('new Google profile preserves UID and has no administrative fields',async()=>{const h=setup();await ensureMarketplaceProfile({...h,user,enabled:true});assert.equal(h.writes.length,1);const {p,d}=h.writes[0];assert.equal(p,'users/real-uid');assert.equal(d.uid,user.uid);assert.equal(d.status,'active');assert.equal(d.accountType,'buyer');assert.equal(d.email,user.email);assert.equal(d.authProvider,'google');for(const f of ['admin','role','permissions','claims'])assert.equal(f in d,false);});
test('existing active suspended blocked and legacy profile remain untouched',async()=>{for(const status of ['active','suspended','blocked',undefined]){const h=setup({status});await ensureMarketplaceProfile({...h,user,enabled:true});assert.equal(h.writes.length,0);}});
test('transaction refusal propagates without fake profile',async()=>{const h=setup();h.sdk.runTransaction=async()=>{throw Error('denied')};await assert.rejects(ensureMarketplaceProfile({...h,user,enabled:true}),/denied/);assert.equal(h.writes.length,0);});
test('guest and non Google account cannot bootstrap',async()=>{for(const u of [null,{...user,providerData:[{providerId:'password'}]}]){const h=setup();await assert.rejects(ensureMarketplaceProfile({...h,user:u,enabled:true}));assert.equal(h.writes.length,0);}});
