import {environmentAllowed} from './environment.js';
function showUnavailable(reason='service_unavailable') {
 const app=document.getElementById('app');
 const main=document.createElement('main');main.id='main';main.className='wrap';
 const title=document.createElement('h1');title.textContent='تعذر تشغيل مِلكك';
 const text=document.createElement('p');text.textContent=reason==='configuration_incomplete'?'إعدادات التشغيل غير مكتملة. يرجى التواصل مع إدارة الموقع.':'تعذر الاتصال بالخدمة. تحقق من الاتصال ثم أعد تحميل الصفحة.';
 main.append(title,text);app.replaceChildren(main);
}
try {
 const {default:config}=await import('./runtime-config.js');
 if(environmentAllowed(config,window.location)) {
  const {startMarketplace}=await import('./app.js');await startMarketplace({config});
 } else if(config?.mode==='production') {
  const {prepareProduction}=await import('./production-bootstrap.js');
  const result=await prepareProduction({config});
  if(!result.ready)showUnavailable(result.reason);
  else {const {startMarketplace}=await import('./app.js');await startMarketplace({config,store:result.store,auth:result.auth});}
 } else showUnavailable('configuration_incomplete');
} catch {showUnavailable();}
