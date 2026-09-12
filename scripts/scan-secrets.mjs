import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))];
const issues=[];
for(const file of files){
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())continue;
 if(/(^|\/)\.env(?:\.|$)/.test(file)&&!file.endsWith('.env.example'))issues.push(file+': private environment file');
 if(/service[-_]?account.*\.json$/i.test(file))issues.push(file+': service account file');
 if(!/\.(?:js|mjs|cjs|json|md|html|yml|yaml|example)$/.test(file))continue;
 const s=fs.readFileSync(file,'utf8');
 if(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(s)||/"private_key"\s*:\s*"[^"\s]/.test(s))issues.push(file+': private key');
 if(/(?:CLOUDINARY_API_SECRET|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET)\s*[:=]\s*["'][^"'\r\n]+["']/.test(s)||/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/.test(s)||/\bwhsec_[A-Za-z0-9]{16,}\b/.test(s))issues.push(file+': embedded secret value');
}
if(issues.length){console.error(issues.join('\n'));process.exitCode=1;}else console.log('SECRET SCAN: PASS — '+files.length+' repository files checked; no values printed');
