import assert from 'node:assert/strict';
import {attachProductionAdmin,ADMIN_MARKETPLACE_PERMISSIONS} from '../melkak/production-admin.js';

function fixture({assistant=false,enabled=true}={}){
 const records=new Map(Object.entries({'users/owner':{status:'active'},'users/member':{status:'active',displayName:'Original'},'users/peer':{status:'active'},'adminSecurity/config':{enabled:true,superAdminUids:['owner','protected']},'adminAccess/peer':{role:'admin_assistant',adminStatus:'active',permissions:[]}}));
 if(assistant){records.set('users/helper',{status:'active'});records.set('adminAccess/helper',{role:'admin_assistant',adminStatus:'active',permissions:['users_suspend']});}
 const auth={state:{actor:{uid:assistant?'helper':'owner',status:'active',ready:true,role:assistant?'admin_assistant':'super_admin',permissions:assistant?['users_suspend']:[]}}};
 let counter=0,commits=0;const reads=[];
 const sdk={collection:(_,name)=>({path:name}),doc:(base,name,id)=>{const path=id?name+'/'+id:base.path+'/'+(++counter);return {path,id:path.split('/').at(-1)};},serverTimestamp:()=>123,
  async runTransaction(_,fn){const writes=[];await fn({async get(ref){reads.push(ref.path);return {exists:()=>records.has(ref.path),data:()=>structuredClone(records.get(ref.path))};},set:(ref,data)=>writes.push([ref.path,data]),update:(ref,data)=>writes.push([ref.path,{...records.get(ref.path),...data}])});for(const [p,d]of writes)records.set(p,d);commits++;}};
 const store={async refresh(){}};attachProductionAdmin(store,{sdk,db:{},auth,config:{writesEnabled:enabled}});
 return {store,records,auth,reads,get commits(){return commits;}};
}
const deny=async(f,code)=>assert.rejects(f,{code});
{
 const f=fixture({enabled:false});await deny(()=>f.store.setUserStatus('member','suspended','reason'),'WRITES_DISABLED');assert.equal(f.reads.length,0);
}
{
 const f=fixture();await f.store.setUserStatus('member','suspended','  valid reason  ');assert.deepEqual(f.records.get('users/member'),{status:'suspended',displayName:'Original',moderationLogId:'1'});const log=f.records.get('adminAuditLogs/1');assert.equal(log.action,'تعليق الحساب');assert.equal(log.reason,'valid reason');assert.equal(log.targetType,'users');assert.equal(f.commits,1);
 for(const path of ['users/owner','adminSecurity/config','adminAccess/owner','users/member','adminAccess/member'])assert.ok(f.reads.includes(path),path);
}
for(const target of ['owner','protected','peer']){
 const f=fixture();if(target==='peer')f.records.set('adminAccess/peer',{role:'super_admin'});await deny(()=>f.store.setUserStatus(target,'blocked','valid reason'),'PROTECTED');assert.equal(f.commits,0);
}
{
 const f=fixture({assistant:true});await f.store.setUserStatus('member','suspended','reason');await deny(()=>f.store.setUserStatus('member','active','reason'),'PERMISSION');await deny(()=>f.store.grantAssistant('member',[],'reason'),'PERMISSION');
 f.records.get('adminAccess/helper').adminStatus='suspended';await deny(()=>f.store.setUserStatus('member','suspended','reason'),'PERMISSION');
}
{
 const f=fixture({assistant:true});await f.store.setUserStatus('member','suspended','reason');assert.ok(!f.reads.includes('adminAccess/member'),'minimal user moderator must not read target assistant registry');
}
{
 const f=fixture({assistant:true});f.records.get('adminAccess/helper').permissions.push('assistants_view');await deny(()=>f.store.setUserStatus('peer','suspended','reason'),'PROTECTED');
}
{
 const f=fixture();await f.store.grantAssistant('member',['dashboard_view','listings_view'],'reason');const d=f.records.get('adminAccess/member');assert.equal(d.role,'admin_assistant');assert.equal(d.createdByAdminUid,'owner');assert.deepEqual(f.records.get('adminAuditLogs/1').metadata,{oldPermissions:[],newPermissions:['dashboard_view','listings_view']});
 await f.store.updateAssistant('member',{permissions:['reports_view']},'reason');await f.store.updateAssistant('member',{adminStatus:'suspended'},'reason');await f.store.updateAssistant('member',{adminStatus:'active'},'reason');await f.store.removeAssistant('member','reason');assert.equal(f.records.get('adminAccess/member').role,'removed');assert.deepEqual(f.records.get('adminAccess/member').permissions,[]);assert.equal(f.records.get('users/member').displayName,'Original');assert.equal(f.records.get('adminAuditLogs/5').action,'assistant_role_removed');
}
for(const permissions of [['auctions_manage'],['payments_manage'],['super_admin'],['users_view','users_view']]){const f=fixture();await deny(()=>f.store.grantAssistant('member',permissions,'reason'),'FIELDS');assert.equal(f.commits,0);}
for(const reason of ['  ','ab','x'.repeat(501)]){const f=fixture();await deny(()=>f.store.setUserStatus('member','active',reason),'REASON');}
{
 const f=fixture();await deny(()=>f.store.grantAssistant('absent',[],'reason'),'MISSING');f.records.get('users/owner').status='blocked';await deny(()=>f.store.grantAssistant('member',[],'reason'),'ACCOUNT');
}
{
 const f=fixture();f.records.get('adminSecurity/config').superAdminUids=['another'];await deny(()=>f.store.grantAssistant('member',[],'reason'),'PERMISSION');
}
for(const method of ['grantAssistant','updateAssistant','removeAssistant']){
 const f=fixture({enabled:false});await deny(()=>f.store[method]('member',[], 'reason'),'WRITES_DISABLED');assert.equal(f.reads.length,0);
}
for(const uid of ['owner','protected','peer']){
 const f=fixture();if(uid==='peer')f.records.set('adminAccess/peer',{role:'super_admin'});
 await deny(()=>f.store.grantAssistant(uid,[],'reason'),'PROTECTED');assert.equal(f.commits,0);
}
{
 const f=fixture();f.records.get('adminSecurity/config').enabled=false;await deny(()=>f.store.setUserStatus('member','active','reason'),'PERMISSION');
}
{
 const f=fixture();f.records.get('adminSecurity/config').enabled='true';await deny(()=>f.store.setUserStatus('member','active','reason'),'PERMISSION');
}
{
 const f=fixture();await f.store.grantAssistant('member',[],'reason');
 await deny(()=>f.store.updateAssistant('member',{role:'super_admin'},'reason'),'FIELDS');
 await deny(()=>f.store.updateAssistant('member',{permissions:[],adminStatus:'active'},'reason'),'FIELDS');
 await deny(()=>f.store.updateAssistant('member',{permissions:['auctions_view']},'reason'),'FIELDS');
 await f.store.removeAssistant('member','reason');await f.store.grantAssistant('member',['users_view'],'reason');assert.equal(f.records.get('adminAccess/member').adminStatus,'active');
}
assert.ok(ADMIN_MARKETPLACE_PERMISSIONS.includes('listings_manage'));
console.log('PASS production admin transaction permissions, owner protection, audit, role lifecycle and write gate');
