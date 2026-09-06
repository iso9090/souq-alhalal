import {GROUPS,can,canDelegate} from './admin-permissions.js';

export function installAssistants(api,ui){
  const {db,auth,doc,collection,getDoc,getDocs,query,where,limit,orderBy,startAfter,getCountFromServer,runTransaction,serverTimestamp,requireAdminPermission,getAccess}=api;
  const {esc,button,nameOf,dateText,technical}=ui;
  let revision=0,cursor=null,host,busy=false;
  const status=s=>s==='active'?'نشط':'موقوف';
  const allowed=p=>can(getAccess(),p);
  const field=(label,value)=>`<dt>${esc(label)}</dt><dd>${esc(value||'غير متاح')}</dd>`;
  async function person(uid){const d=await getDoc(doc(db,'users',uid));return d.exists()?d.data():null;}
  function denied(){host.textContent='غير مصرح لك بالوصول إلى المساعدين والصلاحيات.';}
  async function render(container,next=false){
    host=container;const token=++revision;
    if(!await requireAdminPermission('assistants_view'))return denied();
    host.textContent='جاري تحميل المساعدين…';
    const snap=await getDocs(query(collection(db,'adminAccess'),where('role','==','admin_assistant'),orderBy('__name__'),...(next&&cursor?[startAfter(cursor)]:[]),limit(50)));
    const totals=await Promise.all([null,'active','suspended'].map(s=>getCountFromServer(query(collection(db,'adminAccess'),where('role','==','admin_assistant'),...(s?[where('adminStatus','==',s)]:[])))));
    if(token!==revision||!host.isConnected)return;cursor=snap.docs.at(-1);
    host.innerHTML='<div class="admin-stats admin-overview">'+totals.map((n,i)=>`<article><span class="admin-stat-icon" aria-hidden="true">♙</span><span>${['المساعدون','النشطون','الموقوفون'][i]}</span><strong>${n.data().count}</strong></article>`).join('')+'</div>';
    if(!getAccess().ready)host.insertAdjacentHTML('beforeend','<p class="admin-notice">الإضافة والتفويض غير مفعّلين حتى تهيئة سجل حماية مالكي المنصة بواسطة بيئة موثوقة. حساب المدير الحالي ما زال يعمل.</p>');
    if(allowed('assistants_create'))host.append(button('إضافة مساعد',()=>search()));
    const grid=document.createElement('div');grid.className='admin-assistants-grid';host.append(grid);
    for(const item of snap.docs){const d=item.data(),profile=await person(item.id);if(token!==revision||!grid.isConnected)return;const card=document.createElement('article');card.className='admin-row';card.innerHTML=`<h3>${esc(profile?.displayName||'اسم غير متاح')}</h3><span class="admin-badge ${d.adminStatus==='active'?'green':'gold'}">${status(d.adminStatus)}</span><dl>${field('البريد',profile?.email)}${field('الهاتف',profile?.phoneNumber)}${field('الدور','مساعد مدير')}${field('عدد الصلاحيات',String(d.permissions.length))}${field('تاريخ الإضافة',dateText(d.adminCreatedAt))}${field('أضافه',await nameOf('users',d.createdByAdminUid))}${field('آخر تحديث',dateText(d.adminUpdatedAt))}</dl>`;card.append(button('تفاصيل المساعد',()=>details(item.id)));grid.append(card);}
    if(!snap.size)grid.textContent='لا يوجد مساعدون.';
    if(next)host.append(button('بداية القائمة',()=>render(host)));
    if(snap.size===50)host.append(button('التالي',()=>render(host,true)));
  }
  function header(title,back=()=>render(host)){host.replaceChildren();const top=document.createElement('div');top.className='admin-detail-header';const b=button('→ رجوع إلى قائمة المساعدين',back);b.className='admin-back';top.append(b);const h=document.createElement('h3');h.textContent=title;top.append(h);host.append(top);}
  async function search(){
    if(!await requireAdminPermission('assistants_create'))return denied();++revision;header('إضافة مساعد مدير');
    const form=document.createElement('form');form.className='admin-assistant-search';form.innerHTML='<label>بحث مطابق بالبريد المحفوظ أو الهاتف<input name="contact" required placeholder="البريد أو الهاتف الكامل" autocomplete="off"></label><button type="submit">بحث عن مستخدم</button><p>يجب أن يسجل المستخدم حسابًا أولًا قبل منحه صلاحية مساعد مدير. البريد قابل للبحث فقط إذا كان محفوظًا في ملفه.</p><div class="assistant-search-results"></div>';host.append(form);
    form.onsubmit=async e=>{e.preventDefault();if(!await requireAdminPermission('assistants_create'))return denied();const term=form.elements.contact.value.trim();if(!term)return;const results=form.querySelector('.assistant-search-results');results.textContent='جاري البحث…';try{const snap=await getDocs(query(collection(db,'users'),where(term.includes('@')?'email':'phoneNumber','==',term.includes('@')?term.toLowerCase():term),limit(10)));if(!results.isConnected)return;results.replaceChildren();for(const item of snap.docs){const p=item.data();results.append(button(p.displayName||'مستخدم مسجل',()=>edit(item.id,true)));}if(!snap.size)results.textContent='يجب أن يسجل المستخدم حسابًا أولًا قبل منحه صلاحية مساعد مدير، أو ابحث بالهاتف المسجل.';}catch{results.textContent='تعذر البحث. تحقق من الصلاحيات والاتصال.';}};
  }
  async function details(uid){
    if(!await requireAdminPermission('assistants_view'))return denied();const token=++revision,target=host;
    const [snap,p]=await Promise.all([getDoc(doc(db,'adminAccess',uid)),person(uid)]);if(token!==revision||target!==host||!target.isConnected)return;if(!snap.exists())return render(host);const d=snap.data();header('تفاصيل المساعد');
    const card=document.createElement('article');card.className='admin-detail-card';card.innerHTML=`<h3>${esc(p?.displayName||'اسم غير متاح')}</h3><span class="admin-badge ${d.adminStatus==='active'?'green':'gold'}">${status(d.adminStatus)}</span><dl>${field('البريد',p?.email)}${field('الهاتف',p?.phoneNumber)}${field('الدور',d.role==='admin_assistant'?'مساعد مدير':'أزيل الدور الإداري')}${field('تاريخ التعيين',dateText(d.adminCreatedAt))}${field('أضافه',await nameOf('users',d.createdByAdminUid))}${field('آخر تحديث',dateText(d.adminUpdatedAt))}${field('آخر نشاط إداري','غير متاح في البنية الحالية')}</dl><h4>الصلاحيات</h4><ul>${GROUPS.flatMap(([,g])=>g).filter(([p])=>d.permissions.includes(p)).map(([,label])=>`<li>${esc(label)}</li>`).join('')}</ul>${technical({id:uid,createdByAdminUid:d.createdByAdminUid})}`;host.append(card);
    if(d.role!=='admin_assistant')return;
    const actions=document.createElement('div');actions.className='admin-assistant-actions';host.append(actions);card.classList.add('admin-assistant-detail');
    for(const [label,perm,action] of [['تعديل الصلاحيات','assistants_edit_permissions','edit'],[d.adminStatus==='active'?'إيقاف المساعد':'إعادة تفعيل المساعد','assistants_suspend',d.adminStatus==='active'?'assistant_suspended':'assistant_reactivated'],['إزالة صلاحية مساعد مدير','assistants_remove_role','assistant_role_removed']]){
      if(canDelegate(getAccess(),uid,d,d.permissions,perm)){const b=button(label,()=>action==='edit'?edit(uid,false):change(uid,action,d.permissions));b.dataset.tone=action==='assistant_role_removed'?'red':action==='assistant_suspended'?'gold':'green';actions.append(b);}
    }
  }
  async function edit(uid,creating){
    const permission=creating?'assistants_create':'assistants_edit_permissions';if(!await requireAdminPermission(permission))return denied();const token=++revision,target=host;
    const [snap,p]=await Promise.all([getDoc(doc(db,'adminAccess',uid)),person(uid)]);if(token!==revision||target!==host||!target.isConnected)return;const old=snap.data();
    if(!p||!canDelegate(getAccess(),uid,old,old?.permissions||[],permission)||creating&&old?.role==='admin_assistant'){header('تعذر منح الصلاحيات');host.append(document.createTextNode('الحساب محمي، أو لا تملك صلاحية تفويضه، أو لم تكتمل التهيئة الآمنة.'));return;}
    header(creating?'إضافة مساعد مدير':'تعديل صلاحيات المساعد',()=>creating?search():details(uid));
    const form=document.createElement('form');form.className='admin-permissions-form';form.innerHTML=`<h3>${esc(p.displayName||'مستخدم مسجل')}</h3><p>الدور: مساعد مدير — ${creating?'نشط':status(old.adminStatus)}</p><div class="permission-groups">${GROUPS.map(([title,items])=>`<fieldset><legend>${esc(title)}</legend>${items.map(([key,label])=>`<label><input type="checkbox" name="permission" value="${key}" ${old?.permissions?.includes(key)?'checked':''} ${!allowed(key)?'disabled':''}>${esc(label)}</label>`).join('')}</fieldset>`).join('')}</div><label>سبب ${creating?'الإضافة':'التعديل'}<textarea name="reason" required maxlength="500"></textarea></label><button type="submit">حفظ صلاحيات المساعد</button>`;host.append(form);
    form.onsubmit=async e=>{e.preventDefault();const permissions=[...form.querySelectorAll('input:checked')].map(x=>x.value);await change(uid,creating?'assistant_created':'assistant_permissions_updated',permissions,form.elements.reason.value.trim());};
  }
  async function change(uid,action,permissions,reason){
    const perm={assistant_created:'assistants_create',assistant_permissions_updated:'assistants_edit_permissions',assistant_suspended:'assistants_suspend',assistant_reactivated:'assistants_suspend',assistant_role_removed:'assistants_remove_role'}[action];
    if(busy||!perm||!await requireAdminPermission(perm))return;
    reason=reason||prompt('سبب الإجراء (إلزامي، حتى 500 حرف)')?.trim();if(!reason||reason.length>500||!confirm('تأكيد تغيير صلاحيات المساعد؟'))return;
    busy=true;
    try{await runTransaction(db,async tx=>{
      const ref=doc(db,'adminAccess',uid),oldSnap=await tx.get(ref),user=await tx.get(doc(db,'users',uid));const old=oldSnap.data();
      const nextPermissions=action==='assistant_role_removed'?[]:permissions;
      if(!user.exists()||!canDelegate(getAccess(),uid,old,nextPermissions,perm))throw Error('denied');
      const creating=action==='assistant_created';if(creating&&old?.role==='admin_assistant'||!creating&&old?.role!=='admin_assistant')throw Error('stale');
      const log=doc(collection(db,'adminAuditLogs'));
      const next={role:action==='assistant_role_removed'?'removed':'admin_assistant',adminStatus:action==='assistant_suspended'||action==='assistant_role_removed'?'suspended':action==='assistant_reactivated'||creating?'active':old.adminStatus,permissions:nextPermissions,createdByAdminUid:creating?auth.currentUser.uid:old.createdByAdminUid,adminCreatedAt:creating?serverTimestamp():old.adminCreatedAt,adminUpdatedAt:serverTimestamp(),moderationLogId:log.id};
      tx.set(ref,next);tx.set(log,{adminUid:auth.currentUser.uid,action,targetType:'adminAccess',targetId:uid,reason,timestamp:serverTimestamp(),metadata:{oldPermissions:old?.permissions||[],newPermissions:nextPermissions}});
    });await details(uid);}catch{alert('تعذر حفظ الصلاحيات. لم يكتمل الإجراء؛ تحقق من صلاحياتك ومن سجل حماية المالك.');}finally{busy=false;}
  }
  return {render};
}
