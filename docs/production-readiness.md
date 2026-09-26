# Production readiness and first deployment

## Phase 8 supersedes the initial rollout instructions

Use [production-rollout.md](production-rollout.md) for the current ten-migration deployment sequence, APP_ENV registration, exact-action confirmations, pilots, backup/restore drill and explicit evidence gates. Use [rollback.md](rollback.md), [reliability.md](reliability.md) and [device-validation.md](device-validation.md). The Phase 7 notes below describe the original baseline; Phase 8 adds stricter guards and an optional separate Edition service.

Phase 7 adds operational gates; it does not assert that production credentials, source databases, ownership history or real-device flows have been validated. The database control records are the source of truth for worker enablement. An absent control means **DISABLED**, including when all RPC/source environment variables exist.

## Exact first-deployment order

1. Provision a dedicated Railway PostgreSQL service for UglyDex. Never reuse an ecosystem database. Create external SELECT-only roles separately; do not grant UglyDex their owner/superuser credentials.
2. Enable database backups and perform a restore drill into a separate database, following the backup section below. Record the application commit and database backup timestamp.
3. Configure the web service from this repository's Dockerfile and `railway.toml`. Set `DATABASE_URL`, canonical HTTPS `PUBLIC_BASE_URL`, a random `AUTH_SECRET`, all three Discord OAuth values and `ADMIN_DISCORD_IDS`. Set the OAuth callback to exactly `<PUBLIC_BASE_URL>/api/auth/discord/callback`. Optional `RAILWAY_GIT_COMMIT_SHA`/`APP_COMMIT` identifies the release on the admin dashboard. No new secret is required by Phase 7.
4. Deploy **web first**. Its pre-deploy command runs `npm run db:migrate`; startup does not import evidence. Nine migrations apply in filename order, ending with `202609290009_phase7`. Phase 7 is additive; no canonical metadata, source facts or completion denominator changes. `/api/health` checks database connectivity; Railway now gates rollout on `/api/ready`, which also checks migration history/checksums. A failed migration must be investigated, not automatically marked applied.
5. Sign in using an allowlisted authenticated Discord identity. Open `/admin/production`, `/admin/integrations`, `/admin/provenance` and `/admin/sharing`. Confirm anonymous and ordinary Collector access to admin pages returns not found.
6. Run `npm run production:preflight -- --offline` in the web service environment. It prints redacted PASS/WARN/FAIL checks and runs a read-only live-schema diff. Fix FAIL results. Empty catalog, disabled workers and absent optional integrations are expected before onboarding. Disabled worker status is safe, not a failure.
7. Configure archive-capable Ethereum mainnet RPC, the canonical Reloaded contract, exact `SQUIGS_START_BLOCK`, bounded batch/retry settings and approved external read-only URLs/guild ID. Use existing `npm run chain:discover-start` if the exact deployment block is not known; inspect its result before configuration. Do not guess the block.
8. Run `npm run integrations:inspect` and `npm run integrations:validate`. Review expected tables/columns and external role permissions. The preflight rejects configured sources that cannot be read or have write privileges. Unconfigured sources produce WARN and remain explicitly unavailable; they are not silently treated as complete history.
9. Run `npm run production:preflight` with network/render probes. It verifies RPC chain/contract/ERC721, archive reads around the deployment boundary, source schemas/roles, canonical image resolution and server PNG rendering. No secret values or source rows are printed. The command exits nonzero on FAIL. Prisma diff detects Prisma-managed schema drift; custom SQL checks/index predicates require the database integration suite and manual catalog inspection. There is no automatic drift repair.
10. Take another backup before the first evidence backfill. Keep all workers DISABLED. `npm run production:backfill` prints the plan without executing it. Start a bounded run with `npm run production:backfill -- --execute --batches 20`. Observe `/admin/production` and `npm run production:backfill -- --status`; rerun the same execute command until all stages complete. A stage failure exits nonzero and preserves its durable cursor. Identity conflicts require explicit admin reconciliation before continuing.
11. Run `npm run production:verify -- --owners full` with workers paused. Investigate discrepancies; never publish inferred repairs. This reads ownerOf at the indexed block, checks the block hash again, recomputes progression/set evidence, audits queues/catalog/attribution/public privacy and verifies collectible references. `npm run collectibles:verify` additionally fetches and revalidates all official artwork hashes. Save the redacted reports alongside the backup/release record.
12. Deploy the four worker services using `railway.worker.toml`, `railway.ecosystem.toml`, `railway.progression.toml` and `railway.collections.toml`. They use the same release and UglyDex database. They start disabled. Set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=90` on web and worker services so bounded tasks can finish after SIGTERM. Verify stopped or killed workers resume their existing cursors. Do not attach HTTP health checks to CLI workers.
13. Enable LIVE individually using `/admin/production` or `npm run production:worker -- --service blockchain --mode LIVE` (repeat for ecosystem, progression, collections). Blockchain LIVE requires the transfers backfill checkpoint; ecosystem LIVE requires validated and backfilled configured feeds. HISTORICAL is a separate explicit operator choice. Observe heartbeats, lag, last success and failed jobs before enabling the next worker.
14. Run the real-device checklist below, verify public OG previews using actual deployment URLs, then open public access. Keep the production evidence limitations visible until each source has measured coverage.

See [Railway deployment teardown](https://docs.railway.com/deployments/deployment-teardown) and [variables reference](https://docs.railway.com/variables/reference) for the service's termination grace period. Without a grace period, forced termination is still recoverable, but it may interrupt the current bounded task.

## Backfill stages and checkpoints

| Stage        | Work and durable state                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| catalog      | Idempotent bundled 4,444-token import; progression, collection and cosmetic catalogs seeded. Existing official Customs/Editions are untouched.                 |
| transfers    | One finalized bounded block range per batch; ChainCursor/ChainBlock/transfer facts, archive validation, reorg checks and existing advisory lock.               |
| provenance   | Reconcile authenticated attribution facts and drain dirty Squig derivations in groups of 100.                                                                  |
| identity     | Import configured historical wallet evidence; stop for unresolved reconciliation, then derive settled attribution. Never grant login or auto-merge identities. |
| activity     | One configured source's bounded two-page import per batch; individual IntegrationSource cursors and completeness. Missing optional sources remain unavailable. |
| progression  | Existing versioned replay cursor plus targeted job queue; unique ledger grants and audited corrections.                                                        |
| collections  | Existing collection replay cursor and queue; deterministic evidence, trait discoveries, milestones and completion snapshots.                                   |
| verification | Read-only consistency pass. Share cards are generated from fresh projections, so there is no permanent image snapshot to backfill.                             |

`ProductionStage` records run ID, attempts, latest counts/cursor summary, timestamps, status and safe error code. The true input cursors remain in the existing source/replay models. A dedicated Postgres advisory lock prevents concurrent orchestrators. Workers must be disabled before orchestration. Each invocation defaults to 20 batches, supports 1–10,000, and exits at a durable boundary. `--from <stage>` refuses incomplete prerequisites and resumes unfinished stages; it never resets completed facts. Existing `progression:rebuild`, `collections:rebuild` and source replay commands remain the explicit tools for replaying completed stages after a reviewed source/ruleset change. Do not delete checkpoints to force replay.

## Worker and logging audit

Each service has its own dedicated advisory-lock connection and a UUID process instance. Heartbeats persist every 15 seconds while idle or working; the dashboard marks observations older than 90 seconds STALE. It shows enabled mode, last successful task, lock status and the latest safe error code. A process can be alive but WAITING_CONFIGURATION, WAITING_SOURCE_VALIDATION, WAITING_BACKFILL, LOCKED_BY_PEER or ERROR. Heartbeats are retained for seven days; evidence is not pruned.

Worker mode changes apply between bounded tasks. SIGTERM/SIGINT abort idle waits and stop scheduling new work. The current database transaction or bounded source batch either commits or rolls back. Dedicated lock connection failure stops subsequent scheduling. Existing transfer locks, queue fencing, transaction locks and unique constraints protect the underlying stage even after a forced process exit. Database outage causes the service to stop/restart under Railway's policy; no local file is treated as a checkpoint.

Worker and orchestrator logs include run ID, service, stage, counts, duration and success/failure; chain logs include block boundaries, and activity batch logs include their SyncRun ID. Error text, secrets, identities and full source records are excluded. Admin details use authenticated routes and no-index/no-store policies. No new analytics tracker exists.

## Recovery runbook

| Failure                                  | Safe recovery                                                                                                                                                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RPC outage / rate limit                  | Keep web serving its indexed state. Restore provider connectivity, run preflight, resume the same transfer stage. Do not change start block to skip failing ranges. Existing retries are bounded.                                 |
| External DB outage/schema change         | Source state becomes unavailable/error; other public cached/indexed data remains usable. Fix the SELECT role or adapter, validate schemas, resume the same feed. Never mark unavailable history complete.                         |
| Worker crash or deployment during import | Inspect stale heartbeat and durable cursor. Restart matching release; lock/lease recovery and event uniqueness prevent duplicate facts.                                                                                           |
| Partial backfill                         | Inspect `--status`; fix the recorded issue and repeat `--execute`. Completed stages are skipped. Use `--from` only after prior stages complete.                                                                                   |
| Identity conflict                        | Review `/admin/reconciliation`, record an evidence-backed decision, rerun identity stage. Never auto-merge Collector accounts.                                                                                                    |
| Failed progression or collection replay  | Inspect respective admin jobs; correct source/ruleset issue, rerun the existing rebuild or enable the targeted worker. Re-evaluation reverses invalid grants rather than issuing duplicates.                                      |
| Failed migration/drift                   | Stop rollout and workers. Preserve logs and take a backup. Compare committed SQL with live schema on a restored copy; follow Prisma's explicit recovery process. No migrate reset, blind resolve or destructive automatic repair. |
| Image gateway outage/corrupt artwork     | Galleries show accessible fallback art; social renderer falls back to token tiles. New artwork approval fails closed. Retry after recovery and run collectibles verification; never switch to untrusted arbitrary URLs.           |
| Incorrect official catalog approval      | Retire the record through admin tools. Public Custom/share lookups revoke immediately, owner/gallery art falls back, audit snapshots survive. Publish a new reviewed record when appropriate.                                     |

## Backup and restore

Use Railway/Postgres tooling, not an application backup engine. Enable scheduled volume backups and, where supported by the chosen Postgres image/plan, point-in-time recovery. Verify retention, latest successful backup, archive coverage and storage budgets in the actual Railway project. Follow [Railway's Postgres backup/restore guide](https://docs.railway.com/guides/postgres-backups-restores) and [PITR documentation](https://docs.railway.com/volumes/point-in-time-recovery).

Take an on-demand backup before the first production backfill, a major ruleset migration, or any destructive/manual remediation. Periodically make an encrypted access-controlled logical `pg_dump` backup using an approved operator environment; never put credentials in command history or artifacts. Restore into a **new isolated database**, deploy the matching application revision with workers disabled, run migration/preflight/verify checks and sample privacy flows, then document recovery time and recovery point. Only an explicit operator decision switches the production datasource. Keep the old database available for rollback and rotate sessions if the incident involved credentials. This repository does not perform restores automatically.

## Real-device release checklist

Record device/OS/browser version, release SHA, date and result for **iOS Safari, Android Chrome, desktop Chrome and desktop Edge**. Fixtures/headless Chromium do not count as these checks.

- Connect a real supported EOA wallet: readable origin/chain/nonce, signature-only request, reject and retry, disconnect, reload session, link/revoke secondary wallet. Confirm no transaction or mint prompt.
- Complete Discord OAuth with normal and admin accounts; cancel, reject state, retry; verify exact HTTPS callback and no tokens in URLs/logs after completion.
- Toggle profile public/private, wallets/Discord hidden, full/featured/hidden collection. Open incognito and confirm no hidden identity or gallery content appears.
- Create/edit/reorder/caption a gallery with keyboard and touch; test public/unlisted/private, back navigation, long captions and 360-pixel width.
- Select Original/verified Custom, transfer a test-owned Squig in a controlled test environment, refresh ownership, and confirm the previous Collector preference does not follow it.
- Select each free theme/accent; test focus, text contrast, reduced-motion setting and 200% zoom. Confirm locked frames cannot be saved by editing a request.
- Use native link share, prepare/share PNG, copy link, square/landscape download, Files/Photos save and cancellation. Confirm no stale transient-activation failure after image preparation.
- Paste public Collector, Squig, Custom, gallery, achievement and set URLs into intended external share targets and inspect their OG images. Test privacy/retirement changes; previously downloaded/third-party cached copies cannot be recalled.
- Browse collection filters, trait/set pages and Edition detail on slow mobile data; break the gateway connection to verify image fallback and legibility.
- Verify navigation, scrolling, captions/trophy case and share modal have no horizontal overflow. Record unresolved device-specific limitations before release approval.
