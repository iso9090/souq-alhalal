// There is intentionally no production datasource implementation yet. Callers
// must supply a reviewed factory; neither fixtures nor DemoDataSource is a fallback.
export async function prepareProduction({config,createDataSource,loadAuth=()=>import('./auth-adapter.js')}={}) {
 if(config?.mode!=='production'||config.datasource!=='production'||config.authProvider!=='firebase'||typeof createDataSource!=='function')return {ready:false,reason:'configuration_incomplete'};
 try {
  const datasource=await createDataSource();
  if(!datasource)return {ready:false,reason:'datasource_unavailable'};
  const {createFirebaseAuthAdapter}=await loadAuth();
  const auth=await createFirebaseAuthAdapter();
  return {ready:true,datasource,auth};
 } catch {return {ready:false,reason:'service_unavailable'};}
}
