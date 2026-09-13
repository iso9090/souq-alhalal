# MELKAK final merge blockers

Scope: preserve the approved Review composition and fix only the reviewed publication, authentication, authorization and audit blockers. No merge, deployment, production writes or external configuration changes.

1. Archive and hash the 17 approved Review changes, run visual coverage, capture and push the approved state separately.
2. Make the repository root safe for the actual GitHub Pages branch-root/Jekyll publication. Preserve legacy HTML under `_legacy`, exclude legacy and Demo application code, and serve a readable maintenance entry until production integration is complete. Review remains a separate allowlisted build with explicit origin configuration.
3. Add a real Firebase Auth adapter using the existing project/default app and UID, token claims, user status, admin registry and access record. Never fall back to Demo roles in production. Keep the incomplete production datastore gated before SDK/network initialization.
4. Add failing tests for inactive creation, republish provenance/moderation/category parity, and mandatory report decision reasons. Fix service and UI using shared policy helpers. Test proposed Rules only with the emulator.
5. Preserve approved car fixtures; test the filter against matching country/category/brand records and reset behavior rather than the obsolete one-result assumption.
6. Run the complete legacy and MELKAK regression, emulator Rules, browser, responsive/accessibility, build/entry, lint and secret checks. Review all intended files; commit and push only the feature branch if checks pass.

Production readiness remains separate: the production datastore is not implemented, production root deliberately displays maintenance, and no production deployment is authorized. Final next step is another merge review.
