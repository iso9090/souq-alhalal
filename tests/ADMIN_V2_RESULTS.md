# نتائج اختبارات Admin Dashboard v2 — المراجعة النهائية

العدد السابق 226 = 87 UI + 52 قواعد قديمة + 30 قواعد إدارة + 42 Auth/Dashboard + 15 متصفح أساسي.
العدد الحالي 228 = 87 + 52 + 31 + 43 + 15، بعد إضافة اختبارين لانحدار إغلاق المزاد وظهور نتائجه. جميع الاختبارات محلية دون Production أو SMS.

## UI

| الاختبار | النتيجة |
|---|---|
| first visit has no active country | Pass |
| saved AE survives reload | Pass |
| saved EG survives reload | Pass |
| invalid saved country is rejected | Pass |
| legacy document defaults to AE | Pass |
| AE money uses AED | Pass |
| EG money uses EGP | Pass |
| AE phone normalization | Pass |
| EG phone normalization | Pass |
| invalid UAE phone rejected | Pass |
| invalid Egyptian prefix rejected | Pass |
| AE filter includes legacy AE | Pass |
| AE filter excludes EG | Pass |
| EG region/city filter includes EG | Pass |
| EG filter excludes AE | Pass |
| all regions/cities remain inside active EG market | Pass |
| listing form has country/region/city selectors | Pass |
| first visit is blocked until country selection | Pass |
| country selector persists only to localStorage | Pass |
| market filters have no all-countries selector | Pass |
| country switch reloads market immediately | Pass |
| listing defaults to active country | Pass |
| public auctions are constrained by active country | Pass |
| auction documents store country | Pass |
| offer rendering uses conversation country | Pass |
| accepted/rejected offer logic remains present | Pass |
| paid subscription gate is fully removed | Pass |
| expired or inactive subscription data cannot block selling | Pass |
| seller account type protection remains | Pass |
| account page shows the free plan | Pass |
| professional seller is future-only without payment UI | Pass |
| central AE service prices are correct | Pass |
| central EG service prices are correct | Pass |
| pending service is not approved or featured | Pass |
| approved service state is recognized | Pass |
| active featured listing is featured | Pass |
| expired featured listing is not featured | Pass |
| featured sorts before bumped and normal | Pass |
| bumped sorts before normal | Pass |
| duplicate pending uses deterministic request id | Pass |
| ordinary seller flow never writes approved service status | Pass |
| services page and cancellation UI exist | Pass |
| listing management loads owned service requests with authorized query | Pass |
| listing management no longer gets missing service documents directly | Pass |
| listing management renders all three service actions | Pass |
| non-owner listing management guard remains | Pass |
| admin UI trusts only Firebase custom claim | Pass |
| non-admin admin button starts hidden | Pass |
| admin panel exposes status country and service filters | Pass |
| admin approval uses transaction and trusted target fields | Pass |
| admin rejection supports optional bounded note | Pass |
| cancelled requests have no admin action buttons | Pass |
| new service requests start unpaid | Pass |
| unpaid UI is explicit | Pass |
| normal unpaid approval is disabled | Pass |
| admin-only panel exposes separate override action | Pass |
| override requires confirmation and allowed reason | Pass |
| override audit fields are written | Pass |
| override result is labelled without faking payment | Pass |
| paid approval remains separate | Pass |
| image attributes reject quote injection | Pass |
| jpeg compressed data remains accepted | Pass |
| HTML user text is escaped | Pass |
| demo link only for missing or unpaid pending | Pass |
| signup accepts email without phone | Pass |
| signup rejects mismatched confirmation | Pass |
| signup rejects blank name | Pass |
| signup rejects weak password | Pass |
| invalid email rejected | Pass |
| reset requires only valid email | Pass |
| Arabic auth error invalid-email | Pass |
| Arabic auth error email-already-in-use | Pass |
| Arabic auth error weak-password | Pass |
| Arabic auth error invalid-credential | Pass |
| Arabic auth error wrong-password | Pass |
| Arabic auth error too-many-requests | Pass |
| Arabic auth error network-request-failed | Pass |
| Arabic auth error user-disabled | Pass |
| Arabic auth error user-not-found | Pass |
| deletion status does not claim immediate erasure | Pass |
| no automatic auth linking or deletion | Pass |
| phone billing fallback retains SDK and country prefixes | Pass |
| private contact data has optional phone and no email | Pass |
| completed deletion wording reports administrative record not automatic erasure | Pass |
| in-review deletion wording remains truthful | Pass |
| generic introduction no longer names countries | Pass |
| market selector remains in header | Pass |

