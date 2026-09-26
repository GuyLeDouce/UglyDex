# Phase 7 — production operations and official collectible presentation

Implemented directly on Phase 0–6. No ecosystem repository/database, Reloaded contract, canonical metadata, XP rule or completion denominator was changed. Production deployment, real external data and real-device validation remain operational steps, not fixture-derived claims.

## Production operations

- `production:preflight` prints redacted PASS/WARN/FAIL for environment/auth/admin/origin, database, migration ordering/failure/checksums, live Prisma schema drift, rules/catalog, RPC/mainnet/contract/archive start boundary, source schema/read-only roles, worker status and server PNG/artwork. `--offline` omits network/render probes. FAIL exits nonzero; nothing repairs drift automatically.
- `production:backfill` defaults to plan-only. `--execute`, bounded `--batches`, `--status` and prerequisite-checked `--from` drive catalog → transfers → provenance → identity review → activity → progression → collections → verification. Existing source cursors, locks, replay queues and event uniqueness remain authoritative. Checkpoints resume after interruption without resets. Reconciliation ambiguity stops the identity stage.
- Four workers now start DISABLED. Explicit database controls select DISABLED/HISTORICAL/LIVE. LIVE chain/source work requires completed historical onboarding. Heartbeats persist every 15 seconds with mode/state/lock/last success/error/run ID; 90 seconds without heartbeat becomes stale. Backfill waits for worker tasks to drain and prevents enabling workers mid-run.
- `/admin/production` combines readiness, commit, catalog, chain/provenance, source completeness, jobs, rulesets, reconciliation, rendering and worker controls. `/api/ready` is the Railway migration readiness gate; `/api/health` remains a DB probe.
- `production:verify` is read-only: catalog, ownership uniqueness, period continuity, attribution, activity idempotency, queues, recomputed progression/set evidence and completion, private share projections, collectible references and optional pinned ownerOf spot/full reads. Incomplete source coverage remains visible.

## Official collectible identity

Customs have canonical Squig relationships, immutable validated assets, DRAFT/VERIFIED/RETIRED status, approval source/reference, artist/date/order, optimistic revisions and retained audit snapshots. Only verified records appear publicly. First verification emits one idempotent Passport event. Retiring removes public cards/variants and falls back to Original without deleting history.

Current owners select an alternate representation separately from the canonical NFT. Preferences are Collector-specific and tied to ownership observations; they do not follow a transfer. Featured Collector/share presentation and individual gallery items use verified variants, labeled Official Custom. The Squig page preserves Original and presents the Custom collection. Custom share cards use the centralized renderer, safe asset DTOs, approved hash and fresh visibility rechecks.

Editions have separate flexible catalog identities, nullable reviewed chain/contract/token/supply, explicit multiple associated Squigs and audit history. `/editions`, detail pages and `/collection/editions` distinguish catalog existence from verified ownership. The read-only Ethereum adapter supports reviewed ERC721/1155 entries at finalized blocks; observations expire after 15 minutes and catalog revisions invalidate them. Other chains/off-chain records have no fabricated ownership or historical discovery. Public Collector holdings require FULL collection visibility.

**Seeded official count: 0 Customs, 0 Editions.** Upstream HEADs were rechecked and unchanged. UglyBot's marketplace name is not an issuance/contract registry; community image approvals are not official Custom evidence. Reviewed admin manifests are required. See [source findings and catalog rules](collectibles.md).

## Personalization

`uglydex-cosmetics-v1` contains 17 free/non-financial definitions: three profile themes, four accents, four card frames, three gallery styles and three share styles. Sources are free/default, active achievement, currently complete set, and current OG/Legendary ownership. `/settings/appearance` offers a preview and validated selections. Live eligibility overrides cached grants; pending/revoked/lost/disabled entitlements fall back immediately. Public DTOs contain selected enumerated styling only. No arbitrary CSS, uploads, payment or currency is accepted.

## Schema, routes and tools

