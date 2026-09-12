import {safeImage} from './image-provider.js';
export const CATEGORIES = [['all','الكل','All','▦'],['ناقة','جمال','Camels','🐪'],['غنم','أغنام','Sheep','🐑'],['ماعز','ماعز','Goats','🐐'],['بقر','أبقار','Cattle','🐄'],['دجاج','دجاج / دواجن','Poultry','🐔'],['صقور','صقور','Falcons','🦅'],['غزال','غزال','Deer','🦌'],['نعام','نعام','Ostriches','🐦'],['حمام','حمام','Pigeons','🕊'],['حيوانات أليفة','حيوانات أليفة','Pets','🐾'],['أخرى','أخرى','Other','⋯']];
export const PETS=['قطط','كلاب','طيور زينة','أرانب','أسماك','أخرى'];
export const text=(ar,en)=>document.documentElement.lang==='en'?en:ar;
// Decorative category silhouettes, never listing imagery or verification marks.
export function categoryIcon(value){
  const paths={
    all:'M4 4h9v9H4zm15 0h9v9h-9zM4 19h9v9H4zm15 0h9v9h-9z',
    'ناقة':'M2 17l3-4 5 1 3-8 4 1 3 8 3-1 1-10 4-2 3 3-1 3-4 1-1 12-3 1-1 8h-3l-1-8H9l-2 8H4l1-12Z',
    'غنم':'M4 10q-2-5 4-5 3-5 7-1 6-3 7 3l7 1 2 4-3 5h-5l-2 6-1 7h-3l-1-7H9l-1 7H5l-1-9q-6-3-2-8Z',
    'ماعز':'M3 14l3-2 10 1 4-5-1-5 3 4 3-5v5l6 3-2 4-5-1-3 9-1 8h-3l-1-8H9l-2 8H4l1-10-3-4Z',
    'بقر':'M2 10l18 1 2-5-1-3 4 3 4-3-1 4 3 3-1 6-5 1-2 6-1 7h-3l-1-7H9l-1 7H5l-1-9-1-8-2 7H0Z',
    'أخرى':'M4 13a3 3 0 1 1 0 6 3 3 0 0 1 0-6m12 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6m12 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6'
  };
  return `<svg class="v3-category-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="${paths[value]||paths['أخرى']}"/></svg>`;
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function gallery(images=[],alt='صورة الحيوان',options={}) {
  const valid=(Array.isArray(images)?images:[]).map(safeImage).filter(Boolean);
  if(!valid.length)return '<div class="v2-no-photo">▧<span>'+text('لا توجد صورة','No photo available')+'</span></div>';
  const thumbs=options.thumbnails===true&&valid.length>1;
  return `<div class="v2-gallery${thumbs?' v2-gallery--thumbs':''}" role="region" aria-label="${esc(alt)}" data-index="0">
    <div class="v2-slides">${valid.map((src,i)=>`<img src="${src}" alt="${esc(alt)} ${i+1}" loading="lazy" ${i?'hidden':''} onerror="this.dataset.failed='true'"><span class="v2-image-error">${text('لا توجد صورة','Image unavailable')}</span>`).join('')}</div>
    ${valid.length>1?`<button type="button" class="v2-prev" data-slide="-1" aria-label="${text('الصورة السابقة','Previous image')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><button type="button" class="v2-next" data-slide="1" aria-label="${text('الصورة التالية','Next image')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button>${thumbs?`<div class="v2-thumbnails" role="group" aria-label="${text('صور الإعلان','Listing photos')}">${valid.slice(1).map((src,i)=>`<button type="button" data-dot="${i+1}" aria-label="${text('عرض الصورة','Show image')} ${i+2}" aria-pressed="false"><img src="${src}" alt="" loading="lazy"></button>`).join('')}</div>`:`<div class="v2-dots">${valid.map((_,i)=>`<button type="button" data-dot="${i}" aria-label="${text('الصورة','Image')} ${i+1}" aria-pressed="${i===0}"></button>`).join('')}</div>`}`:''}
    <span class="v2-photo-count" ${options.thumbnails?'data-gallery-counter aria-live="polite"':''} dir="ltr">${options.thumbnails?'1 / ':'▣ '}${valid.length}</span></div>`;
}
export const favoriteIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
export function showSlide(gallery,index) {
  const images=[...gallery.querySelectorAll('.v2-slides > img')];
  if(!images.length)return;
  index=(index+images.length)%images.length;
  gallery.dataset.index=String(index);
  images.forEach((img,i)=>img.hidden=i!==index);
  gallery.querySelectorAll('[data-dot]').forEach(dot=>dot.setAttribute('aria-pressed',String(Number(dot.dataset.dot)===index)));
  const counter=gallery.querySelector('[data-gallery-counter]');if(counter)counter.textContent=(index+1)+' / '+images.length;
}
export function activeFeatured(settings,animals,country,now=Date.now()) {
  const millis=v=>typeof v?.toMillis==='function'?v.toMillis():new Date(v).getTime();
  if(settings?.mode!=='featured')return [];
  return (Array.isArray(settings.featured)?settings.featured:[]).filter(slot=>slot.active===true && millis(slot.startAt)<=now && millis(slot.endAt)>now)
    .sort((a,b)=>a.priority-b.priority).map(slot=>({slot,animal:animals[slot.animalId]}))
    .filter(({animal})=>animal && (!animal.status || animal.status==='active') && (animal.country||'AE')===country && safeImage(animal.images?.[0])).slice(0,3);
}
export function installInteractions() {
  document.addEventListener('click',e=>{
    const control=e.target.closest('[data-slide],[data-dot]'); if(!control)return;
    const group=control.closest('.v2-gallery'); if(!group)return;
    e.preventDefault();e.stopPropagation();showSlide(group,control.hasAttribute('data-dot')?Number(control.dataset.dot):Number(group.dataset.index)+Number(control.dataset.slide));
  });
  let touch;
  document.addEventListener('touchstart',e=>{const group=e.target.closest('.v2-gallery');if(group&&e.touches.length===1)touch={group,x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
  document.addEventListener('touchend',e=>{if(!touch)return;const {group,x,y}=touch;touch=null;const p=e.changedTouches[0];if(p&&Math.abs(p.clientX-x)>45&&Math.abs(p.clientX-x)>Math.abs(p.clientY-y))showSlide(group,Number(group.dataset.index)+(p.clientX<x?1:-1));},{passive:true});
  document.addEventListener('keydown',e=>{const group=e.target.closest('.v2-gallery');if(group&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();showSlide(group,Number(group.dataset.index)+(e.key==='ArrowRight'?1:-1));}});
}