## Firestore existing

| الاختبار | النتيجة |
|---|---|
| legacy AE animal without country remains publicly readable | Pass |
| new AE direct animal succeeds | Pass |
| new EG direct animal succeeds | Pass |
| new direct animal containing sellerPhone is rejected | Pass |
| new AE auction matches its animal | Pass |
| new EG auction matches its animal | Pass |
| auction country mismatch with animal is rejected | Pass |
| legacy auction without country remains readable and biddable as AE | Pass |
| country of an existing auction cannot change | Pass |
| seller requests featured for own direct listing | Pass |
| duplicate pending request is rejected by deterministic id | Pass |
| seller requests bump for own auction | Pass |
| buyer cannot request service for seller listing | Pass |
| auction service cannot be disguised as animal target | Pass |
| wrong service price or currency is rejected | Pass |
| seller requests verification with bounded existing details | Pass |
| seller cannot create an approved service request | Pass |
| third party cannot read another user service request | Pass |
| seller can list only own service requests | Pass |
| owner can cancel pending request but cannot approve it | Pass |
| seller cannot self-set featured, bumped, or verified fields | Pass |
| phone protected before acceptance (buyer cannot read seller) | Pass |
| AE buyer creates pending offer | Pass |
| AE offer acceptance unlocks contacts atomically | Pass |
| third party cannot read unlocked contact | Pass |
| EG buyer creates pending offer | Pass |
| rejected offer does not unlock contacts | Pass |
| ordinary user cannot list all service requests | Pass |
| admin can list all service requests | Pass |
| featured approval requires atomic target update | Pass |
| bump approval updates request and auction atomically | Pass |
| verification approval updates request and animal atomically | Pass |
| admin can reject pending with optional note | Pass |
| admin cannot approve cancelled, rejected, or approved requests | Pass |
| admin cannot update trusted target without matching request decision | Pass |
| wrong owner and mismatched country fail during admin approval | Pass |
| normal user cannot forge payment override fields | Pass |
| admin normal approve unpaid is denied | Pass |
| admin explicit override unpaid is allowed and audited | Pass |
| paid approval is allowed without override | Pass |
| legacy request without payment status is unpaid and can be overridden | Pass |
| refunded request cannot normal or override approve | Pass |
| cancelled rejected and approved requests cannot override re-approve | Pass |
| auction creator cannot forge initial winner | Pass |
| conversation creator cannot unlock contact before accepted offer | Pass |
| bid enforces end time status increment seller and identity | Pass |
| user cannot self-grant admin or forge payment audit fields | Pass |
| email-only seller: marketplace and accepted offer retain contact privacy | Pass |
| email-only buyer: marketplace and accepted offer retain contact privacy | Pass |
| deletion request own UID create/read; forged UID/status/extra keys denied | Pass |
| deletion processing restricted to claim admin and preserves request identity | Pass |
| legacy purchase acceptance is seller-only and readable by each party without unlocking contacts | Pass |

## Firestore admin

| الاختبار | النتيجة |
|---|---|
| ordinary user cannot list users | Pass |
| admin can list users | Pass |
| ordinary user cannot moderate | Pass |
| admin action without atomic audit denied | Pass |
| suspend account | Pass |
| suspended owner cannot restore active | Pass |
| suspended seller cannot edit ad | Pass |
| block account | Pass |
| reactivate account | Pass |
| active seller can edit own ad | Pass |
| other seller cannot edit ad | Pass |
| remove one image with atomic audit | Pass |
| remaining image and other ad preserved | Pass |
| stale seller image array denied | Pass |
| seller cannot clear moderation lock | Pass |
| seller can mark active moderated ad sold but cannot reactivate it | Pass |
| seller cannot delete moderated ad and recreate it | Pass |
| last image requires needs_review | Pass |
| last image removed to review | Pass |
| seller cannot republish moderated ad | Pass |
| create report | Pass |
| duplicate report denied | Pass |
| reporter cannot review own report | Pass |
| reported seller cannot read reporter identity | Pass |
| admin report reviewing | Pass |
| admin report resolved | Pass |
| admin report rejected | Pass |
| admin reads audit | Pass |
| user cannot read audit | Pass |
| admin cannot edit audit | Pass |
| admin cannot delete audit | Pass |

