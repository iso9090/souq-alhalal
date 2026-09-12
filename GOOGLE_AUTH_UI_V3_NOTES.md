# Google Auth + Marketplace UI V3 — local review

This branch is feature-branch review work. One commit and feature-branch push are
authorized after the September 12 local validation gate. No merge, deployment, Production data change,
Android change, account linking, claim mutation or Phone provider removal is authorized.
This document supersedes the V2 notes where they describe hidden Phone login,
three primary social buttons, or unconditional blocked-popup redirects.

## Scope and identity

- Starting branch: `feature/auth-market-redesign-v2`, clean at
  `333573f8568e1c6c2011e0cfe9cf65ddde44ff55`, two commits ahead of `origin/main`.
  The requested `a054caf0f942d421c52c4133960d122941b6dd92` is preserved in its history.
- Working branch: `feature/google-auth-market-ui-v3`.
- Verified backup: `F:\SouqAlhalal-Backups\souq-alhalal-before-google-auth-ui-redesign-2026-09-11-094354`.
- Backup branch: `backup/before-google-auth-ui-redesign-2026-09-11-094354`.
- Every one of 70 copied files matched its source SHA256. SHA256 of the adjacent
  `.sha256.txt` manifest: `C837D4EF0B9CDB35FBDA094998489D0DB065744ADEB3F8FDBF13B45681B9B994`.

The final approved September 12 image now guides the white header, green/gold camel
hero, market-first section order, compact filters, direct/auction tabs and cards.
The supplied reference is archived outside Git in the dated final review folder.
`marketplace-final.css` contains the final presentation overrides, including the red
auction treatment; existing tab selection and all market actions are preserved.
Six primary category chips are visible; all existing categories remain selectable
in the type filter and the listing form. Existing listing data drives cards and counts.
Google is the sole primary social button. Email signup/reset still work, and Phone
login is reachable through “طريقة دخول احتياطية مؤقتة”. Facebook/X handlers remain
available in source for compatibility, without primary buttons for disabled providers.

## Google profile writes and Rules review

`GoogleAuthProvider` and `signInWithPopup` use the existing Firebase web configuration.
Only new Google profiles receive `displayName`, `email`, `phone`, `accountType: buyer`,
`status: active`, `createdAt`, `lastLoginAt`, and `authProvider: google`, plus the existing
`uid` and optional legacy `phoneNumber`. A transaction at `users/{uid}` handles races
with the Auth observer. Existing Google sign-ins preserve names, email, account type,
status, creation time and provider metadata; normal login refreshes `lastLoginAt`.
Existing verified non-empty Auth phone numbers retain the pre-existing phoneNumber sync.
Inactive profiles are never reactivated or updated by sign-in.

The prior Rules allowlist rejects `email`, `phone` and `authProvider` on new users.
A narrowly scoped **local** Rules change is therefore necessary to meet the requested
schema. When these fields are supplied, all three are required, the token must be a
Google sign-in, email/phone must equal the authenticated token values, and account type
must be buyer. These metadata fields cannot be altered in client profile updates.
Legacy phone/email profile creation and all authorization paths remain unchanged.
No metadata field grants admin access. Emulator tests cover spoofing, cross-UID writes,
restricted accounts, legacy profiles and owner registry enforcement.

**The Rules file was not deployed.** Enabling Google alone does not allow the new
profile schema under the old deployed Rules. Do not publish this branch or attempt
new Production sign-in as a test. The branch also contains earlier V2 Rules changes;
any eventual Rules release needs a full comparison against the deployed ruleset,
not a blind deployment of this file.

Popup errors and cancellation show Arabic messages and restore controls. Google
and email submissions exclude concurrent submissions. WebView keeps browser/email
guidance. Redirect is attempted only when the site hostname equals the existing
Firebase authDomain. On GitHub Pages/localhost a blocked popup asks the user to allow
popups or use another login method. Cross-origin redirect needs a separately reviewed
hosting/proxy setup; mobile/WebView compatibility is not established by mock tests.

## Safe Google follow-up for the existing Phone owner

No owner account was modified or linked. The access mechanism remains the existing
`admin == true` custom claim, an active user profile, the protected
`adminSecurity/config.superAdminUids` registry and `adminAccess` permissions. Email
matching is not an authorization mechanism.

Future approved procedure, in a trusted workflow controlled by the owner:

1. Sign in using the current Phone account. Securely record/verify the current UID,
   active profile, existing custom claims, registered owner UID and access document.
   Retain the current working session and Phone method during validation.
