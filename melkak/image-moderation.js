// Local guidance only: client classification is bypassable and never grants privileges.
export const IMAGE_POLICY=Object.freeze({reject:.95,borderline:.60,version:'melkak-local-1'});
const classes=['Porn','Hentai','Sexy','Neutral','Drawing'];
const error=code=>Object.assign(new Error(code),{code});
export function classifyDecision(predictions){
 if(!Array.isArray(predictions)||predictions.length!==5||new Set(predictions.map(p=>p.className)).size!==5||predictions.some(p=>!classes.includes(p.className)||!Number.isFinite(p.probability)||p.probability<0||p.probability>1)||Math.abs(predictions.reduce((n,p)=>n+p.probability,0)-1)>.02)throw error('IMAGE_SCAN_FAILED');
 const explicit=Math.max(...predictions.filter(p=>['Porn','Hentai'].includes(p.className)).map(p=>p.probability));
 return {status:explicit>=IMAGE_POLICY.reject?'reject':explicit>=IMAGE_POLICY.borderline?'borderline':'allow'};
}
async function decodeImage(src){const img=new Image();img.src=src;await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw error('IMAGE_SCAN_FAILED');return img;}
export function createImageModerator({loadModel=async()=>{const runtime=await import('./vendor/moderation/runtime.js');return runtime.loadLocalModel(new URL('./vendor/moderation/model/model.json',import.meta.url).href);},decode=decodeImage,timeoutMs=45000}={}){
 let modelPromise;const allowed=new Set();let queue=Promise.resolve();
 async function bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(error('IMAGE_SCAN_FAILED')),timeoutMs);})]);}finally{clearTimeout(timer);}}
 async function inspect(src){
  if(allowed.has(src))return {status:'allow'};
  try{
   modelPromise??=loadModel();const model=await bounded(modelPromise);const img=await bounded(decode(src));
   const decision=classifyDecision(await bounded(model.classify(img,5)));
   if(decision.status!=='allow')throw error(decision.status==='reject'?'IMAGE_REJECTED':'IMAGE_BORDERLINE');
   allowed.add(src);if(allowed.size>16)allowed.delete(allowed.values().next().value);
   return decision;
  }catch(e){if(['IMAGE_REJECTED','IMAGE_BORDERLINE'].includes(e.code))throw e;modelPromise=undefined;throw error('IMAGE_SCAN_FAILED');}
 }
 return {isAllowed:src=>allowed.has(src),check(src){const result=queue.then(()=>inspect(src));queue=result.catch(()=>{});return result;}};
}
