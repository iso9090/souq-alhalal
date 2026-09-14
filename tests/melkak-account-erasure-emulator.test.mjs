import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const req=createRequire(new URL('../tools/account-deletion/package.json',import.meta.url));
const {initializeApp,deleteApp}=req('firebase-admin/app'),{getFirestore,Timestamp}=req('firebase-admin/firestore'),{getAuth}=req('firebase-admin/auth');
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw Error('LOCAL_EMULATORS_REQUIRED');
const app=initializeApp({projectId:'demo-melkak-erasure'}),db=getFirestore(app),auth=getAuth(app),uid='erasure-fixture';
const env={...process.env};delete env.GOOGLE_APPLICATION_CREDENTIALS;
const run=(...args)=>execFileSync(process.execPath,['tools/account-deletion/process.mjs',uid,...args],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']});
let n=0;try{
 await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-melkak-erasure/databases/(default)/documents',{method:'DELETE'});
 await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-melkak-erasure/accounts',{method:'DELETE'});
 await auth.createUser({uid,email:'synthetic@example.test'});
 for(const [path,data]of [['adminSecurity/config',{enabled:true,superAdminUids:['protected-boss']}],['users/'+uid,{uid,status:'active',email:'synthetic@example.test'}],['users/other',{uid:'other',status:'active'}],['marketplaceListings/a',{ownerUid:uid,images:['data:image/jpeg;base64,/9j/AA==']}],['marketplaceRequests/r',{ownerUid:'other',listingId:'a'}],['marketplaceAccountDeletionRequests/'+uid,{uid,status:'requested',createdAt:Timestamp.now(),policyVersion:'2026-09-14'}]])await db.doc(path).set(data);
 let plan=JSON.parse(run('--plan'));assert.ok(plan.paths.includes('marketplaceListings/a'));n++;
 assert.throws(()=>run('--begin','not-reviewed'));assert.equal((await auth.getUser(uid)).disabled,false);n++;
 run('--begin',plan.sha);assert.equal((await auth.getUser(uid)).disabled,true);assert.equal((await db.doc('users/'+uid).get()).data().status,'deletion_processing');n++;
 plan=JSON.parse(run('--plan'));assert.throws(()=>run('--execute',plan.sha,'--external-data-cleared'));assert.ok((await db.doc('marketplaceListings/a').get()).exists);n++;
 // Synthetic emulator time only. Production tool has no bypass flag.
 await db.doc('marketplaceAccountDeletionRequests/'+uid).update({processingAt:Timestamp.fromMillis(Date.now()-66*60000)});
 plan=JSON.parse(run('--plan'));assert.throws(()=>run('--execute',plan.sha));n++;
 run('--execute',plan.sha,'--external-data-cleared');await assert.rejects(()=>auth.getUser(uid),{code:'auth/user-not-found'});n++;
 for(const path of ['users/'+uid,'marketplaceListings/a','marketplaceRequests/r','marketplaceAccountDeletionRequests/'+uid])assert.equal((await db.doc(path).get()).exists,false);n++;
 assert.equal((await db.doc('users/other').get()).data().status,'active');n++;
 console.log(`SUMMARY ${n}/${n} PASS; real Firebase Auth + Firestore emulators; Production writes 0`);
}finally{await deleteApp(app);}
