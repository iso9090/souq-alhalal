export const REPORT_REASONS=Object.freeze([
  {id:'unsuitablecontent',ar:'محتوى غير مناسب',en:'Unsuitable content'},
  {id:'image',ar:'صورة مخالفة',en:'Inappropriate image'},
  {id:'fraud',ar:'احتيال أو اشتباه',en:'Fraud'},
  {id:'misleading',ar:'إعلان مضلل',en:'Misleading information'},
  {id:'prohibited',ar:'منتج أو خدمة ممنوعة',en:'Prohibited item'},
  {id:'spam',ar:'Spam / إعلان مكرر',en:'Spam'},
  {id:'suspiciouscontact',ar:'بيانات تواصل مشبوهة',en:'Suspicious contact'},
  {id:'other',ar:'سبب آخر',en:'Other'}
]);
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function serializeReportReason(category,detail=''){
  const value=String(detail??'').trim();
  if(!REPORT_REASONS.some(r=>r.id===category)||value.length>350)fail('REASON');
  return `[${category}]${value?' '+value:''}`;
}
export function reportReasonFields({t,esc}){
  return `<label>${t('سبب البلاغ','Report reason')}<select name="category" required><option value="">${t('اختر السبب','Select a reason')}</option>${REPORT_REASONS.map(r=>`<option value="${r.id}">${esc(t(r.ar,r.en))}</option>`).join('')}</select></label><label>${t('تفاصيل إضافية (اختياري)','Additional details (optional)')}<textarea name="detail" maxlength="350"></textarea></label>`;
}
export function validatePermanentRemoval(confirmation,id,reason){
  const value=String(reason??'').trim();if(value.length<3||value.length>500)fail('REASON');
  if(String(confirmation??'')!==String(id))fail('CONFIRMATION');return value;
}
export function permanentRemovalFields({t,esc,id}){
  return `<p class="notice">${t('إزالة نهائية من السوق. السجلات المرتبطة محفوظة بأرشفة مقفلة ولا يمكن إعادة النشر.','Permanent removal from the market. Linked history is retained in a locked archive and cannot be republished.')}</p><label>${t('لتأكيد الإزالة، اكتب معرّف الإعلان','To confirm removal, type the listing ID')}: <strong dir="ltr">${esc(id)}</strong><input name="confirmation" required autocomplete="off" spellcheck="false"></label>`;
}
