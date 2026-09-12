import './validate-site.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const output=path.join(root,'dist');fs.mkdirSync(output,{recursive:true});
// Explicit static allowlist; admin tools, tests, backups and credentials cannot enter the build.
const files=['telemetry-page.js','commercial-model.js','commercial-images.js','commercial-public.js','commercial-admin.js','commercial.css','index.html','about.html','privacy.html','terms.html','refund-policy.html','delete-account.html','payment-demo.html','app.js','site-language.js','image-provider.js','livestock-images.js','marketplace-v2.js','listing-images-ui.js','home-page-admin.js','admin-dashboard.js','admin-notifications.js','admin-assistants.js','admin-permissions.js','payment-demo.js','style.css','launch.css','marketplace-v2.css','admin-dashboard.css','hero-livestock.png','logo-souq-alhalal.png'];
for(const file of files)fs.copyFileSync(path.join(root,file),path.join(output,file));
fs.mkdirSync(path.join(output,'fonts'),{recursive:true});
for(const file of ['NotoSansArabic.ttf','OFL-NotoSansArabic.txt'])fs.copyFileSync(path.join(root,'fonts',file),path.join(output,'fonts',file));
for(const file of ['google-g.png','concept.png','marketplace-final.css'])fs.copyFileSync(path.join(root,file),path.join(output,file));
for(const file of fs.readdirSync(root).filter(file=>/^(favicon.*|apple-touch-icon.*|site\.webmanifest)$/.test(file)))fs.copyFileSync(path.join(root,file),path.join(output,file));
console.log('PASS static build in dist; no deployment performed');
