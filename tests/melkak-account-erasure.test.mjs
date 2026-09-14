import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planErasure,executeErasure,erasureProject} from '../scripts/account-erasure-core.mjs';
const documents=()=>[
 {path:'users/u',data:{uid:'u',email:'private@example.test'}},
 {path:'users/other',data:{uid:'other'}},
 {path:'marketplaceAccountDeletionRequests/u',data:{uid:'u',status:'requested',policyVersion:'2026-09-14'}},
 {path:'marketplaceListings/item',data:{ownerUid:'u',images:['data:image/jpeg;base64,/9j/AA==']}},
 {path:'marketplaceRequests/report',data:{ownerUid:'other',listingId:'item',type:'report'}},
 {path:'marketplaceAuditLogs/log',data:{actorUid:'admin',targetCollection:'marketplaceListings',targetId:'item'}},
 {path:'users/u/favorites/f',data:{listingId:'other'}},
 {path:'marketplaceListings/unrelated',data:{ownerUid:'other'}}
];
test('erasure includes identity, owned photos and related requests/audit, preserves other account',()=>{const p=planErasure('u',documents(),[]);assert.ok(p.paths.includes('marketplaceRequests/report'));assert.ok(p.paths.includes('marketplaceAuditLogs/log'));assert.ok(p.paths.includes('users/u/favorites/f'));assert.ok(!p.paths.includes('users/other'));assert.ok(!p.paths.includes('marketplaceListings/unrelated'));});
test('protected owner cannot be erased',()=>assert.throws(()=>planErasure('u',documents(),['u']),/PROTECTED_OWNER/));
test('missing verified request blocks erasure',()=>assert.throws(()=>planErasure('u',documents().filter(x=>!x.path.startsWith('marketplaceAccountDeletionRequests')),[]),/REQUEST_REQUIRED/));
test('unknown namespace fails closed',()=>assert.throws(()=>planErasure('u',[...documents(),{path:'newUnknown/x',data:{uid:'u'}}],[]),/UNKNOWN_COLLECTION/));
test('externally stored listing images need provider cleanup before completion',()=>{const d=documents();d[3].data.images=['https://res.cloudinary.com/example/image/upload/a.jpg'];assert.throws(()=>planErasure('u',d,[]),/EXTERNAL_ASSETS/);});
test('processor requires manifest confirmation and never logs secrets',async()=>{await assert.rejects(()=>executeErasure({plan:planErasure('u',documents(),[]),confirmation:'wrong'}),/CONFIRMATION/);});
test('real auth delete occurs after all scoped data deletes, request last',async()=>{const calls=[],p=planErasure('u',documents(),[]);await executeErasure({plan:p,confirmation:p.sha,lock:async()=>calls.push('lock'),remove:async path=>calls.push(path),deleteIdentity:async uid=>calls.push('auth:'+uid),verify:async()=>true});assert.equal(calls[0],'lock');assert.ok(calls.indexOf('auth:u')>calls.indexOf('users/u'));assert.equal(calls.at(-1),'marketplaceAccountDeletionRequests/u');});
test('failure does not delete auth or claim completion',async()=>{let auth=false;const p=planErasure('u',documents(),[]);await assert.rejects(()=>executeErasure({plan:p,confirmation:p.sha,lock:async()=>{},remove:async()=>{throw Error('offline');},deleteIdentity:async()=>{auth=true;},verify:async()=>true}));assert.equal(auth,false);});

test('recovery retains deleted parent paths to find orphaned descendants',()=>{const rows=documents().filter(d=>d.path!=='marketplaceListings/item');rows.find(d=>d.path==='marketplaceAccountDeletionRequests/u').data={uid:'u',status:'processing',policyVersion:'2026-09-14',resourcePaths:['marketplaceListings/item']};rows.push({path:'marketplaceListings/item/private/x',data:{note:'orphan'}});const p=planErasure('u',rows,[]);assert.ok(p.paths.includes('marketplaceListings/item/private/x'));});
test('unsafe recovery paths cannot cross identity boundaries',()=>{const rows=documents();rows[2].data.status='processing';rows[2].data.resourcePaths=['users/other'];assert.throws(()=>planErasure('u',rows,[]),/UNSAFE_RECOVERY_PATH/);});

test('UID prefix cannot authorize deletion of a different profile',()=>{const rows=documents();rows.push({path:'users/u2',data:{uid:'u2',createdBy:'u'}});assert.throws(()=>planErasure('u',rows,[]),/SHARED_RECORD_REVIEW_REQUIRED/);});
test('same ID in unrelated collection does not cascade',()=>{const rows=documents();rows.push({path:'marketplaceAuditLogs/unrelated',data:{actorUid:'boss',targetCollection:'users',targetId:'item'}});assert.ok(!planErasure('u',rows,[]).paths.includes('marketplaceAuditLogs/unrelated'));});

test('reporter deletion never follows reverse history pointer into another seller listing',()=>{const rows=documents();rows.push({path:'marketplaceRequests/my-report',data:{ownerUid:'u',type:'report'}},{path:'marketplaceListings/seller-item',data:{ownerUid:'seller',historyRequestId:'my-report'}});assert.ok(!planErasure('u',rows,[]).paths.includes('marketplaceListings/seller-item'));});
test('legacy bidder identity on another seller auction stops for explicit shared record review',()=>{const rows=documents();rows.push({path:'auctions/old',data:{sellerId:'seller',lastBidderId:'u',winnerId:'u'}});assert.throws(()=>planErasure('u',rows,[]),/SHARED_RECORD_REVIEW_REQUIRED/);});
test('legacy participation owned by deleting bidder is removed',()=>{const rows=documents();rows.push({path:'auctionParticipations/p',data:{bidderId:'u',auctionId:'other'}});assert.ok(planErasure('u',rows,[]).paths.includes('auctionParticipations/p'));});
test('admin creator reference on another identity requires redaction review, not identity deletion',()=>{const rows=documents();rows.push({path:'adminAccess/other',data:{role:'admin_assistant',createdByAdminUid:'u'}});assert.throws(()=>planErasure('u',rows,[]),/SHARED_RECORD_REVIEW_REQUIRED/);});

test('mixed emulator and Production services rejected before initialization',()=>{for(const env of [{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'},{FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080'},{FIRESTORE_EMULATOR_HOST:'remote',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'}])assert.throws(()=>erasureProject(env),/LOCAL_EMULATORS_ONLY/);assert.equal(erasureProject({}),'souq-al-halal-9e3e8');assert.equal(erasureProject({FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080'}),'demo-melkak-erasure');});

test('anonymized shared conversation is not deleted through a listing reference',()=>{const rows=documents();rows.push({path:'conversations/c',data:{sellerId:'erased',buyerId:'v',listingId:'item'}},{path:'conversations/c/messages/m',data:{senderId:'v',text:'historical'}});assert.throws(()=>planErasure('u',rows,[]),/SHARED_RECORD_REVIEW_REQUIRED/);});
