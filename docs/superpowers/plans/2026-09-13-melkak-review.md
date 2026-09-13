# MELKAK isolated review implementation plan
> Execute task-by-task with TDD and review checkpoints. User authorizes one final commit and feature push only.
Goal: publishable isolated REVIEW artifact, with PRODUCTION blocked.
Architecture: explicit immutable environment config; exact HTTPS review origin; separate demo datasource; static allowlist; no Firebase writers.
Spec: user attachment b9d61412-394c-49ee-9a5b-8ee9d762fdf1.
Constraints: no deployment, main push, real writes, billing, Android, payments or analytics.

- [x] Environment: write tests/melkak-review-guard.test.cjs. Simulate localhost, 127.0.0.1, configured HTTPS review host, mismatched host, production mode. Verify RED. Add runtime-config.js, environment.js and datasource.js; replace app guard and add explicit demo banner; GREEN.
- [x] Publish target: write tests/melkak-review-build.test.cjs; build in external temporary directory, assert legacy index/handlers/routes excluded, manifest exact, production build rejected. RED then scripts/build-review.mjs + explicit manifest + safe generic build dispatcher. Review source imports only required static dependencies. Separate legacy tests in dedicated temporary source target without monkeypatching reads.
- [x] Rules: tests/melkak-republish-rules.test.mjs against demo emulator. RED for moderation lock removal and admin-hidden republish. Restrict mutable keys, validate hide provenance, preserve moderation fields; GREEN for clean self-hide and republish, DENY locked/rejected/suspended/review-required/different owner. Production rules untouched.
- [x] Audit: tests/melkak-audit.test.mjs and browser form assertion. RED for missing exact reason/targetId/timestamp. Add common bounded audit recorder; thread reasons through all reason-requiring methods and show in audit table; GREEN.
- [x] Verification: separate legacy full suite and MELKAK suites, local Rules, review build, allowed origin smoke, forbidden routes, secret/output scans, lint, diff check. Independent review. One requested commit and feature push only after all pass.
