// Presentation only: native modal focus isolation, compact filters and lazy cards.
export function installVisualPolish({s,t,render,openDialog,countryOptions,cityOptions,categoryOptions}) {
  let observer, returnFocus;
  const dialog=document.querySelector('#dialog');
  document.querySelector('.skip').addEventListener('click',e=>{
    e.preventDefault();document.querySelector('#main').focus();
  });
  document.addEventListener('melkak-rendered',()=>{
    observer?.disconnect();
    observer=new IntersectionObserver(entries=>entries.forEach(({isIntersecting,target})=>{
      if(isIntersecting){target.src=target.dataset.cardSrc;delete target.dataset.cardSrc;observer.unobserve(target);}
    }),{rootMargin:'0px'});
    document.querySelectorAll('[data-card-src]').forEach(img=>observer.observe(img));
    document.querySelectorAll('.home-section .cards').forEach(row=>{
      row.tabIndex=0;row.setAttribute('role','region');row.setAttribute('aria-label',row.closest('section').querySelector('h2').textContent);
    });
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Tab'&&dialog.open&&dialog.matches('.navigation-drawer,.filter-drawer')){
      const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href],input,select,textarea')].filter(el=>el.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
    if(e.target.matches('.home-section .cards')&&['ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();e.target.scrollBy({left:(e.key==='ArrowRight'?1:-1)*e.target.clientWidth*.8,behavior:'instant'});
    }
  });
  dialog.addEventListener('close',()=>{dialog.classList.remove('navigation-drawer','filter-drawer');returnFocus?.focus();returnFocus=null;});
  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-action]');if(!el)return;
    if(el.dataset.action==='admin-drawer'){
      returnFocus=el;dialog.classList.add('navigation-drawer');
      openDialog(t('قائمة الإدارة','Admin menu'),document.querySelector('.admin-sidebar nav').outerHTML);
    }
    if(el.dataset.action==='filter-drawer'){
      returnFocus=el;dialog.classList.add('filter-drawer');
      openDialog(t('البحث والفلاتر','Search & filters'),`<form id="compact-filters"><label>${t('الدولة','Country')}<select name="country">${countryOptions(s.country)}</select></label><label>${t('المدينة','City')}<select name="city">${cityOptions(s.country,s.city)}</select></label><label>${t('القسم','Category')}<select name="category">${categoryOptions(s.category,true)}</select></label><label>${t('السعر من','Min price')}<input name="min" type="number" min="0"></label><label>${t('السعر إلى','Max price')}<input name="max" type="number" min="0"></label><label>${t('الترتيب','Sort')}<select name="sort"><option value="newest">${t('الأحدث','Newest')}</option><option value="oldest">${t('الأقدم','Oldest')}</option></select></label><button type="submit" class="primary">${t('تطبيق الفلاتر','Apply filters')}</button></form>`);
      const f=dialog.querySelector('form');f.elements.min.value=s.min;f.elements.max.value=s.max;f.elements.sort.value=s.sort;
    }
  });
  document.addEventListener('change',e=>{
    if(e.target.matches('#compact-filters [name=country]'))e.target.form.elements.city.innerHTML=cityOptions(e.target.value,'');
  });
  document.addEventListener('submit',e=>{
    if(e.target.id!=='compact-filters')return;e.preventDefault();
    const data=new FormData(e.target),search=document.querySelector('#search-form [name=search]').value;
    Object.assign(s,{country:String(data.get('country')),city:String(data.get('city')),category:String(data.get('category')),min:data.get('min'),max:data.get('max'),sort:String(data.get('sort')),search,page:1,attributes:{}});
    dialog.close();const hash='#/market'+(s.category?'/'+s.category:'');if(location.hash===hash)render();else location.hash=hash;
  });
}
