import {GROUPS,can,canDelegate} from './admin-permissions.js';

export function installAssistants(api,ui){
  const {db,auth,doc,collection,getDoc,getDocs,query,where,limit,orderBy,startAfter,getCountFromServer,runTransaction,serverTimestamp,requireAdminPermission,getAccess}=api;
  const {esc,button,nameOf,dateText,technical}=ui;
  let revision=0,host,listHost,dialog,busy=false;
  const superOnly=()=>getAccess().role==='super_admin'&&getAccess().ready;
  const protectedTarget=(uid,d)=>uid===auth.currentUser?.uid||getAccess().protectedUids.includes(uid)||d?.role==='super_admin';
  const permissionNames=new Map(GROUPS.flatMap(([,items])=>items));
  const permissionsOf=d=>[...new Set(d?.permissions||[])].filter(p=>permissionNames.has(p));
  const emailOf=p=>p?.email||'البريد الإلكتروني غير مسجل';
  const status=s=>s==='active'?'نشط':'موقوف';
  const allowed=p=>can(getAccess(),p);
  const field=(label,value)=>`<dt>${esc(label)}</dt><dd>${esc(value||'غير مسجل')}</dd>`;
  async function person(uid){const d=await getDoc(doc(db,'users',uid));return d.exists()?d.data():null;}
  function denied(){host.textContent='غير مصرح لك بالوصول إلى المساعدين والصلاحيات.';}
  async function render(container){
    if(dialog){const previousHost=listHost,previousBody=host;dialog.close();dialog.remove();dialog=null;if(container===previousBody||container===previousHost)container=previousHost;}
    host=listHost=container;const token=++revision;
    if(!await requireAdminPermission('assistants_view'))return denied();
    host.textContent='جاري تحميل المساعدين…';
    const records=[];let cursor;
    do{const batch=await getDocs(query(collection(db,'adminAccess'),where('role','==','admin_assistant'),orderBy('__name__'),...(cursor?[startAfter(cursor)]:[]),limit(50)));if(token!==revision||!host.isConnected)return;records.push(...batch.docs);if(batch.size<50)break;cursor=batch.docs.at(-1);}while(true);
    const people=new Map();const profile=uid=>{if(!uid)return Promise.resolve(null);if(!people.has(uid))people.set(uid,person(uid).catch(()=>({displayName:'تعذر قراءة الاسم',email:'تعذر قراءة البريد الإلكتروني'})));return people.get(uid);};
    const items=await Promise.all(records.map(async r=>({uid:r.id,data:r.data(),person:await profile(r.id),creator:await profile(r.data().createdByAdminUid)})));
    if(token!==revision||!host.isConnected)return;
    const totals=[items.length,items.filter(x=>x.data.adminStatus==='active').length,items.filter(x=>x.data.adminStatus==='suspended').length];
    host.classList.add('assistants-v3');
    host.innerHTML='<div class="assistant-overview">'+totals.map((n,i)=>`<article class="assistant-stat assistant-stat-${i}"><span class="assistant-stat-symbol" aria-hidden="true">${['♙','♙','⊘'][i]}</span><div><h3>${['المساعدون','النشطون','الموقوفون'][i]}</h3><strong>${n}</strong><p>${i?'من أصل '+totals[0]+' مساعد':'إجمالي المساعدين'}</p></div></article>`).join('')+'</div>';
    if(!getAccess().ready)host.insertAdjacentHTML('beforeend','<p class="admin-notice">الإضافة والتفويض غير مفعّلين حتى تهيئة سجل حماية مالكي المنصة بواسطة بيئة موثوقة. حساب المدير الحالي ما زال يعمل.</p>');
    const controls=document.createElement('div');controls.className='assistant-toolbar';
    controls.innerHTML='<input type="search" aria-label="البحث بالاسم أو البريد الإلكتروني" placeholder="البحث بالاسم أو البريد الإلكتروني…"><select aria-label="حالة المساعد"><option value="">الحالة: الكل</option><option value="active">نشط</option><option value="suspended">موقوف</option></select><select aria-label="صلاحية المساعد"><option value="">كل الصلاحيات</option>'+[...permissionNames].map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')+'</select><select aria-label="ترتيب المساعدين"><option value="newest">الأحدث أولًا</option><option value="oldest">الأقدم أولًا</option><option value="name">الاسم</option></select>';
    if(superOnly())controls.append(button('إضافة مساعد جديد',()=>search()));host.append(controls);
    const resultCount=document.createElement('p');resultCount.className='assistant-result-count';resultCount.setAttribute('aria-live','polite');host.append(resultCount);
    const grid=document.createElement('div');grid.className='admin-assistants-grid';host.append(grid);
    const paging=document.createElement('div');paging.className='assistant-pagination';host.append(paging);
    host.insertAdjacentHTML('beforeend','<div class="assistant-guidance"><section><h3>معلومات هامة</h3><p>أدوات إدارة المساعدين في هذه الصفحة متاحة لمالك المنصة فقط. لا يمكن منح Super Admin أو تعديل المالك أو تعديل صلاحياتك الذاتية هنا. تُسجل التغييرات في سجل الإدارة.</p></section><section><h3>نصائح لإدارة المساعدين</h3><p>امنح الصلاحيات المطلوبة للعمل فقط، وراجعها دوريًا. إيقاف المساعد يحفظ حسابه وبياناته.</p></section></div>');
    let pageNumber=0,pageSize=10;const [searchBox,statusFilter,permissionFilter,sort]=controls.querySelectorAll('input,select');
    const timestamp=v=>v?.toMillis?v.toMillis():v?.seconds?v.seconds*1000:new Date(v||0).getTime()||0;
    function draw(){
      const term=searchBox.value.trim().toLocaleLowerCase();
      const selected=items.filter(x=>(!term||[x.person?.displayName,x.person?.email].some(s=>String(s||'').toLocaleLowerCase().includes(term)))&&(!statusFilter.value||x.data.adminStatus===statusFilter.value)&&(!permissionFilter.value||permissionsOf(x.data).includes(permissionFilter.value)));
      selected.sort((a,b)=>sort.value==='name'?String(a.person?.displayName||'').localeCompare(String(b.person?.displayName||''),'ar'):(sort.value==='oldest'?1:-1)*(timestamp(a.data.adminCreatedAt)-timestamp(b.data.adminCreatedAt))||a.uid.localeCompare(b.uid));
      pageNumber=Math.min(pageNumber,Math.max(0,Math.ceil(selected.length/pageSize)-1));resultCount.textContent='عدد النتائج: '+selected.length;grid.replaceChildren();
      for(const item of selected.slice(pageNumber*pageSize,(pageNumber+1)*pageSize)){
        const d=item.data,perms=permissionsOf(d),card=document.createElement('article');card.className='admin-row assistant-card';card.dataset.uid=item.uid;
        card.innerHTML=`<div class="assistant-person"><span class="admin-avatar" aria-hidden="true">♙</span><h3>${esc(item.person?.displayName||'الاسم غير مسجل')}</h3><p class="assistant-email" dir="ltr">${esc(emailOf(item.person))}</p><span class="admin-badge blue">${getAccess().protectedUids.includes(item.uid)||d.role==='super_admin'?'مالك المنصة — Super Admin':'مساعد مدير'}</span><small dir="ltr">UID: ${esc(item.uid.slice(0,8))}…</small></div><div class="assistant-permissions"><h4>الصلاحيات الممنوحة <span>${perms.length}</span></h4><div class="assistant-chips">${perms.slice(0,6).map(p=>`<span>${esc(permissionNames.get(p))}</span>`).join('')}${perms.length>6?`<span>+${perms.length-6} صلاحيات أخرى</span>`:''}${perms.length?'':'<span>لا توجد صلاحيات ممنوحة</span>'}</div></div><div class="assistant-metadata"><span class="admin-badge ${d.adminStatus==='active'?'green':'gold'}">${status(d.adminStatus)}</span><dl>${field('تاريخ الإضافة',dateText(d.adminCreatedAt))}${field('أضيف بواسطة',item.creator?.displayName||'اسم المسؤول غير مسجل')}${field('آخر تحديث',dateText(d.adminUpdatedAt))}</dl></div>`;
        const actions=document.createElement('div');actions.className='admin-assistant-actions';actions.append(button('تفاصيل المساعد',()=>details(item.uid)));
        if(superOnly()&&!protectedTarget(item.uid,d)){actions.append(button('تعديل الصلاحيات',()=>edit(item.uid,false)));const stateButton=button(d.adminStatus==='active'?'إيقاف المساعد':'إعادة تفعيل المساعد',()=>change(item.uid,d.adminStatus==='active'?'assistant_suspended':'assistant_reactivated',perms));stateButton.dataset.tone=d.adminStatus==='active'?'red':'green';actions.append(stateButton);}
        card.append(actions);grid.append(card);
      }
      if(!selected.length)grid.textContent='لا يوجد مساعدون مطابقون للبحث.';
      paging.replaceChildren();const previous=button('السابق',()=>{pageNumber--;draw();}),next=button('التالي',()=>{pageNumber++;draw();});previous.disabled=pageNumber===0;next.disabled=(pageNumber+1)*pageSize>=selected.length;
      const number=document.createElement('span');number.textContent=String(pageNumber+1);const size=document.createElement('select');size.setAttribute('aria-label','عدد المساعدين في الصفحة');size.innerHTML=[10,25,50].map(n=>`<option value="${n}">${n} في الصفحة</option>`).join('');size.value=pageSize;size.onchange=()=>{pageSize=Number(size.value);pageNumber=0;draw();};paging.append(previous,number,next,size);
    }
    for(const input of [searchBox,statusFilter,permissionFilter,sort])input.addEventListener(input===searchBox?'input':'change',()=>{pageNumber=0;draw();});draw();
  }
  function header(title,back=()=>render(host)){
    if(!dialog){dialog=document.createElement('dialog');dialog.className='assistant-dialog';dialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const focusable=[...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});listHost.append(dialog);dialog.addEventListener('close',()=>{if(dialog&&!dialog.open){dialog.remove();dialog=null;host=listHost;revision++;}});host=document.createElement('div');host.className='assistant-dialog-body';dialog.append(host);dialog.showModal();}
    host.replaceChildren();dialog.setAttribute('aria-label',title);const top=document.createElement('div');top.className='admin-detail-header';const b=button('→ رجوع إلى قائمة المساعدين',back);b.className='admin-back';top.append(b);const h=document.createElement('h3');h.textContent=title;top.append(h);top.append(button('إغلاق',()=>{dialog.close();}));host.append(top);b.focus();
  }
  async function search(){
    if(!superOnly()||!await requireAdminPermission('assistants_create'))return denied();++revision;header('إضافة مساعد مدير');
    const form=document.createElement('form');form.className='admin-assistant-search';form.innerHTML='<label>طريقة الدخول<select aria-label="طريقة الدخول"><option>Google — تسجيل أولي ثم إضافة UID الموجود</option></select></label><p>يسجل المساعد الدخول باستخدام Google أولًا. بعد ذلك ابحث عن حسابه وتحقق من UID قبل منحه الصلاحيات. اختر الحساب المسجل الصحيح قبل متابعة منح الصلاحيات.</p><label>بحث مطابق بالبريد المحفوظ أو الهاتف أو UID<input name="contact" required placeholder="البريد أو الهاتف الكامل أو UID" autocomplete="off"></label><button type="submit">بحث عن مستخدم</button><p>الإضافة هنا متاحة للحسابات المسجلة مسبقًا فقط.</p><div class="assistant-search-results"></div>';host.append(form);
    form.onsubmit=async e=>{e.preventDefault();if(!superOnly()||!await requireAdminPermission('assistants_create'))return denied();const term=form.elements.contact.value.trim();if(!term)return;const results=form.querySelector('.assistant-search-results');results.textContent='جاري البحث…';try{const snap=term.includes('@')||term.startsWith('+')?await getDocs(query(collection(db,'users'),where(term.includes('@')?'email':'phoneNumber','==',term.includes('@')?term.toLowerCase():term),limit(10))):await getDoc(doc(db,'users',term)).then(d=>({docs:d.exists()?[d]:[],size:d.exists()?1:0}));if(!results.isConnected)return;results.replaceChildren();for(const item of snap.docs){const p=item.data();results.append(button((p.displayName||'مستخدم مسجل')+' — '+item.id,()=>edit(item.id,true)));}if(!snap.size)results.textContent='يجب أن يسجل المستخدم حسابًا أولًا قبل منحه صلاحية مساعد مدير، أو ابحث بالهاتف المسجل.';}catch{results.textContent='تعذر البحث. تحقق من الصلاحيات والاتصال.';}};
  }
  async function details(uid){
    if(!await requireAdminPermission('assistants_view'))return denied();const token=++revision,target=host;
    const [snap,p]=await Promise.all([getDoc(doc(db,'adminAccess',uid)),person(uid)]);if(token!==revision||target!==host||!target.isConnected)return;if(!snap.exists())return render(host);const d=snap.data();header('تفاصيل المساعد');
    const card=document.createElement('article');card.className='admin-detail-card admin-assistant-detail';card.innerHTML=`<h3>${esc(p?.displayName||'اسم غير متاح')}</h3><span class="admin-badge ${d.adminStatus==='active'?'green':'gold'}">${status(d.adminStatus)}</span><dl>${field('البريد',emailOf(p))}${field('الهاتف',p?.phoneNumber)}${field('UID',uid)}${field('الدور',getAccess().protectedUids.includes(uid)||d.role==='super_admin'?'مالك المنصة — Super Admin':d.role==='admin_assistant'?'مساعد مدير':'أزيل الدور الإداري')}${field('تاريخ التعيين',dateText(d.adminCreatedAt))}${field('أضافه',await nameOf('users',d.createdByAdminUid))}${field('آخر تحديث',dateText(d.adminUpdatedAt))}${field('آخر دخول',dateText(p?.lastLoginAt))}</dl><h4>الصلاحيات</h4><ul>${GROUPS.flatMap(([,g])=>g).filter(([p])=>permissionsOf(d).includes(p)).map(([,label])=>`<li>${esc(label)}</li>`).join('')}</ul>${technical({id:uid,createdByAdminUid:d.createdByAdminUid})}`;if(token!==revision||!host.isConnected)return;host.append(card);
    const audit=document.createElement('section');audit.className='assistant-audit-summary';audit.innerHTML='<h4>ملخص سجل الإدارة</h4>';card.append(audit);
    if(allowed('admin_log_view')){try{const logs=await getDocs(query(collection(db,'adminAuditLogs'),where('targetType','==','adminAccess'),where('targetId','==',uid),limit(5)));if(token!==revision||!audit.isConnected)return;const labels={assistant_created:'إضافة مساعد',assistant_permissions_updated:'تعديل الصلاحيات',assistant_suspended:'إيقاف المساعد',assistant_reactivated:'إعادة التفعيل',assistant_role_removed:'إزالة الدور'};const list=document.createElement('ul');for(const log of logs.docs){const entry=log.data(),li=document.createElement('li');li.textContent=(labels[entry.action]||entry.action)+' — '+dateText(entry.timestamp);list.append(li);}audit.append(list);const note=document.createElement('p');note.textContent=logs.size?'عينة من العمليات المسجلة (حتى 5). السجل الكامل متاح في قسم سجل الإدارة.':'لا توجد عمليات مسجلة لهذا الحساب.';audit.append(note);}catch{audit.append(document.createTextNode('تعذر قراءة سجل الإدارة.'));}}
    else audit.append(document.createTextNode('عرض السجل يحتاج صلاحية عرض سجل الإدارة.'));
    if(d.role!=='admin_assistant'||!superOnly()||protectedTarget(uid,d))return;
    const actions=document.createElement('div');actions.className='admin-assistant-actions';host.append(actions);card.classList.add('admin-assistant-detail');
    for(const [label,perm,action] of [['تعديل الصلاحيات','assistants_edit_permissions','edit'],[d.adminStatus==='active'?'إيقاف المساعد':'إعادة تفعيل المساعد','assistants_suspend',d.adminStatus==='active'?'assistant_suspended':'assistant_reactivated'],['إزالة صلاحية مساعد مدير','assistants_remove_role','assistant_role_removed']]){
      if(superOnly()&&canDelegate(getAccess(),uid,d,d.permissions,perm)){const b=button(label,()=>action==='edit'?edit(uid,false):change(uid,action,d.permissions));b.dataset.tone=action==='assistant_role_removed'?'red':action==='assistant_suspended'?'gold':'green';actions.append(b);}
    }
  }
  async function edit(uid,creating){
    const permission=creating?'assistants_create':'assistants_edit_permissions';if(!superOnly()||!await requireAdminPermission(permission))return denied();const token=++revision,target=host;
    const [snap,p]=await Promise.all([getDoc(doc(db,'adminAccess',uid)),person(uid)]);if(token!==revision||target!==host||!target.isConnected)return;const old=snap.data();
    if(!p||!canDelegate(getAccess(),uid,old,old?.permissions||[],permission)||creating&&old?.role==='admin_assistant'){header('تعذر منح الصلاحيات');host.append(document.createTextNode('الحساب محمي، أو لا تملك صلاحية تفويضه، أو لم تكتمل التهيئة الآمنة.'));return;}
    header(creating?'إضافة مساعد مدير':'تعديل صلاحيات المساعد',()=>creating?search():details(uid));
    const form=document.createElement('form');form.className='admin-permissions-form';form.innerHTML=`<h3>${esc(p.displayName||'مستخدم مسجل')}</h3><label>الاسم<input value="${esc(p.displayName||'')}" readonly></label><label>البريد الإلكتروني<input value="${esc(emailOf(p))}" readonly dir="ltr"></label><p dir="ltr">UID: ${esc(uid)}</p><p>الدور: مساعد مدير — ${creating?'نشط':status(old.adminStatus)}</p><div class="permission-groups">${GROUPS.map(([title,items])=>`<fieldset><legend>${esc(title)}</legend>${items.map(([key,label])=>`<label><input type="checkbox" name="permission" value="${key}" ${old?.permissions?.includes(key)?'checked':''} ${!allowed(key)?'disabled':''}>${esc(label)}</label>`).join('')}</fieldset>`).join('')}</div><label>سبب ${creating?'الإضافة':'التعديل'}<textarea name="reason" required maxlength="500"></textarea></label><button type="submit">حفظ صلاحيات المساعد</button>`;host.append(form);
    form.onsubmit=async e=>{e.preventDefault();const permissions=[...form.querySelectorAll('input:checked')].map(x=>x.value);await change(uid,creating?'assistant_created':'assistant_permissions_updated',permissions,form.elements.reason.value.trim());};
  }
  async function change(uid,action,permissions,reason){
    const perm={assistant_created:'assistants_create',assistant_permissions_updated:'assistants_edit_permissions',assistant_suspended:'assistants_suspend',assistant_reactivated:'assistants_suspend',assistant_role_removed:'assistants_remove_role'}[action];
    if(busy||!perm||!superOnly()||!await requireAdminPermission(perm)||!superOnly())return;
    reason=reason||prompt('سبب الإجراء (إلزامي، حتى 500 حرف)')?.trim();if(!reason||reason.length>500||!confirm('تأكيد تغيير صلاحيات المساعد؟'))return;
    busy=true;
    try{await runTransaction(db,async tx=>{
      const ref=doc(db,'adminAccess',uid),oldSnap=await tx.get(ref),user=await tx.get(doc(db,'users',uid));const old=oldSnap.data();const registry=await tx.get(doc(db,'adminSecurity','config'));if(!superOnly()||!registry.data()?.superAdminUids?.includes(auth.currentUser.uid)||registry.data()?.superAdminUids?.includes(uid))throw Error('owner-required');
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
