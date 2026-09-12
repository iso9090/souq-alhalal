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
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
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
   return route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
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
  assert.equal(await page.locator('.admin-metric[data-kind=visits] strong').innerText(),'غير متاح');pass('eight cards; exact aggregate counts; visits unavailable instead of fake zero');
  assert.equal(await page.locator('.admin-chart-values b').evaluateAll(nodes=>nodes.reduce((sum,n)=>sum+Number(n.textContent),0)),11);pass('daily registration chart excludes undated profiles and counts all seven days');
  assert.match(await page.locator('#adminDistribution').innerText(),/75%/);assert.match(await page.locator('#adminDistribution').innerText(),/25%/);pass('donut ratios computed from actual fixture totals');
  assert.match(await page.locator('.admin-recent-event').first().innerText(),/new fixture action/);pass('latest activities sorted by recorded timestamp');
  const colors=await page.locator('.admin-metric').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).getPropertyValue('--accent')));assert.ok(new Set(colors).size>=7);pass('distinct reference card colors');
  for(const [kind,selector] of [['users','#adminRows'],['animals','#adminRows'],['auctions','#adminRows'],['purchaseRequests','#adminRows'],['reports','#adminRows'],['serviceRequests','#adminServiceRequestsList'],['adminAccess','.admin-assistants-grid']]){
   await home();await page.locator(`.admin-metric[data-kind=${kind}]`).click();await page.locator(selector).waitFor();pass('interactive card opens '+kind);
  }
  await home();await page.locator('.admin-metric[data-kind=visits]').click();assert.equal(await page.locator('#adminVisitAvailability').evaluate(n=>n===document.activeElement),true);pass('visits card opens truthful data-availability explanation');
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
  for(const width of [1672,1440,1024,768,430,390,360]){
   await page.setViewportSize({width,height:width>800?1000:900});await home();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.equal(await page.locator('.admin-metric').evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1)),true);
   if(width>1250){const sidebar=await page.locator('.admin-sidebar').boundingBox(),workspace=await page.locator('.admin-workspace').boundingBox();assert.ok(sidebar.x>workspace.x);}
   await page.screenshot({path:path.join(output,'admin-v3-'+width+'.png'),fullPage:true});pass('responsive layout, cards and screenshot '+width);
   if(width===1672){
    await page.locator('.admin-metric[data-kind=users]').hover();await page.screenshot({path:path.join(output,'admin-v3-desktop-hover.png'),fullPage:true});
    await page.locator('.admin-breakdown summary').click();await page.screenshot({path:path.join(output,'admin-v3-desktop-expanded.png'),fullPage:true});
   }
   if(width===390)await page.locator('.admin-sidebar').screenshot({path:path.join(output,'admin-v3-mobile-sidebar.png')});
  }
  await page.evaluate(()=>{window.__mock.failCount='users';window.__mock.failRead='adminAuditLogs';});await home();
  assert.equal(await page.locator('.admin-metric[data-kind=users] strong').innerText(),'غير متاح');assert.match(await page.locator('#adminRegistrations').innerText(),/تعذر/);assert.match(await page.locator('#adminRecent').innerText(),/تعذر/);pass('failed queries show unavailable, never invented zeros/activities');
  await page.evaluate(()=>{const m=window.__mock;m.failCount=null;m.failRead=null;for(const key of [...m.docs.keys()])if(key.startsWith('animals/')||key.startsWith('adminAuditLogs/'))m.docs.delete(key);});await home();
  assert.match(await page.locator('#adminDistribution').innerText(),/لا توجد إعلانات/);assert.match(await page.locator('#adminRecent').innerText(),/لا توجد أنشطة/);pass('true empty states without dummy chart or events');
  assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='write').length),0);pass('dashboard browsing performs zero writes');
  await page.evaluate(async()=>{window.closeModal();const m=window.__mock;m.admin=false;m.docs.set('adminAccess/owner',{role:'admin_assistant',adminStatus:'active',permissions:['dashboard_view']});m.calls.length=0;m.reads.length=0;await window.openAdminPanel();});
  assert.equal(await page.locator('.admin-metric').count(),1);assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='count').length),0);assert.equal(await page.evaluate(()=>window.__mock.reads.includes('adminAuditLogs')),false);pass('restricted assistant never requests protected counts or activities');
  await page.evaluate(async()=>{window.closeModal();window.__mock.docs.delete('adminAccess/owner');await window.openAdminPanel();});assert.equal(await page.locator('.admin-v3').isVisible(),false);pass('ordinary user denied unchanged permission gate');
  assert.deepEqual(errors,[]);pass('zero critical JavaScript errors');console.log(`SUMMARY | ${count}/${count} PASS; Production writes=0; all Firebase traffic mocked`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
