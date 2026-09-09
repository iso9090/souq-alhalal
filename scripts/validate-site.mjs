import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const files=fs.readdirSync(root).filter(name=>name.endsWith('.js'));
for(const file of files){const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});if(result.status!==0)throw Error(result.stderr);}
for(const name of fs.readdirSync(root).filter(name=>name.endsWith('.html'))){
  const html=fs.readFileSync(path.join(root,name),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  if(new Set(ids).size!==ids.length)throw Error('Duplicate id in '+name);
  for(const [,url]of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
    if(/^(https?:|mailto:|tel:|data:|blob:|javascript:void\(0\)$)/.test(url))continue;
    const file=url.split(/[?#]/)[0];if(file&&!fs.existsSync(path.join(root,file)))throw Error('Missing local asset '+file+' in '+name);
  }
}
console.log('PASS JavaScript syntax, HTML IDs and local asset references ('+files.length+' modules)');
