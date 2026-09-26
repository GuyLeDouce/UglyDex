# Phase 8 — operational validation and reliability

Phase 7 was reviewed, fast-validated and checkpointed as **2c6eda2**, `Phase 7: production readiness, collectibles and personalization`. Its checkpoint contained 84 files, no private artifacts, 427 passing unit tests and passing lint/typecheck/format checks. Phase 8 builds on those models; external ecosystem repositories are untouched.

## Implemented

- APP_ENV and database-bound action confirmations; staging isolation checks, immutable deployment identity and audited deployment records.
- Staging/production HTTP smoke commands, exact rollout/rollback/backup runbooks and pending real-device/OG matrices.
- Consistent logical pg_dump snapshot/inventory tooling and empty-disposable-target pg_restore drill. Source/production-looking/nonempty targets are refused; archive hashes, row inventories and restored integrity are checked before a success claim.
- Explicit backfill evidence gates, named noncritical WARN acknowledgment, bounded pilot imports and source-schema-bound pilot approval before staging/production full legacy ingestion.
- Read-only production evidence reporting and Edition ledger/balance consistency verification. Core replay/completion rules remain unchanged.
- Core worker backoff/circuit breakers, independent kill switches, subsystem status/alerts, safe error counters, incident history, data quality and release identification in `/admin/production`.
- Reviewed immutable Edition contract registry, separate per-contract cursor/checkpoints/events/balances; ERC721 Transfer and ERC1155 TransferSingle/TransferBatch, mint/burn/quantity semantics, idempotent resume, atomic bounded batches and reorg rollback/replay. Gaps, underflows, deep reorgs or limits halt the contract for review.
- Edition public history and authenticated effective-time discovery/acquisition summaries. No raw wallet or identity evidence is serialized publicly; Editions never enter Reloaded completion.
- Manifest artwork hashes, validation-only CLI, explicit publication review, deterministic import/audit and safe export. Official seeded totals remain **0 Customs, 0 Editions, 0 contracts**; fixtures are not official evidence.
- Controlled renderer and modest web capacity tools; full release-check command; security/history/dependency review.

## Schema and commands

Additive migration `202609300010_phase8` follows Phase 7. Six new tables: DeploymentIdentity, EditionContract, EditionTransfer, EditionBalance, EditionCheckpoint and OperationalMetric. No destructive migration or canonical ownership replacement.

New commands: `ops:fingerprint`, `ops:register`, `staging:preflight`, `staging:smoke`, `production:smoke`, `ops:backup`, `ops:restore:drill`, `integrations:pilot`, `integrations:pilot:approve`, `production:report`, `editions:register`, `editions:control`, `editions:index`, `worker:editions`, `ops:deployment`, `capacity:render`, `capacity:web`, `security:secrets`, `release:check`. Existing imports add `--validate-only`/`--reviewed`; backfill adds `--accept-warning`.

Existing `/admin/production`, `/editions/[slug]` and `/collection/editions` are extended; no new public mutation API was needed. Optional `railway.editions.toml` uses the same web image/DB, with all contract indexing disabled until reviewed. PostgreSQL dump/restore clients belong in the approved operator environment, not a mandatory web rendering worker.

## Validation and measured limitations

**Final release check passed:** 473 unit tests across 11 files (46 Phase 8 tests), plus **788 database/HTTP/browser/catalog assertions**. Fresh migration ordering, full 4,444-token catalog, provenance/replay fixtures, collectible/index verification, restore inventories, privacy/OG/PNG behavior and mobile admin overflow passed. Lint, formatting, typecheck, collection catalog verification (345 traits / 52 sets) and the production build passed; the final build has no warnings. The mobile dashboard screenshot was inspected after fixing overflow.

Final controlled renderer sample: 60 ms card-cache-cold, 1 ms cached; cached 20-request burst had no failures. Distinct cold bursts exceed the intentional two-render cap and return busy (3/5 and 8/10). Local production-build route p95 ranged from 14 ms (homepage) to 111 ms (explorer), with three requests per route. These are fixtures without archive network/production gateway load, not a staging capacity certification. See [reliability](reliability.md).

Dependency audit: zero known vulnerabilities at the time of the audit. Secret scan: 407 reachable historical Git blobs plus the working tree, with zero findings after classifying the intentionally tracked .env.example correctly. Reports contain paths/codes only; no credential values are displayed. Automated privacy, wallet nonce/OAuth/admin, manifest, SSRF, operational guard and Edition semantics tests supplement the existing regression.

**PENDING external gates:** actual Railway staging/production deployment, archive RPC/start/mint/owner validation, real read-only source schema/pilots/backfill, production identity review and replay totals, official reviewed manifests/contracts, a real backup archive restore with PostgreSQL client binaries, physical iOS/Android/Chrome/Edge wallet/share sessions, third-party crawler previews, real staging web/worker capacity and resource sizing. No production reconciliation result or ownership total has been fabricated.

Registry V1 supports reviewed Ethereum ERC721/ERC1155 contracts with explicit token IDs (up to 1,000). Other chains, constructor-only ERC721 allocations without mint events, unusual proxy/event semantics, deep reorgs and token histories over 50,000 events require a specifically reviewed adapter/recovery path. Registry changes are not silently applied over an existing cursor. Public history shows the latest 50 events; complete coverage describes the observed indexed finalized boundary, not perpetual freshness. Indexed balances and direct 15-minute ownership observations remain distinct.

## Recommended Phase 9 scope

Close the pending rollout evidence gates using actual approved credentials, contracts, manifests and devices; complete a real restore/recovery rehearsal and source-by-source reconciliation; compare two stable derived replays; tune measured Railway rendering/worker bottlenecks; add only contract-specific Edition adapters/recovery paths justified by verified evidence. Address recorded privacy/accessibility/reliability incidents. Preserve completion v1 and keep quests, seasons, leaderboards, referrals, paid mechanics, CHARM rewards, trading and blockchain writes outside scope.
