// Explicit mock-only HTTP runner. Never imports ADC, Admin SDK adapters or real secrets.
import http from 'node:http';
import {fixture} from './fixtures.mjs';
export function startMockServer(port=8770){
 const {handler}=fixture();
 const server=http.createServer(async(req,res)=>{
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>4096){res.writeHead(413);res.end();return;}chunks.push(chunk);}
  const rawBody=Buffer.concat(chunks);let body;try{body=rawBody.length?JSON.parse(rawBody):{};}catch{res.writeHead(400);res.end();return;}
  const request={path:new URL(req.url,'http://localhost').pathname,method:req.method,body,rawBody,get:name=>req.headers[name.toLowerCase()]};
  const response={set:(k,v)=>{res.setHeader(k,v);return response;},status:s=>{res.statusCode=s;return response;},json:b=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(b));},send:b=>res.end(b)};
  await handler(request,response);
 });
 return new Promise(resolve=>server.listen(port,'127.0.0.1',()=>resolve(server)));
}
if(process.argv[1]===new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'))await startMockServer();
