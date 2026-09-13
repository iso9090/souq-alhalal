import {environmentAllowed} from './environment.js';

function showUnavailable() {
 const app=document.getElementById('app');
 app.replaceChildren();
 const main=document.createElement('main');
 main.id='main';main.className='wrap';main.setAttribute('aria-labelledby','maintenance-title');
 const title=document.createElement('h1');title.id='maintenance-title';title.textContent='مِلكك قيد الإعداد';
 const text=document.createElement('p');text.textContent='الخدمة غير متاحة حالياً لأن إعدادات التشغيل لم تكتمل. يرجى المحاولة لاحقاً.';
 main.append(title,text);app.append(main);
}

// A direct Pages publication is production by default. Never load demo modules
// until both the explicit runtime mode and current origin permit a preview.
try {
 const {default:config}=await import('./runtime-config.js');
 if(environmentAllowed(config,window.location)) await import('./app.js');
 else {
  if(config?.mode==='production') {
   const {prepareProduction}=await import('./production-bootstrap.js');
   // No production datastore factory is wired until its integration is reviewed.
   await prepareProduction({config});
  }
  showUnavailable();
 }
} catch {
 showUnavailable();
}