2. After a separate explicit approval for the Production account change, use
   `linkWithPopup(auth.currentUser, new GoogleAuthProvider())` on that authenticated
   existing account. This links a provider; a separate `signInWithPopup` is not an
   owner migration. Reauthenticate the original owner if Firebase requires it.
3. If Google credentials already belong to another UID, stop. Do not delete accounts,
   merge business records, transfer claims by matching email or unlink Phone.
4. Confirm UID is unchanged, `phone` and `google.com` are linked, and refresh the token.
   Compare the profile, claims, registry, Super Admin access and business ownership
   with the snapshot. Normal provider linking should need no claim changes.
5. Sign in with Google in a separate browser session and verify the admin button,
   Dashboard, Users, Listings, Auctions, Reports, Services, Assistants, Audit Log and
   all Super Admin privileges. Test writes only in an isolated test environment.
6. If a different UID must ever receive privileges, prepare a separate reviewed plan
   using Admin SDK in a trusted environment, preserving existing claims and registry
   membership with rollback. Never use Admin SDK/service-account keys in the browser
   or commit keys to this repository. No such transfer was executed here.

**SAFE TO REMOVE PHONE LOGIN: NO.** Actual owner Google linking and real login have
not been tested. Even after validation, removing Phone still needs explicit approval.

## Read-only provider check and Android follow-up

After the user's manual activation, a fresh GET of Authentication configuration
confirmed Google **ENABLED**, Email/Password enabled and Phone enabled. No provider
settings, authorized domains, Android apps or certificate fingerprints were written.

Firebase's Android app listing contains the ACTIVE package `ae.sharjah.souqalhalal`.
The user identified the current Play application as `ae.souqalhalal.app`; a read-only
check of `C:\Users\asus\AndroidStudioProjects\SouqAlHalal\app\build.gradle.kts`
confirmed both `applicationId` and `namespace` equal `ae.souqalhalal.app`.
That separate Android checkout has pre-existing uncommitted changes; none were touched.
These are different Android identities and must be reconciled in a separate Android
review against the actual Play listing, project registration and existing signing
certificates. This discrepancy does not require changing Firebase's web configuration.
No configuration download or `google-services.json` replacement was performed.
No applicationId, namespace, SHA-1/SHA-256, keystore, Firebase Android registration,
Android build or Play upload was changed or created.

## Images and provenance

- `hero-livestock.png`: original retained livestock hero; existing remote Hero setting
  can still supply an approved photo. Used as a test fixture image in isolated QA.
- `logo-souq-alhalal.png`: original logo, header, auth card and favicon.
- `google-g.png`: unmodified official Google G downloaded from
  https://developers.google.com/static/identity/images/g-logo.png for the Google button.
- Listing cards: actual stored listing images using the existing gallery/safe-image
  adapter. QA uses explicit mock listings, never Production listings or invented live data.
- `concept.png`: retained visual reference, included in the static build and checked
  as a locally loadable image; it is not rendered as marketplace content.
- `inter.jpg`: retained in the repository; not referenced by the current homepage.

The three original PNGs were not modified. They were visually inspected; no independent
photographic provenance was supplied, so this report does not certify camera origin.
No cartoon replacement or generated image was added.

## Validation boundary

All browser fixtures intercept Firebase/network traffic. Google OAuth success, errors,
logout, repeat login, new profiles and registered Google admin access are **simulated**.
Firestore authorization is checked against the real local emulator with demo project IDs.
This validates application behavior and local Rules, not a live Google consent exchange,
SMS delivery, actual Production owner's Google access or the Android WebView.

Run existing `npm test`, `npm run test:browser`, `npm run test:v2-browser`,
`npm run test:live-browser`, `npm run test:rules`, plus `npm run test:google-browser`.
Rules tests require `FIRESTORE_EMULATOR_HOST=127.0.0.1:8185`; browser tests use the
existing Edge channel and external `PLAYWRIGHT_MODULE` path when needed.
`QA_OUTPUT` selects the screenshot folder. The V3 browser suite covers 1440×900,
1280×800, 430×932, 390×844 and 360×800, and explicitly checks image decoding and 404s.
Also run `npm run lint`, `npm run build` and `git diff --check`.

The September 12 gate permits commit/push with Google marked REQUIRES LIVE VERIFICATION
after all local checks and design review pass. Mock OAuth alone does not certify
real Google sign-in. Any further live test that writes Production
requires a separate decision; the current task explicitly prohibits such writes.

References: [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin),
[account linking](https://firebase.google.com/docs/auth/web/account-linking),
[redirect restrictions](https://firebase.google.com/docs/auth/web/redirect-best-practices),
[Google branding](https://developers.google.com/identity/branding-guidelines).
