import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import {
  collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, writeBatch, serverTimestamp, Timestamp
} from 'firebase/firestore';

if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({
  projectId: 'demo-souq-launch',
  firestore: { rules }
});
await env.clearFirestore();
const results = [];
const pass = name => { results.push(['PASS', name]); console.log('PASS | ' + name); };
const check = async (name, fn) => { try { await fn(); pass(name); } catch (e) { console.error('FAIL | '+name+' | '+e.message); throw e; } };
const seller = env.authenticatedContext('seller', { phone_number: '+971501234567' }).firestore();
const buyer = env.authenticatedContext('buyer', { phone_number: '+201012345678' }).firestore();
const third = env.authenticatedContext('third').firestore();
const admin = env.authenticatedContext('admin', { admin: true }).firestore();
const anon = env.unauthenticatedContext().firestore();

const animalData = (country, saleType='direct') => ({
  sellerId:'seller', saleType, country,
  region: country === 'EG' ? 'القاهرة' : 'الشارقة',
  city: country === 'EG' ? 'القاهرة' : 'الذيد',
  status:'active', createdAt:serverTimestamp(), updatedAt:serverTimestamp()
});
const auctionData = (animalId, country) => ({
  animalId, country, sellerId:'seller', status:'active', startPrice:100,
  currentPrice:100, minIncrement:10,
  endTime:Timestamp.fromMillis(Date.now()+3600000),
  createdAt:serverTimestamp(), updatedAt:serverTimestamp()
});

await check('legacy AE animal without country remains publicly readable', async()=>{
  await env.withSecurityRulesDisabled(async c => setDoc(doc(c.firestore(),'animals/legacy-ae'), {sellerId:'seller',saleType:'direct',status:'active',location:'الذيد - الشارقة'}));
  await assertSucceeds(getDoc(doc(anon,'animals/legacy-ae')));
});
await check('new AE direct animal succeeds', ()=>assertSucceeds(setDoc(doc(seller,'animals/direct-ae'), animalData('AE'))));
await check('new EG direct animal succeeds', ()=>assertSucceeds(setDoc(doc(seller,'animals/direct-eg'), animalData('EG'))));
await check('new direct animal containing sellerPhone is rejected', ()=>assertFails(setDoc(doc(seller,'animals/direct-phone'), {...animalData('AE'),sellerPhone:'+971501234567'})));

for (const country of ['AE','EG']) await check(`new ${country} auction matches its animal`, async()=>{
  const b=writeBatch(seller); const aid='auction-animal-'+country; const qid='auction-'+country;
  b.set(doc(seller,'animals/'+aid),animalData(country,'auction'));
  b.set(doc(seller,'auctions/'+qid),auctionData(aid,country));
  await assertSucceeds(b.commit());
});
await check('auction country mismatch with animal is rejected', async()=>{
  const b=writeBatch(seller); b.set(doc(seller,'animals/mismatch-animal'),animalData('EG','auction'));
  b.set(doc(seller,'auctions/mismatch-auction'),auctionData('mismatch-animal','AE'));
  await assertFails(b.commit());
});
await check('legacy auction without country remains readable and biddable as AE', async()=>{
  await env.withSecurityRulesDisabled(async c => setDoc(doc(c.firestore(),'auctions/legacy-auction'),{
    animalId:'legacy-auction-animal',sellerId:'seller',status:'active',startPrice:100,currentPrice:100,minIncrement:10,endTime:Timestamp.fromMillis(Date.now()+3600000)
  }));
  await assertSucceeds(getDoc(doc(anon,'auctions/legacy-auction')));
  await assertSucceeds(updateDoc(doc(buyer,'auctions/legacy-auction'),{currentPrice:110,lastBidAt:serverTimestamp(),lastBidderId:'buyer',lastBidderPhone:'+201012345678'}));
});
await check('country of an existing auction cannot change', ()=>assertFails(updateDoc(doc(seller,'auctions/auction-EG'),{country:'AE'})));

