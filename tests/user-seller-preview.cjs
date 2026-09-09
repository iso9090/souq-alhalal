// Local-only read-only file server. Firebase is replaced by in-memory test APIs.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {installMock,seedMock}=require('./user-seller-fixture.cjs');
const root=path.resolve(__dirname,'..');
const names=[...fs.readFileSync(path.join(root,'app.js'),'utf8').matchAll(/import\s*\{([^}]+)\}/g)].flatMap(m=>m[1].split(',').map(s=>s.trim()));
http.createServer((req,res)=>{
const url=new URL(req.url,'http://127.0.0.1');const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; font-src 'self'; frame-src 'none'; form-action 'none'");
if(relative==='__mock-sdk.js'){res.setHeader('Content-Type','text/javascript');return res.end(names.map(n=>`export const ${n}=window.__mock.api.${n};`).join('\n'))}
if(!/^[a-zA-Z0-9_.-]+\.(html|js|css|png|jpg|svg)$/.test(relative)){res.writeHead(404);return res.end()}
const file=path.join(root,relative);if(!fs.existsSync(file)){res.writeHead(404);return res.end()}
res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[path.extname(file)]);
if(relative==='index.html'){
  let html=fs.readFileSync(file,'utf8');
  const preview=async function(){
    await window.__seedPreview();
    const image=new Image();image.src='hero-livestock.png';await image.decode();
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=Math.round(image.height*900/image.width);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const photo=canvas.toDataURL('image/jpeg',.8);
    for(const [key,animal]of window.__mock.docs)if(key.startsWith('animals/'))animal.images=[photo,photo,photo];
    await window.selectMarketCountry('AE');
  };
  html=html.replace('<head>','<head><script>('+installMock.toString()+')();window.__seedPreview='+seedMock.toString()+';window.addEventListener("load",'+preview.toString()+');</script>');
  html=html.replace('<body class="marketplace-v2">','<body class="marketplace-v2"><div style="background:#fff3cd;padding:10px;text-align:center;font-size:13px">معاينة محلية — بيانات اختبارية وصورة المشروع الأصلية؛ لا اتصال بالإنتاج <button onclick="window.__mock.admin=false;window.__mock.setUser(null);closeModal()">كزائر</button> <button onclick="window.__mock.admin=true;window.__mock.setUser({uid:\'owner\',email:\'preview@example.test\'}).then(()=>openAdminPanel())">كمالك</button></div>');
  return res.end(html);
}
if(relative.endsWith('.js'))return res.end(fs.readFileSync(file,'utf8').replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[^"']+/g,'/__mock-sdk.js'));
res.end(fs.readFileSync(file));
}).listen(4174,'127.0.0.1',()=>console.log('MOCK ONLY http://127.0.0.1:4174/'));
