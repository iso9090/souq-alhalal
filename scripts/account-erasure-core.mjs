import {createHash} from 'node:crypto';
const roots=new Set(['users','adminAccess','adminSecurity','animals','auctions','auctionParticipations','serviceRequests','purchaseRequests','conversations','reports','adminAuditLogs','accountDeletionRequests','commercialAds','commercialAdImages','commercialAdContacts','homePage','platformTelemetry','analyticsSessions','analyticsEvents','analyticsDaily','marketplaceListings','marketplaceRequests','marketplaceAuditLogs','marketplaceDeletions','marketplaceCommercialAds','marketplaceCommercialImages','marketplaceCategories','marketplaceCities','marketplaceSettings','marketplaceAccountDeletionRequests']);
const uidFields=new Set(['uid','userId','userUid','ownerUid','sellerId','sellerUid','buyerId','buyerUid','reporterId','reportedUserId','targetUid','actorUid','adminUid','createdBy','processedBy','reviewedBy','addedBy','participantIds','participants','memberIds','members','bidders','bidderId','lastBidderId','winnerId','createdByAdminUid','senderId']);
const referenceFields={listingId:['marketplaceListings'],animalId:['animals'],auctionId:['auctions'],conversationId:['conversations'],requestId:['marketplaceRequests','serviceRequests','commercialAds'],serviceRequestId:['serviceRequests'],purchaseRequestId:['purchaseRequests'],reportId:['reports','marketplaceRequests']};
const contains=(v,value)=>v===value||Array.isArray(v)&&v.some(x=>contains(x,value))||v&&typeof v==='object'&&Object.entries(v).some(([k,x])=>k===value||contains(x,value));
function owned(d,uid){return Object.entries(d||{}).some(([k,v])=>uidFields.has(k)&&contains(v,uid));}
/** Full bounded inventory is required. Unknown schemas/assets halt, never silently skip. */
export function planErasure(uid,documents,protectedUids){
 if(typeof uid!=='string'||!uid||uid.includes('/'))throw Error('UID');
 if(!Array.isArray(protectedUids)||protectedUids.includes(uid))throw Error('PROTECTED_OWNER');
 if(documents.some(d=>!roots.has(d.path.split('/')[0])))throw Error('UNKNOWN_COLLECTION');
 const requestPath='marketplaceAccountDeletionRequests/'+uid;
 const request=documents.find(d=>d.path===requestPath)?.data;
 if(!request||request.uid!==uid||!['requested','processing'].includes(request.status)||request.policyVersion!=='2026-09-14')throw Error('REQUEST_REQUIRED');
 // Shared history must be reviewed and anonymized before automated deletion proceeds.
 const sharedRoots=new Set(['auctions','animals','marketplaceListings','commercialAds','marketplaceCommercialAds','users','adminAccess']);
 for(const d of documents){const root=d.path.split('/')[0],data=d.data||{},primaryOwner=data.ownerUid||data.sellerUid||data.sellerId||data.userId||data.uid;
 if(owned(data,uid)&&sharedRoots.has(root)&&!['users/'+uid,'adminAccess/'+uid].includes(d.path)&&!d.path.startsWith('users/'+uid+'/')&&primaryOwner!==uid)throw Error('SHARED_RECORD_REVIEW_REQUIRED');
 if(['conversations','purchaseRequests'].includes(root)&&owned(data,uid))throw Error('SHARED_RECORD_REVIEW_REQUIRED');
 }
 const selected=new Set(documents.filter(d=>d.path===`users/${uid}`||d.path.startsWith(`users/${uid}/`)||d.path===`adminAccess/${uid}`||d.path===`accountDeletionRequests/${uid}`||d.path===requestPath||owned(d.data,uid)).map(d=>d.path));
 // Trusted processor persists only resource paths for crash recovery; clients cannot write these.
 if(request.status==='processing'&&Array.isArray(request.resourcePaths))for(const p of request.resourcePaths){if(typeof p!=='string'||!roots.has(p.split('/')[0])||p.split('/').length%2!==0||['users','adminAccess','adminSecurity'].includes(p.split('/')[0])&&p!==`users/${uid}`&&!p.startsWith(`users/${uid}/`)&&p!==`adminAccess/${uid}`)throw Error('UNSAFE_RECOVERY_PATH');selected.add(p);}
 // Never cascade from another person's identity. Cascade only via resource references.
 let changed=true;while(changed){changed=false;
  for(const doc of documents){if(selected.has(doc.path)||['adminSecurity','users'].includes(doc.path.split('/')[0]))continue;
   const related=[...selected].some(p=>doc.path.startsWith(p+'/'))||Object.entries(doc.data||{}).some(([k,v])=>referenceFields[k]?.some(c=>selected.has(c+'/'+v)))||((doc.data?.targetCollection||doc.data?.targetType)&&selected.has((doc.data.targetCollection||({listing:'marketplaceListings',animal:'animals',auction:'auctions',user:'users'}[doc.data.targetType]||doc.data.targetType))+'/'+doc.data.targetId))||(['commercialAdImages','commercialAdContacts','marketplaceCommercialImages'].includes(doc.path.split('/')[0])&&selected.has((doc.path.startsWith('marketplaceCommercialImages/')?'marketplaceCommercialAds':'commercialAds')+'/'+doc.path.split('/').at(-1)));
   if(related){if(['conversations','purchaseRequests'].includes(doc.path.split('/')[0]))throw Error('SHARED_RECORD_REVIEW_REQUIRED');if(doc.path.split('/').length===2&&sharedRoots.has(doc.path.split('/')[0])&&!owned(doc.data,uid))throw Error('SHARED_RECORD_REVIEW_REQUIRED');selected.add(doc.path);changed=true;}
  }
 }
 for(const doc of documents.filter(d=>selected.has(d.path))){if(['users','adminAccess','adminSecurity'].includes(doc.path.split('/')[0])&&doc.path!==`users/${uid}`&&!doc.path.startsWith(`users/${uid}/`)&&doc.path!==`adminAccess/${uid}`)throw Error('CROSS_ACCOUNT');
  const data=doc.data||{};const images=[...(Array.isArray(data.images)?data.images:[]),data.imageUrl,data.image,data.data?.image].filter(Boolean);if(images.some(x=>typeof x==='string'&&/^https?:/.test(x)))throw Error('EXTERNAL_ASSETS');
 }
 const paths=[...selected].sort((a,b)=>b.split('/').length-a.split('/').length||a.localeCompare(b));
 const fingerprint=documents.filter(d=>selected.has(d.path)).sort((a,b)=>a.path.localeCompare(b.path));
 const sha=createHash('sha256').update(JSON.stringify({uid,fingerprint})).digest('hex');return {uid,paths,requestPath,sha};
}
export async function executeErasure({plan,confirmation,lock,remove,deleteIdentity,verify}){
 if(confirmation!==plan.sha)throw Error('CONFIRMATION');
 await lock();
 for(const path of plan.paths.filter(p=>p!==plan.requestPath))await remove(path);
 if(!await verify())throw Error('REMAINING_DATA');
 await deleteIdentity(plan.uid);
 await remove(plan.requestPath);
 return {deleted:true};
}

export function erasureProject(env){const f=env.FIRESTORE_EMULATOR_HOST,a=env.FIREBASE_AUTH_EMULATOR_HOST;if(f||a){if(f!=='127.0.0.1:8080'||a!=='127.0.0.1:9099')throw Error('LOCAL_EMULATORS_ONLY');return 'demo-melkak-erasure';}return 'souq-al-halal-9e3e8';}
