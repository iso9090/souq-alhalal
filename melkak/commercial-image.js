import {prepareImageSelection} from '../image-provider.js';

export const MAX_COMMERCIAL_IMAGE_LENGTH=110000;
const prefix='data:image/jpeg;base64,';
const dataUrl=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reader.onabort=()=>reject(Error('IMAGE_READ_ERROR'));reader.readAsDataURL(blob);});

/** Local JPEG preparation only. prepareImageSelection validates and compresses the input. */
export async function commercialImageData(files,user) {
 if(!user?.uid)throw Error('AUTH_REQUIRED');
 const selected=Array.from(files||[]);
 if(!selected.length)throw Error('IMAGE_REQUIRED');
 if(selected.length!==1)throw Error('TOO_MANY_IMAGES');
 const [prepared]=await prepareImageSelection(selected);
 const bitmap=await createImageBitmap(prepared);
 try {
  const fit=Math.min(1,1400/bitmap.width,800/bitmap.height),canvas=document.createElement('canvas');
  for(const scale of [1,.85,.7,.6,.5]) {
   canvas.width=Math.max(1,Math.round(bitmap.width*fit*scale));
   canvas.height=Math.max(1,Math.round(bitmap.height*fit*scale));
   const context=canvas.getContext('2d');if(!context)throw Error('CANVAS_ERROR');
   context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   for(const quality of [.86,.76,.66,.56,.46,.36]) {
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
    if(!blob||prefix.length+4*Math.ceil(blob.size/3)>MAX_COMMERCIAL_IMAGE_LENGTH)continue;
    const result=await dataUrl(blob);
    if(typeof result==='string'&&result.length<=MAX_COMMERCIAL_IMAGE_LENGTH&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(result))return [result];
   }
  }
  throw Error('IMAGES_TOO_LARGE');
 }finally{bitmap.close();}
}
