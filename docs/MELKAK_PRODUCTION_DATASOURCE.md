# MELKAK Production Datasource Readiness

Branch: feature/melkak-marketplace-redesign. Starting commit: de78ecc13b2ca425def3f5447edf073cd174517c.

This change connects the real Firebase web SDK to the approved MELKAK renderer. It is a feature-branch implementation, not authorization to merge or deploy. Production and Review use separate datasources. Runtime defaults are production / Firebase / writesEnabled=false. No Production data was created, updated, migrated, or deleted during verification.

## Data mapping

| Existing/source | MELKAK boundary | Policy |
| --- | --- | --- |
| Firebase Auth currentUser + token claims | auth actor UID, current role | Actual Firebase session; no role selector or email inference |
| users/{uid} | profile/status | Missing, blocked, suspended or unreadable profile cannot mutate |
| adminSecurity/config + adminAccess/{uid} | registered owner and assistant permissions | Registry + current admin claim for owner; missing security config fails closed |
| animals | category=livestock, id=legacy-{id}, ownerUid=sellerId | Read-only; auction rows excluded from public MELKAK |
| name/type, featuredAt/featuredUntil | title, featuredStartAt/featuredEndAt | No invented duration, price, country or contact consent |
| marketplaceListings | id=marketplace-{id}, unified listing model | Proposed new schema, no migration |
| marketplaceCategories | enabled/order/featured over static category definitions | Static definitions are configuration, never demo listings |
| serviceRequests | state.legacy.serviceRequests | Preserved legacy records, no reinterpretation or mutation |
| marketplaceRequests | featured/commercial/report | New service-layer operations tested with Emulator only |
| commercialAds | publicAds + owner-only private admin metadata | Existing time-bounded public query preserved |
| commercialAdImages/{id} | lazy imageData | Current/next Hero only; visible placements fetched in batches of at most two |
| marketplaceAuditLogs | administration audit | Atomic mutation/audit linkage, immutable logs |

Unified listing records include owner, category fields, country/region/city, title/description, price/currency, images, status, featured schedule, explicit per-listing contact consent and timestamps. Country is authoritative for currency: AE/AED, SA/SAR, EG/EGP, OM/OMR, JO/JOD, MA/MAD. Unknown countries are not silently relabelled. Legacy contact numbers are not copied from private profiles.

## Read-only Production evidence

Sanitized bounded sampling and public Firestore REST queries were used, with no login or write operations. Sample limits are not collection totals.

- Guest active animals: successful, sample 5.
- Guest active marketplaceListings: permission denied by current deployed Rules.
- Guest marketplaceCategories: permission denied by current deployed Rules.
- Guest current commercialAds: successful, 0 rows.
- Registered-owner animals query: trusted read successful, 0 rows in this query. It was not a new interactive owner sign-in test.
- Privileged schema survey found existing users, animals, serviceRequests and adminAccess. New listing/category collections returned no documents.

Current Rules availability is reported explicitly in the UI; it does not cause a demo fallback or a blank page. Production adapter reads are bounded (default 60 records, configurable up to 100); administrative totals describe loaded records, not all database documents. Public ad query retains its existing limit of 100 metadata records. Legacy source and existing registry/security data remain untouched.

## Mutation boundary

Production config remains writesEnabled=false. Changing a button or supplying a forged actor to a method cannot bypass the service guard; services resolve the actual injected auth actor. Firestore Rules are authoritative when writes are later authorized.

Emulator-tested operations: create, update, hide, safe republish, sold, eligible delete, featured request/approval/rejection, commercial request/review, listing/user report and audited moderation. Permanent deletion requires a clean new listing; requests atomically set durable history so related records cannot be orphaned by a concurrent delete. Inline JPEG images disappear atomically with an eligible parent deletion. Published listings retain 1–3 images; a fourth and invalid image payloads are blocked.

Commercial request approval is a private workflow decision, not publication into the legacy commercialAds collection. Public slots consume only publicAds. Legacy commercial publication remains a separate existing workflow. Bump, verification, user suspension and registry lifecycle writes are explicitly unavailable in this phase. The UI does not simulate success for these actions.

## Proposed Rules and future release prerequisites

melkak/firestore.proposed.rules is a standalone emulator proposal, NOT a replacement for current Production Rules. It must be integrated as a reviewed limited delta before any future rollout. It covers new listing/request/category/audit collections and auth read dependencies, while denying legacy writes. Existing protected root firestore.rules and indexes are unchanged.

A later authorized release must review the Rules delta, category document provisioning (none exists today; creation is intentionally not client-enabled), operational write flag, existing Google provider/authorized domain configuration, and commercial request publication handoff. Do not enable writes merely because build tests pass. No secret or Admin SDK belongs in the browser.

## Static publication and review isolation

GitHub Pages actually publishes main from its root through Jekyll. The production allowlist and _config.yml include all required browser modules and exclude demo datasource/fixtures, legacy entry, Rules, tools and reports. The review builder generates a separate allowlisted directory and Review-only config. Correct Production config now starts the marketplace through shared Auth/read/services adapters; incomplete config renders a clear safe error. No server runtime or paid backend is required.

## Verification

Current task logs, source hashes and final result ledger are stored outside Git at:
F:/SouqAlhalal-Backups/melkak-production-datasource-2026-09-13-final-verification

The final ledger must show all suites passing on matching source hashes before commit. Tests use SDK mocks or demo-project Firestore Emulator contexts; they never submit Production mutations. Publication tests exercise the built artifact and actual local Jekyll output. Public Production reads are separately recorded and are not claimed as interactive login/write verification.

Final disposition: FINAL MERGE REVIEW ONLY. SAFE TO MERGE: NO. No merge, deployment, Rules deployment, Android, Google Play, Billing, Functions, payments or analytics activation in this task.
