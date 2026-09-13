const fs=require('fs'),path=require('path'),cp=require('child_process');
const {snapshot}=require('../tests/review-test-support.cjs');
const root=path.resolve(__dirname,'..');process.chdir(root);
const target=snapshot();
// A separate legacy fixture root, never the MELKAK entry or review artifact.
fs.copyFileSync(path.join(root,'_legacy/legacy-index.html'),path.join(target,'index.html'));
fs.writeFileSync(path.join(target,'LEGACY-TEST-TARGET.json'),JSON.stringify({target:'legacy',entrySource:'_legacy/legacy-index.html',production:false}));
fs.symlinkSync(path.join(root,'node_modules'),path.join(target,'node_modules'),'junction');
if(process.argv.includes('--prepare')){console.log(target);process.exit(0)}
const tests=process.argv.slice(2);if(!tests.length)throw Error('Supply explicit legacy test paths');
const env={...process.env};delete env.NODE_OPTIONS;
for(const test of tests){if(!/^tests\/[a-z0-9-]+\.test\.(cjs|mjs)$/.test(test)||test.includes('melkak'))throw Error('Not a legacy test target: '+test);const result=cp.spawnSync(process.execPath,[test],{cwd:target,env,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1)}
