import {randomUUID,randomBytes} from 'node:crypto';
import {HttpError,strictObject,requestIdentity} from './security.js';
export function validateAssistant(body,now){
  strictObject(body,['displayName','email','loginMethod','requestTimestamp','nonce']);requestIdentity(body,now);
  if(typeof body.displayName!=='string'||!body.displayName.trim()||body.displayName.length>120||/[\u0000-\u001f]/.test(body.displayName)||typeof body.email!=='string'||body.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)||body.loginMethod!=='email_reset')throw new HttpError(400,'invalid-assistant');
}
export async function createAssistant(body,owner,{auth,stageAssistant,reauthorize}){
  // Never resolve an existing email into a target to modify or elevate.
  try{await auth.getUserByEmail(body.email.trim().toLowerCase());throw new HttpError(409,'account-already-exists');}
  catch(e){if(e.code!=='auth/user-not-found')throw e;}
  const uid=randomUUID();
  // A disabled account with an unpredictable password cannot log in. No password is returned.
  try{await auth.createUser({uid,email:body.email.trim().toLowerCase(),displayName:body.displayName.trim(),disabled:true,emailVerified:false,password:randomBytes(48).toString('base64url')});}
  catch(e){if(e.code==='auth/email-already-exists')throw new HttpError(409,'account-already-exists');throw e;}
  // On later failure leave only this newly created account DISABLED. Never delete/modify an existing owner.
  await reauthorize();
  await stageAssistant(uid,body,owner.uid);
  return {uid,status:'pending-invitation',loginMethod:'email_reset',activationRequired:true};
}
