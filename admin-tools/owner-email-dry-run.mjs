// Pure plan generator: no SDK, network, credentials, Auth creation, linking or writes.
export function planOwnerEmailLink({uid,expectedUid,claims,profile,providers,emailInUse=false}) {
  if(!uid||uid!==expectedUid)throw Error('UID_MISMATCH');
  if(claims?.admin!==true||profile?.status&&profile.status!=='active')throw Error('OWNER_REQUIRED');
  if(!Array.isArray(providers)||!providers.includes('phone'))throw Error('PHONE_OWNER_REQUIRED');
  if(emailInUse)throw Error('EMAIL_ALREADY_IN_USE');
  return Object.freeze({mode:'dry-run',writes:0,createsUser:false,changesUid:false,unlinksPhone:false,
    alreadyLinked:providers.includes('password'),
    steps:['Read the currently signed-in owner UID and protected admin registry; verify they match the expected owner.',
      'After separate explicit production approval, call linkWithCredential(currentUser, EmailAuthProvider.credential(email, password)) in a trusted owner session.',
      'If recent authentication is required, reauthenticate the existing phone user. Never sign up or create another owner.',
      'Assert returned UID equals the original UID, and users/{uid}, seller/buyer records, claims, registry and history are unchanged.',
      'Test email/password login in a separate browser, Admin V2, listings, purchases and bids. Preserve the existing phone credential.',
      'Only consider unlinking the phone in a separate later approved change after successful verification.']});
}
