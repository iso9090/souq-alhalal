// Isolated browser fixture: all Firebase APIs use an in-memory Map. No credentials.
exports.installMock = () => {
   const docs = new Map(), calls = [], observers = [];
   let sequence = 0, queue = Promise.resolve();
   const auth = { currentUser: null };
   const clone = value => structuredClone(value);
   const snapshot = ref => ({ id: ref.path.split('/').pop(), exists: () => docs.has(ref.path), data: () => clone(docs.get(ref.path)) });
   const readQuery = ref => {
     let items = [...docs].filter(([key]) => key.startsWith(ref.path + '/') && key.split('/').length === ref.path.split('/').length + 1)
       .filter(([key,data]) => (ref.filters || []).filter(f=>Array.isArray(f)).every(([field,op,value]) => op === 'array-contains' ? data[field]?.includes(value) : op==='>' ? data[field]>value : op==='<=' ? data[field]<=value : (field==='__name__'?key.split('/').pop():data[field]) === value))
       .map(([key]) => snapshot({path:key}));
     if((ref.filters||[]).some(f=>f.orderBy==='__name__'))items.sort((a,b)=>a.id.localeCompare(b.id));
     const after=(ref.filters||[]).find(f=>f.cursor)?.cursor;
     if(after)items=items.filter(d=>d.id.localeCompare(after.id)>0);
     const max=(ref.filters||[]).find(f=>f.limit)?.limit;
     if(max)items=items.slice(0,max);
     return { docs: items, forEach: fn => items.forEach(fn), empty: !items.length, size: items.length };
   };
   const write = (ref, data, merge) => {
     if (JSON.stringify(data).match(/"(?:password|passwordHash|email)"\s*:/)) throw Error('Sensitive Firestore field');
     if (Object.values(data).some(v => v === undefined)) throw Error('Undefined write');
     calls.push({kind:'write',path:ref.path,data:clone(data)});
     docs.set(ref.path, merge ? {...docs.get(ref.path),...clone(data)} : clone(data));
   };
   const batch = () => {
     const writes=[]; const b={set:(r,d,o)=>{writes.push(()=>write(r,d,o?.merge));return b},update:(r,d)=>{writes.push(()=>write(r,d,true));return b},commit:async()=>writes.forEach(fn=>fn())}; return b;
   };
   const setUser = async user => { auth.currentUser = user; await Promise.all(observers.map(fn => fn(user))); };
   const mock = {
     initializeApp:()=>({}),getFirestore:()=>({}),getAuth:()=>auth,
     onAuthStateChanged:(a,fn)=>{observers.push(fn);queueMicrotask(()=>fn(a.currentUser));return ()=>{}},
     getIdTokenResult:async()=>({claims:{admin:!!window.__mock.admin}}),
     collection:(base,...parts)=>({path:[base.path,...parts].filter(Boolean).join('/')}),
     doc:(base,...parts)=>{const refPath=[base.path,...(parts.length?parts:['auto'+(++sequence)])].filter(Boolean).join('/');return {path:refPath,id:refPath.split('/').pop()}},
     query:(ref,...filters)=>({...ref,filters}),where:(...args)=>args,
     limit:n=>({limit:n}),orderBy:field=>({orderBy:field}),startAfter:cursor=>({cursor}),
     getCountFromServer:async ref=>({data:()=>({count:readQuery(ref).size})}),
     getDoc:async ref=>{if(window.__mock.failRead===ref.path)throw Error("offline");window.__mock.reads.push(ref.path);return snapshot(ref);},getDocs:async ref=>{
       if(window.__mock.failRead===ref.path)throw Error('offline');
       if(window.__mock.delay)await new Promise(resolve=>setTimeout(resolve,window.__mock.delay));
       if(ref.path==='purchaseRequests' && window.__mock.purchaseDelay)await new Promise(resolve=>setTimeout(resolve,window.__mock.purchaseDelay));
       return readQuery(ref);
     },
     setDoc:async(ref,data,options)=>{if(window.__mock.failWrite)throw Error("offline");return write(ref,data,options?.merge)},updateDoc:async(ref,data)=>write(ref,data,true),
     addDoc:async(ref,data)=>{const item={path:ref.path+'/auto'+(++sequence),id:'auto'+sequence};write(item,data);return item},
     serverTimestamp:()=>new Date(),Timestamp:{fromMillis:value=>new Date(value)},
     writeBatch:()=>batch(),
     runTransaction:async(db,fn)=>{
       const run=queue.then(async()=>{const b=batch();const result=await fn({get:async ref=>snapshot(ref),set:b.set,update:b.update});await b.commit();return result});
       queue=run.catch(()=>{});return run;
     },
     onSnapshot:(ref,fn)=>{queueMicrotask(()=>fn(readQuery(ref)));return ()=>{}},
     signOut:async()=>{calls.push({kind:'logout'});await setUser(null)},
     RecaptchaVerifier:class { clear(){} },
     signInWithPhoneNumber:async()=>{calls.push({kind:'phone'});throw {code:'auth/billing-not-enabled'}},
     createUserWithEmailAndPassword:async(a,email,password)=>{
       calls.push({kind:'signup'});await new Promise(r=>setTimeout(r,35));
       if(window.__mock.error)throw {code:window.__mock.error};
       const user={uid:'owner',email,phoneNumber:null,providerData:[{providerId:'password'}]};await setUser(user);return {user};
     },
     signInWithEmailAndPassword:async(a,email,password)=>{
       calls.push({kind:'login'});if(window.__mock.error)throw {code:window.__mock.error};
       const user={uid:'owner',email,phoneNumber:null,providerData:[{providerId:'password'}]};await setUser(user);return {user};
     },
     sendPasswordResetEmail:async()=>{calls.push({kind:'reset'});if(window.__mock.error)throw {code:window.__mock.error}}
   };
   window.__mock={reads:[],api:mock,docs,calls,setUser,admin:false,error:null,failures:[]};
 };
