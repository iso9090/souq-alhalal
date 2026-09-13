import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {composeTransitionRules} from './build-melkak-transition-rules.mjs';

const legacyCreate=`allow create: if activeAccount()
 && request.auth.uid == uid
 && request.resource.data.keys().hasOnly(['uid', 'phoneNumber', 'displayName', 'accountType', 'status', 'createdAt', 'lastLoginAt'])
 && request.resource.data.uid == uid
 && request.resource.data.status == 'active'
 && request.resource.data.accountType in ['buyer', 'seller', 'both']
 && request.resource.data.createdAt == request.time
 && request.resource.data.lastLoginAt == request.time;`;
const googleCondition=`&& (!request.resource.data.keys().hasAny(['email', 'phone', 'authProvider']) || (
 request.resource.data.keys().hasAll(['email', 'phone', 'authProvider'])
 && request.auth.token.firebase.sign_in_provider == 'google.com'
 && request.resource.data.authProvider == 'google'
 && request.resource.data.accountType == 'buyer'
 && request.resource.data.email is string
 && request.resource.data.email == request.auth.token.get('email', '')
 && request.resource.data.phone is string
 && request.resource.data.phone == request.auth.token.get('phone_number', '')
 ));`;
const googleCreate=legacyCreate.replace("'lastLoginAt']","'lastLoginAt', 'email', 'phone', 'authProvider']").replace(/;$/,' '+googleCondition);
// Canonicalization is used only for checking known clauses, never for the output baseline.
const canonical=text=>text.replace(/\/\/[^\n]*/g,'').replace(/\s+/g,'').trim();
function userCreate(source){
 const matches=[...source.matchAll(/match\s+\/users\/\{uid\}\s*\{/g)];if(matches.length!==1)throw Error('Unexpected users match count');
 const index=source.indexOf('allow create:',matches[0].index),end=source.indexOf(';',index)+1;
 if(index<0||end===0||index>source.indexOf('allow update:',matches[0].index))throw Error('Unexpected users create block');
 return {index,end,text:source.slice(index,end)};
}
const oldReason='request.resource.data.reason is string && request.resource.data.reason.size() > 0 && request.resource.data.reason.size() <= 500';
const newReason="request.resource.data.reason is string && request.resource.data.reason.trim().size() >= 3 && request.resource.data.reason.size() <= 500 && !request.resource.data.reason.matches('[\\\\s\\\\p{Z}]*')";
function hardenReason(source,collection){
 const marker='match /'+collection+'/',start=source.indexOf(marker);if(start<0||source.indexOf(marker,start+1)>=0)throw Error('Unexpected '+collection+' match count');
 const next=source.indexOf('\n    match /',start+marker.length),end=next<0?source.length:next,block=source.slice(start,end);
 if(block.split(oldReason).length!==2)throw Error('Unexpected '+collection+' reason predicate');
 return source.slice(0,start)+block.replace(oldReason,newReason)+source.slice(end);
}
export function prepareReleaseBaseline(baseline,localRules,{hardenReports=false}={}){
 const old=userCreate(baseline),next=userCreate(localRules);
 if(canonical(old.text)!==canonical(legacyCreate))throw Error('Unexpected production users create clause; manual review required');
 if(canonical(next.text)!==canonical(googleCreate))throw Error('Unexpected local users create clause; only reviewed Google metadata delta allowed');
 const newline=baseline.includes('\r\n')?'\r\n':'\n';
 let result=baseline.slice(0,old.index)+next.text.replace(/\r?\n/g,newline)+baseline.slice(old.end);
 result=hardenReason(result,'adminAuditLogs');if(hardenReports)result=hardenReason(result,'reports');return result;
}
export function composeReleaseRules(baseline,localRules,proposed,options={}){return composeTransitionRules(prepareReleaseBaseline(baseline,localRules,options),proposed);}
async function main(){
 const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2){if(!['--baseline','--local','--proposed','--out'].includes(args[i])||!args[i+1]||options[args[i]])throw Error('Usage: --baseline file --local file --proposed file --out file');options[args[i]]=path.resolve(args[i+1]);}
 if(Object.keys(options).length!==4||[options['--baseline'],options['--local'],options['--proposed']].includes(options['--out']))throw Error('All four paths required; output must differ from inputs');
 const [baseline,local,proposed]=await Promise.all(['--baseline','--local','--proposed'].map(key=>fs.readFile(options[key],'utf8')));
 const result=composeReleaseRules(baseline,local,proposed);await fs.writeFile(options['--out'],result,'utf8');console.log(JSON.stringify({file:options['--out'],sha256:createHash('sha256').update(result).digest('hex'),baselineSha256:createHash('sha256').update(baseline).digest('hex'),deltas:['users.create Google identity metadata','adminAuditLogs nonblank reason','new marketplace namespace']}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
