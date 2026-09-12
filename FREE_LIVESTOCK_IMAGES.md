# Free livestock 3-image final verification

Branch: codex/free-livestock-images
Starting base: 0001ae00fa8a52aaf30a7b787c263462b88e2b58
Status: PASS for implementation. The limited Rules were subsequently deployed and verified; this feature is ready for the separately authorized web release. No billing, backend or Android changes.

## Production findings before the Rules release

Checked directly using authorized ADC/Admin SDK at 2026-09-12T19:01:18.571Z.
Ruleset: projects/souq-al-halal-9e3e8/rulesets/823cef39-7f48-4bfe-97a3-6a583f328b16
animals: 11 documents, maximum observed image count 1, legacy documents with more than 3 images: 0.
auctions: 5 documents, no independent images field; images belong to the linked animal.
Production writes: 0. No images or personal identifiers were exported in the aggregate count report.

The pre-release Production baseline had no explicit image-count cap in animal create or owner image update. No validListingImages helper exists there. Auction create validates the linked animal's ownership/type/country but does not validate its image count. Moderator removal only checked shrinkage, allowing a legacy count to remain above three. These findings describe the baseline before the approved Rules deployment.

## Local policy and release candidate

Create direct/auction: 1, 2, 3 distinct nonempty image strings allowed; zero, four or invalid schema denied. Image updates must result in 1–3 images; 1→2 and 2→3 allowed, 3→4 denied. Legacy reads and unrelated metadata edits remain allowed. Changing legacy images must reach 3 or fewer; 4→3 allowed, 5→4 denied. No migration or automatic deletion.

Existing moderator quarantine exception remains: removing the last violating image requires imagesLocked, moderationLocked, needs_review and the existing audit/permission checks. This does not permit an active listing without images. Moderator image changes also cannot leave more than three. Other moderation and Super Admin protections are unchanged.

Auction images must be stored in the linked animal; a new auction cannot introduce a separate images field or link a legacy four-image animal. No new helper exposes a second upload path.

The narrow release candidate adds only the image helper and animal/auction guards to the actual Production Rules. The complete repository Rules file contains pre-existing differences and must NOT be deployed wholesale for this release.
Release candidate: F:\SouqAlhalal-Backups\souq-free-livestock-3-image-final-2026-09-12T19-11-05-574Z\release-candidate.rules
Candidate SHA256: 409D821702F757E8CCD46C01D2964D32F7F92799025056A06265FFDF24C49E88
Read-only original: F:\SouqAlhalal-Backups\souq-free-livestock-3-image-final-2026-09-12T19-11-05-574Z\production-current.rules
Original SHA256: 51C5D439E46BCB278DE02632BE09C39D52613249D92C3546EAE5B3102C3DCA33
Before any future deployment, recheck that the Production ruleset has not changed.

## Free image architecture and gallery

The original pre-a054caf app used bounded JPEG data URLs in Firestore. Livestock now uses a separate livestock-images.js path, reusing the existing decoder/compressor. Input: JPEG/PNG/WebP, 30 MiB and 80 million pixels maximum. Output: JPEG, longest edge at most 1600px, 150 KiB per image, combined encoded length at most 650,000 characters. Three maximum images occupy 614,469 characters, leaving metadata headroom below the Firestore document limit. Client compression is not a server security boundary; unchanged ownership rules and the new count guards control writes.

No Cloudinary request or signing endpoint is needed for livestock; bytes are saved atomically with the existing authenticated listing write or auction batch. This works within Firestore free quotas, not unlimited storage/reads. No Blaze, billing or paid backend is required. Commercial ad upload security, analytics, Auth, payments and the paused Trusted Backend branch remain unchanged.

Market cards have one main image and two clickable secondary thumbnails for three images, one thumbnail for two, and no empty rail for one. Thumbnails select the main image and show an active border; arrows, keyboard and current/total counter work. Desktop rail is beside the main image; mobile rail is below it. The same compressed sources are reused without requesting larger versions. Gallery interactions do not write listing data. Featured Hero and other gallery callers keep their previous display mode.

## Verification

- Existing full regression: 1036/1036 PASS, including Google/email/phone and owner/admin/commercial tests.
- Free images and gallery browser checks: 36/36 PASS.
- Image Rules matrix: 58/58 PASS (29 repository, 29 release candidate).
- Additional candidate regression: 243/243 PASS (admin 31, assistants 112, commercial 55, release audit 45).
- TOTAL: 1373/1373 PASS.
- Firestore Rules subset: 668/668 PASS (367 standard + 58 image matrix + 243 candidate security).
- JavaScript critical errors: 0. Build/lint: PASS. git diff --check: PASS. Production writes: 0.
- Previous 2 failures belonged to the unpatched Production snapshot. They are not reclassified as passing: The approved Rules release described below subsequently closed that gap. New enforcement passes on repository Rules and the explicitly labelled release candidate.

Run npm run test:free-images for the isolated browser flow. Run npm run test:free-images-rules with FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 and optional RELEASE_RULES_CANDIDATE for the proposed release file. The optional --audit-production argument with PRODUCTION_RULES_SNAPSHOT deliberately applies strict assertions to an unpatched snapshot; that diagnostic is expected to expose the existing Production gap.

Evidence and local fixture screenshots: F:\SouqAlhalal-Backups\souq-free-livestock-3-image-final-2026-09-12T19-11-05-574Z
Rules release: completed and verified. Production SHA256: 409D821702F757E8CCD46C01D2964D32F7F92799025056A06265FFDF24C49E88.
Post-deploy verification: 301/301 emulator checks passed, including the downloaded Production Rules and repository reference checks; Production data writes: 0.
Rules release backup: F:/SouqAlhalal-Backups/souq-before-3-image-rules-deploy-2026-09-12T19-17-44-058Z
SAFE TO MERGE FREE IMAGES: YES following the approved Rules release.
