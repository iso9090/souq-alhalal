// Public configuration only. Configure an authenticated signing service before release.
export const imageProvider = Object.freeze({ signingEndpoint: '' });
export const MAX_IMAGES = 3;
export function validateImageCount(files) {
  if (!files?.length) throw Error('IMAGE_REQUIRED');
  if (files.length > MAX_IMAGES) throw Error('TOO_MANY_IMAGES');
}
export function safeImage(value) {
  if (typeof value !== 'string') return '';
  if (/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value;
  // Never interpolate arbitrary URLs into HTML. Preserve the existing JPEG records.
  return /^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\/[a-zA-Z0-9_./,-]+$/.test(value) ? value : '';
}
export async function compressImage(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('INVALID_IMAGE');
  if (file.size > 30 * 1024 * 1024) throw Error('IMAGE_TOO_LARGE');
  let bitmap;
  try { bitmap = await createImageBitmap(file, {imageOrientation:'from-image'}); }
  catch { throw Error('IMAGE_LOAD_ERROR'); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 80000000) throw Error('IMAGE_TOO_LARGE');
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('CANVAS_ERROR');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    for (const quality of [.86,.76,.66,.56,.46]) {
      const blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
      if (blob && blob.size <= 300 * 1024) return blob;
    }
    // Exceptionally noisy images need a second reduction, preserving the ratio.
    const small = document.createElement('canvas');
    small.width = Math.max(1,Math.round(canvas.width * .65)); small.height = Math.max(1,Math.round(canvas.height * .65));
    small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);
    const blob = await new Promise(resolve=>small.toBlob(resolve,'image/jpeg',.7));
    if (!blob || blob.size > 300 * 1024) throw Error('IMAGES_TOO_LARGE');
    return blob;
  } finally { bitmap.close(); }
}
export async function uploadImage(file, user, purpose='listing', config=imageProvider) {
  if (!user) throw Error('AUTH_REQUIRED');
  if (!config.signingEndpoint) throw Error('IMAGE_PROVIDER_NOT_CONFIGURED');
  const endpoint = new URL(config.signingEndpoint, location.href);
  if (endpoint.protocol !== 'https:' && !['127.0.0.1','localhost'].includes(endpoint.hostname)) throw Error('INVALID_PROVIDER');
  const blob = await compressImage(file);
  const token = await user.getIdToken();
  const signed = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({purpose,bytes:blob.size,contentType:blob.type}),signal:AbortSignal.timeout(20000)});
  if (!signed.ok) throw Error('UPLOAD_DENIED');
  const data = await signed.json();
  if (!/^[a-zA-Z0-9_-]+$/.test(data.cloudName) || !data.signature || !data.apiKey || !data.params?.timestamp || !data.params?.public_id) throw Error('INVALID_PROVIDER');
  const body = new FormData(); body.append('file',blob,'image.jpg');
  // The server signs only these exact parameters; secrets never enter this client.
  for (const key of ['timestamp','public_id','upload_preset','folder','overwrite']) if (data.params[key] != null) body.append(key,String(data.params[key]));
  body.append('signature',data.signature); body.append('api_key',data.apiKey);
  const result = await fetch('https://api.cloudinary.com/v1_1/'+data.cloudName+'/image/upload',{method:'POST',body,signal:AbortSignal.timeout(60000)});
  if (!result.ok) throw Error('UPLOAD_FAILED');
  const uploaded = await result.json();
  const url = safeImage(uploaded.secure_url);
  if (!url || !url.startsWith('https://res.cloudinary.com/'+data.cloudName+'/image/upload/')) throw Error('INVALID_PROVIDER');
  return url;
}
export async function uploadImages(files,user,purpose='listing') {
  validateImageCount(files);
  const result=[];
  for(const file of files) result.push(await uploadImage(file,user,purpose));
  return result;
}
