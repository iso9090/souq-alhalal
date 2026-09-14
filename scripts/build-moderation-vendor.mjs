import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const root=path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const req=createRequire(path.join(root,'package.json'));
const base=path.join(root,'node_modules');
const out=path.join(root,'melkak/vendor/moderation');fs.mkdirSync(path.join(out,'model'),{recursive:true});
for(const [name,version] of [['nsfwjs','4.4.0'],['@tensorflow/tfjs','4.22.0']])if(JSON.parse(fs.readFileSync(path.join(base,name,'package.json'))).version!==version)throw Error('Unreviewed dependency version');
function unpack(name){const context={module:{exports:{}},exports:{}};vm.runInNewContext(fs.readFileSync(path.join(base,'nsfwjs/dist/models/mobilenet_v2',name),'utf8'),context,{timeout:10000});return context.module.exports;}
const model=unpack('model.min.js'),weights=unpack('group1-shard1of1.min.js');
if(typeof weights!=='string'||!model.weightsManifest)throw Error('Unexpected model package');
model.weightsManifest[0].paths=['weights.bin'];
fs.writeFileSync(path.join(out,'model/model.json'),JSON.stringify(model));
fs.writeFileSync(path.join(out,'model/weights.bin'),Buffer.from(weights,'base64'));
const source=`import * as tf from '@tensorflow/tfjs';import {load} from 'nsfwjs/core';
export async function loadLocalModel(url){tf.enableProdMode();await tf.ready();return load(url,{size:224});}`;
await req('esbuild').build({stdin:{contents:source,resolveDir:root,sourcefile:'moderation-runtime.js'},bundle:true,format:'esm',platform:'browser',minify:true,legalComments:'inline',outfile:path.join(out,'runtime.js')});
// Two upstream diagnostic template strings end in a literal space. Escape it,
// preserving the exact runtime string while keeping git whitespace checks clean.
const runtimeFile=path.join(out,'runtime.js'),runtime=fs.readFileSync(runtimeFile,'utf8');
if((runtime.match(/\. \n/g)||[]).length!==2)throw Error('Review generated diagnostic formatting');
fs.writeFileSync(runtimeFile,runtime.replace(/\. \n/g,'.\\x20\n'));
fs.copyFileSync(path.join(base,'nsfwjs/LICENSE'),path.join(out,'LICENSE-NSFWJS.txt'));
// TFJS npm omits LICENSE; checked-in Apache license comes from the exact upstream tag.
if(!fs.readFileSync(path.join(out,'LICENSE-TENSORFLOW.txt'),'utf8').includes('Apache License'))throw Error('Missing TFJS license');
const files=['runtime.js','model/model.json','model/weights.bin','LICENSE-NSFWJS.txt','LICENSE-TENSORFLOW.txt'];
fs.writeFileSync(path.join(out,'provenance.json'),JSON.stringify({nsfwjs:'4.4.0',tensorflow:'4.22.0',model:'MobileNetV2 224',source:'https://github.com/infinitered/nsfwjs',packageSource:'https://registry.npmjs.org/nsfwjs/-/nsfwjs-4.4.0.tgz',files:Object.fromEntries(files.map(f=>{const bytes=fs.readFileSync(path.join(out,f));return [f,{bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}]}))},null,2));
console.log('Locally hosted NSFWJS/TFJS runtime and model prepared with hashes and licenses.');
