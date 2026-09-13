# MELKAK merge blockers fix

Approved Review state is preserved in `1b15e7e11eaf27a8b5bc1252946bcc777cc12943`. The six-country hero, sidebar and featured/latest fixtures are unchanged by this fix.

## Publication

The existing GitHub Pages source is `main` at `/`, using Jekyll rather than `npm build`. The root entry now defaults to production with an unconfigured datasource. It displays an Arabic setup notice without importing Demo application modules. `_config.yml` excludes legacy entries and Demo code. The legacy HTML was moved without content changes to `_legacy/legacy-index.html`; the isolated legacy test target continues to use it.

Review builds still require an explicit HTTPS Review origin and use an allowlisted artifact. The loopback server supplies explicit local Demo configuration. Production has no Demo fallback.

Actual local Jekyll 3.10.0 output was checked, not only a simulated exclusion list: 28 files, 81 exclusions, and 37 browser checks at the Pages project prefix. Forbidden legacy routes return 404; old hashes retain the safe entry. No external or Demo module requests occurred.

## Auth and policy

The Firebase Auth adapter reuses the existing default Firebase app and current UID. Google popup login, auth-state changes, token claims, user status, registry membership and assistant access are tested through injected SDK mocks. Missing, suspended or blocked profile status is inactive. Failed administrative reads cannot fall back to claim-only owner access. Legacy authentication code is unchanged.

Production bootstrap requires both the real Auth adapter and an explicitly supplied production datasource. No production datasource factory is wired yet; no live sign-in or production write was performed.

Creation checks stored account status. UI and service share republish policy: only an active owner, an owner-hidden clean listing and an enabled category qualify. Proposed Rules now also check category availability. Rules were tested with the emulator only.

Direct report resolution requires a reason dialog. Whitespace-only reasons are blocked; valid reasons are preserved exactly. Audit records include `actorUid`, `action`, `targetId`, `reason`, `timestamp` and `result`.

## Regression corrections

The approved showcase contains two Toyota listings in the UAE. The car-filter test now compares matching IDs, rejects a nonmatching brand and checks reset. Contact tests scope the detail panel rather than also matching related listings. Report tests follow the new mandatory reason step.

## Release boundary

This is a feature-branch fix, not a production release. A merge into the current Pages source would automatically publish the setup screen in place of the live marketplace. Therefore **SAFE TO MERGE: NO** until a final merge review explicitly resolves that release behavior. **SAFE TO DEPLOY PRODUCTION: NO**. Production datasource integration and its publishing/CSP configuration remain separate work.

No merge, deployment, production data write, Rules/index deployment, Android or Google Play change is part of this fix. Analytics and payments remain disabled.
