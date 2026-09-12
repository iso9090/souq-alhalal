import {uploadImage,safeImage} from './image-provider.js';
export async function openHomePageAdmin(api){
  if(!await api.isAllowed())return;
  const {db,auth,doc,getDoc,getDocs,collection,setDoc,serverTimestamp,Timestamp,showModal,escapeHtml:esc}=api;
  const uid=auth.currentUser.uid;
  let settings={},animals=[];
  try{
    const [home,list]=await Promise.all([getDoc(doc(db,'homePage','config')),getDocs(collection(db,'animals'))]);
    settings=home.exists()?home.data():{};animals=list.docs.map(item=>({...item.data(),id:item.id}));
  }catch{alert('تعذر تحميل إعدادات الواجهة. حاول مجددًا.');return;}
  if(auth.currentUser?.uid!==uid||!await api.isAllowed())return;
  const localDate=value=>{const date=value?.toDate?value.toDate():new Date(value);return Number.isNaN(date.getTime())?'':new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);};
  showModal(`<section class="v2-home-admin"><button onclick="openAdminPanel()">الرجوع إلى لوحة الإدارة</button><h2>إدارة واجهة الصفحة الرئيسية</h2>
    <article><label for="heroMode">وضع الواجهة</label><select id="heroMode"><option value="static">صورة ثابتة</option><option value="featured">إعلانات مميزة — ثم الصورة الثابتة عند عدم توفرها</option></select>
    <label for="heroUpload">اختيار صورة من الجهاز</label><input id="heroUpload" type="file" accept="image/jpeg,image/png,image/webp"><button id="heroUploadButton">رفع الصورة المختارة</button><img id="heroImagePreview" alt="معاينة صورة الواجهة" src="${safeImage(settings.imageUrl)||'hero-livestock.png'}"><p id="heroUploadStatus" role="status"></p></article>
    <h3>إعلانات مميزة — حتى 3 إعلانات</h3>
    ${[0,1,2].map(i=>{const item=settings.featured?.[i]||{};return `<article class="v2-featured-row" data-slot="${i}"><div><label for="featuredAnimal${i}">الإعلان ${i+1}</label><select id="featuredAnimal${i}"><option value="">بدون إعلان</option>${animals.map(animal=>`<option value="${esc(animal.id)}" ${item.animalId===animal.id?'selected':''}>${esc(animal.name||animal.type||'حلال')} — ${esc(animal.location||'')} (${esc(animal.status||'active')})</option>`).join('')}</select></div>
    <div><label for="featuredActive${i}">حالة الظهور</label><select id="featuredActive${i}"><option value="false">معطل</option><option value="true" ${item.active===true?'selected':''}>نشط</option></select></div>
    <div><label for="featuredPriority${i}">الأولوية (الأقل أولًا)</label><input id="featuredPriority${i}" type="number" min="0" max="99" value="${Number.isInteger(item.priority)?item.priority:i}"></div>
    <div><label for="featuredStart${i}">البداية — توقيت جهازك</label><input id="featuredStart${i}" type="datetime-local" value="${localDate(item.startAt)}"></div>
    <div><label for="featuredEnd${i}">النهاية — توقيت جهازك</label><input id="featuredEnd${i}" type="datetime-local" value="${localDate(item.endAt)}"></div>
    <button type="button" data-preview="${i}">معاينة الإعلان</button></article>`;}).join('')}
    <p id="heroSaveStatus" role="status"></p><button id="heroSaveButton">حفظ الواجهة</button></section>`);
  document.getElementById('heroMode').value=settings.mode==='featured'?'featured':'static';
  const status=document.getElementById('heroSaveStatus');
  const image=document.getElementById('heroImagePreview'),input=document.getElementById('heroUpload');
  let url=safeImage(settings.imageUrl)||'',previewUrl='',uploadBusy=false;
  input.onchange=()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=input.files[0]?URL.createObjectURL(input.files[0]):'';image.src=previewUrl||url||'hero-livestock.png';};
  image.onerror=()=>{document.getElementById('heroUploadStatus').textContent='تعذر فتح الصورة المختارة.';};
  document.getElementById('heroUploadButton').onclick=async()=>{
    if(uploadBusy)return;
    const note=document.getElementById('heroUploadStatus');
    if(!input.files[0]){note.textContent='اختر صورة أولًا.';return;}
    if(auth.currentUser?.uid!==uid||!await api.isAllowed()){note.textContent='غير مصرح.';return;}
    uploadBusy=true;input.disabled=true;note.textContent='جاري رفع الصورة…';
    try{url=await uploadImage(input.files[0],auth.currentUser,'hero');image.src=url;input.value='';note.textContent='تم الرفع. احفظ الواجهة لتطبيق الصورة.';}
    catch(error){note.textContent=error.message==='IMAGE_PROVIDER_NOT_CONFIGURED'?'رفع الصور غير متاح حاليًا؛ يلزم تجهيز مزود الصور.':'تعذر رفع الصورة. تحقق من الملف والاتصال ثم حاول مجددًا.';}
    finally{uploadBusy=false;input.disabled=false;}
  };
  document.querySelectorAll('[data-preview]').forEach(button=>button.onclick=()=>{
    const selected=animals.find(a=>a.id===document.getElementById('featuredAnimal'+button.dataset.preview).value);
    if(!selected){status.textContent='اختر إعلانًا لمعاينته.';return;}
    let area=button.parentElement.querySelector('.v2-slot-preview');
    if(!area){area=document.createElement('div');area.className='v2-slot-preview';button.after(area);}
    const photo=safeImage(selected.images?.[0]);area.innerHTML=(photo?`<img src="${photo}" alt="معاينة الإعلان">`:'')+`<p>${esc(selected.name||selected.type)} — ${esc(selected.location||'')}</p>`;
  });
  let saving=false;
  document.getElementById('heroSaveButton').onclick=async()=>{
    if(saving||uploadBusy)return;
    if(input.files.length){status.textContent='ارفع الصورة المختارة قبل الحفظ.';return;}
    const featured=[];
    for(let i=0;i<3;i++){
      const id=document.getElementById('featuredAnimal'+i).value;if(!id)continue;
      const start=new Date(document.getElementById('featuredStart'+i).value).getTime(),end=new Date(document.getElementById('featuredEnd'+i).value).getTime();
      const priority=Number(document.getElementById('featuredPriority'+i).value),active=document.getElementById('featuredActive'+i).value==='true';
      if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||!Number.isInteger(priority)||priority<0||priority>99||featured.some(item=>item.animalId===id)){status.textContent='حدد مواعيد صحيحة وأولوية من 0 إلى 99، واختر إعلانات مختلفة.';return;}
      const animal=animals.find(a=>a.id===id);
      if(active&&(!animal||!safeImage(animal.images?.[0])||animal.status&&animal.status!=='active')){status.textContent='اختر إعلانًا نشطًا يحتوي على صورة سليمة.';return;}
      featured.push({animalId:id,active,priority,startAt:Timestamp.fromMillis(start),endAt:Timestamp.fromMillis(end)});
    }
    saving=true;status.textContent='جاري حفظ الواجهة…';
    try{
      if(auth.currentUser?.uid!==uid||!await api.isAllowed())throw Error('denied');
      await setDoc(doc(db,'homePage','config'),{mode:document.getElementById('heroMode').value,imageUrl:url,featured,updatedBy:uid,updatedAt:serverTimestamp()});
      status.textContent='تم حفظ الواجهة.';void api.refresh();
    }catch{status.textContent='تعذر الحفظ. تحقق من صلاحيات الإدارة والاتصال ثم حاول مجددًا.';}
    finally{saving=false;}
  };
}
