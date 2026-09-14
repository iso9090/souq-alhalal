const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/asus/AppData/Local/OpenAI/Codex/runtimes/cua_node/b58ca2eaa616c2da/bin/node_modules/playwright-core');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});let passed=0;
 try{
  const page=await browser.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():(external.push(r.request().url()),r.abort()));
  await page.route('**/melkak/runtime-config.js',r=>r.fulfill({contentType:'text/javascript',body:'export default {mode:"local",datasource:"demo"};'}));
  await page.goto('http://127.0.0.1:8786/');await page.waitForFunction(()=>window.__melkak);
  for(const status of ['suspended','blocked']){
   await page.evaluate(status=>{const m=window.__melkak;m.store.state.users.find(u=>u.uid==='demo-owner').status=status;location.hash='#/add';m.render();},status);
   assert.equal(await page.locator('#wizard-form').count(),0,status+' must not enter create wizard');
   assert.match(await page.locator('#main').innerText(),/غير نشط/);passed++;
  }
  await page.evaluate(()=>{window.__melkak.store.state.users.find(u=>u.uid==='demo-owner').status='active';window.__melkak.render();});
  assert.equal(await page.locator('#wizard-form').count(),1);passed++;
  const matrix=[{}, {hiddenBy:'admin'}, {hiddenBy:'owner',moderationLocked:true},...['rejected','suspended','needs_review','pending'].map(moderationStatus=>({hiddenBy:'owner',moderationStatus})),{hiddenBy:'owner'}];
  for(const [index,patch] of matrix.entries()){
   await page.evaluate(patch=>{const m=window.__melkak,a=m.store.state.listings.find(a=>a.id==='AE-cars');for(const k of ['hiddenBy','moderationStatus','moderationLocked','requiresReview'])delete a[k];Object.assign(a,{status:'hidden'},patch);location.hash='#/manage/AE-cars';m.render();},patch);
   assert.equal(await page.locator('[data-action=transition][data-next=active]').isDisabled(),index!==matrix.length-1);passed++;
  }
  await page.evaluate(()=>{const m=window.__melkak;m.store.state.reports.push({id:'reason-test',listingId:'AE-cars',status:'open',reason:'بلاغ تجريبي'});location.hash='#/admin/reports';});
  await page.locator('#preview-role').selectOption('super_admin');
  await page.locator('[data-action=report-actions][data-id=reason-test]').click();
  assert.equal(await page.locator('#report-action-form').count(),1);await page.locator('#report-action-form select').selectOption('resolve');passed++;
  for(const reason of ['', '   ']){
   await page.locator('#report-action-form textarea').fill(reason);
   await page.locator('#report-action-form').evaluate(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   assert.equal(await page.evaluate(()=>window.__melkak.store.state.reports.find(r=>r.id==='reason-test').status),'open');passed++;
  }
  const reason='  تمت مراجعة البلاغ والتحقق منه  ';
  await page.locator('#report-action-form textarea').fill(reason);await page.locator('#report-action-form [type=submit]').click();
  await page.waitForFunction(()=>window.__melkak.store.state.reports.find(r=>r.id==='reason-test').status==='resolved');const audit=await page.evaluate(()=>window.__melkak.store.state.audit[0]);assert.equal(audit.reason,reason.trim());assert.equal(audit.actorUid,'demo-owner');passed++;
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);passed++;
  console.log('JavaScript critical errors: '+errors.length);console.log(`SUMMARY | ${passed}/${passed} PASS`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
