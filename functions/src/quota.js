import {createHash} from 'node:crypto';
import {HttpError} from './security.js';
const digest=value=>createHash('sha256').update(value).digest('hex');
export function createFirestoreQuota(db){
  return {async reserve(uid,nonce,now){
    const replay=db.doc('backendReplay/'+digest(uid+':'+nonce));
    const policies=[[uid+':minute:'+Math.floor(now/60),5],[uid+':day:'+Math.floor(now/86400),50],['project:day:'+Math.floor(now/86400),200]];
    const refs=policies.map(([key])=>db.doc('backendQuota/'+digest(key)));
    await db.runTransaction(async tx=>{
      const [seen,...counts]=await Promise.all([tx.get(replay),...refs.map(ref=>tx.get(ref))]);
      if(seen.exists&&seen.data().expiresAt.toMillis()>now*1000)throw new HttpError(409,'replay-denied');
      if(counts.some((s,i)=>(s.data()?.count||0)>=policies[i][1]))throw new HttpError(429,'rate-limited');
      const expiresAt=new Date((now+172800)*1000);
      tx.set(replay,{expiresAt});refs.forEach((ref,i)=>tx.set(ref,{count:(counts[i].data()?.count||0)+1,expiresAt}));
    });
  }};
}
