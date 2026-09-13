const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/asus/AppData/Local/OpenAI/Codex/runtimes/cua_node/b58ca2eaa616c2da/bin/node_modules/playwright-core');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});let count=0;try{
 const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 const origin='https://iso9090.github.io';
 const entry=`import {startMarketplace} from './app.js';import {CATEGORIES,countryConfig} from './config.js';
 const countries=countryConfig(await (await fetch('./melkak/legacy-countries.json')).json());
 const canvas=document.createElement('canvas');canvas.width=10;canvas.height=10;const photo=canvas.toDataURL('image/jpeg');
 const listing={id:'marketplace-real',sourceId:'real',sourceCollection:'marketplaceListings',ownerUid:'real-user',category:'cars',country:'AE',region:'الشارقة',city:'الذيد',title:'Verified Firebase listing',description:'Actual adapter fixture, never demo fallback',price:100,currency:'AED',images:[photo],status:'active',attributes:{brand:'Verified'},contact:{phone:'+971500000000',consent:true,call:true,whatsapp:true,showNumber:false},createdAt:Date.now(),updatedAt:Date.now()};
 const state={listings:[listing],categories:CATEGORIES.map((c,i)=>({...c,enabled:true,order:i})),users:[],ads:[],services:[],reports:[],audit:[],version:0,capabilities:{marketplaceListings:{status:'available'}}};
 const listeners=new Set();const auth={state:{status:'signed_out',actor:{uid:null,role:null,permissions:[],active:false}},subscribe(fn){listeners.add(fn);fn(this.state);return()=>listeners.delete(fn)},async signInGoogle(){window.authCalls++},async signOut(){this.emit({status:'signed_out',actor:{uid:null,role:null,permissions:[],active:false}})},emit(v){this.state=v;for(const fn of listeners)fn(v)}};
 window.imageReads=[];window.authCalls=0;window.testAuth=auth;window.testState=state;
 const store={mode:'production',state,subscribe(){return()=>{}},async loadOwn(){},async loadAdmin(){},async refreshPublic(){},async loadAdImages(ids){window.imageReads.push(...ids)},statistics(){return {total:1,active:1,hidden:0,rejected:0,pending:0,archived:0,featured:0,soon:0,reports:0,users:0}}};
 await startMarketplace({config:{mode:'production',datasource:'production',authProvider:'firebase',writesEnabled:false},store,auth});`;
 await page.route('**/*',async r=>{const u=new URL(r.request().url());requests.push(u.pathname);if(u.origin!==origin)return r.abort();if(u.pathname==='/melkak/entry.js')return r.fulfill({contentType:'text/javascript',body:entry});const f=path.resolve('.'+u.pathname+(u.pathname==='/'?'index.html':''));if(!f.startsWith(process.cwd()+path.sep)||!fs.existsSync(f))return r.fulfill({status:404,body:''});return r.fulfill({body:fs.readFileSync(f),contentType:({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.ttf':'font/ttf','.webp':'image/webp'})[path.extname(f)]||'application/octet-stream'});});
 await page.goto(origin);await page.waitForSelector('.topbar',{timeout:10000});
 assert.match(await page.locator('#main').innerText(),/Verified Firebase listing/);assert.equal(await page.locator('#preview-role,.preview').count(),0);count++;
 assert.equal(requests.some(p=>/fixtures\.js|\/datasource\.js/.test(p)),false);assert.equal(await page.evaluate(()=>!!window.__melkak),false);count++;
 await page.evaluate(()=>{const a=window.testState.listings[0];window.testState.listings.push({...a,id:'hidden-secret',title:'PRIVATE HIDDEN',status:'hidden'},{...a,id:'auction-secret',title:'PRIVATE AUCTION',saleType:'auction'});const now=Date.now();window.testState.publicAds=Array.from({length:10},(_,i)=>({id:'hero-'+i,title:'Real campaign '+i,placement:'hero',countryTarget:'ALL',status:'active',startAt:now-60000,endAt:now+86400000,priority:10-i,targetUrl:'https://example.com',cta:'Discover'}));window.testState.ads=[...window.testState.publicAds,{...window.testState.publicAds[0],id:'private-ad',title:'PRIVATE REQUEST',priority:100}];location.hash='#/market';});
 await page.waitForTimeout(40);await page.evaluate(()=>location.hash='#/home');await page.waitForTimeout(60);
 assert.equal(await page.locator('[data-listing=hidden-secret],[data-listing=auction-secret]').count(),0);assert.doesNotMatch(await page.locator('#main').innerText(),/PRIVATE REQUEST/);count++;
 assert.deepEqual(await page.evaluate(()=>window.imageReads),['hero-0','hero-1']);count++;
 await page.locator('[data-action=hero-next]').click();await page.waitForTimeout(40);assert.deepEqual(await page.evaluate(()=>window.imageReads),['hero-0','hero-1','hero-2']);count++;
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement!==document.body),true);assert.equal(await page.locator('html').getAttribute('dir'),'rtl');count++;
 await page.evaluate(()=>location.hash='#/add');await page.getByRole('button',{name:'الدخول باستخدام Google',exact:true}).click();assert.equal(await page.evaluate(()=>window.authCalls),1);count++;
 for(const status of ['active','suspended','blocked']){
  await page.evaluate(status=>window.testAuth.emit({status:'authenticated',user:{uid:'real-user'},actor:{uid:'real-user',name:'Real user',status,active:status==='active',role:null,permissions:[]}}),status);
  await page.waitForTimeout(30);assert.equal(await page.locator('#wizard-form').count(),0,'read-only release must not offer a writable form');
  assert.match(await page.locator('#main').innerText(),status==='active'?/الكتابة|قراءة/:/غير نشط/);count++;
 }
 await page.evaluate(()=>{window.testAuth.emit({status:'authenticated',user:{uid:'real-user'},actor:{uid:'real-user',name:'Real owner',status:'active',active:true,role:'super_admin',ready:true,permissions:[],protectedUids:['real-user']}});location.hash='#/admin';});
 await page.waitForTimeout(50);assert.match(await page.locator('#main').innerText(),/Real owner/);assert.doesNotMatch(await page.locator('#main').innerText(),/مساعد تجريبي|سامي/);count++;
 for(const width of [360,390,430,768,1024,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);count++;}
 await page.evaluate(()=>window.testAuth.signOut());await page.waitForTimeout(30);assert.equal(await page.locator('.admin-sidebar').count(),0);count++;
 assert.deepEqual(errors,[]);count++;console.log('SUMMARY | '+count+'/'+count+' PASS');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
