import test from 'node:test';
import assert from 'node:assert/strict';
const model = await import('../melkak/production-model.js').catch(()=>({}));
const datasource = await import('../melkak/production-datasource.js').catch(()=>({}));
const countries={AE:{currency:'AED'},SA:{currency:'SAR'}};
const jpeg='data:image/jpeg;base64,YQ==';
test('normalized provenance, dates, country currency and explicit contact consent',()=>{
 assert.equal(typeof model.normalizeProductionListing,'function');
 const row=model.normalizeProductionListing('same',{ownerUid:'u',country:'SA',currency:'USD',images:[jpeg],contactPhone:'+966555555555',allowCall:true,allowWhatsapp:true,showPhone:true,contactConsent:true,createdAt:{seconds:0},featured:true,featuredStatus:'approved',featuredStartAt:{seconds:1},featuredEndAt:{seconds:2}},countries);
 assert.equal(row.id,'marketplace-same');assert.equal(row.currency,'SAR');assert.equal(row.createdAt,0);assert.equal(row.featuredEndAt,2000);assert.equal(row.contact.consent,true);
 const old=model.normalizeProductionLegacy('same',{sellerId:'u',country:'AE',images:['bad'],phone:'+971555555555',featuredAt:{seconds:1},featuredUntil:{seconds:2}},countries);
 assert.equal(old.id,'legacy-same');assert.equal(old.sourceCollection,'animals');assert.equal(old.contact,null);assert.equal(old.imageNotice,'missing_or_invalid');assert.equal(old.featuredEndAt,2000);
});
function harness(data={},actor={}){
 const calls=[];let listener;const auth={state:{actor},subscribe(fn){listener=fn;fn(this.state);return()=>{};},set(next){this.state={actor:next};listener(this.state);}};
 const sdk={collection:(_,name)=>({name}),where:(...args)=>({where:args}),limit:n=>({limit:n}),orderBy:(...args)=>({orderBy:args}),query:(ref,...filters)=>({...ref,filters}),doc:(_,name,id)=>({name,id}),async getDocs(q){calls.push(q);let rows=data[q.name]||[];if(rows instanceof Error)throw rows;if(typeof rows==='function')return rows(q);for(const f of q.filters)if(f.where){const [k,op,v]=f.where;if(op==='==')rows=rows.filter(r=>r[k]===v);}return {docs:rows.map(r=>({id:r.id,data:()=>r}))};},async getDoc(ref){calls.push(ref);return {exists:()=>true,data:()=>({imageData:jpeg})};}};
 return {sdk,auth,calls,db:{},countries};
}
test('bounded public reads preserve legacy when new collections denied; no private or image reads',async()=>{
 assert.equal(typeof datasource.createProductionDatasource,'function');const h=harness({animals:[{id:'a',status:'active',sellerId:'u',country:'AE'}],marketplaceListings:Object.assign(new Error('denied'),{code:'permission-denied'})});
 const s=await datasource.createProductionDatasource(h);assert.equal(s.state.listings.length,1);assert.equal(s.state.capabilities.marketplaceListings.status,'denied');assert.equal(s.state.capabilities.marketplaceCategories.status,'empty');assert.ok(h.calls.every(q=>q.filters?.some(f=>f.limit)));assert.ok(!h.calls.some(q=>['users','serviceRequests','commercialAdImages'].includes(q.name)));s.dispose();
});
test('own reads isolate seller and clear private rows on signout, including in-flight races',async()=>{
 const h=harness({marketplaceListings:[{id:'a',ownerUid:'u',status:'hidden',country:'AE'},{id:'b',ownerUid:'v',status:'hidden',country:'AE'}]},{uid:'u',status:'active'});const s=await datasource.createProductionDatasource(h);await s.loadOwn();assert.deepEqual(s.state.listings.map(x=>x.sourceId),['a']);h.auth.set({});assert.equal(s.state.listings.length,0);
 const finishes=[];h.auth.set({uid:'u',status:'active'});h.sdk.getDocs=()=>new Promise(r=>{finishes.push(r);});const loading=s.loadOwn();h.auth.set({});for(const finish of finishes)finish({docs:[{id:'secret',data:()=>({ownerUid:'u',status:'hidden'})}]});await loading;s.dispose();assert.equal(s.state.listings.length,0);
});
test('admin reads require ready registry and permissions; ad image reads are lazy and bounded to current/next',async()=>{
 const h=harness();const s=await datasource.createProductionDatasource(h);h.auth.set({uid:'a',role:'super_admin',status:'active',ready:false});await s.loadAdmin();assert.ok(!h.calls.some(q=>q.name==='users'));
 h.auth.set({uid:'a',role:'admin_assistant',status:'active',ready:true,permissions:['users_view']});await s.loadAdmin();assert.ok(h.calls.some(q=>q.name==='users'));assert.ok(!h.calls.some(q=>q.name==='marketplaceAuditLogs'));
 await s.loadAdImages(['1','2','3']);assert.ok(h.calls.filter(q=>q.name==='commercialAdImages').length<=2);s.dispose();
});
test('commercial metadata uses current time and loads only current and next image documents',async()=>{
 const now=Date.now();const ads=['1','2','3'].map(id=>({id,status:'active',startAt:now-60000,endAt:now+60000}));const h=harness({commercialAds:[...ads,{id:'expired',status:'active',startAt:now-60000,endAt:now-1}]});const s=await datasource.createProductionDatasource(h);assert.equal(s.state.ads.length,3);await s.loadAdImages(['1','2','3']);assert.equal(h.calls.filter(q=>q.name==='commercialAdImages').length,2);assert.equal(s.state.ads[0].imageData,jpeg);s.dispose();
});

