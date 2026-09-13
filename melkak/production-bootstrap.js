import {countryConfig} from './config.js';
async function loadCountries() {
 const response=await fetch(new URL('./legacy-countries.json',import.meta.url));
 if(!response.ok)throw Error('COUNTRY_CONFIG_UNAVAILABLE');
 return countryConfig(await response.json());
}
export async function prepareProduction({config,createDataSource,attachServices,loadAuth=()=>import('./auth-adapter.js'),loadCountries:readCountries=loadCountries}={}) {
 if(config?.mode!=='production'||config.datasource!=='production'||config.authProvider!=='firebase'||typeof config.writesEnabled!=='boolean')return {ready:false,reason:'configuration_incomplete'};
 let auth;
 try {
  const {loadFirebaseSdk,createFirebaseAuthAdapter}=await loadAuth();
  const sdk=await loadFirebaseSdk();
  auth=await createFirebaseAuthAdapter({sdk});
  const db=sdk.getFirestore(sdk.getApp());
  const countries=await readCountries();
  createDataSource ||= (await import('./production-datasource.js')).createProductionDatasource;
  attachServices ||= (await import('./production-services.js')).attachProductionServices;
  const options={sdk,db,auth,countries,config};
  const store=await createDataSource(options);
  if(!store)throw Error('DATASOURCE_UNAVAILABLE');
  await attachServices(store,options);
  return {ready:true,store,datasource:store,auth,countries};
 } catch(error) {auth?.dispose();return {ready:false,reason:'service_unavailable',error};}
}
