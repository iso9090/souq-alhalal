# MELKAK free moderation implementation plan

Goal: Preserve direct active publishing while adding private, lazy, locally hosted NSFWJS inspection and audited administrator moderation.
Architecture: Existing production services/Rules remain authoritative. A local classifier gates new/replaced images; its metadata never authorizes writes. Borderline images request replacement, model failures block save with retry and keep local draft. Existing report reason string stores selected category plus optional details (no new private data schema).
Authorization: User explicitly authorizes implementation, feature commit/push, main integration, Web and tested limited Rules release; no further approval required. Android is out of this Web scope.
Starting SHA: 7275cf74e5035733d487a26dbe3be0311aefe8dd.
Backup pointer: F:/SouqAlhalal-Backups/MELKAK-FREE-MODERATION-CURRENT.json.

- [x] Local ML: pin NSFWJS/TFJS, vendor JS/model/license and SHA manifest; pure decision tests first; lazy singleton loading, 0 external requests, sequential image checks and explicit retry. Wire app.js image picker and final save, preserve owner existing images, real model load smoke with benign asset.
- [x] Moderation service/Rules: add needs_review, audited image removal, owner-only final removal with tombstone for history. Preserve report/listing ownership and permissions. Emulator rejection tests before changes; production source composed only from verified current Rules plus tested delta.
- [x] Reports/admin UI: standard 8 reasons, optional detail, private reporter, links to listing/user, review/resolve/dismiss/hide/needs_review and image-removal actions. Strong reason/confirmation for Super Admin removal, no blank audits; local mocks parallel real service tests.
- [x] Verify: full 2302 baseline suite plus new targeted tests, Emulator, browser RTL/LTR six widths, model failure/borderline/duplicate submit, lint/build/secret scan/diff. Independent final review.
- [ ] Release: current Production logical/Rules/index backup verified, exact candidate baseline and limited Rules readback, feature commit/push/main integration, tests, Pages publish and read-only live smoke. Record no data writes/Billing/Analytics/Android changes in MELKAK_FREE_MODERATION_RELEASE_REPORT.md.

Decisions: high-confidence Porn/Hentai >= .95 rejects, >= .60 requests replacement; Sexy alone does not reject. These are conservative heuristics, not accuracy guarantees. Failure requires retry, never silently marked safe. Historical records retained, never bulk purge.

Final pre-release verification: 2351/2351 across 97 suites, Rules subset 670/670 plus exact transition moderation 10/10. Real model smoke 4/4, local artifact with real Firebase read-only 27/27. Independent security/UI review completed, including lazy report targets and revoked-permission races. No Production data writes. Release report/evidence maintained in the dated external backup directory.
