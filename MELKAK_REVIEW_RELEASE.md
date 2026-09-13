# MELKAK Review Release Readiness

PASS — isolated Review only. No deployment performed.
Branch: feature/melkak-marketplace-redesign
Starting SHA: bf83f8f10d723aa1d6c7f25edc7ca4b7481f0266
Main preserved: 940e705542802ec5945f3848a453abfe0c1205c1

## Environment and data
- Source runtime-config.js defaults to local/demo. localhost and 127.0.0.1 work.
- Review config is generated at build time with an exact dedicated HTTPS origin. An arbitrary external origin without matching config fails closed.
- Production mode always fails closed, including on localhost. Production datasource/config are not implemented; no demo-to-Production adapter was added.
- Review banner: معاينة تجريبية — بيانات غير حقيقية.
- Demo roles, sessions, listings, reports and audits live in isolated memory. Real Firebase Auth is not initialized by this artifact.
- No query string or localStorage switch enables Production or changes the configured origin.

## Review build
Run with the actual dedicated review origin (origin only, no path):

    npm run build:review -- --origin https://YOUR-DEDICATED-REVIEW-HOST --out NEW-EMPTY-OUTPUT-DIRECTORY

The verified smoke-test origin was https://melkak-review.example.org, simulated through a local static server; no public preview was deployed. Rebuild with the actual approved preview origin before deploying. Existing nonempty output directories are rejected to prevent stale legacy files; use a new --out directory.

- scripts/review-publish-manifest.json is the exact publish allowlist (34 static files).
- Artifact includes publish-manifest.json describing mode, origin, datasource and files.
- No legacy-index.html, root app.js, old admin handlers, payment pages, Firebase SDK, proposed Rules, tests, tools or reports are published.
- Public permissions vocabulary is projected to remove old auction/purchase labels in the review artifact. Original admin-permissions.js and its authoritative legacy behavior are unchanged.
- Review legacy route and store.legacyRead are unavailable. Old sources/data remain in the repository; review contains no old transaction records.
- npm run build and npm run build:production both fail closed. Do not bypass them for Production.

## Legacy testing
scripts/test-legacy.cjs constructs a separate temporary legacy fixture target from the preserved source; its entry is explicitly legacy-index.html. It never changes the repository index.html. The old compatibility loader no longer patches fs.
Legacy suite results demonstrate legacy compatibility only, not MELKAK release safety. Review safety is tested against the built artifact separately.

## Proposed Rules only
- firestore.rules, firebase.json, indexes and deployed Rules unchanged.
- Clean owner hide records hiddenBy=owner; clean self-hidden republish clears that marker.
- Republish denied for moderationLocked, admin-hidden, rejected, suspended, pending/needs_review, requiresReview and unknown hiding provenance.
- Ownership and immutable-field checks preserve moderation fields against deletion/replacement. Owner cannot inject moderation metadata on create.
- Existing hidden documents without a trustworthy provenance marker cannot be republished by this proposed client policy. No data backfill or migration ran.
- Remote permanent deletion remains denied. No Rules deployment.

## Audit
Every reason-requiring action validates a nonblank string of at most 500 characters before state changes. Exact reason is retained with actor, action, targetId, timestamp and result. Existing target/at aliases remain for compatible display. No extra contact or credentials are logged. UI audit table escapes reason text; UI-to-service-to-audit preservation tested.

## TDD evidence
- Environment RED 4/6 then GREEN 6/6: review rejected before fix, production-on-localhost incorrectly allowed before fix.
- Build RED: legacy-index.html present; GREEN 6/6 after explicit allowlist and production guard.
- Route smoke RED: admin legacy records accessible; GREEN 12/12 after Review exclusion.
- Legacy target RED: fs entry interception; GREEN 1/1 after explicit fixture isolation.
- Proposed republish RED 2/16: removing moderation metadata could reactivate; GREEN 16/16.
- Audit RED 14/42: missing exact reason and oversized reason accepted; GREEN 42/42.
- UI audit RED: reason absent from table; GREEN 3/3.

## Final verification
Legacy: 1501/1501 PASS (688 local Rules/snapshot compatibility checks included).
MELKAK and Review: 454/454 PASS.
Combined full regression: 1955/1955 PASS.
Rules subset: 746/746 PASS = 688 legacy + 42 existing proposal + 16 new republish.
Other new coverage: demo datasource 8/8, environment 6/6, build 6/6, smoke 12/12, audit 42/42, audit UI 3/3, target isolation 1/1.
Existing MELKAK: model 68/68, complete model 52/52, browser 83/83, complete browser 42/42, visual V2 43/43, final UI 30/30, Rules 42/42.
RTL/LTR, 360/390/430/768/1024/1440, keyboard/focus/accessible names and image/gallery regressions PASS.
JavaScript critical errors in allowed Review/local execution: 0. Deliberately denied environment/build cases are expected negative tests.
Lint: PASS (29 modules). Review build: PASS. Production build: expected exit 1.
Secret scan and exact artifact/legacy exposure scan: PASS. git diff --check: PASS.
Independent review: no outstanding blockers; nonempty-output protection documented.

## Isolation and next step
Production writes: 0. Production / Firebase Auth / deployed Rules / Android / Google Play / Billing / Blaze: UNCHANGED.
Payments / Analytics: DISABLED. No Merge, main push, Preview Deploy or Production Deploy.
Evidence: F:/SouqAlhalal-Backups/melkak-review-blocker-fix-2026-09-13T11-02-22-194Z
Commit and push receipt saved externally after the single requested commit.
SAFE TO DEPLOY REVIEW: YES — use the configured dedicated origin.
SAFE TO MERGE: NO
Recommended next step: REVIEW DEPLOYMENT ONLY
