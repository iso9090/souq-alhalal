import {ADMIN_MARKETPLACE_PERMISSIONS} from './production-admin.js';
import {GROUPS} from '../admin-permissions.js';

export function createAdminManagementViews({store,actor,t,esc,button,table,openDialog,toast,render,preview,writable}){
 const fail=code=>{throw Object.assign(new Error(code),{code});};
 const access=()=>actor()||{};
 const entries=()=>store.state.legacy?.adminAccess||[];
 const entry=uid=>entries().find(r=>(r.uid||r.id||r.sourceId)===uid);
 const person=uid=>store.state.users.find(u=>(u.uid||u.id)===uid);
 const uidOf=u=>u.uid||u.id||u.sourceId;
 const owner=()=>access().role==='super_admin';
 const permitted=p=>owner()||access().permissions?.includes(p);
 const enabled=()=>!preview&&writable&&access().ready===true&&access().status==='active';
 const protectedUid=uid=>uid===access().uid||access().protectedUids?.includes(uid)||entry(uid)?.role==='super_admin';
 const ownerUid=uid=>access().protectedUids?.includes(uid)||entry(uid)?.role==='super_admin';
 const canStatus=(uid,status)=>enabled()&&!protectedUid(uid)&&(owner()||entry(uid)?.role!=='admin_assistant')&&permitted({active:'users_manage',suspended:'users_suspend',blocked:'users_block'}[status]);
 const statusLabel=status=>({active:t('نشط','Active'),suspended:t('معلق','Suspended'),blocked:t('محظور','Blocked'),removed:t('أزيل الدور','Role removed')}[status]||t('غير متاح','Unavailable'));
 const permissionLabel=p=>t(GROUPS.flatMap(([,items])=>items).find(([key])=>key===p)?.[1]||p,p.replaceAll('_',' '));
 const stamp=value=>{const n=typeof value?.toMillis==='function'?value.toMillis():typeof value==='number'?value:Date.parse(value);return Number.isFinite(n)&&n>0?esc(new Date(n).toISOString().slice(0,10)):t('غير متاح','Unavailable');};
 const reason=()=>`<label>${t('سبب الإجراء','Reason')}<textarea name="reason" required minlength="3" maxlength="500"></textarea></label>`;
 const submit=()=>`<button type="submit" class="primary">${t('حفظ','Save')}</button>`;
 const form=(kind,uid,body)=>`<form data-admin-management-form="${kind}" data-id="${esc(uid||'')}">${body}${reason()}${submit()}</form>`;
 const checkboxList=selected=>`<fieldset><legend>${t('الصلاحيات المحددة','Scoped permissions')}</legend>${ADMIN_MARKETPLACE_PERMISSIONS.map(p=>`<label><input type="checkbox" name="permission" value="${esc(p)}" ${selected.includes(p)?'checked':''}>${esc(permissionLabel(p))}</label>`).join('')}</fieldset>`;
 const identity=(uid,u=person(uid))=>`<strong>${esc(u?.displayName||u?.name||t('اسم غير متاح','Name unavailable'))}</strong><br><small dir="ltr">${esc(u?.email||t('البريد غير متاح','Email unavailable'))}</small><br><code dir="ltr">${esc(uid)}</code>`;
 function users(country=''){
  return table([t('المستخدم','User'),t('الحالة','Status'),t('الدور','Role'),t('إجراءات','Actions')],store.state.users.filter(u=>!country||u.country===country).map(u=>{const uid=uidOf(u),record=entry(uid),protectedOwner=ownerUid(uid);return [identity(uid,u),esc(statusLabel(u.status)),protectedOwner?t('مالك المنصة — محمي','Platform owner — Protected'):record?.role==='admin_assistant'?t('مساعد مدير','Admin assistant'):t('مستخدم','User'),protectedUid(uid)?t('محمي · لا تعطيل','Protected · No suspension'):['active','suspended','blocked'].some(s=>canStatus(uid,s))?button(t('تغيير الحالة','Change status'),'admin-user-status',`data-id="${esc(uid)}"`):t('قراءة فقط','Read only')];}));
 }
 function assistants(){
  const intro=`<p class="notice">${t('يسجل المساعد الدخول باستخدام Google أولًا، ثم يختار المالك UID الحساب المسجل ويمنحه الصلاحيات. لا يتم إنشاء حساب دخول من هذه الصفحة.','The assistant signs in with Google first. The owner then selects the existing account UID and grants permissions. This page does not create sign-in accounts.')}</p>`;
  return intro+(enabled()&&owner()?button(t('إضافة مساعد','Add assistant'),'admin-assistant-add'):'')+table([t('المساعد','Assistant'),t('الحالة','Status'),t('الصلاحيات','Permissions'),t('التواريخ','Dates'),t('إجراءات','Actions')],entries().filter(r=>['admin_assistant','removed','super_admin'].includes(r.role)).map(r=>{const uid=uidOf(r);const actions=enabled()&&owner()&&!protectedUid(uid)&&r.role==='admin_assistant'?button(t('تعديل الصلاحيات','Edit permissions'),'admin-assistant-edit',`data-id="${esc(uid)}"`)+button(r.adminStatus==='active'?t('إيقاف المساعد','Suspend assistant'):t('إعادة تفعيل المساعد','Reactivate assistant'),'admin-assistant-status',`data-id="${esc(uid)}"`)+button(t('إزالة الدور','Remove role'),'admin-assistant-remove',`data-id="${esc(uid)}"`):protectedUid(uid)?t('محمي','Protected'):'';return [identity(uid),esc(statusLabel(r.role==='removed'?'removed':r.adminStatus)),(r.permissions||[]).map(p=>esc(permissionLabel(p))).join(' · ')||t('بلا صلاحيات','No permissions'),`${t('التعيين','Assigned')}: ${stamp(r.adminCreatedAt)}<br>${t('التحديث','Updated')}: ${stamp(r.adminUpdatedAt)}`,actions];}));
 }
 function requireTarget(uid,superOnly=false){if(!enabled()||superOnly&&!owner())fail('PERMISSION');if(protectedUid(uid))fail('PROTECTED');if(!person(uid))fail('MISSING');}
 async function handleClick(el){
  const {action,id}=el.dataset||{};if(!['admin-user-status','admin-assistant-add','admin-assistant-edit','admin-assistant-status','admin-assistant-remove'].includes(action))return false;
  if(action==='admin-user-status'){requireTarget(id);const statuses=['active','suspended','blocked'].filter(s=>canStatus(id,s));if(!statuses.length)fail('PERMISSION');openDialog(t('حالة المستخدم','User status'),form('user-status',id,`${identity(id)}<label>${t('الحالة','Status')}<select name="status">${statuses.map(s=>`<option value="${s}" ${person(id).status===s?'selected':''}>${statusLabel(s)}</option>`).join('')}</select></label>`));}
  else if(action==='admin-assistant-add'){
   if(!enabled()||!owner())fail('PERMISSION');const candidates=store.state.users.filter(u=>u.status==='active'&&!protectedUid(uidOf(u))&&entry(uidOf(u))?.role!=='admin_assistant');
   openDialog(t('إضافة مساعد','Add assistant'),candidates.length?form('assistant-grant','',`<p>${t('اختر الحساب المسجل بعد دخول Google وتحقق من UID. القائمة تخص المستخدمين المحملين فقط.','Select the account after Google sign-in and verify its UID. This list covers loaded users only.')}</p><label>${t('الحساب الموجود','Existing account')}<select required name="uid">${candidates.map(u=>`<option value="${esc(uidOf(u))}">${esc(u.displayName||u.name||u.email||t('مستخدم','User'))} — ${esc(uidOf(u))}</option>`).join('')}</select></label>${checkboxList([])}`):`<p>${t('لا يوجد حساب مؤهل في البيانات المحملة. يلزم تسجيل Google أولًا ثم تحديث المستخدمين.','No eligible account is loaded. Google sign-in is required first; then refresh users.')}</p>`);
  }else{
   requireTarget(id,true);const r=entry(id);if(r?.role!=='admin_assistant')fail('STATE');
   if(action==='admin-assistant-edit')openDialog(t('تعديل الصلاحيات','Edit permissions'),form('assistant-edit',id,identity(id)+checkboxList(r.permissions||[])));
   else if(action==='admin-assistant-status'){const next=r.adminStatus==='active'?'suspended':'active';openDialog(t('حالة المساعد','Assistant status'),form('assistant-status',id,`${identity(id)}<p>${esc(statusLabel(next))}</p><input type="hidden" name="adminStatus" value="${next}">`));}
   else openDialog(t('إزالة الدور','Remove role'),form('assistant-remove',id,`${identity(id)}<p>${t('ستزال الصلاحية الإدارية ويبقى حساب المستخدم محفوظًا.','Administrative access will be removed. The user account will remain.')}</p>`));
  }return true;
 }
 async function handleSubmit(element){
  const kind=element.dataset?.adminManagementForm;if(!['user-status','assistant-grant','assistant-edit','assistant-status','assistant-remove'].includes(kind))return false;
  const value=name=>String(element.elements.namedItem(name)?.value||'');const uid=kind==='assistant-grant'?value('uid'):element.dataset.id;requireTarget(uid,kind!=='user-status');const why=value('reason').trim();if(why.length<3||why.length>500)fail('REASON');
  if(kind==='user-status'){const status=value('status');if(!canStatus(uid,status))fail('PERMISSION');await store.setUserStatus(uid,status,why);}
  else if(kind==='assistant-remove')await store.removeAssistant(uid,why);
  else if(kind==='assistant-status')await store.updateAssistant(uid,{adminStatus:value('adminStatus')},why);
  else{const permissions=[...element.querySelectorAll('input[name="permission"]:checked')].map(input=>input.value);if(permissions.some(p=>!ADMIN_MARKETPLACE_PERMISSIONS.includes(p)))fail('FIELDS');if(kind==='assistant-grant')await store.grantAssistant(uid,permissions,why);else await store.updateAssistant(uid,{permissions},why);}
  element.closest?.('dialog')?.close();render();toast(t('تم حفظ التغيير','Change saved'));return true;
 }
 return {users,assistants,handleClick,handleSubmit};
}
