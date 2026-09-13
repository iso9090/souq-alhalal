// Existing identity registry contract. Firestore Rules enforce signed claims and atomic audit linkage.
export const ADMIN_MARKETPLACE_PERMISSIONS=Object.freeze(['dashboard_view','users_view','users_suspend','users_block','users_manage','listings_view','listings_manage','reports_view','reports_manage','services_view','services_manage','admin_log_view','assistants_view','assistants_create','assistants_edit_permissions','assistants_suspend','assistants_remove_role']);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const reasonText=value=>{if(typeof value!=='string'||value.trim().length<3||value.length>500)fail('REASON');return value.trim();};
const validUid=uid=>{if(typeof uid!=='string'||!uid.trim()||uid!==uid.trim()||uid.includes('/')||uid.length>128)fail('FIELDS');};
const permissionsList=values=>{if(!Array.isArray(values)||values.some(p=>!ADMIN_MARKETPLACE_PERMISSIONS.includes(p))||new Set(values).size!==values.length)fail('FIELDS');return [...values];};

export function attachProductionAdmin(store,{sdk,db,auth,config={}}={}){
 const actor=()=>{if(config.writesEnabled!==true)fail('WRITES_DISABLED');const a=auth?.state?.actor;if(!a?.uid)fail('AUTH');if(a.status!=='active')fail('ACCOUNT');if(a.ready!==true)fail('PERMISSION');return a;};
 const ref=(collection,id)=>sdk.doc(db,collection,id);
 const freshLog=()=>sdk.doc(sdk.collection(db,'adminAuditLogs'));
 async function context(tx,a,uid){
  // Reread authority before writes. Minimal user moderators need no target-registry read;
  // authoritative mayManageUser Rules protect peers and owners even when that read is denied.
  const self=await tx.get(ref('users',a.uid)),registry=await tx.get(ref('adminSecurity','config'));
  const ownAccess=await tx.get(ref('adminAccess',a.uid));
  if(auth?.state?.actor?.uid!==a.uid)fail('AUTH');
  if(!self.exists()||self.data().status!=='active')fail('ACCOUNT');
  const r=registry.data();if(r?.enabled!==true||!Array.isArray(r.superAdminUids)||!r.superAdminUids.length)fail('PERMISSION');
  const owner=a.role==='super_admin'&&r.superAdminUids.includes(a.uid);
  if(uid===a.uid||r.superAdminUids.includes(uid))fail('PROTECTED');
  const target=await tx.get(ref('users',uid));
  const canReadTarget=owner||['assistants_view','assistants_create','assistants_edit_permissions'].some(p=>ownAccess.data()?.permissions?.includes(p));
  const old=canReadTarget?(await tx.get(ref('adminAccess',uid))).data():null;
  if(uid===a.uid||r.superAdminUids.includes(uid)||old?.role==='super_admin')fail('PROTECTED');
  if(!target.exists())fail('MISSING');
  return {old,owner,ownAccess:ownAccess.data(),target:target.data()};
 }
 function audit(tx,log,a,uid,action,targetType,reason,metadata={}){tx.set(log,{adminUid:a.uid,action,targetType,targetId:uid,reason,timestamp:sdk.serverTimestamp(),metadata});}
 const refresh=async()=>{await store.refresh?.();};
 store.setUserStatus=async(uid,status,reason)=>{
  const a=actor();validUid(uid);reason=reasonText(reason);const permission={active:'users_manage',suspended:'users_suspend',blocked:'users_block'}[status];if(!permission)fail('FIELDS');
  await sdk.runTransaction(db,async tx=>{const c=await context(tx,a,uid);
   if(!c.owner){if(c.old?.role==='admin_assistant')fail('PROTECTED');if(a.role!=='admin_assistant'||c.ownAccess?.role!=='admin_assistant'||c.ownAccess.adminStatus!=='active'||!c.ownAccess.permissions?.includes(permission))fail('PERMISSION');}
   const log=freshLog();tx.update(ref('users',uid),{status,moderationLogId:log.id});audit(tx,log,a,uid,{active:'إعادة التفعيل',suspended:'تعليق الحساب',blocked:'حظر الحساب'}[status],'users',reason);
  });return refresh();
 };
 async function changeAssistant(uid,patch,reason,operation){
  const a=actor();validUid(uid);reason=reasonText(reason);if(a.role!=='super_admin')fail('PERMISSION');
  if(operation==='grant')patch={permissions:permissionsList(patch.permissions)};
  if(operation==='update'){
   if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).length!==1)fail('FIELDS');
   if(Object.hasOwn(patch,'permissions'))patch={permissions:permissionsList(patch.permissions)};
   else if(Object.hasOwn(patch,'adminStatus')&&['active','suspended'].includes(patch.adminStatus))patch={adminStatus:patch.adminStatus};else fail('FIELDS');
  }
  await sdk.runTransaction(db,async tx=>{const c=await context(tx,a,uid);if(!c.owner)fail('PERMISSION');const old=c.old;
   if(operation==='grant'&&old&&old.role!=='removed'||operation!=='grant'&&old?.role!=='admin_assistant')fail('STATE');
   if(operation==='grant'&&c.target.status!=='active')fail('ACCOUNT');
   const granting=operation==='grant',removing=operation==='remove';
   const nextPermissions=removing?[]:patch.permissions??old.permissions;
   const nextStatus=removing?'suspended':granting?'active':patch.adminStatus??old.adminStatus;
   if(operation==='update'&&patch.adminStatus===old.adminStatus)fail('STATE');
   const action=granting?'assistant_created':removing?'assistant_role_removed':patch.permissions?'assistant_permissions_updated':nextStatus==='active'?'assistant_reactivated':'assistant_suspended';
   const log=freshLog();tx.set(ref('adminAccess',uid),{role:removing?'removed':'admin_assistant',adminStatus:nextStatus,permissions:nextPermissions,createdByAdminUid:granting?a.uid:old.createdByAdminUid,adminCreatedAt:granting?sdk.serverTimestamp():old.adminCreatedAt,adminUpdatedAt:sdk.serverTimestamp(),moderationLogId:log.id});
   audit(tx,log,a,uid,action,'adminAccess',reason,{oldPermissions:old?.permissions||[],newPermissions:nextPermissions});
  });return refresh();
 }
 store.grantAssistant=(uid,permissions,reason)=>changeAssistant(uid,{permissions},reason,'grant');
 store.updateAssistant=(uid,patch,reason)=>changeAssistant(uid,patch,reason,'update');
 store.removeAssistant=(uid,reason)=>changeAssistant(uid,{},reason,'remove');
 return store;
}
