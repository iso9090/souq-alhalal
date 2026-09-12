import {safeUrl} from './commercial-model.js';
export const MAX_COMMERCIAL_IMAGE_BYTES = 60 * 1024;
export const IMAGE_RECOMMENDATIONS = {hero:'1200 × 800 — نسبة 3:2',side:'600 × 300 — نسبة 2:1',middle:'1200 × 300 — نسبة 4:1',footer:'600 × 300 — نسبة 2:1'};
export function validImageData(d) {
 return !!d && d.mimeType === 'image/jpeg' && Number.isInteger(d.bytes) && d.bytes > 0 && d.bytes <= MAX_COMMERCIAL_IMAGE_BYTES && Number.isInteger(d.width) && d.width > 0 && d.width <= 1200 && Number.isInteger(d.height) && d.height > 0 && d.height <= 1200 && typeof d.imageData === 'string' && d.imageData.length <= 81943 && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(d.imageData) && Math.ceil(d.bytes / 3) * 4 + 23 === d.imageData.length;
}
export async function compressCommercialImage(file) {
 if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('اختر صورة JPG أو PNG أو WebP صالحة.');
 if (file.size > 12 * 1024 * 1024) throw Error('حجم الملف أكبر من 12 MiB. اختر صورة أصغر.');
 let bitmap;
 try { bitmap = await createImageBitmap(file, {imageOrientation:'from-image'}); } catch { throw Error('تعذر قراءة الصورة. اختر ملف صورة صالحًا.'); }
 try {
  if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 24000000) throw Error('أبعاد الصورة كبيرة جدًا؛ الحد 24 مليون بكسل.');
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  if (!ctx) throw Error('تعذر ضغط الصورة على هذا الجهاز.');
  const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  for (const scale of [1,.85,.7,.55,.4,.25]) {
   canvas.width = Math.max(1, Math.round(bitmap.width * ratio * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio * scale));
   ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   for (const quality of [.85,.72,.6,.48]) {
    const blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
    if (!blob || !blob.size || blob.size > MAX_COMMERCIAL_IMAGE_BYTES) continue;
    const imageData = await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('تعذر قراءة الصورة المضغوطة.'));r.readAsDataURL(blob);});
    const result={imageData,mimeType:'image/jpeg',bytes:blob.size,width:canvas.width,height:canvas.height};
    if (!validImageData(result)) throw Error('تعذر التحقق من الصورة المضغوطة.');
    return result;
   }
  }
  throw Error('تعذر ضغط الصورة إلى 60 KiB. اختر صورة أخرى.');
 } finally { bitmap.close(); }
}
// One document get per ad/version in this page session; no collection query or listener.
export function createCommercialImageLoader(api) {
 const cache=new Map();
 return async ad=>{
  const key=ad.id+':'+(ad.imageVersion||'legacy');
  if (!cache.has(key)) cache.set(key,(async()=>{
   try { const snap=await api.getDoc(api.doc(api.db,'commercialAdImages',ad.id)), data=snap.data(); if(validImageData(data))return data.imageData; }
   catch { /* Missing access/network: only the existing restricted legacy URL can be used. */ }
   return safeUrl(ad.imageUrl,true);
  })());
  return cache.get(key);
 };
}
export function mountCommercialImagePicker(host,{placement,initial,legacyUrl,onChange}) {
 let selected=initial||null,busy=false,sequence=0;
 const box=document.createElement('fieldset');box.className='commercial-image-picker';
 box.innerHTML='<legend>صورة الإعلان</legend><p class="image-recommendation"></p><button type="button" class="choose-image">اختيار صورة من الجهاز</button><input hidden type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" aria-label="اختيار صورة من الجهاز"><div class="commercial-image-preview" hidden><img alt="معاينة صورة الإعلان"><p class="image-info"></p></div><button type="button" class="change-image">تغيير الصورة</button><button type="button" class="remove-image">إزالة الصورة</button><p role="status" aria-live="polite"></p>';
 const input=box.querySelector('input'),preview=box.querySelector('.commercial-image-preview'),img=box.querySelector('img'),info=box.querySelector('.image-info'),status=box.querySelector('[role=status]');
 const update=()=>{box.querySelector('.image-recommendation').textContent='المقاس الموصى به: '+IMAGE_RECOMMENDATIONS[placement.value==='hero'?'hero':placement.value==='middle'?'middle':placement.value.startsWith('footer')?'footer':'side']+' · ضغط إلى JPEG بحد أقصى 60 KiB';};placement.addEventListener('change',update);update();
 const display=(name='الصورة الحالية')=>{const src=selected?.imageData||legacyUrl;preview.hidden=!src;if(src)img.src=src;else img.removeAttribute('src');info.textContent=selected?name+' · '+(selected.bytes/1024).toFixed(1)+' KiB · '+selected.width+' × '+selected.height:src?'الصورة الحالية المحفوظة':'';};display();
 input.onchange=async()=>{const seq=++sequence;busy=true;selected=null;legacyUrl='';display();status.textContent='جارٍ التحقق وضغط الصورة…';onChange();try{const file=input.files[0],result=await compressCommercialImage(file);if(seq!==sequence)return;selected=result;display(file.name);status.textContent='الصورة جاهزة للحفظ.';}catch(e){if(seq!==sequence)return;status.textContent=e.message;}finally{if(seq===sequence){busy=false;onChange();}}};
 box.querySelector('.choose-image').onclick=()=>input.click();box.querySelector('.change-image').onclick=()=>input.click();
 box.querySelector('.remove-image').onclick=()=>{sequence++;busy=false;selected=null;legacyUrl='';input.value='';display();status.textContent='اختر صورة قبل حفظ الإعلان.';onChange();};host.append(box);
 return {get data(){return selected;},get legacy(){return legacyUrl;},get ready(){return !busy&&!!(selected||legacyUrl);}};
}