test('admin request reads constrain each permission to the corresponding type',async()=>{
 const h=harness({}, {uid:'a',role:'admin_assistant',status:'active',ready:true,permissions:['reports_view']});const s=await datasource.createProductionDatasource(h);await s.loadAdmin();const requests=h.calls.filter(q=>q.name==='marketplaceRequests');assert.equal(requests.length,1);assert.ok(requests[0].filters.some(f=>f.where?.[0]==='type'&&f.where[1]==='=='&&f.where[2]==='report'));s.dispose();
});
test('legacy timestamp fields and moderation timestamps are numeric at the model boundary',()=>{
 const row=model.normalizeProductionLegacy('a',{featuredAt:{seconds:1},featuredUntil:{seconds:2},moderatedAt:{seconds:3}},countries);assert.equal(row.featuredAt,1000);assert.equal(row.featuredUntil,2000);assert.equal(row.moderatedAt,3000);
});
test('writer hasHistory protects UI deletion and explicit nested refusal wins over stale flat consent',()=>{
 const row=model.normalizeProductionListing('a',{hasHistory:true,contact:{consent:false},contactConsent:true,contactPhone:'+971555555555',allowCall:true},countries);assert.equal(row.history,true);assert.equal(row.contact,null);
 assert.equal(model.normalizeProductionListing('b',{hasHistory:false},countries).history,false);
});
test('commercial request normalization flattens data for review, preserves raw mutation id and prevents public placement',()=>{
 const row=model.normalizeProductionRecord('request-id',{type:'commercial',ownerUid:'u',status:'approved',data:{title:'Ad',image:jpeg,countryTarget:'SA',startAt:{seconds:1},endAt:{seconds:2}}},'marketplaceRequests');assert.equal(row.id,'request-id');assert.equal(row.asset,jpeg);assert.equal(row.startAt,1000);assert.equal(row.publicEligible,false);assert.equal(row.countryTarget,'SA');
});
test('admin services query only supports deployed proposed request types and private ads clear on logout',async()=>{
 const now=Date.now(),h=harness({commercialAds:[{id:'existing',status:'active',startAt:now-60000,endAt:now+60000}],marketplaceRequests:[{id:'req',type:'commercial',ownerUid:'a',status:'pending',data:{title:'Review me',image:jpeg,startAt:now,endAt:now+60000}}]},{uid:'a',status:'active',role:'admin_assistant',ready:true,permissions:['services_view']});const s=await datasource.createProductionDatasource(h);await s.loadAdmin();assert.deepEqual(h.calls.find(q=>q.name==='marketplaceRequests').filters.find(f=>f.where)?.where,['type','in',['featured','commercial']]);assert.equal(s.state.ads.length,2);assert.equal(s.state.publicAds.length,1);assert.equal(s.state.ads.find(a=>a.id==='req').title,'Review me');h.auth.set({});assert.equal(s.state.ads.length,1);s.dispose();
});
test('public listings never expose auction rows from either listing collection',async()=>{
 const h=harness({animals:[{id:'auction',status:'active',saleType:'auction'},{id:'direct',status:'active',saleType:'direct'}],marketplaceListings:[{id:'auction',status:'active',saleType:'auction'}]});const s=await datasource.createProductionDatasource(h);assert.deepEqual(s.state.listings.map(a=>a.id),['legacy-direct']);s.dispose();
});
test('legacy commercial private metadata requires active registered owner and never enters publicAds',async()=>{
 const now=Date.now(),h=harness({commercialAds:[{id:'private',status:'paused',startAt:now-60000,endAt:now+60000}]},{uid:'a',status:'active',ready:true,role:'admin_assistant',permissions:['services_view','manage_ads']});const s=await datasource.createProductionDatasource(h);await s.loadAdmin();assert.ok(!h.calls.some(q=>q.name==='commercialAds'&&q.filters.every(f=>!f.where)));h.auth.set({uid:'a',status:'active',ready:true,role:'super_admin'});await s.loadAdmin();assert.equal(s.state.ads.length,1);assert.equal(s.state.publicAds.length,0);await s.loadAdImages(['private']);assert.equal(h.calls.filter(q=>q.name==='commercialAdImages').length,1);h.auth.set({});assert.equal(s.state.ads.length,0);s.dispose();
});
