import assert from 'node:assert/strict';import fs from 'node:fs';import {createDatasource} from '../melkak/datasource.js';import {countryConfig} from '../melkak/config.js';
const countries=countryConfig(JSON.parse(fs.readFileSync(new URL('../melkak/legacy-countries.json',import.meta.url),'utf8')));let n=0;
for(const config of [{mode:'production',datasource:'production'},{mode:'production',datasource:'demo'},{mode:'review',datasource:'production'},{mode:'local',datasource:'production'}]){assert.throws(()=>createDatasource(config,countries),/not ready/);n++}
const a=createDatasource({mode:'review',datasource:'demo'},countries),b=createDatasource({mode:'review',datasource:'demo'},countries);assert.ok(a.state.listings.length>0);assert.deepEqual(a.state.legacy,{});assert.ok(a.state.listings.every(x=>x.saleType!=='auction'));n++;
a.state.listings[0].title='Only this preview';assert.notEqual(b.state.listings[0].title,a.state.listings[0].title);n++;
assert.throws(()=>a.legacyRead('messages',{role:'super_admin'}),/unavailable/);n++;
assert.ok(createDatasource({mode:'local',datasource:'demo'},countries).state.legacy.auctions.length>0);n++;
console.log('SUMMARY | '+n+'/'+n+' PASS');
