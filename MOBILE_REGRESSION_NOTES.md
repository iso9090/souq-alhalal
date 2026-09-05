# Final mobile regression batch

Starting web HEAD: 5c7ae822e65a58091f377484a0136d8a059052cc; main was clean.

## Fixes
- Android previously used only WebView history or finish(), so a DOM modal could not consume Back. The exact marketplace HTTPS page is now asked through `souqHandleAndroidBack()`, which only closes the existing app modal and returns a boolean. No JavaScript interface, random DOM click, history change or privilege bridge. Native code serializes outstanding callbacks and coalesces duplicate presses for 250 ms, ignores callbacks after navigation/destruction, then falls back to existing history/finish behavior. Account loading cannot reopen a modal after it was closed.
- Both native chooser paths contained a mojibake literal. They now read the Unicode `image_chooser_title` resource: اختر مصدر الصورة. Camera intents, content URI handling, FileProvider and multi-select callbacks are unchanged.
- An unlocked direct conversation with a missing counterpart privateContacts document displayed only a preparation warning. It now displays the same in-platform guidance as a contact with no phone. Existing authorized phone rendering, locked conversation gating and seller accepted-offer recovery are unchanged. No email fallback.
- Generic hero/about/title/meta/benefit/footer copy no longer names the two countries. Actual selector, markets, location data, currency, admin filters and country-specific legal service prices remain unchanged.

## Exact Android source files modified
- app/src/main/java/ae/souqalhalal/app/MainActivity.kt
- app/src/main/res/values/strings.xml

Android remains a non-Git project. No Git initialization. Manifest and app/build.gradle.kts match the pre-change bytes; package ae.souqalhalal.app, versionCode 1, versionName 1.0, minSdk 24 and targetSdk 37 remain. Permissions in the packaged APK: INTERNET, CAMERA and the generated package DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION. Cleartext/mixed-content/file hardening and internal/external routing remain.

## Automated validation
- Firestore emulator 51/51 PASS; UI/source 87/87 PASS; auth/deletion/mobile browser 29/29 PASS; basic browser PASS at 360/1280. All Auth/database tests use mocks or the local demo emulator, never production writes.
- Android `clean lint test lintRelease assembleRelease bundleRelease`: BUILD SUCCESSFUL. Existing JVM test: 1 passed. Browser tests exercise Back contract loaded/loading login/account, rapid repeated calls, unchanged browser history, and accepted/missing/phone/legacy/unaccepted contact cases. This is not an instrumentation or physical-device result.
- Android lint: zero errors, 21 warnings per debug/release report (dependency/plugin versions, unused resources, icon recommendations and UseKtx). No unrelated upgrades made. Runtime Java/Netty native/deprecation warnings do not represent build failure.
- APK: app/build/outputs/apk/release/app-release-unsigned.apk. AAB: app/build/outputs/bundle/release/app-release.aab. Both unsigned; AAB has no JAR signing entries and APK fails signature verification as expected. No keystore created. Packaged resource dump confirms correct Arabic chooser title.
- app.js cache 60 → 61. CSS unchanged: style 47, launch 2. No Firebase deployment; firestore.rules unchanged. No production data/Auth/provider/billing/payment changes.

## Samsung SM-S926B manual retest still required
Install/run the updated Android project through Android Studio, then test:
1. Login/signup → Back closes modal and stays in app; try rapid double Back.
2. Account (including loading) → Back closes modal and stays in app.
3. Privacy page → Back returns to marketplace; no modal/history → normal exit.
4. Image chooser title is correct Arabic; Camera opens; Files selects an image that appears in the listing form.
5. Accepted no-phone conversation shows one guidance notice; messaging continues and email stays private.
6. UAE/EG selector still works; Egypt uses EGP/Egypt listings and UAE uses AED/UAE listings.

No physical-device pass is claimed for this patch. Existing deletion and unpaid/admin-service workflows remain. Actual deletion/retention/Auth cleanup stays a trusted manual operation. Remaining Play work includes release signing/key custody, signed AAB, identity/contact verification, final Data Safety/UGC review, store assets and testing/release-track requirements; no Play upload performed.
