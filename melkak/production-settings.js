export const SETTINGS_COUNTRIES=Object.freeze(['AE','SA','EG','OM','JO','MA']);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const exact=(data,keys)=>{if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==keys.length||Object.keys(data).some(k=>!keys.includes(k)))fail('FIELDS');};
const text=(value,max,min=0)=>{if(typeof value!=='string'||value.trim().length<min||value.length>max)fail('FIELDS');return value.trim();};
const reasonText=value=>{if(typeof value!=='string'||value.trim().length<3||value.length>500)fail('REASON');return value.trim();};

export function attachProductionSettings(store,{sdk,db,auth,config={}}={}){
 const actor=()=>{if(config.writesEnabled!==true)fail('WRITES_DISABLED');const a=auth?.state?.actor;if(!a?.uid)fail('AUTH');if(a.status!=='active')fail('ACCOUNT');if(a.role!=='super_admin'||a.ready!==true)fail('PERMISSION');return a;};
 async function save(collection,id,data,reason,action,a){
  reason=reasonText(reason);const target=sdk.doc(db,collection,id);
  await sdk.runTransaction(db,async tx=>{await tx.get(target);if(auth?.state?.actor?.uid!==a.uid||auth.state.actor.status!=='active'||auth.state.actor.role!=='super_admin'||auth.state.actor.ready!==true)fail('PERMISSION');const log=sdk.doc(sdk.collection(db,'marketplaceAuditLogs'));
   tx.set(target,{...data,auditId:log.id,updatedAt:sdk.serverTimestamp()});
   tx.set(log,{actorUid:a.uid,action,targetCollection:collection,targetId:id,reason,timestamp:sdk.serverTimestamp(),result:'updated'});
  });await store.refresh?.();
 }
 store.configureSettings=async(data,reason)=>{const a=actor();exact(data,['enabledCountries','supportText']);const values=data.enabledCountries;if(!Array.isArray(values)||!values.length||values.some(c=>!SETTINGS_COUNTRIES.includes(c))||new Set(values).size!==values.length)fail('FIELDS');return save('marketplaceSettings','public',{enabledCountries:[...values],supportText:text(data.supportText,500)},reason,'settings-update',a);};
 store.configureCity=async(id,data,reason)=>{const a=actor();if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(id))fail('FIELDS');exact(data,['country','region','name','enabled']);if(!SETTINGS_COUNTRIES.includes(data.country)||typeof data.enabled!=='boolean')fail('FIELDS');return save('marketplaceCities',id,{country:data.country,region:text(data.region,100,1),name:text(data.name,100,1),enabled:data.enabled},reason,'city-update',a);};
 return store;
}

export function createSettingsView({store,actor,t,esc}){
 const names={AE:['الإمارات','United Arab Emirates'],SA:['السعودية','Saudi Arabia'],EG:['مصر','Egypt'],OM:['عُمان','Oman'],JO:['الأردن','Jordan'],MA:['المغرب','Morocco']};
 const reason=()=>`<label>${t('سبب التغيير','Reason for change')}<textarea name="reason" required minlength="3" maxlength="500"></textarea></label>`;
 function render(cityId=''){
  const a=actor()||{};if(a.role!=='super_admin')return `<p class="notice">${t('إعدادات المالك فقط','Owner settings only')}</p>`;
  const settings=store.state.settings||{},cities=store.state.cities||[],city=cities.find(c=>(c.id||c.sourceId)===cityId)||{};
  const enabled=settings.enabledCountries||SETTINGS_COUNTRIES,disabled=a.status!=='active'||a.ready!==true?'disabled':'';
  return `<div class="panel"><h2>${t('إعدادات السوق','Marketplace settings')}</h2><form id="marketplace-settings-form"><fieldset ${disabled}><legend>${t('الدول المتاحة','Enabled countries')}</legend>${SETTINGS_COUNTRIES.map(code=>`<label><input type="checkbox" name="enabledCountries" value="${code}" ${enabled.includes(code)?'checked':''}>${esc(t(...names[code]))}</label>`).join('')}<label>${t('نص الدعم','Support text')}<textarea name="supportText" maxlength="500">${esc(settings.supportText||'')}</textarea></label>${reason()}<button type="submit" class="primary">${t('حفظ الإعدادات','Save settings')}</button></fieldset></form></div>
  <div class="panel"><h2>${t('المدن','Cities')}</h2><p>${t('استخدم المعرف نفسه لتحديث مدينة موجودة. تبقى العملات ومفاتيح الاتصال ثابتة.','Use the same ID to update an existing city. Currency and dialing codes remain fixed.')}</p><ul>${cities.map(c=>`<li><code dir="ltr">${esc(c.id||c.sourceId)}</code> · ${esc(c.country)} · ${esc(c.region)} · ${esc(c.name)} · ${c.enabled?t('مفعلة','Enabled'):t('معطلة','Disabled')}</li>`).join('')}</ul>
  <form id="marketplace-city-form"><fieldset ${disabled}><legend>${t('إضافة مدينة أو تحديثها','Add or update city')}</legend><label>${t('معرف المدينة','City ID')}<input name="id" required maxlength="100" pattern="[A-Za-z0-9_-]+" value="${esc(cityId)}" dir="ltr"></label><label>${t('الدولة','Country')}<select name="country" required>${SETTINGS_COUNTRIES.map(code=>`<option value="${code}" ${city.country===code?'selected':''}>${esc(t(...names[code]))}</option>`).join('')}</select></label><label>${t('المنطقة','Region')}<input name="region" required maxlength="100" value="${esc(city.region||'')}"></label><label>${t('اسم المدينة','City name')}<input name="name" required maxlength="100" value="${esc(city.name||'')}"></label><label><input type="checkbox" name="enabled" ${city.enabled!==false?'checked':''}>${t('مفعلة','Enabled')}</label>${reason()}<button type="submit" class="primary">${t('حفظ المدينة','Save city')}</button></fieldset></form></div>`;
 }
 return {render};
}
