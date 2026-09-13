const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),cp=require('child_process');
// Exercise the publication boundary using GitHub Pages/Jekyll's explicit
// exclude list and standard underscore/dot source exclusion. No live deploy.
assert.equal(fs.existsSync('legacy-index.html'),false,'Legacy entry must leave the public root');
assert.ok(fs.existsSync('_legacy/legacy-index.html'));
const config=JSON.parse(fs.readFileSync('_config.yml','utf8'));
assert.equal(fs.existsSync('.nojekyll'),false,'Branch publication must apply Jekyll exclusions');
const files=cp.execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split(/\r?\n/);
const published=files.filter(f=>fs.existsSync(f)&&!f.split('/').some(s=>/^[_.]/.test(s))&&!config.exclude.some(x=>f===x||f.startsWith(x+'/')));
for(const f of ['legacy-index.html','_legacy/legacy-index.html','about.html','delete-account.html','payment-demo.html','app.js','admin-dashboard.js','payment-demo.js','melkak/app.js','melkak/fixtures.js','melkak/datasource.js','melkak/auth-adapter.js','tests/melkak-review-smoke.test.cjs'])assert.equal(published.includes(f),false,f+' must not publish');
for(const f of ['index.html','melkak/entry.js','melkak/environment.js','melkak/runtime-config.js','melkak/production-bootstrap.js','melkak/style.css'])assert.ok(published.includes(f),f+' must publish');
const legacy=cp.spawnSync(process.execPath,['scripts/test-legacy.cjs','--prepare'],{encoding:'utf8'});assert.equal(legacy.status,0,legacy.stderr);
const target=legacy.stdout.trim();assert.equal(fs.readFileSync(path.join(target,'index.html'),'utf8'),fs.readFileSync('_legacy/legacy-index.html','utf8'));
assert.equal(JSON.parse(fs.readFileSync(path.join(target,'LEGACY-TEST-TARGET.json'))).entrySource,'_legacy/legacy-index.html');
console.log('SUMMARY | 1/1 PASS');
