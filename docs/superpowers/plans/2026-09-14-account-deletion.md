# MELKAK account deletion implementation plan

Goal: an in-app and public web deletion-request path, authenticated ownership verification, and real deletion of Firebase Auth plus related data, without paid services.
Architecture: public bilingual resource; fresh-auth UID-bound private Firestore request; existing trusted local operator runs a bounded dry-run then confirmed deletion. No client Admin SDK, secret, paid backend or automatic Production test writes. Suspended accounts can request deletion. Privileged platform owners require an explicit ownership handover, never silent registry changes.
Spec: user decisions 2026-09-14 in this task.

- [ ] Add failing tests for fresh identity, request ownership, duplicate requests, failed verification, and service isolation.
- [ ] Add public resource and account link. Confirmation explains request vs completed deletion; no email-only substitute.
- [ ] Add narrowly scoped request Rules; deny forged verification, state changes, cross-user reads and processing completion from client.
- [ ] Implement trusted local processor with explicit project, dry-run, reviewed manifest hash, bounded inventory, retry-safe execution and actual Auth deletion last. Test with synthetic data only.
- [ ] Publish truthful bilingual privacy/data-deletion information with no invented statutory retention. Identify any unsupported storage namespace as a blocker rather than pretending completion.
- [ ] Run security/emulator, full regression, responsive/browser, lint/build. Backup/readback Production Rules before narrowly scoped release. Publish only after evidence passes.
- [ ] Finish Play privacy/Data Safety/App Access preparations; 18+ audience. Leave only IARC acceptance, reviewer credentials and actual testers to user.

Existing isolated worktree reused; starting dce60cd31abe9a491a8c886a1337792b51ae883b. Backup F:/SouqAlhalal-Backups/melkak-account-deletion-20260914-200854/source-before.zip SHA256 D19154E4DB745EC71C794A06D60A4FF9B33F62E719AE843111347ECFE0F17787. No existing work removed.
