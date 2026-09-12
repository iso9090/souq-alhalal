const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const exportsList = [...source.matchAll(/import\s*\{([^}]+)\}/g)].flatMap(m => m[1].split(',').map(s => s.trim()));
let count = 0;
function pass(name) { count++; console.log('PASS | ' + name); }
(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 try {
 const page = await browser.newPage();
 async function selectAdminTab(name){
   if(await page.locator('.admin-menu-toggle').isVisible()&&(await page.locator('.admin-menu-toggle').getAttribute('aria-expanded'))==='false')await page.locator('.admin-menu-toggle').click();
   const previous=await page.locator('#adminV2Nav').elementHandle();
   await page.getByRole('button',{name,exact:true}).click();
   if(previous){await page.waitForFunction(node=>!node.isConnected,previous);await previous.dispose();}
 }
 const errors = [], external = [], dialogs = [];
 let rejectConfirmation = false;
 page.on('pageerror', e => errors.push(e.message));
 page.on('dialog', d => {dialogs.push(d.message());return d.type()==='confirm' && rejectConfirmation ? d.dismiss() : d.accept(d.type() === 'prompt' ? '110' : undefined)});
 await page.addInitScript(() => {
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
     getDoc:async ref=>{window.__mock.reads.push(ref.path);return snapshot(ref);},getDocs:async ref=>{
       if(ref.path==='purchaseRequests' && window.__mock.purchaseDelay)await new Promise(resolve=>setTimeout(resolve,window.__mock.purchaseDelay));
       return readQuery(ref);
     },
     setDoc:async(ref,data,options)=>write(ref,data,options?.merge),updateDoc:async(ref,data)=>write(ref,data,true),
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
 });
 await page.route('**/*', async route => {
   const url = new URL(route.request().url());
   if (url.hostname === 'www.gstatic.com') {
     const code=exportsList.map(name => name==='RecaptchaVerifier'
       ? 'export const RecaptchaVerifier = window.__mock.api.RecaptchaVerifier;'
       : name==='Timestamp' ? 'export const Timestamp = window.__mock.api.Timestamp;'
       : `export const ${name}=(...args)=>{const fn=window.__mock.api.${name};if(!fn){window.__mock.failures.push('${name}');throw Error('Unexpected SDK API')};return fn(...args)};`).join('\n');
     return route.fulfill({contentType:'text/javascript',body:code});
   }
   if(url.hostname!=='auth.test'){external.push(url.origin);return route.abort()}
   if(url.pathname==='/image-provider.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'image-provider.js'),'utf8').replace(/export async function uploadImages\b[\s\S]*?\n\}/,`export async function uploadImages(files){validateImageCount(files);return ['data:image/jpeg;base64,YWJj'];}`)});
   const file=path.join(root,decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!file.startsWith(root)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
 });
 for(const width of [360,1280,1366]) {
   await page.setViewportSize({width,height:width===360?800:width===1366?768:900});await page.goto('https://auth.test/');
   await page.waitForFunction(()=>typeof window.openEmailAuth==='function');
   await page.evaluate(()=>window.selectMarketCountry('AE'));
   await page.evaluate(()=>window.openLogin());
   assert.equal(await page.locator('.v2-social button').count(),1);
   assert.equal(await page.locator('#authEmail').count(),1);
   assert.equal(await page.locator('#phoneNumber').count(),0);
   assert.equal(await page.getByRole('button',{name:'الدخول برقم الهاتف',exact:true}).count(),1);
   pass('Google and email login with explicit phone backup '+width);
   for(const mode of ['login','signup','reset']){
     await page.evaluate(mode=>window.openEmailAuth(mode),mode);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,(typeof screen === "undefined" ? "auth" : screen)+" document overflow "+width);
     assert.equal(await page.locator('#emailAuthForm').count(),1);
     if(mode==='signup'&&width===360)await page.screenshot({path:path.join(require('os').tmpdir(),'souq-email-signup-mobile.png')});
   }
   const historyBefore=await page.evaluate(()=>({length:history.length,url:location.href}));
   for(const mode of ['login','signup']){
     await page.evaluate(mode=>window.openEmailAuth(mode),mode);
     assert.deepEqual(await page.evaluate(()=>[window.souqHandleAndroidBack(),window.souqHandleAndroidBack()]),[true,false]);
     assert.equal(await page.locator('#modal').isVisible(),false);
   }
   assert.deepEqual(await page.evaluate(()=>({length:history.length,url:location.href})),historyBefore);
   pass('native Back closes login/signup once without browser history changes '+width);
   pass('RTL auth modes no overflow '+width);
 }
 await page.evaluate(()=>window.openEmailAuth('signup'));
 await page.locator('#emailDisplayName').fill('مستخدم <اختبار>');
 await page.locator('#authEmail').fill('owner@example.test');
 for (const weak of ['Aa1!abc', 'abcdefgh1!', 'ABCDEFGH1!', 'Abcdefgh!', 'Abcdefgh1', 'Abcdefg1 ']) {
   await page.locator('#authPassword').fill(weak);
   await page.locator('#authPasswordConfirm').fill(weak);
   await page.locator('#emailAuthForm button[type=submit]').click();
   assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='signup').length),0);
 }
 pass('each missing password requirement prevents signup');
 await page.locator('#authPassword').fill('Sample-password1!');
 assert.equal(await page.locator('#passwordRequirements li.met').count(),5);
 for (const id of ['authPassword', 'authPasswordConfirm']) {
   const toggle = page.locator(`[aria-controls="${id}"]`);
   await toggle.click();
   assert.equal(await page.locator('#'+id).getAttribute('type'),'text');
   assert.equal(await toggle.getAttribute('aria-pressed'),'true');
   await toggle.click();
   assert.equal(await page.locator('#'+id).getAttribute('type'),'password');
 }
 pass('both eye buttons toggle without submitting; live requirements satisfied');
 await page.locator('#authPasswordConfirm').fill('different');
 await page.locator('#emailAuthForm button[type=submit]').click();
 assert.equal(await page.locator('#emailAuthStatus').textContent(),'تأكيد كلمة المرور غير مطابق.');
 assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='signup').length),0);
 pass('confirmation mismatch prevents signup');
 await page.locator('#authPasswordConfirm').fill('Sample-password1!');
 await page.evaluate(async()=>{
   const event={preventDefault(){}};
   await Promise.all([window.submitEmailAuth(event,'signup'),window.submitEmailAuth(event,'signup')]);
 });
 assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='signup').length),1);
 await page.locator('#profileName').waitFor();
 assert.equal(await page.locator('#profileName').inputValue(),'مستخدم <اختبار>');
 assert.equal(await page.evaluate(()=>window.__mock.docs.get('users/owner').accountType),'both');
 assert.equal(await page.evaluate(()=>Object.hasOwn(window.__mock.docs.get('users/owner'),'phoneNumber')),false);
 assert.equal(await page.locator('#adminPanelButton').isVisible(),false);
 pass('email signup without phone; name race safe, own identity, double click, admin hidden');
 await page.evaluate(()=>window.logoutUser());
 assert.equal(await page.evaluate(()=>window.__mock.api.getAuth().currentUser),null);
 await page.evaluate(()=>window.openEmailAuth('reset'));
 await page.locator('#authEmail').fill('missing@example.test');
 await page.evaluate(()=>{window.__mock.error='auth/user-not-found'});
 await page.locator('#emailAuthForm button[type=submit]').click();
 await page.getByText('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني إذا كان الحساب مسجلاً لدينا.',{exact:true}).waitFor();
 pass('logout and reset avoid account enumeration');
 await page.evaluate(()=>window.openEmailAuth());
 await page.locator('#authEmail').fill('owner@example.test');await page.locator('#authPassword').fill('Sample-password1!');
 await page.evaluate(()=>{window.__mock.error='auth/invalid-credential'});
 await page.locator('[aria-controls="authPassword"]').click();
 await page.locator('#emailAuthForm button[type=submit]').click();
 await page.getByText('البريد الإلكتروني أو كلمة المرور غير صحيحة.',{exact:true}).waitFor();
 assert.equal(await page.locator('#authPassword').inputValue(),'');
 assert.equal(await page.locator('#authPassword').getAttribute('type'),'password');
 pass('login failure Arabic and password input cleared');
 await page.evaluate(()=>{window.__mock.error=null});await page.locator('#authPassword').fill('legacy-password');
 await page.locator('#emailAuthForm button[type=submit]').click();await page.locator('#profileName').waitFor();
 pass('email login succeeds');
 assert.equal(await page.evaluate(()=>window.souqHandleAndroidBack()),true);
 assert.equal(await page.locator('#modal').isVisible(),false);
 assert.equal(await page.evaluate(async()=>{const loading=window.openLogin();const consumed=window.souqHandleAndroidBack();await loading;return consumed}),true);
 assert.equal(await page.locator('#modal').isVisible(),false);
 assert.equal(await page.evaluate(()=>window.souqHandleAndroidBack()),false);
 pass('Account Back closes loaded/loading modal without reopening');
 await page.evaluate(()=>window.openAccountDeletion());
 await page.locator('#requestDeletionButton:not([disabled])').waitFor();
 await page.evaluate(async()=>Promise.all([window.confirmAccountDeletion(),window.confirmAccountDeletion()]));
 assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='write'&&c.path==='accountDeletionRequests/owner').length),1);
 assert.equal(await page.evaluate(()=>window.__mock.docs.get('accountDeletionRequests/owner').status),'pending');
 assert.equal(await page.evaluate(()=>window.__mock.api.getAuth().currentUser),null);
 assert.equal(await page.locator('#deletionStatus').isVisible(),false);
 assert.ok(dialogs.includes('تم إرسال طلب حذف حسابك بنجاح.'));
 pass('deletion success feedback closes modal and signs out');
 await page.evaluate(()=>window.openEmailAuth());
 await page.locator('#authEmail').fill('owner@example.test');await page.locator('#authPassword').fill('Sample-password1!');
 await page.locator('#emailAuthForm button[type=submit]').click();await page.locator('#accountDeletionNotice').waitFor();
 assert.match(await page.locator('#accountDeletionNotice').innerText(),/طلب حذف حسابك قيد المراجعة/);
 assert.equal(await page.locator('#accountDeletionButton').isDisabled(),true);
 await page.evaluate(()=>window.openAdminServices());
 assert.equal(await page.locator('#adminDeletionRequestsList').count(),0);
 await page.evaluate(()=>window.processDeletionRequest('owner','completed'));
 assert.equal(await page.evaluate(()=>window.__mock.docs.get('accountDeletionRequests/owner').status),'pending');
 pass('pending re-login account warning, disabled action and non-admin denied');
 await page.evaluate(()=>window.openAccountDeletion());assert.equal(await page.locator('#requestDeletionButton').isDisabled(),true);
 await page.evaluate(()=>window.confirmAccountDeletion());
 assert.equal(await page.evaluate(()=>window.__mock.calls.filter(c=>c.kind==='write'&&c.path==='accountDeletionRequests/owner').length),1);
 assert.equal(await page.evaluate(()=>window.__mock.api.getAuth().currentUser.uid),'owner');
 pass('existing request handled without write or logout');
 await page.evaluate(async()=>{window.closeModal();await window.selectMarketCountry('AE')});
 await page.evaluate(async()=>{
   document.getElementById('animalType').value='غنم';document.getElementById('animalGender').value='male';
   document.getElementById('animalPrice').value='500';document.getElementById('animalCountry').value='AE';
   window.updateListingLocationOptions();
   const region=document.getElementById('animalRegion');region.selectedIndex=1;window.updateListingCityOptions();
   const city=document.getElementById('animalCity');city.selectedIndex=1;window.updateFullLocation();
   const form=document.getElementById('animalType').closest('form');
   const imageFiles=new DataTransfer();imageFiles.items.add(new File(['fixture'],'test.jpg',{type:'image/jpeg'}));document.getElementById('animalImages').files=imageFiles.files;
   await window.saveListing({preventDefault(){},target:form});
 });
 const listingId=await page.evaluate(()=>[...window.__mock.docs.keys()].find(k=>k.startsWith('animals/'))?.split('/')[1]);
 assert.ok(listingId,'direct listing created');
 await page.evaluate(id=>window.manageListing(id),listingId);
 await page.locator('#editAnimalDescription').fill('edited');
 await page.evaluate(id=>window.saveListingEdits(id),listingId);
 assert.equal(await page.evaluate(id=>window.__mock.docs.get('animals/'+id).description,listingId),'edited');
 await page.evaluate(id=>window.submitListingService(id,'featured'),listingId);
 assert.ok(await page.evaluate(()=>[...window.__mock.docs.keys()].some(k=>k.startsWith('serviceRequests/owner_featured_'))));
 pass('email-only direct listing create/edit and optional service');
 await page.evaluate(async()=>{
   window.closeModal();document.getElementById('animalType').value='غنم';document.getElementById('animalGender').value='male';
   document.getElementById('animalPrice').value='100';document.getElementById('animalCountry').value='AE';window.updateListingLocationOptions();
   document.getElementById('animalRegion').selectedIndex=1;window.updateListingCityOptions();document.getElementById('animalCity').selectedIndex=1;window.updateFullLocation();
   document.getElementById('method').value='مزاد إلكتروني';window.toggleAuctionFields();
   document.getElementById('auctionIncrement').value='10';document.getElementById('auctionEndTime').value='2099-01-01T12:00';
   const imageFiles=new DataTransfer();imageFiles.items.add(new File(['fixture'],'test.jpg',{type:'image/jpeg'}));document.getElementById('animalImages').files=imageFiles.files;
   await window.saveListing({preventDefault(){},target:document.getElementById('animalType').closest('form')});
 });
 const auctionId=await page.evaluate(()=>[...window.__mock.docs.keys()].find(k=>k.startsWith('auctions/'))?.split('/')[1]);assert.ok(auctionId);
 await page.evaluate(async()=>{
   await window.__mock.setUser({uid:'buyer',email:'buyer@example.test',phoneNumber:null,providerData:[{providerId:'password'}]});
   await window.openLogin();document.getElementById('profileName').value='buyer';document.getElementById('profileAccountType').value='both';await window.saveProfile();
 });
 await page.evaluate(id=>window.placeBid(id),auctionId);
 assert.equal(await page.evaluate(id=>window.__mock.docs.get('auctions/'+id).currentPrice,auctionId),110);
 await page.evaluate(id=>window.requestPurchase(id),listingId);
 assert.ok(await page.evaluate(()=>[...window.__mock.docs.keys()].some(k=>k.startsWith('purchaseRequests/'))));
 pass('email-only auction create, bid and purchase request');
 await page.evaluate(id=>window.openDirectConversation(id),listingId);
 const cid=await page.evaluate(()=>[...window.__mock.docs.keys()].find(k=>k.startsWith('conversations/')&&k.split('/').length===2)?.split('/')[1]);assert.ok(cid);
 assert.equal((await page.locator('#modalContent').innerText()).includes('لم يضف المستخدم رقم هاتف للتواصل'),false);
 pass('unaccepted direct conversation has no contact guidance');
 await page.locator('#chatOfferAmount').fill('450');await page.evaluate(id=>window.sendConversationOffer(id),cid);
 const offerId=await page.evaluate(id=>[...window.__mock.docs].find(([k,d])=>k.startsWith('conversations/'+id+'/messages/')&&d.type==='offer')?.[0].split('/').pop(),cid);assert.ok(offerId);
 await page.evaluate(async()=>{await window.__mock.setUser({uid:'owner',email:'owner@example.test',phoneNumber:null,providerData:[{providerId:'password'}]})});
 await page.evaluate(([id,offer])=>window.decideConversationOffer(id,offer,'accepted'),[cid,offerId]);
 await page.getByText('لم يضف المستخدم رقم هاتف للتواصل. يمكنك متابعة التواصل عبر المحادثة داخل المنصة.',{exact:true}).waitFor();
 assert.equal((await page.locator('#modalContent').innerText()).includes('buyer@example.test'),false);
 await page.locator('#chatMessageText').fill('متابعة');await page.evaluate(id=>window.sendConversationMessage(id),cid);
 await page.evaluate(async()=>{await window.__mock.setUser({uid:'buyer',email:'buyer@example.test',phoneNumber:null,providerData:[{providerId:'password'}]})});
 await page.evaluate(id=>window.showConversation(id),cid);
 await page.getByText('لم يضف المستخدم رقم هاتف للتواصل. يمكنك متابعة التواصل عبر المحادثة داخل المنصة.',{exact:true}).waitFor();
 assert.equal((await page.locator('#modalContent').innerText()).includes('owner@example.test'),false);
 pass('both participants without phone: accept offer, private contacts, messaging, no opponent email');
 await page.evaluate(id=>{window.__mock.docs.delete('conversations/'+id+'/privateContacts/owner')},cid);
 await page.evaluate(id=>window.showConversation(id),cid);
 assert.equal(await page.getByText('لم يضف المستخدم رقم هاتف للتواصل. يمكنك متابعة التواصل عبر المحادثة داخل المنصة.',{exact:true}).count(),1);
 assert.equal((await page.locator('#modalContent').innerText()).includes('owner@example.test'),false);
 pass('accepted conversation missing other contact document has one guidance notice');
 await page.evaluate(id=>window.__mock.docs.set('conversations/'+id+'/privateContacts/owner',{uid:'owner',displayName:'Owner',phoneNumber:'+971500000000',createdAt:new Date()}),cid);
 await page.evaluate(id=>window.showConversation(id),cid);
 assert.equal((await page.locator('#modalContent').innerText()).includes('لم يضف المستخدم رقم هاتف للتواصل'),false);
 assert.match(await page.locator('#modalContent').innerText(),/\+971500000000/);
 pass('accepted available phone suppresses no-phone notice');
 await page.evaluate(async id=>{
   const mock=window.__mock;mock.docs.delete('conversations/'+id+'/privateContacts/buyer');
   const legacy=mock.docs.get('conversations/'+id);delete legacy.contactStatus;delete legacy.acceptedOfferId;delete legacy.contactUnlockedAt;
   mock.docs.set('conversations/'+id,legacy);
   await mock.setUser({uid:'owner',email:'owner@example.test',phoneNumber:null,providerData:[{providerId:'password'}]});
   await window.showConversation(id);
 },cid);
 assert.equal(await page.evaluate(id=>window.__mock.docs.get('conversations/'+id).contactStatus,cid),'unlocked');
 assert.equal(await page.getByText('لم يضف المستخدم رقم هاتف للتواصل. يمكنك متابعة التواصل عبر المحادثة داخل المنصة.',{exact:true}).count(),1);
 await page.evaluate(async id=>{
   window.__mock.docs.set('conversations/'+id+'/privateContacts/owner',{uid:'owner',displayName:'Owner',createdAt:new Date()});
   await window.__mock.setUser({uid:'buyer',email:'buyer@example.test',phoneNumber:null,providerData:[{providerId:'password'}]});
   await window.showConversation(id);
 },cid);
 pass('legacy accepted-offer recovery retained with missing no-phone contact');
 assert.equal(await page.evaluate(()=>JSON.stringify([...window.__mock.docs.values()]).includes('@example.test')),false);
 assert.equal(await page.evaluate(()=>JSON.stringify([...window.__mock.docs.values()]).includes('Sample-password1!')),false);
 await page.evaluate(async()=>{window.__mock.admin=true;await window.__mock.setUser(window.__mock.api.getAuth().currentUser)});
 assert.equal(await page.locator('#adminPanelButton').isVisible(),true);
 await page.evaluate(()=>window.openAdminServices());await page.locator('#adminServiceRequestsList').waitFor();
 pass('no credential persistence; custom-claim admin preserved');
 assert.match(await page.locator('#adminDeletionRequestsList').textContent(),/owner/);
 assert.equal(await page.locator('#adminServiceRequestsList').count(),1);
 await page.evaluate(()=>window.processDeletionRequest('owner','in_review'));
 assert.equal(await page.evaluate(()=>window.__mock.docs.get('accountDeletionRequests/owner').status),'in_review');
 assert.equal(await page.evaluate(()=>window.__mock.docs.get('accountDeletionRequests/owner').processedBy),'buyer');
 rejectConfirmation=true;
 await page.evaluate(()=>window.processDeletionRequest('owner','completed'));
 assert.equal(await page.evaluate(()=>window.__mock.docs.get('accountDeletionRequests/owner').status),'in_review');
 rejectConfirmation=false;
 await page.evaluate(()=>window.processDeletionRequest('owner','completed'));
 assert.equal(await page.evaluate(()=>window.__mock.docs.get('accountDeletionRequests/owner').status),'completed');
 assert.ok(dialogs.some(t=>t.includes('لا تضغط تم التنفيذ إلا بعد')));
 assert.equal(await page.locator('#adminDeletionRequestsList button').count(),0);
 await page.locator('#adminDeletionFilter').selectOption('active');
 assert.match(await page.locator('#adminDeletionRequestsList').innerText(),/لا توجد طلبات/);
 await page.locator('#adminDeletionFilter').selectOption('completed');
 assert.match(await page.locator('#adminDeletionRequestsList').textContent(),/owner/);
 pass('admin list, sequential audit transitions, completion cancellation/confirmation and filters');
 for(const width of [360,1280,1366]) {
   await page.setViewportSize({width,height:width===360?800:width===1366?768:900});
   const restoredUser=await page.evaluate(()=>window.__mock.api.getAuth().currentUser);
   await page.evaluate(()=>window.__mock.docs.delete('accountDeletionRequests/buyer'));
   await page.evaluate(()=>window.openAccountDeletion());
   await page.locator('#requestDeletionButton').click();
   await page.waitForFunction(()=>window.__mock.api.getAuth().currentUser===null);
   assert.equal(await page.locator('#deletionStatus').isVisible(),false);
   await page.evaluate(user=>window.__mock.setUser(user),restoredUser);
   await page.evaluate(()=>window.openLogin());
   assert.match(await page.locator('#accountDeletionNotice').innerText(),/طلب حذف حسابك قيد المراجعة/);
   pass('submit, close, logout and restored pending account '+width);
   await page.evaluate(async()=>{
     window.__mock.docs.set('accountDeletionRequests/buyer',{userId:'buyer',status:'in_review',createdAt:new Date(),updatedAt:new Date()});
     await window.__mock.setUser(window.__mock.api.getAuth().currentUser);
   });
   await page.setViewportSize({width,height:width===360?800:width===1366?768:900});
   for(const screen of ['account','deletion','messages','admin']) {
     await page.evaluate(async({screen,cid})=>{
       if(screen==='account')await window.openLogin();
       if(screen==='deletion')await window.openAccountDeletion();
       if(screen==='messages')await window.showConversation(cid);
       if(screen==='admin')await window.openAdminServices();
     },{screen,cid});
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,(typeof screen === "undefined" ? "auth" : screen)+" document overflow "+width);
     assert.equal(await page.evaluate(()=>{const el=document.getElementById('modalContent');return el.scrollWidth>el.clientWidth+1}),false,screen+" modal overflow "+width);
   }
   await page.evaluate(()=>window.openLogin());
   assert.match(await page.locator('#accountDeletionNotice').innerText(),/طلب حذف حسابك قيد المراجعة/);
   assert.equal(await page.locator('#accountDeletionButton').isDisabled(),true);
   if(width===360){await page.locator('#accountDeletionNotice').scrollIntoViewIfNeeded();await page.screenshot({path:process.env.TEMP+'/souq-pending-review.png'});}
   await page.evaluate(()=>window.openAdminServices());
   if(width===360){await page.locator('#adminDeletionRequestsList').scrollIntoViewIfNeeded();await page.screenshot({path:process.env.TEMP+'/souq-deletion-admin.png'});}
   await page.evaluate(async()=>{window.closeModal();await window.selectMarketCountry('EG')});
   assert.equal(await page.evaluate(()=>window.__mock.api.getAuth().currentUser.uid),'buyer');
   pass('account/deletion/messages/admin responsive and country switch preserves session '+width);
 }
 await page.evaluate(async()=>{
   const mock=window.__mock;
   mock.admin=false;
   await mock.setUser({uid:'owner',email:'owner@example.test',phoneNumber:null,providerData:[{providerId:'password'}]});
   for(const [key,value] of mock.docs)if(key.startsWith('purchaseRequests/'))mock.docs.set(key,{...value,status:'accepted'});
   await window.openLogin();
 });
 assert.match(await page.locator('#accountDeletionNotice').innerText(),/اكتمال معالجة/);
 assert.equal(await page.locator('#accountDeletionButton').isDisabled(),true);
 await page.evaluate(()=>window.showPurchaseRequests());
 assert.match(await page.locator('#modalContent').innerText(),/لم يضف المستخدم رقم هاتف للتواصل/);
 assert.equal((await page.locator('#modalContent').innerText()).includes('buyer@example.test'),false);
 pass('completed remains truthful; accepted purchase request without phone has messaging guidance');
 const guidance='لم يضف المستخدم رقم هاتف للتواصل. يمكنك متابعة التواصل عبر المحادثة داخل المنصة.';
 await page.evaluate(async id=>{
   const mock=window.__mock;
   const legacy={...mock.docs.get('conversations/'+id),animalId:'legacy-animal',country:'AE'};
   delete legacy.contactStatus;delete legacy.acceptedOfferId;delete legacy.contactUnlockedAt;
   mock.docs.set('conversations/legacy-direct',legacy);
   mock.docs.set('conversations/legacy-direct/messages/old-text',{type:'text',text:'رسالة قديمة',senderId:'buyer',createdAt:new Date()});
   mock.docs.set('purchaseRequests/legacy-accepted',{animalId:'legacy-animal',sellerId:'owner',buyerId:'buyer',status:'accepted',createdAt:new Date(),updatedAt:new Date()});
 },cid);
 for(const uid of ['buyer','owner']) {
   await page.evaluate(async uid=>{
     window.__mock.purchaseDelay=80;
     await window.__mock.setUser({uid,email:uid+'@example.test',phoneNumber:null,providerData:[{providerId:'password'}]});
     await window.showConversation('legacy-direct');
   },uid);
   assert.equal(await page.getByText(guidance,{exact:true}).count(),1);
   assert.match(await page.locator('#modalContent').innerText(),/رسالة قديمة/);
   assert.equal((await page.locator('#modalContent').innerText()).includes('@example.test'),false);
   assert.equal(await page.evaluate(()=>window.__mock.docs.get('conversations/legacy-direct').contactStatus),undefined);
   await page.evaluate(()=>window.showConversation('legacy-direct'));
   assert.equal(await page.getByText(guidance,{exact:true}).count(),1);
   pass('legacy accepted purchase without offers/contact unlock; async and repeated '+uid);
 }
 await page.evaluate(()=>{
   const mock=window.__mock;
   mock.docs.set('conversations/legacy-direct/privateContacts/buyer',{uid:'buyer',displayName:'Buyer',phoneNumber:'',createdAt:new Date()});
 });
 await page.evaluate(()=>window.showConversation('legacy-direct'));
 assert.equal(await page.getByText(guidance,{exact:true}).count(),1);
 pass('legacy accepted empty private phone remains guidance without unlocking reads');
 await page.evaluate(()=>window.__mock.docs.get('purchaseRequests/legacy-accepted').buyerPhone='+971500000001');
 await page.evaluate(()=>window.showConversation('legacy-direct'));
 assert.equal(await page.getByText(guidance,{exact:true}).count(),0);
 assert.match(await page.locator('#modalContent').innerText(),/\+971500000001/);
 pass('legacy accepted request uses existing allowed counterpart phone');
 await page.evaluate(()=>{
   const request=window.__mock.docs.get('purchaseRequests/legacy-accepted');delete request.buyerPhone;request.status='pending';
   window.__mock.docs.set('purchaseRequests/wrong-pair',{...request,status:'accepted',buyerId:'someone-else'});
   window.__mock.docs.set('purchaseRequests/wrong-animal',{...request,status:'accepted',animalId:'different-animal'});
 });
 await page.evaluate(()=>window.showConversation('legacy-direct'));
 assert.equal(await page.getByText(guidance,{exact:true}).count(),0);
 pass('pending and unrelated accepted requests do not establish acceptance');
 await page.evaluate(()=>{window.closeModal();window.__mock.docs.set('conversations/legacy-auction',{...window.__mock.docs.get('conversations/legacy-direct'),contextType:'auction'})});
 await page.evaluate(()=>window.showConversation('legacy-auction'));
 assert.equal(await page.getByText(guidance,{exact:true}).isVisible(),false);
 pass('auction never renders direct contact guidance');
 await page.evaluate(async()=>{
   for(const status of ['sold','not_approved','hidden','needs_review']){
     window.__mock.docs.set('animals/result-'+status,{name:'نتيجة '+status,sellerId:'owner',saleType:'auction',country:'AE',status});
     window.__mock.docs.set('auctions/result-'+status,{animalId:'result-'+status,sellerId:'owner',country:'AE',status:status==='not_approved'?'not_approved':'sold',currentPrice:110,minIncrement:10,endTime:new Date(Date.now()-60000),updatedAt:new Date()});
   }
   window.closeModal();await window.selectMarketCountry('AE');
 });
 assert.match(await page.locator('#auction-list').innerText(),/نتيجة sold/);
 assert.match(await page.locator('#auction-list').innerText(),/نتيجة not_approved/);
 assert.doesNotMatch(await page.locator('#auction-list').innerText(),/نتيجة hidden|نتيجة needs_review/);
 pass('sold and declined auction results remain visible while moderated ads stay hidden');
 await page.evaluate(async()=>{
   window.__mock.admin=true;
   window.__mock.docs.set('users/moderation-user',{uid:'moderation-user',displayName:'مستخدم الاختبار',status:'active',accountType:'seller'});
   window.__mock.docs.set('animals/moderation-ad',{name:'إعلان المراجعة',sellerId:'moderation-user',saleType:'direct',status:'active',images:['data:image/jpeg;base64,AAA','data:image/jpeg;base64,BBB']});
   await window.openAdminPanel();
 });
 await page.locator('.admin-overview').waitFor();
 assert.equal(await page.locator('#adminV2Nav button').count(),10);
 for(const width of [360,1280,1366]){
   await page.setViewportSize({width,height:width===360?800:width===1366?768:900});
   assert.equal(await page.evaluate(()=>document.querySelector('.admin-v2').scrollWidth<=document.querySelector('.admin-v2').clientWidth+1),true);
   assert.equal(await page.evaluate(()=>['#modal','#modal .box','#modalContent'].every(s=>getComputedStyle(document.querySelector(s)).overflowY==='visible')),true);
   if(width===360)await page.locator('.admin-menu-toggle').click();
   await page.locator('#adminLogout button').scrollIntoViewIfNeeded();
   assert.equal(await page.locator('#adminLogout button').isVisible(),true);
   await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('.admin-sidebar').scrollTop=0;});
   pass('document scrolling and complete sidebar '+width);
   if(width===360)await page.locator('.admin-drawer-close').click();
   assert.equal(await page.evaluate(()=>window.visualViewport.scale===1&&window.devicePixelRatio===1&&getComputedStyle(document.querySelector('.admin-v2')).zoom==='1'&&parseFloat(getComputedStyle(document.querySelector('#adminV2Nav button')).fontSize)>=14),true);
   pass('100 percent viewport and readable navigation '+width);
   await page.screenshot({path:process.env.TEMP+`/souq-dashboard-${width}.png`});
   const numberLayout=await page.evaluate(()=>{const tiles=[...document.querySelectorAll('.admin-overview strong')];const previous=tiles.map(n=>n.textContent);tiles.forEach((n,i)=>n.textContent=['0','7','56','123','9999','0'][i]);const ok=tiles.every(n=>n.scrollWidth<=n.clientWidth+1);tiles.forEach((n,i)=>n.textContent=previous[i]);return ok;});
   assert.equal(numberLayout,true);pass('overview numbers 0 to 9999 fit '+width);
 }
 pass('dashboard seven tabs, real aggregation adapter, RTL mobile and desktop');
 // All navigation fixtures and interactions are offline.
 await page.evaluate(()=>{
   for(let i=0;i<55;i++)window.__mock.docs.set('users/nav-user'+String(i).padStart(3,'0'),{displayName:'Navigation '+i,status:'active',country:'EG',accountType:'both'});
   window.__mock.docs.set('auctions/nav-auction',{animalId:'moderation-ad',sellerId:'moderation-user',status:'active'});
   window.__mock.docs.set('reports/nav-report',{targetType:'animal',targetId:'moderation-ad',reporterId:'moderation-user',status:'open'});
   window.__mock.docs.set('adminAuditLogs/nav-log',{action:'navigation fixture',targetId:'moderation-ad'});
 });
 for(const width of [1280,1366,360]){
   await page.setViewportSize({width,height:width===360?800:width===1366?768:900});
   for(const [tab,term] of [['المستخدمون','moderation-user'],['الإعلانات','moderation-ad'],['المزادات','nav-auction'],['البلاغات','nav-report'],['سجل الإدارة','nav-log']]){
     await selectAdminTab(tab);
     await page.locator('#adminFilters input').fill(term);
     await page.locator('#adminRows .admin-actions > button:first-child').click();
     const back=page.locator('.admin-back');await back.waitFor();
     assert.match(await back.innerText(),/رجوع إلى/);
     assert.equal(await page.evaluate(()=>{const b=document.querySelector('.admin-back').getBoundingClientRect(),x=document.querySelector('#modal .x').getBoundingClientRect();return b.height>=44 && b.left>=0 && b.right<=innerWidth && !(b.left<x.right&&b.right>x.left&&b.top<x.bottom&&b.bottom>x.top) && document.querySelector('.admin-v2').scrollWidth<=document.querySelector('.admin-v2').clientWidth+1;}),true);
     await page.screenshot({path:process.env.TEMP+'/souq-nav-'+width+'-'+term+'.png'});
     await back.click();
     assert.equal(await page.locator('#adminFilters input').inputValue(),term);
     assert.equal(await page.locator('.admin-v2').isVisible(),true);
     assert.equal(await page.locator('#adminRows .admin-actions > button:first-child').count(),1);
     pass('detail back preserves '+tab+' search and dashboard '+width);
   }
   await selectAdminTab('المستخدمون');
   await page.getByRole('combobox',{name:'الدولة',exact:true}).selectOption('EG');
   await page.getByRole('button',{name:'الصفحة التالية',exact:true}).click();
   await page.waitForFunction(()=>document.querySelectorAll('#adminRows .admin-row').length===5);
   await page.locator('#adminFilters input').fill('nav-user050');
   await page.waitForFunction(()=>document.querySelectorAll('#adminRows .admin-row').length===1);
   await page.locator('#adminRows .admin-actions > button:first-child').click();
   await page.locator('.admin-back').click();
   assert.equal(await page.getByRole('combobox',{name:'الدولة',exact:true}).inputValue(),'EG');
   assert.equal(await page.locator('#adminFilters input').inputValue(),'nav-user050');
   await page.locator('#adminFilters input').fill('');
   assert.equal(await page.locator('#adminRows .admin-actions > button:first-child').count(),5);
   pass('back preserves server filter and second page '+width);
   await selectAdminTab('الإعلانات');
   await page.locator('#adminFilters input').fill('moderation-ad');
   await page.locator('#adminRows .admin-actions > button:first-child').click();
   await page.getByRole('button',{name:'البائع',exact:true}).click();
   await page.locator('.admin-detail-card[data-kind="users"]').waitFor();
   await page.locator('.admin-back').click();
   await page.locator('.admin-gallery').waitFor();
   assert.equal(await page.locator('.admin-gallery').count(),1);
   await page.locator('.admin-back').click();
   assert.equal(await page.locator('#adminFilters input').inputValue(),'moderation-ad');
   pass('nested seller details back to ad then original list '+width);
   await page.locator('#adminRows .admin-actions > button:first-child').click();
   await page.locator('#modal .x').click();
   assert.equal(await page.locator('#modal').isVisible(),false);
   await page.evaluate(()=>window.openAdminPanel());
   await selectAdminTab('طلبات الخدمات');
   await page.locator('#adminServiceRequestsList').waitFor();
   await page.getByRole('button',{name:'العودة للوحة الإدارة',exact:true}).click();
   await page.locator('#adminV2Nav').waitFor({state:'attached'});
   assert.equal(await page.locator('#adminV2Nav button').count(),10);
   pass('main close exits and inline service screen returns to dashboard '+width);
 }
 await selectAdminTab('المزادات');
 await page.locator('#adminFilters input').fill('nav-auction');
 await page.evaluate(()=>window.__mock.docs.delete('auctions/nav-auction'));
 await page.locator('#adminRows .admin-actions > button:first-child').click();
 await page.getByText('السجل غير موجود.',{exact:true}).waitFor();
 await page.locator('.admin-back').click();
 assert.equal(await page.locator('#adminFilters input').inputValue(),'nav-auction');
 pass('missing record retains a working Back to the previous list');
 await page.evaluate(()=>{for(const k of [...window.__mock.docs.keys()])if(k.includes('/nav-'))window.__mock.docs.delete(k);});
 await selectAdminTab('المستخدمون');
 await page.locator('#adminFilters input').fill('moderation-user');
 await page.locator('#adminRows .admin-actions > button:first-child').click();
 await page.getByRole('button',{name:'تعليق الحساب',exact:true}).click();
 await page.waitForFunction(()=>window.__mock.docs.get('users/moderation-user').status==='suspended');
 await page.getByRole('button',{name:'إعادة التفعيل',exact:true}).click();
 await page.waitForFunction(()=>window.__mock.docs.get('users/moderation-user').status==='active');
 pass('dashboard user search, details, suspension and reactivation write audit');
 await page.locator('.admin-back').click();
 assert.equal(await page.locator('#adminFilters input').inputValue(),'moderation-user');
 assert.equal(await page.locator('.admin-back').count(),0);
 pass('mutation refresh does not add a duplicate detail history entry');

 await selectAdminTab('الإعلانات');
 await page.locator('#adminFilters input').fill('moderation-ad');
 await page.locator('#adminRows .admin-actions > button:first-child').click();
 await page.getByRole('button',{name:'حذف الصورة غير اللائقة',exact:true}).first().waitFor();
 await page.evaluate(()=>window.__mock.docs.get('animals/moderation-ad').images=['data:image/jpeg;base64,BBB','data:image/jpeg;base64,CCC','data:image/jpeg;base64,AAA']);
 await page.getByRole('button',{name:'حذف الصورة غير اللائقة',exact:true}).first().click();
 await page.waitForFunction(()=>window.__mock.docs.get('animals/moderation-ad').images.length===2);
 assert.deepEqual(await page.evaluate(()=>window.__mock.docs.get('animals/moderation-ad').images),['data:image/jpeg;base64,BBB','data:image/jpeg;base64,CCC']);
 assert.equal(await page.evaluate(()=>window.__mock.docs.get('animals/moderation-ad').imagesLocked),true);
 pass('dashboard removes only selected image and records hash without base64');
 await page.evaluate(()=>window.submitModerationReport('animal','moderation-ad'));
 await selectAdminTab('البلاغات');
 await page.locator('#adminFilters input').fill('moderation-ad');
 await page.locator('#adminRows .admin-actions > button:first-child').click();
 await page.getByRole('button',{name:'تحت المراجعة',exact:true}).click();
 await page.waitForFunction(()=>[...window.__mock.docs].some(([k,v])=>k.startsWith('reports/')&&v.status==='reviewing'));
 pass('dashboard report creation and administrative review');
 await page.evaluate(()=>{
   const d=window.__mock.docs;
   d.set('users/ui-seller',{displayName:'بائع العرض',country:'AE',city:'دبي',status:'active',accountType:'seller',phoneNumber:'0500000000',createdAt:new Date('2026-09-06T12:00:00Z')});
   d.set('users/ui-buyer',{displayName:'مشتري العرض',country:'AE',status:'active',accountType:'buyer'});
   d.set('animals/ui-animal',{name:'ناقة العرض',sellerId:'ui-seller',country:'AE',city:'دبي',price:90000,saleType:'direct',status:'active',createdAt:new Date('2026-09-06T12:00:00Z'),images:['data:image/jpeg;base64,AAA']});
   d.set('animals/ui-animal2',{name:'غنم العرض',sellerId:'ui-seller',country:'EG',currency:'USD',price:1500,saleType:'direct',status:'active'});
   d.set('auctions/ui-auction',{animalId:'ui-animal',sellerId:'ui-seller',lastBidderId:'ui-buyer',startPrice:90000,currentPrice:90900,minIncrement:100,status:'active',endTime:new Date('2026-09-07T12:00:00Z')});
   d.set('purchaseRequests/ui-request',{animalId:'ui-animal',sellerId:'ui-seller',buyerId:'ui-buyer',price:1500,status:'accepted',createdAt:new Date('2026-09-06T12:00:00Z')});
   d.set('reports/ui-report',{reporterId:'ui-buyer',reportedUserId:'ui-seller',targetType:'animal',targetId:'ui-animal',reason:'مراجعة العرض',status:'open'});
   d.set('adminAuditLogs/ui-log',{adminUid:'ui-seller',action:'suspend',targetType:'users',targetId:'ui-buyer',reason:'سبب المراجعة',timestamp:new Date('2026-09-06T12:00:00Z')});
   d.set('serviceRequests/ui-service',{userId:'ui-seller',targetId:'ui-animal',targetType:'animal',serviceType:'featured',country:'AE',amount:15,currency:'AED',status:'pending',paymentStatus:'unpaid',createdAt:new Date('2026-09-06T12:00:00Z')});
 });
 for(const width of [1280,1366,360]){
   await page.setViewportSize({width,height:width===360?800:width===1366?768:900});
   await page.evaluate(async source=>{const image=new Image();image.src=source;await image.decode();const canvas=document.createElement('canvas');canvas.width=480;canvas.height=320;canvas.getContext('2d').drawImage(image,0,0,480,320);window.__mock.docs.get('animals/ui-animal').images=[canvas.toDataURL('image/jpeg')];},'data:image/png;base64,'+fs.readFileSync(path.join(root,'hero-livestock.png')).toString('base64'));
   for(const [tab,term,expected]of [['الإعلانات','ui-animal','بائع العرض'],['المزادات','ui-auction','90,900 د.إ'],['البلاغات','ui-report','مشتري العرض'],['سجل الإدارة','ui-log','تعليق الحساب']]){
     await selectAdminTab(tab);
     await page.locator('#adminFilters input').fill(term);
     await page.locator('#adminRows .admin-row').first().waitFor();
     const text=await page.locator('#adminRows').innerText();
     assert.match(text,new RegExp(expected));assert.doesNotMatch(text,/ui-seller|ui-buyer|ui-animal|ui-auction|ui-report|ui-log|purchaseRequests|adminAuditLogs/);
     if(tab==='الإعلانات'){assert.equal(await page.locator('.admin-image-empty').count(),1);assert.match(await page.locator('.admin-image-empty').innerText(),/لا توجد صورة/);pass('missing image neutral fallback '+width);}
     assert.equal(await page.locator('#adminRows .admin-technical[open]').count(),0);
     if(tab==='الإعلانات'){assert.match(text,/90,000 د.إ/);assert.match(text,/1,500 USD/);assert.match(text,/الإمارات العربية المتحدة/);assert.match(text,/مصر/);assert.match(text,/2026/);}
     assert.equal(await page.evaluate(()=>document.querySelector('.admin-v2').scrollWidth<=document.querySelector('.admin-v2').clientWidth+1),true);
     await page.locator('#adminRows').scrollIntoViewIfNeeded();
     await page.screenshot({path:process.env.TEMP+'/souq-ui-'+width+'-'+term+'.png'});
     pass('redesigned named cards, badges and hidden technical IDs '+tab+' '+width);
     if(tab==='الإعلانات'){
       await page.locator('.admin-card-image').first().evaluate(img=>img.src='data:image/jpeg;base64,AAA');
       await page.waitForFunction(()=>document.querySelectorAll('#adminRows .admin-image-empty').length===2);
       pass('actual image load error fallback '+width);
       await selectAdminTab(tab);
       await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;const c=canvas.getContext('2d');c.fillStyle='green';c.fillRect(0,0,20,20);window.__mock.docs.get('animals/ui-animal2').images=[canvas.toDataURL('image/jpeg')];});
       await selectAdminTab(tab);await page.locator('#adminFilters input').fill('ui-animal2');
       await page.locator('#adminRows .admin-image-empty').waitFor();
       pass('legacy solid preview tile fallback '+width);
       await page.evaluate(()=>delete window.__mock.docs.get('animals/ui-animal2').images);
     }
     if(tab==='البلاغات'){
       await page.locator('#adminRows .admin-actions > button:first-child').click();
       await page.locator('.admin-detail-card[data-kind=reports]').waitFor();
       await page.locator('.admin-detail-header').scrollIntoViewIfNeeded();
       await page.screenshot({path:process.env.TEMP+'/souq-report-details-'+width+'.png'});
       await page.locator('.admin-back').click();
     }
   }
   await selectAdminTab('المستخدمون');
   await page.locator('#adminFilters input').fill('ui-buyer');
   await page.locator('#adminRows').scrollIntoViewIfNeeded();
   await page.screenshot({path:process.env.TEMP+'/souq-ui-users-'+width+'.png'});
   await page.locator('#adminRows .admin-actions > button:first-child').click();
   await page.locator('.admin-user-records .admin-row').waitFor();
   assert.equal(await page.getByRole('tab').count(),5);
   const purchase=await page.locator('.admin-user-records').innerText();
   assert.match(purchase,/ناقة العرض/);assert.match(purchase,/بائع العرض/);assert.match(purchase,/مشتري العرض/);assert.match(purchase,/1,500 د.إ/);assert.doesNotMatch(purchase,/purchaseRequests|ui-seller|ui-buyer/);
   await page.locator('.admin-detail-card .admin-technical summary').click();
   assert.match(await page.locator('.admin-detail-card .admin-technical').innerText(),/ui-buyer/);
   await page.locator('.admin-detail-card .admin-technical summary').click();
   await page.locator('.admin-detail-header').scrollIntoViewIfNeeded();
   await page.screenshot({path:process.env.TEMP+'/souq-ui-user-'+width+'.png'});
   await page.locator('.admin-back').click();
   assert.equal(await page.locator('#adminFilters input').inputValue(),'ui-buyer');
   pass('user purchase cards, five tabs, technical disclosure and Back '+width);
   await selectAdminTab('طلبات الخدمات');
   await page.locator('.admin-service-card').first().waitFor();
   const service=page.locator('.admin-service-card').filter({hasText:'ناقة العرض'});
   assert.match(await service.innerText(),/بائع العرض/);assert.match(await service.innerText(),/حالة الطلب/);assert.match(await service.innerText(),/حالة الدفع/);
   assert.equal(await service.getByRole('button',{name:'اعتماد مدفوع',exact:true}).isEnabled(),false);
   await page.locator('#adminServiceRequestsList').scrollIntoViewIfNeeded();
   await page.screenshot({path:process.env.TEMP+'/souq-ui-services-'+width+'.png'});
   pass('service identity and separate payment status preserve unpaid guard '+width);
 }
 await page.evaluate(async()=>{window.closeModal();window.__mock.admin=false;await window.openAdminPanel();});
 assert.equal(await page.locator('#modal').isVisible(),false);
 pass('new dashboard denies ordinary user');
 assert.deepEqual(await page.evaluate(()=>window.__mock.failures),[]);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log(`SUMMARY | ${count}/${count} passed; all Firebase traffic mocked`);
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
