const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const exportsList = [...source.matchAll(/import\s*\{([^}]+)\}/g)].flatMap(m => m[1].split(',').map(s => s.trim()));
let count = 0;
function pass(name) { count++; console.log('PASS | ' + name); }
(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 try {
 const page = await browser.newPage();
 const errors = [], external = [], dialogs = [];
 let rejectConfirmation = false;
 page.on('pageerror', e => errors.push(e.message));
 page.on('dialog', d => {dialogs.push(d.message());return d.type()==='confirm' && rejectConfirmation ? d.dismiss() : d.accept(d.type() === 'prompt' ? '110' : undefined)});
 await page.addInitScript(() => {
   const docs = new Map(), calls = [], observers = [];
   let sequence = 0, queue = Promise.resolve();
   const auth = { currentUser: null };
   const clone = value => structuredClone(value);
   const snapshot = ref => ({ id: ref.path.split('/').pop(), exists: () => docs.has(ref.path), data: () => clone(docs.get(ref.path)) });
   const readQuery = ref => {
     let items = [...docs].filter(([key]) => key.startsWith(ref.path + '/') && key.split('/').length === ref.path.split('/').length + 1)
       .filter(([key,data]) => (ref.filters || []).filter(f=>Array.isArray(f)).every(([field,op,value]) => op === 'array-contains' ? data[field]?.includes(value) : op==='>=' ? data[field]>=value : op==='>' ? data[field]>value : op==='<=' ? data[field]<=value : (field==='__name__'?key.split('/').pop():data[field]) === value))
       .map(([key]) => snapshot({path:key}));
     if((ref.filters||[]).some(f=>f.orderBy==='__name__'))items.sort((a,b)=>a.id.localeCompare(b.id));
     const after=(ref.filters||[]).find(f=>f.cursor)?.cursor;
     if(after)items=items.slice(items.findIndex(d=>d.id===after.id)+1);
     const max=(ref.filters||[]).find(f=>f.limit)?.limit;
     if(max)items=items.slice(0,max);
     return { docs: items, forEach: fn => items.forEach(fn), empty: !items.length, size: items.length };
   };
   const write = (ref, data, merge) => {
     if (JSON.stringify(data).match(/"(?:password|passwordHash|email)"\s*:/)) throw Error('Sensitive Firestore field');
     if (Object.values(data).some(v => v === undefined)) throw Error('Undefined write');
     calls.push({kind:'write',path:ref.path,data:clone(data)});
     docs.set(ref.path, merge ? {...docs.get(ref.path),...clone(data)} : clone(data));
   };
   const batch = () => {
     const writes=[]; const b={set:(r,d,o)=>{writes.push(()=>write(r,d,o?.merge));return b},update:(r,d)=>{writes.push(()=>write(r,d,true));return b},commit:async()=>writes.forEach(fn=>fn())}; return b;
   };
   const setUser = async user => { auth.currentUser = user; await Promise.all(observers.map(fn => fn(user))); };
   const mock = {
     initializeApp:()=>({}),getFirestore:()=>({}),getAuth:()=>auth,
     onAuthStateChanged:(a,fn)=>{observers.push(fn);queueMicrotask(()=>fn(a.currentUser));return ()=>{}},
     getIdTokenResult:async()=>({claims:{admin:!!window.__mock.admin}}),
     collection:(base,...parts)=>({path:[base.path,...parts].filter(Boolean).join('/')}),
     doc:(base,...parts)=>{const refPath=[base.path,...(parts.length?parts:['auto'+(++sequence)])].filter(Boolean).join('/');return {path:refPath,id:refPath.split('/').pop()}},
     query:(ref,...filters)=>({...ref,filters}),where:(...args)=>args,
     limit:n=>({limit:n}),orderBy:field=>({orderBy:field}),startAfter:cursor=>({cursor}),
     getCountFromServer:async ref=>({data:()=>({count:readQuery(ref).size})}),
     getDoc:async ref=>{window.__mock.reads.push(ref.path);return snapshot(ref);},getDocs:async ref=>{
       if(ref.path==='purchaseRequests' && window.__mock.purchaseDelay)await new Promise(resolve=>setTimeout(resolve,window.__mock.purchaseDelay));
       return readQuery(ref);
     },
     setDoc:async(ref,data,options)=>write(ref,data,options?.merge),updateDoc:async(ref,data)=>write(ref,data,true),
     addDoc:async(ref,data)=>{const item={path:ref.path+'/auto'+(++sequence),id:'auto'+sequence};write(item,data);return item},
     serverTimestamp:()=>new Date(),Timestamp:{fromMillis:value=>new Date(value)},
     writeBatch:()=>batch(),
     runTransaction:async(db,fn)=>{
       const run=queue.then(async()=>{const b=batch();const result=await fn({get:async ref=>snapshot(ref),set:b.set,update:b.update});await b.commit();return result});
       queue=run.catch(()=>{});return run;
     },
     onSnapshot:(ref,fn)=>{queueMicrotask(()=>fn(readQuery(ref)));return ()=>{}},
     signOut:async()=>{calls.push({kind:'logout'});await setUser(null)},
     RecaptchaVerifier:class { clear(){} },
     signInWithPhoneNumber:async()=>{calls.push({kind:'phone'});throw {code:'auth/billing-not-enabled'}},
     createUserWithEmailAndPassword:async(a,email,password)=>{
       calls.push({kind:'signup'});await new Promise(r=>setTimeout(r,35));
       if(window.__mock.error)throw {code:window.__mock.error};
       const user={uid:'owner',email,phoneNumber:null,providerData:[{providerId:'password'}]};await setUser(user);return {user};
     },
     signInWithEmailAndPassword:async(a,email,password)=>{
       calls.push({kind:'login'});if(window.__mock.error)throw {code:window.__mock.error};
       const user={uid:'owner',email,phoneNumber:null,providerData:[{providerId:'password'}]};await setUser(user);return {user};
     },
     sendPasswordResetEmail:async()=>{calls.push({kind:'reset'});if(window.__mock.error)throw {code:window.__mock.error}}
   };
   window.__mock={reads:[],api:mock,docs,calls,setUser,admin:false,error:null,failures:[]};
 });
 await page.route('**/*', async route => {
   const url = new URL(route.request().url());
   if(url.hostname==='res.cloudinary.com')return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'hero-livestock.png'))});
   if (url.hostname === 'www.gstatic.com') {
     const code=exportsList.map(name => name==='RecaptchaVerifier'
       ? 'export const RecaptchaVerifier = window.__mock.api.RecaptchaVerifier;'
       : name==='Timestamp' ? 'export const Timestamp = window.__mock.api.Timestamp;'
       : `export const ${name}=(...args)=>{const fn=window.__mock.api.${name};if(!fn){window.__mock.failures.push('${name}');throw Error('Unexpected SDK API')};return fn(...args)};`).join('\n');
     return route.fulfill({contentType:'text/javascript',body:code});
   }
   if(url.hostname!=='auth.test'){external.push(url.origin);return route.abort()}
   const file=path.join(root,decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!file.startsWith(root)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
 });
 await page.addInitScript(()=>{
 const d=window.__mock.docs,now=Date.now();
 d.set('adminSecurity/config',{enabled:true,superAdminUids:['owner']});d.set('users/owner',{displayName:'مالك الاختبار',status:'active',accountType:'both'});d.set('adminAccess/owner',{role:'super_admin'});d.set('users/helper',{status:'active',accountType:'both'});d.set('adminAccess/helper',{role:'admin_assistant',adminStatus:'active',permissions:['dashboard_view','reports_view','listings_manage']});
 const base={title:'إعلان تجاري تجريبي',advertiserName:'معلن الاختبار',description:'محتوى محلي معزول',cta:'المزيد',imageUrl:'https://res.cloudinary.com/demo/image/upload/sample.jpg',targetUrl:'https://example.test/',status:'active',priority:1,startAt:new Date(now-86400000),endAt:new Date(now+86400000*7),createdAt:new Date(now),createdBy:'owner',updatedAt:new Date(now),updatedBy:'owner'};
 for(let i=0;i<12;i++)d.set('commercialAds/hero'+i,{...base,title:'رئيسي '+i,placement:'hero',priority:i});
 for(const p of ['hero_side_1','hero_side_2','hero_side_3','middle','footer_1','footer_2','footer_3','footer_4','footer_5'])d.set('commercialAds/'+p,{...base,placement:p,title:p});
 d.set('commercialAds/paused',{...base,placement:'hero',status:'paused',title:'لا يظهر موقوف'});d.set('commercialAds/expired',{...base,placement:'hero',endAt:new Date(now-1000),title:'لا يظهر منتهي'});
 d.set('analyticsSessions/sample',{startedAt:new Date(now),pageViews:4,pages:{home:2,market:2,services:0,admin:0,other:0},views:['hero11'],clicks:['hero11']});
 });
 const shots=process.env.COMMERCIAL_SCREENSHOTS||path.join(process.env.TEMP,'souq-commercial');fs.mkdirSync(shots,{recursive:true});
 await page.goto('https://auth.test/');await page.waitForFunction(()=>typeof window.openAdminPanel==='function');await page.evaluate(()=>window.selectMarketCountry('AE'));await page.locator('.commercial-hero a').waitFor();
 assert.equal(await page.locator('.commercial-hero nav button[aria-current]').count(),10);pass('hero max ten');
 assert.equal(await page.locator('.commercial-side a').count(),3);assert.equal(await page.locator('.commercial-middle a').count(),1);assert.equal(await page.locator('.commercial-footer a').count(),5);pass('side middle footer placements');
 assert.equal(await page.getByText('لا يظهر موقوف',{exact:true}).count(),0);assert.equal(await page.getByText('لا يظهر منتهي',{exact:true}).count(),0);pass('inactive and expired hidden');
 await page.getByRole('button',{name:'إيقاف',exact:true}).click();const previous=await page.locator('.commercial-hero a').getAttribute('data-ad');await page.getByRole('button',{name:'الإعلان التالي',exact:true}).click();assert.notEqual(await page.locator('.commercial-hero a').getAttribute('data-ad'),previous);pass('slider navigation and pause');
 assert.equal(await page.locator('.commercial-card img').evaluateAll(xs=>xs.every(x=>x.alt&&x.width&&x.height)),true);assert.equal(await page.locator('.commercial-card').evaluateAll(xs=>xs.every(x=>x.rel.includes('noopener')&&x.querySelector('.commercial-label').textContent==='إعلان')),true);pass('image alt dimensions sponsored accessible labels');
 for(const [width,height] of [[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[430,932],[390,844],[360,800]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:path.join(shots,'home-'+width+'.png'),fullPage:true});pass('public responsive '+width);}
 await page.evaluate(async()=>{window.__mock.admin=true;await window.__mock.setUser({uid:'owner',displayName:'مالك الاختبار',providerData:[{providerId:'google.com'}]});await window.openAdminSection('commercialAds');});
 await page.locator('.commercial-map article').first().waitFor();assert.equal(await page.locator('.commercial-map article').count(),10);pass('ad map ten placements');
 await page.getByRole('textbox',{name:'بحث باسم الإعلان أو المعلن'}).fill('hero_side_1');assert.equal(await page.locator('.commercial-table-wrap tbody tr').count(),1);pass('admin search');await page.getByRole('textbox',{name:'بحث باسم الإعلان أو المعلن'}).fill('');await page.getByLabel('حالة الإعلان',{exact:true}).selectOption('paused');assert.equal(await page.locator('.commercial-table-wrap tbody tr').count(),1);pass('status filter');await page.getByLabel('حالة الإعلان',{exact:true}).selectOption('');await page.getByLabel('مكان الإعلان',{exact:true}).selectOption('middle');assert.equal(await page.locator('.commercial-table-wrap tbody tr').count(),1);pass('placement filter');
 await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'إضافة إعلان جديد',exact:true}).click();await page.locator('dialog[open]').waitFor();
 for(const [key,value] of Object.entries({title:'إعلان جديد معزول',advertiserName:'معلن خاص',imageUrl:'https://res.cloudinary.com/demo/image/upload/sample.jpg',targetUrl:'https://example.test/',startAt:'2026-01-01T10:00',endAt:'2028-01-01T10:00',priority:'4',advertiserEmail:'private@example.test',advertiserPhone:'0500000000'}))await page.locator('[name='+key+']').fill(value);
 await page.locator('[name=status]').selectOption('active');await page.getByRole('button',{name:'حفظ الإعلان',exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'إغلاق');await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'حفظ الإعلان');pass('dialog keyboard focus contained');await page.screenshot({path:path.join(shots,'add-ad.png'),fullPage:true});await page.getByRole('button',{name:'حفظ الإعلان',exact:true}).click();await page.waitForFunction(()=>[...window.__mock.docs].some(([p,d])=>p.startsWith('commercialAds/')&&d.title==='إعلان جديد معزول'));pass('owner add ad');
 assert.equal(await page.evaluate(()=>[...window.__mock.docs].filter(([p])=>p.startsWith('commercialAds/')).some(([,d])=>'advertiserEmail' in d)),false);pass('contacts private document only');
 await page.getByRole('textbox',{name:'بحث باسم الإعلان أو المعلن'}).fill('إعلان جديد معزول');await page.locator('.commercial-table-wrap').getByRole('button',{name:'تعديل',exact:true}).click();await page.locator('[name=title]').fill('إعلان معدل');await page.getByRole('button',{name:'حفظ الإعلان',exact:true}).click();await page.waitForFunction(()=>[...window.__mock.docs].some(([,d])=>d.title==='إعلان معدل'));pass('edit ad');
 await page.getByRole('textbox',{name:'بحث باسم الإعلان أو المعلن'}).fill('إعلان معدل');await page.locator('.commercial-table-wrap').getByRole('button',{name:'إيقاف',exact:true}).click();await page.getByRole('button',{name:'حفظ الإعلان',exact:true}).click();await page.waitForFunction(()=>[...window.__mock.docs].some(([,d])=>d.title==='إعلان معدل'&&d.status==='paused'));pass('pause ad');
 await page.getByRole('textbox',{name:'بحث باسم الإعلان أو المعلن'}).fill('إعلان معدل');await page.locator('.commercial-table-wrap').getByRole('button',{name:'تفعيل',exact:true}).click();await page.getByRole('button',{name:'حفظ الإعلان',exact:true}).click();await page.waitForFunction(()=>[...window.__mock.docs].some(([,d])=>d.title==='إعلان معدل'&&d.status==='active'));pass('reactivate ad');
 for(const [width,height] of [[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[430,932],[390,844],[360,800]]){await page.setViewportSize({width,height});await page.evaluate(()=>window.openAdminSection('commercialAds'));await page.locator('.commercial-map').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:path.join(shots,'admin-'+width+'.png'),fullPage:true});pass('admin responsive '+width);}
 await page.evaluate(()=>window.openAdminSection('visitorAnalytics'));await page.getByRole('table').waitFor();assert.equal(await page.locator('.commercial-admin .admin-stats strong').last().textContent(),'4');await page.screenshot({path:path.join(shots,'analytics.png'),fullPage:true});pass('actual analytics values and chart');
 await page.evaluate(async()=>{window.closeModal();window.__mock.admin=false;await window.__mock.setUser({uid:'helper',providerData:[]});await window.openAdminPanel();});assert.equal(await page.getByRole('button',{name:'إدارة الإعلانات التجارية',exact:true}).count(),0);await page.evaluate(()=>window.openAdminSection('commercialAds'));assert.equal(await page.locator('.commercial-admin').count(),0);pass('assistant not expanded into commercial admin');
 const gate=await page.evaluate(async()=>{const {installCommercialPublic}=await import('./commercial-public.js');let writes=0;const installed=await installCommercialPublic({...window.__mock.api,db:{},getDoc:async()=>({data:()=>({enabled:true})}),setDoc:async()=>writes++});const ads=[...document.querySelectorAll('.commercial-home')].at(-1).querySelectorAll('[data-ad]').length;installed.dispose();return {recorder:installed.recorder,writes,ads};});assert.equal(gate.recorder,null);assert.equal(gate.writes,0);assert.ok(gate.ads>0);pass('release gate blocks remote-enabled collection while ads render');
 const paged=await page.evaluate(async()=>{const {installCommercialPublic}=await import('./commercial-public.js');let calls=0;const base=window.__mock.docs.get('commercialAds/hero11');const installed=await installCommercialPublic({...window.__mock.api,db:{},getDoc:async()=>({data:()=>({enabled:false})}),getDocs:async()=>{calls++;const docs=calls===1?Array.from({length:100},(_,i)=>({id:'old'+i,data:()=>({...base,endAt:new Date(0)})})):[{id:'beyond100',data:()=>base}];return {docs,size:docs.length};}});const shown=[...document.querySelectorAll('.commercial-home')].at(-1).querySelector('[data-ad]')?.dataset.ad;installed.dispose();return {calls,shown};});assert.deepEqual(paged,{calls:2,shown:'beyond100'});pass('active creative beyond first query page remains visible');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(await page.evaluate(()=>window.__mock.failures),[]);pass('zero JS errors and zero production requests');console.log(`SUMMARY | ${count}/${count} passed`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
