# Google profile compatibility with deployed Rules

The deployed `users/{uid}` create allowlist accepts `uid`, `phoneNumber`,
`displayName`, `accountType`, `status`, `createdAt` and `lastLoginAt`. It requires
the authenticated UID, an active status, a buyer/seller/both account type and
server timestamps for both date fields. The newer repository Rules additionally
accept Google metadata, but those Rules have not been deployed.

Previously `ensureUserProfile` added `email`, `phone` and `authProvider` to new
Google profiles. Each of these names is outside the deployed allowlist, causing
`permission-denied` even after successful Google Authentication.

The client now creates a Google buyer profile with only `uid`, `displayName`,
`accountType`, `status`, `createdAt` and `lastLoginAt`; a nonempty authenticated
phone number uses the existing optional `phoneNumber` field. Google identity
metadata remains available through Firebase Authentication. No role, claims,
registry or administrative access is created by this flow.

Existing active Google profiles are read without login-time writes, preserving
all fields and timestamps. Blocked/suspended accounts remain rejected. The
existing Email/Phone login, signup, password reset and Google popup/fallback
configuration are unchanged. No local or deployed Rules are modified.

## Isolated regression check

`npm run test:profile-compatibility` runs the actual `ensureUserProfile` function
against both repository Rules and a deployed-Rules export in a local emulator.
Set `FIRESTORE_EMULATOR_HOST` to `127.0.0.1:<port>` and
`PRODUCTION_RULES_SNAPSHOT` to a trusted read-only Admin SDK JSON export with
`source: [{name: "firestore.rules", content: "..."}]`.

The test refuses to run without those inputs. It needs no credentials and uses
only demo projects in the emulator. It covers creation, repeated login without
writes, blocked/suspended accounts, self-escalation denial, existing owner
preservation, Email/Phone profile regressions and zero valid-flow errors.
The browser Google regression also verifies the minimal create payload and
existing-document login without writes. Run the full existing Rules and browser
suites alongside this check before a release.

Passing local Rules tests alone is insufficient to prove deployed compatibility.
Refresh the Rules export read-only and compare it with the tested snapshot before
resuming a release. This fix does not authorize a merge or any deployment.
