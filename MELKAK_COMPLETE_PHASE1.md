# MELKAK — complete multi-country classified marketplace, phase 1

**LOCAL VISUAL + FUNCTIONAL PROTOTYPE. Not a Production release.**

Branch: `feature/melkak-marketplace-redesign`.

Starting feature commit: `3033dc1f16e1d3cea99ae55fd64d373a31588ce5`.

Latest main confirmed by fetch: `940e705542802ec5945f3848a453abfe0c1205c1`. It remains the feature's base; the existing feature was continued without resetting or losing earlier work. Other worktrees were not changed.

## Review locally

Run `npm run preview:melkak` and open **http://localhost:8786/**. Use the explicitly labeled local role selector to preview normal user, Super Admin and assistant permissions. Demo campaigns and listings do not represent real offers. Changes are in memory and reset on reload; favorites/read state remain local to the preview UID.

The initial home shows the six-country MELKAK Hero. Ten sample Hero requests are pending, so they do not replace the default banner until approved locally. Approved current campaigns appear in the large Hero area, up to ten, with one selected image displayed. Side, middle and footer samples are labeled promotional/local demo. Calls, WhatsApp and promotional links on seeded fixtures are intercepted to avoid real external actions; contact URLs on newly entered listings require explicit consent.

## What changed in this iteration

- White, light sky blue, teal/blue and soft gold identity. Light right admin sidebar, red-outline danger states, keyboard focus and disabled styling. Text logo has no camel; no domain, app-store claim or claim of deleting legacy data was copied from the references.
- A 1536 × 512 six-country decorative Hero WebP, approximately 88 KiB. HTML text, country buttons and country/city/category search remain usable over it. [Asset provenance and exact generation prompt](melkak/ASSET_PROVENANCE.md).
- Home hierarchy: Hero/search, larger featured cards in their own aligned grid, ten category icons, standard latest listings, right desktop promotional sidebar and full-width mobile promotional blocks. Featured-first sorting and expiry remain read-time behavior, with no deletion of listings.
- Navigation for home, all listings, categories, featured, contact/about and account, while keeping Google/Email/Phone Auth code unchanged. Support details are explicitly pending rather than fabricated.
- Six countries and correct per-listing currency; old UAE city data preserved. Ten configurable categories. Added optional kids suitable age and furniture color. Category-specific search filters are cleared when moving to another category.
- Existing seven-step listing wizard, 1–3 compressed JPEG images, device picker, preview, replace, delete/reorder/main, last published image protection, gallery, favorites, My Listings and owner management retained and regression-tested.
- Featured requests now store 7/15/30/custom 1–365 days and requested start. Super Admin approval starts at the later of approval time or the chosen future time. It writes `featuredStartAt`, `featuredEndAt`, `featuredDurationDays` to local records. Reject leaves the listing normal. Less than 48 hours is expiring; the end boundary is expired. Missing legacy dates are displayed as unspecified, never invented.
- Bump uses `bumpedAt` for newest ordering and preserves original `createdAt`. Payments remain disabled. Exceptional unpaid approvals remain Super Admin only.
- Separate local commercial request schema and flow: placement, advertiser, title, description, HTTPS CTA destination, image, country target, dates, priority. Selected JPG/PNG/WebP is compressed using the preserved image compressor. Pending requests are never public; owner approval, rejection, pause and resume are local. No Cloudinary URL entry or secret, no real upload backend or Firestore image write.
- Country/optional city targeting is applied before selecting placement slots. Wrong-country, future, pending, paused and expired promotions are hidden. Zero active Hero ads uses default MELKAK; 1–10 use campaign slides, 11th excluded. User listing schemas are not reused for commercial requests.
- Commercial map shows all ten Hero slots, three side slots, middle and footer, advertiser/country/status/start/end and state colors. It uses cards rather than a large management table. Featured active/expiring/expired and commercial pending/active/expiring/expired counters derive from local records and the admin country filter.
- Reports support listing/user entry, review, dismissal, hiding, suspension and escalation with the existing permission names. Commercial administration and category configuration retain the existing prototype's owner-only policy; no new delegated permission was invented. Owner accounts cannot be suspended; moderation hides lock owner republishing and retain records.
- Audit entries include actor, action, target, timestamp and result, excluding contact details. Analytics displays “جمع الإحصاءات غير مفعّل حاليًا”; payments/analytics remain false.

