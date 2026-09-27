# Integration operating contract

## Phase 11 bounded pilot follow-up

The [pilot report](phase11-pilot-report.md) records the 16 available staging feed
reviews, corrections, source warnings and individual approval decisions. Historical
cursors and completion flags remain untouched; no full import or worker cycle was
run. `onlineRewards` remains unavailable. Before subsequent Duel imports, retain
the authoritative `UGLYBOT_BOT_DISCORD_ID` configuration described in
[source bridges](source-bridges.md); never identify bot opponents by name.

## Phase 11 secure transport follow-up

The [source bridges](source-bridges.md) preserve the existing adapters while
replacing cross-project public PostgreSQL connections that fail certificate and
hostname validation. Staging uses three authenticated HTTPS bridge services with
dedicated readers inside the upstream private networks. All nine logical sources
authenticate and verify read-only privileges; 25/26 registry tables exist with
every required column. The absent `gauntlet_online_reward_events` makes only
`onlineRewards` unavailable. Gauntlet runs remain usable. No source pilot or import
was run during this repair. See [dated results](phase11-source-rpc-report.md).

## Phase 8 pilot gate

Run `integrations:pilot -- --feed <feed> --since <date>` only after live schema/SELECT-role validation. At most 200 rows are normalized without advancing full backfill cursors. The printed audit ID must be approved with `integrations:pilot:approve -- --run <id> --reviewed`; full staging/production backfill requires that source schema fingerprint. Review cross-source reward/payment duplicates using existing canonical event rules. No actual production source credentials or rows were available; schema/duplicate findings remain PENDING. No external writes were added.

