const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');let count=0;
const pass=name=>{count++;console.log('PASS | '+name);};
(async()=>{
 const {fixture,invoke}=await import(pathToFileURL(path.join(root,'functions/test/fixtures.mjs')));
 const {createSigner}=await import(pathToFileURL(path.join(root,'functions/src/upload.js')));
 const {v2:cloudinary}=require('../functions/node_modules/cloudinary');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();let enabled=false,mode='success',signCount=0,uploadCount=0,lastParams;const errors=[],outside=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/cloudinary/sign'){
    signCount++;const f=fixture();f.state.now=Math.floor(Date.now()/1000);
    const signer=createSigner(cloudinary,{cloudName:'local',apiKey:'fixture-public',apiSecret:'synthetic-local-only'});
    f.deps.sign=async params=>{lastParams=params;return signer(params);};
    const result=await invoke(f.handler,{authorization:route.request().headers().authorization,body:route.request().postDataJSON()});
    if(mode==='arbitrary-params'&&result.status===200)result.body.params={...result.body.params,folder:'not-allowed'};
    return route.fulfill({status:result.status,json:result.body});
   }
   if(url.hostname==='api.cloudinary.com'){
    uploadCount++;assert.equal(url.pathname,'/v1_1/local/image/upload');
    const publicId='souq-alhalal/commercial-ads/'+lastParams.public_id;
    const data={public_id:publicId,resource_type:'image',format:'jpg',width:1600,height:800,bytes:1024,secure_url:'https://res.cloudinary.com/local/image/upload/'+publicId+'.jpg'};
    if(mode==='wrong-id')data.public_id='other';if(mode==='wrong-dimensions')data.width=1;if(mode==='wrong-format')data.format='svg';if(mode==='wrong-resource')data.resource_type='raw';if(mode==='bad-url')data.secure_url='https://res.cloudinary.com/local/image/upload/other.jpg';
    return route.fulfill({json:data});
   }
   if(url.hostname!=='iso9090.github.io'){outside.push(url.origin);return route.abort();}
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><script type="module">import {uploadCommercialImage} from "/trusted-backend-client.js";window.upload=uploadCommercialImage;</script>'});
   let body=fs.readFileSync(path.join(root,url.pathname),'utf8');
   if(url.pathname==='/trusted-backend-client.js')body=body.replace("signingEndpoint:''","signingEndpoint:'https://iso9090.github.io/api/cloudinary/sign'").replace('TRUSTED_BACKEND_ENABLED = false','TRUSTED_BACKEND_ENABLED = '+enabled);
   return route.fulfill({contentType:'text/javascript',body});
  });
  const open=async()=>{await page.goto('https://iso9090.github.io/');await page.waitForFunction(()=>!!window.upload);};
  const run=()=>page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1600;c.height=800;c.getContext('2d').fillRect(0,0,1600,800);const b=await new Promise(resolve=>c.toBlob(resolve,'image/png'));try{return {url:await upload(new File([b],'ad.png',{type:'image/png'}),{getIdToken:async()=>'mock-owner'},'hero')};}catch(e){return {error:e.message};}});
  await open();assert.equal((await run()).error,'BACKEND_DISABLED');assert.equal(signCount+uploadCount,0);pass('disabled flag prevents network even with endpoint configured');
  enabled=true;await open();const result=await run();assert.ok(result.url.startsWith('https://res.cloudinary.com/local/image/upload/'));assert.equal(signCount,1);assert.equal(uploadCount,1);pass('actual backend policy and SDK signing integrate with compressed browser upload');
  for(mode of ['wrong-id','wrong-dimensions','wrong-format','wrong-resource','bad-url']){assert.ok((await run()).error);pass('reject '+mode+' in provider result');}
  mode='arbitrary-params';const before=uploadCount;assert.ok((await run()).error);assert.equal(uploadCount,before);pass('unexpected authorization parameters never reach provider');
  assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);pass('zero critical JS errors and no live network');
  console.log(`SUMMARY | ${count}/${count} passed`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
