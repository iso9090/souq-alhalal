const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installMock,seedMock}=require('./user-seller-fixture.cjs');
const root=path.resolve(__dirname,'..'),output=process.env.QA_OUTPUT||path.join(require('node:os').tmpdir(),'souq-market-v2');fs.mkdirSync(output,{recursive:true});
const names=[...fs.readFileSync(path.join(root,'app.js'),'utf8').matchAll(/import\s*\{([^}]+)\}/g)].flatMap(m=>m[1].split(',').map(s=>s.trim()));
let count=0;const pass=name=>{console.log('PASS | '+name);count++;};
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],foreign=[],dialogs=[],uploads=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.accept(d.type()==='prompt'?'1600':undefined);});
await page.addInitScript(installMock);
await page.addInitScript(()=>{
  const m=window.__mock;
  for(const name of ['GoogleAuthProvider','FacebookAuthProvider','TwitterAuthProvider'])m.api[name]=class{constructor(){this.name=name;}};
  const result=async(a,provider)=>{
    m.calls.push({kind:'social',provider:provider.name});if(m.popupBlocked)throw {code:'auth/popup-blocked'};if(m.socialError)throw {code:m.socialError};
    const user={uid:'owner',email:'owner@example.test',getIdToken:async()=>'mock-id-token',providerData:[{providerId:'google.com'}]};await m.setUser(user);return {user};
  };
  m.api.signInWithPopup=result;
  m.api.signInWithRedirect=async(a,p)=>{m.calls.push({kind:'redirect',provider:p.name});if(m.socialError)throw{code:m.socialError};};
  m.api.getRedirectResult=async()=>{if(m.socialError)throw{code:m.socialError};return null;};
});
await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='www.gstatic.com')return route.fulfill({contentType:'text/javascript',body:names.map(n=>`export const ${n}=window.__mock.api.${n};`).join('\n')});
  if(url.hostname==='v2.test'&&url.pathname==='/sign'){
    assert.equal(route.request().headers().authorization,'Bearer mock-id-token');
    const body=route.request().postDataJSON();assert.ok(body.bytes<=307200);assert.equal(body.contentType,'image/jpeg');uploads.push(body);
    return route.fulfill({json:{cloudName:'demo',apiKey:'public-test-key',signature:'mock-signature',params:{timestamp:123,public_id:'test/photo',overwrite:false}}});
  }
  if(url.hostname==='api.cloudinary.com'){
    assert.ok(route.request().postDataBuffer().length<330000);assert.ok(route.request().postDataBuffer().includes(Buffer.from('mock-signature')));
    return route.fulfill({json:{secure_url:'https://res.cloudinary.com/demo/image/upload/v1/test/photo.jpg'}});
  }
  if(url.hostname==='res.cloudinary.com')return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'hero-livestock.png'))});
  if(url.hostname!=='v2.test'){foreign.push(url.origin);return route.abort();}
  const file=path.join(root,decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.slice(1)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
  return route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
});
await page.goto('https://v2.test/');await page.evaluate(seedMock);
await page.evaluate(async()=>{
  const d=window.__mock.docs,src='https://res.cloudinary.com/demo/image/upload/v1/test/photo.jpg';
  for(const [key,a]of d)if(key.startsWith('animals/'))a.images=[src,src,src];
  const base=d.get('animals/direct');
  d.set('animals/pet',{...base,type:'حيوانات أليفة',subcategory:'قطط',name:'قطط للبيع',images:[src]});
  d.set('animals/other',{...base,type:'أخرى',name:'إعلان آخر',images:Array(5).fill(src)});
  await window.selectMarketCountry('AE');window.closeModal();
});
await page.waitForFunction(()=>document.querySelectorAll('#direct-sales .v2-card').length===4);
assert.equal(await page.locator('#auction-list').isVisible(),false);pass('direct tab is default; real fixture counts');
const first=page.locator('#direct-sales .v2-card[data-animal-id="direct"]');
await first.locator('[data-slide="1"]').click();assert.equal(await first.locator('.v2-gallery').getAttribute('data-index'),'1');
assert.equal(await page.locator('#modal').isVisible(),false);await first.locator('[data-slide="-1"]').click();assert.equal(await first.locator('.v2-gallery').getAttribute('data-index'),'0');pass('card left and right arrows do not open detail');
await first.locator('[data-dot="2"]').click();assert.equal(await first.locator('.v2-gallery').getAttribute('data-index'),'2');pass('card dots change the photo');
await first.locator('.v2-gallery').evaluate(node=>{
  const start=new Event('touchstart',{bubbles:true});Object.defineProperty(start,'touches',{value:[{clientX:250,clientY:100}]});node.dispatchEvent(start);
  const end=new Event('touchend',{bubbles:true});Object.defineProperty(end,'changedTouches',{value:[{clientX:100,clientY:110}]});node.dispatchEvent(end);
});assert.equal(await first.locator('.v2-gallery').getAttribute('data-index'),'0');pass('touch swipe wraps without vertical-scroll interception');
assert.equal(await page.locator('[data-animal-id="pet"] [data-slide]').count(),0);assert.equal(await page.locator('[data-animal-id="other"] .v2-slides img').count(),5);pass('one photo hides arrows; legacy five photos preserved');
await first.getByRole('button',{name:'عرض التفاصيل',exact:true}).click();await page.locator('.ux-gallery [data-dot="1"]').click();assert.equal(await page.locator('.ux-gallery .v2-gallery').getAttribute('data-index'),'1');await page.evaluate(()=>window.closeModal());pass('detail gallery uses working dots and arrows');
await page.getByRole('tab',{name:/المزادات/}).click();assert.equal(await page.locator('#direct-sales').isVisible(),false);assert.equal(await page.locator('#auction-list .v2-card').count(),1);pass('auction tab displays auctions in the same space');
await page.getByRole('tab',{name:/البيع المباشر/}).click();await page.evaluate(()=>window.chooseMarketCategory('حيوانات أليفة'));await page.waitForFunction(()=>document.querySelectorAll('#direct-sales .v2-card').length===1);assert.match(await page.locator('#direct-sales').innerText(),/قطط/);await page.evaluate(()=>window.chooseMarketCategory('أخرى'));await page.waitForFunction(()=>document.querySelectorAll('#direct-sales .v2-card').length===1);assert.match(await page.locator('#direct-sales').innerText(),/إعلان آخر/);await page.evaluate(()=>window.resetMarketFilters());pass('pets and other filters retain legacy category options');
await page.locator('#marketSearch').fill('قطط');await page.waitForFunction(()=>document.querySelectorAll('#direct-sales .v2-card').length===1);assert.match(await page.locator('#direct-sales').innerText(),/قطط/);await page.locator('#marketSearch').fill('');await page.waitForFunction(()=>document.querySelectorAll('#direct-sales .v2-card').length===4);pass('keyword search updates matching cards');
const image=fs.readFileSync(path.join(root,'hero-livestock.png')).toString('base64');
const compression=await page.evaluate(async data=>{
  const {compressImage,uploadImage}=await import('./image-provider.js');
  const file=new File([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],'test.png',{type:'image/png'});
  const original=await createImageBitmap(file),blob=await compressImage(file),small=await createImageBitmap(blob);
  const metrics={bytes:blob.size,w:small.width,h:small.height,ratio:original.width/original.height};original.close();small.close();
  try{await compressImage(new File(['broken'],'bad.png',{type:'image/png'}));throw Error('accepted broken');}catch(e){if(e.message==='accepted broken')throw e;metrics.broken=e.message;}
  try{await compressImage(new File(['text'],'bad.txt',{type:'text/plain'}));throw Error('accepted non-image');}catch(e){metrics.nonImage=e.message;}
  const user={getIdToken:async()=>'mock-id-token'};
  try{await uploadImage(file,user);throw Error('missing configuration accepted');}catch(e){metrics.missing=e.message;}
  metrics.url=await uploadImage(file,user,'listing',{signingEndpoint:'https://v2.test/sign'});return metrics;
},image);
assert.ok(compression.bytes<=307200);assert.ok(Math.max(compression.w,compression.h)<=1600);assert.ok(Math.abs(compression.w/compression.h-compression.ratio)<.01);assert.equal(compression.broken,'IMAGE_LOAD_ERROR');assert.equal(compression.nonImage,'INVALID_IMAGE');assert.equal(compression.missing,'IMAGE_PROVIDER_NOT_CONFIGURED');assert.match(compression.url,/cloudinary/);assert.equal(uploads.length,1);pass('real compression and signed adapter: bounded JPEG, ratio, corrupt/non-image rejection, missing provider');
const orientation=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=80;canvas.height=40;canvas.getContext('2d').fillRect(0,0,80,40);
  const jpeg=await new Promise(r=>canvas.toBlob(r,'image/jpeg'));
  const bytes=new Uint8Array(await jpeg.arrayBuffer());
  const exif=new Uint8Array([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
  const file=new File([bytes.slice(0,2),exif,bytes.slice(2)],'rotated.jpg',{type:'image/jpeg'});
  const {compressImage}=await import('./image-provider.js');const output=await createImageBitmap(await compressImage(file));const size=[output.width,output.height];output.close();return size;
});assert.deepEqual(orientation,[40,80]);pass('EXIF orientation 6 is applied before compression');
const file={name:'photo.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')};
const chooseFiles=async count=>page.evaluate(async({data,count})=>{const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)),transfer=new DataTransfer(),bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));for(let i=0;i<count;i++){const canvas=document.createElement('canvas');canvas.width=240;canvas.height=160;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,240,160);ctx.fillStyle=['red','green','blue'][i];ctx.fillRect(0,0,70,70);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));transfer.items.add(new File([blob],'photo'+i+'.png',{type:'image/png'}));}bitmap.close();const input=document.getElementById('animalImages');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));},{data:image,count});
await chooseFiles(3);await page.waitForFunction(()=>document.getElementById('imageCounter').textContent==='3/3');assert.equal(await page.locator('.v2-image-preview').count(),3);
await chooseFiles(1);assert.ok(dialogs.some(t=>t.includes('الحد الأقصى 3')));assert.equal(await page.locator('#imageCounter').innerText(),'3/3');
await page.locator('.v2-image-preview').nth(2).getByRole('button',{name:'اجعلها الرئيسية'}).click();await page.locator('.v2-image-preview').first().getByRole('button',{name:'حذف',exact:true}).click();assert.equal(await page.locator('#imageCounter').innerText(),'2/3');pass('image picker max three, preview, reorder, main image and removal');
const chooser=page.waitForEvent('filechooser');await page.locator('.v2-image-preview').first().getByRole('button',{name:'استبدال',exact:true}).click();await (await chooser).setFiles({...file,name:'replacement.png'});await page.waitForFunction(()=>!document.getElementById('animalImages').disabled&&document.getElementById('animalImages').files[0].name==='replacement.png');pass('replace selected image preserves two-photo selection');
await page.locator('#animalType').selectOption('حيوانات أليفة');assert.equal(await page.locator('#petSubcategoryField').isVisible(),true);assert.equal(await page.locator('#method option[value="مزاد إلكتروني"]').isDisabled(),true);pass('pet listing optional subcategory and direct-only sale');
assert.equal(await page.locator('#featuredHero').isVisible(),false);pass('Hero missing configuration safely uses the original image');
await page.evaluate(async()=>{const d=window.__mock.docs;d.set('homePage/config',{mode:'featured',imageUrl:'',featured:[{animalId:'direct',active:true,priority:1,startAt:new Date(Date.now()-1000),endAt:new Date(Date.now()+60000)}]});await window.selectMarketCountry('AE');});await page.waitForFunction(()=>!document.getElementById('featuredHero').hidden);assert.match(await page.locator('.v2-featured-link').innerText(),/ناقة للبيع/);pass('active featured ad uses the actual listing');
await page.evaluate(async()=>{window.__mock.docs.get('homePage/config').featured[0].endAt=new Date(0);await window.selectMarketCountry('AE');});await page.waitForFunction(()=>document.getElementById('featuredHero').hidden);pass('expired featured ad returns to static fallback');
await page.evaluate(()=>window.openHomePageAdmin());assert.ok(dialogs.some(t=>t.includes('غير مصرح')));pass('normal user denied homepage administration');
await page.evaluate(async()=>{window.__mock.admin=true;await window.openHomePageAdmin();});await page.getByRole('heading',{name:'إدارة واجهة الصفحة الرئيسية'}).waitFor();await page.locator('#heroMode').selectOption('static');await page.locator('#featuredAnimal0').selectOption('');await page.locator('#heroSaveButton').click();await page.getByText('تم حفظ الواجهة.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__mock.docs.get('homePage/config').updatedBy),'owner');pass('owner can edit and save homepage using existing UID');
await page.evaluate(async()=>{window.closeModal();window.__mock.admin=false;await window.__mock.setUser(null);window.openLogin();});
assert.equal(await page.locator('#phoneNumber').count(),0);assert.equal(await page.locator('.v2-social button').count(),1);
for(const provider of ['Google','Facebook','X']){await page.evaluate(()=>window.__mock.socialError='auth/operation-not-allowed');await page.evaluate(provider=>window.socialLogin(provider),provider);await page.getByText('تسجيل الدخول عبر '+provider+' غير متاح حاليًا',{exact:true}).waitFor();}pass('legacy providers recover gracefully; Google is primary');
await page.evaluate(()=>window.__mock.socialError='auth/account-exists-with-different-credential');await page.evaluate(()=>window.socialLogin('Facebook'));assert.match(await page.locator('#emailAuthStatus').innerText(),/الطريقة الأصلية/);assert.equal(await page.evaluate(()=>window.__mock.api.getAuth().currentUser),null);pass('provider collision preserves account and does not auto-link');
await page.evaluate(()=>{window.__mock.socialError=null;window.__mock.popupBlocked=true;});await page.evaluate(()=>window.socialLogin('X'));assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='redirect').length),0);await page.evaluate(()=>{window.__mock.popupBlocked=false;sessionStorage.removeItem('souqSocialRedirect');});pass('blocked popup avoids cross-origin redirect');
await page.evaluate(()=>Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (Linux; Android 14; wv)'}));await page.getByRole('button',{name:'الدخول باستخدام Google',exact:true}).click();assert.match(await page.locator('#emailAuthStatus').innerText(),/متصفح الهاتف/);await page.evaluate(()=>delete navigator.userAgent);pass('WebView receives email/browser guidance without unsupported OAuth');
await page.evaluate(()=>window.__mock.socialError=null);await page.getByRole('button',{name:'الدخول باستخدام Google',exact:true}).click();await page.waitForFunction(()=>!!window.__mock.api.getAuth().currentUser);assert.equal(await page.evaluate(()=>window.__mock.api.getAuth().currentUser.uid),'owner');assert.equal(await page.evaluate(()=>[...window.__mock.docs.keys()].filter(k=>k==='users/owner').length),1);pass('social login reuses UID and preserves existing profile');
await page.evaluate(()=>window.closeModal());
for(const lang of ['ar','en']){
  if(lang==='en')await page.evaluate(()=>window.toggleSiteLanguage());
  for(const width of [1440,1280,1024,768,430,390,360]){
    await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+lang+' '+width);
    assert.equal(await page.evaluate(()=>document.documentElement.dir),lang==='ar'?'rtl':'ltr');
    if(width<768){const columns=await page.locator('#direct-sales').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length);assert.equal(columns,1);await page.locator('.v2-hamburger').click();assert.equal(await page.locator('#primaryNav').isVisible(),true);await page.locator('.v2-hamburger').click();}
    await page.screenshot({path:path.join(output,`${lang}-${width}.png`),fullPage:width===1440||width===390});
    if(width===1440||width===390)await page.screenshot({path:path.join(output,`viewport-${lang}-${width}.png`)});
    if(width===1440)await page.locator('#firebase-market').screenshot({path:path.join(output,`market-${lang}-desktop.png`)});
    if(width===1440||width===390){
      await page.evaluate(async()=>{window.__mock.admin=true;await window.openHomePageAdmin();});
      await page.locator('.v2-home-admin').waitFor();assert.equal(await page.locator('.v2-home-admin').evaluate(node=>node.scrollWidth>node.clientWidth+1),false);
      await page.screenshot({path:path.join(output,`hero-admin-${lang}-${width}.png`)});
      await page.evaluate(async()=>{window.closeModal();window.__mock.admin=false;await window.__mock.setUser(null);window.openEmailAuth('signup');});
      assert.equal(await page.locator('.email-auth').evaluate(node=>node.scrollWidth>node.clientWidth+1),false);
      await page.screenshot({path:path.join(output,`signup-${lang}-${width}.png`)});
      await page.evaluate(async()=>{window.closeModal();await window.__mock.setUser({uid:'owner',email:'owner@example.test',providerData:[{providerId:'password'}]});});
      pass('homepage administration and signup '+lang+' '+width+' no overflow');
    }
    pass('responsive '+lang+' '+width+' no overflow / correct columns and menu');
  }
}
assert.deepEqual(errors,[]);assert.deepEqual(foreign,[]);pass('zero JavaScript errors and zero production network');
console.log(`SUMMARY | ${count}/${count} passed; screenshots ${output}`);
}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