const serviceData = (serviceType,targetType,targetId,country,amount,currency) => ({
  userId:'seller',serviceType,targetType,targetId,country,amount,currency,
  paymentStatus:'unpaid',status:'pending',createdAt:serverTimestamp(),updatedAt:serverTimestamp()
});
await check('seller requests featured for own direct listing',()=>assertSucceeds(setDoc(
  doc(seller,'serviceRequests/seller_featured_animal_direct-ae'),
  serviceData('featured','animal','direct-ae','AE',15,'AED')
)));
await check('duplicate pending request is rejected by deterministic id',()=>assertFails(setDoc(
  doc(seller,'serviceRequests/seller_featured_animal_direct-ae'),
  serviceData('featured','animal','direct-ae','AE',15,'AED')
)));
await check('seller requests bump for own auction',()=>assertSucceeds(setDoc(
  doc(seller,'serviceRequests/seller_bump_auction_auction-EG'),
  serviceData('bump','auction','auction-EG','EG',100,'EGP')
)));
await check('buyer cannot request service for seller listing',()=>assertFails(setDoc(
  doc(buyer,'serviceRequests/buyer_featured_animal_direct-ae'),
  {...serviceData('featured','animal','direct-ae','AE',15,'AED'),userId:'buyer'}
)));
await check('auction service cannot be disguised as animal target',()=>assertFails(setDoc(
  doc(seller,'serviceRequests/seller_featured_animal_auction-animal-AE'),
  serviceData('featured','animal','auction-animal-AE','AE',15,'AED')
)));
await check('wrong service price or currency is rejected',()=>assertFails(setDoc(
  doc(seller,'serviceRequests/seller_verification_animal_direct-eg'),
  serviceData('verification','animal','direct-eg','EG',25,'AED')
)));
await check('seller requests verification with bounded existing details',()=>assertSucceeds(setDoc(
  doc(seller,'serviceRequests/seller_verification_animal_direct-eg'),
  {...serviceData('verification','animal','direct-eg','EG',350,'EGP'),notes:'review',details:{animalIdentifier:'A1',vaccinationStatus:'vaccinated',vaccinationDate:'2026-01-01',vetInspectionStatus:'inspected',vetInspectionDate:'2026-01-02'}}
)));
await check('seller cannot create an approved service request',()=>assertFails(setDoc(
  doc(seller,'serviceRequests/seller_verification_animal_direct-ae'),
  {...serviceData('verification','animal','direct-ae','AE',25,'AED'),status:'approved'}
)));
await check('third party cannot read another user service request',()=>assertFails(getDoc(
  doc(third,'serviceRequests/seller_featured_animal_direct-ae')
)));
await check('seller can list only own service requests',()=>assertSucceeds(getDocs(query(
  collection(seller,'serviceRequests'),where('userId','==','seller')
))));
await check('owner can cancel pending request but cannot approve it',async()=>{
  const ref=doc(seller,'serviceRequests/seller_featured_animal_direct-ae');
  await assertFails(updateDoc(ref,{status:'approved',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref,{status:'rejected',rejectedAt:serverTimestamp(),rejectedBy:'seller',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ref,{status:'cancelled',cancelledAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref,{status:'approved',updatedAt:serverTimestamp()}));
});
await check('seller cannot self-set featured, bumped, or verified fields',async()=>{
  await assertFails(updateDoc(doc(seller,'animals/direct-ae'),{featuredUntil:Timestamp.fromMillis(Date.now()+86400000)}));
  await assertFails(updateDoc(doc(seller,'animals/direct-ae'),{bumpedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(seller,'animals/direct-ae'),{verificationStatus:'verified'}));
  await assertFails(updateDoc(doc(seller,'auctions/auction-EG'),{featuredUntil:Timestamp.fromMillis(Date.now()+86400000)}));
});

async function seedDirect(id, animalId, country) {
  await env.withSecurityRulesDisabled(async c => {
    const db=c.firestore();
    await setDoc(doc(db,'users/seller'),{displayName:'Seller',phoneNumber:'+971501234567'});
    await setDoc(doc(db,'users/buyer'),{displayName:'Buyer',phoneNumber:'+201012345678'});
    await setDoc(doc(db,'animals/'+animalId),{...animalData(country),createdAt:Timestamp.now(),updatedAt:Timestamp.now(),price:500});
    await setDoc(doc(db,'conversations/'+id),{contextType:'direct',animalId,sellerId:'seller',buyerId:'buyer',participants:['seller','buyer'],askingPrice:500,sellerUnread:0,buyerUnread:0});
  });
  await assertSucceeds(setDoc(doc(seller,`conversations/${id}/privateContacts/seller`),{uid:'seller',displayName:'Seller',phoneNumber:'+971501234567',createdAt:serverTimestamp()}));
  await assertSucceeds(setDoc(doc(buyer,`conversations/${id}/privateContacts/buyer`),{uid:'buyer',displayName:'Buyer',phoneNumber:'+201012345678',createdAt:serverTimestamp()}));
}

await seedDirect('direct-ae-chat','direct-ae','AE');
await check('phone protected before acceptance (buyer cannot read seller)',()=>assertFails(getDoc(doc(buyer,'conversations/direct-ae-chat/privateContacts/seller'))));
await check('AE buyer creates pending offer',()=>assertSucceeds(setDoc(doc(buyer,'conversations/direct-ae-chat/messages/offer-ae'),{type:'offer',offerAmount:450,status:'pending',senderId:'buyer',createdAt:serverTimestamp()})));
await check('AE offer acceptance unlocks contacts atomically',async()=>{
  const b=writeBatch(seller);
  b.update(doc(seller,'conversations/direct-ae-chat/messages/offer-ae'),{status:'accepted',decidedBy:'seller',decidedAt:serverTimestamp()});
  b.update(doc(seller,'conversations/direct-ae-chat'),{lastMessage:'accepted',lastMessageType:'text',lastMessageSenderId:'seller',lastMessageAt:serverTimestamp(),updatedAt:serverTimestamp(),buyerUnread:1,contactStatus:'unlocked',acceptedOfferId:'offer-ae',contactUnlockedAt:serverTimestamp()});
  await assertSucceeds(b.commit());
  await assertSucceeds(getDoc(doc(buyer,'conversations/direct-ae-chat/privateContacts/seller')));
  await assertSucceeds(getDoc(doc(seller,'conversations/direct-ae-chat/privateContacts/buyer')));
});
await check('third party cannot read unlocked contact',()=>assertFails(getDoc(doc(third,'conversations/direct-ae-chat/privateContacts/seller'))));

await seedDirect('direct-eg-chat','direct-eg','EG');
await check('EG buyer creates pending offer',()=>assertSucceeds(setDoc(doc(buyer,'conversations/direct-eg-chat/messages/offer-eg'),{type:'offer',offerAmount:450,status:'pending',senderId:'buyer',createdAt:serverTimestamp()})));
await check('rejected offer does not unlock contacts',async()=>{
  await assertSucceeds(updateDoc(doc(seller,'conversations/direct-eg-chat/messages/offer-eg'),{status:'rejected',decidedBy:'seller',decidedAt:serverTimestamp()}));
  const snap=await getDoc(doc(seller,'conversations/direct-eg-chat'));
  if (snap.data().contactStatus === 'unlocked') throw new Error('contact unexpectedly unlocked');
  await assertFails(getDoc(doc(buyer,'conversations/direct-eg-chat/privateContacts/seller')));
});

await check('ordinary user cannot list all service requests',()=>assertFails(getDocs(collection(seller,'serviceRequests'))));
await check('admin can list all service requests',()=>assertSucceeds(getDocs(collection(admin,'serviceRequests'))));

await check('featured approval requires atomic target update',async()=>{
  const requestRef=doc(seller,'serviceRequests/seller_featured_animal_direct-eg');
  await assertSucceeds(setDoc(requestRef,serviceData('featured','animal','direct-eg','EG',200,'EGP')));
  await assertFails(updateDoc(doc(admin,'serviceRequests/seller_featured_animal_direct-eg'),{status:'approved',approvedAt:serverTimestamp(),approvedBy:'admin',updatedAt:serverTimestamp()}));
  const b=writeBatch(admin);
  b.update(doc(admin,'animals/direct-eg'),{featuredAt:serverTimestamp(),featuredUntil:Timestamp.fromMillis(Date.now()+7*86400000)});
  b.update(doc(admin,'serviceRequests/seller_featured_animal_direct-eg'),{status:'approved',approvedAt:serverTimestamp(),approvedBy:'admin',updatedAt:serverTimestamp(),paymentOverride:true,paymentOverrideBy:'admin',paymentOverrideAt:serverTimestamp(),paymentOverrideReason:'تجريبي'});
  await assertSucceeds(b.commit());
});
await check('bump approval updates request and auction atomically',async()=>{
  const b=writeBatch(admin);
  b.update(doc(admin,'auctions/auction-EG'),{bumpedAt:serverTimestamp()});
  b.update(doc(admin,'serviceRequests/seller_bump_auction_auction-EG'),{status:'approved',approvedAt:serverTimestamp(),approvedBy:'admin',updatedAt:serverTimestamp(),paymentOverride:true,paymentOverrideBy:'admin',paymentOverrideAt:serverTimestamp(),paymentOverrideReason:'مجاني'});
  await assertSucceeds(b.commit());
});
await check('verification approval updates request and animal atomically',async()=>{
  const b=writeBatch(admin);
  b.update(doc(admin,'animals/direct-eg'),{verificationStatus:'verified',verifiedAt:serverTimestamp(),verifiedBy:'admin'});
  b.update(doc(admin,'serviceRequests/seller_verification_animal_direct-eg'),{status:'approved',approvedAt:serverTimestamp(),approvedBy:'admin',updatedAt:serverTimestamp(),paymentOverride:true,paymentOverrideBy:'admin',paymentOverrideAt:serverTimestamp(),paymentOverrideReason:'قرار إداري'});
  await assertSucceeds(b.commit());
});
await check('admin can reject pending with optional note',async()=>{
  const ref=doc(seller,'serviceRequests/seller_bump_animal_direct-ae');
  await assertSucceeds(setDoc(ref,serviceData('bump','animal','direct-ae','AE',7,'AED')));
  await assertSucceeds(updateDoc(doc(admin,'serviceRequests/seller_bump_animal_direct-ae'),{status:'rejected',rejectedAt:serverTimestamp(),rejectedBy:'admin',adminNote:'not now',updatedAt:serverTimestamp()}));
});
await check('admin cannot approve cancelled, rejected, or approved requests',async()=>{
  await assertFails(updateDoc(doc(admin,'serviceRequests/seller_featured_animal_direct-ae'),{status:'approved',approvedAt:serverTimestamp(),approvedBy:'admin',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(admin,'serviceRequests/seller_bump_animal_direct-ae'),{status:'approved',approvedAt:serverTimestamp(),approvedBy:'admin',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(admin,'serviceRequests/seller_featured_animal_direct-eg'),{status:'approved',approvedAt:serverTimestamp(),approvedBy:'admin',updatedAt:serverTimestamp()}));
});
await check('admin cannot update trusted target without matching request decision',()=>assertFails(updateDoc(doc(admin,'animals/direct-ae'),{bumpedAt:serverTimestamp()})));
await check('wrong owner and mismatched country fail during admin approval',async()=>{
  await env.withSecurityRulesDisabled(async c=>{
    const db=c.firestore();
    await setDoc(doc(db,'serviceRequests/buyer_featured_animal_direct-ae'),{...serviceData('featured','animal','direct-ae','AE',15,'AED'),userId:'buyer',createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
    await setDoc(doc(db,'serviceRequests/seller_featured_animal_bad-country'),{...serviceData('featured','animal','direct-ae','EG',200,'EGP'),targetId:'direct-ae',createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
  });
  for (const [id,userId] of [['buyer_featured_animal_direct-ae','buyer'],['seller_featured_animal_bad-country','seller']]) {
    const b=writeBatch(admin);
    b.update(doc(admin,'animals/direct-ae'),{featuredAt:serverTimestamp(),featuredUntil:Timestamp.fromMillis(Date.now()+7*86400000)});
    b.update(doc(admin,'serviceRequests/'+id),{status:'approved',approvedAt:serverTimestamp(),approvedBy:'admin',updatedAt:serverTimestamp(),paymentOverride:true,paymentOverrideBy:'admin',paymentOverrideAt:serverTimestamp(),paymentOverrideReason:'تجريبي'});
    await assertFails(b.commit());
  }
});

await check('normal user cannot forge payment override fields',async()=>{
  await assertFails(setDoc(doc(seller,'serviceRequests/seller_bump_animal_direct-eg'),{
    ...serviceData('bump','animal','direct-eg','EG',100,'EGP'),paymentOverride:true,paymentOverrideBy:'seller',paymentOverrideAt:serverTimestamp(),paymentOverrideReason:'مجاني'
  }));
});
await check('admin normal approve unpaid is denied',async()=>{
  await assertSucceeds(setDoc(doc(seller,'animals/payment-unpaid'),animalData('AE')));
  await assertSucceeds(setDoc(doc(seller,'serviceRequests/seller_featured_animal_payment-unpaid'),serviceData('featured','animal','payment-unpaid','AE',15,'AED')));
  const b=writeBatch(admin);
  b.update(doc(admin,'animals/payment-unpaid'),{featuredAt:serverTimestamp(),featuredUntil:Timestamp.fromMillis(Date.now()+7*86400000)});
  b.update(doc(admin,'serviceRequests/seller_featured_animal_payment-unpaid'),{status:'approved',approvedAt:serverTimestamp(),approvedBy:'admin',updatedAt:serverTimestamp()});
  await assertFails(b.commit());
});
await check('admin explicit override unpaid is allowed and audited',async()=>{
  const b=writeBatch(admin);
  b.update(doc(admin,'animals/payment-unpaid'),{featuredAt:serverTimestamp(),featuredUntil:Timestamp.fromMillis(Date.now()+7*86400000)});
  b.update(doc(admin,'serviceRequests/seller_featured_animal_payment-unpaid'),{status:'approved',approvedAt:serverTimestamp(),approvedBy:'admin',updatedAt:serverTimestamp(),paymentOverride:true,paymentOverrideBy:'admin',paymentOverrideAt:serverTimestamp(),paymentOverrideReason:'تعويض'});
  await assertSucceeds(b.commit());
  const snap=await getDoc(doc(admin,'serviceRequests/seller_featured_animal_payment-unpaid'));
  const data=snap.data();
  if(data.paymentStatus!=='unpaid'||data.paymentOverride!==true||data.paymentOverrideBy!=='admin'||!data.paymentOverrideAt) throw new Error('override audit fields missing');
});
await check('paid approval is allowed without override',async()=>{
  await assertSucceeds(setDoc(doc(seller,'animals/payment-paid'),animalData('AE')));
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'serviceRequests/seller_bump_animal_payment-paid'),{...serviceData('bump','animal','payment-paid','AE',7,'AED'),paymentStatus:'paid',createdAt:Timestamp.now(),updatedAt:Timestamp.now()}));
  const b=writeBatch(admin);
  b.update(doc(admin,'animals/payment-paid'),{bumpedAt:serverTimestamp()});
  b.update(doc(admin,'serviceRequests/seller_bump_animal_payment-paid'),{status:'approved',approvedAt:serverTimestamp(),approvedBy:'admin',updatedAt:serverTimestamp()});
  await assertSucceeds(b.commit());
});
await check('legacy request without payment status is unpaid and can be overridden',async()=>{
  await assertSucceeds(setDoc(doc(seller,'animals/payment-legacy'),animalData('AE')));
  await env.withSecurityRulesDisabled(async c=>{
    const legacy={...serviceData('bump','animal','payment-legacy','AE',7,'AED'),createdAt:Timestamp.now(),updatedAt:Timestamp.now()};
    delete legacy.paymentStatus;
    await setDoc(doc(c.firestore(),'serviceRequests/seller_bump_animal_payment-legacy'),legacy);
  });
  const b=writeBatch(admin);
  b.update(doc(admin,'animals/payment-legacy'),{bumpedAt:serverTimestamp()});
  b.update(doc(admin,'serviceRequests/seller_bump_animal_payment-legacy'),{status:'approved',approvedAt:serverTimestamp(),approvedBy:'admin',updatedAt:serverTimestamp(),paymentOverride:true,paymentOverrideBy:'admin',paymentOverrideAt:serverTimestamp(),paymentOverrideReason:'أخرى'});
  await assertSucceeds(b.commit());
});
await check('refunded request cannot normal or override approve',async()=>{
  await assertSucceeds(setDoc(doc(seller,'animals/payment-refunded'),animalData('AE')));
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'serviceRequests/seller_bump_animal_payment-refunded'),{...serviceData('bump','animal','payment-refunded','AE',7,'AED'),paymentStatus:'refunded',createdAt:Timestamp.now(),updatedAt:Timestamp.now()}));
  for(const override of [false,true]){
    const b=writeBatch(admin);
    b.update(doc(admin,'animals/payment-refunded'),{bumpedAt:serverTimestamp()});
    const update={status:'approved',approvedAt:serverTimestamp(),approvedBy:'admin',updatedAt:serverTimestamp()};
    if(override) Object.assign(update,{paymentOverride:true,paymentOverrideBy:'admin',paymentOverrideAt:serverTimestamp(),paymentOverrideReason:'أخرى'});
    b.update(doc(admin,'serviceRequests/seller_bump_animal_payment-refunded'),update);
    await assertFails(b.commit());
  }
});
await check('cancelled rejected and approved requests cannot override re-approve',async()=>{
  const payload={status:'approved',approvedAt:serverTimestamp(),approvedBy:'admin',updatedAt:serverTimestamp(),paymentOverride:true,paymentOverrideBy:'admin',paymentOverrideAt:serverTimestamp(),paymentOverrideReason:'أخرى'};
  for(const id of ['seller_featured_animal_direct-ae','seller_bump_animal_direct-ae','seller_featured_animal_direct-eg']){
    await assertFails(updateDoc(doc(admin,'serviceRequests/'+id),payload));
  }
});


await check('auction creator cannot forge initial winner', async()=>{
  await assertFails(setDoc(doc(seller,'auctions/forged-winner'), {...auctionData('auction-animal-AE','AE'),lastBidderId:'buyer'}));
});
await check('conversation creator cannot unlock contact before accepted offer', async()=>{
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'animals/chat-test'),{...animalData('AE'),price:100}));
  const data={contextType:'direct',animalId:'chat-test',sellerId:'seller',buyerId:'buyer',participants:['seller','buyer'],askingPrice:100,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),lastMessage:'',lastMessageType:'',lastMessageSenderId:'',sellerUnread:0,buyerUnread:0};
  await assertSucceeds(setDoc(doc(buyer,'conversations/direct-chat-test'),data));
  await assertFails(setDoc(doc(buyer,'conversations/forged-contact'),{...data,contactStatus:'unlocked'}));
  await assertFails(getDoc(doc(third,'conversations/direct-chat-test')));
  await assertSucceeds(setDoc(doc(buyer,'conversations/direct-chat-test/messages/text'),{type:'text',text:'hello',senderId:'buyer',createdAt:serverTimestamp()}));
  await assertFails(setDoc(doc(buyer,'conversations/auction-chat'),{...data,contextType:'auction'}));
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'conversations/legacy-auction-chat'),{...data,contextType:'auction'}));
  await assertFails(setDoc(doc(buyer,'conversations/legacy-auction-chat/messages/text'),{type:'text',text:'hello',senderId:'buyer',createdAt:serverTimestamp()}));
});


