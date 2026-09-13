const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/asus/AppData/Local/OpenAI/Codex/runtimes/cua_node/b58ca2eaa616c2da/bin/node_modules/playwright-core');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});let passed=0;try {
for(const valid of [true,false])for(const origin of ['https://iso9090.github.io','https://souq-al-halal-9e3e8.web.app','http://localhost']) {
 const page=await browser.newPage(),errors=[],requested=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());requested.push(u.pathname);if(u.origin!==origin)return route.abort();
 if(!valid&&u.pathname.endsWith('/runtime-config.js'))return route.fulfill({contentType:'text/javascript',body:"export default {mode:'production',datasource:'unconfigured',authProvider:'firebase'}"});
 if(valid&&u.pathname.endsWith('/production-bootstrap.js'))return route.fulfill({contentType:'text/javascript',body:"export async function prepareProduction({config}) { if(config.datasource!=='production') throw Error('wrong source'); return {ready:true,store:{source:'production'},auth:{source:'firebase'}}; }"});
 if(u.pathname.endsWith('/app.js'))return route.fulfill({contentType:'text/javascript',body:"export async function startMarketplace({config,store,auth}) { if(store.source!=='production'||auth.source!=='firebase') throw Error('missing services'); document.getElementById('app').textContent='Real marketplace started'; window.started=true; }"});
 const file=path.resolve('.'+u.pathname+(u.pathname==='/'?'index.html':''));if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:'Not found'});return route.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream'});});
 await page.goto(origin);await page.waitForTimeout(300);assert.deepEqual(errors,[]);
 if(valid){assert.equal(await page.evaluate(()=>window.started),true);assert.match(await page.locator('#app').innerText(),/Real marketplace/);}else{assert.match(await page.locator('#app').innerText(),/إعدادات التشغيل غير مكتملة/);assert.equal(requested.some(p=>p.endsWith('/auth-adapter.js')),false);}
 for(const suffix of ['/fixtures.js','/datasource.js','/demo-auth.js'])assert.equal(requested.some(p=>p.endsWith(suffix)),false,'Production must not request '+suffix);
 passed++;await page.close();
}
console.log('SUMMARY | '+passed+'/'+passed+' PASS');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
