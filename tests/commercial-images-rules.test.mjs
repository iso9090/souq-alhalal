import fs from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,getDocs,collection,setDoc,deleteDoc,writeBatch,serverTimestamp,Timestamp} from 'firebase/firestore';
if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('emulator required');
const env=await initializeTestEnvironment({projectId:'demo-commercial-images-v2',firestore:{rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});let n=0;const test=async(name,fn)=>{await fn();console.log('PASS | '+name);n++;};
const owner=env.authenticatedContext('owner',{admin:true}).firestore(),helper=env.authenticatedContext('helper').firestore(),normal=env.authenticatedContext('normal').firestore(),guest=env.unauthenticatedContext().firestore();
const seed=(p,d)=>env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),p),d));
const ad={title:'Local ad',advertiserName:'Local',description:'',cta:'More',imageUrl:'',imageStorage:'firestore',imageVersion:'v1',targetUrl:'https://example.com/',placement:'hero',priority:1,status:'active',startAt:Timestamp.fromMillis(Date.now()-60000),endAt:Timestamp.fromMillis(Date.now()+86400000),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),createdBy:'owner',updatedBy:'owner',approvedBy:'owner',approvedAt:serverTimestamp()};
const img={adId:'ad',imageData:'data:image/jpeg;base64,/9j/2Q==',mimeType:'image/jpeg',bytes:4,width:1,height:1,version:'v1',updatedAt:serverTimestamp()};
const save=(db,id='ad',patch={},ap={})=>{const b=writeBatch(db);b.set(doc(db,'commercialAds',id),{...ad,...ap});b.set(doc(db,'commercialAdImages',id),{...img,adId:id,...patch});return b.commit();};
try{await env.clearFirestore();await seed('adminSecurity/config',{enabled:true,superAdminUids:['owner']});await seed('users/owner',{status:'active'});await seed('users/helper',{status:'active'});await seed('adminAccess/helper',{role:'admin_assistant',adminStatus:'active',permissions:['listings_manage','manage_ads']});
await test('owner atomic ad and image',()=>assertSucceeds(save(owner)));
for(const [name,db]of [['normal',normal],['assistant',helper],['guest',guest]]){await test(name+' image create denied',()=>assertFails(save(db,name)));await test(name+' image update denied',()=>assertFails(setDoc(doc(db,'commercialAdImages','ad'),img)));await test(name+' image delete denied',()=>assertFails(deleteDoc(doc(db,'commercialAdImages','ad'))));}
await test('active public get',()=>assertSucceeds(getDoc(doc(guest,'commercialAdImages','ad'))));
for(const [name,db]of [['public',guest],['owner',owner]])await test(name+' image list denied',()=>assertFails(getDocs(collection(db,'commercialAdImages'))));
await test('active image cannot be deleted',()=>assertFails(deleteDoc(doc(owner,'commercialAdImages','ad'))));
await test('metadata without image denied',()=>assertFails(setDoc(doc(owner,'commercialAds','missing'),ad)));
await test('orphan image denied',()=>assertFails(setDoc(doc(owner,'commercialAdImages','orphan'),{...img,adId:'orphan'})));
for(const patch of [{bytes:61441},{mimeType:'image/svg+xml'},{imageData:'javascript:alert(1)'},{width:1201},{height:0},{adId:'different'},{version:'different'},{extra:'field'},{imageData:'data:image/jpeg;base64,'+'/9j/'+'A'.repeat(81920)},{bytes:100}])await test('invalid image '+Object.keys(patch)[0],()=>assertFails(save(owner,'bad',patch)));
await test('atomic failure left no metadata',async()=>{const snap=await getDoc(doc(owner,'commercialAds','bad'));if(snap.exists())throw Error('partial write');});
await test('maximum bounded image',()=>assertSucceeds(save(owner,'max',{bytes:61440,imageData:'data:image/jpeg;base64,/9j/'+'A'.repeat(81916)})));
for(const [id,ap] of [['paused',{status:'paused',approvedBy:'',approvedAt:null}],['pending',{status:'pending',approvedBy:'',approvedAt:null}],['expired',{endAt:Timestamp.fromMillis(Date.now()-1000)}],['future',{startAt:Timestamp.fromMillis(Date.now()+60000)}]]){await assertSucceeds(save(owner,id,{},ap));await test(id+' public image denied',()=>assertFails(getDoc(doc(guest,'commercialAdImages',id))));await test(id+' owner can read',()=>assertSucceeds(getDoc(doc(owner,'commercialAdImages',id))));}
await test('replacement atomic version',()=>{const b=writeBatch(owner);b.update(doc(owner,'commercialAds','ad'),{imageVersion:'v2',updatedAt:serverTimestamp(),approvedAt:serverTimestamp()});b.set(doc(owner,'commercialAdImages','ad'),{...img,version:'v2'});return assertSucceeds(b.commit());});
await test('image version mismatch denied',()=>assertFails(setDoc(doc(owner,'commercialAdImages','ad'),img)));
await test('cleanup detached orphan allowed',async()=>{await seed('commercialAdImages/orphan',img);await assertSucceeds(deleteDoc(doc(owner,'commercialAdImages','orphan')));});
console.log(`SUMMARY | ${n}/${n} PASS`);
}finally{await env.cleanup();}
