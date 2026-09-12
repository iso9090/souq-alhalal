import {compressImage} from './image-provider.js';
export const TRUSTED_BACKEND_ENABLED = false;
export const trustedBackend = Object.freeze({signingEndpoint:''});
const FOLDER='souq-alhalal/commercial-ads';
export async function uploadCommercialImage(file,user,placement,{enabled=TRUSTED_BACKEND_ENABLED,endpoint=trustedBackend.signingEndpoint}={}){
 if(!enabled||!endpoint)throw Error('BACKEND_DISABLED');
 const service=new URL(endpoint,location.href);
 if(service.protocol!=='https:'&&!(['localhost','127.0.0.1'].includes(service.hostname)&&service.protocol==='http:'))throw Error('INVALID_ENDPOINT');
 if(!user)throw Error('AUTH_REQUIRED');
 const blob=await compressImage(file),bitmap=await createImageBitmap(blob);const {width,height}=bitmap;bitmap.close();
 const request={purpose:'commercial_ad',bytes:blob.size,contentType:blob.type,width,height,placement,requestTimestamp:Math.floor(Date.now()/1000),nonce:crypto.randomUUID()};
 const signedResponse=await fetch(service,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify(request),signal:AbortSignal.timeout(20000)});
 if(!signedResponse.ok)throw Error('UPLOAD_DENIED');
 const signed=await signedResponse.json(),p=signed.params,now=Math.floor(Date.now()/1000);
 const allowed=['timestamp','folder','public_id','overwrite','upload_preset','transformation','allowed_formats'];
 if(!/^[a-zA-Z0-9_-]+$/.test(signed.cloudName||'')||typeof signed.apiKey!=='string'||!signed.apiKey||typeof signed.signature!=='string'||!signed.signature||signed.resourceType!=='image'||!p||Object.keys(p).length!==allowed.length||Object.keys(p).some(k=>!allowed.includes(k))||p.folder!==FOLDER||p.overwrite!==false||p.upload_preset!=='commercial_ads_signed_v1'||p.transformation!=='c_limit,w_1600,h_1600'||p.allowed_formats!=='jpg,jpeg,png,webp'||!Number.isInteger(p.timestamp)||Math.abs(now-p.timestamp)>60||!/^[a-f\d-]{36}$/i.test(p.public_id||'')||signed.expiresAt!==p.timestamp+3600)throw Error('INVALID_AUTHORIZATION');
 const body=new FormData();body.append('file',blob,'commercial.jpg');for(const key of allowed)body.append(key,String(p[key]));body.append('api_key',signed.apiKey);body.append('signature',signed.signature);
 const response=await fetch('https://api.cloudinary.com/v1_1/'+signed.cloudName+'/image/upload',{method:'POST',body,signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('UPLOAD_FAILED');
 const result=await response.json();
 const publicId=FOLDER+'/'+p.public_id,prefix='https://res.cloudinary.com/'+signed.cloudName+'/image/upload/';
 if(result.resource_type!=='image'||result.public_id!==publicId||!['jpg','jpeg','png','webp'].includes(result.format)||!Number.isInteger(result.bytes)||result.bytes<1||result.bytes>307200||result.width!==width||result.height!==height||typeof result.secure_url!=='string'||!result.secure_url.startsWith(prefix))throw Error('INVALID_UPLOAD_RESULT');
 const path=result.secure_url.slice(prefix.length);if(!new RegExp('^(v[0-9]+/)?'+publicId.replaceAll('/','\\/')+'\\.'+result.format+'$').test(path))throw Error('INVALID_UPLOAD_URL');
 return result.secure_url;
}
