import {createHash} from 'node:crypto';
import {createHandler} from '../src/handler.js';
import {HttpError} from '../src/security.js';
export const ORIGIN='https://iso9090.github.io';
export function fixture(){
 const state={now:2000000000,admin:true,disabled:false,uid:'owner',tokenAdmin:true,registry:{enabled:true,superAdminUids:['owner','phone-owner']},access:{role:'super_admin'},profile:{status:'active'},calls:[],logs:[],accounts:[],staged:[]};
 const seen=new Set(),counts=new Map();
 const deps={auth:{
  async verifyIdToken(token,checkRevoked){if(!checkRevoked||token!=='mock-owner')throw Error('bad-token');return {uid:state.uid,admin:state.tokenAdmin};},
  async getUser(uid){return {uid,customClaims:{admin:state.admin},disabled:state.disabled};},
  async getUserByEmail(){if(state.duplicate)return {uid:'phone-owner'};throw {code:'auth/user-not-found'};},
  async createUser(record){state.accounts.push(record);return record;}
 },readAccess:async()=>state,
 quota:{async reserve(uid,nonce,now){const id=uid+nonce;if(seen.has(id))throw new HttpError(409,'replay-denied');const keys=[[uid+Math.floor(now/60),5],[uid+'d'+Math.floor(now/86400),50],['global'+Math.floor(now/86400),200]];if(keys.some(([k,n])=>(counts.get(k)||0)>=n))throw new HttpError(429,'rate-limited');seen.add(id);for(const [k] of keys)counts.set(k,(counts.get(k)||0)+1);}},
 sign:async params=>{state.calls.push(params);if(state.signFail)throw Error(state.sentinel);return {cloudName:'mock',apiKey:'mock-public-key',signature:createHash('sha256').update(JSON.stringify(params)).digest('hex'),ignoredSecret:state.sentinel};},
 audit:async record=>{if(state.auditFail)throw Error(state.sentinel);state.logs.push(record);},
 stageAssistant:async(uid,body,owner)=>{if(state.stageFail)throw Error('stage-failed');state.staged.push({uid,role:'admin_assistant',permissions:[],owner});}
 };
 const handler=createHandler(deps,{enabled:true,local:true,clock:()=>state.now});
 return {state,deps,handler};
}
export async function invoke(handler,{path='/api/cloudinary/sign',origin=ORIGIN,authorization='Bearer mock-owner',method='POST',body,headers={}}={}){
 const h={'origin':origin,'authorization':authorization,'content-type':'application/json',...headers};
 const result={headers:{},status:200};
 const req={path,method,body,rawBody:Buffer.from(JSON.stringify(body||{})),get:name=>h[name.toLowerCase()]};
 const res={set:(k,v)=>{result.headers[k]=v;return res;},status:n=>{result.status=n;return res;},json:b=>{result.body=b;return res;},send:b=>{result.body=b;return res;}};
 await handler(req,res);return result;
}
