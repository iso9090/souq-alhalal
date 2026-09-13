import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import config from '../melkak/runtime-config.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),i=args.indexOf('--out');
const out=path.resolve(i<0?path.join(root,'dist'):args[i+1]);
if(out===root||root.startsWith(out+path.sep)||out.startsWith(path.join(root,'melkak')+path.sep))throw Error('Unsafe build output');
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('Build output must be empty');
if(config.mode!=='production'||config.datasource!=='production'||config.authProvider!=='firebase'||!(config.writesEnabled===false||(config.writesEnabled===true&&config.releaseId==='melkak-production-v1'&&config.includeLegacy===false&&config.modernCommercial===true)))throw Error('Production configuration incomplete or writes rollout not approved');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'scripts/production-publish-manifest.json'),'utf8'));
for(const file of manifest.files)if(!fs.statSync(path.join(root,file)).isFile())throw Error('Missing public file: '+file);
fs.mkdirSync(out,{recursive:true});
for(const file of manifest.files){const dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
fs.writeFileSync(path.join(out,'publish-manifest.json'),JSON.stringify({mode:'production',datasource:'production',writesEnabled:config.writesEnabled,legacy:'EXCLUDED',files:manifest.files},null,2));
console.log('PASS production build: '+out);
