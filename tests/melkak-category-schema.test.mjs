import test from 'node:test';
import assert from 'node:assert/strict';
import {CATEGORIES,selectDraftCategory} from '../melkak/config.js';
import {attachProductionServices} from '../melkak/production-services.js';
const countries={AE:{currency:'AED',dial:'971',regions:{Sharjah:['Dhaid']}}};
const base={ownerUid:'seller',country:'AE',region:'Sharjah',city:'Dhaid',title:'Valid listing',description:'Valid listing description',price:100,images:['data:image/jpeg;base64,/9j/AA=='],contact:{phone:'+971500000000',call:true,whatsapp:true,showNumber:false,consent:true},status:'active'};
for(const category of CATEGORIES){
 test(category.id+' rejects unrelated fields before any Firestore write',async()=>{
  let writes=0;const data={...base,category:category.id,attributes:{}};
  const sdk={doc:()=>({id:'listing'}),collection:()=>({}),serverTimestamp:()=>1,setDoc:async()=>{writes++},runTransaction:async(_db,fn)=>fn({get:async()=>({exists:()=>true,data:()=>data}),update:()=>{writes++}})};
  const store=attachProductionServices({state:{listings:[],categories:CATEGORIES.map(c=>({...c,enabled:true}))}},{sdk,db:{},auth:{state:{actor:{uid:'seller',status:'active'}}},config:{writesEnabled:true},countries});
  const wrong=category.id==='cars'?'breed':'mileage';
  await assert.rejects(store.create({...data,attributes:{[wrong]:'wrong field'}}),{code:'FIELDS'});
  await assert.rejects(store.update('listing',{attributes:{[wrong]:'wrong field'}}),{code:'FIELDS'});
  assert.equal(writes,0);
 });
 test(category.id+' draft transition retains only compatible schema fields',()=>{
  const d={...base,category:'previous',attributes:Object.fromEntries(CATEGORIES.flatMap(c=>c.fields.map(f=>[f.id,f.options.length?f.options[0][0]:'value'])))};
  const title=d.title,photos=d.images;selectDraftCategory(d,category.id);
  assert.equal(d.category,category.id);assert.equal(d.title,title);assert.equal(d.images,photos);
  assert.ok(Object.keys(d.attributes).every(k=>category.fields.some(f=>f.id===k)));
 });
}
test('unknown category is rejected without altering the draft',()=>{const d={category:'cars',attributes:{brand:'Toyota'}};assert.throws(()=>selectDraftCategory(d,'invented'),{code:'CATEGORY'});assert.equal(d.category,'cars')});
