import fs from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,getDoc,Timestamp,serverTimestamp} from 'firebase/firestore';
if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Local emulator required');
const env=await initializeTestEnvironment({projectId:'demo-souq-v2',firestore:{rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
let count=0;const test=async(name,fn)=>{await fn();console.log('PASS | '+name);count++;};
try{
await env.clearFirestore();
const owner=env.authenticatedContext('owner',{admin:true}).firestore(),seller=env.authenticatedContext('seller').firestore(),anon=env.unauthenticatedContext().firestore();
await env.withSecurityRulesDisabled(async c=>{
  for(const uid of ['owner','seller','assistant'])await setDoc(doc(c.firestore(),'users',uid),{uid,status:'active'});
  await setDoc(doc(c.firestore(),'animals','old'),{sellerId:'seller',saleType:'direct',status:'active',images:['a','b','c','d','e']});
});
const listing=(images=['https://res.cloudinary.com/demo/image/upload/a.jpg'],extra={})=>({sellerId:'seller',saleType:'direct',country:'AE',region:'الشارقة',city:'الذيد',status:'active',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),images,...extra});
await test('create with one image allowed',()=>assertSucceeds(setDoc(doc(seller,'animals','one'),listing())));
await test('create with three images allowed',()=>assertSucceeds(setDoc(doc(seller,'animals','three'),listing(['a','b','c']))));
await test('new image minimum enforced',()=>assertFails(setDoc(doc(seller,'animals','empty'),listing([]))));
await test('new image maximum enforced',()=>assertFails(setDoc(doc(seller,'animals','four'),listing(['a','b','c','d']))));
await test('append fourth image denied',()=>assertFails(updateDoc(doc(seller,'animals','three'),{images:['a','b','c','d']})));
await test('old five images publicly readable',()=>assertSucceeds(getDoc(doc(anon,'animals','old'))));
await test('old images survive unrelated edit',()=>assertSucceeds(updateDoc(doc(seller,'animals','old'),{breed:'قديمة'})));
await test('old image removal preserves remaining four',()=>assertSucceeds(updateDoc(doc(seller,'animals','old'),{images:['a','b','c','d']})));
await test('old image addition denied',()=>assertFails(updateDoc(doc(seller,'animals','old'),{images:['a','b','c','d','new']})));
await test('pets direct optional subcategory allowed',()=>assertSucceeds(setDoc(doc(seller,'animals','pet'),listing(['a'],{type:'حيوانات أليفة',subcategory:'قطط'}))));
await test('pets auction denied',()=>assertFails(setDoc(doc(seller,'animals','pet-auction'),listing(['a'],{type:'حيوانات أليفة',saleType:'auction'}))));
await test('other category allowed',()=>assertSucceeds(setDoc(doc(seller,'animals','other'),listing(['a'],{type:'أخرى'}))));
const featured={animalId:'one',active:true,priority:0,startAt:Timestamp.fromMillis(1000),endAt:Timestamp.fromMillis(2000)};
const settings=()=>({mode:'featured',imageUrl:'https://res.cloudinary.com/demo/image/upload/a.jpg',featured:[featured],updatedBy:'owner',updatedAt:serverTimestamp()});
await test('owner Hero permission',()=>assertSucceeds(setDoc(doc(owner,'homePage','config'),settings())));
await test('public Hero read',()=>assertSucceeds(getDoc(doc(anon,'homePage','config'))));
await test('normal user denied Hero writes',()=>assertFails(setDoc(doc(seller,'homePage','config'),{...settings(),updatedBy:'seller'})));
await test('anonymous denied Hero writes',()=>assertFails(setDoc(doc(anon,'homePage','config'),settings())));
await test('Hero rejects base64 and unsafe domains',async()=>{for(const imageUrl of ['data:image/jpeg;base64,AAA','https://evil.test/a.jpg'])await assertFails(setDoc(doc(owner,'homePage','config'),{...settings(),imageUrl}));});
await test('Hero rejects four ads duplicate ads bad dates and forged actor',async()=>{
  for(const change of [{featured:Array(4).fill(featured)},{featured:[featured,featured]},{featured:[{...featured,endAt:Timestamp.fromMillis(0)}]},{updatedBy:'seller'}])await assertFails(setDoc(doc(owner,'homePage','config'),{...settings(),...change}));
});
await env.withSecurityRulesDisabled(async c=>{
  await setDoc(doc(c.firestore(),'adminSecurity','config'),{enabled:true,superAdminUids:['owner']});
  await setDoc(doc(c.firestore(),'adminAccess','assistant'),{role:'admin_assistant',adminStatus:'active',permissions:['dashboard_view','services_manage','listings_manage']});
});
await test('assistant cannot self-activate Hero ads',()=>assertFails(setDoc(doc(env.authenticatedContext('assistant').firestore(),'homePage','config'),{...settings(),updatedBy:'assistant'})));
await test('unregistered admin claim denied Hero changes',()=>assertFails(setDoc(doc(env.authenticatedContext('seller',{admin:true}).firestore(),'homePage','config'),{...settings(),updatedBy:'seller'})));
console.log(`SUMMARY | ${count}/${count} passed`);
}finally{await env.cleanup();}
