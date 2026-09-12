const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installMock,seedMock}=require('./user-seller-fixture.cjs');
const root=path.resolve(__dirname,'..'),shots=path.join(require('os').tmpdir(),'souq-free-livestock-screenshots');fs.mkdirSync(shots,{recursive:true});
const exportsList=[...fs.readFileSync(path.join(root,'app.js'),'utf8').matchAll(/import\s*\{([^}]+)\}/g)].flatMap(m=>m[1].split(',').map(s=>s.trim()));
let count=0;const pass=name=>{count++;console.log('PASS | '+name)};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage(),errors=[],external=[],dialogs=[],consoleErrors=[];let bid='1600';
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('dialog',async d=>{dialogs.push(d.message());await d.accept(d.type()==='prompt'?bid:undefined)});
await page.addInitScript(installMock);
await page.route('**/*',async route=>{const u=new URL(route.request().url());
if(u.hostname==='www.gstatic.com')return route.fulfill({contentType:'text/javascript',body:exportsList.map(n=>`export const ${n}=window.__mock.api.${n};`).join('\n')});
if(u.hostname!=='ux.test'){external.push(u.origin);return route.abort()}
const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
return route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
});
await page.goto('https://ux.test/');await page.waitForFunction(()=>typeof window.selectMarketCountry==='function');await page.evaluate(seedMock);
assert.equal(await page.locator('#adminPanelButton').isVisible(),false);pass('normal seller has no Admin UI');
const fillListing=async(method='بيع مباشر')=>{await page.evaluate(()=>window.closeModal());await page.locator('#animalType').selectOption('ناقة');await page.locator('#animalGender').selectOption('female');await page.locator('#animalPrice').fill('2200');await page.locator('#method').selectOption(method);};
const photo=fs.readFileSync(path.join(root,'hero-livestock.png')).toString('base64');
let imageSequence=0;
const chooseImages=async(n=1,bad='')=>{const start=imageSequence;imageSequence+=n;await page.evaluate(async({n,photo,bad,start})=>{const input=document.getElementById('animalImages'),data=new DataTransfer();for(let i=0;i<n;i++){let content=bad;if(!bad){const canvas=document.createElement('canvas');canvas.width=240;canvas.height=160;const ctx=canvas.getContext('2d'),image=await createImageBitmap(new Blob([Uint8Array.from(atob(photo),c=>c.charCodeAt(0))],{type:'image/png'}));ctx.drawImage(image,0,0,240,160);image.close();ctx.fillStyle=`hsl(${(start+i)*65} 70% 40%)`;ctx.fillRect(0,0,70,70);content=await new Promise(r=>canvas.toBlob(r,'image/png'));}data.items.add(new File([content],bad==='text'?'bad.txt':'photo'+(start+i)+'.png',{type:bad==='text'?'text/plain':'image/png'}));}input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));},{n,photo,bad,start});await page.waitForFunction(()=>!document.getElementById('animalImages').disabled);};
const save=()=>page.evaluate(()=>window.saveListing({preventDefault(){},target:document.getElementById('listingForm')}));
for(const method of ['بيع مباشر','مزاد إلكتروني'])for(const n of [1,2,3]){
  await fillListing(method);await chooseImages(n);
  if(method==='مزاد إلكتروني'){
    await page.locator('#auctionIncrement').fill('100');
    await page.locator('#auctionEndTime').fill(new Date(Date.now()+172800000).toISOString().slice(0,16));
  }
  const before=await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='write'&&c.path.startsWith('animals/')).length);
  await save();
  const written=await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='write'&&c.path.startsWith('animals/')));
  assert.equal(written.length,before+1);assert.equal(written.at(-1).data.images.length,n);
  for(const image of written.at(-1).data.images)assert.ok(Buffer.from(image.split(',')[1],'base64').length<=150*1024);
  assert.ok(!dialogs.some(d=>d.includes('بعد تجهيز الخدمة')));
  pass(method+' saves '+n+' compressed images through actual app with no upload stub');
}
await fillListing();await chooseImages(3);
const names=()=>page.evaluate(()=>Array.from(document.getElementById('animalImages').files,f=>f.name));
const original=await names();await chooseImages(1);
assert.deepEqual(await names(),original);assert.equal(dialogs.at(-1),'يمكنك إضافة 3 صور كحد أقصى.');pass('fourth image blocked with exact message, draft preserved');
await page.locator('#imagePreview article').nth(2).getByRole('button',{name:'اجعلها الرئيسية'}).click();
assert.equal((await names())[0],original[2]);assert.equal(await page.locator('#imagePreview article b').first().innerText(),'الصورة الرئيسية');pass('main image changes FileList and label');
await page.locator('#imagePreview article').first().getByRole('button',{name:'تأخير',exact:true}).click();
assert.equal((await names())[1],original[2]);pass('reorder changes saved order');
const picker=page.waitForEvent('filechooser');await page.locator('#imagePreview article').nth(1).getByRole('button',{name:'استبدال'}).click();
await (await picker).setFiles({name:'replacement.png',mimeType:'image/png',buffer:Buffer.from(photo,'base64')});
await page.waitForFunction(()=>!document.getElementById('animalImages').disabled);
assert.equal((await names())[1],'replacement.png');assert.equal(await page.locator('#imagePreview img').count(),3);pass('replace preserves other previews');
await page.locator('#imagePreview article').nth(2).getByRole('button',{name:'حذف',exact:true}).click();
assert.equal((await names()).length,2);pass('delete updates underlying files');
await chooseImages(1,'text');assert.equal((await names()).length,2);pass('invalid type preserves valid draft');
await chooseImages(1,'broken');assert.equal((await names()).length,2);pass('corrupt image rejected before save');
const checks=await page.evaluate(async()=>{
 const {listingImageData}=await import('./livestock-images.js');
 const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=1600;
 const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(2000,1600);let seed=123;
 for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels.data[i]=seed&255;pixels.data[i+1]=(seed>>>8)&255;pixels.data[i+2]=(seed>>>16)&255;pixels.data[i+3]=255;}
 ctx.putImageData(pixels,0,0);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
 const file=new File([blob],'noise.png',{type:'image/png'});
 const result=await listingImageData([file],{uid:'owner'});
 const decoded=await createImageBitmap(await (await fetch(result[0])).blob());
 const size={original:blob.size,bytes:atob(result[0].split(',')[1]).length,width:decoded.width,height:decoded.height};decoded.close();
 const failure=async(files,user={uid:'owner'})=>{try{await listingImageData(files,user);return 'UNEXPECTED_SUCCESS'}catch(e){return e.message}};
 return {size,missing:await failure([]),four:await failure([file,file,file,file]),duplicate:await failure([file,file]),guest:await failure([file],null),large:await failure([new File([new Uint8Array(30*1024*1024+1)],'large.jpg',{type:'image/jpeg'})])};
});
assert.ok(checks.size.original>checks.size.bytes&&checks.size.bytes<=150*1024&&checks.size.width<=1600);pass('noisy large image compressed below 150 KiB with bounded dimensions');
assert.equal(checks.missing,'IMAGE_REQUIRED');pass('zero images blocked');
assert.equal(checks.four,'TOO_MANY_IMAGES');pass('direct API bypass cannot submit four images');
assert.equal(checks.duplicate,'DUPLICATE_IMAGE');pass('duplicate images rejected');
assert.equal(checks.guest,'AUTH_REQUIRED');pass('unauthenticated image preparation blocked');
assert.equal(checks.large,'IMAGE_TOO_LARGE');pass('oversized input blocked');
const imageRemoval=await page.evaluate(async()=>{
 const entry=[...window.__mock.docs.entries()].find(([key,value])=>key.startsWith('animals/')&&value.sellerId==='owner'&&value.images?.length===1);
 const before=window.__mock.calls.filter(c=>c.kind==='write').length;
 await window.removeAnimalImage(entry[0].split('/')[1],0);
 await window.removeAllAnimalImages(entry[0].split('/')[1]);
 return {before,after:window.__mock.calls.filter(c=>c.kind==='write').length,count:window.__mock.docs.get(entry[0]).images.length};
});
assert.equal(imageRemoval.before,imageRemoval.after);assert.equal(imageRemoval.count,1);pass('saved listing cannot lose its last image through individual or bulk removal');
const legacyRemoval=await page.evaluate(async()=>{
 const original=[...window.__mock.docs.values()].find(a=>a.sellerId==='owner'&&a.images?.length===3);
 const images=[...original.images,original.images[0],original.images[1]];
 window.__mock.docs.set('animals/local-legacy-five',{...original,images});
 const before=window.__mock.calls.filter(c=>c.kind==='write').length;
 await window.removeAnimalImage('local-legacy-five',0);
 const result={before,after:window.__mock.calls.filter(c=>c.kind==='write').length,count:window.__mock.docs.get('animals/local-legacy-five').images.length};
 window.__mock.docs.delete('animals/local-legacy-five');return result;
});
assert.equal(legacyRemoval.before,legacyRemoval.after);assert.equal(legacyRemoval.count,5);pass('legacy images preserved until replacement reaches at most three');
for(const width of [1366,768,390]){
 await page.setViewportSize({width,height:900});
 assert.equal(await page.locator('#animalImages').getAttribute('accept'),'image/jpeg,image/png,image/webp');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#imagePreview').scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(shots,'listing-images-'+width+'.png')});pass('picker and preview responsive '+width);
}
await page.evaluate(async()=>{window.closeModal();window.resetImagePreview();await window.resetMarketFilters();});
const galleryWritesBefore=await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='write').length);
for(const width of [1366,768,390]){
 await page.setViewportSize({width,height:1000});
 for(const n of [1,2,3]){
  const selector=await page.evaluate(n=>{
   const entry=[...window.__mock.docs.entries()].find(([key,a])=>key.startsWith('animals/')&&a.saleType==='direct'&&a.sellerId==='owner'&&a.images?.length===n&&a.price===2200);
   return '[data-animal-id="'+entry[0].split('/')[1]+'"] .v2-gallery';
  },n);
  const gallery=page.locator(selector).first();await gallery.scrollIntoViewIfNeeded();
  assert.equal(await gallery.locator('.v2-thumbnails button').count(),n-1);
  assert.equal(await gallery.locator('[data-gallery-counter]').innerText(),'1 / '+n);
  assert.equal(await gallery.locator('.v2-slides>img:visible').count(),1);
  if(n>1){
   const main=await gallery.locator('.v2-slides').boundingBox(),rail=await gallery.locator('.v2-thumbnails').boundingBox();
   assert.ok(width>600?rail.x>=main.x+main.width-1:rail.y>=main.y+main.height-1);
   const thumb=gallery.locator('.v2-thumbnails button').last();await thumb.click();
   assert.equal(await gallery.getAttribute('data-index'),String(n-1));assert.equal(await thumb.getAttribute('aria-pressed'),'true');
   assert.equal(await gallery.locator('.v2-slides>img:visible').getAttribute('src'),await thumb.locator('img').getAttribute('src'));
   assert.equal(await gallery.locator('[data-gallery-counter]').innerText(),n+' / '+n);
   assert.notEqual(await thumb.evaluate(el=>getComputedStyle(el).borderTopColor),'rgba(0, 0, 0, 0)');
   await gallery.locator('[data-slide="1"]').click();assert.equal(await gallery.getAttribute('data-index'),'0');
   await thumb.focus();await page.keyboard.press('Enter');assert.equal(await gallery.getAttribute('data-index'),String(n-1));
   await page.keyboard.press('ArrowRight');assert.equal(await gallery.getAttribute('data-index'),'0');
   assert.ok((await thumb.boundingBox()).height>=44);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(n===3)await gallery.screenshot({path:path.join(shots,'market-gallery-'+width+'.png')});
  pass('gallery '+n+' images: thumbnails, swap, counter, keyboard and layout '+width);
 }
}
assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='write').length),galleryWritesBefore);pass('gallery interaction never changes listing data');
assert.deepEqual(external,[]);assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);pass('zero remote requests, production writes and critical JavaScript errors');
console.log(`SUMMARY | ${count}/${count} passed; screenshots: ${shots}`);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
