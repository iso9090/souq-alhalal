// Pure Firestore boundary: no SDK imports, network access or fabricated marketplace rows.
export function timestampMillis(value) {
 if(value==null)return 0;
 const n=typeof value==='number'?value:typeof value?.toMillis==='function'?value.toMillis():typeof value?.seconds==='number'?value.seconds*1000:Date.parse(value);
 return Number.isFinite(n)?n:0;
}
export const validProductionImage=value=>typeof value==='string'&&value.length<=210000&&(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)||/^https:\/\/[^\s]+$/i.test(value));
function normalize(id,data,countries,legacy){
 const a=data||{},sourceCollection=legacy?'animals':'marketplaceListings';
 const country=Object.hasOwn(countries,a.country)?a.country:Object.keys(countries).find(k=>countries[k].name===a.country)||'';
 const images=[...new Set((Array.isArray(a.images)?a.images:[]).filter(validProductionImage))].slice(0,3);
 const consent=(a.contact?.consent??a.contactConsent)===true;
 const phone=String(a.contact?.phone??a.contactPhone??'');
 const call=consent&&(a.contact?.call??a.allowCall)===true,whatsapp=consent&&(a.contact?.whatsapp??a.allowWhatsapp)===true,showPhone=consent&&(a.contact?.showNumber??a.showPhone)===true;
 const status=legacy?({unpublished:'hidden',not_approved:'rejected'}[a.status]||a.status||'active'):a.status||'pending';
 return {...normalizeProductionRecord(id,a,sourceCollection),id:(legacy?'legacy-':'marketplace-')+id,sourceId:id,sourceCollection,legacy,history:legacy||a.hasHistory!==false,ownerUid:String((legacy?a.sellerId:a.ownerUid)||''),category:legacy?'livestock':a.category||'',title:String(a.title||a.name||a.type||''),country,currency:countries[country]?.currency||'',region:String(a.region||''),city:String(a.city||a.location||''),price:Number.isFinite(Number(a.price))?Number(a.price):0,description:String(a.description||''),images,imageNotice:images.length?'': 'missing_or_invalid',status,saleType:a.saleType||'direct',sellerName:String(a.sellerName||''),attributes:legacy?{type:a.type||'',breed:a.breed||'',age:String(a.age||''),gender:a.gender||'',health:a.vaccinationStatus||''}:a.attributes||{},contact:consent?{phone,consent:true,call,whatsapp,showNumber:showPhone}:null,contactPhone:consent?phone:'',contactConsent:consent,allowCall:call,allowWhatsapp:whatsapp,showPhone,createdAt:timestampMillis(a.createdAt),updatedAt:timestampMillis(a.updatedAt),bumpedAt:timestampMillis(a.bumpedAt),featuredStatus:legacy?(a.featuredUntil?'approved':null):(a.featured===true&&a.featuredStatus==='approved'?'approved':null),featuredStartAt:timestampMillis(legacy?a.featuredAt:a.featuredStartAt),featuredEndAt:timestampMillis(legacy?a.featuredUntil:a.featuredEndAt)};
}
export const normalizeProductionListing=(id,data,countries={})=>normalize(id,data,countries,false);
export const normalizeProductionLegacy=(id,data,countries={})=>normalize(id,data,countries,true);
export function normalizeProductionRecord(id,data,sourceCollection){
 const commercial=sourceCollection==='marketplaceRequests'&&data?.type==='commercial';
 const row={...(commercial?data.data:{}),...data,id,sourceId:id,sourceCollection};
 if(commercial){row.asset=validProductionImage(row.image)?row.image:'';row.publicEligible=false;}
 if(sourceCollection==='commercialAds'){row.asset=validProductionImage(row.imageUrl)?row.imageUrl:'';row.publicEligible=true;}
 if(sourceCollection==='marketplaceCommercialAds'){row.status=data.status==='approved'?'active':data.status;row.asset='';row.imageUrl='';row.imageDocument=true;row.publicEligible=data.status==='approved';row.startAt=timestampMillis(data.startAt);row.endAt=timestampMillis(data.endAt);}
 if(sourceCollection==='adminAuditLogs'){row.actor=row.adminUid||'';row.result='success';}
 if(sourceCollection==='marketplaceAuditLogs')row.actor=row.actorUid||'';
 for(const key of Object.keys(row))if(/(?:At|Until)$/.test(key)||key==='timestamp')row[key]=timestampMillis(row[key]);
 if(sourceCollection==='users')row.uid=id;
 if(sourceCollection==='marketplaceRequests'&&row.listingId)row.listingId='marketplace-'+row.listingId;
 return row;
}
