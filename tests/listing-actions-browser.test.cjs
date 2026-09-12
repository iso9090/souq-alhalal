const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installMock,seedMock}=require('./user-seller-fixture.cjs');
const root=path.resolve(__dirname,'..'),shots=path.join(require('os').tmpdir(),'souq-listing-actions-polish');fs.mkdirSync(shots,{recursive:true});
const names=[...fs.readFileSync(path.join(root,'app.js'),'utf8').matchAll(/import\s*\{([^}]+)\}/g)].flatMap(m=>m[1].split(',').map(s=>s.trim()));
let count=0;const pass=n=>{count++;console.log('PASS | '+n)};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(installMock);
await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='www.gstatic.com')return route.fulfill({contentType:'text/javascript',body:names.map(n=>`export const ${n}=window.__mock.api.${n};`).join('\n')});if(u.hostname!=='ux.test')return route.abort();const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});});
await page.goto('https://ux.test/');await page.waitForFunction(()=>typeof window.selectMarketCountry==='function');await page.evaluate(seedMock);
await page.evaluate(()=>{window.__calls=[];for(const name of ['requestPurchase','openDirectConversation','submitModerationReport'])window[name]=(...args)=>window.__calls.push([name,...args]);});
for(const width of [1366,768,430,390,360]){
await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.openListingDetails('direct'));
const group=page.locator('.listing-actions');await group.scrollIntoViewIfNeeded();
const styles=await group.evaluate(el=>{const b=el.querySelector('button'),s=getComputedStyle(b);return{rtl:getComputedStyle(el).direction,color:s.color,bg:s.backgroundColor,w:b.getBoundingClientRect().width,gw:el.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth}});
assert.equal(styles.rtl,'rtl');assert.equal(styles.bg,'rgb(0, 101, 80)');assert.equal(styles.color,'rgb(255, 255, 255)');assert.ok(Math.abs(styles.w-styles.gw)<2);assert.equal(styles.overflow,false);
const bounds=await group.locator('button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,h:r.height}}));for(let i=0;i<bounds.length;i++){assert.ok(bounds[i].h>=44);assert.ok(bounds[i].x>=0&&bounds[i].right<=innerWidthSafe(width));if(i)assert.ok(bounds[i].y>=bounds[i-1].bottom+8);}
await group.locator('button').first().focus();await page.keyboard.press('Tab');assert.equal(await page.locator('.listing-action--message').evaluate(el=>el===document.activeElement),true);assert.equal(await page.locator('.listing-action--message').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
await group.screenshot({path:path.join(shots,'actions-'+width+'.png')});pass('RTL, green primary, spacing, touch targets, keyboard focus, no overflow '+width);
}
for(const label of ['طلب شراء','مراسلة البائع','الإبلاغ عن الإعلان','الإبلاغ عن البائع'])await page.getByRole('button',{name:label,exact:true}).click();
assert.deepEqual(await page.evaluate(()=>window.__calls),[['requestPurchase','direct'],['openDirectConversation','direct'],['submitModerationReport','animal','direct'],['submitModerationReport','user','seller']]);pass('four action clicks retain original handlers and target IDs');
assert.equal(await page.getByRole('button',{name:'تقديم عرض',exact:true}).count(),0);assert.match(await page.locator('.listing-offer-note').innerText(),/داخل المحادثة/);pass('offer stays in existing conversation flow without invented action');
await page.evaluate(()=>window.openListingDetails('mine'));assert.equal(await page.locator('.listing-action--purchase,.listing-action--message').count(),0);pass('owner purchase and conversation restrictions preserved');
await page.evaluate(async()=>{window.__mock.docs.get('animals/direct').status='sold';await window.openListingDetails('direct')});assert.equal(await page.locator('.listing-action--purchase').count(),0);pass('sold listing has no purchase action');
assert.deepEqual(errors,[]);pass('zero JavaScript exceptions');console.log(`SUMMARY | ${count}/${count} PASS; screenshots: ${shots}`);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
function innerWidthSafe(width){return width;}
