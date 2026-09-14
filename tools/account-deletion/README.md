# MELKAK deletion operator runbook

This is a trusted LOCAL administration tool, excluded from both public build manifests and GitHub Pages. It uses an existing user ADC login, not a service-account key, deployed function or paid service. Install with `npm ci --ignore-scripts` inside `tools/account-deletion`. Never copy credentials into this repository. Client request Rules do not give the requester or an assistant any administrative deletion capability.

## Intake and verification
The public page `account-deletion.html` and My account → Delete my account create `marketplaceAccountDeletionRequests/{uid}`. Rules bind the request to the authenticated UID, recent auth time and server timestamp. Disabled/suspended profiles may request deletion. The request carries no email/password. Client updates/deletes and fake completion are denied; only Super Admin can inspect the queue. Existing platform owners require explicit ownership handover before erasure; do not edit the privileged registry in this workflow.

Review the queue regularly as part of support operations. Request submission is not completion. If access is lost, support must verify the original account using an appropriate recovery process; a supplied email alone is not proof. Never ask users for passwords or tokens.

## Execution, one verified UID at a time
1. `node tools/account-deletion/process.mjs UID --plan`: read-only bounded inventory (maximum 10,000 documents), paths and content fingerprint. Review every selected resource, especially legacy relations. This scans the database and consumes reads within the same free quota; there is no paid service or unlimited free-quota guarantee.
2. Review and remove the user's personal data from operator exports/backups, support copies and any provider-hosted assets. The tool refuses unknown collections and external image URLs rather than pretending those are removed. Resolve those explicitly before continuing. Shared histories (including conversations, purchases and another seller’s auction) also stop processing. An authorized operator must remove the requesting person’s identifying fields/content and detach their resource references while preserving the other party’s independent history. Review embedded/free-text personal data too. Do not resolve this gate by deleting the other party’s resource. This is a manual erasure step, not a retention exception; keep the request pending until it is complete. Avoid making a fresh permanent personal-data backup during deletion. Clear temporary inventory files after completion.
3. `node tools/account-deletion/process.mjs UID --begin SHA`: temporarily disables/revokes the identity and locks its profile. Persists resource paths for retry recovery. This is NOT deletion completion.
4. Wait at least 65 minutes after revocation to outlive existing Firebase ID tokens (Firebase documents one-hour lifetime). No clock shortcut is allowed in production. Run `--plan` again and review the new fingerprint, including any added related data.
5. `node tools/account-deletion/process.mjs UID --execute SHA --external-data-cleared`: the last flag is an operator assertion that the external review and removal in step 2 were actually completed. Persist the complete reviewed resource-path set before deleting any document, so partial failures cannot lose newly discovered relationships. Delete scoped Firestore data and inline images, verify no associated documents/descendants remain, delete Firebase Auth identity, then remove the request and recovery metadata. No personal completion log is retained. Record only nonidentifying operational totals if needed.
6. On failure, do not claim completion. Keep the locked identity/request pending, investigate and repeat the plan with fresh review. Existing recovery resource paths keep orphan subcollections discoverable after partial progress. Do not delete unrelated users to resolve a blocking check.

No automatic completion schedule is claimed. Operations staff must actually fulfill requests without undue delay. If a real legal obligation is discovered, determine and disclose its specific basis/data/duration; no arbitrary statutory retention has been invented. This tool applies no blanket retention exception. Do not use the completion flag as a substitute for external erasure.

References:
- https://support.google.com/googleplay/android-developer/answer/13327111
- https://firebase.google.com/docs/auth/admin/manage-sessions
- https://firebase.google.com/docs/auth/admin/manage-users

Production requests/data must never be created or deleted for tests. All tests use mocks or demo emulator projects.
