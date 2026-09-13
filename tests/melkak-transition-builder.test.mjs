import assert from 'node:assert/strict';
import {composeTransitionRules} from '../scripts/build-melkak-transition-rules.mjs';
const baseline=`rules_version = '2';\nservice cloud.firestore {\n match /databases/{database}/documents {\n function owner(){return true;}\n match /users/{uid} {allow read: if owner();}\n // Keep this exact legacy comment with }\n }\n}\n`;
const proposed=`// LOCAL PROPOSAL ONLY\nrules_version = '2';service cloud.firestore {match /databases/{database}/documents {
 function owner(){return active();} function active(){return true;}
 match /marketplaceListings/{id}{allow read: if owner() && 'owner() }' == 'owner() }';}
 match /users/{uid}{allow write: if false;}
 match /adminAccess/{uid}{allow write: if false;}
 match /adminSecurity/{id}{allow write: if false;}
}}`;
const result=composeTransitionRules(baseline,proposed);
assert.doesNotMatch(result,/^[\t ]+$/m,'Insertion must not turn closing-brace indentation into a whitespace-only line');
assert.ok(result.includes('function owner(){return true;}'));
assert.ok(result.includes('function mkOwner(){return mkActive();}'));
assert.ok(result.includes("if mkOwner() && 'owner() }'"));
assert.equal((result.match(/match \/users/g)||[]).length,1);
assert.ok(!result.includes('match /adminAccess'));
assert.ok(!result.includes('LOCAL PROPOSAL'));
const marker=result.indexOf('\n// MELKAK marketplace transition');
assert.ok(marker>0);const end=result.indexOf('// End MELKAK marketplace transition\n',marker)+'// End MELKAK marketplace transition\n'.length;
assert.equal(result.slice(0,marker)+result.slice(end),baseline);
assert.throws(()=>composeTransitionRules(result,proposed),/already/i);
for(const invalid of [baseline.slice(0,-3),baseline+"'",baseline+' /*'])assert.throws(()=>composeTransitionRules(invalid,proposed),/malformed|unclosed/i);
assert.throws(()=>composeTransitionRules(baseline,proposed.slice(0,-1)),/malformed/i);
assert.ok(composeTransitionRules(baseline.replace('// Keep','// 🐪 Keep'),proposed).includes('mkOwner()'));
assert.ok(composeTransitionRules(baseline,proposed.replace('// LOCAL','// 🐪 LOCAL')).includes('function mkOwner(){return mkActive();}'));
console.log('PASS transition composer preserves baseline, renames functions, removes support blocks and rejects malformed/duplicate input');
