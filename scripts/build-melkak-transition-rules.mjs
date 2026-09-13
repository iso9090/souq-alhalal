import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// Preserve offsets while hiding comments and strings from structural inspection.
function structural(text){
 if(typeof text!=='string'||!text.trim())throw Error('Malformed empty Rules');
 const chars=text.split('');let i=0;
 while(i<text.length){
  if(text[i]==='"'||text[i]==="'"){
   const quote=text[i];chars[i++]=' ';let closed=false;
   while(i<text.length){const c=text[i];chars[i++]=' ';if(c==='\\'){if(i>=text.length)break;chars[i++]=' ';}else if(c===quote){closed=true;break;}}
   if(!closed)throw Error('Unclosed Rules string');
  }else if(text.startsWith('//',i)){
   while(i<text.length&&text[i]!=='\n')chars[i++]=' ';
  }else if(text.startsWith('/*',i)){
   chars[i++]=' ';chars[i++]=' ';while(i<text.length&&!text.startsWith('*/',i))chars[i++]=' ';
   if(i>=text.length)throw Error('Unclosed Rules comment');chars[i++]=' ';chars[i++]=' ';
  }else i++;
 }
 const masked=chars.join(''),stack=[],pairs={'}':'{',')':'(',']':'['};
 for(let j=0;j<masked.length;j++){const c=masked[j];if('{(['.includes(c))stack.push(c);else if('})]'.includes(c)&&stack.pop()!==pairs[c])throw Error('Malformed Rules delimiters');}
 if(stack.length)throw Error('Malformed unbalanced Rules');return masked;
}
function closeBrace(mask,start){let depth=0;for(let i=start;i<mask.length;i++){if(mask[i]==='{')depth++;else if(mask[i]==='}'&&--depth===0)return i;}throw Error('Malformed Rules block');}
function documentBlock(text){
 const mask=structural(text),matches=[...mask.matchAll(/\bmatch\s+\/databases\/\{database\}\/documents\s*\{/g)];
 if(matches.length!==1)throw Error('Malformed Rules: expected one database documents match');
 const start=matches[0].index+matches[0][0].length-1;return {mask,start,end:closeBrace(mask,start)};
}
function topLevel(mask,index){let depth=0;for(let i=0;i<index;i++){if(mask[i]==='{')depth++;else if(mask[i]==='}')depth--;}return depth===0;}

export function composeTransitionRules(baseline,proposed){
 const base=documentBlock(baseline),proposal=documentBlock(proposed);
 if(/\bmatch\s+\/marketplaceListings\s*\//.test(base.mask))throw Error('Baseline already contains marketplaceListings');
 let body=proposed.slice(proposal.start+1,proposal.end),mask=structural(body);
 const removals=[];
 for(const match of mask.matchAll(/\bmatch\s+\/(users|adminAccess|adminSecurity)\/\{[A-Za-z_][A-Za-z_0-9]*\}\s*\{/g)){
  if(!topLevel(mask,match.index))throw Error('Malformed proposal: nested legacy support match');
  const start=match.index+match[0].length-1;removals.push([match.index,closeBrace(mask,start)+1]);
 }
 for(const [start,end]of removals.reverse())body=body.slice(0,start)+body.slice(end);
 mask=structural(body);
 if(!/\bmatch\s+\/marketplaceListings\s*\//.test(mask))throw Error('Malformed proposal: missing marketplaceListings');
 const names=new Map();
 for(const match of mask.matchAll(/\bfunction\s+([A-Za-z_][A-Za-z_0-9]*)\s*\(/g)){
  if(!topLevel(mask,match.index))throw Error('Malformed proposal: expected top-level functions');
  const name=match[1],renamed='mk'+name[0].toUpperCase()+name.slice(1);
  if(names.has(name)||[...names.values()].includes(renamed)||new RegExp('\\bfunction\\s+'+renamed+'\\s*\\(').test(base.mask))throw Error('Malformed proposal: function name collision');
  names.set(name,renamed);
 }
 const replacements=[];
 for(const match of mask.matchAll(/\b([A-Za-z_][A-Za-z_0-9]*)\s*(?=\()/g))if(names.has(match[1]))replacements.push([match.index,match.index+match[1].length,names.get(match[1])]);
 for(const [start,end,name]of replacements.reverse())body=body.slice(0,start)+name+body.slice(end);
 const addition='\n// MELKAK marketplace transition\n'+body.trim()+'\n// End MELKAK marketplace transition\n';
 let insertion=base.end;while(insertion>0&&/[\t ]/.test(baseline[insertion-1]))insertion--;
 const result=baseline.slice(0,insertion)+addition+baseline.slice(insertion);documentBlock(result);return result;
}

async function main(){
 const args=process.argv.slice(2),options={};
 for(let i=0;i<args.length;i+=2){const key=args[i];if(!['--baseline','--proposed','--out'].includes(key)||!args[i+1]||options[key])throw Error('Usage: --baseline <file> --proposed <file> --out <file>');options[key]=path.resolve(args[i+1]);}
 if(Object.keys(options).length!==3)throw Error('Usage: --baseline <file> --proposed <file> --out <file>');
 if([options['--baseline'],options['--proposed']].includes(options['--out']))throw Error('Output must not overwrite input Rules');
 const [baseline,proposed]=await Promise.all([fs.readFile(options['--baseline'],'utf8'),fs.readFile(options['--proposed'],'utf8')]);
 const result=composeTransitionRules(baseline,proposed);await fs.writeFile(options['--out'],result,'utf8');
 console.log(JSON.stringify({file:options['--out'],sha256:createHash('sha256').update(result).digest('hex')}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
