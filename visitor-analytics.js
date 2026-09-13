import {dayKey} from './commercial-model.js';
export const CATEGORIES=['home','market','listing_details','sell','auctions','services','account','contact','about','other'];
export const READ_LIMIT=1000;
export function category(path='',hash=''){
 const h=hash.split('?')[0].toLowerCase();if(/admin/.test(h))return null;
 if(path.endsWith('/about.html'))return 'about';
 if(path&&!path.endsWith('/')&&!path.endsWith('/index.html'))return 'other';
 return ({'':'home','#home':'home','#market':'market','#direct':'market','#direct-sales':'market','#direct-sales-anchor':'market','#auction':'auctions','#auction-list':'auctions','#sell':'sell','#services':'services','#account':'account','#contact':'contact','#about':'about','#listing_details':'listing_details'})[h]||'other';
}
export function createVisitorRecorder({storage,random,write,now=Date.now,blocked=false}){
 let state;try{state=JSON.parse(storage.getItem('souqVisitorV2'));}catch{}
 const fresh=()=>({id:random(),start:now(),last:now(),sequence:0,page:null,seen:[],pending:[]});
 if(!state||!/^\w{32}$/.test(state.id)||!Array.isArray(state.pending)||!Array.isArray(state.seen))state=fresh();
 let chain=Promise.resolve();const save=()=>{try{storage.setItem('souqVisitorV2',JSON.stringify(state));}catch{}};
 function flush(){if(blocked)return Promise.resolve();chain=chain.then(async()=>{while(state.pending.length){const pending=state.pending,e=pending[0];try{await write(e);}catch{break;}pending.shift();save();}});return chain;}
 function record(kind,value){if(blocked||!['page','views','clicks'].includes(kind)||kind==='page'&&!CATEGORIES.includes(value))return false;
 if(now()-state.last>=1800000||dayKey(state.last)!==dayKey(now())||now()<state.last){state=fresh();}
 if(state.sequence===0&&kind!=='page')return false;
 if(state.sequence>=100||state.pending.length>=10)return false;
 if(kind==='page'&&state.page===value){return false;}
 if(kind!=='page'&&(!/^[a-zA-Z0-9_-]{1,128}$/.test(value)||state.seen.includes(kind+':'+value)))return false;
 if(kind==='page')state.page=value;else state.seen.push(kind+':'+value);
 const event={sessionId:state.id,sequence:state.sequence++,sessionStartedAt:state.start,kind,category:kind==='page'?value:'home',adId:kind==='page'?'':value};
 state.last=now();state.pending.push(event);save();flush();return true;
 }
 flush();return {record,flush,get state(){return structuredClone(state);}};
}
export function summarizeEvents(events,now=Date.now()){
 const days={},pages=Object.fromEntries(CATEGORIES.map(k=>[k,0])),ads={};let pageViews=0;const sessions=new Set();
 for(const e of events){const ms=e.occurredAt?.toMillis?.()??(e.occurredAt?.seconds?e.occurredAt.seconds*1000:+new Date(e.occurredAt));const day=dayKey(ms);if(day>dayKey(now)||day<dayKey(now-29*86400000))continue;days[day]??={sessions:0,pageViews:0};if(e.sequence===0&&!sessions.has(e.sessionId)){days[day].sessions++;sessions.add(e.sessionId);}if(e.kind==='page'&&CATEGORIES.includes(e.category)){pages[e.category]++;pageViews++;days[day].pageViews++;}else if(['views','clicks'].includes(e.kind)){ads[e.adId]??={views:0,clicks:0};ads[e.adId][e.kind]++;}}
 const recent=n=>Object.entries(days).filter(([d])=>d>=dayKey(now-(n-1)*86400000)).reduce((s,[,v])=>s+v.sessions,0);
 return {days,pages,ads,pageViews,sessions:sessions.size,today:recent(1),seven:recent(7),thirty:recent(30)};
}
export async function readWindow(api,now=Date.now()){
 const {db,collection,query,where,orderBy,limit,getDocs}=api,start=new Date(dayKey(now-29*86400000)+'T00:00:00+04:00');
 const snap=await getDocs(query(collection(db,'analyticsEvents'),where('occurredAt','>=',start),where('occurredAt','<=',new Date(now)),orderBy('occurredAt','desc'),limit(READ_LIMIT+1)));
 return {events:snap.docs.slice(0,READ_LIMIT).map(d=>d.data()),partial:snap.size>READ_LIMIT};
}
export async function readCounts(api,now=Date.now()){
 const {db,collection,query,where,getCountFromServer}=api;
 const count=async(days,filters)=>{const start=new Date(dayKey(now-(days-1)*86400000)+'T00:00:00+04:00');return (await getCountFromServer(query(collection(db,'analyticsEvents'),where('occurredAt','>=',start),where('occurredAt','<=',new Date(now)),...filters.map(([k,v])=>where(k,'==',v))))).data().count;};
 const [today,seven,thirty,pageViews,...counts]=await Promise.all([1,7,30].map(d=>count(d,[['sequence',0]])).concat([count(30,[['kind','page']]),...CATEGORIES.map(c=>count(30,[['kind','page'],['category',c]]))]));
 return {today,seven,thirty,sessions:thirty,pageViews,pages:Object.fromEntries(CATEGORIES.map((c,i)=>[c,counts[i]])),days:{},ads:{}};
}
