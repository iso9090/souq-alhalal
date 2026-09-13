# Visitor analytics hardening — local, disabled

Base: 2af92a37db24ccfeec1f4dce83d8cd7c05b91cd2
Branch: feature/visitor-analytics-hardening

## Collection and privacy
`analyticsEvents/{128-bit-random-session-id}_{sequence}` is append-only. No mutable totals are accepted. A document is a single page/ad event, not an editable session counter. Sequence 0 identifies a session. All updates/deletes are denied, including another client's event. A guessed session ID does not authorize editing its records; anonymous callers are NOT cryptographically authenticated as owners of a session. New forged sessions, or appended events if an ID is known, remain possible. ANTI-TAMPERING = PARTIAL. Never use for advertiser billing.

Fields: sessionId, sequence, sessionStartedAt, occurredAt, kind, category, adId (public commercial-ad ID only, empty for pages). No account UID, email, phone, IP, fingerprint, precise location, query string, search text or user agent. The opaque session ID is per tab, not a person/device identity. Respect DNT and Global Privacy Control before starting. This describes application storage, not network-provider logging.

Categories: home, market, listing_details, sell, auctions, services, account, contact, about, other. Admin category ignored. Category transitions count; repeats of the same category, renders, duplicate listeners and reloads do not. A→B→A counts as real navigation. Transitions between listings without leaving the same category are conservatively deduped. Session expires after 30 minutes without a new accepted event or at UAE midnight. No personal route values persist.

Rules require exact schema, server occurredAt, bounded client session start (first within 5 minutes), sequential predecessor, less than 30 minutes since predecessor and same UAE date, max 100 events/session, valid category and no arbitrary counts. Consecutive duplicate page categories denied. Client pending buffer max 10 events, ad event dedupe, sequential writes; network failures can undercount. Storage clearing/multiple tabs can create additional sessions. No claim of unique people or tamper-proof metrics.

Old analyticsSessions are read-only. No migration or deletion. Raw legacy counters are not mixed with hardened event counts.

## Dashboard strategy
Visitor dashboard: 14 Firestore count() queries over today/7d/30d and fixed categories. No raw event download. Exact counts of stored eligible events, not proof of real humans. Pageview total is explicitly the last 30 days, not lifetime. No writable analyticsDaily counters; daily write-time aggregation is NOT SAFE WITHOUT TRUSTED BACKEND.

Three LOCAL proposed indexes: analyticsEvents(sequence,occurredAt), (kind,occurredAt), (kind,category,occurredAt), all ascending. No index deployment.

Commercial event summaries use a separate 30-day bounded query, max 1001 documents to detect truncation, displaying up to 1000. No polling. Ad event metrics remain approximate. The visitor screen does not use this raw-event query.

## Retention
Proposed raw-event retention: 60 days. Only the last 30 days are queried. No automatic deletion and no TTL enabled. A future separately authorized owner-run maintenance step should preview IDs/count older than cutoff, archive only if justified, then delete in bounded batches using trusted Admin SDK. There is no cleanup implementation or Production operation in this feature. Daily aggregates do not exist; a future trusted implementation could retain them longer. Without manual maintenance storage grows and can exhaust Spark.

## Cost model (not a permanent-free guarantee)
Per short session with one page and no ad events: 1 write; approximately 2 reads (public config + Rules config). Each extra accepted page/ad event: one write + up to 2 Rules dependent reads (config, predecessor). Thus W events gives approximately 2W reads and W writes, before retries. Visible ads also create events; a page with four visible ads can cost W=5, about 10 reads. Maximum 100 events per session is not a limit per human or attacker.

Visitor dashboard 14 aggregate requests. count() costs one read per up to 1000 matched index entries, minimum one/query. Assume stable 100 or 1000 sessions/day for 30 days, one page per session in one category:
- 100/day: about 20 aggregate read units + up to 28 Rules dependent reads + 1 config read = ~49.
- 1000/day: about 107 aggregate read units + up to 28 Rules dependent reads + 1 config read = ~136.
These exclude normal admin authentication/profile reads and any overview call before opening analytics. Overview currently also requests the aggregate summary, so opening both can approximately double analytics reads.

Collection at 100/day: ~100 writes/200 reads for minimal one-event sessions; at 1000/day: ~1000 writes/2000 reads. Five-event sessions: ~500/1000 and ~5000/10000 respectively. All quotas are shared with marketplace traffic and maintenance. Spark is CONDITIONAL on traffic, storage, retention and abuse; no Blaze required by this design. No budget guarantee.
Sources: https://firebase.google.com/docs/firestore/pricing and https://firebase.google.com/docs/firestore/query-data/aggregation-queries

## Release gates
ANALYTICS_RELEASE_ENABLED=false. telemetryOn hard false. No Production platformTelemetry/config created. Production writes=0. No merge, deploy, Billing, Blaze, Functions, Android or Google Play changes.
SAFE TO ENABLE FREE ANALYTICS: NO now. Requires separate review of a limited Production-baseline Rules delta, the three indexes, retention/usage controls, then explicit activation approval. Never deploy the entire branch Rules file: existing repo/Production baseline differences must be preserved.

## Final local verification
Full regression: 1486/1486 PASS. Firestore Rules subset: 670/670 PASS (includes published-baseline compatibility checks). New hardening tests: model 26, Rules 27, browser 10. JavaScript critical errors: 0. Lint and git diff --check: PASS. Tests use emulator/mocks only, including local feature-enabled fixtures; default flag remains false.
Backup: F:\SouqAlhalal-Backups\souq-visitor-hardening-2026-09-13-090501
Backup manifest SHA256: 957960B6E83179BC9DB6B59DF144671C5DE6046C5522A25EEB1F7AE9CE4A8414
