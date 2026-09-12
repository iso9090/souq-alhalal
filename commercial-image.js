import {compressImage} from './image-provider.js';
import {uploadCommercialImage,TRUSTED_BACKEND_ENABLED,trustedBackend} from './trusted-backend-client.js';
const uploadReady=()=>TRUSTED_BACKEND_ENABLED && !!trustedBackend.signingEndpoint;
import {safeUrl} from './commercial-model.js';

export function imageGuidance(placement){
 if(placement==='hero')return {width:1600,height:800,minWidth:800,minHeight:400};
 if(placement==='middle')return {width:1600,height:400,minWidth:800,minHeight:200};
 return {width:600,height:300,minWidth:300,minHeight:150};
}
export function validateAdImage(file,width,height,placement){
 if(!['image/jpeg','image/png','image/webp'].includes(file?.type))throw Error('اختر صورة JPG أو JPEG أو PNG أو WebP.');
 if(file.size>10*1024*1024)throw Error('الحد الأقصى لحجم الملف 10 MB.');
 if(!width||!height||width*height>20000000)throw Error('أبعاد الصورة غير صالحة أو تتجاوز 20 مليون بكسل.');
 const g=imageGuidance(placement);
 if(width<g.minWidth||height<g.minHeight)throw Error(`الحد الأدنى لهذا المكان ${g.minWidth} × ${g.minHeight} بكسل.`);
 if(Math.abs(width/height-g.width/g.height)/(g.width/g.height)>.2)throw Error(`اختر صورة بنسبة قريبة من ${g.width/g.height}:1 لهذا المكان (±20%).`);
}
export function createAdImagePicker({host,placement,user,existingUrl='',onChange,canUpload=()=>true}){
 const box=document.createElement('fieldset');box.className='commercial-image-picker';
 box.innerHTML='<legend>صورة الإعلان</legend><p class="image-guidance"></p><p>JPG / JPEG / PNG / WebP — حتى 10 MB. يمكنك سحب صورة وإفلاتها هنا.</p><input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" aria-label="اختر صورة من الجهاز"><img alt="معاينة صورة الإعلان" hidden><p class="image-info"></p><div class="image-actions"></div><p role="status" aria-live="polite"></p>';
 host.append(box);const input=box.querySelector('input'),preview=box.querySelector('img'),info=box.querySelector('.image-info'),note=box.querySelector('[role=status]'),actions=box.querySelector('.image-actions');
 let imageUrl=safeUrl(existingUrl,true),selected=null,dimensions=null,previewUrl='',busy=false,version=0,disposed=false;
 const state=()=>({imageUrl,busy});const changed=()=>onChange?.(state());
 const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;actions.append(b);return b;};
 const choose=button('اختر صورة من الجهاز',()=>input.click());
 const remove=button('إزالة',()=>{version++;selected=null;dimensions=null;imageUrl='';busy=false;input.value='';clearPreview();info.textContent='';note.textContent='تمت إزالة الصورة من النموذج.';refresh();});
 const upload=button('رفع الصورة',async()=>{
  if(!selected||busy||!canUpload())return;
  if(!uploadReady()){note.textContent='رفع الصور من الجهاز قيد التجهيز';return;}
  const operation=version;busy=true;note.textContent='جارٍ رفع الصورة…';refresh();
  try{const result=await uploadCommercialImage(selected,user(),placement());if(operation!==version||disposed)return;if(!canUpload())throw Error('تعذر التحقق من صلاحية الإدارة.');imageUrl=safeUrl(result,true);if(!imageUrl)throw Error('فشل التحقق من الصورة المرفوعة.');note.textContent='اكتمل رفع الصورة؛ يمكنك حفظ الإعلان.';}
  catch{if(operation===version&&!disposed){imageUrl='';note.textContent='فشل رفع الصورة. أعد المحاولة؛ لم يُحفظ الإعلان.';}}
  finally{if(operation===version&&!disposed){busy=false;refresh();}}
 });
 function clearPreview(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';preview.removeAttribute('src');preview.hidden=true;}
 function refresh(){choose.textContent=selected||imageUrl?'تغيير الصورة':'اختر صورة من الجهاز';remove.disabled=!selected&&!imageUrl&&!busy;upload.disabled=!selected||busy||!uploadReady();upload.hidden=!!imageUrl;changed();}
 function guide(){const g=imageGuidance(placement());box.querySelector('.image-guidance').textContent=`الموصى به: ${g.width} × ${g.height} بكسل — نسبة ${g.width/g.height}:1. الحد الأدنى: ${g.minWidth} × ${g.minHeight}.`;}
 async function select(file){
  const operation=++version;imageUrl='';selected=null;dimensions=null;busy=true;clearPreview();info.textContent='';note.textContent='جارٍ تجهيز المعاينة…';refresh();
  try{
   if(!['image/jpeg','image/png','image/webp'].includes(file?.type))throw Error('اختر صورة JPG أو JPEG أو PNG أو WebP.');
   if(file.size>10*1024*1024)throw Error('الحد الأقصى لحجم الملف 10 MB.');
   let bitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw Error('تعذر قراءة الصورة؛ اختر ملفًا صالحًا.');}
   const size={width:bitmap.width,height:bitmap.height};bitmap.close();validateAdImage(file,size.width,size.height,placement());
   const compressed=await compressImage(file);if(operation!==version||disposed)return;
   selected=file;dimensions=size;previewUrl=URL.createObjectURL(compressed);preview.src=previewUrl;preview.hidden=false;
   info.textContent=`${file.name} — ${(file.size/1024).toFixed(1)} KB — ${size.width} × ${size.height} بكسل. بعد الضغط: ${(compressed.size/1024).toFixed(1)} KB.`;
   note.textContent=uploadReady()?'المعاينة جاهزة. ارفع الصورة قبل حفظ الإعلان.':'رفع الصور من الجهاز قيد التجهيز';
  }catch(e){if(operation===version&&!disposed)note.textContent=e.message||'تعذر تجهيز الصورة.';}
  finally{if(operation===version&&!disposed){busy=false;refresh();}}
 }
 input.onchange=()=>{if(input.files[0])select(input.files[0]);input.value='';};
 box.ondragover=e=>{e.preventDefault();box.classList.add('drag-over');};box.ondragleave=()=>box.classList.remove('drag-over');box.ondrop=e=>{e.preventDefault();box.classList.remove('drag-over');if(e.dataTransfer.files.length!==1){note.textContent='اختر صورة واحدة فقط.';return;}select(e.dataTransfer.files[0]);};
 guide();if(imageUrl){preview.src=imageUrl;preview.hidden=false;info.textContent='الصورة الحالية محفوظة مسبقًا.';}refresh();
 return {getState:state,placementChanged(){guide();if(selected)select(selected);else{version++;busy=false;imageUrl='';note.textContent='اختر صورة مناسبة للمكان الجديد قبل الحفظ.';refresh();}},dispose(){disposed=true;version++;clearPreview();}};
}
