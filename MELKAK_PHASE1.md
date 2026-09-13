# MELKAK — phase 1 local prototype

Historical report for the preceding green-identity prototype. The current sky/gold iteration is documented in [MELKAK_COMPLETE_PHASE1.md](MELKAK_COMPLETE_PHASE1.md).

Brand: **مِلكك | MELKAK — بيع واشتري مباشرة**

Branch: `feature/melkak-marketplace-redesign`

Starting main: `940e705542802ec5945f3848a453abfe0c1205c1`

This is a local visual and functional prototype, not a production release. All new marketplace and administrative mutations use an in-memory store. Reloading resets those records. The preview banner and role selector explicitly identify the simulation. Favorites, language preference and notification read state are stored locally, separately from the legacy application.

## Review

Run `npm run preview:melkak`, then open **http://localhost:8786/** in Chrome. The server accepts only local GET/HEAD requests and serves an explicit preview asset set. It does not serve the legacy Firebase-connected entry. The new entry has a same-origin CSP and refuses to run outside localhost, 127.0.0.1 or test hosts.

Use the preview role selector for normal user, Super Admin and assistant scenarios. These are local fixtures, not changes to real accounts, claims or permissions. Demo listing call/WhatsApp clicks are intercepted to avoid contacting demonstration numbers. Listings created locally with the reviewer's explicitly consented number generate the actual `tel:`/`wa.me` links; no real call or message was sent by tests.

## Implemented

- White/green/mint responsive identity, replaceable abstract M logo, local metadata, Arabic RTL and English LTR. No camel platform logo. Category illustrations are clearly marked local fixtures, not real advertisements.
- Six configured countries and their currencies: AE/AED, SA/SAR, EG/EGP, OM/OMR, JO/JOD, MA/MAD. Currency follows the listing. All existing UAE cities and the prior Egyptian region dataset are preserved; other country datasets are extensible starting sets.
- Ten schema-driven categories: livestock, cars, phones, computers/electronics, appliances, furniture, tools, sports, children and other. Country/region/city, category, price/date and category-specific filters.
- Direct call and WhatsApp only. Explicit per-listing contact consent and channel controls. Legacy profile phone values are not implicitly published. New UX hides auctions, bids, purchase requests and internal conversations.
- Seven-step local listing flow: country, city, category, images, details, contact, review. Device JPG/PNG/WebP input reuses the unchanged free livestock JPEG compressor. One to three images; fourth blocked. Preview, replacement, removal, ordering and main image; last published image cannot be removed. Data URI limit 210,000 characters per image and 650,000 total in model validation, below the Firestore document size ceiling before final production integration review.
- Main image plus two clickable thumbnails, image counter, seller information, report and similar listings. Favorites, mobile navigation, account and listing management pages.
- Local owner update/hide/eligible republish/sold/clean deletion, preserving linked and legacy history. A report or service request prevents permanent local deletion. Legacy listings retain hide instead of permanent deletion.
- Featured display and sorting require approved status and a valid active time window; future/pending/expired listings display normally. Featured, bump and category-appropriate verification requests remain free local previews. Exceptional no-payment approval is Super Admin only, reason required and locally audited.
- Admin sidebar, nine counters derived from the current local dataset with country filter, categories display configuration, listing moderation, reports, notifications, assistants permission presentation, audit, settings and disabled analytics message. No fake visitor counts, polling or notification Firestore writes. Category schema editing and self-escalation are unavailable.
- Legacy Data view is Super Admin only and read-only. Existing owner checks use the unchanged `admin-permissions.js` access model with claim + UID registry fixtures, never matching email or account type.
- Commercial ad selection and placements reuse the unchanged `commercial-model.js`: ten Hero slots, three side placements, middle and footer. One Hero image mounted at a time, remaining cards lazy-loaded, fixed image geometry and bounded pagination. Commercial administration in this prototype is a read-only presentation/map; its existing production CRUD/storage implementation is preserved in the legacy application.

## Preservation and deliberate boundaries

`legacy-index.html` preserves the previous main `index.html` exactly after normalizing CRLF/LF. Original `app.js`, Google/Phone/Email Auth logic, administrative permission module, commercial modules, image compressor, existing Firestore Rules and Firebase configuration are unchanged. Existing collections were neither read nor migrated by the new prototype. Other dirty worktrees, including Android, Trusted Backend and owner deletion work, were backed up and left untouched.

