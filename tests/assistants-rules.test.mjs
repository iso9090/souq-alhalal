import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp,Timestamp} from 'firebase/firestore';
import {PERMISSIONS} from '../admin-permissions.js';
if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Only local Firestore emulator allowed');
const env=await initializeTestEnvironment({projectId:'demo-souq-assistants',firestore:{rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
const dbs={};for(const uid of ['owner','viewer','manager','delegate','normal','other','higher','legacyOwner'])dbs[uid]=env.authenticatedContext(uid,uid==='owner'||uid==='legacyOwner'?{admin:true}:{}).firestore();
let n=0,seq=0;const stamp=Timestamp.fromMillis(1700000000000);
const access=(permissions,extra={})=>({role:'admin_assistant',adminStatus:'active',permissions,createdByAdminUid:'owner',adminCreatedAt:stamp,adminUpdatedAt:stamp,moderationLogId:'seed',...extra});
async function seed(path,data){await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),path),data));}
async function test(name,fn){await fn();console.log('PASS | '+name);n++;}
async function change(actor,uid,action,permissions,extra={}){
 const db=dbs[actor];let old;await env.withSecurityRulesDisabled(async c=>{old=(await getDoc(doc(c.firestore(),'adminAccess',uid))).data();});
 const log='assist'+(++seq),create=action==='assistant_created';
 const next={role:action==='assistant_role_removed'?'removed':'admin_assistant',adminStatus:action==='assistant_suspended'||action==='assistant_role_removed'?'suspended':action==='assistant_reactivated'||create?'active':old?.adminStatus,permissions,createdByAdminUid:create?actor:old?.createdByAdminUid,adminCreatedAt:create?serverTimestamp():old?.adminCreatedAt,adminUpdatedAt:serverTimestamp(),moderationLogId:log,...extra};
 const b=writeBatch(db);b.set(doc(db,'adminAccess',uid),next);b.set(doc(db,'adminAuditLogs',log),{adminUid:actor,action,targetType:'adminAccess',targetId:uid,reason:'سبب اختبار آمن',timestamp:serverTimestamp(),metadata:{oldPermissions:old?.permissions||[],newPermissions:permissions}});return b.commit();
}
async function moderate(actor,kind,uid,patch){const db=dbs[actor],log='moderate'+(++seq),b=writeBatch(db);b.update(doc(db,kind,uid),{...patch,moderationLogId:log});b.set(doc(db,'adminAuditLogs',log),{adminUid:actor,action:patch.status==='blocked'?'حظر الحساب':'تعليق الحساب',targetType:kind,targetId:uid,reason:'اختبار',timestamp:serverTimestamp(),metadata:{}});return b.commit();}
try{
 await env.clearFirestore();
 for(const uid of [...Object.keys(dbs),'new','new2'])await seed('users/'+uid,{uid,status:'active',displayName:uid,phoneNumber:'0500000000'});
 await seed('adminSecurity/config',{enabled:true,superAdminUids:['owner','legacyOwner']});
 await seed('adminAccess/owner',access(PERMISSIONS,{role:'super_admin'}));
 await seed('adminAccess/viewer',access(['dashboard_view','users_view','reports_view','assistants_view']));
 await seed('adminAccess/manager',access(['users_view','users_suspend','users_manage','reports_view','reports_manage','listings_manage','services_view','services_manage','auctions_manage','purchase_requests_manage']));
 await seed('adminAccess/delegate',access(['assistants_view','assistants_create','assistants_edit_permissions','assistants_suspend','assistants_remove_role','users_view']));
 await seed('adminAccess/other',access(['users_view']));await seed('adminAccess/higher',access(PERMISSIONS));
 await seed('reports/report',{reporterId:'normal',reportedUserId:'other',targetType:'user',targetId:'other',status:'open'});
 await seed('animals/a',{sellerId:'normal',status:'active',images:['data:image/jpeg;base64,AAA','data:image/jpeg;base64,BBB']});
 await seed('auctions/a',{sellerId:'normal',status:'active',endTime:stamp});await seed('purchaseRequests/a',{sellerId:'normal',buyerId:'other',status:'pending'});
 await test('normal cannot read assistants',()=>assertFails(getDocs(collection(dbs.normal,'adminAccess'))));
 await test('Super Admin lists assistants',()=>assertSucceeds(getDocs(collection(dbs.owner,'adminAccess'))));
 await test('assistant view lists assistants',()=>assertSucceeds(getDocs(collection(dbs.viewer,'adminAccess'))));
 await test('assistant reads own access',()=>assertSucceeds(getDoc(doc(dbs.manager,'adminAccess','manager'))));
 await test('no view cannot list users',()=>assertFails(getDocs(collection(dbs.normal,'users'))));
 await test('view-only can list users',()=>assertSucceeds(getDocs(collection(dbs.viewer,'users'))));
 await test('view-only cannot suspend',()=>assertFails(moderate('viewer','users','normal',{status:'suspended'})));
 await test('suspend permission works',()=>assertSucceeds(moderate('manager','users','normal',{status:'suspended'})));
 await test('suspend does not grant block',()=>assertFails(moderate('manager','users','other',{status:'blocked'})));
 await test('assistant cannot suspend registered owner',()=>assertFails(moderate('manager','users','owner',{status:'suspended'})));
 await test('assistant cannot suspend legacy claim owner without role doc',()=>assertFails(moderate('manager','users','legacyOwner',{status:'suspended'})));
 await test('full-permission assistant cannot block owner',()=>assertFails(moderate('higher','users','owner',{status:'blocked'})));
 await test('full-permission assistant cannot block legacy owner',()=>assertFails(moderate('higher','users','legacyOwner',{status:'blocked'})));
 await test('full-permission assistant cannot remove owner role',()=>assertFails(change('higher','owner','assistant_role_removed',[])));
 await test('normal cannot inject profile role',()=>assertFails(updateDoc(doc(dbs.other,'users','other'),{role:'super_admin',permissions:PERMISSIONS,adminStatus:'active'})));
 await test('assistant cannot edit own access directly',()=>assertFails(updateDoc(doc(dbs.delegate,'adminAccess','delegate'),{permissions:PERMISSIONS})));
 await test('assistant self escalation with audit denied',()=>assertFails(change('delegate','delegate','assistant_permissions_updated',PERMISSIONS)));
 await test('assistant cannot rewrite even own existing permissions',()=>assertFails(change('delegate','delegate','assistant_permissions_updated',['assistants_view','assistants_create','assistants_edit_permissions','assistants_suspend','assistants_remove_role','users_view'])));
 await test('assistant cannot create without create permission',()=>assertFails(change('viewer','new','assistant_created',[])));
 await test('delegator cannot create super role',()=>assertFails(change('delegate','new','assistant_created',[],{role:'super_admin'})));
 await test('delegator cannot grant higher permissions',()=>assertFails(change('delegate','new','assistant_created',['users_block'])));
 await test('delegator cannot edit higher assistant',()=>assertFails(change('delegate','higher','assistant_permissions_updated',[])));
 await test('delegator cannot suspend higher assistant',()=>assertFails(change('delegate','higher','assistant_suspended',PERMISSIONS)));
 await test('delegator cannot remove higher assistant',()=>assertFails(change('delegate','higher','assistant_role_removed',[])));
 await test('delegator cannot modify owner role',()=>assertFails(change('delegate','owner','assistant_created',[])));
 await test('owner cannot create super from frontend either',()=>assertFails(change('owner','new','assistant_created',[],{role:'super_admin'})));
 await test('owner adds assistant',()=>assertSucceeds(change('owner','new','assistant_created',['users_view'])));
 await test('owner edits permissions',()=>assertSucceeds(change('owner','new','assistant_permissions_updated',['reports_view'])));
 await test('unknown permissions rejected',()=>assertFails(change('owner','new','assistant_permissions_updated',['god_mode'])));
 await test('duplicate permissions rejected',()=>assertFails(change('owner','new','assistant_permissions_updated',['reports_view','reports_view'])));
 await test('owner suspends assistant',()=>assertSucceeds(change('owner','new','assistant_suspended',['reports_view'])));
 const newDb=env.authenticatedContext('new').firestore();
 await test('suspended assistant immediately denied reads',()=>assertFails(getDoc(doc(newDb,'reports','report'))));
 await test('owner reactivates assistant',()=>assertSucceeds(change('owner','new','assistant_reactivated',['reports_view'])));
 await test('reactivated permission works',()=>assertSucceeds(getDoc(doc(newDb,'reports','report'))));
 await test('owner removes administrative role',()=>assertSucceeds(change('owner','new','assistant_role_removed',[])));
 await test('removed role immediately denied',()=>assertFails(getDoc(doc(newDb,'reports','report'))));
 await test('ordinary user account retained',async()=>assert.equal((await getDoc(doc(newDb,'users','new'))).data().status,'active'));
 await test('delegator cannot grant subset',()=>assertFails(change('delegate','new2','assistant_created',['users_view'])));
 await seed('adminAccess/new2',access(['users_view']));
 await test('delegator cannot edit subset',()=>assertFails(change('delegate','new2','assistant_permissions_updated',[])));
 await test('delegator cannot suspend lower assistant',()=>assertFails(change('delegate','new2','assistant_suspended',[])));
 await seed('adminAccess/new2',access([],{adminStatus:'suspended'}));
 await test('delegator cannot reactivate lower assistant',()=>assertFails(change('delegate','new2','assistant_reactivated',[])));
 for(const actor of ['manager','higher','normal']){
  for(const [action,permissions] of [['assistant_created',[]],['assistant_permissions_updated',[]],['assistant_suspended',[]],['assistant_reactivated',[]],['assistant_role_removed',[]]]){
   await seed('adminAccess/new2',access([],{adminStatus:action==='assistant_reactivated'?'suspended':'active',role:action==='assistant_created'?'removed':'admin_assistant'}));
   await test(actor+' denied '+action,()=>assertFails(change(actor,'new2',action,permissions)));
  }
  await test(actor+' cannot delete assistant access',()=>assertFails(deleteDoc(doc(dbs[actor],'adminAccess','new2'))));
  for(const status of ['suspended','blocked','active','deletion_requested'])await test(actor+' cannot moderate assistant profile '+status,()=>assertFails(moderate(actor,'users','other',{status})));
 }
 for(const target of ['other','owner','normal']){
  await seed('accountDeletionRequests/'+target,{userId:target,status:'pending',createdAt:stamp,updatedAt:stamp});
  await test('assistant deletion workflow '+target,()=> (target==='normal'?assertSucceeds:assertFails)(updateDoc(doc(dbs.higher,'accountDeletionRequests',target),{status:'completed',updatedAt:serverTimestamp(),processedAt:serverTimestamp(),processedBy:'higher'})));
 }
 await test('full assistant can reactivate ordinary user',()=>assertSucceeds(moderate('higher','users','normal',{status:'active'})));
 await test('full assistant can block ordinary user',()=>assertSucceeds(moderate('higher','users','normal',{status:'blocked'})));
 await test('full assistant can request ordinary user deletion',()=>assertSucceeds(moderate('higher','users','normal',{status:'deletion_requested'})));
 await test('Super Admin can suspend assistant profile',()=>assertSucceeds(moderate('owner','users','other',{status:'suspended'})));
 await test('Super Admin can reactivate assistant profile',()=>assertSucceeds(moderate('owner','users','other',{status:'active'})));
 await test('Super Admin cannot suspend another registered owner',()=>assertFails(moderate('owner','users','legacyOwner',{status:'suspended'})));
 await test('Super Admin cannot delete owner profile',()=>assertFails(deleteDoc(doc(dbs.owner,'users','legacyOwner'))));
 await test('Super Admin cannot directly delete access bypassing audited role removal',()=>assertFails(deleteDoc(doc(dbs.owner,'adminAccess','new2'))));
 await test('assistant cannot forge standalone management audit',()=>assertFails(setDoc(doc(dbs.higher,'adminAuditLogs','forged'),{adminUid:'higher',action:'assistant_created',targetType:'adminAccess',targetId:'new2',reason:'test',timestamp:serverTimestamp(),metadata:{oldPermissions:[],newPermissions:[]}})));
 await seed('adminAccess/new2',access(['assistants_view']));
 const directoryDb=env.authenticatedContext('new2').firestore();
 await test('assistant directory permission can read assistant identity',()=>assertSucceeds(getDoc(doc(directoryDb,'users','other'))));
 await test('assistant directory permission can read protected owner identity',()=>assertSucceeds(getDoc(doc(directoryDb,'users','owner'))));
 await test('assistant directory permission cannot list all users',()=>assertFails(getDocs(collection(directoryDb,'users'))));
 await test('assistant directory permission cannot read unrelated user',()=>assertFails(getDoc(doc(directoryDb,'users','normal'))));
 await test('adminAccess update without audit denied',()=>assertFails(updateDoc(doc(dbs.owner,'adminAccess','new2'),{adminStatus:'suspended',adminUpdatedAt:serverTimestamp()})));
 await test('audit log has old/new permissions',async()=>{const logs=await getDocs(collection(dbs.owner,'adminAuditLogs'));assert.ok(logs.docs.some(x=>x.data().action==='assistant_permissions_updated'&&x.data().metadata.oldPermissions.includes('users_view')));});
 await test('audit log cannot be modified',()=>assertFails(updateDoc(doc(dbs.owner,'adminAuditLogs','assist1'),{reason:'rewrite'})));
 await test('assistant cannot remove registry document',()=>assertFails(deleteDoc(doc(dbs.delegate,'adminAccess','other'))));
 await test('owner cannot edit protected registry from client',()=>assertFails(setDoc(doc(dbs.owner,'adminSecurity','config'),{enabled:true,superAdminUids:[]})));
 await test('reports view-only cannot manage',()=>assertFails(moderate('viewer','reports','report',{status:'resolved',reviewedAt:serverTimestamp(),reviewedBy:'viewer',resolutionNotes:'x'})));
 await test('reports manage allowed',()=>assertSucceeds(moderate('manager','reports','report',{status:'resolved',reviewedAt:serverTimestamp(),reviewedBy:'manager',resolutionNotes:'x'})));
 await test('listing manage allowed',()=>assertSucceeds(moderate('manager','animals','a',{images:['data:image/jpeg;base64,AAA'],imagesLocked:true,moderationLocked:true,status:'active'})));
 await test('purchase manage allowed',()=>assertSucceeds(moderate('manager','purchaseRequests','a',{status:'rejected',updatedAt:serverTimestamp()})));
 await test('auction manage allowed after expiry',()=>assertSucceeds(moderate('manager','auctions','a',{status:'not_approved',updatedAt:serverTimestamp()})));
 await test('auction manage cannot edit price',()=>assertFails(updateDoc(doc(dbs.manager,'auctions','a'),{currentPrice:1})));
 await seed('adminSecurity/config',{enabled:false,superAdminUids:['owner','legacyOwner']});
 await test('disabled delegation still protects owner without role document',()=>assertFails(moderate('owner','users','legacyOwner',{status:'suspended'})));
 await test('disabled delegation fails closed',()=>assertFails(getDocs(collection(dbs.viewer,'users'))));
 await test('legacy owner still works while delegation disabled',()=>assertSucceeds(getDocs(collection(dbs.owner,'users'))));
 const outsider=env.authenticatedContext('unregistered',{admin:true}).firestore();
 await test('new admin claim outside prepared registry denied',()=>assertFails(getDocs(collection(outsider,'users'))));
 await test('assistant cannot add itself to registry',()=>assertFails(updateDoc(doc(dbs.higher,'adminSecurity','config'),{superAdminUids:['owner','higher']})));
 await test('assistant cannot enable registry',()=>assertFails(updateDoc(doc(dbs.higher,'adminSecurity','config'),{enabled:true})));
 await test('normal user cannot write registry',()=>assertFails(setDoc(doc(dbs.normal,'adminSecurity','config'),{enabled:true,superAdminUids:['normal']})));
 await test('owner cannot delete registry',()=>assertFails(deleteDoc(doc(dbs.owner,'adminSecurity','config'))));
 await test('owner cannot remove last registry owner',()=>assertFails(updateDoc(doc(dbs.owner,'adminSecurity','config'),{superAdminUids:[]})));
 await test('owner cannot delete protected owner role',()=>assertFails(deleteDoc(doc(dbs.owner,'adminAccess','owner'))));
 await seed('adminSecurity/config',{enabled:true,superAdminUids:[]});
 await test('empty registry cannot enable assistants',()=>assertFails(getDocs(collection(dbs.viewer,'users'))));
 await env.withSecurityRulesDisabled(c=>deleteDoc(doc(c.firestore(),'adminSecurity','config')));
 await test('legacy claim before initialization remains compatible',()=>assertSucceeds(getDocs(collection(dbs.owner,'users'))));
 await test('assistant cannot bootstrap absent registry',()=>assertFails(setDoc(doc(dbs.higher,'adminSecurity','config'),{enabled:true,superAdminUids:['higher']})));
 await test('uninitialized assistants denied',()=>assertFails(getDocs(collection(dbs.viewer,'users'))));
 console.log(`SUMMARY | ${n}/${n} passed`);
}finally{await env.cleanup();}
