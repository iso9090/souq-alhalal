import {FieldValue} from 'firebase-admin/firestore';
import {createFirestoreQuota} from './quota.js';
import {HttpError} from './security.js';
export function firestoreDependencies(db,auth,sign){
 const readAccess=async uid=>{
   const [registry,access,profile]=await Promise.all(['adminSecurity/config','adminAccess/'+uid,'users/'+uid].map(p=>db.doc(p).get()));
   return {registry:registry.data(),access:access.data(),profile:profile.data()};
 };
 return {auth,readAccess,sign,quota:createFirestoreQuota(db),
   audit:record=>db.collection('backendAuditLogs').add(record),
   async stageAssistant(uid,body,ownerUid){
     const target=db.doc('adminAccess/'+uid),profile=db.doc('users/'+uid),log=db.collection('adminAuditLogs').doc();
     await db.runTransaction(async tx=>{
       const refs=[target,profile,db.doc('adminSecurity/config'),db.doc('adminAccess/'+ownerUid),db.doc('users/'+ownerUid)];
       const [a,u,r,oa,op]=await Promise.all(refs.map(ref=>tx.get(ref)));
       if(uid===ownerUid||a.exists||u.exists||r.data()?.enabled!==true||!r.data()?.superAdminUids?.includes(ownerUid)||r.data().superAdminUids.includes(uid)||oa.data()?.role!=='super_admin'||op.data()?.status!=='active')throw new HttpError(403,'permission-denied');
       const at=FieldValue.serverTimestamp();
       tx.create(profile,{uid,displayName:body.displayName.trim(),email:body.email.trim().toLowerCase(),accountType:'buyer',status:'active',createdAt:at});
       // Zero permissions, suspended role and disabled Auth until a separate invitation/activation flow is approved.
       tx.create(target,{role:'admin_assistant',adminStatus:'suspended',permissions:[],createdByAdminUid:ownerUid,adminCreatedAt:at,adminUpdatedAt:at,moderationLogId:log.id});
       tx.create(log,{adminUid:ownerUid,action:'assistant_created',targetType:'adminAccess',targetId:uid,reason:'Pending invitation: local backend foundation',timestamp:at,metadata:{oldPermissions:[],newPermissions:[]}});
     });
   }
 };
}
