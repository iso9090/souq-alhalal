import assert from 'node:assert/strict';
import {prepareProduction} from '../melkak/production-bootstrap.js';
const config={mode:'production',datasource:'production',authProvider:'firebase',writesEnabled:false};
let sdkCalls=0;
for(const config of [undefined,{mode:'local'}, {mode:'production',datasource:'demo'},{mode:'production',datasource:'production',authProvider:'firebase'}]) {
 const result=await prepareProduction({config,loadAuth:async()=>{sdkCalls++;throw Error('unexpected');}});
 assert.equal(result.ready,false);assert.equal(result.reason,'configuration_incomplete');
}
assert.equal(sdkCalls,0);
const calls=[],db={},firebaseAuth={},app={name:'[DEFAULT]'},sdk={getApp:()=>app,getFirestore:a=>{assert.equal(a,app);return db;}};
const auth={dispose(){calls.push('dispose');}},store={state:{}};
const ready=await prepareProduction({config,loadCountries:async()=>({AE:{}}),loadAuth:async()=>({loadFirebaseSdk:async()=>sdk,createFirebaseAuthAdapter:async o=>{assert.equal(o.sdk,sdk);calls.push('auth');return auth;}}),createDataSource:async options=>{assert.equal(options.sdk,sdk);assert.equal(options.auth,auth);assert.equal(options.db,db);calls.push('store');return store;},attachServices:(s,o)=>{assert.equal(s,store);assert.equal(o.auth,auth);calls.push('services');return s;}});
assert.equal(ready.ready,true);assert.equal(ready.store,store);assert.equal(ready.auth,auth);assert.deepEqual(calls,['auth','store','services']);
const failed=await prepareProduction({config,loadCountries:async()=>({}),loadAuth:async()=>{throw Error('offline');}});assert.equal(failed.ready,false);assert.equal(failed.reason,'service_unavailable');
console.log('PASS production bootstrap shared SDK/auth, valid config and failure handling');
