import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {environmentAllowed} from '../melkak/environment.js';
import {GROUPS} from '../admin-permissions.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];
const mode=args.includes('--mode')?arg('--mode'):(process.env.MELKAK_ENV||'production');
if(mode!=='review')throw Error('Production build blocked: datasource/config not ready. Use build:review with an explicit review origin.');
const origin=args.includes('--origin')?arg('--origin'):process.env.MELKAK_REVIEW_ORIGIN;
const config={mode:'review',datasource:'demo',reviewOrigin:origin};
if(!origin||!environmentAllowed(config,new URL(origin)))throw Error('A dedicated non-production HTTPS review origin is required');
const out=path.resolve(args.includes('--out')?arg('--out'):path.join(root,'dist'));
if(out===root||out.startsWith(path.join(root,'melkak')+path.sep))throw Error('Unsafe build output');
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('Build output must be empty; use a new --out directory to avoid stale legacy files');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'scripts/review-publish-manifest.json'),'utf8'));
fs.mkdirSync(out,{recursive:true});
for(const file of manifest.files){const dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
// Review stays unindexed even though the approved Production entry is discoverable.
fs.writeFileSync(path.join(out,'index.html'),fs.readFileSync(path.join(out,'index.html'),'utf8').replace('content="index,follow"','content="noindex,nofollow"'));
fs.writeFileSync(path.join(out,'melkak/runtime-config.js'),'export default Object.freeze('+JSON.stringify(config)+');\n');
// This public permission vocabulary is a review-only projection; original permission code is unchanged.
const groups=GROUPS.filter(([,items])=>!items.some(([key])=>/^(auctions_|purchase_requests_)/.test(key)));
const perms=fs.readFileSync(path.join(root,'admin-permissions.js'),'utf8').replace(/export const GROUPS = \[[\s\S]*?\n\];/,'export const GROUPS = '+JSON.stringify(groups)+';');
fs.writeFileSync(path.join(out,'admin-permissions.js'),perms);
fs.writeFileSync(path.join(out,'publish-manifest.json'),JSON.stringify({mode,origin,datasource:'demo',legacy:'EXCLUDED',files:manifest.files},null,2)+'\n');
console.log('PASS isolated REVIEW build: '+out);
