const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'melkak-production-'));
const r=cp.spawnSync(process.execPath,['scripts/build-site.mjs','--mode','production','--out',out],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
const manifest=JSON.parse(fs.readFileSync(path.join(out,'publish-manifest.json')));assert.equal(manifest.mode,'production');
for(const f of ['index.html','melkak/app.js','melkak/production-bootstrap.js','melkak/production-datasource.js','melkak/production-services.js','melkak/auth-adapter.js'])assert.ok(fs.existsSync(path.join(out,f)),f);
for(const f of ['app.js','_legacy','melkak/datasource.js','melkak/fixtures.js','melkak/demo-auth.js','tests','scripts'])assert.equal(fs.existsSync(path.join(out,f)),false,f);
const config=fs.readFileSync(path.join(out,'melkak/runtime-config.js'),'utf8');assert.match(config,/writesEnabled[^a-z]+false/);assert.doesNotMatch(config,/unconfigured/);
const html=fs.readFileSync(path.join(out,'index.html'),'utf8');assert.match(html,/https:\/\/www.gstatic.com/);assert.match(html,/https:\/\/souq-al-halal-9e3e8.firebaseapp.com/);
console.log('PASS production artifact allowlist/config/CSP');