Additive migration `202609290009_phase7` follows all eight earlier migrations. It adds 14 operational/collectible/cosmetic models, the CollectibleStatus enum and a separate gallery item Custom FK. Existing canonical ownership and gallery references are preserved.

New pages: `/admin/production`, `/admin/collectibles`, `/admin/customs`, `/admin/editions`, `/editions`, `/editions/[slug]`, `/collection/editions`, `/settings/appearance`.

New APIs: `/api/ready`, `/api/admin/production`, `/api/admin/collectibles`, `/api/settings/appearance`, `/api/settings/display-art`, `/api/editions/ownership`. Existing Squig/profile/gallery/share routes are extended.

Commands: `production:preflight`, `production:backfill`, `production:verify`, `production:worker`, `customs:import`, `editions:import`, `collectibles:verify`, `collectibles:export`. JSON imports validate the complete batch before transaction; exact replay skips; exports exclude Collector ownership and admin audit actors. Verification reports discrepancies without repairing ambiguous facts.

## Security and Railway

Existing authenticated Discord admin policy, same-origin checks, request body limits and rate limits protect administration. Unauthenticated/private resources remain indistinguishable from missing resources. No blockchain write client or external DB mutation was introduced.

Artwork is pinned IPFS via a fixed gateway, with no client URL or redirects, bounded stream/time/dimensions and full PNG/JPEG decode. SVG/HTML/animation/corrupt images fail approval. Hash mismatch fails closed; rendering uses fallback. Sharp 0.35.4 is now direct; the existing Node 24 Debian build supplies its native runtime. No upload bucket, secret or dedicated rendering worker is required. Private/no-store PNG responses and bounded process caches remain unchanged; cache keys include projected art/style state and every hit still requires fresh authorization.

Railway web rollout now uses `/api/ready`. Production docs specify web/migrations first, worker controls disabled, preflight/source checks, backups, explicit backfill/verification, then LIVE enabling, with 90-second deployment drain grace. The guide includes outage/replay/migration/image recovery, restore drills and the separate iOS Safari/Android Chrome/desktop Chrome/Edge checklist.

## Validation

Unit suite: **427 passing tests across 10 files**, including 56 Phase 7 boundary/security tests. The complete `npm run test:db -- --web --browser --catalog` regression passed **742 assertions**, covering a fresh migration chain, the 4,444-token catalog, database replay/operations, HTTP authorization/privacy, PNG rendering, Open Graph and browser flows. Phase 7 browser checks cover 360, 390 and 768-pixel widths, overflow, image alternatives, appearance saving and keyboard navigation; saved appearance/Edition screenshots were visually inspected.

Lint, formatting, TypeScript checking and the clean production build passed. Collection catalog verification passed with 345 traits, 52 sets and no errors. Collectible consistency and production preflight/verification were exercised against disposable databases, including migration drift and failure diagnostics. All three upstream inspection checkouts remain unchanged. These checks do not certify live production credentials, external contracts or physical devices.

## Production limitations and Phase 8

No production credentials, Railway deployment, evidence backfill, actual official collectible manifest, real-device wallet/OAuth/share session or third-party OG scrape was available in this workspace. Historical source completeness is never labeled lifetime coverage. Edition ownership currently supports reviewed Ethereum contracts only; historical Edition indexing and uploaded asset storage remain unimplemented until authoritative use cases exist. JSON is the import/export format. Ownership observation changes may conservatively reset a display preference.

Exact recommended Phase 8: execute the staging/production rollout and restore drill; validate actual RPC/read-only schemas, reconcile identity and production evidence counts; import reviewed official collectibles and verify real contract semantics; complete manual device/OG checks; measure/fix observed performance, accessibility and reliability; then add historical Edition transfer/discovery indexing only for specifically verified contracts, with separate coverage/privacy. Preserve Reloaded completion v1. Keep quests, seasons, leaderboards, referrals, paid cosmetics, CHARM spending/rewards, minting and automatic payouts outside that scope.
