import assert from 'node:assert/strict';
import {test} from 'node:test';
import {requestAccountDeletion} from '../melkak/account-deletion.js';
const now=Date.now();
function harness({uid='person',age=0,existing=false,enabled=true}={}){
 const writes=[];const user={uid};
 const sdk={doc:(_db,c,id)=>({c,id}),serverTimestamp:()=> 'SERVER',getIdTokenResult:async()=>({authTime:new Date(now-age).toISOString(),claims:{auth_time:Math.floor((now-age)/1000)}}),runTransaction:async(_db,fn)=>fn({get:async()=>({exists:()=>existing}),set:(ref,data)=>writes.push({ref,data})})};
 const auth={state:{user},refresh:async()=>{}};
 return {sdk,auth,config:{writesEnabled:enabled},db:{},now:()=>now,writes};
}
test('verified UID-bound request uses server time, no email or arbitrary target',async()=>{const h=harness();await requestAccountDeletion(h);assert.equal(h.writes.length,1);assert.equal(h.writes[0].ref.id,'person');assert.deepEqual(h.writes[0].data,{uid:'person',status:'requested',createdAt:'SERVER',policyVersion:'2026-09-14'});});
test('duplicate request is idempotent',async()=>{const h=harness({existing:true});await requestAccountDeletion(h);assert.equal(h.writes.length,0);});
test('stale authentication blocked',async()=>{const h=harness({age:601000});await assert.rejects(()=>requestAccountDeletion(h),{code:'RECENT_AUTH_REQUIRED'});assert.equal(h.writes.length,0);});
test('signed out blocked',async()=>{const h=harness();h.auth.state.user=null;await assert.rejects(()=>requestAccountDeletion(h),{code:'AUTH_REQUIRED'});});
test('disabled writes stay disabled',async()=>{const h=harness({enabled:false});await assert.rejects(()=>requestAccountDeletion(h),{code:'WRITES_DISABLED'});});
test('suspended user can request erasure without claiming active/admin',async()=>{const h=harness();h.auth.state.actor={status:'suspended'};await requestAccountDeletion(h);assert.equal(h.writes.length,1);});
test('identity change during verification never submits another UID',async()=>{const h=harness();h.sdk.getIdTokenResult=async()=>{h.auth.state.user={uid:'other'};return {authTime:new Date(now).toISOString()};};await assert.rejects(()=>requestAccountDeletion(h),{code:'AUTH_CHANGED'});assert.equal(h.writes.length,0);});
test('verification failure does not become a successful request',async()=>{const h=harness();h.sdk.getIdTokenResult=async()=>{throw Error('NETWORK');};await assert.rejects(()=>requestAccountDeletion(h));assert.equal(h.writes.length,0);});
