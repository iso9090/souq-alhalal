# Local tests only

- Install package.json dev dependencies locally (`npm install`).
- `npm test`: country isolation, legacy behavior, prices, promotion ordering, UI security and payment link guards.
- Start the Firestore emulator on 127.0.0.1; set FIRESTORE_EMULATOR_HOST=127.0.0.1:8185 and run `npm run test:rules`. The suite rejects non-loopback hosts and uses demo-souq-launch only. It clears that emulator project before seeding test fixtures. Never point tests at production.
- Optional browser checks: install Playwright externally, set PLAYWRIGHT_MODULE to its module path if needed, and run `node tests/browser.test.cjs`. Uses installed Edge headless. All page and Firebase requests are intercepted locally; unexpected external requests fail. Tests anonymous/signed-in demo, pending/unpaid filtering, safe text, unchanged payment state, errors, mobile/desktop layout and the homepage. Screenshot goes to the OS temp directory.
- `node --check app.js`, `node --check market-ui.js`, `node --check payment-demo.js`; `git diff --check`.

No SMS, live service requests, live data edits, credentials, or real payment calls are used. Auth behavior in browser checks is mocked; real Phone Auth delivery and production deployment of Rules are not tested.

- `node tests/auth-browser.test.cjs` (same Playwright setup): all Firebase APIs mocked; real auth/create/reset endpoints cannot be reached. Tests Email signup/login/reset/fallback, no-phone direct/auction/bid/purchase/services, accepted offers and continued messaging, UID deletion deduplication, privacy and both responsive widths. No credentials are persisted or logged by the mock.
- Updated complete Rules suite additionally exercises email-only seller/buyer contact acceptance and deletion request owner/admin isolation.

- Deletion follow-up: browser checks cover automatic logout/modal closure, pending/restored/completed Account states, graceful duplicates, non-admin denial, admin list/filter/audited transitions and completion cancellation. Rules assertions also reject owner completion and a forged processed timestamp. All data remains local.

- Mobile follow-up tests cover the narrow native Back web contract (including Account loading cancellation), unchanged browser history, missing/available/legacy accepted contacts and no guidance before acceptance. Browser fixtures never contact production. See MOBILE_REGRESSION_NOTES.md for Android build and physical-device limits.

- Legacy purchase-request regression: `updatePurchaseRequest` accepts a request without setting conversation.contactStatus. Old recovery only handles seller-approved structured offers, so an accepted purchase request plus ordinary text messages and no counterpart contact record was missed. Browser fixtures now reproduce this for both roles with delayed reads, empty/missing contacts, allowed request phones, unrelated/pending requests, auctions and repeated opening. Rules tests prove role-scoped reads and seller-only acceptance without unlocking privateContacts. Validation: rules 52/52, UI 87/87, auth/browser 35/35, basic browser PASS. Real production records were not inspected or changed; Samsung verification is still required. No rules/Android/CSS changes or Firebase deployment.