Real Google Auth is **preserved but not connected to the new prototype**. The new account screen explains this. No Firebase SDK is loaded by the new UI; changing a preview role cannot change a real user's role. Existing Auth is tested separately through its preserved entry with mocked traffic. Integrating the new UI with the existing authenticated session and bounded Firestore data access requires a later approved phase.

The legacy adapter normalizes old `animals` shapes to category `livestock` without altering its input. This phase uses representative local legacy records, not a Production migration or live compatibility rollout.

Search currently runs over a bounded local fixture dataset and paginates results. It does not pretend to implement remote Firestore full-text search. Before real data integration, define bounded search tokens/indexes or a bounded category/country query followed by local filtering; do not fetch every production record.

`melkak/firestore.proposed.rules` is a **separate emulator-only proposal**, not a replacement for deployed Rules and not included in the static build. It covers the proposed new marketplace schema, category/currency/image/contact bounds, ownership, statuses and registry-backed owner access. Remote permanent deletion is intentionally denied pending integration of the existing owner/history deletion safeguards. Local clean-delete demonstration is not evidence of production delete eligibility. No new Rules or indexes were deployed.

Analytics, payments, purchase requests, messaging, auctions and Production writes are all disabled by the prototype configuration. No Blaze, Billing, Functions, paid backend or client secrets were introduced. No changes to Android, Google Play or applicationId.

## Validation

Final local model: **68/68 PASS**.

Final new browser suite: **83/83 PASS**, including seven viewport widths (360, 390, 430, 768, 1024, 1280, 1440), RTL/LTR, no horizontal overflow, keyboard focus, reduced motion, accessible control names, key text contrast pairs, real browser file picker/compression, local publishing, gallery, owner actions and permission denial. Contrast checks cover the principal text/button palette; this is not a claim of a complete external WCAG audit.

Proposed Rules emulator: **39/39 PASS**.

Preserved legacy regression: **1501/1501 PASS**, including **688/688 Rules-related checks**. This count includes four compatibility suites against an archived published Rules snapshot as distinct compatibility contexts. Snapshot tests do not establish the current Production deployment state. Google Auth browser regression: **31/31 PASS**, included in the legacy total.

Combined executed regression: **1691/1691 PASS**. Combined Rules-related checks: **727/727 PASS**. JavaScript critical errors: **0**. New browser remote requests: **0**. Production writes: **0**. Lint/build and `git diff --check`: **PASS**.

Reproduction (Node 24, existing dependencies, local Firestore emulator, Playwright browser installed):

```powershell
npm run preview:melkak
# In another terminal, set PLAYWRIGHT_MODULE to the installed Playwright module if needed:
npm run test:melkak
npm run test:melkak-browser
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8097'
npm run test:melkak-rules
npm run lint
npm run build
git diff --check
```

Existing `test*` package commands explicitly load `tests/legacy-entry-loader.cjs` to direct legacy entry reads to `legacy-index.html`. Their functional assertions remain unchanged. The MELKAK suites exercise the new entry independently, without that loader. Do not use the legacy test loader when building the static site.

## Evidence and backup

Pre-change backup: `F:/SouqAlhalal-Backups/melkak-before-redesign-2026-09-13T07-33-37-274Z`

Backup manifest SHA256: `e5c95dd5789b63ba73862c69746a87bea669680a15ca4da595f7bcd39d9cd7b6`

The initial 177-file manifest is verified and retained unchanged. The main snapshot and all other dirty worktree patches/untracked files are preserved. Final logs and screenshots are stored separately under `final-verification/` in that backup, with their own manifest and SHA256.

Screenshots: `home-390.png`, `home-1440.png`, `categories.png`, `livestock.png`, `cars.png`, `listing-details.png`, `add-listing.png`, `my-listings.png`, `manage-listing.png`, `admin-dashboard.png`, `admin-mobile.png`.

## Release decision

**MELKAK MARKETPLACE PHASE 1: PASS — local prototype scope only.**

**SAFE FOR VISUAL REVIEW: YES.**

**SAFE TO MERGE: NO.** The branch deliberately replaces the entry with an isolated local prototype. Production integration and migration decisions are outstanding and not authorized in this phase.

Commit subject: `feat: introduce MELKAK multi-category marketplace prototype`. Push only `feature/melkak-marketplace-redesign`. No main push, merge or deploy.

Recommended next step: **Visual review only**.
