/** Adds only the private request namespace to a verified current Production baseline. */
export function addAccountDeletionRules(baseline,proposal){
 if(!baseline.includes('function mkOwner()')||baseline.includes('match /marketplaceAccountDeletionRequests/'))throw Error('UNEXPECTED_BASELINE');
 const start=proposal.indexOf('  // Verified deletion requests;'),end=proposal.indexOf('  // Read support for the real auth adapter;',start);
 if(start<0||end<0)throw Error('REQUEST_RULES_MISSING');
 const block=proposal.slice(start,end).replaceAll('owner()','mkOwner()');
 const suffix=baseline.match(/\}\s*\}\s*$/);if(!suffix)throw Error('MALFORMED_BASELINE');
 return baseline.slice(0,suffix.index)+block+'\n'+baseline.slice(suffix.index);
}
