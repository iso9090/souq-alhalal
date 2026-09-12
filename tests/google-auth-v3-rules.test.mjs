import fs from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,getDoc,serverTimestamp} from 'firebase/firestore';
if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Local emulator required');
const env=await initializeTestEnvironment({projectId:'demo-souq-google-v3',firestore:{rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
let count=0;const check=async(name,fn)=>{await fn();count++;console.log('PASS | '+name);};
const profile=uid=>({uid,displayName:'Google test',email:uid+'@example.test',phone:'',accountType:'buyer',status:'active',createdAt:serverTimestamp(),lastLoginAt:serverTimestamp(),authProvider:'google'});
const client=(uid,provider='google.com',extra={})=>env.authenticatedContext(uid,{email:uid+'@example.test',firebase:{sign_in_provider:provider},...extra}).firestore();
try{
 await env.clearFirestore();
 const google=client('new');
 await check('new Google buyer profile with token-bound identity succeeds',()=>assertSucceeds(setDoc(doc(google,'users/new'),profile('new'))));
 await check('existing Google profile lastLoginAt can update',()=>assertSucceeds(updateDoc(doc(google,'users/new'),{lastLoginAt:serverTimestamp()})));
 for(const [label,patch] of [['email',{email:'other@example.test'}],['phone',{phone:'+971500000000'}],['provider',{authProvider:'password'}],['admin status',{status:'admin'}],['admin role',{role:'super_admin'}],['claim',{admin:true}],['account type',{accountType:'admin'}]]){
  const uid='forged-'+label.replaceAll(' ','-');
  await check('new Google user cannot forge '+label,()=>assertFails(setDoc(doc(client(uid),'users',uid),{...profile(uid),...patch})));
 }
 await check('phone sign-in cannot forge Google metadata',()=>assertFails(setDoc(doc(client('phone','phone'),'users/phone'),profile('phone'))));
 await check('different UID write denied',()=>assertFails(setDoc(doc(google,'users/other'),profile('other'))));
 await check('anonymous Google profile denied',()=>assertFails(setDoc(doc(env.unauthenticatedContext().firestore(),'users/anon'),profile('anon'))));
 for(const field of ['email','phone','authProvider']){
  await check('existing profile '+field+' immutable through client login',()=>assertFails(updateDoc(doc(google,'users/new'),{[field]:'forged'})));
 }
 await check('self promotion remains denied',()=>assertFails(updateDoc(doc(google,'users/new'),{status:'admin',admin:true})));
 for(const status of ['suspended','blocked']){
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users',status),{...profile(status),status}));
  await check(status+' Google user cannot refresh or reactivate profile',async()=>{
   await assertFails(updateDoc(doc(client(status),'users',status),{lastLoginAt:serverTimestamp()}));
   await assertFails(updateDoc(doc(client(status),'users',status),{status:'active'}));
  });
 }
 for(const [uid,provider] of [['legacy-phone','phone'],['legacy-email','password']]){
  const {email,phone,authProvider,...legacy}=profile(uid);
  await check(provider+' legacy profile creation preserved',()=>assertSucceeds(setDoc(doc(client(uid,provider),'users',uid),legacy)));
 }
 await env.withSecurityRulesDisabled(async c=>{
  await setDoc(doc(c.firestore(),'users/owner'),{uid:'owner',status:'active',accountType:'both',marker:'keep'});
  await setDoc(doc(c.firestore(),'adminSecurity/config'),{enabled:true,superAdminUids:['owner']});
  await setDoc(doc(c.firestore(),'adminAccess/owner'),{role:'super_admin',adminStatus:'active'});
  await setDoc(doc(c.firestore(),'adminAuditLogs/test'),{action:'fixture'});
 });
 await check('registered admin keeps read access with Google claim',()=>assertSucceeds(getDoc(doc(client('owner','google.com',{admin:true}),'adminAuditLogs/test'))));
 await check('Google email matching never grants audit access',()=>assertFails(getDoc(doc(client('new','google.com',{email:'owner@example.test'}),'adminAuditLogs/test'))));
 await check('claim outside protected owner registry denied',()=>assertFails(getDoc(doc(client('new','google.com',{admin:true}),'adminAuditLogs/test'))));
 console.log(`SUMMARY | ${count}/${count} passed`);
}finally{await env.cleanup();}
