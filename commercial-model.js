export const PLACEMENTS=['hero','hero_side_1','hero_side_2','hero_side_3','middle','footer_1','footer_2','footer_3','footer_4','footer_5'];
export const STATUSES=['draft','pending','approved','active','paused','rejected','expired'];
export const LABELS={hero:'الإعلان الرئيسي',hero_side_1:'جانبي 1',hero_side_2:'جانبي 2',hero_side_3:'جانبي 3',middle:'وسط الصفحة',footer_1:'أسفل 1',footer_2:'أسفل 2',footer_3:'أسفل 3',footer_4:'أسفل 4',footer_5:'أسفل 5',draft:'مسودة',pending:'معلق',approved:'معتمد',active:'نشط',paused:'موقوف',rejected:'مرفوض',expired:'منتهي'};
export const millis=v=>v?.toMillis?v.toMillis():v?.seconds?v.seconds*1000:new Date(v).getTime();
export const adStatus=(ad,now=Date.now())=>millis(ad.endAt)<=now?'expired':ad.status;
export const visibleAd=(ad,now=Date.now())=>ad.status==='active'&&millis(ad.startAt)<=now&&millis(ad.endAt)>now;
export function selectAds(ads,placement,now=Date.now()){return ads.filter(a=>a.placement===placement&&visibleAd(a,now)).sort((a,b)=>b.priority-a.priority||String(a.id).localeCompare(String(b.id))).slice(0,placement==='hero'?10:1);}
export function safeUrl(value,image=false){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!image||u.hostname==='res.cloudinary.com')?u.href:'';}catch{return '';}}
export function validateAd(ad){return typeof ad.title==='string'&&ad.title.trim().length>0&&ad.title.length<=120&&typeof ad.advertiserName==='string'&&ad.advertiserName.length<=120&&safeUrl(ad.imageUrl,true)&&safeUrl(ad.targetUrl)&&PLACEMENTS.includes(ad.placement)&&STATUSES.includes(ad.status)&&Number.isInteger(ad.priority)&&ad.priority>=0&&ad.priority<=999&&millis(ad.endAt)>millis(ad.startAt)&&ad.description.length<=300&&ad.cta.length<=40;}
export const dayKey=(now=Date.now())=>new Date(now+4*3600000).toISOString().slice(0,10);
export function summarize(sessions,now=Date.now()){
 const days={},pages={home:0,market:0,services:0,admin:0,other:0},ads={},today=dayKey(now);let pageViews=0;
 for(const s of sessions){const d=dayKey(millis(s.startedAt));days[d]??={sessions:0,pageViews:0};days[d].sessions++;days[d].pageViews+=s.pageViews;pageViews+=s.pageViews;for(const p of Object.keys(pages))pages[p]+=s.pages?.[p]||0;for(const kind of ['views','clicks'])for(const id of s[kind]||[]){ads[id]??={views:0,clicks:0};ads[id][kind]++;}}
 const recent=n=>Object.entries(days).filter(([d])=>d>=dayKey(now-(n-1)*86400000)&&d<=today).reduce((sum,[,v])=>sum+v.sessions,0);
 return {days,pages,ads,pageViews,sessions:sessions.length,today:recent(1),seven:recent(7),thirty:recent(30)};
}
// One random per-tab/session identifier, no stable visitor/device/account identifier.
export function createRecorder({storage,random,write,now=Date.now,blocked=false,schedule=setTimeout}){
 let saved;try{saved=JSON.parse(storage.getItem('souqTelemetrySession'));}catch{}let state=saved&&now()-saved.last<1800000&&dayKey(saved.last)===dayKey(now())?saved:{id:random(),start:now(),last:now(),pages:{home:0,market:0,services:0,admin:0,other:0},pageViews:0,views:[],clicks:[],created:false};let pending=false,timer,chain=Promise.resolve();
 function remember(){try{storage.setItem('souqTelemetrySession',JSON.stringify(state));}catch{}}
 async function flush(){if(!pending||blocked)return;pending=false;const data=structuredClone(state);chain=chain.then(()=>write(data)).then(()=>{state.created=true;remember();}).catch(()=>{pending=true;});await chain;}
 function record(kind,value){if(blocked)return false;if(now()-state.last>=1800000||dayKey(state.last)!==dayKey(now())){flush();state={id:random(),start:now(),last:now(),pages:{home:0,market:0,services:0,admin:0,other:0},pageViews:0,views:[],clicks:[],created:false};}if(state.pageViews>=1000)return false;if(kind==='page'){if(!(value in state.pages))value='other';state.pages[value]++;state.pageViews++;}else {if(!['views','clicks'].includes(kind)||state[kind].includes(value)||state[kind].length>=20)return false;state[kind].push(value);}state.last=now();pending=true;remember();if(!timer)timer=schedule(()=>{timer=null;flush();},10000);return true;}
 return {record,flush,get state(){return structuredClone(state);}};
}