await check('bid enforces end time status increment seller and identity',async()=>{
  const ref=doc(buyer,'auctions/bid-guards');
  const seed=async(patch={})=>env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'auctions/bid-guards'),{...auctionData('auction-animal-AE','AE'),...patch}));
  const bid={currentPrice:110,lastBidderId:'buyer',lastBidAt:serverTimestamp()};
  await seed(); await assertFails(updateDoc(ref,{...bid,currentPrice:105}));
  await assertFails(updateDoc(ref,{...bid,lastBidderId:'third'}));
  await assertFails(updateDoc(doc(seller,'auctions/bid-guards'),{...bid,lastBidderId:'seller'}));
  await assertFails(updateDoc(ref,{...bid,sellerId:'buyer'}));
  await assertSucceeds(updateDoc(ref,bid));
  await assertFails(updateDoc(ref,{...bid,currentPrice:100}));
  await seed({endTime:Timestamp.fromMillis(Date.now()-10000)});await assertFails(updateDoc(ref,bid));
  await seed({status:'sold'});await assertFails(updateDoc(ref,bid));
});
await check('user cannot self-grant admin or forge payment audit fields',async()=>{
  await assertFails(updateDoc(doc(seller,'users/seller'),{admin:true}));
  for(const patch of [{paymentStatus:'paid'},{paidAt:serverTimestamp()},{paymentReference:'fake'},{paymentOverride:true},{paymentOverrideBy:'admin'},{paymentOverrideAt:serverTimestamp()},{userId:'buyer'}])
    await assertFails(updateDoc(doc(seller,'serviceRequests/seller_bump_auction_auction-EG'),patch));
});


