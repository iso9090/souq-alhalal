// Deliberately isolated OAuth simulations. These do not certify real Google OAuth.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installMock,seedMock}=require('./user-seller-fixture.cjs');
const root=path.resolve(__dirname,'..');
const output=process.env.QA_OUTPUT||path.join(require('node:os').tmpdir(),'souq-google-v3');
fs.mkdirSync(output,{recursive:true});
const names=[...fs.readFileSync(path.join(root,'app.js'),'utf8').matchAll(/import\s*\{([^}]+)\}/g)].flatMap(m=>m[1].split(',').map(s=>s.trim()));
let count=0;const pass=name=>{count++;console.log('PASS | '+name);};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],foreign=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  page.on('response',r=>{if(r.status()===404)missing.push(r.url());});
  await page.addInitScript(installMock);
  await page.addInitScript(()=>{
   const m=window.__mock;
   m.uid='google-new';m.provider='google.com';
   m.api.GoogleAuthProvider=class{};
   m.api.signInWithPopup=async()=>{
    m.calls.push({kind:'google-popup'});
    await new Promise(resolve=>setTimeout(resolve,100));
    if(m.error)throw{code:m.error};
    const user={uid:m.uid,email:m.uid+'@example.test',displayName:'مستخدم Google',phoneNumber:null,providerData:[{providerId:m.provider}],getIdToken:async()=>'isolated-mock'};
    await m.setUser(user);return{user};
   };
   m.api.signInWithRedirect=async()=>{m.calls.push({kind:'google-redirect'});if(m.redirectError)throw{code:m.redirectError};};
   m.api.getRedirectResult=async()=>null;
  });
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='www.gstatic.com')return route.fulfill({contentType:'text/javascript',body:names.map(n=>`export const ${n}=window.__mock.api.${n};`).join('\n')});
   if(url.hostname==='res.cloudinary.com')return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'hero-livestock.png'))});
   if(!['v3.test','souq-al-halal-9e3e8.firebaseapp.com'].includes(url.hostname)){foreign.push(url.origin);return route.abort();}
   const file=path.resolve(root,decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.slice(1)));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
  });
  await page.goto('https://v3.test/');await page.waitForFunction(()=>!!window.socialLogin);
  await page.evaluate(()=>window.selectMarketCountry('AE'));
  const open=()=>page.evaluate(async()=>{await window.__mock.setUser(null);window.__mock.error=null;window.__mock.admin=false;window.openEmailAuth();window.__mock.calls.length=0;});
  await open();
  await page.getByRole('button',{name:'الدخول برقم الهاتف',exact:true}).click();
  assert.equal(await page.locator('#phoneNumber').inputValue(),'+971');
  await page.locator('#phoneNumber').fill('0501234567');await page.getByRole('button',{name:'إرسال رمز التحقق',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='phone').length),1);
  assert.match(await page.locator('#loginStatus').innerText(),/البريد/);pass('phone backup opens existing flow and retains billing-error email recovery');
  await open();
  await page.evaluate(()=>{void window.socialLogin('Google');void window.socialLogin('Google');});
  assert.equal(await page.locator('.email-auth').getAttribute('aria-busy'),'true');
  assert.equal(await page.locator('.google-sign-in').isDisabled(),true);
  await page.waitForFunction(()=>window.__mock.docs.has('users/google-new')&&document.querySelector('#profileName'));
  const created=await page.evaluate(()=>window.__mock.docs.get('users/google-new'));
  assert.equal(created.displayName,'مستخدم Google');assert.equal(created.email,'google-new@example.test');
  assert.equal(created.phone,'');assert.equal(created.accountType,'buyer');assert.equal(created.status,'active');assert.equal(created.authProvider,'google');assert.ok(created.createdAt);assert.ok(created.lastLoginAt);
  assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='google-popup').length),1);
  assert.equal(await page.locator('#adminPanelButton').isVisible(),false);pass('Google new buyer profile, loading, duplicate-click prevention and no admin access');
  await page.evaluate(async()=>{await window.logoutUser();window.openEmailAuth();});
  await page.getByRole('button',{name:'الدخول باستخدام Google',exact:true}).click();
  await page.waitForFunction(()=>!!document.querySelector('#profileName'));
  assert.equal(await page.evaluate(()=>[...window.__mock.docs.keys()].filter(k=>k==='users/google-new').length),1);
  assert.deepEqual((await page.evaluate(()=>window.__mock.docs.get('users/google-new'))).createdAt,created.createdAt);pass('logout and re-login preserve one UID document and creation timestamp');
  await open();await page.evaluate(()=>{window.__mock.docs.set('users/google-new',{...window.__mock.docs.get('users/google-new'),displayName:'الاسم المحفوظ',accountType:'seller',phone:'saved',email:'saved@example.test',authProvider:'phone',marker:'keep'});});
  await page.evaluate(()=>window.socialLogin('Google'));
  const existing=await page.evaluate(()=>window.__mock.docs.get('users/google-new'));
  assert.deepEqual([existing.displayName,existing.accountType,existing.phone,existing.email,existing.authProvider,existing.marker],['الاسم المحفوظ','seller','saved','saved@example.test','phone','keep']);
  const keys=await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='write'&&c.path==='users/google-new').flatMap(c=>Object.keys(c.data)));
  assert.ok(keys.every(key=>key==='lastLoginAt'));pass('existing profile updates lastLoginAt only');
  for(const [code,expected]of [['auth/popup-closed-by-user',/إلغاء/],['auth/popup-blocked',/حظر المتصفح/],['auth/account-exists-with-different-credential',/الطريقة الأصلية/],['auth/user-disabled',/موقوف/],['auth/network-request-failed',/الشبكة/]]){
   await open();await page.evaluate(code=>window.__mock.error=code,code);await page.evaluate(()=>window.socialLogin('Google'));
   assert.match(await page.locator('#emailAuthStatus').innerText(),expected);
   assert.equal(await page.locator('.google-sign-in').isDisabled(),false);
   assert.equal(await page.evaluate(()=>window.__mock.calls.some(c=>c.kind==='write'||c.kind==='google-redirect')),false);pass(code+' restores controls without writes or cross-origin redirect');
  }
  for(const status of ['suspended','blocked']){
   await open();await page.evaluate(status=>{window.__mock.docs.get('users/google-new').status=status;window.__mock.admin=true;},status);
   await page.evaluate(()=>window.socialLogin('Google'));
   assert.match(await page.locator('#emailAuthStatus').innerText(),/موقوف/);assert.equal(await page.locator('#adminPanelButton').isVisible(),false);
   assert.equal(await page.evaluate(()=>window.__mock.calls.some(c=>c.kind==='write')),false);pass(status+' Google profile stays restricted without mutations');
  }
  await page.evaluate(seedMock);
  await page.evaluate(async()=>{
   const m=window.__mock;m.uid='owner';m.error=null;m.admin=true;
   m.docs.set('adminSecurity/config',{enabled:true,superAdminUids:['owner']});
   m.docs.set('adminAccess/owner',{role:'super_admin',adminStatus:'active'});
   for(const [key,a]of m.docs)if(key.startsWith('animals/'))a.images=['https://res.cloudinary.com/demo/image/upload/v3/fixture.jpg'];
   await m.setUser(null);await window.socialLogin('Google');
  });
  assert.equal(await page.locator('#adminPanelButton').isVisible(),true);
  for(const section of ['home','users','animals','auctions','reports','services','assistants','adminAuditLogs']){
   await page.evaluate(section=>window.openAdminSection(section),section);
   assert.equal(await page.locator('.admin-v2').isVisible(),true);pass('registered Google admin opens '+section+' (isolated fixture)');
  }
  for(const [width,height]of [[1440,900],[1280,800],[430,932],[390,844],[360,800]]){
   const suffix=width+'x'+height;await page.setViewportSize({width,height});
   await page.evaluate(async()=>{window.closeModal();window.__mock.admin=false;await window.__mock.setUser(null);await window.selectMarketCountry('AE');window.selectMarketTab('direct',false);scrollTo({top:0,behavior:'instant'});});
   await page.waitForFunction(()=>document.querySelectorAll('#direct-sales .v2-card').length===2);
   await page.screenshot({path:path.join(output,'home-'+suffix+'.png')});
   await page.screenshot({path:path.join(output,'home-full-'+suffix+'.png'),fullPage:true});
   const structure=await page.evaluate(()=>{
    const y=id=>document.getElementById(id).getBoundingClientRect().top;
    return y('home')<y('firebase-market')&&y('firebase-market')<y('how-it-works');
   });assert.equal(structure,true,'approved hero-market-benefits order');
   assert.equal(await page.getByRole('link',{name:'ابدأ الآن',exact:false}).count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
   for(const id of ['marketSearch','marketRegionFilter','marketCityFilter','marketAnimalFilter'])assert.equal(await page.locator('#'+id).isEnabled(),true);
   await page.locator('#firebase-market').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(output,'market-'+suffix+'.png')});
   await page.locator('#direct-sales').screenshot({path:path.join(output,'market-cards-'+suffix+'.png')});
   if(width>=1280){
    await page.evaluate(()=>window.openListingDetails('direct',''));await page.locator('.ux-gallery').waitFor();
    await page.screenshot({path:path.join(output,'direct-sale-'+suffix+'.png')});await page.evaluate(()=>window.closeModal());
    await page.evaluate(()=>window.selectMarketTab('auction',false));
    assert.equal(await page.locator('.v2-auction .v2-badge').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(227, 40, 58)');
    assert.equal(await page.locator('.v2-auction .v2-countdown').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 226, 229)');
    await page.locator('#auction-list').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,'auctions-'+suffix+'.png')});
   }
   await page.evaluate(()=>{scrollTo({top:0,behavior:'instant'});window.openEmailAuth();});
   await page.waitForFunction(()=>scrollY===0&&document.querySelector('.auth-logo').getBoundingClientRect().top>=0);
   assert.equal(await page.locator('#modal .box').evaluate(box=>box.scrollTop),0);
   await page.screenshot({path:path.join(output,'login-'+suffix+'.png')});
   const googleBox=await page.locator('.google-sign-in').boundingBox();assert.ok(googleBox.y>=0&&googleBox.y+googleBox.height<=height);
   assert.equal(await page.evaluate(()=>document.querySelector('.email-auth').scrollWidth>document.querySelector('.email-auth').clientWidth),false);
   assert.equal(await page.locator('#authPassword').getAttribute('type'),'password');await page.locator('.password-toggle').click();assert.equal(await page.locator('#authPassword').getAttribute('type'),'text');
   await page.evaluate(async()=>{window.__mock.admin=true;window.__mock.uid='owner';window.__mock.error=null;await window.socialLogin('Google');await window.openAdminPanel();});
   await page.screenshot({path:path.join(output,'admin-dashboard-'+suffix+'.png')});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   pass('home market login and admin RTL without overflow '+suffix);
  }
  for(const name of ['hero-livestock.png','logo-souq-alhalal.png','concept.png','google-g.png']){
   const loaded=await page.evaluate(async name=>{const img=new Image();img.src=name;await img.decode();return img.naturalWidth>0&&img.naturalHeight>0;},name);assert.equal(loaded,true);pass(name+' decodes locally without 404');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(foreign,[]);assert.deepEqual(missing,[]);pass('zero critical JavaScript errors, broken asset requests or live network');
  // Same-origin fallback is simulated too; every request is still intercepted.
  await page.goto('https://souq-al-halal-9e3e8.firebaseapp.com/');await page.waitForFunction(()=>!!window.socialLogin);
  await open();await page.evaluate(()=>{window.__mock.error='auth/popup-blocked';});await page.evaluate(()=>window.socialLogin('Google'));
  assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='google-redirect').length),1);pass('same-origin helper permits blocked-popup redirect');
  await open();await page.evaluate(()=>{window.__mock.error='auth/popup-blocked';window.__mock.redirectError='auth/network-request-failed';});await page.evaluate(()=>window.socialLogin('Google'));
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('souqSocialRedirect')),null);assert.match(await page.locator('#emailAuthStatus').innerText(),/الشبكة/);pass('same-origin redirect error cleans marker');
  console.log(`SUMMARY | ${count}/${count} passed`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
