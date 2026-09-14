import {initializeApp,applicationDefault,deleteApp} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {planErasure,executeErasure,erasureProject} from '../../scripts/account-erasure-core.mjs';
// Local operator only. Never published or imported by the browser. No service-account key.
const args=process.argv.slice(2),uid=args[0],mode=args[1]||'--plan',confirmation=args[2];
if(!uid||!['--plan','--begin','--execute'].includes(mode))throw Error('Usage: node process.mjs UID --plan | --begin PLAN_SHA | --execute PLAN_SHA');
if(process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error('Use existing user ADC, never a service-account key file');
const projectId=erasureProject(process.env),emulator=projectId.startsWith('demo-');
const app=initializeApp({projectId,...(!emulator?{credential:applicationDefault()}:{})});
const db=getFirestore(app),auth=getAuth(app);
async function inventory(){const result=[];async function walk(collection){for(const ref of await collection.listDocuments()){const snap=await ref.get();if(snap.exists)result.push({path:ref.path,data:snap.data()});if(result.length>10000)throw Error('INVENTORY_LIMIT_MANUAL_REVIEW_REQUIRED');for(const child of await ref.listCollections())await walk(child);}}for(const collection of await db.listCollections())await walk(collection);return result;}
async function current(){const registry=(await db.doc('adminSecurity/config').get()).data();if(registry?.enabled!==true||!Array.isArray(registry.superAdminUids))throw Error('REGISTRY_UNAVAILABLE');return planErasure(uid,await inventory(),registry.superAdminUids);}
try{
 const plan=await current();
 if(mode==='--plan'){console.log(JSON.stringify({mode:'READ_ONLY',projectId,uid,paths:plan.paths,sha:plan.sha,note:'Review every path. Inventory cap 10000. No data contents or tokens printed.'},null,2));}
 else if(mode==='--begin'){
  if(confirmation!==plan.sha)throw Error('CONFIRMATION');
  // Disable/revoke is a temporary barrier, explicitly NOT completion.
  await auth.updateUser(uid,{disabled:true});await auth.revokeRefreshTokens(uid);
  await db.runTransaction(async tx=>{const ref=db.doc(plan.requestPath),r=await tx.get(ref);if(!['requested','processing'].includes(r.data()?.status))throw Error('REQUEST_REQUIRED');
   tx.set(db.doc('users/'+uid),{status:'deletion_processing'},{merge:true});
   tx.update(ref,{status:'processing',processingAt:FieldValue.serverTimestamp(),resourcePaths:plan.paths});});
  console.log('PROCESSING ONLY. Wait at least 65 minutes for issued ID tokens to expire, then run --plan again and review a new --execute hash. No completion claimed.');
 }else{
  const request=(await db.doc(plan.requestPath).get()).data();
  if(request.status!=='processing'||!request.processingAt?.toMillis||Date.now()-request.processingAt.toMillis()<65*60000)throw Error('TOKEN_EXPIRY_WAIT_REQUIRED');
  if(args[3]!=='--external-data-cleared')throw Error('EXTERNAL_BACKUPS_AND_PROVIDER_DATA_REVIEW_REQUIRED');
  const identity=await auth.getUser(uid).catch(e=>{if(e.code==='auth/user-not-found')return null;throw e;});if(identity&&!identity.disabled)throw Error('ACCOUNT_MUST_REMAIN_LOCKED');
  await executeErasure({plan,confirmation,lock:async()=>{const next=await current();if(next.sha!==plan.sha)throw Error('INVENTORY_CHANGED');await db.doc(plan.requestPath).update({resourcePaths:plan.paths});},remove:async path=>db.doc(path).delete(),deleteIdentity:async id=>{try{await auth.deleteUser(id);}catch(e){if(e.code!=='auth/user-not-found')throw e;}},verify:async()=>{const rows=await inventory(),registry=(await db.doc('adminSecurity/config').get()).data(),remaining=planErasure(uid,rows,registry.superAdminUids);return rows.filter(d=>d.path!==plan.requestPath).every(d=>!remaining.paths.includes(d.path)&&!plan.paths.some(p=>d.path.startsWith(p+'/')));}});
  console.log('DELETED: Firebase Auth identity and scoped associated data removed; no retained personal completion record.');
 }
}catch(error){console.error(error.code||error.message);process.exitCode=1;}finally{await deleteApp(app);}
