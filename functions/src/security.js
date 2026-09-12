export class HttpError extends Error {
  constructor(status,code){super(code);this.status=status;this.code=code;}
}
export const deny=()=>{throw new HttpError(403,'permission-denied');};
export async function requireSuperAdmin(authorization,{auth,readAccess}){
  try{
    if(!/^Bearer [^\s]+$/.test(authorization||''))return deny();
    const token=await auth.verifyIdToken(authorization.slice(7),true);
    const user=await auth.getUser(token.uid);
    const {registry,access,profile}=await readAccess(token.uid);
    if(user.uid!==token.uid||user.disabled||token.admin!==true||user.customClaims?.admin!==true||registry?.enabled!==true||!Array.isArray(registry.superAdminUids)||!registry.superAdminUids.includes(token.uid)||access?.role!=='super_admin'||profile?.status!=='active')return deny();
    return {uid:token.uid};
  }catch{return deny();}
}
export function strictObject(body,keys){
  if(!body||Array.isArray(body)||Object.getPrototypeOf(body)!==Object.prototype||Buffer.byteLength(JSON.stringify(body))>4096||Object.keys(body).some(k=>!keys.includes(k)))throw new HttpError(400,'invalid-argument');
}
export function requestIdentity(body,now){
  if(!Number.isInteger(body.requestTimestamp)||Math.abs(now-body.requestTimestamp)>60||!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(body.nonce||''))throw new HttpError(400,'invalid-request-time-or-nonce');
}
export const AUDIT_EVENTS=new Set(['cloudinary_sign_requested','assistant_created','payment_session_created','payment_webhook_processed']);
export function auditRecord(event,{uid,operationId},now){
  if(!AUDIT_EVENTS.has(event)||typeof uid!=='string'||typeof operationId!=='string')throw new HttpError(400,'invalid-audit');
  return {event,actorUid:uid,operationId,at:now};
}
