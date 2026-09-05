const fs=require('fs');
const path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,channel:"msedge"});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let signedIn=false,readFail=false,foreign=0;
 const exports=[...fs.readFileSync(root+'/app.js','utf8').matchAll(/import\s*\{([^}]+)\}/g)].flatMap(m=>m[1].split(',').map(s=>s.trim()));
 await page.route('**/*', async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='www.gstatic.com'){
   let code=exports.map(n=>`export const ${n}= (...args)=>{throw new Error('Unexpected Firebase call: ${n}')};`).join('\n');
   code=code.replace(/export const initializeApp=.*?;/,'export const initializeApp=()=>({});');
   code=code.replace(/export const getFirestore=.*?;/,'export const getFirestore=()=>({});');
   code=code.replace(/export const getAuth=.*?;/,`export const getAuth=()=>({currentUser:${signedIn?'{uid:"owner"}':'null'}});`);
   code=code.replace(/export const onAuthStateChanged=.*?;/,'export const onAuthStateChanged=(auth,cb)=>{queueMicrotask(()=>cb(auth.currentUser));return ()=>{}};');
   code=code.replace(/export const collection=.*?;/,'export const collection=(db,name)=>name;');
   code=code.replace(/export const where=.*?;/,'export const where=(...args)=>args;');
   code=code.replace(/export const query=.*?;/,'export const query=(...args)=>args;');
   const data=[{status:'pending',paymentStatus:'unpaid',serviceType:'featured',country:'AE',currency:'AED',amount:15,targetId:'<img src=x onerror=alert(1)>'},{status:'pending',serviceType:'bump',country:'EG',currency:'EGP',amount:100},{status:'approved',paymentStatus:'unpaid'},{status:'pending',paymentStatus:'paid'},{status:'pending',paymentStatus:'refunded'},{status:'pending',paymentStatus:null}];
   code=code.replace(/export const getDocs=.*?;/,`export const getDocs=async(q)=>{if(JSON.stringify(q)!==JSON.stringify(['serviceRequests',['userId','==','owner']]))throw new Error('Unexpected query');${readFail?"throw new Error('offline')":'return {docs:'+JSON.stringify(data)+'.map(data=>({data:()=>data}))}'};};`);
   await route.fulfill({contentType:'text/javascript',body:code});return;
  }
  if(url.hostname!=='launch.test'){foreign++;await route.abort();return;}
  const file=path.join(root,decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(path.normalize(root))||!fs.existsSync(file)){await route.fulfill({status:404,body:''});return;}
  const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg'};
  await route.fulfill({contentType:types[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
 });
 for(const width of [360,1280]){
  await page.setViewportSize({width,height:900});
  for(const file of ['about','privacy','terms','refund-policy','delete-account','payment-demo']){
   await page.goto('http://launch.test/'+file+'.html');
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Overflow '+file+' '+width);
   if(file==='payment-demo')await page.getByText('يرجى تسجيل الدخول من سوق الحلال الإلكتروني أولًا.').waitFor();
   console.log('PASS layout',file,width);
  }
 }
 signedIn=true;
 await page.goto('http://launch.test/payment-demo.html');
 await page.getByRole('button',{name:'محاكاة الدفع'}).first().waitFor();
 if(await page.locator('.demo-request').count()!==2)throw new Error('wrong request filter');
 if(await page.locator('.demo-request img').count())throw new Error('XSS');
 await page.getByRole('button',{name:'محاكاة الدفع'}).first().click();
 await page.getByText('نجحت محاكاة واجهة الدفع.',{exact:false}).waitFor();
 if(await page.getByText('غير مدفوع',{exact:true}).count()!==2)throw new Error('payment changed');
 await page.screenshot({path:path.join(require('os').tmpdir(),'souq-launch-payment.png'),fullPage:true});
 console.log('PASS authenticated filtering, XSS, simulation preserves unpaid');
 readFail=true;await page.reload();await page.getByText('تعذر تحميل الطلبات.',{exact:false}).waitFor();console.log('PASS network error');
 signedIn=false;readFail=false;await page.goto('http://launch.test/index.html');await page.getByText('اختر دولة السوق',{exact:false}).first().waitFor({timeout:5000}).catch(()=>{});console.log('PASS main page offline load');
 if(errors.length)throw new Error(errors.join('\n'));
 if(foreign)throw new Error('Unexpected external requests '+foreign);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
