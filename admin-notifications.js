// Administrative inbox derived from existing records; never writes to Firestore.
export const SOURCES = [
  ['purchaseRequests','purchaseRequests','pending','طلب شراء جديد'],
  ['serviceRequests','services','pending','طلب خدمة جديد'],
  ['reports','reports','open','بلاغ جديد'],
  ['reports','reports','reviewing','بلاغ قيد المراجعة'],
  ['commercialAds','commercialAds','pending','إعلان تجاري قيد المراجعة'],
  ['animals','animals','needs_review','إعلان يحتاج مراجعة'],
  ['users','users','deletion_requested','طلب حذف حساب']
];
const millis=v=>v?.toMillis?.()??(v?.seconds? v.seconds*1000 : new Date(v||0).getTime()||0);
export function notification(source,id,data){
  const [collection,tab,status,title]=source;
  return {key:JSON.stringify([collection,id,status,millis(data.updatedAt||data.createdAt)]),id,tab,status,
    title:collection==='serviceRequests'&&data.serviceType==='featured'?'طلب تمييز إعلان':title,
    time:millis(data.createdAt),description:'الطلب / السجل …'+id.slice(-6)};
}
export function installAdminNotifications(api,canRead,navigate){
  let cache=null;
  const identity=()=>JSON.stringify([api.auth.currentUser?.uid,api.getAccess().role,[...(api.getAccess().permissions||[])].sort()]);
  function seenFor(uid){try{return new Set(JSON.parse(localStorage.getItem('souq-admin-seen:'+uid)||'[]').filter(x=>typeof x==='string').slice(-500));}catch{return new Set();}}
  function persist(uid,seen){try{localStorage.setItem('souq-admin-seen:'+uid,JSON.stringify([...seen].slice(-500)));}catch{/* Session-only seen state remains usable. */}}
  function mount(host){
    const uid=api.auth.currentUser?.uid,signature=identity();if(!uid)return;
    const wrapper=document.createElement('div');wrapper.className='admin-notifications';
    wrapper.innerHTML='<button type="button" class="admin-notification-bell" aria-label="الإشعارات الإدارية" aria-expanded="false" aria-controls="adminNotificationPanel">♧</button><section id="adminNotificationPanel" class="admin-notification-panel" aria-label="الإشعارات الإدارية" hidden><h3>الإشعارات الإدارية</h3><p class="admin-muted">حتى 20 عنصرًا لكل حالة؛ العداد للعناصر المحمّلة. المشاهدة محفوظة على هذا الجهاز فقط.</p><div class="admin-notification-tools"><button type="button" data-all>تعليم الكل كمقروء</button><button type="button" data-refresh>تحديث</button></div><p role="status" data-status>جاري تحميل الإشعارات…</p><div data-items></div></section>';
    host.prepend(wrapper);const bell=wrapper.querySelector('button'),panel=wrapper.querySelector('section'),items=wrapper.querySelector('[data-items]'),status=wrapper.querySelector('[data-status]');
    bell.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4"/></svg><span data-count hidden></span>';
    let rows=[],seen=seenFor(uid),loading=false;
    const current=()=>wrapper.isConnected&&identity()===signature;
    function render(){if(!current()){wrapper.remove();return;}rows=rows.filter(r=>canRead(r.tab));const unread=rows.filter(r=>!seen.has(r.key)).length,counter=bell.querySelector('[data-count]');counter.hidden=!unread;counter.textContent=String(unread);bell.setAttribute('aria-label','الإشعارات الإدارية، '+unread+' غير مقروءة');items.replaceChildren();
      for(const row of rows){const b=document.createElement('button');b.type='button';b.className='admin-notification-item';for(const text of [row.title,row.description,row.time?new Date(row.time).toLocaleString('ar-AE'):'الوقت غير مسجل',seen.has(row.key)?'تمت المشاهدة':'جديد']){const span=document.createElement('span');span.textContent=text;b.append(span);}b.onclick=async()=>{if(!await api.requireAdminClaim(true)||!current()||!canRead(row.tab))return;seen.add(row.key);persist(uid,seen);render();await navigate(row.tab);};items.append(b);}
      wrapper.querySelector('[data-all]').disabled=!unread||loading;
    }
    async function load(force=false){if(loading)return;loading=true;wrapper.querySelector('[data-refresh]').disabled=true;
      try{if(!cache||cache.signature!==signature||force||Date.now()-cache.at>60000){const result=await Promise.all(SOURCES.filter(s=>canRead(s[1])).map(async source=>{try{const snap=await api.getDocs(api.query(api.collection(api.db,source[0]),api.where('status','==',source[2]),api.limit(20)));return {rows:snap.docs.map(d=>notification(source,d.id,d.data()))};}catch{return {rows:[],failed:true};}}));if(!current())return;cache={signature,at:Date.now(),rows:result.flatMap(r=>r.rows).sort((a,b)=>b.time-a.time),failed:result.some(r=>r.failed)};}
        if(!current())return;rows=cache.rows;status.textContent=cache.failed?'تعذر تحميل بعض الأقسام. أعد التحديث.':rows.length?'العناصر المحمّلة مرتبة من الأحدث.':'لا توجد إشعارات جديدة';
      }finally{loading=false;if(current()){wrapper.querySelector('[data-refresh]').disabled=false;render();}}
    }
    bell.onclick=()=>{if(!current()){wrapper.remove();return;}panel.hidden=!panel.hidden;bell.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)panel.querySelector('[data-refresh]').focus();};
    wrapper.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();e.stopImmediatePropagation();panel.hidden=true;bell.setAttribute('aria-expanded','false');bell.focus();}},true);
    wrapper.querySelector('[data-all]').onclick=()=>{if(!current())return;rows.filter(r=>canRead(r.tab)).forEach(r=>seen.add(r.key));persist(uid,seen);render();};
    wrapper.querySelector('[data-refresh]').onclick=()=>load(true);load();
  }
  return {mount};
}
