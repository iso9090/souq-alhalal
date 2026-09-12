import {randomUUID} from 'node:crypto';
import {HttpError,requireSuperAdmin,auditRecord} from './security.js';
import {validateUpload,signingParams} from './upload.js';
import {validateAssistant,createAssistant} from './assistants.js';
export const TRUSTED_BACKEND_ENABLED=false;
export const STRIPE_ENABLED=false;
export const PRODUCTION_ORIGIN='https://iso9090.github.io';
export function createHandler(deps,{enabled=TRUSTED_BACKEND_ENABLED,local=false,clock=()=>Math.floor(Date.now()/1000)}={}){
 const origins=new Set([PRODUCTION_ORIGIN,...(local?['http://localhost:8770','http://127.0.0.1:8770']:[])]);
 return async(req,res)=>{
  res.set('Cache-Control','no-store');res.set('Vary','Origin');
  // Stripe is not mounted: no parsing, provider calls or payment state writes.
  if(['/api/payments/create-checkout-session','/api/stripe/webhook'].includes(req.path))return res.status(503).json({code:'stripe-disabled'});
  if(!origins.has(req.get('origin')))return res.status(403).json({code:'origin-denied'});
  res.set('Access-Control-Allow-Origin',req.get('origin'));
  if(req.method==='OPTIONS'){
    if(req.get('access-control-request-method')!=='POST'||(req.get('access-control-request-headers')||'').split(',').map(h=>h.trim().toLowerCase()).filter(Boolean).some(h=>!['authorization','content-type'].includes(h)))return res.status(403).json({code:'preflight-denied'});
    res.set('Access-Control-Allow-Methods','POST');res.set('Access-Control-Allow-Headers','Authorization, Content-Type');return res.status(204).send('');
  }
  if(!enabled)return res.status(503).json({code:'backend-disabled'});
  if(req.method!=='POST')return res.status(405).json({code:'method-not-allowed'});
  if(!['/api/cloudinary/sign','/api/admin/create-assistant'].includes(req.path))return res.status(404).json({code:'not-found'});
  if(!/^application\/json(?:;|$)/i.test(req.get('content-type')||'')||(req.rawBody?.length||0)>4096)return res.status(400).json({code:'invalid-body'});
  try{
    const owner=await requireSuperAdmin(req.get('authorization'),deps),now=clock();
    const isSign=req.path==='/api/cloudinary/sign';
    (isSign?validateUpload:validateAssistant)(req.body,now);
    await deps.quota.reserve(owner.uid,req.body.nonce,now);
    const operationId=randomUUID();
    if(isSign){
      const params=signingParams(now),signed=await deps.sign(params);
      if(!signed||typeof signed.signature!=='string'||!signed.signature||!signed.apiKey||!/^[a-zA-Z0-9_-]+$/.test(signed.cloudName||''))throw new HttpError(503,'signer-not-configured');
      await requireSuperAdmin(req.get('authorization'),deps);
      await deps.audit(auditRecord('cloudinary_sign_requested',{uid:owner.uid,operationId},now));
      return res.status(200).json({cloudName:signed.cloudName,apiKey:signed.apiKey,signature:signed.signature,params,resourceType:'image',expiresAt:now+3600});
    }
    const result=await createAssistant(req.body,owner,{...deps,reauthorize:()=>requireSuperAdmin(req.get('authorization'),deps)});
    // The existing administrative audit is atomic with stageAssistant's records.
    await deps.audit(auditRecord('assistant_created',{uid:owner.uid,operationId},now));
    return res.status(201).json(result);
  }catch(e){
    const statuses=[400,403,409,429,503];const status=statuses.includes(e.status)?e.status:503;
    if(status===429)res.set('Retry-After','60');
    // Never serialize SDK errors, tokens, passwords, secrets or raw request bodies.
    return res.status(status).json({code:statuses.includes(e.status)?e.code:'operation-unavailable'});
  }
 };
}
