# MELKAK Complete Production Implementation Plan

> For agentic workers: use subagent-driven-development or executing-plans task by task; review each independently tested deliverable.

**Goal:** Release the approved MELKAK marketplace on the existing free Firebase/Pages project with real authenticated owner and scoped admin workflows.
**Architecture:** Keep marketplaceListings, marketplaceRequests, marketplaceCategories and immutable marketplaceAuditLogs. Use existing users/adminAccess/adminSecurity identities. Add public commercial metadata plus separate image documents and atomic approval, never expose private request documents. Preserve legacy data until backed up and proven unused; stop querying it in the new app. Keep prototype fixtures restricted to Review builds.
**Tech Stack:** Vanilla JS, Firebase Auth/Firestore SDK, Rules v2, local Emulator, GitHub Pages/Jekyll.
**Spec:** User attachment 0679a116-5368-4aac-bb52-7957b6504403/pasted-text.txt (autonomous release authorization).

## Global constraints
- No Billing/Blaze/Functions/Android/Google Play; Payments and Analytics remain disabled.
- Preserve real users and owner UIDs/claims; only Google-first existing UID assistant delegation.
- Back up Rules/indexes/config/logical data and SHA256 before any live mutation.
- Never log tokens, secrets or private keys.
- Feature checkpoints, full tests before infrastructure and main push; rollback on critical release failure.

## 1. Auth and account bootstrap
Files: melkak/auth-adapter.js, tests/melkak-auth-adapter.test.mjs, proposed Rules.
- [ ] Add failing tests for first Google login creating only an active non-admin profile, concurrent creation preserving existing suspended/blocked profiles, failed writes not granting access.
- [ ] Implement transaction-based missing-profile bootstrap; retain current UID and verified Auth metadata; allow only safe self-create fields in Rules.
- [ ] Verify real credentials availability without outputting values.

## 2. Administration
Files: new melkak/production-admin.js; production-services.js integration; app.js UI; dedicated Emulator tests.
- [ ] Test protected owner denial, assistant non-escalation and atomic reasoned audit for users and assistant changes.
- [ ] Reuse existing legacy adminAccess/adminAuditLogs transaction contract, add active-profile checks; Google-first existing UID only.
- [ ] Add scoped user status/profile management, assistant delegation UI, Super Admin clean listing deletion and archived-history fallback.
- [ ] Persist category and safe country/city display settings with audited changes; keep schemas/currency/dial mappings fixed.

## 3. Featured, bump and commercial publication
Files: production-services.js, production-datasource.js, phase1-views.js, proposed Rules, dedicated tests.
- [ ] Add failing tests for audited bump approval preserving createdAt and published commercial visibility.
- [ ] Implement bump request/approval and scheduling; public metadata separate from <=limited JPEG image docs.
- [ ] Make public ads active-window queries safe, image loading current/next only; Hero slots1–10, side1–3, middle/footer mapped consistently.
- [ ] Implement admin reordering and expiration counters, no fabricated values.

## 4. Public datasource and production UI
- [ ] Remove runtime legacy collection dependency; keep legacy backup offline and no old operational routes.
- [ ] Add bounded pagination for real data/search, correct categories, counts and image loading; no hidden-phone text outside owner consent.
- [ ] Replace preview-only wording in production actions/settings, preserve approved layout.
- [ ] Enable writes only in verified production release configuration, keep Review isolated.

## 5. Verification and protected release
- [ ] Run targeted security/functional tests after each change, then all project suites and full Rules suites in small batches.
- [ ] Lint, secrets scan, build/Jekyll, responsive360/390/430/768/1024/1440, accessibility, diffcheck.
- [ ] Inventory/export live Rules,indexes,configs,all logical data with manifest/SHA; verify backup and current baselines.
- [ ] Deploy only needed indexes; wait READY; deploy tested transition Rules; read back and verify.
- [ ] Seed safe category/config only; run clearly labeled temporary live test documents via authentic test user SDK, clean them with audit.
- [ ] Commit/push feature, merge latest main safely, rerun final regression, push main, await Pages.
- [ ] Verify actual public and authenticated Production; use existing Google session if available without extracting credentials. If interactive credential unavailable, record genuine blocker without fabricating verification.
- [ ] Optional legacy cleanup only after backup, relationship inventory and no runtime dependence; preserve genuine users/security/audit and ambiguous records.
- [ ] Final report with evidence, hashes, writes, limitations and rollback status.
