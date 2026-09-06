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
if(relative==='index.html'){let html=fs.readFileSync(file,'utf8');html=html.replace('<head>','<head><script>('+installMock.toString()+')();window.addEventListener("load",()=>('+seedMock.toString()+')());</script>');html=html.replace('<body>','<body><div style="background:#fff3cd;padding:10px;text-align:center">معاينة محلية — جميع الحسابات والعمليات محاكاة؛ لا اتصال بـFirebase</div>');return res.end(html)}
if(relative.endsWith('.js'))return res.end(fs.readFileSync(file,'utf8').replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[^"']+/g,'/__mock-sdk.js'));
res.end(fs.readFileSync(file));
}).listen(4174,'127.0.0.1',()=>console.log('MOCK ONLY http://127.0.0.1:4174/'));
