import fs from 'node:fs';import assert from 'node:assert/strict';import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';import {doc,setDoc,updateDoc,serverTimestamp,getDoc,deleteDoc} from 'firebase/firestore';
if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Local emulator required');
const env=await initializeTestEnvironment({projectId:'demo-melkak-republish',firestore:{rules:fs.readFileSync(new URL('../melkak/firestore.proposed.rules',import.meta.url),'utf8')}}),owner=env.authenticatedContext('seller').firestore(),other=env.authenticatedContext('other').firestore();let passed=0,failed=0;const test=async(name,fn)=>{try{await fn();passed++;console.log('PASS',name)}catch(e){failed++;console.log('FAIL',name,e.message)}};
const base={schemaVersion:1,ownerUid:'seller',category:'cars',country:'AE',region:'الشارقة',city:'الذيد',currency:'AED',title:'Review car',description:'Local emulator listing',price:100,images:['data:image/jpeg;base64,/9j/AA=='],attributes:{},contact:{phone:'+971500000000',call:true,whatsapp:true,showNumber:false,consent:true},status:'active'};
try{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'marketplaceCategories','cars'),{enabled:true});for(const uid of ['seller','other'])await setDoc(doc(c.firestore(),'users',uid),{status:'active'});await setDoc(doc(c.firestore(),'marketplaceListings','clean'),{...base,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});});
await test('owner hides clean listing',()=>assertSucceeds(updateDoc(doc(owner,'marketplaceListings','clean'),{status:'hidden',hiddenBy:'owner',updatedAt:serverTimestamp()})));
await test('owner republishes self-hidden',()=>assertSucceeds(updateDoc(doc(owner,'marketplaceListings','clean'),{status:'active',hiddenBy:'',updatedAt:serverTimestamp()})));
for(const [id,extra]of Object.entries({locked:{moderationLocked:true,hiddenBy:'owner'},admin:{hiddenBy:'admin'},rejected:{moderationStatus:'rejected',hiddenBy:'owner'},suspended:{moderationStatus:'suspended',hiddenBy:'owner'},review:{requiresReview:true,hiddenBy:'owner'},needs_review:{moderationStatus:'needs_review',hiddenBy:'owner'},pending:{moderationStatus:'pending',hiddenBy:'owner'},unknown:{},unknown_provenance:{hiddenBy:'other'}})){
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'marketplaceListings',id),{...base,status:'hidden',...extra,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
 const old=(await getDoc(doc(owner,'marketplaceListings',id))).data();
 await test(id+' cannot strip moderation fields and republish',()=>assertFails(setDoc(doc(owner,'marketplaceListings',id),{...base,createdAt:old.createdAt,updatedAt:serverTimestamp()})));
 await test(id+' cannot reactivate preserving fields',()=>assertFails(updateDoc(doc(owner,'marketplaceListings',id),{status:'active',hiddenBy:'',updatedAt:serverTimestamp()})));
}
for(const status of ['suspended','blocked']){
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users',status),{status}));
 const db=env.authenticatedContext(status).firestore();
 await test(status+' profile cannot create',()=>assertFails(setDoc(doc(db,'marketplaceListings','create-'+status),{...base,ownerUid:status,createdAt:serverTimestamp(),updatedAt:serverTimestamp()})));
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'marketplaceListings','hidden-'+status),{...base,ownerUid:status,status:'hidden',hiddenBy:'owner',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
 await test(status+' profile cannot republish',()=>assertFails(updateDoc(doc(db,'marketplaceListings','hidden-'+status),{status:'active',hiddenBy:'',updatedAt:serverTimestamp()})));
}
await test('different owner denied',()=>assertFails(updateDoc(doc(other,'marketplaceListings','clean'),{status:'hidden',hiddenBy:'owner',updatedAt:serverTimestamp()})));
await test('owner cannot forge moderation metadata on create',()=>assertFails(setDoc(doc(owner,'marketplaceListings','forged'),{...base,moderationLocked:false,createdAt:serverTimestamp(),updatedAt:serverTimestamp()})));
for(const categoryState of ['disabled','missing']){
 await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();if(categoryState==='disabled')await setDoc(doc(db,'marketplaceCategories','cars'),{enabled:false});else await deleteDoc(doc(db,'marketplaceCategories','cars'));await setDoc(doc(db,'marketplaceListings','category-'+categoryState),{...base,status:'hidden',hiddenBy:'owner',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});});
 await test(categoryState+' category denies create',()=>assertFails(setDoc(doc(owner,'marketplaceListings','create-category-'+categoryState),{...base,createdAt:serverTimestamp(),updatedAt:serverTimestamp()})));
 await test(categoryState+' category denies republish',()=>assertFails(updateDoc(doc(owner,'marketplaceListings','category-'+categoryState),{status:'active',hiddenBy:'',updatedAt:serverTimestamp()})));
}
console.log('SUMMARY | '+passed+'/'+(passed+failed)+' PASS');if(failed)process.exitCode=1;
}finally{await env.cleanup()}