Phase 7 rechecked upstream revisions and found no authoritative Customs/Edition issuance or contract registry. A marketplace product name or community image approval is insufficient evidence. Reviewed UglyDex-owned catalog imports remain separate from existing read-only adapters; no source schema/database write was introduced. See [collectible source findings](collectibles.md#source-evidence). Workers now require explicit enablement and validated sources; follow [production preflight and backfill](production-readiness.md).

Phase 1 web pages use only the UglyDex projection database. They never fan out to legacy databases. All nine read-only source configurations remain optional and unchanged. No production credentials were available during Phase 1; production schema inspection and pilot imports still need to be run after Railway configuration. The live source verification performed in Phase 1 was public Ethereum tokenURI and IPFS metadata/artwork reading, documented in [the Phase 1 report](phase1-report.md#images).

Current ownership refresh now has a durable `worker:ownership` queue in the UglyDex database. `sync:ownership` shares that worker/checkpoint implementation. `sync:transfers` remains a separate bounded, finalized event backfill. UI refresh requests never run historical scans. Configure an archive-capable RPC for historical ranges as needed; no paid NFT indexing API is required.

Read the [actual inventory](external-schema-inventory.md) before adding a query. Source findings are pinned; production may differ. `integrations:inspect` uses `information_schema` and `pg_class.reltuples`, not COUNT(*) scans. It returns configured status, connection outcome, discovered expected tables/columns, required/optional gaps and approximate row estimates. It never reads private records, credentials or sessions. Estimates may be -1 when PostgreSQL lacks statistics.

Each logical source uses a separate `pg` pool with max 2 connections, a connection deadline, SELECT-only query guard, `default_transaction_read_only=on`, `BEGIN READ ONLY`, and a local statement timeout. SQL values are bound parameters. Dynamic identifiers come only from a hard-coded registry and strict identifier validation. SELECT-only roles remain mandatory; app guards are defense in depth, not substitutes for database grants. TLS verification follows the supplied PostgreSQL URL/platform CA; do not disable certificate validation just to connect.

The application never imports UglyBot/Gauntlet/ImageSubmit database modules because their initializers may mutate schemas. Grant SELECT to an independently provisioned external reader. A source owner, outside this project, must provision grants and ensure the role is not an owner/superuser and lacks CREATE/INSERT/UPDATE/DELETE. UglyDex does not provision or execute external DDL.

## Current adapters and imports

| Adapter      | Functions / CLI                                                              | Phase 0 behavior                                                                                                             |
| ------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| wallet-links | linked wallets by Discord, all Discord matches for wallet; `sync:identities` | Canonical public schema, explicit guild, lowercase wallets; source verification is evidence only; conflict cases persisted   |
| uglybot      | collector/Squig duel history, marketplace, bounty, Maw; `sync:uglybot`       | Duels, general purchases/refunds, Malformed order states, bounty submissions, received Maw feeds, claim receipts             |
| gauntlet     | Survival stats/history; `sync:gauntlet`                                      | Completed Gauntlet runs and mutable Survival participant observations; game start is explicitly the event time basis         |
| images       | contributions; `sync:images`                                                 | Submission lifecycle/status and approval metadata. One source avoids double-counting shared live-image and notification rows |
| blockchain   | validate contract, ownerOf, batch; `sync:ownership`, `sync:transfers`        | Ethereum finalized observations and bounded Transfer backfill, entirely RPC-based                                            |

Source adapters intentionally return discriminated results: successful empty data differs from unconfigured, unavailable, schema mismatch and invalid data. Required-column drift disables the affected feed; optional missing fields become null. Malformed rows fail validation and increment failure counts without aborting unrelated feeds. Public pages consume local projections only.

Missing historical imports (not claimed complete): duel rounds/preferences, Bounty winners/transfer recovery, Maw inventory/tickets/prize history, Mad Libs, online rewards, image usage and legacy images without submission rows. Their schemas are inventoried and several are included in diagnostics; dedicated event mappings require their own fixture tests before enabling. No individual Bounty voter ledger, durable per-game Squig trait snapshot, complete CHARM ledger or full generic ownership snapshot was found. Do not manufacture them.

## Replay, freshness and deletion

Source event keys include system + type + durable ID + subject + event type, not mutable collector UUID. Each replay starts from the beginning in 200-row keyset pages so updates to old rows are seen. It writes changes only when normalized payload or collector association changes. SyncRun stores status/counts; an interrupted run may remain RUNNING and can be safely replayed. Errors never log raw connection strings, source rows or provider error messages. Scanned is source rows; inserted/updated/skipped may count multiple participant events.

Suggested initial cadence: history every 15 minutes; verified-link evidence every 5 minutes; metadata only when a reviewed snapshot changes; ownership every 5–15 minutes depending on RPC limits. Jobs are not scheduled automatically. Show observation time, never claim live data. A source row disappearing does not erase history or revoke credentials automatically. Deletion/retraction policy needs an explicit tombstone/provenance review workflow before XP rewards are implemented.

## Ethereum indexing

Source code agrees on Ethereum Squigs contract `0x8c9a02c0585200c4c65608df6b8def543d33792a`. Runtime validates chain ID, deployed bytecode and ERC-721 interface. `ownerOf` batches target the finalized block; a revert is reported as a failed lookup, not a guessed burn. Transfer logs include zero-address mint/burn cases, transaction hash, log index, block hash/number and timestamp. Transfers are passports even if neither wallet has an UglyDex identity.

`SQUIGS_START_BLOCK` must be independently verified; there is no genesis default. Start with small `TRANSFER_BLOCK_BATCH` for RPC providers with range limits. Each finalized range commits projections and the UglyDex cursor atomically. Re-run resumes at cursor+1. Cursor block hash is checked before continuing; a finalized reorg stops for operator review instead of silently rewriting history. No automatic deep-reorg rollback is implemented in Phase 0. Original minter, first acquisition and transfer count can be derived from indexed mint/transfers only once the requested range is complete. An end-of-block ownerOf snapshot outranks logs in that block; older history cannot overwrite newer ownership.

Discoveries from blockchain observations require the collector's wallet verification interval to include the event time. A signature today is not proof that the same person controlled that address years ago. Historical legacy links lack a verified_at history; review is needed before attributing old wallet activity. Current token ownership is always the chain wallet, independent of Discord links or preferences.

## Phase 3 adapters and production validation

Rechecked upstream HEAD on 2026-09-25; all three match the inventory revisions. Source-specific mappings now cover Duels/round counts, Survival/game and image-use observations, solo runs/confirmed online rewards, Bounty donations/entries/winners, Maw receipt/disposition/verified digestion/delivered prizes, both Marketplace purchases/refunds, ImageSubmit/live image deduplication and safe Mad Lib publication/confirmed operation history. Schema validation, canonical authorities, optional fields and exclusions are detailed in [activity model](activity-model.md).

`integrations:validate` performs SELECT-only schema/permission inspection, reports estimates, and stores status only in UglyDex. Production connections remain absent in this workspace; actual schemas/counts/retention and historical completeness require read-only credentials. Fixture success is not production validation. No ecosystem source repository or external database was altered.

## Phase 9

Phase 9 launch:sources probes read-only schema/privileges and count/date boundaries without external writes. launch:audit compares pilot normalization/linkage counters and duplicate candidates. Empty pilots cannot be approved. See [data-reconciliation](data-reconciliation.md); actual production sources remain PENDING.

## Phase 10 execution status

Read-only connection, schema, privilege and aggregate-count probes ran on 2026-09-27 UTC. Wallet links and UglyBot main/prizes/claims/points connect with overly privileged credentials; Gauntlet rejects authentication, Survival/ImageSubmit hosts do not resolve, and the separate Gauntlet image URL is absent. Schema/count probe results do not authorize importing with these roles. Pilots and full imports remain PENDING; no upstream source was written. See [phase10-report.md](phase10-report.md) for exact available counts and [credential follow-up](phase10-access-followup.md).

## Phase 11 checkpoint — 2026-09-27 UTC

See the [actual Phase 11 report](phase11-report.md) and [reader provisioning/access walkthrough](operator/phase11-readers/README.md). Historical Phase 10 evidence above is retained. Staging runs `0687d01`; production remains `c764e28`. Source readers were provisioned with explicit authorization, but public TLS and Gauntlet schema issues remain. RPC retries preserved the existing incomplete cursor. No production replay, populated restore, LIVE worker rollout, physical-device certification or gate-approved launch was claimed. Current gate counts and revision-binding limitations are in the report.
