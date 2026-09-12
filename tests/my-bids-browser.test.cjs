const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installMock,seedMock}=require('./user-seller-fixture.cjs');
const root=path.resolve(__dirname,'..'),shots=path.join(require('os').tmpdir(),'souq-my-bids-screenshots');fs.mkdirSync(shots,{recursive:true});
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
await page.goto('http://ux.test/');await page.waitForFunction(()=>typeof window.selectMarketCountry==='function');await page.evaluate(seedMock);
assert.equal(await page.locator('#adminPanelButton').isVisible(),false);pass('normal seller has no Admin UI');
await page.evaluate(()=>{
 const d=window.__mock.docs,now=new Date(),base={...d.get('auctions/auction')},animal={...d.get('animals/auction-animal')};
 d.delete('auctions/auction');
 for(const [id,name,leader,status]of [['leading','مزاد تتصدره','owner','active'],['outbid','مزاد تجاوزك فيه آخر','another','active'],['ended','مزاد منتهي شاركت فيه','another','active']]){
   d.set('animals/'+id,{...animal,name});d.set('auctions/'+id,{...base,animalId:id,lastBidderId:leader,currentPrice:2000,status,endTime:new Date(Date.now()+(id==='ended'?-86400000:86400000))});
   d.set('auctionParticipations/'+id+'_owner',{auctionId:id,animalId:id,sellerId:'seller',bidderId:'owner',lastBidAmount:id==='leading'?2000:1500,lastBidAt:now,createdAt:now});
 }
 d.set('auctionParticipations/outbid_duplicate',{auctionId:'outbid',animalId:'outbid',sellerId:'seller',bidderId:'owner',lastBidAmount:1200,lastBidAt:new Date(Date.now()+1000),createdAt:now});
 d.set('auctionParticipations/foreign',{auctionId:'foreign',animalId:'direct',sellerId:'seller',bidderId:'another',lastBidAmount:9999,lastBidAt:now,createdAt:now});
});
await page.evaluate(()=>window.showMyBids());
const card=name=>page.locator('.ux-bid-card').filter({has:page.getByRole('heading',{name,exact:true})});
assert.equal(await page.locator('.ux-bid-card').count(),3);pass('one card for each participated auction; duplicates removed');
assert.match(await card('مزاد تتصدره').innerText(),/أنت المتصدر حاليًا/);pass('leading participation visible');
assert.match(await card('مزاد تجاوزك فيه آخر').innerText(),/تجاوزك مزايد آخر/);pass('outbid auction retained');
const ownValues=await card('مزاد تجاوزك فيه آخر').locator('.ux-money').allTextContents();assert.deepEqual(ownValues,['2,000 AED','1,500 AED']);pass('highest own amount wins over newer lower duplicate; current price distinct');
assert.match(await card('مزاد منتهي شاركت فيه').innerText(),/منتهي/);pass('ended participation retained');
assert.doesNotMatch(await page.locator('#modalContent').innerText(),/9999|9,999|foreign|_owner/);pass('foreign participation and technical IDs absent');
assert.match(await card('مزاد تتصدره').innerText(),/تاريخ آخر مزايدة لك/);pass('own last bid timestamp displayed');
await card('مزاد تجاوزك فيه آخر').getByRole('button',{name:'تفاصيل المزاد',exact:true}).click();await page.getByRole('heading',{name:'مزاد تجاوزك فيه آخر',exact:true}).waitFor();await page.getByRole('button',{name:'رجوع إلى مزايداتي',exact:true}).click();await page.locator('.ux-bid-card').first().waitFor();assert.equal(await page.locator('.ux-bid-card').count(),3);pass('outbid details and return preserve history');
for(const [width,height]of [[1280,900],[1366,768],[360,800],[390,844]]){
 await page.setViewportSize({width,height});await page.evaluate(()=>window.showMyBids());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await page.locator('.ux-bid-card').count(),3);
 assert.equal(await page.locator('.ux-money').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).whiteSpace==='nowrap'&&n.getBoundingClientRect().width<=n.closest('.ux-bid-card').getBoundingClientRect().width)),true);
 if(width===1280||width===360){
   await page.locator('.ux-bid-card').first().scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(shots,'my-bids-'+width+'.png')});
   await page.locator('.ux-bid-card').nth(1).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(shots,'my-bids-'+width+'-outbid.png')});
   await page.locator('.ux-bid-card').last().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(shots,'my-bids-'+width+'-ended.png')});
 }
 pass('history cards and prices RTL no overflow '+width+'x'+height);
}
await page.evaluate(async()=>{window.__mock.docs.delete('auctions/outbid');window.__mock.docs.delete('animals/outbid');await window.showMyBids()});assert.equal(await page.locator('.ux-bid-card').count(),3);assert.match(await page.locator('#modalContent').innerText(),/احتفظنا بمشاركتك/);pass('missing auction retains saved amount without invented metadata');
await page.evaluate(async()=>{const d=window.__mock.docs;for(const k of [...d.keys()])if(k.startsWith('auctionParticipations/'))d.delete(k);for(const [k,v]of d)if(k.startsWith('auctions/'))v.lastBidderId='another';await window.showMyBids()});assert.match(await page.locator('#modalContent').innerText(),/لم تشارك في أي مزاد حتى الآن ضمن السجل المتاح/);pass('no participation empty state, with historical coverage caveat');
await page.evaluate(async()=>{window.__mock.failRead='auctionParticipations';await window.showMyBids()});assert.match(await page.locator('#modalContent').innerText(),/تعذر تحميل مزايداتك/);assert.doesNotMatch(await page.locator('#modalContent').innerText(),/لم تشارك/);pass('permission or network failure does not pretend history is empty');
await page.evaluate(()=>{window.__mock.failRead=null;window.__mock.delay=100});await page.evaluate(async()=>{const pending=window.showMyBids();window.closeModal();await pending});assert.equal(await page.locator('#modal').isVisible(),false);pass('closing loading history stays closed');
await page.evaluate(async()=>{window.__mock.delay=0;await window.logoutUser();await window.showMyBids()});await page.locator('#authEmail').waitFor();assert.equal(await page.locator('.ux-bid-card').count(),0);pass('guest redirected to login, private cards removed');
assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(external,[]);pass('zero Console errors and no production network');
console.log(`SUMMARY | ${count}/${count} passed; screenshots ${shots}`);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
