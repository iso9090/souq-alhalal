import fs from 'node:fs';import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,collection,query,where,getDocs,getDoc,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp,Timestamp} from 'firebase/firestore';
if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Local emulator required');
const env=await initializeTestEnvironment({projectId:'demo-souq-participations',firestore:{rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
const buyer=env.authenticatedContext('buyer').firestore(),other=env.authenticatedContext('other').firestore(),seller=env.authenticatedContext('seller').firestore(),admin=env.authenticatedContext('admin',{admin:true}).firestore(),guest=env.unauthenticatedContext().firestore();let count=0;
async function test(name,fn){await fn();console.log('PASS | '+name);count++}
async function seed(id,patch={}){await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,'animals',id),{sellerId:'seller',status:'active',saleType:'auction',country:'AE'});await setDoc(doc(db,'auctions',id),{animalId:id,sellerId:'seller',status:'active',country:'AE',currentPrice:100,startPrice:100,minIncrement:10,endTime:Timestamp.fromMillis(Date.now()+86400000),...patch});});}
async function bid(id,{db=buyer,uid='buyer',amount=110,receiptPatch={},receiptOnly=false,key,update=false}={}){const batch=writeBatch(db);if(!receiptOnly)batch.update(doc(db,'auctions',id),{currentPrice:amount,lastBidderId:uid,lastBidAt:serverTimestamp(),lastBidderPhone:''});const ref=doc(db,'auctionParticipations',key||id+'_'+uid);const data=update?{lastBidAmount:amount,lastBidAt:serverTimestamp(),...receiptPatch}:{auctionId:id,animalId:id,sellerId:'seller',bidderId:uid,lastBidAmount:amount,lastBidAt:serverTimestamp(),createdAt:serverTimestamp(),...receiptPatch};update?batch.update(ref,data):batch.set(ref,data);return batch.commit();}
try{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{for(const uid of ['buyer','other','seller','admin'])await setDoc(doc(c.firestore(),'users',uid),{status:'active'})});
await seed('main');await test('missing own receipt can be read before first transaction',()=>assertSucceeds(getDoc(doc(buyer,'auctionParticipations','main_buyer'))));
await test('valid bid atomically creates private participation',()=>assertSucceeds(bid('main')));
const created=(await getDoc(doc(buyer,'auctionParticipations','main_buyer'))).data().createdAt;
await test('repeat bid updates aggregate and preserves createdAt',async()=>{await assertSucceeds(bid('main',{amount:120,update:true}));const p=(await getDoc(doc(buyer,'auctionParticipations','main_buyer'))).data();assert.equal(p.lastBidAmount,120);assert.equal(p.createdAt.toMillis(),created.toMillis());});
await test('outbid retains previous bidder record',async()=>{await assertSucceeds(bid('main',{db:other,uid:'other',amount:130}));assert.equal((await getDoc(doc(buyer,'auctionParticipations','main_buyer'))).data().lastBidAmount,120);});
await test('own history query allowed',async()=>{const s=await assertSucceeds(getDocs(query(collection(buyer,'auctionParticipations'),where('bidderId','==','buyer'))));assert.equal(s.size,1)});
await test('another bidder cannot get receipt',()=>assertFails(getDoc(doc(other,'auctionParticipations','main_buyer'))));
await test('another bidder cannot query foreign history',()=>assertFails(getDocs(query(collection(other,'auctionParticipations'),where('bidderId','==','buyer')))));
await test('unfiltered history list denied',()=>assertFails(getDocs(collection(buyer,'auctionParticipations'))));
await test('guest history read denied',()=>assertFails(getDoc(doc(guest,'auctionParticipations','main_buyer'))));
await test('admin has no implicit access to another users private history',()=>assertFails(getDoc(doc(admin,'auctionParticipations','main_buyer'))));
await test('history cannot be deleted',()=>assertFails(deleteDoc(doc(buyer,'auctionParticipations','main_buyer'))));
await seed('fake');await test('history without price update denied',()=>assertFails(bid('fake',{receiptOnly:true})));
await seed('amount');await test('fabricated amount denied and auction write rolls back',async()=>{await assertFails(bid('amount',{receiptPatch:{lastBidAmount:999}}));assert.equal((await getDoc(doc(buyer,'auctions','amount'))).data().currentPrice,100)});
await seed('low');await test('low bid plus receipt denied',()=>assertFails(bid('low',{amount:105})));
await seed('foreign');await test('cannot write receipt for another bidder',()=>assertFails(bid('foreign',{receiptPatch:{bidderId:'other'}})));
await seed('key');await test('arbitrary receipt id denied',()=>assertFails(bid('key',{key:'unrelated'})));
await seed('animal');await test('wrong animal link denied',()=>assertFails(bid('animal',{receiptPatch:{animalId:'other-animal'}})));
await seed('privacy');await test('extra personal fields denied',()=>assertFails(bid('privacy',{receiptPatch:{phoneNumber:'test'}})));
await seed('timestamp');await test('backdated bid timestamp denied',()=>assertFails(bid('timestamp',{receiptPatch:{lastBidAt:Timestamp.fromMillis(1)}})));
await test('cannot rewrite receipt creation time',()=>assertFails(bid('main',{amount:140,update:true,receiptPatch:{createdAt:serverTimestamp()}})));
await seed('owner');await test('seller cannot create own participation',()=>assertFails(bid('owner',{db:seller,uid:'seller'})));
await seed('expired',{endTime:Timestamp.fromMillis(1)});await test('expired auction cannot receive fabricated history',()=>assertFails(bid('expired')));
await seed('closed',{status:'sold'});await test('closed auction cannot receive history',()=>assertFails(bid('closed')));
await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'auctions','main'),{status:'sold',endTime:Timestamp.fromMillis(1)}));await test('ended and closed auction history remains readable',()=>assertSucceeds(getDoc(doc(buyer,'auctionParticipations','main_buyer'))));
await env.withSecurityRulesDisabled(c=>deleteDoc(doc(c.firestore(),'auctions','main')));await test('deleted auction does not delete or expose private participation',async()=>{await assertSucceeds(getDoc(doc(buyer,'auctionParticipations','main_buyer')));await assertFails(getDoc(doc(other,'auctionParticipations','main_buyer')))});
console.log(`SUMMARY | ${count}/${count} passed`);
}finally{await env.cleanup()}
