// Firebase dependencies are supplied by the existing application; no second app or credentials.
export function installAdminDashboard(api) {
  const {db, auth, collection, doc, getDoc, getDocs, query, where, limit, orderBy,
    startAfter, getCountFromServer, runTransaction, serverTimestamp, requireAdminClaim,
    showModal, escapeHtml: esc, safeImageData, formatDate} = api;
  const tabs = {home:'الرئيسية',users:'المستخدمون',animals:'الإعلانات',auctions:'المزادات',reports:'البلاغات',services:'طلبات الخدمات',adminAuditLogs:'سجل الإدارة'};
  const labels = {uid:'UID',displayName:'الاسم',phoneNumber:'الهاتف',email:'البريد',country:'الدولة',region:'المنطقة',city:'المدينة',accountType:'نوع الحساب',status:'الحالة',createdAt:'تاريخ التسجيل/النشر',lastLoginAt:'آخر دخول',subscriptionStatus:'الاشتراك',subscriptionExpiresAt:'انتهاء الاشتراك',name:'الحيوان',type:'النوع',sellerId:'البائع',sellerPhone:'التواصل',saleType:'نوع البيع',price:'السعر',startPrice:'سعر البداية',minIncrement:'الحد الأدنى للزيادة',currentPrice:'السعر الحالي',endTime:'انتهاء المزاد',lastBidderId:'أعلى/آخر مزايد',lastBidAt:'آخر مزايدة',winnerId:'الفائز المسجل',animalId:'الإعلان',reporterId:'المبلّغ',reportedUserId:'المستخدم المبلّغ عنه',targetType:'نوع الهدف',targetId:'الهدف',reason:'السبب',details:'التفاصيل',reviewedAt:'تاريخ المراجعة',reviewedBy:'المراجع',resolutionNotes:'ملاحظات الإدارة',adminUid:'المسؤول',action:'الإجراء',timestamp:'التاريخ'};
  const fields = {users:['uid','displayName','phoneNumber','email','country','region','accountType','status','subscriptionStatus','subscriptionExpiresAt','createdAt','lastLoginAt'],animals:['name','type','sellerId','sellerPhone','country','region','city','saleType','price','createdAt','status'],auctions:['animalId','sellerId','startPrice','minIncrement','currentPrice','endTime','status','lastBidderId','lastBidAt','winnerId'],reports:['reporterId','targetType','targetId','reportedUserId','reason','details','status','createdAt','reviewedBy','reviewedAt','resolutionNotes'],adminAuditLogs:['adminUid','action','targetType','targetId','reason','timestamp']};
  fields.purchaseRequests=['animalId','sellerId','buyerId','price','status','createdAt'];
  labels.buyerId='المشتري';
  const terms={active:'نشط',suspended:'معلق',blocked:'محظور',deletion_requested:'طلب حذف',hidden:'مخفي',needs_review:'يحتاج مراجعة',sold:'تم البيع',not_approved:'لم يعتمد البيع',buyer:'مشترٍ',seller:'بائع',both:'بائع ومشترٍ',direct:'بيع مباشر',auction:'مزاد',open:'مفتوح',reviewing:'تحت المراجعة',resolved:'معالج',rejected:'مرفوض',pending:'جديد / قيد الانتظار',approved:'معتمد',accepted:'مقبول',cancelled:'ملغي',user:'مستخدم',animal:'إعلان'};
  let generation=0, page=[], cursor=null, current='home', filters={}, busy=false, trail=[], viewLabel=tabs.home;
  const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=busy;b.onclick=()=>Promise.resolve().then(fn).catch(()=>alert('تعذر تنفيذ العملية. تحقق من الاتصال والصلاحيات.'));return b;};
  const value=v=>v?.toDate ? formatDate(v) : v == null || v === '' ? 'غير مسجل' : terms[v]||String(v);
  const panel=()=>document.getElementById('adminV2Body');
  function audit(tx,action,targetType,targetId,reason,metadata={}) {
    const ref=doc(collection(db,'adminAuditLogs'));
    tx.set(ref,{adminUid:auth.currentUser.uid,action,targetType,targetId,reason,timestamp:serverTimestamp(),metadata});
    return ref.id;
  }
  function reasonFor(message) {if(!confirm(message))return null;const reason=prompt('سبب الإجراء الإداري (إلزامي، حتى 500 حرف)');return reason?.trim() && reason.trim().length<=500 ? reason.trim() : null;}
  async function mutate(kind,id,action,makePatch) {
    if(busy || !await requireAdminClaim(true))return;
    const reason=reasonFor('هل أنت متأكد من تنفيذ هذا الإجراء: '+action+'؟');if(!reason)return;
    busy=true;
    try {await runTransaction(db,async tx=>{const ref=doc(db,kind,id),snap=await tx.get(ref);if(!snap.exists())throw Error('missing');const patch=await makePatch(snap.data(),reason);const logId=audit(tx,action,kind,id,reason,patch.metadata||{});delete patch.metadata;tx.update(ref,{...patch,moderationLogId:logId});});await detail(kind,id,false);}
    finally{busy=false;document.querySelector('.admin-v2')?.querySelectorAll('button').forEach(b=>{b.disabled=false;});}
  }
  async function open(tab='home') {
    if(!await requireAdminClaim(true)){alert('غير مصرح لك بفتح لوحة الإدارة.');return;}
    current=tab;cursor=null;filters={};trail=[];viewLabel=tabs[tab];generation++;
    showModal('<section class="admin-v2" dir="rtl"><h2>لوحة إدارة سوق الحلال</h2><nav id="adminV2Nav" aria-label="تبويبات الإدارة"></nav><div id="adminV2Body" aria-live="polite">جاري التحميل…</div></section>');
    for(const [key,label] of Object.entries(tabs)) {const b=button(label,()=>key==='services'?api.openServices():open(key));b.setAttribute('aria-current',String(key===tab));document.getElementById('adminV2Nav').append(b);}
    try {if(tab==='home')await home();else await list(false);}catch{if(panel())panel().textContent='تعذر تحميل البيانات. أعد اختيار التبويب للمحاولة.';}
  }
  async function count(kind,conditions=[]) {return (await getCountFromServer(query(collection(db,kind),...conditions))).data().count;}
  async function home() {
    const token=generation, cards=[];
    for(const [kind,title,statuses] of [['users','المستخدمون',['active','suspended','blocked']],['animals','الإعلانات',['active','hidden','needs_review','sold','not_approved']],['auctions','المزادات',['active','sold','not_approved']],['purchaseRequests','طلبات الشراء',['pending','accepted','rejected']],['reports','البلاغات',['open','reviewing','resolved','rejected']],['serviceRequests','الخدمات',['pending','approved','rejected','cancelled']]]) {
      cards.push([title,kind,[]]);for(const s of statuses)cards.push([title+' · '+value(s),kind,[where('status','==',s)]]);
    }
    for(const role of ['buyer','seller','both'])cards.push(['نوع الحساب · '+value(role),'users',[where('accountType','==',role)]]);
    for(const sale of ['direct','auction'])cards.push(['نوع البيع · '+value(sale),'animals',[where('saleType','==',sale)]]);
    cards.push(['مزادات انتهى وقتها','auctions',[where('endTime','<=',new Date())]]);
    const results=await Promise.all(cards.map(async([title,kind,conditions])=>{try{return [title,await count(kind,conditions)];}catch{return [title,'تعذر الإحصاء'];}}));
    if(token!==generation||!panel())return;
    panel().innerHTML='<p>أعداد فعلية من الخادم، مستقلة عن صفحات العرض. حالة active للمزاد قد تشمل مزادًا انتهى وقته ولم يبتّ فيه البائع.</p><div class="admin-stats">'+results.map(([title,n])=>`<article><span>${esc(title)}</span><strong>${esc(n)}</strong></article>`).join('')+'</div><p>البنية الحالية تحتفظ بآخر مزايدة فقط؛ إجمالي المزايدات وسجلها التاريخي غير متاحين. لا توجد بيانات اشتراك محفوظة يمكن إحصاؤها.</p>';
  }
  async function list(next) {
    const token=++generation,kind=current;
    const constraints=Object.entries(filters).filter(([,v])=>v).map(([k,v])=>where(k,'==',v));
    constraints.push(orderBy('__name__'));if(next&&cursor)constraints.push(startAfter(cursor));constraints.push(limit(50));
    panel().textContent='جاري التحميل…';
    const snap=await getDocs(query(collection(db,kind),...constraints));if(token!==generation||!panel())return;
    page=snap.docs.map(d=>({...d.data(),id:d.id}));cursor=snap.docs.at(-1);
    panel().innerHTML='<p>50 سجلًا كحد أقصى للصفحة. البحث النصي داخل الصفحة الحالية؛ الفلاتر تطبق على الخادم.</p><div id="adminFilters"></div><div id="adminRows"></div>';
    const controls=document.getElementById('adminFilters'),search=document.createElement('input');search.placeholder='بحث في الصفحة بالاسم أو الهاتف أو البريد أو UID';search.setAttribute('aria-label',search.placeholder);controls.append(search);
    if(kind==='users'){
      const exact=document.createElement('select');exact.setAttribute('aria-label','حقل البحث الشامل');exact.innerHTML='<option value="__name__">UID</option><option value="displayName">الاسم الكامل</option><option value="phoneNumber">الهاتف الكامل</option><option value="email">البريد الكامل</option>';controls.append(exact);
      controls.append(button('بحث مطابق في جميع المستخدمين',()=>{if(!search.value.trim())return;filters={[exact.value]:search.value.trim()};cursor=null;return list(false);}));
    }
    controls.append(button('مسح البحث والفلاتر',()=>{filters={};cursor=null;return list(false);}));
    for(const [field,options] of kind==='users'?[['accountType',['buyer','seller','both']],['status',['active','suspended','blocked','deletion_requested']],['country',['AE','EG']]]:kind==='animals'?[['saleType',['direct','auction']],['status',['active','hidden','needs_review','sold','not_approved']],['country',['AE','EG']]]:kind==='reports'?[['status',['open','reviewing','resolved','rejected']]]:kind==='auctions'?[['status',['active','sold','not_approved']]]:[]) {
      const select=document.createElement('select');select.setAttribute('aria-label',labels[field]);select.innerHTML=`<option value="">${labels[field]}: الكل</option>`+options.map(x=>`<option value="${x}">${esc(value(x))}</option>`).join('');select.value=filters[field]||'';select.onchange=()=>{filters[field]=select.value;cursor=null;list(false).catch(()=>{if(panel())panel().textContent='تعذر تطبيق الفلتر.';});};controls.append(select);
    }
    search.oninput=()=>rows(page.filter(d=>[d.id,...(fields[kind]||[]).map(f=>value(d[f]))].join(' ').toLowerCase().includes(search.value.toLowerCase())));rows(page);
    panel().append(button('الصفحة الأولى',()=>{cursor=null;return list(false);}));if(snap.size===50)panel().append(button('الصفحة التالية',()=>list(true)));
  }
  function rows(items) {
    const root=document.getElementById('adminRows');root.innerHTML='';if(!items.length){root.textContent='لا توجد نتائج.';return;}
    for(const d of items){const card=document.createElement('article');card.className='admin-row';const pic=safeImageData(d.images?.[0]);card.innerHTML=(pic?`<img class="admin-thumb" src="${esc(pic)}" alt="صورة الإعلان">`:'')+`<h3>${esc(d.displayName||d.name||d.type||d.action||d.id)}</h3><p dir="auto">${esc(d.id)}</p><dl>${(fields[current]||[]).filter(f=>!['details','resolutionNotes','email','phoneNumber','sellerPhone'].includes(f)).map(f=>`<dt>${esc(labels[f])}</dt><dd>${esc(value(d[f]))}</dd>`).join('')}</dl>`+(Array.isArray(d.images)?`<p>عدد الصور: ${d.images.length}</p>`:'');card.append(button('فتح التفاصيل',()=>detail(current,d.id)));root.append(card);}
  }
  // Preserve nodes and their handlers so Back retains the search, filters and page.
  async function back() {
    if(!await requireAdminClaim(true) || !trail.length || !panel())return;
    generation++;
    const previous=trail.pop();
    panel().replaceChildren(...previous.nodes);
    viewLabel=previous.label;
    previous.focus?.focus({preventScroll:true});
    const modal=document.getElementById('modal');
    if(modal)modal.scrollTop=previous.scroll;
  }
  function detailHeader() {
    const header=document.createElement('div');header.className='admin-detail-header';
    const previous=trail.at(-1);
    if(previous){const b=button('→ رجوع إلى '+previous.label,back);b.className='admin-back';header.append(b);}
    panel().append(header);
    return header;
  }
  async function detail(kind,id,push=true) {
    if(!await requireAdminClaim(true))return;
    if(!panel())return;
    if(push)trail.push({nodes:[...panel().childNodes],label:viewLabel,focus:document.activeElement,scroll:document.getElementById('modal')?.scrollTop||0});
    viewLabel='تفاصيل '+(tabs[kind]||kind);
    const token=++generation;panel().replaceChildren();detailHeader();
    const loading=document.createElement('p');loading.textContent='جاري تحميل التفاصيل…';panel().append(loading);
    const modal=document.getElementById('modal');if(modal)modal.scrollTop=0;
    let snap;
    try{snap=await getDoc(doc(db,kind,id));}
    catch{if(token===generation&&panel())loading.textContent='تعذر تحميل التفاصيل. يمكنك الرجوع والمحاولة مجددًا.';return;}
    if(token!==generation||!panel())return;
    if(!snap.exists()){loading.textContent='السجل غير موجود.';return;}
    const d={...snap.data(),id};
    panel().replaceChildren();
    const header=detailHeader(),title=document.createElement('h3');
    title.textContent=(tabs[kind]||kind)+' · '+id;header.append(title);
    const description=document.createElement('dl');
    description.innerHTML=(fields[kind]||[]).map(f=>`<dt>${esc(labels[f])}</dt><dd dir="auto">${esc(value(d[f]))}</dd>`).join('');
    panel().append(description);
    for(const [field,target] of [['sellerId','users'],['reporterId','users'],['reportedUserId','users'],['lastBidderId','users'],['winnerId','users'],['animalId','animals']])if(d[field])panel().append(button(labels[field],()=>detail(target,d[field])));
    if(kind==='reports'){
      const target={user:'users',animal:'animals',auction:'auctions'}[d.targetType];if(target)panel().append(button('فتح الهدف',()=>detail(target,d.targetId)));
      for(const [s,label] of [['reviewing','تحت المراجعة'],['resolved','إغلاق/معالجة'],['rejected','رفض']])panel().append(button(label,()=>mutate(kind,id,label,(_,reason)=>({status:s,reviewedAt:serverTimestamp(),reviewedBy:auth.currentUser.uid,resolutionNotes:reason}))));
    }
    if(kind==='users'){
      for(const [s,label] of [['suspended','تعليق الحساب'],['blocked','حظر الحساب'],['active','إعادة التفعيل'],['deletion_requested','طلب حذف الحساب']])panel().append(button(label,()=>mutate(kind,id,label,()=>{if(id===auth.currentUser.uid)throw Error('self');return {status:s};})));
      const note=document.createElement('p');note.textContent='طلب الحذف الإداري يوقف الحساب ويضعه في قائمة المستخدمين بحالة deletion_requested. حذف Auth والبيانات نهائيًا يحتاج Backend موثوقًا.';panel().append(note);
      for(const [k,f,label] of [['animals','sellerId','إعلاناته'],['auctions','sellerId','مزاداته'],['auctions','lastBidderId','المزادات التي هو آخر مزايد فيها'],['purchaseRequests','buyerId','طلبات الشراء'],['reports','reporterId','بلاغاته'],['reports','reportedUserId','البلاغات ضده']])await related(k,f,id,label,token);
    }
    if(kind==='animals'){
      for(const [s,label] of [['hidden','إخفاء الإعلان'],['needs_review','يحتاج مراجعة'],['active','إعادة إظهار الإعلان']])panel().append(button(label,()=>mutate(kind,id,label,data=>{if(s==='active'&&!data.images?.length)throw Error('no-images');return {status:s,moderationLocked:true};})));
      const gallery=document.createElement('div');gallery.className='admin-gallery';panel().append(gallery);
      for(const image of d.images||[]){const src=safeImageData(image);if(!src)continue;const card=document.createElement('article');card.innerHTML=`<img src="${esc(src)}" alt="صورة الإعلان المحددة">`;card.append(button('حذف الصورة غير اللائقة',()=>mutate(kind,id,'حذف الصورة غير اللائقة',async data=>{
        if(!Array.isArray(data.images)||!data.images.includes(image))throw Error('stale');
        const images=data.images.filter(v=>v!==image);const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(image));
        return {images,imagesLocked:true,moderationLocked:true,status:images.length?data.status:'needs_review',metadata:{imageHash:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}};
      })));gallery.append(card);}
      await related('reports','targetId',id,'البلاغات المرتبطة (تحقق من نوع الهدف)',token);
    }
    if(kind==='auctions'){const p=document.createElement('p');p.textContent='السجل الحالي يحتفظ بآخر مزايدة فقط. الفائز يعرض فقط إن كان مسجلاً؛ لا يتم استنتاج فائز أو تغيير منطق الإغلاق.';panel().append(p);await related('reports','targetId',id,'البلاغات المرتبطة',token);}
  }
  async function related(kind,field,id,title,token) {
    try{const [total,snap]=await Promise.all([count(kind,[where(field,'==',id)]),getDocs(query(collection(db,kind),where(field,'==',id),limit(20)))]);if(token!==generation||!panel())return;const section=document.createElement('section');section.innerHTML=`<h4>${esc(title)}: ${total}</h4><p>عرض أول 20 سجلًا.</p>`;for(const d of snap.docs)section.append(button(d.data().name||d.id,()=>detail(kind,d.id)));panel().append(section);}catch{if(token===generation&&panel()){const p=document.createElement('p');p.textContent=title+': تعذر التحميل';panel().append(p);}}
  }
  async function report(targetType,targetId) {
    if(!auth.currentUser){alert('سجّل الدخول لإرسال بلاغ.');return;}
    const reason=prompt('سبب البلاغ (حتى 500 حرف)');if(!reason?.trim()||reason.length>500)return;
    const details=prompt('تفاصيل إضافية (حتى 2000 حرف)','');if(details===null||details.length>2000)return;
    try{const kind={user:'users',animal:'animals',auction:'auctions'}[targetType];if(!kind)return;
      let reportedUserId=targetId;if(targetType!=='user'){const snap=await getDoc(doc(db,kind,targetId));if(!snap.exists())throw Error('missing');reportedUserId=snap.data().sellerId;}
      const id=auth.currentUser.uid+'_'+targetType+'_'+targetId;
      await api.setDoc(doc(db,'reports',id),{reporterId:auth.currentUser.uid,targetType,targetId,reportedUserId,reason:reason.trim(),details:details.trim(),status:'open',createdAt:serverTimestamp()});alert('تم إرسال البلاغ.');
    }catch{alert('تعذر إرسال البلاغ. ربما سبق إرساله لهذا الهدف أو الحساب موقوف.');}
  }
  return {open,report,audit};
}
