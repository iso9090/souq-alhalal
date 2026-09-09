import {compressImage,MAX_IMAGES} from './image-provider.js';
const input=document.getElementById('animalImages'),preview=document.getElementById('imagePreview');
let selected=[],urls=[],busy=false;
const counter=document.createElement('p');counter.id='imageCounter';counter.dir='ltr';counter.setAttribute('aria-live','polite');preview.before(counter);
const sync=()=>{const data=new DataTransfer();selected.forEach(file=>data.items.add(file));input.files=data.files;};
const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;};
function render(){
  urls.forEach(URL.revokeObjectURL);urls=[];preview.replaceChildren();counter.textContent=selected.length+'/3';
  selected.forEach((file,index)=>{
    const card=document.createElement('article'),img=document.createElement('img');card.className='v2-image-preview';
    img.src=URL.createObjectURL(file);urls.push(img.src);img.alt='الصورة '+(index+1);
    const title=document.createElement('b');title.textContent=index===0?'الصورة الرئيسية':'الصورة '+(index+1);
    card.append(img,title,button('حذف',()=>{selected.splice(index,1);sync();render();}),button('استبدال',()=>{
      const picker=document.createElement('input');picker.type='file';picker.accept='image/jpeg,image/png,image/webp';picker.onchange=()=>acceptFiles([...picker.files],index);picker.click();
    }));
    if(index>0)card.append(button('اجعلها الرئيسية',()=>{selected.unshift(selected.splice(index,1)[0]);sync();render();}),button('تقديم',()=>{[selected[index-1],selected[index]]=[selected[index],selected[index-1]];sync();render();}));
    if(index<selected.length-1)card.append(button('تأخير',()=>{[selected[index+1],selected[index]]=[selected[index],selected[index+1]];sync();render();}));
    preview.append(card);
  });
}
async function acceptFiles(files,replaceIndex){
  if(busy){sync();return;}
  const replacing=Number.isInteger(replaceIndex);
  if((replacing?selected.length:selected.length+files.length)>MAX_IMAGES){alert('الحد الأقصى 3 صور. احذف صورة أو استبدلها.');sync();return;}
  busy=true;input.disabled=true;
  try{
    const validated=[];
    for(const file of files){const blob=await compressImage(file);validated.push(new File([blob],file.name,{type:blob.type,lastModified:file.lastModified}));}
    if(replacing&&validated.length)selected[replaceIndex]=validated[0];else selected.push(...validated);
    sync();render();
  }catch{alert('تعذر فتح الصورة. اختر صورة JPEG أو PNG أو WebP صالحة.');sync();}
  finally{busy=false;input.disabled=false;}
}
input.accept='image/jpeg,image/png,image/webp';
input.addEventListener('change',()=>acceptFiles([...input.files]));
window.resetImagePreview=()=>{selected=[];sync();render();};
render();
