/** Creates only a missing Google profile. Existing status, UID and privileges never change. */
export async function ensureMarketplaceProfile({sdk,db,user,enabled=false}) {
 if(!enabled)return;
 if(!user?.uid||!user.providerData?.some(p=>p.providerId==='google.com'))throw Error('GOOGLE_PROFILE_REQUIRED');
 const ref=sdk.doc(db,'users',user.uid);
 await sdk.runTransaction(db,async tx=>{
  const existing=await tx.get(ref);if(existing.exists())return;
  tx.set(ref,{uid:user.uid,displayName:String(user.displayName||'').slice(0,100),phoneNumber:user.phoneNumber||'',accountType:'buyer',status:'active',createdAt:sdk.serverTimestamp(),lastLoginAt:sdk.serverTimestamp(),email:user.email||'',phone:user.phoneNumber||'',authProvider:'google'});
 });
}
