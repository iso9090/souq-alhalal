# FREE COMMERCIAL AD IMAGE STORAGE V2

Branch: feature/free-commercial-ad-images-v2
Starting main: c564ef5e2fb4c29da4e77cbfd1d1f390e51a6f4e
Status: PASS (local implementation). No merge or deployment.

## Storage and saving

commercialAds holds metadata, imageStorage=firestore and a version UUID, never Base64. commercialAdImages/{adId} stores adId, imageData, mimeType, bytes, width, height, version and updatedAt. The existing transaction atomically saves metadata, image and private advertiser contacts. Failure commits none of them; an existing image remains intact. Versions bind both documents in Rules and invalidate the page-session cache after editing.

JPG/JPEG/PNG/WebP are decoded on device and converted to bounded JPEG. Input limit 12 MiB / 24 megapixels; output <=61,440 bytes and <=1200px per dimension. Compression reduces resolution and quality as needed; the manager sees the final output before saving. SVG, executable, invalid and oversized input are blocked. The image is selected before save; remove clears the selection and prevents saving until replacement. Existing legacy images remain readable; the URL input is removed. Legacy URLs are restricted to Cloudinary HTTPS as before.

## Loading and reads

Metadata query unchanged; all images are separate. On a page with ten Hero ads, observed image document reads: current=1, next preload=1, images 3-10=0 initially. Visiting all ten uses 10 image gets total. Back navigation causes no additional get in the same page session. Side/middle/footer image documents load on viewport intersection (100px margin), proven with 3/1/5 fixtures. No image collection query, listener or polling. Images have reserved dimensions. Cache is memory for this page session, not a persistent disk cache across reloads.

Reads below concern commercial ads only, excluding the existing livestock/site queries:
- A matching ad metadata documents: approximately max(A,1) reads, plus query/index-entry charges and pagination where applicable.
- One available Hero: 1 image get; ten available but viewing only the first: 2 image gets including preload.
- Ten slides viewed: 10 image gets, plus dependent parent-document Rules reads (up to one per image request, subject to Firebase caching/billing behavior).
- Each newly visible side/middle/footer: one image get and potential parent Rules read.
- Add ad: 3 document writes (metadata, image, private contacts), atomic.
- Change image through this form: 3 document writes, atomic; image replaces same document, no accumulated versions.
This uses Spark quotas and does not provide unlimited free capacity. No billing changes.

## Security and cleanup

Existing commercialOwner checks remain: active owner with admin claim, registry membership and enabled adminSecurity config. Assistants are not granted new permissions. Normal users/assistants cannot write images. Public get requires an active parent within its dates; list is denied even to owner. Owner can read inactive images. Image payload format, size, MIME declaration, dimensions and matching version are checked in Rules. Rules do not decode JPEG or prove the pixels/dimensions; browser decoding/compression supplies that validation for authorized owners.

Pausing retains an attached, private image for reactivation; it is not an orphan. Parent deletion remains denied as before. Cleanup may delete an orphan or detached image only as owner; deleting an image while its parent references Firestore storage is denied. No automated cleanup service or new backend. The form never detaches a saved image without replacement.

imageData indexing exemption added in firestore.indexes.json. This exemption must be applied before enabling image writes in a release.

## Size safety

60 KiB JPEG -> at most 81,943 ASCII characters including the data URI prefix.
Using Firestore's documented string/document size formula: 82,194 bytes for a full-capacity image with normal 20-character ID and 36-character version; 85,182 bytes even allowing a 1,500-byte ID and 64-character version. Both far below 1 MiB. A noisy real decoded test image compressed to 49,525 bytes; its JSON representation was 66,259 bytes. The maximum-size synthetic payload was accepted by emulator and the oversized payload denied.
Reference: https://firebase.google.com/docs/firestore/storage-size
Quotas/pricing: https://firebase.google.com/docs/firestore/pricing

## Verification

Full regression: 1526/1526 PASS, including Firestore Rules 707/707.
New image browser: 31/31 PASS. New image Rules: 39/39 PASS.
Commercial integration: 45/45 PASS. Hero: 26/26 PASS.
Google browser: 31/31 PASS. Admin, assistants, notifications, livestock gallery, featured listings, listing actions, desktop/tablet/mobile/RTL and keyboard regressions passed.
JavaScript critical errors: 0. Lint: PASS. Secret scan: PASS. git diff --check: PASS.
Tests use mocks/emulator only; Production writes=0. Screenshots show local fixtures, not Production data.

## Release gate

SAFE TO DEPLOY RULES: NO until a fresh read-only Production baseline comparison and limited release review.
SAFE TO MERGE: NO until required Rules and imageData indexing exemption are deployed and verified in a separately authorized coordinated release. GitHub Pages publishes main automatically.
Firebase Auth, Android, Google Play, Functions, Billing/Blaze, Payments and Analytics: unchanged.
