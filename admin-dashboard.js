import {can,VIEW} from './admin-permissions.js';
import {installAssistants} from './admin-assistants.js';
// Firebase dependencies are supplied by the existing application; no second app or credentials.
export function installAdminDashboard(api) {
  const {db, auth, collection, doc, getDoc, getDocs, query, where, limit, orderBy,
    startAfter, getCountFromServer, runTransaction, serverTimestamp, requireAdminClaim,
    showModal, escapeHtml: esc, safeImageData, formatDate} = api;
  const tabs = {home:'الرئيسية',users:'المستخدمون',animals:'الإعلانات',auctions:'المزادات',services:'طلبات الخدمات',purchaseRequests:'طلبات الشراء',assistants:'المساعدون والصلاحيات',reports:'البلاغات',adminAuditLogs:'سجل الإدارة'};
  const labels = {uid:'UID',displayName:'الاسم',phoneNumber:'الهاتف',email:'البريد',country:'الدولة',region:'المنطقة',city:'المدينة',accountType:'نوع الحساب',status:'الحالة',createdAt:'تاريخ التسجيل/النشر',lastLoginAt:'آخر دخول',subscriptionStatus:'الاشتراك',subscriptionExpiresAt:'انتهاء الاشتراك',name:'الحيوان',type:'النوع',sellerId:'البائع',sellerPhone:'التواصل',saleType:'نوع البيع',price:'السعر',startPrice:'سعر البداية',minIncrement:'الحد الأدنى للزيادة',currentPrice:'السعر الحالي',endTime:'انتهاء المزاد',lastBidderId:'أعلى/آخر مزايد',lastBidAt:'آخر مزايدة',winnerId:'الفائز المسجل',animalId:'الإعلان',reporterId:'المبلّغ',reportedUserId:'المستخدم المبلّغ عنه',targetType:'نوع الهدف',targetId:'الهدف',reason:'السبب',details:'التفاصيل',reviewedAt:'تاريخ المراجعة',reviewedBy:'المراجع',resolutionNotes:'ملاحظات الإدارة',adminUid:'المسؤول',action:'الإجراء',timestamp:'التاريخ'};
  const fields = {users:['uid','displayName','phoneNumber','email','country','region','city','accountType','status','subscriptionStatus','subscriptionExpiresAt','createdAt','lastLoginAt'],animals:['name','type','sellerId','sellerPhone','country','region','city','saleType','price','createdAt','status'],auctions:['animalId','sellerId','startPrice','minIncrement','currentPrice','endTime','status','lastBidderId','lastBidAt','winnerId'],reports:['reporterId','targetType','targetId','reportedUserId','reason','details','status','createdAt','reviewedBy','reviewedAt','resolutionNotes'],adminAuditLogs:['adminUid','action','targetType','targetId','reason','timestamp']};
  fields.purchaseRequests=['animalId','sellerId','buyerId','price','status','createdAt'];
  labels.buyerId='المشتري';
  Object.assign(labels,{currency:'العملة',paymentStatus:'حالة الدفع',serviceType:'الخدمة',amount:'السعر',rejectionReason:'سبب الرفض'});
  const titles={...tabs,purchaseRequests:'طلبات الشراء',serviceRequests:'طلبات الخدمات'};
  const icons={home:'⌂',users:'♙',animals:'▣',auctions:'⚒',services:'◇',reports:'⚑',adminAuditLogs:'▤',purchaseRequests:'▧'};
  const permitted=p=>can(api.getAccess(),p);
  const canRead=kind=>Boolean(VIEW[kind])&&permitted(VIEW[kind]);
  let viewKind='home';
  const actionPermission=(kind,action)=>kind==='users'?({'تعليق الحساب':'users_suspend','حظر الحساب':'users_block'}[action]||'users_manage'):({animals:'listings_manage',auctions:'auctions_manage',purchaseRequests:'purchase_requests_manage',reports:'reports_manage'}[kind]);
  const refs={sellerId:'users',buyerId:'users',reporterId:'users',reportedUserId:'users',lastBidderId:'users',winnerId:'users',adminUid:'users',reviewedBy:'users',animalId:'animals'};
  const reads=new Map();
  function cached(key,read){
    if(!reads.has(key)){if(reads.size>=400)reads.delete(reads.keys().next().value);reads.set(key,Promise.resolve().then(read).catch(()=>null));}
    return reads.get(key);
  }
  async function lookup(kind,id){
    if(!id||kind==='users'&&!canRead(kind)&&!permitted('assistants_create')&&!permitted('assistants_view'))return null;
    return cached(kind+'/'+id,async()=>{const snap=await getDoc(doc(db,kind,id));return snap.exists()?{...snap.data(),id:snap.id}:null;});
  }
  const displayName=(kind,d)=>d?.displayName||d?.name||d?.type||(kind==='users'?'اسم غير متاح':'بيانات غير متاحة');
  async function nameOf(kind,id){const data=await lookup(kind,id);if(kind==='auctions'&&data?.animalId)return displayName('animals',await lookup('animals',data.animalId));if(kind==='serviceRequests')return value(data?.serviceType)||'طلب خدمة';return displayName(kind,data);}
  function money(amount,data={}){
    if(amount==null||amount===''||!Number.isFinite(Number(amount)))return 'غير مسجل';
    const currency=data.currency||(data.country==='EG'?'EGP':data.country==='AE'||!data.country?'AED':'');
    return new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Number(amount))+' '+({AED:'د.إ',EGP:'ج.م'}[currency]||currency||'عملة غير محددة');
  }
  function dateText(input){
    if(input==null)return 'غير مسجل';
    const d=input?.toDate?input.toDate():input instanceof Date?input:typeof input==='object'&&('seconds'in input)?new Date(input.seconds*1000):new Date(input);
    return Number.isNaN(d.getTime())?'غير مسجل':new Intl.DateTimeFormat('ar-AE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'numeric',minute:'2-digit'}).format(d);
  }
  const tone=s=>['active','approved','accepted','paid','resolved'].includes(s)?'green':['blocked','rejected','hidden','not_approved'].includes(s)?'red':['pending','reviewing','open','suspended','needs_review','unpaid'].includes(s)?'gold':'blue';
  const badge=s=>`<span class="admin-badge ${tone(s)}">${esc(value(s))}</span>`;
  function technical(d){
    const keys=Object.keys(d).filter(k=>k==='id'||k==='uid'||/Id$|Uid$/.test(k)||k==='country');
    return '<details class="admin-technical"><summary>تفاصيل تقنية</summary><dl>'+keys.map(k=>`<dt>${esc(k)}</dt><dd dir="ltr">${esc(d[k]??'')}</dd>`).join('')+'</dl></details>';
  }
  async function presentation(kind,d){
    const animal=kind==='animals'?d:d.animalId?await lookup('animals',d.animalId):null;
    const data={...animal,...d},entries=[];
    for(const f of fields[kind]||[]){
      if(['uid','name','displayName','status'].includes(f)||(['subscriptionStatus','subscriptionExpiresAt'].includes(f)&&!d[f]))continue;
      let text=d[f];
      if(refs[f]){if(!text)continue;text=await nameOf(refs[f],text);}
      else if(f==='targetId'){const target={users:'users',user:'users',animals:'animals',animal:'animals',auction:'auctions',auctions:'auctions',serviceRequests:'serviceRequests',adminAccess:'users'}[d.targetType];text=target?await nameOf(target,d[f]):'هدف إداري';}
      else if(/At$|Time$|timestamp|ExpiresAt/.test(f))text=dateText(text);
      else if(['price','startPrice','currentPrice','minIncrement','amount'].includes(f))text=money(text,data);
      else text=value(text);
      entries.push([labels[f]||'معلومات',text]);
    }
    if(animal&&kind!=='animals')entries.unshift(['الموقع',[value(animal.country),animal.region,animal.city].filter(Boolean).join(' · ')]);
    const title=kind==='users'?displayName(kind,d):kind==='animals'?displayName(kind,d):kind==='auctions'||kind==='purchaseRequests'?displayName('animals',animal):kind==='reports'?'بلاغ · '+value(d.targetType):kind==='adminAuditLogs'?value(d.action):titles[kind]||'تفاصيل';
    return {title,entries,image:safeImageData((animal||d).images?.[0]),data};
  }
  async function card(kind,d){
    const node=document.createElement('article');node.className='admin-row';node.dataset.kind=kind;node.innerHTML='<p class="admin-muted">جاري عرض البيانات…</p>';
    const render=async()=>{
      const model=await presentation(kind,d);
      node.innerHTML=(model.image?`<img class="admin-card-image" src="${esc(model.image)}" alt="صورة الحيوان">`:kind==='animals'?'<div class="admin-image-empty" role="img" aria-label="لا توجد صورة">▧<span>لا توجد صورة</span></div>':'')+
        `<div class="admin-card-heading"><span class="admin-avatar" aria-hidden="true">${icons[kind]||'◇'}</span><h3>${esc(model.title)}</h3>${d.status?badge(d.status):kind==='adminAuditLogs'?badge(d.action):''}</div>`+
        (kind==='users'?`<div class="admin-person-summary"><strong>${esc(d.phone||d.phoneNumber||'الهاتف غير مسجل')}</strong>${d.accountType?badge(d.accountType):''}</div>`:'')+
        (kind==='animals'&&d.saleType?badge(d.saleType):'')+
        '<dl>'+model.entries.map(([k,v])=>`<dt>${esc(k)}</dt><dd class="${/السعر الحالي/.test(k)?'admin-price-current':/السعر|سعر البداية/.test(k)?'admin-price':' '}" data-label="${esc(k)}">${esc(v)}</dd>`).join('')+'</dl>'+
        (kind==='animals'?`<p class="admin-muted">عدد الصور: ${d.images?.length||0}</p>`:'')+
        (kind==='auctions'?'<p class="admin-muted">عدد المزايدات التاريخي: غير متاح</p>':'')+
        (kind==='purchaseRequests'?`<p class="admin-muted">رقم الطلب: …${esc(d.id.slice(-6))}</p>`:'')+technical(d);
      const photo=node.querySelector('.admin-card-image');
      if(photo){
        const emptyPhoto=()=>{const empty=document.createElement('div');empty.className='admin-image-empty';empty.setAttribute('role','img');empty.setAttribute('aria-label','لا توجد صورة');empty.innerHTML='▧<span>لا توجد صورة</span>';photo.replaceWith(empty);};
        photo.addEventListener('error',emptyPhoto,{once:true});
        photo.addEventListener('load',()=>{
          // Old local preview used flat 20px JPEG tiles; these are not listing photos.
          if(photo.naturalWidth!==20||photo.naturalHeight!==20)return;
          const canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;
          const context=canvas.getContext('2d');context.drawImage(photo,0,0);
          const pixels=context.getImageData(0,0,20,20).data;
          if(pixels.every((value,index)=>Math.abs(value-pixels[index%4])<=2))emptyPhoto();
        },{once:true});
      }
      if(kind==='adminAuditLogs'||kind==='reports'){
        const entries=new Map(model.entries);
        const line=(label)=>entries.has(label)?`<p><span>${esc(label)}:</span> <strong>${esc(entries.get(label))}</strong></p>`:'';
        node.innerHTML=`<div class="admin-card-heading"><span class="admin-avatar" aria-hidden="true">${icons[kind]}</span><h3>${esc(kind==='reports'?'بلاغ عن '+value(d.targetType):model.title)}</h3>${badge(kind==='reports'?d.status:d.action)}</div><div class="admin-event-people">${kind==='reports'?line('المبلّغ')+line('المستخدم المبلّغ عنه'):line('المسؤول')}${line('نوع الهدف')}${line('الهدف')}</div><div class="admin-event-reason">${line('السبب')}${line('التفاصيل')}</div><p class="admin-event-date">◷ ${esc(entries.get('التاريخ')||entries.get('تاريخ التسجيل/النشر')||'غير مسجل')}</p>${technical(d)}`;
      }
      const actions=document.createElement('div');actions.className='admin-actions';
      actions.append(button('فتح التفاصيل',()=>detail(kind,d.id)));
      if(kind==='animals'&&d.sellerId&&canRead('users'))actions.append(button('عرض البائع',()=>detail('users',d.sellerId)));
      if(kind==='purchaseRequests')for(const [f,k,label]of [['animalId','animals','عرض الإعلان'],['sellerId','users','عرض البائع'],['buyerId','users','عرض المشتري']])if(d[f]&&canRead(k))actions.append(button(label,()=>detail(k,d[f])));
      node.append(actions);
      if(kind==='users'&&['animals','auctions','purchaseRequests','reports'].every(canRead)){
        const stats=document.createElement('details');stats.className='admin-user-counts';stats.innerHTML='<summary>إحصاءات المستخدم</summary><div class="admin-mini-stats">افتح لعرض الأعداد</div>';node.append(stats);
        stats.addEventListener('toggle',async()=>{if(!stats.open||stats.dataset.loaded)return;stats.dataset.loaded='true';const results=await Promise.all([['animals','sellerId','الإعلانات'],['auctions','sellerId','المزادات'],['purchaseRequests','buyerId','الطلبات'],['reports','reportedUserId','البلاغات ضده']].map(async([k,f,label])=>[label,await cached('count/'+k+'/'+f+'/'+d.id,()=>count(k,[where(f,'==',d.id)]))]));stats.querySelector('div').innerHTML=results.map(([label,n])=>`<span>${esc(label)} <b>${n??'غير متاح'}</b></span>`).join('');});
      }
      return node;
    };
    await render();return node;
  }
  function shell(tab){
    showModal(`<section class="admin-v2" dir="rtl"><aside class="admin-sidebar"><div class="admin-brand"><span aria-hidden="true">◈</span><strong>سوق الحلال الإلكتروني</strong><small>مركز الإدارة</small></div><div class="admin-identity"><span class="admin-avatar">♙</span><b>${esc(auth.currentUser?.displayName||'مسؤول المنصة')}</b><small>${api.getAccess().role==='super_admin'?'Super Admin':'مساعد مدير'}</small></div><nav id="adminV2Nav" aria-label="تبويبات الإدارة"></nav><div id="adminLogout"></div></aside><div class="admin-workspace"><div class="admin-topbar"><div><small>لوحة الإدارة / ${esc(tabs[tab])}</small><h2>${esc(tabs[tab])}</h2></div><span class="admin-badge green">إدارة آمنة</span></div><div id="adminV2Body" aria-live="polite">جاري التحميل…</div></div></section>`);
    for(const [key,label]of Object.entries(tabs)){if(!canRead(key))continue;const b=button(label,()=>key==='services'?api.openServices():open(key));b.dataset.icon=icons[key]||'♙';b.setAttribute('aria-label',label);b.setAttribute('aria-current',String(key===tab));document.getElementById('adminV2Nav').append(b);}
    document.getElementById('adminLogout').append(button('تسجيل الخروج',()=>api.logout()));
    const identity=document.querySelector('.admin-identity b');
    if(!auth.currentUser?.displayName&&auth.currentUser?.uid)nameOf('users',auth.currentUser.uid).then(name=>{if(identity.isConnected&&name!=='اسم غير متاح')identity.textContent=name;});

  }
  async function styleServices(){
    generation++;trail=[];current='services';viewLabel=tabs.services;
    const content=document.getElementById('modalContent'),nodes=[...content.childNodes];shell('services');
    const root=document.createElement('div');root.className='admin-services';root.append(...nodes);panel().replaceChildren(root);
  }

  const terms={adminAccess:'مساعد مدير',assistant_created:'إضافة مساعد',assistant_permissions_updated:'تعديل صلاحيات مساعد',assistant_suspended:'إيقاف مساعد',assistant_reactivated:'إعادة تفعيل مساعد',assistant_role_removed:'إزالة صلاحية مساعد',service_approved:'اعتماد طلب خدمة',service_rejected:'رفض طلب خدمة',deletion_in_review:'مراجعة طلب الحذف',deletion_completed:'اكتمال متابعة الحذف',AE:'الإمارات العربية المتحدة',EG:'مصر',users:'مستخدم',animals:'إعلان',auctions:'مزاد',purchaseRequests:'طلب شراء',serviceRequests:'طلب خدمة',suspend:'تعليق الحساب',block:'حظر الحساب',delete_request:'طلب حذف الحساب',paid:'مدفوع',unpaid:'غير مدفوع',featured:'تمييز الإعلان',bump:'رفع الإعلان',verification:'توثيق الحيوان',active:'نشط',suspended:'معلق',blocked:'محظور',deletion_requested:'طلب حذف',hidden:'مخفي',needs_review:'يحتاج مراجعة',sold:'تم البيع',not_approved:'لم يعتمد البيع',buyer:'مشترٍ',seller:'بائع',both:'بائع ومشترٍ',direct:'بيع مباشر',auction:'مزاد',open:'مفتوح',reviewing:'تحت المراجعة',resolved:'معالج',rejected:'مرفوض',pending:'جديد / قيد الانتظار',approved:'معتمد',accepted:'مقبول',cancelled:'ملغي',user:'مستخدم',animal:'إعلان'};
  let generation=0, page=[], cursor=null, current='home', filters={}, busy=false, trail=[], viewLabel=tabs.home;
  const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=busy;b.dataset.tone=/حذف|حظر|رفض|إخفاء/.test(text)?'red':/تعليق|مراجعة/.test(text)?'gold':'green';b.onclick=()=>Promise.resolve().then(fn).catch(()=>alert('تعذر تنفيذ العملية. تحقق من الاتصال والصلاحيات.'));return b;};
  const value=v=>v?.toDate ? dateText(v) : v == null || v === '' ? 'غير مسجل' : terms[v]||String(v);
  const panel=()=>document.getElementById('adminV2Body');
  function audit(tx,action,targetType,targetId,reason,metadata={}) {
    const ref=doc(collection(db,'adminAuditLogs'));
    tx.set(ref,{adminUid:auth.currentUser.uid,action,targetType,targetId,reason,timestamp:serverTimestamp(),metadata});
    return ref.id;
  }
  function reasonFor(message) {if(!confirm(message))return null;const reason=prompt('سبب الإجراء الإداري (إلزامي، حتى 500 حرف)');return reason?.trim() && reason.trim().length<=500 ? reason.trim() : null;}
  async function mutate(kind,id,action,makePatch) {
    if(busy || !await api.requireAdminPermission(actionPermission(kind,action)))return;
    if(kind==='users'&&api.getAccess().role!=='super_admin'&&(id===auth.currentUser.uid||api.getAccess().protectedUids.includes(id)))return;
    const reason=reasonFor('هل أنت متأكد من تنفيذ هذا الإجراء: '+action+'؟');if(!reason)return;
    busy=true;
    try {await runTransaction(db,async tx=>{const ref=doc(db,kind,id),snap=await tx.get(ref);if(!snap.exists())throw Error('missing');const patch=await makePatch(snap.data(),reason);const logId=audit(tx,action,kind,id,reason,patch.metadata||{});delete patch.metadata;tx.update(ref,{...patch,moderationLogId:logId});});await detail(kind,id,false);}
    finally{busy=false;document.querySelector('.admin-v2')?.querySelectorAll('button').forEach(b=>{b.disabled=false;});}
  }
  async function open(tab) {
    if(!await requireAdminClaim(true)){alert('غير مصرح لك بفتح لوحة الإدارة.');return;}
    if(tab===undefined)tab=Object.keys(tabs).find(canRead);if(!tab||!canRead(tab)){alert('غير مصرح لك بفتح هذا القسم.');return;}
    reads.clear();current=tab;viewKind=tab;cursor=null;filters={};trail=[];viewLabel=tab==='users'?'قائمة المستخدمين':'قائمة '+tabs[tab];generation++;
    shell(tab);
    try {if(tab==='home')await home();else if(tab==='assistants')await assistants.render(panel());else if(tab==='services')await api.openServices();else await list(false);}catch{if(panel())panel().textContent='تعذر تحميل البيانات. أعد اختيار التبويب للمحاولة.';}
  }
  async function count(kind,conditions=[]) {return (await getCountFromServer(query(collection(db,kind),...conditions))).data().count;}
  async function home() {
    const token=generation, cards=[];
    for(const [kind,title,statuses] of [['users','المستخدمون',['active','suspended','blocked']],['animals','الإعلانات',['active','hidden','needs_review','sold','not_approved']],['auctions','المزادات',['active','sold','not_approved']],['purchaseRequests','طلبات الشراء',['pending','accepted','rejected']],['reports','البلاغات',['open','reviewing','resolved','rejected']],['serviceRequests','الخدمات',['pending','approved','rejected','cancelled']]]) {
      if(!canRead(kind))continue;cards.push([title,kind,[]]);for(const s of statuses)cards.push([title+' · '+value(s),kind,[where('status','==',s)]]);
    }
    if(canRead('users'))for(const role of ['buyer','seller','both'])cards.push(['نوع الحساب · '+value(role),'users',[where('accountType','==',role)]]);
    if(canRead('animals'))for(const sale of ['direct','auction'])cards.push(['نوع البيع · '+value(sale),'animals',[where('saleType','==',sale)]]);
    if(canRead('auctions'))cards.push(['مزادات انتهى وقتها','auctions',[where('endTime','<=',new Date())]]);
    const results=await Promise.all(cards.map(async([title,kind,conditions])=>{try{return [title,await count(kind,conditions)];}catch{return [title,'تعذر الإحصاء'];}}));
    if(token!==generation||!panel())return;
    const tile=([title,n])=>`<article><span class="admin-stat-icon" aria-hidden="true">${title.includes('المستخدم')?'♟':title.includes('الإعلانات')?'⚑':title.includes('المزادات')?'⚒':title.includes('الشراء')?'🛒':title.includes('البلاغ')?'⚑':'▤'}</span><span>${esc(title)}</span><strong>${esc(n)}</strong></article>`;
    panel().innerHTML='<p class="admin-muted">نظرة عامة على السوق، بأعداد مستقلة عن صفحات العرض.</p><div class="admin-stats admin-overview">'+results.filter((_,i)=>cards[i][2].length===0).map(tile).join('')+'</div><details class="admin-breakdown"><summary>تفاصيل الإحصاءات حسب الحالة</summary><div class="admin-stats">'+results.filter((_,i)=>cards[i][2].length>0).map(tile).join('')+'</div></details><p class="admin-notice">قد يشمل عدد المزادات النشطة مزادات انتهى وقتها وتنتظر قرار البائع. سجل المزايدات التاريخي غير متاح حاليًا.</p>';

  }
  async function list(next) {
    const token=++generation,kind=current;
    if(!await api.requireAdminPermission(VIEW[kind])){panel().textContent='غير مصرح';return;}
    const constraints=Object.entries(filters).filter(([,v])=>v).map(([k,v])=>where(k,'==',v));
    constraints.push(orderBy('__name__'));if(next&&cursor)constraints.push(startAfter(cursor));constraints.push(limit(50));
    panel().textContent='جاري التحميل…';
    const snap=await getDocs(query(collection(db,kind),...constraints));if(token!==generation||!panel())return;
    const auctionSummary=kind==='auctions'?await Promise.all([['إجمالي',[]],['نشط',[where('status','==','active')]],['مباع',[where('status','==','sold')]],['انتهى وقته',[where('endTime','<=',new Date())]],['غير معتمد',[where('status','==','not_approved')]]].map(async([label,c])=>{try{return [label,await count(kind,c)];}catch{return [label,'غير متاح'];}})):null;
    if(token!==generation||!panel())return;
    page=snap.docs.map(d=>({...d.data(),id:d.id}));cursor=snap.docs.at(-1);
    panel().innerHTML='<p>50 سجلًا كحد أقصى للصفحة. البحث النصي داخل الصفحة الحالية؛ الفلاتر تطبق على الخادم.</p><div id="adminFilters"></div><div id="adminRows"></div>';
    if(auctionSummary){const summary=document.createElement('div');summary.className='admin-stats';summary.innerHTML=auctionSummary.map(([label,n])=>`<article><span>${esc(label)}</span><strong>${esc(n)}</strong></article>`).join('');panel().prepend(summary);}
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
  let rowRevision=0;
  async function rows(items) {
    const revision=++rowRevision,root=document.getElementById('adminRows'),kind=current;
    root.innerHTML='<p>جاري عرض النتائج…</p>';
    const nodes=await Promise.all(items.map(d=>card(kind,d)));
    if(revision!==rowRevision||!root.isConnected)return;
    root.replaceChildren(...nodes);if(!items.length)root.textContent='لا توجد نتائج.';
  }
  // Preserve nodes and their handlers so Back retains the search, filters and page.
  async function back() {
    if(!await requireAdminClaim(true) || !trail.length || !panel())return;
    generation++;
    const previous=trail.at(-1);if(!canRead(previous.kind)){panel().textContent='غير مصرح';return;}trail.pop();viewKind=previous.kind;
    panel().replaceChildren(...previous.nodes);
    viewLabel=previous.label;
    previous.focus?.focus({preventScroll:true});
    const modal=document.getElementById('modal');
    if(modal)document.scrollingElement.scrollTop=previous.scroll;
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
    if(!canRead(kind)){alert('غير مصرح لك بفتح هذا القسم.');return;}
    if(push)trail.push({nodes:[...panel().childNodes],label:viewLabel,kind:viewKind,focus:document.activeElement,scroll:document.scrollingElement?.scrollTop||0});
    viewKind=kind;viewLabel='تفاصيل '+(titles[kind]||'السجل');
    const token=++generation;panel().replaceChildren();detailHeader();
    const loading=document.createElement('p');loading.textContent='جاري تحميل التفاصيل…';panel().append(loading);
    const modal=document.getElementById('modal');if(modal)document.scrollingElement.scrollTop=0;
    let snap;
    try{snap=await getDoc(doc(db,kind,id));}
    catch{if(token===generation&&panel())loading.textContent='تعذر تحميل التفاصيل. يمكنك الرجوع والمحاولة مجددًا.';return;}
    if(token!==generation||!panel())return;
    if(!snap.exists()){loading.textContent='السجل غير موجود.';return;}
    const d={...snap.data(),id};
    reads.set(kind+'/'+id,Promise.resolve(d));
    const model=await presentation(kind,d);if(token!==generation||!panel())return;
    panel().replaceChildren();
    const header=detailHeader(),title=document.createElement('h3');
    title.textContent=model.title;header.append(title);
    const description=document.createElement('dl');
    description.innerHTML=model.entries.map(([k,v])=>`<dt>${esc(k)}</dt><dd${v==='غير مسجل'?' class="admin-missing"':''}>${esc(v)}</dd>`).join('');
    const identity=document.createElement('article');identity.className='admin-detail-card';identity.dataset.kind=kind;
    identity.innerHTML=`<div class="admin-card-heading"><span class="admin-avatar">${icons[kind]||'◇'}</span><strong>${esc(model.title)}</strong>${d.status?badge(d.status):kind==='adminAuditLogs'?badge(d.action):''}</div>`;
    identity.append(description);identity.insertAdjacentHTML('beforeend',technical(d));panel().append(identity);
    for(const [field,target] of [['sellerId','users'],['reporterId','users'],['reportedUserId','users'],['lastBidderId','users'],['winnerId','users'],['animalId','animals']])if(d[field]&&canRead(target))panel().append(button(labels[field],()=>detail(target,d[field])));
    if(kind==='reports'){
      const target={user:'users',animal:'animals',auction:'auctions'}[d.targetType];if(target&&canRead(target))panel().append(button('فتح الهدف',()=>detail(target,d.targetId)));
      if(permitted('reports_manage'))for(const [s,label] of [['reviewing','تحت المراجعة'],['resolved','إغلاق/معالجة'],['rejected','رفض']])panel().append(button(label,()=>mutate(kind,id,label,(_,reason)=>({status:s,reviewedAt:serverTimestamp(),reviewedBy:auth.currentUser.uid,resolutionNotes:reason}))));
    }
    if(kind==='users'){
      for(const [s,label] of [['suspended','تعليق الحساب'],['blocked','حظر الحساب'],['active','إعادة التفعيل'],['deletion_requested','طلب حذف الحساب']])if(permitted(actionPermission(kind,label))&&(api.getAccess().role==='super_admin'||id!==auth.currentUser.uid&&!api.getAccess().protectedUids.includes(id)))panel().append(button(label,()=>mutate(kind,id,label,()=>{if(id===auth.currentUser.uid)throw Error('self');return {status:s};})));
      const note=document.createElement('p');note.textContent='طلب الحذف الإداري يوقف الحساب ويضعه في قائمة المستخدمين بحالة deletion_requested. حذف Auth والبيانات نهائيًا يحتاج Backend موثوقًا.';panel().append(note);
      await userRelated(id,token);
      if(token===generation&&identity.isConnected){
        const layout=document.createElement('div');layout.className='admin-user-layout';
        const profile=document.createElement('aside');profile.className='admin-user-profile';
        const records=panel().querySelector('.admin-user-related');
        const content=[...panel().children].filter(node=>node!==header&&node!==records);
        profile.append(...content);layout.append(profile);if(records)layout.append(records);panel().append(layout);
        title.textContent='تفاصيل المستخدم';
      }
    }
    if(kind==='animals'){
      if(permitted('listings_manage'))for(const [s,label] of [['hidden','إخفاء الإعلان'],['needs_review','يحتاج مراجعة'],['active','إعادة إظهار الإعلان']])panel().append(button(label,()=>mutate(kind,id,label,data=>{if(s==='active'&&!data.images?.length)throw Error('no-images');return {status:s,moderationLocked:true};})));
      const gallery=document.createElement('div');gallery.className='admin-gallery';panel().append(gallery);
      for(const image of d.images||[]){const src=safeImageData(image);if(!src)continue;const card=document.createElement('article');card.innerHTML=`<img src="${esc(src)}" alt="صورة الإعلان المحددة">`;if(permitted('listings_manage'))card.append(button('حذف الصورة غير اللائقة',()=>mutate(kind,id,'حذف الصورة غير اللائقة',async data=>{
        if(!Array.isArray(data.images)||!data.images.includes(image))throw Error('stale');
        const images=data.images.filter(v=>v!==image);const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(image));
        return {images,imagesLocked:true,moderationLocked:true,status:images.length?data.status:'needs_review',metadata:{imageHash:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}};
      })));gallery.append(card);}
      await related('reports','targetId',id,'البلاغات المرتبطة (تحقق من نوع الهدف)',token);
    }
    if(kind==='purchaseRequests'&&permitted('purchase_requests_manage')&&d.status==='pending')for(const [status,label]of [['accepted','قبول الطلب'],['rejected','رفض الطلب']])panel().append(button(label,()=>mutate(kind,id,label,()=>({status,updatedAt:serverTimestamp()}))));
    if(kind==='auctions'&&permitted('auctions_manage')&&d.status==='active'&&d.endTime?.toDate?.()<=new Date())for(const [status,label]of [['sold','اعتماد انتهاء المزاد'],['not_approved','عدم اعتماد المزاد']])panel().append(button(label,()=>mutate(kind,id,label,()=>({status,updatedAt:serverTimestamp()}))));
    if(kind==='auctions'){const p=document.createElement('p');p.textContent='السجل الحالي يحتفظ بآخر مزايدة فقط. الفائز يعرض فقط إن كان مسجلاً؛ لا يتم استنتاج فائز أو تغيير منطق الإغلاق.';panel().append(p);await related('reports','targetId',id,'البلاغات المرتبطة',token);}
  }
  async function related(kind,field,id,title,token,container=panel()) {
    if(!canRead(kind))return;
    const section=document.createElement('section');section.className='admin-related';container.append(section);
    try{const [total,snap]=await Promise.all([count(kind,[where(field,'==',id)]),getDocs(query(collection(db,kind),where(field,'==',id),limit(20)))]);
      if(token!==generation||!section.isConnected)return;
      section.innerHTML=`<h4>${esc(title)} <span class="admin-badge blue">${total}</span></h4><p class="admin-muted">عرض أول 20 سجلًا</p>`;
      const grid=document.createElement('div');grid.className='admin-related-grid';section.append(grid);
      const nodes=await Promise.all(snap.docs.map(d=>card(kind,{...d.data(),id:d.id})));
      if(token!==generation||!grid.isConnected)return;grid.append(...nodes);
      if(!nodes.length)grid.textContent='لا توجد سجلات.';
    }catch{if(token===generation&&section.isConnected)section.textContent=title+': تعذر التحميل';}
  }
  async function userRelated(id,token){
    const options=[['purchaseRequests','buyerId','طلبات الشراء'],['animals','sellerId','الإعلانات'],['auctions','sellerId','المزادات'],['auctions','lastBidderId','المزايدات'],['reports','reporterId','البلاغات']].filter(([k])=>canRead(k));
    const root=document.createElement('section');root.className='admin-user-related';
    root.innerHTML='<div class="admin-stats admin-user-stats"></div><div class="admin-detail-tabs" role="tablist" aria-label="سجلات المستخدم"></div><div class="admin-user-records"></div>';panel().append(root);
    const nav=root.querySelector('.admin-detail-tabs'),body=root.querySelector('.admin-user-records');
    let selected=0;
    const select=async(index)=>{selected=index;body.replaceChildren();[...nav.children].forEach((b,i)=>b.setAttribute('aria-selected',String(i===index)));const [k,f,label]=options[index];
      if(f==='lastBidderId'){const note=document.createElement('p');note.className='admin-notice';note.textContent='المعروض: المزادات التي يحتفظ فيها السجل بالمستخدم كآخر مزايد. سجل المزايدات الكامل وعدده غير متاحين.';body.append(note);}
      await related(k,f,id,label,token,body);
      if(k==='reports'&&selected===index)await related('reports','reportedUserId',id,'البلاغات ضده',token,body);
    };
    options.forEach(([, ,label],index)=>{const b=button(label,()=>select(index));b.setAttribute('role','tab');nav.append(b);});
    const tiles=options.map(([k,,label],i)=>{const b=button('',()=>select(i));b.innerHTML=`<span class="admin-stat-icon">${icons[k]||'◇'}</span><strong>…</strong><span>${esc(label)}</span>`;root.querySelector('.admin-stats').append(b);return b;});
    await Promise.all(options.map(async([k,f],i)=>{const n=f==='lastBidderId'?'غير متاح':await cached('count/'+k+'/'+f+'/'+id,()=>count(k,[where(f,'==',id)]));if(token!==generation||!root.isConnected)return;tiles[i].querySelector('strong').textContent=n??'غير متاح';tiles[i].querySelector('strong').classList.toggle('admin-missing',n==='غير متاح'||n==null);}));
    if(options.length&&token===generation&&root.isConnected)await select(0);
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
  const assistants=installAssistants(api,{esc,button,nameOf,dateText,technical});
  return {open,report,audit,styleServices,nameOf,money,dateText,badge,technical};
}
