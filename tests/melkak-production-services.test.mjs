import assert from 'node:assert/strict';
import fs from 'node:fs';
const url=new URL('../melkak/production-services.js',import.meta.url);
assert.ok(fs.existsSync(url),'Production services must exist');
const {attachProductionServices}=await import(url);
const store={state:{listings:[],categories:[]}};
attachProductionServices(store,{sdk:{},db:{},auth:{state:{actor:{uid:'real',status:'active'}}},countries:{}});
for(const name of ['create','update','transition','report','requestService','approveService','rejectService','requestCommercial','reviewCommercial','moderate','actOnReport','reportUser','configureCategory','resolveReport','setUserStatus','updateUser','grantAssistant','updateAssistant','removeAssistant']){
 await assert.rejects(()=>store[name]('x',{}, {uid:'forged',role:'super_admin'}),{code:'WRITES_DISABLED'},name);
}
console.log('PASS production mutation gate blocks every method before SDK access');
