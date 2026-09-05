# Local tests only

- Install package.json dev dependencies locally (`npm install`).
- `npm test`: country isolation, legacy behavior, prices, promotion ordering, UI security and payment link guards.
- Start the Firestore emulator on 127.0.0.1; set FIRESTORE_EMULATOR_HOST=127.0.0.1:8185 and run `npm run test:rules`. The suite rejects non-loopback hosts and uses demo-souq-launch only. It clears that emulator project before seeding test fixtures. Never point tests at production.
- Optional browser checks: install Playwright externally, set PLAYWRIGHT_MODULE to its module path if needed, and run `node tests/browser.test.cjs`. Uses installed Edge headless. All page and Firebase requests are intercepted locally; unexpected external requests fail. Tests anonymous/signed-in demo, pending/unpaid filtering, safe text, unchanged payment state, errors, mobile/desktop layout and the homepage. Screenshot goes to the OS temp directory.
- `node --check app.js`, `node --check market-ui.js`, `node --check payment-demo.js`; `git diff --check`.

No SMS, live service requests, live data edits, credentials, or real payment calls are used. Auth behavior in browser checks is mocked; real Phone Auth delivery and production deployment of Rules are not tested.
