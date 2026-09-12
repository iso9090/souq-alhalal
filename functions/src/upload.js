import {randomUUID} from 'node:crypto';
import {HttpError,strictObject,requestIdentity} from './security.js';
export const FOLDER='souq-alhalal/commercial-ads';
export const TRANSFORMATION='c_limit,w_1600,h_1600';
export const SIGNED_PRESET='commercial_ads_signed_v1';
const placements=['hero','hero_side_1','hero_side_2','hero_side_3','middle','footer_1','footer_2','footer_3','footer_4','footer_5'];
const mimeFormats={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
export function validateUpload(body,now){
  strictObject(body,['purpose','bytes','contentType','width','height','placement','requestTimestamp','nonce']);
  requestIdentity(body,now);
  const {width,height}=body;
  const hero=body.placement==='hero',middle=body.placement==='middle';
  const minWidth=hero||middle?800:300,minHeight=hero?400:middle?200:150,ratio=middle?4:2;
  if(body.purpose!=='commercial_ad'||(typeof body.contentType!=='string'||!Object.hasOwn(mimeFormats,body.contentType))||!Number.isInteger(body.bytes)||body.bytes<1||body.bytes>307200||!placements.includes(body.placement)||!Number.isInteger(width)||!Number.isInteger(height)||width<minWidth||height<minHeight||width>1600||height>1600||Math.abs(width/height-ratio)/ratio>.2)throw new HttpError(400,'invalid-image');
}
export function signingParams(now){
  return Object.freeze({timestamp:now,folder:FOLDER,public_id:randomUUID(),overwrite:false,upload_preset:SIGNED_PRESET,transformation:TRANSFORMATION,allowed_formats:'jpg,jpeg,png,webp'});
}
export function createSigner(cloudinary,config){
  // Explicit config argument: never use mutable global Cloudinary configuration.
  return async params=>{
    if(!/^[a-zA-Z0-9_-]+$/.test(config.cloudName||'')||!config.apiKey||!config.apiSecret)throw new HttpError(503,'signer-not-configured');
    return {cloudName:config.cloudName,apiKey:config.apiKey,signature:cloudinary.utils.api_sign_request(params,config.apiSecret,'sha256')};
  };
}
