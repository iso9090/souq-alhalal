import assert from 'node:assert/strict';
import fs from 'node:fs';
assert.ok(fs.existsSync('melkak/production-bootstrap.js'),'Production bootstrap must explicitly require real auth and datasource');
const {prepareProduction}=await import('../melkak/production-bootstrap.js');
let calls=0;
const loadAuth=async()=>{calls++;throw Error('must not initialize');};
for(const config of [undefined,{mode:'local',datasource:'demo'}, {mode:'production',datasource:'production',authProvider:'demo'}, {mode:'production',datasource:'unconfigured',authProvider:'firebase'}, {mode:'production',datasource:'production',authProvider:'firebase'}]) {
 const result=await prepareProduction({config,loadAuth});assert.equal(result.ready,false);
}
assert.equal(calls,0,'Missing production datastore must block before SDK loading');
const failure=await prepareProduction({config:{mode:'production',datasource:'production',authProvider:'firebase'},createDataSource:async()=>{throw Error('offline')},loadAuth});
assert.equal(failure.ready,false);assert.equal(calls,0);

// Exercise the real adapter through the bootstrap factory seam, using SDK mocks
// solely to prevent external authentication and Firestore requests.
const {createFirebaseAuthAdapter}=await import('../melkak/auth-adapter.js');
const user={uid:'existing-firebase-uid',displayName:'Existing user'};
const sharedApp={name:'[DEFAULT]',options:{projectId:'souq-al-halal-9e3e8'}};
const firebaseAuth={currentUser:user};let authListener,popupCalls=0;
const sdk={
 getApps:()=>[sharedApp],getApp:()=>sharedApp,
 getAuth:app=>{assert.equal(app,sharedApp);return firebaseAuth;},getFirestore:()=>({}),
 onAuthStateChanged:(_auth,listener)=>{authListener=listener;return ()=>{};},
 getIdTokenResult:async()=>({claims:{}}),doc:(_db,...parts)=>parts.join('/'),
 getDoc:async path=>({data:()=>path==='users/'+user.uid?{status:'active'}:null}),
 GoogleAuthProvider:class {},
 signInWithPopup:async(auth,provider)=>{assert.equal(auth,firebaseAuth);assert.ok(provider instanceof sdk.GoogleAuthProvider);popupCalls++;return {user};}
};
const datasource={source:'reviewed-production-test-factory'};
const ready=await prepareProduction({config:{mode:'production',datasource:'production',authProvider:'firebase'},createDataSource:async()=>datasource,loadAuth:async()=>({createFirebaseAuthAdapter:()=>createFirebaseAuthAdapter({sdk})})});
assert.equal(ready.ready,true);assert.equal(ready.datasource,datasource);
await authListener(user);
assert.equal(ready.auth.state.status,'authenticated');assert.equal(ready.auth.state.actor.uid,'existing-firebase-uid');assert.equal(ready.auth.state.actor.active,true);
const login=await ready.auth.signInGoogle();assert.equal(login.user.uid,'existing-firebase-uid');assert.equal(popupCalls,1);
ready.auth.dispose();
console.log('SUMMARY | 8/8 PASS');
