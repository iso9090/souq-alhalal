// OAuth state simulations only: every network request is intercepted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installMock}=require('./user-seller-fixture.cjs');
const root=path.resolve(__dirname,'..');
const names=[...fs.readFileSync(path.join(root,'app.js'),'utf8').matchAll(/import\s*\{([^}]+)\}/g)].flatMap(m=>m[1].split(',').map(s=>s.trim()));
let count=0;const pass=name=>{count++;console.log('PASS | '+name);};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage(),errors=[],foreign=[],dialogs=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
  await page.addInitScript(installMock);
  await page.addInitScript(()=>{
   const m=window.__mock;const profile={uid:'owner',displayName:'Existing owner',accountType:'both',status:'active',marker:'preserve'};
   const observe=m.api.onAuthStateChanged;let observed=0;m.pendingAuth=0;
   m.api.onAuthStateChanged=(auth,callback)=>observe(auth,async user=>{m.pendingAuth++;try{if(++observed===2)await new Promise(r=>setTimeout(r,40));return await callback(user);}finally{m.pendingAuth--;}});
   m.docs.set('users/owner',profile);
   m.makeUser=id=>({uid:'owner',email:'owner@example.test',providerData:[{providerId:id}],getIdToken:async()=>'mock-token'});
   for(const [name,id]of [['GoogleAuthProvider','google.com'],['FacebookAuthProvider','facebook.com'],['TwitterAuthProvider','twitter.com']])m.api[name]=class{constructor(){this.providerId=id;}};
   m.api.signInWithPopup=async(a,p)=>{m.calls.push({kind:'popup',provider:p.providerId});if(m.error)throw{code:m.error};const user=m.makeUser(p.providerId);await m.setUser(user);return {user};};
   m.api.signInWithRedirect=async(a,p)=>{m.calls.push({kind:'redirect',provider:p.providerId});if(m.redirectError)throw{code:m.redirectError};};
   m.api.getRedirectResult=async()=>{m.calls.push({kind:'redirectResult'});const f=JSON.parse(sessionStorage.getItem('testRedirect')||'{}');if(f.error)throw{code:f.error};if(!f.success)return null;if(f.status)m.docs.get('users/owner').status=f.status;const user=m.makeUser(f.id||'google.com');await m.setUser(user);return {user};};
  });
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='www.gstatic.com')return route.fulfill({contentType:'text/javascript',body:names.map(n=>`export const ${n}=window.__mock.api.${n};`).join('\n')});
   if(url.hostname!=='live.test'){foreign.push(url.origin);return route.abort();}
   const file=path.resolve(root,decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.slice(1)));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   await route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
  });
  await page.goto('https://live.test/');await page.waitForFunction(()=>!!window.socialLogin);
  const open=async()=>page.evaluate(async()=>{await window.__mock.setUser(null);window.__mock.error=null;window.__mock.redirectError=null;window.openEmailAuth();window.__mock.calls.length=0;});
  const login=async provider=>page.evaluate(provider=>window.socialLogin(provider),provider);
  for(const provider of ['Google','Facebook','X']){
   await open();await login(provider);
   assert.deepEqual(await page.evaluate(()=>{const m=window.__mock,d=m.docs.get('users/owner');return [m.api.getAuth().currentUser.uid,[...m.docs.keys()].filter(k=>k.startsWith('users/')).length,d.displayName,d.accountType,d.marker];}),['owner',1,'Existing owner','both','preserve']);
   pass(provider+' configured simulation preserves UID and existing profile');
   for(const [code,expected]of [['auth/operation-not-allowed',/غير متاح/],['auth/network-request-failed',/الشبكة/],['auth/user-disabled',/موقوف/],['auth/account-exists-with-different-credential',/الطريقة الأصلية/],['auth/popup-closed-by-user',/إلغاء/],['auth/cancelled-popup-request',/إلغاء/]]){
    await open();await page.evaluate(code=>window.__mock.error=code,code);await login(provider);
    assert.match(await page.locator('#emailAuthStatus').innerText(),expected);
    assert.equal(await page.evaluate(()=>window.__mock.api.getAuth().currentUser),null);
    assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='write'||c.kind==='signup').length),0);
    assert.equal(await page.locator('.v2-social button:disabled').count(),0);
    pass(provider+' '+code+' graceful recovery with zero profile writes');
   }
  }
  for(const status of ['blocked','suspended']){
   await open();await page.evaluate(status=>{window.__mock.docs.get('users/owner').status=status;window.__mock.admin=true;},status);await login('Google');
   assert.match(await page.locator('#emailAuthStatus').innerText(),/موقوف/);
   assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='write').length),0);
   assert.equal(await page.locator('#adminPanelButton').isVisible(),false);
   assert.equal(await page.evaluate(()=>window.__mock.docs.get('users/owner').status),status);
   pass(status+' application account stays restricted with no profile mutation');
  }
  await page.evaluate(()=>{window.__mock.docs.get('users/owner').status='active';window.__mock.admin=false;});
  await open();await page.evaluate(()=>window.__mock.error='auth/popup-blocked');await login('X');
  assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='redirect').length),0);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('souqSocialRedirect')),null);pass('cross-origin blocked popup never initiates unsupported redirect');
  await open();await page.evaluate(()=>{window.__mock.error='auth/popup-blocked';window.__mock.redirectError='auth/network-request-failed';});await login('Google');
  assert.match(await page.locator('#emailAuthStatus').innerText(),/حظر المتصفح/);assert.equal(await page.evaluate(()=>sessionStorage.getItem('souqSocialRedirect')),null);pass('blocked popup explains browser setting and restores controls');
  for(const [provider,id]of [['Google','google.com'],['Facebook','facebook.com'],['X','twitter.com']]){
   await page.evaluate(({provider,id})=>{sessionStorage.setItem('souqSocialRedirect',provider);sessionStorage.setItem('testRedirect',JSON.stringify({success:true,id}));},{provider,id});await page.reload();
   await page.waitForFunction(()=>window.__mock?.api.getAuth().currentUser?.uid==='owner'&&!sessionStorage.getItem('souqSocialRedirect'));
   assert.equal(await page.evaluate(()=>[...window.__mock.docs.keys()].filter(k=>k.startsWith('users/')).length),1);pass(provider+' redirect result restores the same UID once');
  }
  for(const fixture of [{},{error:'auth/network-request-failed'},{error:'auth/user-disabled'},{success:true,status:'blocked'}]){
   await page.evaluate(f=>{sessionStorage.setItem('souqSocialRedirect','Google');sessionStorage.setItem('testRedirect',JSON.stringify(f));},fixture);await page.reload();
   await page.waitForFunction(()=>window.__mock.pendingAuth===0&&!sessionStorage.getItem('souqSocialRedirect')&&!!document.getElementById('emailAuthStatus')?.textContent);
   assert.match(await page.locator('#emailAuthStatus').innerText(),fixture.error==='auth/network-request-failed'?/الشبكة/:fixture.error||fixture.status?/موقوف/:/لم يكتمل/);
   pass('redirect recovery '+(fixture.error||fixture.status||'empty result'));
  }
  await page.evaluate(()=>{sessionStorage.removeItem('testRedirect');sessionStorage.removeItem('souqSocialRedirect');});await page.reload();
  await page.waitForFunction(()=>!!window.socialLogin);
  assert.equal(await page.evaluate(()=>window.__mock.calls.some(c=>c.kind==='redirectResult')),false);pass('normal page load does not consume an unrelated redirect');
  const photo=fs.readFileSync(path.join(root,'hero-livestock.png')).toString('base64');
  const choose=async names=>page.evaluate(({photo,names})=>{const dt=new DataTransfer();for(const name of names)dt.items.add(new File([Uint8Array.from(atob(photo),c=>c.charCodeAt(0))],name,{type:'image/png'}));const input=document.getElementById('animalImages');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));},{photo,names});
  await choose(['first.png','renamed.png']);await page.waitForFunction(()=>!document.getElementById('animalImages').disabled);
  assert.equal(await page.locator('#imageCounter').innerText(),'0/3');assert.ok(dialogs.some(s=>/مكررة/.test(s)));pass('same photo with different filename rejected atomically');
  await choose(['first.png']);await page.waitForFunction(()=>document.getElementById('imageCounter').textContent==='1/3');
  await choose(['again.png']);await page.waitForFunction(()=>!document.getElementById('animalImages').disabled);
  assert.equal(await page.locator('#imageCounter').innerText(),'1/3');pass('duplicate of previously selected photo rejected');
  const uploading=await page.evaluate(async photo=>{const {uploadImages}=await import('./image-provider.js');const f=new File([Uint8Array.from(atob(photo),c=>c.charCodeAt(0))],'x.png',{type:'image/png'});try{await uploadImages([f,f],{getIdToken:async()=>'unused'});}catch(e){return e.message;}},photo);
  assert.equal(uploading,'DUPLICATE_IMAGE');pass('upload entry point rejects duplicate bytes before remote requests');
  assert.deepEqual(errors,[]);assert.deepEqual(foreign,[]);pass('zero uncaught browser errors and zero live network');
  console.log(`SUMMARY | ${count}/${count} passed`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