## Isolation and remaining production work

All new mutations use the local in-memory store. No Firebase SDK/network requests are made by the prototype. Real Google Auth and legacy account data are preserved in the old application, **not connected to this prototype**. The local role selector never changes Firebase claims or users. No collections were deleted, migrated or written. No Firebase configuration, root `firestore.rules`, Auth logic, Billing/Blaze, Functions, Android, applicationId, Google Play or payment changes.

The pre-existing `legacy-index.html` and original app modules remain preserved. Existing legacy functional tests use the explicit legacy-entry loader; the new browser suites test the new entry independently. Historical compatibility snapshots are tested as snapshots, not asserted to be today's Production state.

`melkak/firestore.proposed.rules` is a separate emulator-only listing/category schema proposal. This iteration adds bounded kids age and furniture color fields. It is excluded from the static build and was not deployed. It is **not** a complete production Rules proposal for the new featured/commercial/report operations. Remote permanent deletion remains denied pending integration with historical-record safeguards. New multi-country data access/search, trusted permission enforcement for new operations and existing authenticated-session integration remain future approval work.

No automatic expiry writer, polling, paid search service or billing integration is present. Current search is over bounded local fixtures; a bounded indexed production query/token plan is still required before rollout.

## Validation

- Preserved legacy regression: **1501/1501 PASS**, including Google Auth browser **31/31** and **688 Rules-related checks**. The legacy total includes four archived published-Rules compatibility contexts; they are not additional live Production tests.
- Existing local MELKAK model: **68/68 PASS**.
- MELKAK browser regression: **83/83 PASS**.
- Complete phase-1 domain tests: **52/52 PASS**.
- Complete phase-1 browser tests: **42/42 PASS**.
- Proposed listing Rules emulator: **42/42 PASS**.
- Total executed regression: **1788/1788 PASS**. Rules-related total: **730/730 PASS**.
- Browser widths: 360, 390, 430, 768, 1024, 1280, 1440. Desktop/tablet/mobile, RTL/LTR, keyboard/focus, labeled forms, image alt text, reduced motion, key text contrast pairs and overflow checks. These checks are not an external comprehensive accessibility certification.
- Critical JavaScript errors: **0**. New browser external requests: **0**. Production writes: **0**. Build, lint and `git diff --check`: **PASS**.

Reproduction with Node 24, installed Playwright/Edge and a local Firestore emulator:

```powershell
npm run preview:melkak
# Separate terminal; set PLAYWRIGHT_MODULE to your installed module if needed.
npm run test:melkak
npm run test:melkak-complete
npm run test:melkak-browser
npm run test:melkak-complete-browser
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8097'
npm run test:melkak-rules
npm run lint
npm run build
git diff --check
```

## Backup and screenshots

Backup: `F:/SouqAlhalal-Backups/melkak-before-phase1-2026-09-13T08-31-54-577Z`

133-file snapshot manifest SHA256: `27758751bddb3058e6543d409060ce9279a320117a8d4b12a401e3321ff7e47b`.

Includes the complete preceding feature source state, preserving the previous legacy backup separately. `.git`, `node_modules`, build/temp/dist and tool caches are excluded. Every manifest file was verified before edits. Final evidence is stored in a separate `final-verification` subfolder with its own manifest.

Screenshots cover all 18 requested views: home mobile/desktop, country selector, categories, livestock, cars, phones, details, add listing, My Listings, manage listing, favorites, admin home, admin listings, admin categories, featured management, commercial map and mobile commercial placements. Extra admin-mobile and commercial-request images are included.

## Decision

**MELKAK MARKETPLACE PHASE 1: PASS — local prototype only.**

**SAFE FOR VISUAL REVIEW: YES. SAFE TO MERGE: NO.**

Commit subject: `feat: introduce MELKAK multi-country classified marketplace`. Push only `feature/melkak-marketplace-redesign`. No main push, merge or deploy.

Recommended next step: **VISUAL REVIEW ONLY**.
