# Phase 2 — trustworthy ownership and Squig Passports

## Implementation

Built on the Phase 0/1 modular monolith, UUID identity model, canonical dataset, private/public collection views, and ownership-refresh worker. No ecosystem repository or external database was changed.

- Canonical finalized Transfer ledger with unique chain/transaction/log identity; raw block, transaction, address and timestamp provenance.
- Deployment-boundary validation, chunked restartable scans, cached block timestamps, bounded concurrent RPC requests, timeout/retry/backoff, durable checkpoints and structured logs.
- Rebuildable wallet and collector holding periods, including same-collector wallet moves, losses, reacquisitions, self transfers, burns and same-block transfers. Gaps are reported rather than silently repaired.
- Dated historical attribution with explicit confidence/status, conflicting evidence, audited confirmation/rejection/splitting and unresolved review. Present-day wallet authentication never silently assigns pre-verification history.
- Persistent discoveries with first supporting period and invalidation status; historical collection cards show first/last acquisition, loss, indexed time held and period count.
- Paginated 20-event Passport on `/squig/[tokenId]`, newest/oldest ordering, mint/transfer/burn filters, contextual labels, expandable raw chain details and centralized explorer links. Summary shows only derivable mint, minter, owner/since, transfers, wallet counts, public collector counts, age and longest indexed hold.
- Reusable ownership timeline on `/me` and consented public profiles. Existing non-blockchain activity imports remain separate and intact.
- Protected `/admin/provenance` and `/admin/reconciliation`, safe queued token rebuild, raw/derived diagnostics and audit history. Production mutations require an authenticated allowlisted Discord identity, canonical Origin and shared rate limits.

## Schema and migration

`202609250004_provenance` adds `ChainBlock`, `NftTransfer`, `WalletOwnershipPeriod`, `CollectorOwnershipPeriod`, `HistoricalIdentityAttribution`, `SquigProvenance`, and `ReconciliationDecision`. It extends the existing `ChainCursor`, `SquigDiscovery`, and `IdentityReconciliation`, rather than introducing competing cursor or case models. Indexes cover token/time, wallet/time, collector/time, transaction/block, open periods, pending derivation and unresolved cases. SQL checks enforce normalized addresses, valid intervals, canonical log fields and one open ownership period per token.

Only UglyDex `DATABASE_URL` is migrated. Existing credentials, activities, metadata and XP/achievement/quest foundations are retained. `SquigOwnership` remains the current collection observation model, with later pinned ownerOf snapshots taking precedence over older raw history.

## Production coverage and validation

| Metric                                          | Actual production result                                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract / chain                                | Existing configured Squigs Reloaded contract, Ethereum mainnet                                                                                        |
| Deployment boundary evidence                    | Blockscout reports **25,342,921**, creation transaction `0x89813e58e6342ca49e8c301fcad8c16228b91d4d50584e0a2968c9ee80390571`, 2026-06-18 07:21:35 UTC |
| Start block used for production ingestion       | None: no configured production DB/RPC; deployment code-boundary verification still required                                                           |
| Production Transfer events indexed              | Not measured / no production backfill run                                                                                                             |
| Squigs with verified production mint provenance | Not measured                                                                                                                                          |
| Production ownerOf matches                      | Not measured                                                                                                                                          |
| Unresolved production provenance anomalies      | Unknown, not zero                                                                                                                                     |
| Production reconciliation cases created         | None written in this session; deployed case count unknown                                                                                             |
| Legacy production schemas / pilot imports       | Await dedicated read-only credentials                                                                                                                 |

The public RPC rejected archive contract-code queries without a personal provider token and returned no usable creation receipt. Blockscout's public API supplied the creation evidence above; this is documented with source links in [provenance](provenance.md#deployment-boundary-and-production-coverage). No test fixture is presented as production history. No real environment file or secret was committed.

## Reorg and worker behavior

