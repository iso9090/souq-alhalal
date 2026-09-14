// Administrative report details never expose the reporter's identity.
export function createReportModerationViews(c){
 const {store,s,actor,can,t,esc,button,openDialog}=c;
 let selectedImage=null,openVersion=0;
 const fail=code=>{throw Object.assign(new Error(code),{code});};
 const allowed=p=>can(actor(),p);
 const requirePermission=p=>{if(!allowed(p))fail('PERMISSION');};
 const record=id=>{const r=store.state.reports.find(r=>r.id===id);if(!r)fail('MISSING');return r;};
 const listing=r=>store.state.listings.find(a=>a.id===r.listingId);
 const user=r=>store.state.users.find(u=>u.uid===(r.targetUid||listing(r)?.ownerUid));
 const closed=r=>['resolved','dismissed'].includes(r.status);
 const reasonField=()=>`<label>${t('سبب القرار','Decision reason')}<textarea name="reason" required minlength="3" maxlength="500"></textarea></label>`;
 function reports(){
  if(!allowed('reports_view'))return c.noData(t('غير مصرح','Not authorized'));
  return `<div class="campaign-list report-list">${store.state.reports.filter(r=>!s.adminCountry||(listing(r)||user(r))?.country===s.adminCountry).map(r=>`<article class="campaign"><h3>${esc(r.reason)}</h3><p>${esc(r.targetUid||r.listingId)}</p><span class="state-chip">${esc(r.status)}</span><div class="manage-actions">${r.listingId&&allowed('listings_view')?button(t('فتح الإعلان','Open listing'),'report-listing',`data-id="${esc(r.id)}"`):''}${(r.targetUid||r.listingId&&allowed('listings_view'))&&allowed('users_view')?button(t('فتح المستخدم','Open user'),'report-target-user',`data-id="${esc(r.id)}"`):''}${allowed('reports_manage')&&!closed(r)?button(t('مراجعة وإجراءات','Review & actions'),'report-actions',`data-id="${esc(r.id)}"`):''}</div></article>`).join('')||c.noData(t('لا توجد بلاغات متاحة','No available reports'))}</div>`;
 }
 function handleClick(el,loaded={}){
  const {action,id,index}=el.dataset;
  if(!['report-actions','report-listing','report-target-user','report-remove-image'].includes(action))return false;
  requirePermission('reports_view');const r=record(id),a=loaded.listing||listing(r);
  if(action==='report-actions'){
   requirePermission('reports_manage');if(closed(r))fail('STATE');
   const options=[['review','قيد المراجعة','Reviewing'],['resolve','تمت المعالجة','Resolve'],['dismiss','استبعاد','Dismiss']];
   if(a&&!a.legacy&&!a.removed&&allowed('listings_manage'))options.push(['hide','إخفاء الإعلان','Hide listing'],['needs_review','يتطلب مراجعة','Needs review']);
   options.push(['escalate','تصعيد','Escalate']);
   openDialog(t('إجراءات البلاغ','Report actions'),`<form id="report-action-form" data-id="${esc(id)}"><label>${t('الإجراء','Action')}<select name="action">${options.map(([value,ar,en])=>`<option value="${value}">${t(ar,en)}</option>`).join('')}</select></label>${reasonField()}<button type="submit">${t('تأكيد','Confirm')}</button></form>`);
  }
  if(action==='report-listing'){
   requirePermission('listings_view');if(!a){unavailable('listing:'+r.listingId);return true;}
   openDialog(t('الإعلان محل البلاغ','Reported listing'),`<section class="report-listing-detail"><h3>${esc(a.title)}</h3><p>${esc(a.description||'')}</p><p>${esc(a.status)} · ${esc(a.city||'')}</p><div class="report-image-grid">${(a.images||[]).map((image,i)=>`<figure><img src="${esc(c.asset(image))}" alt="${t('صورة الإعلان','Listing image')} ${i+1}" loading="lazy"><figcaption>${i+1}</figcaption>${allowed('listings_manage')&&!a.legacy&&!a.removed&&typeof store.removeListingImage==='function'?button(t('إزالة هذه الصورة','Remove this image'),'report-remove-image',`data-id="${esc(id)}" data-index="${i}"`):''}</figure>`).join('')}</div></section>`);
  }
  if(action==='report-target-user'){
   requirePermission('users_view');const u=loaded.user||user(r);if(!u){unavailable('user:'+(r.targetUid||a?.ownerUid));return true;}
   openDialog(t('المستخدم محل البلاغ','Reported user'),`<section><h3>${esc(u.displayName||u.name||u.uid)}</h3><p>${esc(u.uid)}</p><p>${esc(u.status||'')}</p></section>`);
  }
  if(action==='report-remove-image'){
   requirePermission('listings_view');requirePermission('listings_manage');
   if(!a||a.legacy||a.removed||!Number.isInteger(Number(index))||!a.images?.[Number(index)])fail('STATE');
   selectedImage={reportId:id,listingId:a.id,image:a.images[Number(index)]};
   openDialog(t('تأكيد إزالة الصورة','Confirm image removal'),`<form id="report-image-form" data-id="${esc(id)}"><img class="report-remove-preview" src="${esc(c.asset(selectedImage.image))}" alt="${t('الصورة المحددة للإزالة','Selected image for removal')}"><p class="notice">${t('ستزال هذه الصورة فقط ويُخفى الإعلان حتى مراجعة الإدارة.','Only this image will be removed; the listing will be hidden pending administrative review.')}</p>${reasonField()}<button type="submit" class="danger">${t('إزالة الصورة المحددة','Remove selected image')}</button></form>`);
  }
  return true;
 }
 function unavailable(key){const missing=store.state.capabilities?.[key]?.status==='empty';openDialog(t('تفاصيل البلاغ','Report details'),'<p role="status">'+(missing?t('السجل غير موجود أو تمت إزالته.','Record no longer exists or was removed.'):t('التفاصيل غير متاحة حاليًا. حاول مجددًا أو تحقق من الصلاحيات.','Details unavailable. Retry or check permissions.'))+'</p>');}
 function open(el){
  const {action,id}=el.dataset;if(!['report-actions','report-listing','report-target-user','report-remove-image'].includes(action))return false;
  const version=++openVersion;requirePermission('reports_view');
  if(action==='report-listing')requirePermission('listings_view');if(action==='report-target-user')requirePermission('users_view');if(action==='report-actions')requirePermission('reports_manage');
  const r=record(id),a=listing(r),needsListing=!!r.listingId&&!a&&(action==='report-listing'||action==='report-actions'&&allowed('listings_manage')||action==='report-target-user'&&!r.targetUid&&allowed('listings_view'));
  const needsUser=action==='report-target-user'&&!user(r);
  if(!needsListing&&!needsUser)return handleClick(el);
  const identity=JSON.stringify(actor()),valid=()=>version===openVersion&&JSON.stringify(actor())===identity&&allowed('reports_view')&&store.state.reports.find(row=>row.id===id)===r;
  return (async()=>{const loaded={};
   if(needsListing&&store.loadListing)loaded.listing=await store.loadListing(r.listingId);
   if(!valid())return true;
   if(needsUser&&store.loadUser){const uid=r.targetUid||(loaded.listing||a)?.ownerUid;if(uid&&allowed('users_view'))loaded.user=await store.loadUser(uid);}
   if(!valid())return true;return handleClick(el,loaded);
  })();
 }
 async function handleSubmit(form,fd){
  if(!['report-action-form','report-image-form'].includes(form.id))return false;
  requirePermission('reports_view');const reason=String(fd.get('reason')||'').trim();if(reason.length<3||reason.length>500)fail('REASON');
  if(form.id==='report-action-form'){
   requirePermission('reports_manage');const action=String(fd.get('action'));if(['hide','needs_review'].includes(action))requirePermission('listings_manage');
   await store.actOnReport(form.dataset.id,action,reason,actor());
  }else{
   requirePermission('listings_view');requirePermission('listings_manage');if(!selectedImage||selectedImage.reportId!==form.dataset.id)fail('STATE');
   await store.removeListingImage(selectedImage.listingId,selectedImage.image,reason,...(c.preview?[actor()]:[]));selectedImage=null;
  }
  return true;
 }
 return {reports,handleClick:open,handleSubmit};
}
