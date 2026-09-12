import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, setDoc, getDoc, writeBatch, updateDoc, serverTimestamp, Timestamp} from 'firebase/firestore';
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw Error('Local emulator required');
const variants = [['repository',fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')]];
if(process.env.RELEASE_RULES_CANDIDATE) variants.push(['release-candidate',fs.readFileSync(process.env.RELEASE_RULES_CANDIDATE,'utf8')]);
// Optional audit deliberately retains strict assertions against unpatched Production.
if(process.argv.includes('--audit-production')) {
  if(!process.env.PRODUCTION_RULES_SNAPSHOT) throw Error('Production snapshot required');
  const snapshot=JSON.parse(fs.readFileSync(process.env.PRODUCTION_RULES_SNAPSHOT,'utf8'));
  variants.push(['deployed-snapshot',snapshot.source.find(f=>f.name==='firestore.rules').content]);
}
let count = 0, failed = 0;
const test = async (name, run) => {
  count++;
  try {await run(); console.log('PASS | '+name);}
  catch (error) {failed++; console.error('FAIL | '+name+' | '+error.message);}
};
// Worst-case encoded payload; JPEG decoding/compression is covered in the real browser.
const images = Array.from({length:4}, (_, i) => 'data:image/jpeg;base64,' + Buffer.alloc(150*1024,i+1).toString('base64'));
assert.ok(images.slice(0,3).join('').length < 650000);
for (const [label,rules] of variants) {
  const env = await initializeTestEnvironment({projectId:'demo-free-images-'+label,firestore:{rules}});
  try {
    const seller = env.authenticatedContext('seller').firestore();
    const guest = env.unauthenticatedContext().firestore();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users','seller'),{uid:'seller',status:'active',accountType:'seller'}));
    const listing = (n, saleType='direct') => ({sellerId:'seller',saleType,type:'ناقة',status:'active',country:'AE',region:'الشارقة',city:'الذيد',images:images.slice(0,n),description:'و'.repeat(2000),price:2200,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    for (const n of [1,2,3]) {
      await test(label+': direct '+n+' maximum-size inline images',async()=>{
        await assertSucceeds(setDoc(doc(seller,'animals','direct'+n),listing(n)));
        assert.deepEqual((await getDoc(doc(guest,'animals','direct'+n))).data().images,images.slice(0,n));
      });
      await test(label+': auction '+n+' maximum-size inline images',async()=>{
        const id='auction'+n,batch=writeBatch(seller);
        batch.set(doc(seller,'animals',id),{...listing(n,'auction'),auctionId:id});
        batch.set(doc(seller,'auctions',id),{animalId:id,country:'AE',sellerId:'seller',sellerName:'',startPrice:2200,currentPrice:2200,minIncrement:100,endTime:Timestamp.fromMillis(Date.now()+86400000),status:'active',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
        await assertSucceeds(batch.commit());
      });
    }
    for (const saleType of ['direct','auction']) {
      const ref=doc(seller,'animals','update-'+saleType);
      await setDoc(ref,listing(1,saleType));
      await test(label+': '+saleType+' update 1 to 2',()=>assertSucceeds(updateDoc(ref,{images:images.slice(0,2)})));
      await test(label+': '+saleType+' update 2 to 3',()=>assertSucceeds(updateDoc(ref,{images:images.slice(0,3)})));
      await test(label+': '+saleType+' update 3 to 4 denied',()=>assertFails(updateDoc(ref,{images})));
      await test(label+': '+saleType+' update to zero denied',()=>assertFails(updateDoc(ref,{images:[]})));
      await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'animals','legacy-'+saleType),{...listing(4,saleType),createdAt:Timestamp.now(),updatedAt:Timestamp.now()}));
      const legacy=doc(seller,'animals','legacy-'+saleType);
      await test(label+': '+saleType+' legacy publicly readable',()=>assertSucceeds(getDoc(doc(guest,'animals','legacy-'+saleType))));
      await test(label+': '+saleType+' legacy metadata preserved',()=>assertSucceeds(updateDoc(legacy,{breed:'legacy'})));
      await test(label+': '+saleType+' legacy replacement cannot stay at four',()=>assertFails(updateDoc(legacy,{images:[...images.slice(1),images[0]]})));
      await test(label+': '+saleType+' legacy 4 to 3 allowed',()=>assertSucceeds(updateDoc(legacy,{images:images.slice(0,3)})));
    }
    await test(label+': invalid image schema rejected',async()=>{for(const bad of [null,'url',[null],[1],[''],['same','same']])await assertFails(setDoc(doc(seller,'animals','invalid'),{...listing(1),images:bad}));});
    const auctionData=animalId=>({animalId,country:'AE',sellerId:'seller',sellerName:'',startPrice:2200,currentPrice:2200,minIncrement:100,endTime:Timestamp.fromMillis(Date.now()+86400000),status:'active',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    await test(label+': auction cannot link a legacy four-image listing',async()=>{
      await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'animals','legacy-auction-four'),{...listing(4,'auction'),createdAt:Timestamp.now(),updatedAt:Timestamp.now()}));
      await assertFails(setDoc(doc(seller,'auctions','new-legacy-auction'),auctionData('legacy-auction-four')));
    });
    await test(label+': auction cannot store a separate images array',()=>assertFails(setDoc(doc(seller,'auctions','separate-images'),{...auctionData('auction1'),images})));
    await test(label+': four images denied server-side',()=>assertFails(setDoc(doc(seller,'animals','four'),listing(4))));
    await test(label+': zero images denied server-side',()=>assertFails(setDoc(doc(seller,'animals','zero'),listing(0))));
    await test(label+': anonymous write denied',()=>assertFails(setDoc(doc(guest,'animals','guest'),listing(1))));
    await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users','seller'),{uid:'seller',status:'blocked'}));
    await test(label+': blocked account write denied',()=>assertFails(setDoc(doc(seller,'animals','blocked'),listing(1))));
  } finally {await env.cleanup();}
}
console.log(`SUMMARY | ${count-failed}/${count} passed; Production writes: 0`);
if (failed) process.exitCode=1;
