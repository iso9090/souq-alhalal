import {seed} from './fixtures.js';
import {createLocalStore} from './model.js';
import {attachLocalServices} from './marketplace-services.js';
export function createDatasource(config,countries) {
 if(!['local','review'].includes(config?.mode)||config.datasource!=='demo')throw Error('Production datasource is not ready');
 const data=seed(countries);
 if(config.mode==='review'){data.legacy={};data.listings=data.listings.filter(a=>a.saleType!=='auction');}
 const store=attachLocalServices(createLocalStore(data),countries);
 if(config.mode==='review')store.legacyRead=()=>{throw Error('Legacy unavailable in review');};
 return store;
}
