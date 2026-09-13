export function requireReason(reason) {
 if(typeof reason!=='string'||!reason.trim()||reason.length>500)throw Object.assign(new Error('REASON'),{code:'REASON'});
 return reason;
}
export function auditRecord(id,actor,action,targetId,reason='') {
 const timestamp=Date.now();
 return {id,actorUid:actor.uid,actor:actor.uid,action,targetId,reason,timestamp,result:'success',target:targetId,at:timestamp};
}
