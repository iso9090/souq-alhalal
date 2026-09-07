# User & Seller Experience Audit — 2026-09-07

This is the prior 471-test local audit. The subsequent My Bids fix supersedes the limited My Bids design and the Rules-unchanged statement below. See MY_BIDS_FINAL_FIX.md for the actual Production read-only schema findings, local Rules addition, compatibility requirement and final verification.

Result: PASS for the local improvement and regression scope, with the product limitations below requiring manual review. No production acceptance or live SMS test is claimed.

Branch: `user-seller-experience-improvements`, based on synchronized main/origin/main `89a23b75fb8e8152b4d89ff2aa2ca5527383ac75`.

Backup: `F:\SouqAlhalal-Backups\souq-alhalal-before-user-seller-experience-2026-09-07-011200` — all 47 files outside .git/dependencies/generated caches copied and SHA256 verified before editing.

Review evidence: `F:\SouqAlhalal-Backups\souq-alhalal-user-seller-review-2026-09-07-013143` (baseline/final logs, screenshots and screenshot SHA256 manifest).

## Verified test totals

| Suite | Baseline | Final |
|---|---:|---:|
| UI | 87 | 87 |
| Admin permission model | 18 | 18 |
| Migration planning | 24 | 24 |
| General Firestore Rules | 52 | 52 |
| Admin V2 Rules | 31 | 31 |
| Assistants / owner protection Rules | 69 | 69 |
| General browser | 15 | 15 |
| Auth / Admin browser | 110 | 110 |
| Assistants browser | 26 | 26 |
| Buyer / seller browser | 0 | 39 |
| **Total PASS** | **432** | **471** |

Rules tests use loopback Firestore emulator and demo projects only. Browser suites replace all Firebase APIs with local in-memory fixtures and reject external traffic. Critical JavaScript exceptions: 0. Happy-path Console errors: 0. Deliberately injected offline failures are separately tested and may produce expected diagnostic logs; they are not hidden as successful network calls.

Syntax checks passed for app, existing Admin modules, test/preview modules, and the two inline scripts. `git diff --check` passed. No existing test removed or weakened.

## Findings and bounded changes

- Fixed the `auctionCountry` variable scope in the BID_TOO_LOW error handler; previously the handler itself could throw a ReferenceError. Missing auctions now have a specific Arabic message. Auth architecture and bid transaction fields are unchanged.
- Reset hidden auction required fields after successful auction creation so the next direct listing can submit. Draft data survives validation and image decoding errors. Existing in-flight guards now display saving feedback and restore labels; profile saving is guarded too.
- Added visible labels to listing controls and accessible filter names without changing country/city options. Kept the existing type/name model and fields; no schema migration.
- Image previews can remove individual files before saving, preserve a previous valid selection on invalid/over-limit picks, revoke preview object URLs, and show decoding failures. Existing five-image, 640px JPEG compression and 650000-character total limits remain. Missing/broken images have text fallbacks. Screenshot images are existing repository imagery in local fixtures only, never production listing changes.
- Profile success stays visible; closed/superseded profile saves do not reopen the screen. Request/listing reads are guarded against stale navigation. Failed requests replace loading with retry/back controls.
- Old purchase records omit country. Their display currency is resolved read-only from the related public animal; missing source records show an explicit unknown-currency notice instead of incorrectly defaulting to AED. Neither requests nor schema are migrated.
- Added read-only public listing/auction details with gallery, saved seller name, prices, description, status, action buttons and internal Back. Existing purchase/bid/owner checks remain authoritative. Details update after a successful bid and share the existing expiry timer.
- Added an explicitly limited My Bids view using `auctions.lastBidderId == current user`. It shows only the last recorded bidder, never fabricates past bids. Native WebView Back returns from bid/request details to their originating list.
- Stale market responses no longer overwrite a newer filter load. No framework, dependency, Auth model, permission model, or Firebase project changes.

## Journey results and limits

| Area | Result | Evidence / remaining limit |
|---|---|---|
| Login/logout | PASS locally; FINDINGS for live provider verification | Existing email, validation, reset, phone billing fallback, ordinary-user denial and Back tests pass. No real OTP/reCAPTCHA challenge, fresh-device persistence, or Authentication configuration change was attempted. |
| Profile | PASS; FINDINGS for absent fields | Name/account type save and feedback tested. Email identity remains private and unchanged. Current profile form does not persist user region/city or subscription expiry; none invented. |
| Add listing | PASS | Required fields, negative prices, direct create, linked auction create, draft retention and post-auction reset tested. |
| Images | PASS | One/five/over-limit images, removal, invalid type, corrupt file, JPEG compression, reset and saved-image fallback tested. Desktop browser file picker simulated at mobile viewport; no claim of physical iOS/Android picker testing. |
| Direct sale | PASS | Existing seller ownership, creation and owner edit tested. |
| Purchase requests | PASS | Own purchase prevented; simultaneous/repeated UI submissions guarded; seller receives and accepts request in mock. Deduplication is client-side, not a guaranteed cross-device anti-spam transaction. |
| Auctions | PASS | Creation, current price, min increment, expired/inactive/missing states and detail refresh tested. |
| Bidding | PASS | Low bid, valid bid, missing auction, inactive auction, ended auction and owner bid tested; existing Rules tests protect writes. |
| My listings | PASS | Only the authenticated seller's listings; direct/auction status, management and empty state. |
| My bids | FINDINGS | Only auctions whose current lastBidderId matches the user. Full historical participation/amounts cannot be reconstructed from current data. A separate approved history/backend design is required for that feature. |
| My requests | PASS | Buyer query, currency, saved seller name, statuses/date, detail/back, retry and empty state. |
| Filters | PASS | Region + city + animal + sale type, reset and empty results. |
| Navigation/back | PASS | Modal back/close, nested My Bids details, existing Auth/Admin navigation regression and stale-request closing. |
| Desktop | PASS | 1280×900 and 1366×768, no horizontal overflow. |
| Mobile | PASS | 360×800 and 390×844, no horizontal overflow; physical-device review still recommended. |
| Security / Admin / Assistants | PASS | All existing model, Rules and browser suites pass unchanged. |

The new My Bids query is a single-field equality query, not a composite query. No indexes were changed or deployed. Live index exemptions were not inspected in this local-only stage.

## Local review

Run `npm run preview:mock`, then open `http://127.0.0.1:4174/`. The server binds loopback only, rewrites Firebase module imports to fixture APIs, and sends CSP `connect-src 'none'`. It seeds a normal test seller, not Admin. All actions affect an in-memory Map and reset on reload. The normal production entry point never imports these test fixtures.

Screenshots are under the review evidence directory above in `screenshots/`:

- home-market-1280.png
- listing-details-1280.png
- auction-details-1280.png
- add-listing-1280.png
- my-listings-1280.png
- my-bids-1280.png
- my-requests-1280.png
- profile-1280.png
- home-market-360.png
- listing-details-360.png
- auction-details-360.png
- add-listing-360.png
- my-listings-360.png
- my-bids-360.png
- my-requests-360.png
- profile-360.png

Files changed: app.js, index.html, launch.css, package.json, tests/user-seller-browser.test.cjs, tests/user-seller-fixture.cjs, tests/user-seller-preview.cjs, tests/USER_SELLER_EXPERIENCE_AUDIT.md.

Rules changed: NO. Firebase: UNCHANGED. Production: UNCHANGED. No Auth/custom claims or Production data writes, migration, merge, commit, push or deploy in this stage. Main and origin/main remain at the base commit.

Recommended next step: manually review the local preview and explicitly decide whether the limited My Bids view is acceptable before any commit/publish decision.
