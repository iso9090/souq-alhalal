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
       .filter(([key,data]) => (ref.filters || []).filter(f=>Array.isArray(f)).every(([field,op,value]) => op === 'array-contains' ? data[field]?.includes(value) : op==='>' ? data[field]>value : op==='<=' ? data[field]<=value : (field==='__name__'?key.split('/').pop():data[field]) === value))
       .map(([key]) => snapshot({path:key}));
     if((ref.filters||[]).some(f=>f.orderBy==='__name__'))items.sort((a,b)=>a.id.localeCompare(b.id));
     const after=(ref.filters||[]).find(f=>f.cursor)?.cursor;
     if(after)items=items.filter(d=>d.id.localeCompare(after.id)>0);
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
 const shots=process.env.ASSISTANTS_SCREENSHOTS||path.join(process.env.TEMP,'souq-assistants-screenshots');fs.mkdirSync(shots,{recursive:true});
 await page.goto('https://auth.test/');await page.waitForFunction(()=>typeof window.openAdminPanel==='function');
 await page.evaluate(()=>window.selectMarketCountry('AE'));
 await page.evaluate(async()=>{
  const d=window.__mock.docs;
  d.set('users/owner',{displayName:'مالك المنصة',status:'active',accountType:'both'});
  d.set('users/helper',{displayName:'أحمد مساعد الاختبار',status:'active',accountType:'both',email:'helper@example.test',phoneNumber:'0500000001'});
  d.set('users/candidate',{displayName:'سارة مستخدمة الاختبار',status:'active',accountType:'both',email:'candidate@example.test',phoneNumber:'0500000002'});
  d.set('users/normal',{displayName:'مستخدم عادي',status:'active',accountType:'both'});
  d.set('adminSecurity/config',{enabled:true,superAdminUids:['owner']});
  d.set('adminAccess/owner',{role:'super_admin'});
  d.set('adminAccess/helper',{role:'admin_assistant',adminStatus:'active',permissions:['dashboard_view','users_view','reports_view'],createdByAdminUid:'owner',adminCreatedAt:new Date(),adminUpdatedAt:new Date()});
  d.set('reports/sample',{reporterId:'normal',reportedUserId:'candidate',targetType:'user',targetId:'candidate',reason:'بلاغ محاكاة',status:'open'});
  window.__mock.admin=true;await window.__mock.setUser({uid:'owner',email:'owner@example.test',providerData:[{providerId:'password'}]});
 });
 const open=()=>page.evaluate(()=>window.openAdminSection('assistants'));
 const shot=async(name)=>{await page.locator('#adminV2Body').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(shots,name+'.png'),fullPage:true});};
 const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await open();await page.getByRole('button',{name:'تفاصيل المساعد',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'إضافة مساعد جديد',exact:true}).isVisible(),true);pass('Super Admin access and assistant list');
 assert.equal(await page.locator('.assistant-email').textContent(),'helper@example.test');pass('profile email directly visible');
 await page.getByRole('searchbox',{name:'البحث بالاسم أو البريد الإلكتروني'}).fill('أحمد');assert.equal(await page.locator('.assistant-card').count(),1);pass('search by name');
 await page.getByRole('searchbox',{name:'البحث بالاسم أو البريد الإلكتروني'}).fill('helper@example.test');assert.equal(await page.locator('.assistant-card').count(),1);pass('search by email');
 await page.getByRole('searchbox',{name:'البحث بالاسم أو البريد الإلكتروني'}).fill('');
 await page.getByLabel('حالة المساعد',{exact:true}).selectOption('suspended');assert.equal(await page.locator('.assistant-card').count(),0);await page.getByLabel('حالة المساعد',{exact:true}).selectOption('active');assert.equal(await page.locator('.assistant-card').count(),1);pass('status filter');
 await page.getByLabel('صلاحية المساعد',{exact:true}).selectOption('auctions_view');assert.equal(await page.locator('.assistant-card').count(),0);await page.getByLabel('صلاحية المساعد',{exact:true}).selectOption('users_view');assert.equal(await page.locator('.assistant-card').count(),1);pass('permission filter');
 await open();await page.getByRole('button',{name:'إضافة مساعد جديد',exact:true}).click();await page.locator('input[name=contact]').fill('owner');await page.getByRole('button',{name:'بحث عن مستخدم',exact:true}).click();await page.getByRole('button',{name:'مالك المنصة — owner',exact:true}).click();await page.getByText('الحساب محمي،',{exact:false}).waitFor();assert.equal(await page.locator('.admin-permissions-form').count(),0);pass('owner and self protection using actual UID');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));pass('native dialog Escape close');
 for(const width of [1440,1366,1024,768,430,390,360]){
  await page.setViewportSize({width,height:({1440:900,1366:768,1024:768,768:1024,430:932,390:844,360:800})[width]||900});await open();
  await page.getByRole('button',{name:'تفاصيل المساعد',exact:true}).waitFor();await noOverflow();await shot('assistants-list-'+width);pass('assistant list rendering '+width);
  await page.getByRole('button',{name:'إضافة مساعد جديد',exact:true}).click();assert.equal(await page.locator('.assistant-dialog').evaluate(d=>d.contains(document.activeElement)),true);await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('.assistant-dialog').evaluate(d=>d.contains(document.activeElement)),true);await shot('add-google-first-'+width);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  await page.getByRole('button',{name:'تفاصيل المساعد',exact:true}).click();await page.locator('.assistant-dialog').getByRole('button',{name:'تعديل الصلاحيات',exact:true}).waitFor();
  assert.equal(await page.locator('.admin-technical[open]').count(),0);await noOverflow();await shot('assistant-details-'+width);pass('assistant details and hidden IDs '+width);
  await page.locator('.assistant-dialog').getByRole('button',{name:'تعديل الصلاحيات',exact:true}).click();await page.locator('.admin-permissions-form').waitFor();
  assert.equal(await page.locator('.permission-groups input').count(),21);await noOverflow();await shot('edit-permissions-'+width);
  assert.equal(await page.locator('.permission-groups label').evaluateAll(xs=>xs.every(x=>x.getBoundingClientRect().height>=44)),true);pass('permissions form and touch targets '+width);
 }
 await page.setViewportSize({width:1280,height:900});await open();
 await page.getByRole('button',{name:'إضافة مساعد جديد',exact:true}).click();await page.locator('input[name=contact]').fill('unknown@example.test');await page.getByRole('button',{name:'بحث عن مستخدم',exact:true}).click();
 await page.locator('.assistant-search-results').filter({hasText:'يجب أن يسجل'}).waitFor();pass('missing account does not create Authentication account');
 await page.locator('input[name=contact]').fill('candidate@example.test');await page.getByRole('button',{name:'بحث عن مستخدم',exact:true}).click();
 await page.getByRole('button',{name:'سارة مستخدمة الاختبار — candidate',exact:true}).click();await page.locator('.admin-permissions-form').waitFor();await shot('add-assistant-1280');
 await page.locator('input[value=users_view]').check();await page.locator('textarea[name=reason]').fill('إضافة مساعد بالمحاكاة');await page.getByRole('button',{name:'حفظ صلاحيات المساعد',exact:true}).click();
 await page.waitForFunction(()=>window.__mock.docs.get('adminAccess/candidate')?.role==='admin_assistant');await page.locator('.assistant-dialog').getByRole('button',{name:'تعديل الصلاحيات',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.__mock.docs.get('adminAccess/candidate').permissions),['users_view']);pass('add existing assistant and exact permission grant');
 await page.locator('.assistant-dialog').getByRole('button',{name:'تعديل الصلاحيات',exact:true}).click();await page.locator('input[value=reports_view]').check();await page.locator('textarea[name=reason]').fill('توسيع العرض بالمحاكاة');await page.getByRole('button',{name:'حفظ صلاحيات المساعد',exact:true}).click();
 await page.waitForFunction(()=>window.__mock.docs.get('adminAccess/candidate').permissions.includes('reports_view'));await page.locator('.assistant-dialog').getByRole('button',{name:'إيقاف المساعد',exact:true}).waitFor();pass('edit assistant permissions');
 await page.locator('.assistant-dialog').getByRole('button',{name:'إيقاف المساعد',exact:true}).click();await page.locator('.assistant-dialog').getByRole('button',{name:'إعادة تفعيل المساعد',exact:true}).waitFor();await shot('suspended-assistant-1280');
 assert.equal(await page.evaluate(()=>window.__mock.docs.get('adminAccess/candidate').adminStatus),'suspended');pass('suspend assistant');
 await page.locator('.assistant-dialog').getByRole('button',{name:'إعادة تفعيل المساعد',exact:true}).click();await page.locator('.assistant-dialog').getByRole('button',{name:'إيقاف المساعد',exact:true}).waitFor();pass('reactivate assistant');
 await page.locator('.assistant-dialog').getByRole('button',{name:'إزالة صلاحية مساعد مدير',exact:true}).click();await page.waitForFunction(()=>window.__mock.docs.get('adminAccess/candidate').role==='removed');
 assert.equal(await page.evaluate(()=>window.__mock.docs.get('users/candidate').status),'active');pass('remove admin role preserves normal account');
 const logs=await page.evaluate(()=>[...window.__mock.docs].filter(([k])=>k.startsWith('adminAuditLogs/')).map(([,v])=>v));
 assert.deepEqual(logs.map(x=>x.action),['assistant_created','assistant_permissions_updated','assistant_suspended','assistant_reactivated','assistant_role_removed']);
 assert.ok(logs.every(x=>x.adminUid==='owner'&&x.reason&&x.metadata.oldPermissions&&x.metadata.newPermissions));pass('all five assistant audit events contain actor reason and permission changes');
 await open();await page.evaluate(()=>{for(let i=0;i<12;i++){window.__mock.docs.set('users/extra'+i,{displayName:'اختبار '+i});window.__mock.docs.set('adminAccess/extra'+i,{role:'admin_assistant',adminStatus:'suspended',permissions:[],adminCreatedAt:new Date(2020,0,i+1),createdByAdminUid:'owner'});}});await open();await page.locator('.assistant-card').first().waitFor();assert.equal(await page.locator('.assistant-card').count(),10);await page.getByRole('button',{name:'التالي',exact:true}).click();assert.equal(await page.locator('.assistant-card').count(),3);pass('pagination actual filtered records');await page.getByLabel('ترتيب المساعدين').selectOption('oldest');assert.equal(await page.locator('.assistant-card').first().getAttribute('data-uid'),'extra0');assert.equal(await page.locator('.assistant-email').first().textContent(),'البريد الإلكتروني غير مسجل');pass('oldest sorting and explicit missing email');await page.evaluate(()=>{for(let i=0;i<12;i++){window.__mock.docs.delete('users/extra'+i);window.__mock.docs.delete('adminAccess/extra'+i);}});
 await open();await page.getByRole('button',{name:'تعديل الصلاحيات',exact:true}).click();await page.locator('.admin-permissions-form').waitFor();const writeCount=await page.evaluate(()=>window.__mock.calls.filter(x=>x.kind==='write').length);await page.locator('textarea[name=reason]').fill('محاولة بعد زوال صلاحية المالك');await page.evaluate(()=>{window.__mock.docs.get('adminSecurity/config').superAdminUids=[];});await page.getByRole('button',{name:'حفظ صلاحيات المساعد',exact:true}).click();assert.equal(await page.evaluate(()=>window.__mock.calls.filter(x=>x.kind==='write').length),writeCount);await page.evaluate(()=>{window.__mock.docs.get('adminSecurity/config').superAdminUids=['owner'];});pass('revoked owner cannot write from stale permissions form');
 await page.evaluate(async()=>{window.closeModal();window.__mock.admin=false;await window.__mock.setUser({uid:'helper',email:'helper@example.test',providerData:[{providerId:'password'}]});await window.openAdminPanel();});
 await page.locator('#adminV2Nav').waitFor();assert.equal(await page.locator('#adminV2Nav button').count(),3);assert.equal(await page.getByRole('button',{name:'المساعدون والصلاحيات',exact:true}).count(),0);pass('assistant sees only permitted sections');
 await open();assert.equal(await page.locator('.admin-assistants-grid').count(),0);assert.match(dialogs.at(-1),/غير مصرح/);pass('manual assistant route without permission denied');
 await page.getByRole('button',{name:'المستخدمون',exact:true}).click();await page.locator('#adminRows .admin-row').first().waitFor();await page.locator('#adminFilters input').fill('candidate');await page.locator('#adminRows .admin-actions > button:first-child').click();await page.locator('.admin-detail-card[data-kind=users]').waitFor();
 assert.equal(await page.getByRole('button',{name:'حظر الحساب',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'تعليق الحساب',exact:true}).count(),0);pass('view-only hides suspend and block actions');
 await page.getByRole('button',{name:'البلاغات',exact:true}).click();await page.locator('#adminRows .admin-actions > button:first-child').click();await page.locator('.admin-detail-card[data-kind=reports]').waitFor();assert.equal(await page.getByRole('button',{name:'تحت المراجعة',exact:true}).count(),0);pass('reports view-only has no mutation buttons');
 await page.evaluate(()=>window.__mock.docs.get('adminAccess/helper').permissions.push('reports_manage'));
 await page.getByRole('button',{name:'البلاغات',exact:true}).click();await page.locator('#adminRows .admin-actions > button:first-child').click();await page.getByRole('button',{name:'تحت المراجعة',exact:true}).click();await page.waitForFunction(()=>window.__mock.docs.get('reports/sample').status==='reviewing');pass('manage permission permits report action');
 await page.evaluate(async()=>{window.__mock.docs.get('adminAccess/helper').permissions.push('assistants_view','assistants_create','assistants_edit_permissions','assistants_suspend','assistants_remove_role');});await open();await page.locator('.assistant-card').waitFor();assert.equal(await page.getByRole('button',{name:'إضافة مساعد جديد',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'تعديل الصلاحيات',exact:true}).count(),0);await page.getByRole('button',{name:'تفاصيل المساعد',exact:true}).click();await page.locator('.assistant-dialog').waitFor();assert.equal(await page.locator('.assistant-dialog .admin-assistant-actions').count(),0);assert.equal(await page.locator('.assistant-card').getByText('مالك المنصة — Super Admin',{exact:true}).count(),0);pass('assistant with delegation permissions cannot add or modify self or others through UI');
 await page.evaluate(async()=>{window.closeModal();window.__mock.docs.get('adminAccess/helper').adminStatus='suspended';await window.openAdminPanel();});assert.equal(await page.locator('#modal').isVisible(),false);pass('suspension denies fresh dashboard access');
 await page.evaluate(async()=>{await window.__mock.setUser({uid:'normal',providerData:[{providerId:'password'}]});await window.openAdminPanel();});assert.equal(await page.locator('#modal').isVisible(),false);pass('ordinary user denied dashboard');
 await page.evaluate(async()=>{await window.__mock.setUser(null);await window.openAdminPanel();});assert.equal(await page.locator('#modal').isVisible(),false);pass('guest denied dashboard');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(await page.evaluate(()=>window.__mock.failures),[]);pass('zero JavaScript errors and zero real Firebase traffic');
 console.log(`SUMMARY | ${count}/${count} passed; screenshots ${shots}; all Firebase traffic mocked`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});