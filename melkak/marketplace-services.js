import {requireReason,auditRecord} from './audit.js';
import {can} from '../admin-permissions.js';
import {selectAds,PLACEMENTS} from '../commercial-model.js';

const DAY=86400000;
const reject=code=>{throw Object.assign(new Error(code),{code});};
export function schedule(days,start=Date.now()) {
  days=Number(days); start=typeof start==='number'?start:Date.parse(start);
  if(!Number.isInteger(days)||days<1||days>365||!Number.isFinite(start))reject('DURATION');
  return {featuredDurationDays:days,featuredStartAt:start,featuredEndAt:start+days*DAY};
}
export function featuredState(a,now=Date.now()) {
  if(a.featuredStatus!=='approved')return a.featuredStatus||'none';
  if(!Number.isFinite(a.featuredEndAt))return 'unspecified';
  if(now>=a.featuredEndAt)return 'expired';
  if(a.featuredStartAt>now)return 'future';
  return a.featuredEndAt-now<2*DAY?'expiring':'active';
}
export function commercialState(a,now=Date.now()) {
  if(['pending','rejected','paused'].includes(a.status))return a.status;
  if(!Number.isFinite(a.startAt)||!Number.isFinite(a.endAt))return 'incomplete';
  if(now>=a.endAt)return 'expired';
  if(now<a.startAt)return 'approved';
  return ['active','approved'].includes(a.status)?(a.endAt-now<2*DAY?'expiring':'active'):a.status;
}
export function countryAds(ads,placement,country,now=Date.now(),city='') {
  return selectAds(ads.filter(a=>(!a.countryTarget||a.countryTarget==='ALL'||a.countryTarget===country)&&(!a.cityTarget||a.cityTarget===city)&&['active','expiring'].includes(commercialState(a,now))).map(a=>({...a,status:'active'})),placement,now);
}
export function safeTarget(raw) {
  try { const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''; } catch {return '';}
}
export function attachLocalServices(store,countries) {
  const state=store.state;
  let seq=0;
  const log=(actor,action,target,reason='')=>{state.audit.unshift(auditRecord('extension-'+(++seq),actor,action,target,reason));state.version++;};
  const check=(actor,permission)=>{if(!actor?.uid||!can(actor,permission))reject('PERMISSION');};
  const own=(id,actor)=>{const a=state.listings.find(a=>a.id===id);if(!a||a.ownerUid!==actor?.uid)reject('OWNER');if(a.status!=='active'||a.moderationLocked)reject('STATE');return a;};
  store.requestService=(id,type,actor,options={})=>{
    const a=own(id,actor);
    if(!['featured','bump','verification'].includes(type)||(type==='verification'&&!['livestock','cars'].includes(a.category)))reject('CATEGORY');
    if(state.services.some(r=>r.listingId===id&&r.type===type&&r.status==='pending'))reject('DUPLICATE');
    const timing=type==='featured'?schedule(options.days??7,options.startAt??Date.now()):{};
    const r={id:'request-'+(++seq),listingId:id,type,status:'pending',createdAt:Date.now(),...timing};state.services.unshift(r);a.history=true;log(actor,'service-request',id);return r;
  };
  store.approveService=(id,reason,actor)=>{
    if(actor?.role!=='super_admin')reject('PERMISSION');requireReason(reason);
    const r=state.services.find(r=>r.id===id),a=state.listings.find(a=>a.id===r?.listingId);if(!r||r.status!=='pending'||a?.status!=='active'||a.moderationLocked)reject('STATE');
    if(r.type==='featured'){const timing=schedule(r.featuredDurationDays??7,Math.max(Date.now(),r.featuredStartAt||0));Object.assign(r,timing);Object.assign(a,{featuredStatus:'approved',...timing});}
    if(r.type==='bump')a.bumpedAt=Date.now();if(r.type==='verification')a.verified=true;r.status='approved';log(actor,'exception-approval',id,reason);
  };
  store.rejectService=(id,reason,actor)=>{if(actor?.role!=='super_admin')reject('PERMISSION');requireReason(reason);const r=state.services.find(r=>r.id===id);if(!r||r.status!=='pending')reject('STATE');r.status='rejected';log(actor,'service-rejected',id,reason);};
  store.requestCommercial=(data,actor)=>{
    if(!actor?.uid)reject('AUTH');
    if(!PLACEMENTS.includes(data.placement)||!['ALL',...Object.keys(countries)].includes(data.countryTarget))reject('FIELDS');
    const targetUrl=safeTarget(data.targetUrl);
    if(!targetUrl||!data.advertiserName?.trim()||data.advertiserName.length>100||!data.title?.trim()||data.title.length>100||typeof data.description!=='string'||data.description.length>500||!data.cta?.trim()||data.cta.length>50)reject('FIELDS');
    if(typeof data.image!=='string'||data.image.length>210000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(data.image))reject('IMAGES');
    const startAt=Date.parse(data.startAt),endAt=Date.parse(data.endAt),priority=Number(data.priority);
    if(!Number.isFinite(startAt)||!Number.isFinite(endAt)||endAt<=startAt||endAt-startAt>365*DAY||!Number.isInteger(priority)||priority<1||priority>10)reject('DURATION');
    const a={id:'commercial-'+(++seq),ownerUid:actor.uid,title:data.title.trim(),advertiserName:data.advertiserName.trim(),description:data.description.trim(),cta:data.cta.trim(),asset:data.image,targetUrl,countryTarget:data.countryTarget,cityTarget:'',placement:data.placement,priority,startAt,endAt,status:'pending',createdAt:Date.now(),demo:true};state.ads.unshift(a);log(actor,'commercial-request',a.id);return a;
  };
  store.reviewCommercial=(id,decision,reason,actor)=>{
    if(actor?.role!=='super_admin')reject('PERMISSION');requireReason(reason);const a=state.ads.find(a=>a.id===id);if(!a)reject('MISSING');
    const allowed={pending:['approved','rejected'],approved:['paused','rejected'],active:['paused','rejected'],paused:['approved']};
    if(!allowed[a.status]?.includes(decision)||decision==='approved'&&a.endAt<=Date.now())reject('STATE');a.status=decision;log(actor,'commercial-'+decision,id,reason);
  };
  store.reportUser=(uid,reason,actor)=>{
    if(!actor?.uid)reject('AUTH');requireReason(reason);if(!state.users.some(u=>u.uid===uid))reject('MISSING');
    const r={id:'user-report-'+(++seq),targetType:'user',targetUid:uid,reason:reason.slice(0,500),status:'open',createdAt:Date.now()};state.reports.unshift(r);log(actor,'user-report',uid,reason);return r;
  };
  store.actOnReport=(id,action,reason,actor)=>{
    check(actor,'reports_manage');requireReason(reason);const r=state.reports.find(r=>r.id===id);if(!r)reject('MISSING');
    if(!['review','dismiss','hide','suspend','escalate'].includes(action))reject('STATE');
    if(action==='hide'){check(actor,'listings_manage');const a=state.listings.find(a=>a.id===r.listingId);if(!a)reject('MISSING');a.status='hidden';a.hiddenBy='admin';a.moderationLocked=true;a.history=true;}
    if(action==='suspend'){check(actor,'users_suspend');const a=state.listings.find(a=>a.id===r.listingId);const u=state.users.find(u=>u.uid===(r.targetUid||a?.ownerUid));if(!u)reject('MISSING');if(u.role==='super_admin'||u.uid===actor.uid)reject('PERMISSION');u.status='suspended';for(const ad of state.listings.filter(a=>a.ownerUid===u.uid)){ad.status='hidden';ad.moderationLocked=true;ad.history=true;}}
    r.status={review:'reviewing',dismiss:'dismissed',hide:'resolved',suspend:'resolved',escalate:'escalated'}[action];log(actor,'report-'+action,id,reason);
  };
  return store;
}
