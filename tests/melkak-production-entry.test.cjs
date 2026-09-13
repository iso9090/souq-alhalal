const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/asus/AppData/Local/OpenAI/Codex/runtimes/cua_node/b58ca2eaa616c2da/bin/node_modules/playwright-core');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});let passed=0;try {
for(const origin of ['https://iso9090.github.io','https://souq-al-halal-9e3e8.web.app','http://localhost']) {
 const page=await browser.newPage(),errors=[],requested=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());requested.push(u.pathname);if(u.origin!==origin)return route.abort();const file=path.resolve('.'+u.pathname+(u.pathname==='/'?'index.html':''));if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:'Not found'});return route.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream'});});
 await page.goto(origin);await page.waitForTimeout(400);
 assert.deepEqual(errors,[],origin+' must fail closed without unhandled errors');
 assert.match(await page.locator('#app').innerText(),/إعداد|صيانة/);
 assert.equal(await page.evaluate(()=>Boolean(window.__melkak)),false);
 assert.equal(await page.locator('button,input,select,form').count(),0);
 for(const suffix of ['/app.js','/fixtures.js','/datasource.js','/auth-adapter.js'])assert.equal(requested.some(p=>p.endsWith(suffix)),false,'Gate must not load '+suffix);
 await page.reload();await page.waitForTimeout(100);assert.deepEqual(errors,[]);passed++;await page.close();
}
console.log('SUMMARY | '+passed+'/'+passed+' PASS');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
