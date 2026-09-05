# Email authentication and account deletion — 2026-09-05

## Current implementation
Firebase project remains souq-al-halal-9e3e8 (number 227281181881). Official Identity Toolkit admin config was read using the existing Firebase CLI OAuth session: signIn.email.enabled=true, passwordRequired=true, phoneNumber.enabled=true. No provider setting was changed, no Auth user created/deleted, no real password-reset email or SMS sent during testing.

Email signup/login/reset use the official Firebase APIs. The Auth observer and signup initialize the profile transactionally by UID to tolerate races. Email signup sets name and a buyer/seller account type; existing phone profile defaults and user-selected account roles remain. Email verification is not enforced. No automatic linking. If profile storage fails after Auth success, UI reports that truthfully and lets the user complete their profile.

Firestore users store only existing allowed account metadata, with optional phone. Email is read only from currentUser for the owner's Account screen, never copied into marketplace data/privateContacts. Passwords stay in normal input/call scope, are cleared after requests, and are not logged or stored in Firestore/custom local storage. Firebase's own Auth session persistence remains unchanged.

Phone Auth/reCAPTCHA/+971/+20 remain, with a billing-not-enabled email fallback. Direct-sale contact sharing remains accepted-offer gated; records may omit phone and show an Arabic message to continue in-platform. New auction/listing writes no longer carry seller phone; bids blank the legacy lastBidderPhone value instead of publishing the new bidder's phone. Existing production legacy fields were NOT migrated and remain a privacy concern requiring separate review.

## Deletion request schema and authorization
`accountDeletionRequests/{uid}`:
- userId = authenticated UID
- status = pending
- createdAt/updatedAt = server timestamp
- No email, phone, password, free text, arbitrary fields or admin flags.

Owner may get their request (including a missing document), query only their own records and create once. Deterministic UID ID + transaction prevents repeated clicks/tabs overwriting requests. Users cannot update, approve, complete or delete requests. Admin claim may read the queue and transition pending/in_review → in_review/completed, with processedBy=admin UID and processedAt/updatedAt=server time. UserId/createdAt cannot change. No client cascade or Auth deletion is shipped. PrivateContacts read gates are unchanged; only phone omission on create is newly supported.

## Operational handling — trusted administrator responsibility
Support mailbox: soqalhalal9@gmail.com. Developer/store identity: WAL DIGITAL. In-app requests are stored in Firestore; they do NOT automatically send email or notify staff. Staff must monitor `accountDeletionRequests` in the authorized Firebase Console, alongside the support mailbox. The existing service-admin panel is unchanged; no automatic deletion processor exists.

1. Validate the authenticated request UID, or verify ownership of an emailed request without ever requesting password/OTP. An arbitrary email alone is not proof of ownership.
2. Review every linked record and active auction/dispute before changes. Confirm handling scope with the requester through the official channel. Establish staff ownership and review cadence before Play submission.
3. Carry out a separately reviewed trusted cleanup: remove/anonymize users, public animal data and embedded data-URL photos; review auction currentPrice/lastBidder identity without corrupting historical outcomes (there is no separate bids collection in current code); remove unnecessary personal fields in purchaseRequests, conversations/messages/privateContacts and serviceRequests. Parent document deletion does not cascade into Firestore subcollections. Preserve counterpart rights and only justified audit/retention data with documented scope and expiry.
4. Coordinate Firebase Auth deletion/session revocation only with coherent cleanup; never strand Firestore records by deleting Auth first as a shortcut. Do not mark completed until processing actually completed. There is no automated completion action in the public UI.
5. Inform the requester of completion and retained categories/reasons. No guaranteed timeline is published until operations can support it. Define retention for the deletion audit record too; current rules prevent end-user deletion of audit state.

This batch did NOT execute any cleanup, data migration, Auth deletion or production request creation. The page and account UI accurately say “request”, not instantaneous erasure. External URL: https://iso9090.github.io/souq-alhalal/delete-account.html.

## Play documentation addendum (Android files intentionally untouched)
The earlier Android-local PLAY_STORE_DATA_SAFETY.md / PLAY_STORE_SUBMISSION.md / ACCOUNT_DELETION_PLAN.md remain historical and require final owner review with this addendum:
- Email address is collected/processed by Firebase Auth for email-based accounts; optional alternative to required phone on phone-based login, encrypted in transit, purpose authentication/account management, not public marketplace contact. Firebase is a provider; evaluate Google's sharing exceptions rather than claiming no processing.
- UID and timestamps in deletion requests are additional account-management/audit processing; not erased immediately on request.
- Support email is now real and published: soqalhalal9@gmail.com. Store developer identity WAL DIGITAL.
- In-app and external request paths now exist; staff cleanup is manual, not a deployed deletion backend. Confirm operational response capability before claiming the requirement is satisfied in Play Console.
- Other data categories remain as documented: listings/photos/messages/activity in the marketplace, manually entered region/city, no native GPS/contacts/microphone permission, no real payment-card collection. No new analytics/ads/crash SDK. Firebase/reCAPTCHA technical processing still needs accurate disclosure review.
- Remaining Play work: signing/upload key and signed AAB, real-device Samsung camera/gallery/login/deletion/navigation testing, final Data Safety, UGC reporting/blocking, store screenshots, developer identity/contact verification and testing-track requirements in the owner's Console. No Play upload performed.

Sources: [Firebase password auth](https://firebase.google.com/docs/auth/web/password-auth), [Firebase users/reset](https://firebase.google.com/docs/auth/web/manage-users), [Play deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111), [Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469).

## Validation
Firestore emulator: 51/51; UI/source suite: 83/83; original responsive/payment browser suite: PASS; email/deletion browser suite: 16/16. All Auth/signup/reset/phone and database actions in browser tests are mocked; rules tests use only the demo emulator. No production test accounts, messages, SMS or reset emails were created. Mobile admin header overflow was corrected in launch.css.

Production Rules deployment: Firebase CLI displayed souq-al-halal-9e3e8 immediately before `deploy --only firestore:rules --project souq-al-halal-9e3e8 --non-interactive`; compilation and release succeeded on 2026-09-05. No Hosting/Functions deployment and no provider/billing/data changes were performed. Emulator PERMISSION_DENIED logs are expected denial assertions; no deployment warnings appeared.