exports.seedMock = async function () {
  const d=window.__mock.docs, now=new Date();
  const animal={type:'ناقة',name:'ناقة للبيع',breed:'محلية',gender:'female',age:'3 سنوات',country:'AE',region:'الشارقة',city:'الذيد',location:'الذيد - الشارقة',saleType:'direct',price:1500,sellerId:'seller',sellerName:'بائع تجريبي',status:'active',description:'إعلان محاكاة محلي لا يرتبط ببيانات حقيقية.',createdAt:now,images:[]};
  d.set('users/owner',{displayName:'مستخدم تجريبي',accountType:'both',status:'active'});
  d.set('animals/direct',{...animal});
  d.set('animals/mine',{...animal,name:'إعلاني التجريبي',sellerId:'owner',sellerName:'مستخدم تجريبي'});
  d.set('animals/egypt',{...animal,country:'EG',region:'القاهرة',city:'القاهرة',location:'القاهرة',name:'إعلان مصري'});
  d.set('animals/auction-animal',{...animal,name:'ناقة المزاد',saleType:'auction',auctionId:'auction'});
  d.set('auctions/auction',{animalId:'auction-animal',country:'AE',sellerId:'seller',sellerName:'بائع تجريبي',startPrice:1000,currentPrice:1500,minIncrement:100,endTime:new Date(Date.now()+86400000),status:'active',lastBidderId:'owner',createdAt:now});
  d.set('purchaseRequests/own',{buyerId:'owner',sellerId:'seller',animalId:'egypt',animalType:'ناقة',price:1500,sellerName:'بائع تجريبي',status:'pending',createdAt:now});
  d.set('purchaseRequests/incoming',{buyerId:'buyer',buyerName:'مشتري تجريبي',sellerId:'owner',animalId:'mine',animalType:'ناقة',price:1500,status:'pending',createdAt:now});
  await window.__mock.setUser({uid:'owner',email:'preview@example.test',phoneNumber:null,providerData:[{providerId:'password'}]});
  await window.selectMarketCountry('AE');
};
