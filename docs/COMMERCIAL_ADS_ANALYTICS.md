# Commercial advertising and visitor analytics

Feature branch only. This change does not deploy Rules, indexes, Hosting or data.

## Data and access

- `commercialAds/{id}`: public creative fields, placement, priority, status, start/end timestamps and owner audit metadata. Active documents are publicly readable; the renderer also checks the schedule. Draft, pending, approved, paused, rejected and expired documents are private. Public clients cannot edit advertisements or their counters.
- `commercialAdContacts/{id}`: optional advertiser email and phone, kept separate from public creatives. Only the current Super Admin mechanism can read or write them. No email-based authorization.
- `platformTelemetry/config`: `{enabled, updatedAt, updatedBy}`. Absent or false means collection is off. A Super Admin can enable/disable collection in the analytics page. Anonymous clients may read only this configuration document.
- `analyticsSessions/{random32Hex}`: `startedAt`, `updatedAt`, `pageViews`, fixed section counts in `pages`, deduplicated ad ID arrays `views` and `clicks`. Anonymous clients cannot read these documents. Only Super Admin can read reports. Rules whitelist all fields and constrain monotonic updates, timestamps, event IDs and totals; deletion is denied.

The existing claim/registry/delegation checks remain authoritative. Assistant access is not expanded. Contacts and creative changes are saved together in an owner-only transaction. There is no public advertiser submission/payment workflow in this release.

## Presentation

Ten hero slides maximum; three side slots, one middle slot and five footer slots. Selection uses priority and the active schedule. A seven-second timer hides expired creatives without requiring cron. Paused/reduced-motion sliders do not auto-advance; focus and hover pause automatic navigation. Existing featured livestock listings remain a separate system.

Public active ads are read in batches of 100 without a silent total cap. Keep expired campaigns explicitly expired/paused to avoid unnecessary reads. The included composite index supports the active/priority query. Images use existing Cloudinary URLs with size/quality transforms; arbitrary image hosts and non-HTTPS targets are rejected. This does not introduce an upload service.

## Measurement and privacy

There was no usable existing GA4/Firebase Analytics source. No GA script, IP collection, fingerprint, account UID, email or persistent visitor ID is added.

A random ID lasts in sessionStorage for one tab's session, ending after 30 minutes of inactivity or at the UAE day boundary. A page view means an initial page load or section navigation. Reports count sessions, not unique people; opening another tab may count another session. Standalone informational pages are grouped under “other.” No reliable cross-device/browser unique visitor figure is claimed.

Views require at least 50% visibility. Views and actual clicks are deduplicated per ad per session. Writes are batched every ten seconds and flushed on clicks/visibility loss; unloads/network failures can lose events. A session has at most 1,000 page views and twenty unique ad IDs per event list. Rules allow at most twenty added page views per write. Bursts beyond the limits are rejected rather than accepting arbitrary totals. Global Privacy Control and Do Not Track disable collection.

**These are browser-reported estimates, not fraud-proof billing metrics.** Anonymous rules cannot prevent someone from creating many fresh random sessions. Collection defaults off; a trusted rate-limited collector and abuse controls are required before using counts for paid settlement or under sustained abuse. Do not label sessions as verified humans.

One document per session avoids a document per view. Reports currently aggregate paginated session documents accurately, so report read cost grows with retained sessions. At higher volume, introduce trusted daily aggregates and an explicit retention policy; do not enable unbounded daily dashboard polling. No such backend, billing dependency or retention job is deployed here.

## Release and verification

Do not deploy the entire repository Rules file blindly: earlier unrelated local Rules changes differ from Production. A future approved release must compare the current Production snapshot and apply only the reviewed commercial/telemetry additions, plus the required index. Existing Auth, owner protection and other collection rules must remain intact. Until then, commercial data may be unavailable on Production; the public page falls back to its existing content.

Run `npm test`, all browser regression scripts, `npm run test:commercial`, `npm run test:rules`, the profile compatibility and Dashboard V3 tests, lint, build and `git diff --check`. Rules tests must use the local Firestore emulator. Commercial browser tests intercept all Firebase/image traffic and use isolated fixtures. Screenshots are local examples, not evidence of Production campaigns or traffic.

Manual release review should include real campaign image quality, supported-browser keyboard/screen-reader use, index readiness, the privacy notice and expected traffic/read budget. No test campaign or analytics record should be written to Production.