for (const noPhone of ['seller', 'buyer']) {
  await check(`email-only ${noPhone}: marketplace and accepted offer retain contact privacy`, async()=>{
    const sid=`seller-${noPhone}`, bid=`buyer-${noPhone}`;
    const sdb=env.authenticatedContext(sid,{firebase:{sign_in_provider:noPhone==='seller'?'password':'phone'}}).firestore();
    const bdb=env.authenticatedContext(bid,{firebase:{sign_in_provider:noPhone==='buyer'?'password':'phone'}}).firestore();
    for (const [db,uid,role] of [[sdb,sid,'seller'],[bdb,bid,'buyer']]) {
      const profile={uid,displayName:role,accountType:'both',status:'active',createdAt:serverTimestamp(),lastLoginAt:serverTimestamp(),...(role===noPhone?{}:{phoneNumber:'+971500000000'})};
      await assertSucceeds(setDoc(doc(db,'users',uid),profile));
      await assertFails(updateDoc(doc(db,'users',uid),{email:'private@example.test'}));
    }
    const animalId=`email-direct-${noPhone}`;
    await assertSucceeds(setDoc(doc(sdb,'animals',animalId),{...animalData('AE'),sellerId:sid,price:500}));
    await assertSucceeds(updateDoc(doc(sdb,'animals',animalId),{description:'edited',updatedAt:serverTimestamp()}));
    await assertSucceeds(setDoc(doc(bdb,'purchaseRequests',animalId),{animalId,sellerId:sid,buyerId:bid,price:500,status:'pending',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
    const auctionId=`email-auction-${noPhone}`;
    const ab=writeBatch(sdb);
    ab.set(doc(sdb,'animals',auctionId),{...animalData('AE','auction'),sellerId:sid});
    ab.set(doc(sdb,'auctions',auctionId),{...auctionData(auctionId,'AE'),sellerId:sid});
    await assertSucceeds(ab.commit());
    await assertSucceeds(updateDoc(doc(bdb,'auctions',auctionId),{currentPrice:110,lastBidAt:serverTimestamp(),lastBidderId:bid,lastBidderPhone:''}));
    await assertSucceeds(setDoc(doc(sdb,'serviceRequests',`${sid}_featured_animal_${animalId}`),{...serviceData('featured','animal',animalId,'AE',15,'AED'),userId:sid}));
    const cid=`direct_${animalId}_${bid}`;
    await assertSucceeds(setDoc(doc(bdb,'conversations',cid),{contextType:'direct',animalId,sellerId:sid,buyerId:bid,participants:[sid,bid],askingPrice:500,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),lastMessage:'',lastMessageType:'',lastMessageSenderId:'',sellerUnread:0,buyerUnread:0}));
    for (const [db,uid,role] of [[sdb,sid,'seller'],[bdb,bid,'buyer']]) {
      const contact={uid,displayName:role,createdAt:serverTimestamp(),...(role===noPhone?{}:{phoneNumber:'+971500000000'})};
      await assertFails(setDoc(doc(db,'conversations',cid,'privateContacts',uid),{...contact,email:'private@example.test'}));
      await assertSucceeds(setDoc(doc(db,'conversations',cid,'privateContacts',uid),contact));
    }
    await assertFails(getDoc(doc(bdb,'conversations',cid,'privateContacts',sid)));
    await assertSucceeds(setDoc(doc(bdb,'conversations',cid,'messages','offer'),{type:'offer',offerAmount:450,status:'pending',senderId:bid,createdAt:serverTimestamp()}));
    const batch=writeBatch(sdb);
    batch.update(doc(sdb,'conversations',cid,'messages','offer'),{status:'accepted',decidedBy:sid,decidedAt:serverTimestamp()});
    batch.update(doc(sdb,'conversations',cid),{lastMessage:'accepted',lastMessageType:'text',lastMessageSenderId:sid,lastMessageAt:serverTimestamp(),updatedAt:serverTimestamp(),buyerUnread:1,contactStatus:'unlocked',acceptedOfferId:'offer',contactUnlockedAt:serverTimestamp()});
    await assertSucceeds(batch.commit());
    const ownerDb=noPhone==='seller'?bdb:sdb, contactUid=noPhone==='seller'?sid:bid;
    const contact=(await assertSucceeds(getDoc(doc(ownerDb,'conversations',cid,'privateContacts',contactUid)))).data();
    if ('phoneNumber' in contact || 'email' in contact) throw Error('Unexpected private contact fields');
    await assertFails(getDoc(doc(third,'conversations',cid,'privateContacts',contactUid)));
    await assertSucceeds(setDoc(doc(bdb,'conversations',cid,'messages','continued'),{type:'text',text:'continue here',senderId:bid,createdAt:serverTimestamp()}));
  });
}
await check('deletion request own UID create/read; forged UID/status/extra keys denied',async()=>{
  const data={userId:'buyer',status:'pending',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  await assertSucceeds(getDoc(doc(buyer,'accountDeletionRequests/buyer')));
  await assertFails(setDoc(doc(anon,'accountDeletionRequests/buyer'),data));
  await assertFails(setDoc(doc(buyer,'accountDeletionRequests/seller'),data));
  await assertFails(setDoc(doc(buyer,'accountDeletionRequests/buyer'),{...data,userId:'seller'}));
  await assertFails(setDoc(doc(buyer,'accountDeletionRequests/buyer'),{...data,status:'completed'}));
  await assertFails(setDoc(doc(buyer,'accountDeletionRequests/buyer'),{...data,email:'not-stored@example.test'}));
  await assertSucceeds(setDoc(doc(buyer,'accountDeletionRequests/buyer'),data));
  await assertSucceeds(getDoc(doc(buyer,'accountDeletionRequests/buyer')));
  await assertFails(getDoc(doc(third,'accountDeletionRequests/buyer')));
  await assertFails(getDoc(doc(anon,'accountDeletionRequests/buyer')));
  await assertFails(getDocs(collection(buyer,'accountDeletionRequests')));
  await assertSucceeds(getDocs(query(collection(buyer,'accountDeletionRequests'),where('userId','==','buyer'))));
  await assertSucceeds(getDocs(collection(admin,'accountDeletionRequests')));
});
await check('deletion processing restricted to claim admin and preserves request identity',async()=>{
  const patch={status:'in_review',updatedAt:serverTimestamp(),processedAt:serverTimestamp(),processedBy:'admin'};
  await assertFails(updateDoc(doc(buyer,'accountDeletionRequests/buyer'),patch));
  await assertFails(updateDoc(doc(admin,'accountDeletionRequests/buyer'),{...patch,userId:'seller'}));
  await assertFails(updateDoc(doc(admin,'accountDeletionRequests/buyer'),{...patch,processedBy:'buyer'}));
  await assertFails(updateDoc(doc(buyer,'accountDeletionRequests/buyer'),{...patch,status:'completed',processedBy:'buyer'}));
  await assertFails(updateDoc(doc(admin,'accountDeletionRequests/buyer'),{...patch,processedAt:new Date(0)}));
  await assertSucceeds(updateDoc(doc(admin,'accountDeletionRequests/buyer'),patch));
  await assertSucceeds(updateDoc(doc(admin,'accountDeletionRequests/buyer'),{...patch,status:'completed'}));
  await assertFails(updateDoc(doc(admin,'accountDeletionRequests/buyer'),{...patch,status:'pending'}));
  for(const db of [buyer,admin]) { const batch=writeBatch(db);batch.delete(doc(db,'accountDeletionRequests/buyer'));await assertFails(batch.commit()); }
});

await check('legacy purchase acceptance is seller-only and readable by each party without unlocking contacts',async()=>{
  await env.withSecurityRulesDisabled(async c=>{
    const db=c.firestore();
    await setDoc(doc(db,'purchaseRequests/legacy-contact-proof'),{animalId:'legacy-ae',buyerId:'buyer',sellerId:'seller',status:'pending',createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
    await setDoc(doc(db,'conversations/legacy-request-chat'),{contextType:'direct',animalId:'legacy-ae',buyerId:'buyer',sellerId:'seller',participants:['buyer','seller']});
  });
  const patch={status:'accepted',updatedAt:serverTimestamp()};
  await assertFails(updateDoc(doc(buyer,'purchaseRequests/legacy-contact-proof'),patch));
  await assertSucceeds(updateDoc(doc(seller,'purchaseRequests/legacy-contact-proof'),patch));
  await assertSucceeds(getDocs(query(collection(buyer,'purchaseRequests'),where('buyerId','==','buyer'))));
  await assertSucceeds(getDocs(query(collection(seller,'purchaseRequests'),where('sellerId','==','seller'))));
  await assertFails(getDoc(doc(third,'purchaseRequests/legacy-contact-proof')));
  await assertFails(getDocs(query(collection(third,'purchaseRequests'),where('buyerId','==','buyer'))));
  await assertFails(getDoc(doc(buyer,'conversations/legacy-request-chat/privateContacts/seller')));
  await assertFails(getDoc(doc(seller,'conversations/legacy-request-chat/privateContacts/buyer')));
});

console.log(`SUMMARY | ${results.length}/${results.length} passed`);
await env.cleanup();
