// Trusted operator tool. No credentials are generated or stored. Default: read-only.
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createInterface} from 'node:readline/promises';

export const PROJECT='souq-al-halal-9e3e8';
export function planRegistry(accounts,existing=null){
  const owners=accounts.filter(a=>a.customClaims?.admin===true);
  const uids=[...new Set(owners.map(a=>a.uid))].sort();
  if(!uids.length||!owners.some(a=>!a.disabled&&(a.profileStatus===undefined||a.profileStatus==='active')))throw Error('NO_ACTIVE_OWNER');
  if(existing){
    if(!Array.isArray(existing.superAdminUids)||!existing.superAdminUids.length)throw Error('INVALID_REGISTRY');
    // Never enroll a new claim holder or remove an owner on a later run.
    if(JSON.stringify([...existing.superAdminUids].sort())!==JSON.stringify(uids))throw Error('OWNER_SET_CHANGED');
    return {write:false,ownerCount:uids.length,uids,digest:createHash('sha256').update(JSON.stringify(uids)).digest('hex')};
  }
  return {write:true,ownerCount:uids.length,uids,digest:createHash('sha256').update(JSON.stringify(uids)).digest('hex')};
}
export function parseOptions(args){
  const supported=new Set(['--project','--dry-run','--apply']);
  for(let i=0;i<args.length;i++){if(!supported.has(args[i]))throw Error('INVALID_ARGUMENT');if(args[i]==='--project')i++;}
  const index=args.indexOf('--project'),project=index<0?null:args[index+1];
  if(project!==PROJECT&&!/^demo-[a-z0-9-]+$/.test(project||''))throw Error('EXPLICIT_PROJECT_REQUIRED');
  if(args.includes('--apply')&&args.includes('--dry-run'))throw Error('CONFLICTING_MODES');
  return {project,apply:args.includes('--apply')};
}
export async function prepare({auth,db,timestamp,confirm,apply=false}){
  const accounts=[];let token;
  do{const page=await auth.listUsers(1000,token);accounts.push(...page.users);token=page.pageToken;}while(token);
  const candidates=accounts.filter(a=>a.customClaims?.admin===true);
  for(const user of candidates){const profile=await db.doc('users/'+user.uid).get();user.profileStatus=profile.data()?.status;}
  const registry=db.doc('adminSecurity/config'),existing=await registry.get();
  const plan=planRegistry(accounts,existing.exists?existing.data():null);
  const review={ownerCount:plan.ownerCount,activeOwners:candidates.filter(a=>!a.disabled&&(a.profileStatus===undefined||a.profileStatus==='active')).length,digest:plan.digest,writePlanned:plan.write,assistantsEnabled:existing.exists&&existing.data().enabled===true};
  if(!apply||!plan.write)return {...review,written:false};
  if(!await confirm(review))throw Error('CONFIRMATION_REQUIRED');
  // Revalidate claims before the Firestore transaction. Auth/Firestore have no cross-service transaction.
  for(const uid of plan.uids){const user=await auth.getUser(uid);if(user.customClaims?.admin!==true||user.disabled)throw Error('OWNER_CHANGED');}
  await db.runTransaction(async tx=>{
    if((await tx.get(registry)).exists)throw Error('REGISTRY_CHANGED');
    const refs=plan.uids.map(uid=>db.doc('adminAccess/'+uid));
    const records=await Promise.all(refs.map(ref=>tx.get(ref)));
    if(records.some(s=>s.exists&&s.data().role!=='super_admin'))throw Error('EXISTING_ROLE_CONFLICT');
    const profiles=await Promise.all(plan.uids.map(uid=>tx.get(db.doc('users/'+uid))));
    if(profiles.some(s=>s.data()?.status!==undefined&&s.data().status!=='active'))throw Error('OWNER_ACCOUNT_INACTIVE');
    tx.create(registry,{enabled:false,superAdminUids:plan.uids,schemaVersion:1,initializedAt:timestamp(),bootstrapDigest:plan.digest});
    refs.forEach((ref,i)=>{if(!records[i].exists)tx.create(ref,{role:'super_admin'});});
  });
  return {...review,written:true};
}
async function main(){
  const options=parseOptions(process.argv.slice(2));
  const emulator=options.project.startsWith('demo-');
  const hosts=[process.env.FIRESTORE_EMULATOR_HOST,process.env.FIREBASE_AUTH_EMULATOR_HOST];
  if(emulator?!hosts.every(h=>/^127\.0\.0\.1:\d+$/.test(h||'')):hosts.some(Boolean))throw Error('EMULATOR_CONFIGURATION');
  // Install official firebase-admin in a trusted tool environment, never add a key to the site.
  const {applicationDefault,initializeApp,deleteApp}=await import('firebase-admin/app');
  const {getAuth}=await import('firebase-admin/auth');
  const {getFirestore,FieldValue}=await import('firebase-admin/firestore');
  const app=initializeApp({projectId:options.project,...(emulator?{}:{credential:applicationDefault()})});
  try{
    const result=await prepare({auth:getAuth(app),db:getFirestore(app),timestamp:()=>FieldValue.serverTimestamp(),apply:options.apply,confirm:async review=>{
      console.log(JSON.stringify({project:options.project,...review}));
      if(!process.stdin.isTTY)return false;
      const terminal=createInterface({input:process.stdin,output:process.stdout});
      const expected=`PREPARE ${options.project} ${review.digest}`;
      try{return await terminal.question(`Explicit future write approval required. Type ${expected}: `)===expected;}finally{terminal.close();}
    }});
    console.log(JSON.stringify({project:options.project,mode:options.apply?'apply':'dry-run',...result}));
  }finally{await deleteApp(app);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  main().catch(()=>{console.error('Preparation stopped. Check official Admin SDK/ADC access, explicit project, owner consistency and approval. No error payload or credentials printed.');process.exitCode=1;});
}
