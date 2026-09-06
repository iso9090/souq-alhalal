import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,getDocs,collection,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp} from 'firebase/firestore';
if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Local emulator required');
const env=await initializeTestEnvironment({projectId:'demo-souq-admin',firestore:{rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
const seller=env.authenticatedContext('seller').firestore(),buyer=env.authenticatedContext('buyer').firestore(),admin=env.authenticatedContext('admin',{admin:true}).firestore();
let n=0;async function test(name,fn){await fn();console.log('PASS | '+name);n++;}
let seq=0;
function moderation(db,kind,id,patch){const batch=writeBatch(db),log='log'+(++seq);batch.set(doc(db,'adminAuditLogs',log),{adminUid:db===admin?'admin':'seller',action:'moderation',targetType:kind,targetId:id,reason:'سبب المراجعة',timestamp:serverTimestamp(),metadata:{}});batch.update(doc(db,kind,id),{...patch,moderationLogId:log});return batch.commit();}
try{
 await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const b=writeBatch(c.firestore());for(const uid of ['seller','buyer','admin'])b.set(doc(c.firestore(),'users',uid),{uid,status:'active',displayName:uid});for(const id of ['one','two'])b.set(doc(c.firestore(),'animals',id),{sellerId:'seller',saleType:'direct',status:'active',images:['data:image/jpeg;base64,AAA','data:image/jpeg;base64,BBB'],price:100});await b.commit();});
 await test('ordinary user cannot list users',()=>assertFails(getDocs(collection(buyer,'users'))));
 await test('admin can list users',()=>assertSucceeds(getDocs(collection(admin,'users'))));
 await test('ordinary user cannot moderate',()=>assertFails(moderation(seller,'users','buyer',{status:'blocked'})));
 await test('admin action without atomic audit denied',()=>assertFails(updateDoc(doc(admin,'users','seller'),{status:'blocked'})));
 await test('suspend account',()=>assertSucceeds(moderation(admin,'users','seller',{status:'suspended'})));
 await test('suspended owner cannot restore active',()=>assertFails(updateDoc(doc(seller,'users','seller'),{status:'active'})));
 await test('suspended seller cannot edit ad',()=>assertFails(updateDoc(doc(seller,'animals','one'),{price:200})));
 await test('block account',()=>assertSucceeds(moderation(admin,'users','seller',{status:'blocked'})));
 await test('reactivate account',()=>assertSucceeds(moderation(admin,'users','seller',{status:'active'})));
 await test('active seller can edit own ad',()=>assertSucceeds(updateDoc(doc(seller,'animals','one'),{price:150})));
 await test('other seller cannot edit ad',()=>assertFails(updateDoc(doc(buyer,'animals','one'),{price:1})));
 await test('remove one image with atomic audit',()=>assertSucceeds(moderation(admin,'animals','one',{images:['data:image/jpeg;base64,BBB'],imagesLocked:true,moderationLocked:true,status:'active'})));
 await test('remaining image and other ad preserved',async()=>{assert.deepEqual((await getDoc(doc(admin,'animals','one'))).data().images,['data:image/jpeg;base64,BBB']);assert.equal((await getDoc(doc(admin,'animals','two'))).data().images.length,2);});
 await test('stale seller image array denied',()=>assertFails(updateDoc(doc(seller,'animals','one'),{images:['data:image/jpeg;base64,AAA','data:image/jpeg;base64,BBB']})));
 await test('seller cannot clear moderation lock',()=>assertFails(updateDoc(doc(seller,'animals','one'),{imagesLocked:false})));
 await test('seller can mark active moderated ad sold but cannot reactivate it',async()=>{
   await assertSucceeds(updateDoc(doc(seller,'animals','one'),{status:'sold'}));
   await assertFails(updateDoc(doc(seller,'animals','one'),{status:'active'}));
   await assertFails(updateDoc(doc(seller,'animals','one'),{images:['data:image/jpeg;base64,AAA']}));
 });
 await test('seller cannot delete moderated ad and recreate it',()=>assertFails(deleteDoc(doc(seller,'animals','one'))));
 await test('last image requires needs_review',()=>assertFails(moderation(admin,'animals','one',{images:[],imagesLocked:true,moderationLocked:true,status:'active'})));
 await test('last image removed to review',()=>assertSucceeds(moderation(admin,'animals','one',{images:[],imagesLocked:true,moderationLocked:true,status:'needs_review'})));
 await test('seller cannot republish moderated ad',()=>assertFails(updateDoc(doc(seller,'animals','one'),{status:'active'})));
 const report={reporterId:'buyer',targetType:'animal',targetId:'two',reportedUserId:'seller',reason:'مخالفة',details:'تفاصيل',status:'open',createdAt:serverTimestamp()};
 await test('create report',()=>assertSucceeds(setDoc(doc(buyer,'reports','buyer_animal_two'),report)));
 await test('duplicate report denied',()=>assertFails(setDoc(doc(buyer,'reports','buyer_animal_two'),report)));
 await test('reporter cannot review own report',()=>assertFails(updateDoc(doc(buyer,'reports','buyer_animal_two'),{status:'resolved',reviewedBy:'buyer'})));
 await test('reported seller cannot read reporter identity',()=>assertFails(getDoc(doc(seller,'reports','buyer_animal_two'))));
 for(const status of ['reviewing','resolved','rejected'])await test('admin report '+status,()=>assertSucceeds(moderation(admin,'reports','buyer_animal_two',{status,reviewedAt:serverTimestamp(),reviewedBy:'admin',resolutionNotes:'تمت المراجعة'})));
 await test('admin reads audit',async()=>assert.ok((await getDocs(collection(admin,'adminAuditLogs'))).size>=7));
 await test('user cannot read audit',()=>assertFails(getDocs(collection(seller,'adminAuditLogs'))));
 await test('admin cannot edit audit',()=>assertFails(updateDoc(doc(admin,'adminAuditLogs','log3'),{reason:'edited'})));
 await test('admin cannot delete audit',()=>assertFails(deleteDoc(doc(admin,'adminAuditLogs','log3'))));
 console.log(`SUMMARY | ${n}/${n} passed`);
}finally{await env.cleanup();}
