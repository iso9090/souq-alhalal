// Offline full-page acceptance: every HTTP request intercepted, all data are explicit fixtures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installMock,seedMock}=require('./user-seller-fixture.cjs');
const root=path.resolve(__dirname,'..'),output=process.env.QA_OUTPUT||path.join(require('node:os').tmpdir(),'souq-admin-v3');fs.mkdirSync(output,{recursive:true});
const names=[...fs.readFileSync(path.join(root,'app.js'),'utf8').matchAll(/import\s*\{([^}]+)\}/g)].flatMap(m=>m[1].split(',').map(n=>n.trim()));
let count=0;const pass=s=>console.log(`PASS ${++count} | ${s}`);
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1672,height:1000}}),errors=[];
  let dialogCount=0;page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogCount++;d.dismiss();});
  await page.addInitScript(installMock);
  await page.addInitScript(()=>{
   const m=window.__mock,originalGet=m.api.getDocs;
   m.api.getCountFromServer=async ref=>{
    m.calls.push({kind:'count',path:ref.path});
    if(m.failCount===ref.path)throw Error('fixture count unavailable');
    const rows=[...m.docs].filter(([key,data])=>key.startsWith(ref.path+'/')&&key.split('/').length===2&&(ref.filters||[]).filter(Array.isArray).every(([field,op,target])=>{
     const v=data[field];if(op==='==')return v===target;if(op==='>=')return v>=target;if(op==='<')return v<target;if(op==='<=')return v<=target;throw Error('Unimplemented fixture operator');
    }));return {data:()=>({count:rows.length})};
   };
   m.api.getDocs=async ref=>{
    if(ref.path!=='adminAuditLogs')return originalGet(ref);
    m.reads.push(ref.path);
    if(m.failRead===ref.path)throw Error('fixture activity failure');
    const rows=[...m.docs].filter(([k,v])=>k.startsWith('adminAuditLogs/')&&v.timestamp).sort((a,b)=>b[1].timestamp-a[1].timestamp).slice(0,5);
    return {docs:rows.map(([k,v])=>({id:k.split('/')[1],exists:()=>true,data:()=>v})),empty:rows.length===0,size:rows.length};
   };
  });
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='www.gstatic.com')return route.fulfill({contentType:'text/javascript',body:names.map(n=>`export const ${n}=window.__mock.api.${n};`).join('\n')});
   if(url.hostname!=='admin-v3.test')return route.abort();
   const file=path.resolve(root,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf'})[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
  });
  await page.goto('https://admin-v3.test/');await page.waitForFunction(()=>!!window.openAdminPanel);await page.evaluate(seedMock);
  await page.evaluate(async()=>{
   const m=window.__mock;m.admin=true;
   m.docs.set('adminSecurity/config',{enabled:true,superAdminUids:['owner']});m.docs.set('adminAccess/owner',{role:'super_admin',adminStatus:'active'});
   m.docs.set('adminAccess/helper',{role:'admin_assistant',adminStatus:'active',permissions:['dashboard_view']});
   for(let i=0;i<11;i++)m.docs.set('users/chart'+i,{displayName:'Fixture '+i,status:'active',createdAt:new Date(Date.now()-(i%7)*86400000),accountType:'buyer'});
   m.docs.set('adminAuditLogs/old',{action:'old fixture action',timestamp:new Date(Date.now()-50000),adminUid:'owner'});
   m.docs.set('adminAuditLogs/new',{action:'new fixture action',timestamp:new Date(),adminUid:'owner'});
   await m.setUser({uid:'owner',displayName:'Soq Alhalal',providerData:[{providerId:'google.com'}]});m.calls.length=0;
   await window.openAdminPanel();
  });
  const home=()=>page.evaluate(()=>window.openAdminPanel());
  assert.equal(await page.locator('.admin-metric').count(),8);
  assert.equal(await page.locator('.admin-metric[data-kind=users] strong').innerText(),'12');
  assert.equal(await page.locator('.admin-metric[data-kind=adminAccess] strong').innerText(),'1');
  assert.equal(await page.locator('.admin-metric[data-kind=visits] strong').innerText(),'لا توجد بيانات بعد');pass('eight cards; exact aggregate counts; visits unavailable instead of fake zero');
  assert.equal(await page.locator('.admin-chart-values b').evaluateAll(nodes=>nodes.reduce((sum,n)=>sum+Number(n.textContent),0)),11);pass('daily registration chart excludes undated profiles and counts all seven days');
  assert.match(await page.locator('#adminDistribution').innerText(),/75%/);assert.match(await page.locator('#adminDistribution').innerText(),/25%/);pass('donut ratios computed from actual fixture totals');
  assert.match(await page.locator('.admin-recent-event').first().innerText(),/new fixture action/);pass('latest activities sorted by recorded timestamp');
  const colors=await page.locator('.admin-metric').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).getPropertyValue('--accent')));assert.ok(new Set(colors).size>=7);pass('distinct reference card colors');
  for(const [kind,selector] of [['users','#adminRows'],['animals','#adminRows'],['auctions','#adminRows'],['purchaseRequests','#adminRows'],['reports','#adminRows'],['serviceRequests','#adminServiceRequestsList'],['adminAccess','.admin-assistants-grid']]){
   await home();await page.locator(`.admin-metric[data-kind=${kind}]`).click();await page.locator(selector).waitFor();pass('interactive card opens '+kind);
  }
  await home();await page.locator('.admin-metric[data-kind=visits]').click();await page.locator('.commercial-admin').waitFor();assert.match(await page.locator('.commercial-admin').innerText(),/لا توجد بيانات بعد/);pass('visits card opens truthful data-availability explanation');
  for(const kind of ['users','animals','auctions','purchaseRequests','reports','serviceRequests']){
   for(const key of ['Enter','Space']){
    await home();const card=page.locator(`.admin-metric[data-kind=${kind}]`);await card.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
    assert.equal(await card.evaluate(n=>n.matches(':focus-visible')&&getComputedStyle(n).outlineStyle!=='none'),true);
    await card.press(key);await page.locator(kind==='serviceRequests'?'#adminServiceRequestsList':'#adminRows').waitFor();pass(kind+' keyboard '+key+' and visible focus');
   }
   await home();await page.locator(`.admin-metric[data-kind=${kind}]`).click({position:{x:8,y:8}});await page.locator(kind==='serviceRequests'?'#adminServiceRequestsList':'#adminRows').waitFor();pass(kind+' whole-card corner click');
  }
  await home();
  await page.locator('.admin-breakdown summary').click();await page.getByRole('button',{name:'عرض المستخدمون · نشط',exact:true}).click();await page.locator('#adminRows').waitFor();assert.equal(await page.getByRole('combobox',{name:'الحالة',exact:true}).inputValue(),'active');pass('breakdown card applies the real server filter');
  for(const [width,height] of [[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[430,932],[390,844],[360,800]]){
   await page.setViewportSize({width,height});await home();await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.evaluate(()=>document.fonts.check('500 16px "Noto Sans Arabic"')),true);
   const heights=await page.locator('.admin-metric').evaluateAll(nodes=>nodes.map(n=>Math.round(n.getBoundingClientRect().height)));assert.equal(new Set(heights).size,1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.equal(await page.locator('.admin-metric').evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1)),true);
   if(width>1250){const sidebar=await page.locator('.admin-sidebar').boundingBox(),workspace=await page.locator('.admin-workspace').boundingBox();assert.ok(sidebar.x>workspace.x);}
   await page.screenshot({path:path.join(output,'admin-v3-'+width+'.png'),fullPage:true});pass('responsive layout, cards and screenshot '+width);
   if(width===1440){
    await page.locator('.admin-metric[data-kind=users]').hover();await page.screenshot({path:path.join(output,'admin-v3-desktop-hover.png'),fullPage:true});
    await page.locator('.admin-breakdown summary').click();await page.screenshot({path:path.join(output,'admin-v3-desktop-expanded.png'),fullPage:true});
   }
   if(width<=800){
    assert.equal(await page.locator('.admin-sidebar').isVisible(),false);
    await page.locator('.admin-menu-toggle').click();assert.equal(await page.locator('.admin-sidebar').getAttribute('aria-modal'),'true');
    await page.locator('.admin-sidebar').evaluate(n=>Promise.all(n.getAnimations().map(a=>a.finished)));await page.locator('#adminLogout button').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('.admin-drawer-close').evaluate(n=>n===document.activeElement),true,await page.evaluate(()=>document.activeElement.outerHTML));
    await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#adminLogout button').evaluate(n=>n===document.activeElement),true);
    if(width===390){await page.locator('.admin-drawer-close').focus();await page.locator('.admin-sidebar').evaluate(n=>n.scrollTop=0);await page.screenshot({path:path.join(output,'admin-v3-mobile-sidebar.png')});}
    await page.keyboard.press('Escape');await page.locator('.admin-sidebar').waitFor({state:'hidden'});assert.equal(await page.locator('.admin-menu-toggle').evaluate(n=>n===document.activeElement),true);assert.equal(await page.locator('.admin-sidebar').isVisible(),false);
    await page.locator('.admin-menu-toggle').click();await page.locator('#adminV2Nav button[aria-label="المستخدمون"]').click();await page.locator('#adminRows').waitFor();assert.equal(await page.locator('.admin-sidebar').isVisible(),false);pass('mobile drawer focus trap, Escape restoration and authorized navigation '+width);
   }
  }
  await page.evaluate(()=>{window.__mock.failCount='users';window.__mock.failRead='adminAuditLogs';});await home();
  assert.equal(await page.locator('.admin-metric[data-kind=users] strong').innerText(),'غير متاح');assert.match(await page.locator('#adminRegistrations').innerText(),/تعذر/);assert.match(await page.locator('#adminRecent').innerText(),/تعذر/);pass('failed queries show unavailable, never invented zeros/activities');
  await page.evaluate(()=>{const m=window.__mock;m.failCount=null;m.failRead=null;for(const key of [...m.docs.keys()])if(key.startsWith('animals/')||key.startsWith('adminAuditLogs/'))m.docs.delete(key);});await home();
  assert.match(await page.locator('#adminDistribution').innerText(),/لا توجد إعلانات/);assert.match(await page.locator('#adminRecent').innerText(),/لا توجد أنشطة/);pass('true empty states without dummy chart or events');
  assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='write').length),0);pass('dashboard browsing performs zero writes');
  await page.evaluate(async()=>{window.closeModal();const m=window.__mock;m.admin=false;m.docs.set('adminAccess/owner',{role:'admin_assistant',adminStatus:'active',permissions:['dashboard_view']});m.calls.length=0;m.reads.length=0;await window.openAdminPanel();});
  assert.equal(await page.locator('.admin-metric').count(),1);assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='count').length),0);assert.equal(await page.evaluate(()=>window.__mock.reads.includes('adminAuditLogs')),false);pass('restricted assistant never requests protected counts or activities');
  await page.evaluate(async()=>{window.closeModal();window.__mock.docs.delete('adminAccess/owner');await window.openAdminPanel();});assert.equal(await page.locator('.admin-v3').isVisible(),false);pass('ordinary user denied unchanged permission gate');
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(async()=>{
   const m=window.__mock;for(const k of [...m.docs.keys()])if(k.startsWith('users/')||k.startsWith('adminAccess/'))m.docs.delete(k);
   const uid='C5mqgum1y5Q74mvFalahi2G5qgz2';m.admin=true;
   m.docs.set('adminSecurity/config',{enabled:true,superAdminUids:[uid,'z-phone-owner']});
   m.docs.set('users/'+uid,{displayName:'Soq Alhalal',email:'soqalhalal9@gmail.com',accountType:'buyer',status:'active'});
   m.docs.set('users/z-phone-owner',{displayName:'المالك المرتبط بالهاتف — اختبار',accountType:'seller',status:'active'});
   for(const id of [uid,'z-phone-owner'])m.docs.set('adminAccess/'+id,{role:'super_admin',adminStatus:'active'});
   for(let i=0;i<55;i++)m.docs.set('users/n'+String(i).padStart(2,'0'),{displayName:'مستخدم اختبار '+i,accountType:'buyer',status:'active'});
   m.docs.set('users/z-helper',{displayName:'مساعد اختبار',accountType:'seller',status:'active'});m.docs.set('adminAccess/z-helper',{role:'admin_assistant',adminStatus:'active',permissions:['users_view']});
   m.docs.set('users/n00',{displayName:'نفس البريد ليس مالكًا',email:'soqalhalal9@gmail.com',accountType:'buyer',status:'active',admin:true,role:'super_admin'});
   await m.setUser({uid,displayName:'Soq Alhalal',providerData:[{providerId:'google.com'}]});m.calls.length=0;await window.openAdminPanel();
  });
  await page.locator('.admin-metric[data-kind=users]').click();
  const filterRole=async role=>{await page.getByRole('combobox',{name:'الصلاحية الإدارية',exact:true}).selectOption(role);};
  await filterRole('super_admin');await page.waitForFunction(()=>document.querySelectorAll('#adminRows .admin-role-badge[data-admin-role=super_admin]').length===2);
  assert.equal(await page.locator('#adminRows .admin-row').count(),2);assert.match(await page.locator('#adminRows').innerText(),/Soq Alhalal/);pass('Super Admin filter spans pages, finds both UID-registered owners only');
  const shotNote=await page.evaluate(()=>{const n=document.createElement('p');n.id='roleScreenshotNote';n.textContent='معاينة محلية — بيانات اختبار معزولة؛ لا كتابة إلى Production';document.querySelector('#adminFilters').before(n);return n.id;});
  await page.screenshot({path:path.join(output,'users-owner-role.png'),fullPage:true});await page.locator('#'+shotNote).evaluate(n=>n.remove());
  for(let i=0;i<2;i++){
   await page.locator('#adminRows .admin-actions button').nth(i).click();await page.locator('.admin-detail-card .admin-role-badge').waitFor();
   for(const name of ['تعليق الحساب','حظر الحساب','طلب حذف الحساب','إعادة التفعيل'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
   await page.locator('.admin-back').click();
  }pass('both owners have badges and no suspend/block/delete/reactivate controls');
  await filterRole('admin_assistant');await page.waitForFunction(()=>document.querySelectorAll('#adminRows .admin-role-badge[data-admin-role=admin_assistant]').length===1);assert.equal(await page.locator('#adminRows .admin-row').count(),1);pass('assistant filter finds actual adminAccess assistant beyond first page');
  await page.getByRole('combobox',{name:'نوع الحساب',exact:true}).selectOption('buyer');await page.waitForFunction(()=>document.querySelector('#adminRows')?.textContent==='لا توجد نتائج.');
  assert.equal(await page.getByRole('combobox',{name:'الصلاحية الإدارية',exact:true}).inputValue(),'admin_assistant');pass('accountType is independent and intersects administrative role');
  await page.getByRole('combobox',{name:'نوع الحساب',exact:true}).selectOption('');await filterRole('normal');await page.waitForFunction(()=>document.querySelectorAll('#adminRows .admin-role-badge[data-admin-role=normal]').length===50);
  assert.match(await page.locator('#adminRows').innerText(),/نفس البريد ليس مالكًا/);assert.equal(await page.locator('#adminRows [data-admin-role=super_admin]').count(),0);
  await page.getByRole('button',{name:'الصفحة التالية',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#adminRows .admin-role-badge[data-admin-role=normal]').length===5);pass('normal filter ignores email/profile role spoofing and paginates without gaps');
  await page.getByRole('button',{name:'الصفحة الأولى',exact:true}).click();await page.locator('#adminRows .admin-actions button').first().click();await page.getByRole('button',{name:'حظر الحساب',exact:true}).waitFor();
  await page.evaluate(()=>window.__mock.docs.get('adminSecurity/config').superAdminUids.push('n00'));
  const priorDialogs=dialogCount;await page.getByRole('button',{name:'حظر الحساب',exact:true}).click();assert.equal(dialogCount,priorDialogs);assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='write').length),0);pass('stale normal-user action rechecks registry and refuses newly protected owner');
  await page.locator('.admin-back').click();await page.evaluate(()=>window.__mock.failRead='adminAccess/n01');await filterRole('normal');await page.waitForFunction(()=>document.querySelectorAll('#adminRows .admin-role-badge[data-admin-role=normal]').length===50);assert.doesNotMatch(await page.locator('#adminRows').innerText(),/مستخدم اختبار 1\n/);pass('unreadable administrative record is not classified as normal');
  assert.deepEqual(errors,[]);pass('zero critical JavaScript errors');console.log(`SUMMARY | ${count}/${count} PASS; Production writes=0; all Firebase traffic mocked`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
