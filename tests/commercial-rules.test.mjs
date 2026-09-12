import fs from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,getDocs,collection,query,where,setDoc,updateDoc,deleteDoc,serverTimestamp,Timestamp} from 'firebase/firestore';
if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('local emulator required');
const env=await initializeTestEnvironment({projectId:'demo-souq-commercial',firestore:{rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});let n=0;const test=async(name,fn)=>{await fn();n++;console.log('PASS | '+name);};
const owner=env.authenticatedContext('owner',{admin:true}).firestore(),helper=env.authenticatedContext('helper').firestore(),normal=env.authenticatedContext('normal').firestore(),guest=env.unauthenticatedContext().firestore();
const seed=async(p,d)=>env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),p),d));
const stamp=Timestamp.now(),ad={title:'إعلان',advertiserName:'المعلن',description:'',cta:'المزيد',imageUrl:'https://res.cloudinary.com/demo/image/upload/sample.jpg',targetUrl:'https://example.com/',placement:'hero',priority:1,status:'active',startAt:Timestamp.fromMillis(Date.now()-60000),endAt:Timestamp.fromMillis(Date.now()+86400000),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),createdBy:'owner',updatedBy:'owner',approvedBy:'owner',approvedAt:serverTimestamp()};
const session={startedAt:stamp,updatedAt:serverTimestamp(),pageViews:1,pages:{home:1,market:0,services:0,admin:0,other:0},views:[],clicks:[]},sid='a'.repeat(32);
try{await env.clearFirestore();await seed('adminSecurity/config',{enabled:true,superAdminUids:['owner']});await seed('users/owner',{status:'active'});await seed('users/helper',{status:'active'});await seed('adminAccess/helper',{role:'admin_assistant',adminStatus:'active',permissions:['reports_view','reports_manage','listings_manage','users_manage','assistants_create']});
await test('owner creates ad',()=>assertSucceeds(setDoc(doc(owner,'commercialAds','ad1'),ad)));
for(const [name,db] of [['helper',helper],['normal',normal],['guest',guest]]){await test(name+' create denied',()=>assertFails(setDoc(doc(db,'commercialAds','bad'),ad)));await test(name+' edit denied',()=>assertFails(updateDoc(doc(db,'commercialAds','ad1'),{title:'x'})));}
await test('active query public',()=>assertSucceeds(getDocs(query(collection(guest,'commercialAds'),where('status','==','active')))));
await test('unrestricted list denied',()=>assertFails(getDocs(collection(guest,'commercialAds'))));
await test('owner pause',()=>assertSucceeds(updateDoc(doc(owner,'commercialAds','ad1'),{status:'paused',updatedAt:serverTimestamp(),approvedAt:null,approvedBy:''})));
await test('paused private',()=>assertFails(getDoc(doc(guest,'commercialAds','ad1'))));
await test('owner reactivate',()=>assertSucceeds(updateDoc(doc(owner,'commercialAds','ad1'),{status:'active',updatedAt:serverTimestamp(),approvedAt:serverTimestamp(),approvedBy:'owner'})));
for(const status of ['draft','pending','approved','rejected','expired']){await seed('commercialAds/'+status,{...ad,status});await test(status+' private',()=>assertFails(getDoc(doc(guest,'commercialAds',status))));}
for(const patch of [{priority:10000},{placement:'users'},{title:''},{targetUrl:'javascript:alert(1)'},{imageUrl:'https://evil.example/x'},{advertiserEmail:'private@example.test'},{clickCount:99999},{endAt:Timestamp.fromMillis(1)}])await test('invalid ad '+Object.keys(patch)[0],()=>assertFails(setDoc(doc(owner,'commercialAds','bad'),{...ad,...patch})));
await test('contacts owner write',()=>assertSucceeds(setDoc(doc(owner,'commercialAdContacts','ad1'),{advertiserEmail:'private@example.test',advertiserPhone:''})));
await test('contacts private',()=>assertFails(getDoc(doc(guest,'commercialAdContacts','ad1'))));
await test('helper contacts denied',()=>assertFails(getDoc(doc(helper,'commercialAdContacts','ad1'))));
await test('collector default off',()=>assertFails(setDoc(doc(guest,'analyticsSessions',sid),session)));
await test('owner enables',()=>assertSucceeds(setDoc(doc(owner,'platformTelemetry','config'),{enabled:true,updatedAt:serverTimestamp(),updatedBy:'owner'})));
await test('helper cannot enable',()=>assertFails(updateDoc(doc(helper,'platformTelemetry','config'),{enabled:true})));
await test('bounded session create',()=>assertSucceeds(setDoc(doc(guest,'analyticsSessions',sid),session)));
await test('session private',()=>assertFails(getDoc(doc(guest,'analyticsSessions',sid))));
await test('owner analytics read',()=>assertSucceeds(getDocs(collection(owner,'analyticsSessions'))));
await test('helper analytics denied',()=>assertFails(getDocs(collection(helper,'analyticsSessions'))));
await test('normal analytics denied',()=>assertFails(getDocs(collection(normal,'analyticsSessions'))));
await test('bounded page increment',()=>assertSucceeds(updateDoc(doc(guest,'analyticsSessions',sid),{pageViews:2,pages:{...session.pages,home:2},updatedAt:serverTimestamp()})));
for(const patch of [{pageViews:99999},{pageViews:-1},{pageViews:0,pages:{...session.pages,home:0}},{ip:'1.2.3.4'},{uid:'normal'},{visitorId:'stable'},{pages:{...session.pages,password:'x'}},{views:[123]},{views:[{ip:'secret'}]},{views:['ad1,ad2']},{views:['ad1','ad1']},{views:['ad1'],clicks:['ad2']}])await test('invalid analytics '+Object.keys(patch)[0],()=>assertFails(updateDoc(doc(guest,'analyticsSessions',sid),{...patch,updatedAt:serverTimestamp()})));
await test('deduped ad events',()=>assertSucceeds(updateDoc(doc(guest,'analyticsSessions',sid),{views:['ad1'],clicks:['ad1'],updatedAt:serverTimestamp()})));
await test('twenty views and clicks accepted',()=>assertSucceeds(updateDoc(doc(guest,'analyticsSessions',sid),{views:Array.from({length:20},(_,i)=>'ad'+(i+1)),clicks:Array.from({length:20},(_,i)=>'ad'+(i+1)),updatedAt:serverTimestamp()})));
await test('cannot erase events',()=>assertFails(updateDoc(doc(guest,'analyticsSessions',sid),{views:[],clicks:[],updatedAt:serverTimestamp()})));
await test('delete denied',()=>assertFails(deleteDoc(doc(guest,'analyticsSessions',sid))));
await test('owner disables',()=>assertSucceeds(setDoc(doc(owner,'platformTelemetry','config'),{enabled:false,updatedAt:serverTimestamp(),updatedBy:'owner'})));
await test('disabled stops writes',()=>assertFails(updateDoc(doc(guest,'analyticsSessions',sid),{updatedAt:serverTimestamp()})));
console.log(`SUMMARY | ${n}/${n} passed`);}finally{await env.cleanup();}