The worker now alternates one finalized Transfer chunk, pending derivations and the existing ownership batch. A session advisory lock prevents overlapping chain scans; existing snapshot leases remain intact. Recent stored hashes and the cursor are reread. A mismatch rewinds the configured window (128 blocks by default), validates its prior anchor, removes orphan-branch facts/observations, resets affected snapshots and rebuilds derived history. A deeper mismatch stops for review. Ordinary repair preserves the raw ledger.

The browser never performs historical scans. Dirty projections withhold public identity attribution until rebuilt. An external or RPC outage does not make UglyDex web health depend on a legacy service.

## Commands and rollout

New: `chain:discover-start`, `chain:status`, `chain:verify`, `provenance:verify`, `provenance:rebuild -- --token 3157`, and `provenance:rebuild -- --from-block 25342921`. Existing `sync:transfers` and `worker:ownership` now use the Phase 2 pipeline. Verification compares all 4,444 token IDs to ownerOf at the same cursor block and reports missing metadata/mints, continuity/period errors, unavailable calls and owner mismatches.

Railway keeps the existing web and worker service commands. Deploy the migration; configure archive-capable `ETH_RPC_URL` and reviewed `SQUIGS_START_BLOCK`; import Squig metadata; run the worker; wait for catch-up; retain `provenance:verify` output as the production baseline. New optional controls are `RPC_CONCURRENCY`, `RPC_RETRIES`, `RPC_TIMEOUT_MS`, `REORG_REWIND_BLOCKS`, `ETH_EXPLORER_URL`, and production `ADMIN_DISCORD_IDS`. See [Railway deployment](railway.md).

## Validation

Tests use a newly generated loopback-only PostgreSQL cluster, random credentials and blank legacy/RPC environment variables; they cannot target a caller-provided production database. RPC fixtures exercise the real SQL scanner, projection and review transactions. Browser tests use the production Next server and local Chromium.

- Unit suite: **124 tests passed** across five files.
- Full disposable PostgreSQL / production HTTP / Chromium / canonical catalog suite: **177 assertions passed** using `npm run test:db -- --web --browser --catalog`. It imports all 4,444 metadata records and verifies a replay skips all 4,444.
- Production build, ESLint, TypeScript and Prettier checks pass.
- Database coverage includes interrupted scan/resume, atomic cursor updates, duplicate chain-key rejection, internal moves, loss/reacquisition, discovery correction, reviewed/conflicting/rejected/split evidence, bounded reorg rebuild, deep-reorg refusal, ownerOf mismatch, missing mint, final verification hash validation and paginated privacy-safe DTOs.
- HTTP/browser coverage includes public/admin authorization, origin protection, audited decisions, rebuild queuing, wallet authentication/profile privacy, Passport ordering/filtering/pagination, mobile overflow and real artwork loading. Desktop and mobile screenshots were visually inspected. Screenshots and clusters remain ignored local artifacts.

The OneDrive working directory temporarily prevented Next from removing a generated cache directory; moving the scoped generated cache aside allowed a clean build. Generated `.data` artifacts are explicitly excluded from lint/typecheck/formatting. No application error was deferred.

## Limits and Phase 3

Production completeness remains gated on the actual archive-RPC backfill and verification. The provider must return complete historical logs and accurate finalized blocks; this implementation does not claim independent consensus verification. Reorgs deeper than the configured anchor require operator investigation. Zero-address burns are recognized; other sink-looking addresses are not asserted irrecoverable. A failed ownerOf call is reported as unavailable, never assumed to prove a burn. Historical evidence review does not merge login accounts or grant credentials. No XP, achievement unlock rules, quests, paid features or full game/reward UI was introduced.

Recommended Phase 3 scope: complete the production provenance rollout first; validate deployed legacy schemas with SELECT-only roles; pilot and reconcile normalized imports; add explicit source completeness and correction/retraction semantics; then expose completed Duels/rounds, Survival results, confirmed Bounty and Maw outcomes, marketplace purchases/refunds and approved creator contributions in the shared collector/Squig timeline. Preserve attempted-versus-confirmed reward states and attach Squig events only with authoritative chain/contract/token evidence. Defer economy/progression rules.
