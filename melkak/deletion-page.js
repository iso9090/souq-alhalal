import {deletionContent,requestAccountDeletion} from './account-deletion.js';
import config from './runtime-config.js';
const main=document.getElementById('deletion-app');
let english=new URLSearchParams(location.search).get('lang')==='en',sdk,auth,db,busy=false;
const t=(ar,en)=>english?en:ar;
function render(){document.documentElement.lang=english?'en':'ar';document.documentElement.dir=english?'ltr':'rtl';main.innerHTML=deletionContent(t,!!auth?.state?.user);}
render();
document.getElementById('language').addEventListener('click',()=>{english=!english;render();});
async function connect(){if(auth)return; if(config.mode!=='production')throw Error('PRODUCTION_ONLY');const module=await import('./auth-adapter.js');sdk=await module.loadFirebaseSdk();auth=await module.createFirebaseAuthAdapter({sdk,config:{writesEnabled:false}});db=sdk.getFirestore(sdk.getApp());auth.subscribe(()=>{if(!busy)render();});}
document.addEventListener('click',async event=>{const button=event.target.closest('[data-action]');if(!button||busy)return;
 if(button.dataset.action==='request-account-deletion'&&!document.getElementById('deletion-confirm')?.checked){document.getElementById('deletion-status').textContent=t('يرجى تأكيد طلب الحذف أولًا.','Please confirm the request first.');return;}
 busy=true;button.disabled=true;
 try{await connect();if(button.dataset.action==='logout'){await auth.signOut();busy=false;render();return;}if(button.dataset.action==='google-login'){await auth.signInGoogle();busy=false;render();return;}
  if(button.dataset.action==='request-account-deletion'){await requestAccountDeletion({sdk,db,auth,config});document.getElementById('deletion-status').textContent=t('تم تسجيل الطلب. الحذف لم يكتمل بعد؛ تعالجه الإدارة بعد التحقق.','Request recorded. Deletion is not complete yet; administration processes it after verification.');}
 }catch(error){document.getElementById('deletion-status').textContent=error.code==='RECENT_AUTH_REQUIRED'?t('الجلسة قديمة. سجّل الخروج ثم أعد التحقق من الحساب.','Your session is old. Sign out, then verify your account again.'):t('تعذر التحقق أو تسجيل الطلب. لم يتم حذف أي بيانات. حاول مجددًا أو استخدم قناة المساعدة.','Verification or submission failed. No data was deleted. Retry or contact support.');button.disabled=false;
 }finally{busy=false;}
});
// No SDK/network initialization until the user explicitly requests verification.
