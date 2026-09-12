import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../src/index.js';
import {localEnvironmentAllowed,createLocalEmulatorHandler} from '../src/local-emulator.js';
import {invoke} from './fixtures.mjs';
test('Functions export is second generation and private',()=>{assert.equal(api.__endpoint.platform,'gcfv2');assert.deepEqual(api.__endpoint.httpsTrigger.invoker,['private']);});
test('real function entrypoint remains disabled without accessing credentials',async()=>{const r=await invoke(api,{body:{}});assert.equal(r.status,503);assert.equal(r.body.code,'backend-disabled');});
test('local adapter rejects real project and missing emulator hosts',()=>{const valid={FUNCTIONS_EMULATOR:'true',LOCAL_TRUSTED_BACKEND:'true',GCLOUD_PROJECT:'demo-backend',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'};assert.equal(localEnvironmentAllowed(valid),true);for(const change of [{GCLOUD_PROJECT:'souq-al-halal-9e3e8'},{FIREBASE_AUTH_EMULATOR_HOST:''},{FIRESTORE_EMULATOR_HOST:'remote:8080'},{LOCAL_TRUSTED_BACKEND:'false'}]){assert.equal(localEnvironmentAllowed({...valid,...change}),false);assert.throws(()=>createLocalEmulatorHandler({...valid,...change},{}));}});
