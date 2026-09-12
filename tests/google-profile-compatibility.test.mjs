import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment, assertFails} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc, updateDoc, runTransaction, serverTimestamp} from 'firebase/firestore';

// Supply a read-only Admin SDK export {source:[{name,content}]} of deployed Rules.
// Never obtains credentials or connects to Production from this test.
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw Error('Local emulator required');
if (!process.env.PRODUCTION_RULES_SNAPSHOT) throw Error('PRODUCTION_RULES_SNAPSHOT required');
const snapshot = JSON.parse(fs.readFileSync(process.env.PRODUCTION_RULES_SNAPSHOT, 'utf8'));
const deployed = snapshot.source.find(file => file.name === 'firestore.rules')?.content;
assert.ok(deployed, 'Deployed Rules export required');
const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const functionSource = source.slice(source.indexOf('async function ensureUserProfile('), source.indexOf('async function getUserProfile('));
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log('PASS | ' + name); };
for (const [label, rules] of [['production', deployed], ['local', fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')]]) {
  const env = await initializeTestEnvironment({projectId: 'demo-profile-' + label, firestore: {rules}});
  const errors = [];
  const writes = [];
  const user = (uid, provider = 'google.com') => ({uid, email: uid + '@example.test', displayName: 'Google buyer', phoneNumber: provider === 'phone' ? '+971500000000' : null, providerData: [{providerId: provider}]});
  const dbFor = (u, claims = {}) => env.authenticatedContext(u.uid, {email: u.email, firebase: {sign_in_provider: u.providerData[0].providerId}, ...claims}).firestore();
  function ensure(u, claims = {}) {
    const db = dbFor(u, claims);
    const dependencies = {db, doc, serverTimestamp, console: {error: (...args) => errors.push(args)},
      runTransaction: (store, callback) => runTransaction(store, transaction => callback({
        get: ref => transaction.get(ref),
        set: (ref, data) => { writes.push({path: ref.path, data}); return transaction.set(ref, data); },
        update: (ref, data) => { writes.push({path: ref.path, data}); return transaction.update(ref, data); }
      }))};
    // Use the SDK's realm so payload objects keep the ordinary Object prototype.
    const create = new Function(...Object.keys(dependencies), functionSource + '\nreturn ensureUserProfile;');
    return create(...Object.values(dependencies))(u);
  }
  try {
    await env.clearFirestore();
    const google = user('new-google');
    await check(label + ': actual client creates minimal Google profile', async () => {
      assert.equal(await ensure(google), true);
      const data = (await getDoc(doc(dbFor(google), 'users', google.uid))).data();
      assert.deepEqual(Object.keys(data).sort(), ['accountType','createdAt','displayName','lastLoginAt','status','uid']);
      assert.equal(data.accountType, 'buyer'); assert.equal(data.status, 'active');
      assert.equal(data.displayName, google.displayName);
    });
    await check(label + ': repeated login does not write or duplicate', async () => {
      const ref = doc(dbFor(google), 'users', google.uid), before = (await getDoc(ref)).data();
      writes.length = 0;
      assert.equal(await ensure(google), true); assert.equal(await ensure(google), true);
      assert.equal(writes.length, 0); assert.deepEqual((await getDoc(ref)).data(), before);
    });
    for (const status of ['blocked', 'suspended']) await check(label + ': ' + status + ' stays protected', async () => {
      const u = user(status);
      await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'users', u.uid), {uid:u.uid,status,accountType:'buyer'}));
      writes.length = 0; assert.equal(await ensure(u), false); assert.equal(writes.length, 0);
    });
    await check(label + ': ordinary user cannot escalate or change registry', async () => {
      const db = dbFor(google);
      await assertFails(updateDoc(doc(db, 'users', google.uid), {admin:true,role:'super_admin'}));
      await assertFails(setDoc(doc(db, 'adminAccess', google.uid), {role:'super_admin'}));
      await assertFails(setDoc(doc(db, 'adminSecurity/config'), {superAdminUids:[google.uid],enabled:true}));
    });
    await check(label + ': existing owner document and permissions are preserved', async () => {
      const u = user('owner');
      const profile = {uid:u.uid,status:'active',accountType:'buyer',email:u.email,authProvider:'google',marker:'preserve'};
      await env.withSecurityRulesDisabled(async c => {
        await setDoc(doc(c.firestore(), 'users', u.uid), profile);
        await setDoc(doc(c.firestore(), 'adminAccess', u.uid), {role:'super_admin'});
        await setDoc(doc(c.firestore(), 'adminSecurity/config'), {superAdminUids:[u.uid],enabled:true});
      });
      writes.length = 0; assert.equal(await ensure(u, {admin:true}), true); assert.equal(writes.length, 0);
      const db = dbFor(u, {admin:true});
      assert.deepEqual((await getDoc(doc(db,'users',u.uid))).data(), profile);
      assert.equal((await getDoc(doc(db,'adminAccess',u.uid))).data().role, 'super_admin');
      assert.deepEqual((await getDoc(doc(db,'adminSecurity/config'))).data().superAdminUids, [u.uid]);
    });
    for (const provider of ['password', 'phone']) await check(label + ': ' + provider + ' profile regression', async () => {
      const u = user(provider, provider);
      assert.equal(await ensure(u), true); assert.equal(await ensure(u), true);
      const data = (await getDoc(doc(dbFor(u),'users',u.uid))).data();
      assert.equal(data.status, 'active');
      if (provider === 'phone') assert.equal(data.phoneNumber, u.phoneNumber);
    });
    await check(label + ': valid client flow has zero errors', async () => assert.deepEqual(errors, []));
  } finally { await env.cleanup(); }
}
console.log('SUMMARY | ' + passed + '/' + passed + ' passed');
