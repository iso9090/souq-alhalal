# MELKAK production release candidate

Runtime: production Firebase datasource, Google Auth, explicit writes release `melkak-production-v1`; demo and legacy reads excluded. Analytics and payments remain disabled. No Functions, Billing, Blaze, Android or Google Play changes.

## Data and authorization

- Unified marketplaceListings, maximum three compressed inline JPEG images.
- Existing users, adminSecurity/config, adminAccess and signed claims retained.
- Google first sign-in creates only a missing ordinary active profile; existing profiles remain unchanged.
- Scoped assistant actions preserve owner/peer protection and immutable audit linkage.
- Commercial private requests publish audited metadata plus separate bounded JPEG documents.
- Country/category settings, featured schedule and priority, bump timestamps, history-aware deletion and tombstones.
- Bounded cursor pagination, direct listing links, dedicated featured retrieval and server counts; loaded-only figures are labeled.

## Reviewed infrastructure

Use firebase.melkak-release.json, not the historical default Rules file.
melkak/firestore.transition.rules is generated from the verified published baseline, with only Google profile metadata, nonblank legacy admin audit reason, and the new namespaced marketplace policy.

Published baseline SHA256: 87dd858e25679d4a251cc713240a7ac990237204c374220f4552f8013cc56001
Candidate Rules SHA256: 6b016093578d325dc006f36eaa94a732ca365786e33651e1801737626506b8bc

Deploy indexes first, wait READY, deploy the exact candidate Rules, verify content, then seed only missing category/settings documents. Live smoke records must be clearly labeled MELKAK RELEASE TEST and cleaned afterward. Never modify an actual user's listing during verification.

Rollback: restore the verified pre-release Rules and previous main web revision if needed. Additional indexes are additive; do not remove unrelated indexes. Preserve all existing Auth identities, users, owners, security registries and important audit records. Legacy cleanup is optional and requires inventory/relationship proof; new runtime does not rely on legacy collections.

## Local verification

81 suites: 2133/2133 PASS; Firestore Rules subset: 690/690 PASS. Exact published-baseline transition admin suite: 14/14 PASS. Jekyll artifact browser: 26/26 PASS. No critical JavaScript errors in browser tests. Lint, secret scan and git diff --check PASS.

Full evidence and verified logical backup remain outside Git under F:/SouqAlhalal-Backups/melkak-complete-release-2026-09-13. These results are local/emulator verification, not a claim of completed Production deployment.