## Auth and Dashboard browser

| الاختبار | النتيجة |
|---|---|
| phone billing fallback and provider switch 360 | Pass |
| native Back closes login/signup once without browser history changes 360 | Pass |
| RTL auth modes no overflow 360 | Pass |
| phone billing fallback and provider switch 1280 | Pass |
| native Back closes login/signup once without browser history changes 1280 | Pass |
| RTL auth modes no overflow 1280 | Pass |
| each missing password requirement prevents signup | Pass |
| both eye buttons toggle without submitting; live requirements satisfied | Pass |
| confirmation mismatch prevents signup | Pass |
| email signup without phone; name race safe, own identity, double click, admin hidden | Pass |
| logout and reset avoid account enumeration | Pass |
| login failure Arabic and password input cleared | Pass |
| email login succeeds | Pass |
| Account Back closes loaded/loading modal without reopening | Pass |
| deletion success feedback closes modal and signs out | Pass |
| pending re-login account warning, disabled action and non-admin denied | Pass |
| existing request handled without write or logout | Pass |
| email-only direct listing create/edit and optional service | Pass |
| email-only auction create, bid and purchase request | Pass |
| unaccepted direct conversation has no contact guidance | Pass |
| both participants without phone: accept offer, private contacts, messaging, no opponent email | Pass |
| accepted conversation missing other contact document has one guidance notice | Pass |
| accepted available phone suppresses no-phone notice | Pass |
| legacy accepted-offer recovery retained with missing no-phone contact | Pass |
| no credential persistence; custom-claim admin preserved | Pass |
| admin list, sequential audit transitions, completion cancellation/confirmation and filters | Pass |
| submit, close, logout and restored pending account 360 | Pass |
| account/deletion/messages/admin responsive and country switch preserves session 360 | Pass |
| submit, close, logout and restored pending account 1280 | Pass |
| account/deletion/messages/admin responsive and country switch preserves session 1280 | Pass |
| completed remains truthful; accepted purchase request without phone has messaging guidance | Pass |
| legacy accepted purchase without offers/contact unlock; async and repeated buyer | Pass |
| legacy accepted purchase without offers/contact unlock; async and repeated owner | Pass |
| legacy accepted empty private phone remains guidance without unlocking reads | Pass |
| legacy accepted request uses existing allowed counterpart phone | Pass |
| pending and unrelated accepted requests do not establish acceptance | Pass |
| auction never renders direct contact guidance | Pass |
| sold and declined auction results remain visible while moderated ads stay hidden | Pass |
| dashboard seven tabs, real aggregation adapter, RTL mobile and desktop | Pass |
| dashboard user search, details, suspension and reactivation write audit | Pass |
| dashboard removes only selected image and records hash without base64 | Pass |
| dashboard report creation and administrative review | Pass |
| new dashboard denies ordinary user | Pass |

## Basic browser

| الاختبار | النتيجة |
|---|---|
| layout about 360 | Pass |
| layout privacy 360 | Pass |
| layout terms 360 | Pass |
| layout refund-policy 360 | Pass |
| layout delete-account 360 | Pass |
| layout payment-demo 360 | Pass |
| layout about 1280 | Pass |
| layout privacy 1280 | Pass |
| layout terms 1280 | Pass |
| layout refund-policy 1280 | Pass |
| layout delete-account 1280 | Pass |
| layout payment-demo 1280 | Pass |
| authenticated filtering, XSS, simulation preserves unpaid | Pass |
| network error | Pass |
| main page offline load | Pass |

Syntax: app.js, admin-dashboard.js, market-ui.js, payment-demo.js, tests/admin-rules.test.mjs, tests/auth-browser.test.cjs — Pass.
git diff --check — Pass. هذه الفحوص الإضافية غير مشمولة في عدد 228.
