# MELKAK production datasource readiness

User-approved scope: connect the real Firebase architecture on the feature branch; no merge, deployment, migration, production write, Billing, Android or Google Play changes. Starting commit: de78ecc13b2ca425def3f5447edf073cd174517c.

## Design and sequence

1. Read-only production schema inspection. Store only sanitized field names/types and bounded counts outside Git. Legacy `animals` map to livestock, `sellerId` to ownerUid, and featuredAt/featuredUntil to start/end. Never infer contact consent from a profile phone number.
2. Add pure normalized models and a bounded Firebase read adapter. Keep Review fixtures isolated. Read legacy and new listings separately with provenance, merge normalized public/own views, and expose explicit unavailable capabilities when proposed collections are not yet permitted. Static country/category definitions are configuration, never fabricated listings.
3. Add asynchronous Firebase services, tested only with injected SDKs/emulator. New listings use marketplaceListings; new request/audit collections keep new writes separate from legacy data. Request creation and durable listing-history protection must be atomic. Legacy records stay read-only. Production write gate stays false throughout readiness.
4. Complete proposed Rules locally for new services, ownership, moderation, requests and administrative auditing. No deployed Rules changes. Preserve legacy code and published security configuration.
5. Reuse the approved renderer with an injected datasource/auth context; remove direct Demo imports from its production dependency graph. Await service mutations, subscribe to real auth, clear private data on logout, and render honest capability/error states. No local-role selector or fake data in production.
6. Wire production bootstrap, explicit runtime configuration and Jekyll-compatible publication/CSP. A correctly configured production entry can browse real data; incomplete configuration fails safely. Review build remains isolated and unchanged visually.
7. Verify adapters, real reads, SDK/emulator writes, all permissions, images, ads, featured expiry, production/review isolation, actual static publication, responsive/accessibility, secrets, lint and full regression in small batches.
8. If all pass, commit `feat: connect MELKAK production datasource architecture` and push only feature/melkak-marketplace-redesign. Final merge review only; no merge or deploy.

## Read-only observation

Project souq-al-halal-9e3e8 was read through the existing trusted local Firebase CLI identity. A bounded sample contains users and animals, four service requests and three adminAccess records. marketplaceListings, marketplaceCategories, commercialAds, commercialAdImages and reports returned no documents. This is not a migration and sampled counts are not asserted as collection totals.

## Release constraints

Production writes remain explicitly disabled until a separate Rules/configuration release review. Missing new collections or undeployed permissions must never trigger Demo fallback or silent optimistic saves. New write services are exercised only against emulator projects beginning with demo-.
