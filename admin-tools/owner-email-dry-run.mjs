// Pure plan generator: no SDK, network, credentials, Auth creation, linking or writes.
export function planOwnerEmailLink({uid,expectedUid,claims,profile,providers,emailInUse=false}) {
  if(!uid||uid!==expectedUid)throw Error('UID_MISMATCH');
  if(claims?.admin!==true||profile?.status&&profile.status!=='active')throw Error('OWNER_REQUIRED');
  if(!Array.isArray(providers)||!providers.includes('phone'))throw Error('PHONE_OWNER_REQUIRED');
  if(emailInUse)throw Error('EMAIL_ALREADY_IN_USE');
  return Object.freeze({mode:'dry-run',writes:0,createsUser:false,changesUid:false,unlinksPhone:false,
    alreadyLinked:providers.includes('password'),
    steps:['A: Before any approved linking, make a protected read-only snapshot of Auth metadata, claims, users/{uid}, registry, access and UID-linked business records. Exclude passwords and tokens.',
      'B: Record the current authenticated UID and match it to the expected registered owner. Verify active profile, enabled Auth account and admin claim.',
      'C: After separate explicit production approval, the owner enters email/password directly in a trusted interactive UI. Call linkWithCredential(currentUser, EmailAuthProvider.credential(email, password)). Reauthenticate the existing phone user if required. Never call signUp/createUser; stop on credential collision.',
      'D: Send verification to the linked email and verify emailVerified after reload. Keep the phone credential.',
      'E: Sign out after recording the successful link result and unchanged UID.',
      'F: Sign in using the linked email/password in a separate clean browser session.',
      'G: Assert the resulting UID exactly equals the UID recorded in B. Stop on mismatch; do not copy documents to a new UID.',
      'H: Compare users/{uid}; account status, identity and role fields must remain unchanged. Document expected lastLoginAt change only.',
      'I: Refresh the ID token, verify claims and registered owner access to Admin.',
      'J: Read the owner listings and sellerId references; no ownership transfer.',
      'K: Read auctions, bids and auctionParticipations by the same UID; no test bid in production.',
      'L: Read purchaseRequests as seller/buyer; do not create a production purchase for testing.',
      'M: Open Admin V2 and homepage administration using the existing owner account.',
      'N: Check the complete permission matrix against the snapshot; test write policies only in an isolated emulator/test project.',
      'O: Only after every required check passes, make a separate approved decision about preserving or unlinking phone. This plan never unlinks it.']});
}
// Stricter evidence gate for an actual read-only owner snapshot. Still has no I/O.
export function planVerifiedOwnerEmailLink(input){
  if(input.authDisabled!==false)throw Error('AUTH_ACCOUNT_NOT_VERIFIED_ACTIVE');
  if(!input.profile||typeof input.profile!=='object')throw Error('PROFILE_NOT_VERIFIED');
  if(input.registry===undefined)throw Error('REGISTRY_NOT_VERIFIED');
  if(input.registry!==null&&(!Array.isArray(input.registry.superAdminUids)||!input.registry.superAdminUids.includes(input.uid)))throw Error('OWNER_NOT_REGISTERED');
  const result=planOwnerEmailLink(input);
  return Object.freeze({...result,preflight:'PASS',readyForProductionLink:false,
    emailAvailability:input.emailInUse===false?'reported-free':'not-checked',
    requires:['separate owner approval','fresh protected snapshot','target email availability check','interactive owner reauthentication','real same-UID link and login verification']});
}
