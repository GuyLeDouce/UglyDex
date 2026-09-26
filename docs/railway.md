# Railway operations

Use the existing web Docker service and dedicated UglyDex PostgreSQL. Web configuration remains `railway.toml`: apply `npm run db:migrate` before start, serve on Railway `PORT`, and check `/api/health`. Migration `202609250004_provenance` is additive to Phase 1 and applies only to UglyDex.

Use `railway.worker.toml` for a separate service from the same revision. Start command remains `npm run worker:ownership`; it now maintains Transfer ingestion, dirty historical projections and coalesced ownership refreshes. It needs no public domain or HTTP healthcheck. Both services use the same **UglyDex** `DATABASE_URL`. Keep one worker initially. Advisory locks and snapshot leases protect against overlapping replicas. Do not attach either writable datasource to an ecosystem database.

Required web values: `DATABASE_URL`, HTTPS `PUBLIC_BASE_URL`, random `AUTH_SECRET`. Discord uses the existing client/secret/canonical callback settings. Production historical-review admins must sign in with Discord and appear in comma-separated `ADMIN_DISCORD_IDS`. `ADMIN_DIAGNOSTICS_TOKEN` remains a separate read-only bearer credential.

Worker values: archive-capable `ETH_RPC_URL`, fixed contract address, reviewed `SQUIGS_START_BLOCK` (Blockscout reports 25342921; first-run code-boundary validation is mandatory), `TRANSFER_BLOCK_BATCH=1000`, `REORG_REWIND_BLOCKS=128`, `RPC_CONCURRENCY=3`, `RPC_RETRIES=4`, `RPC_TIMEOUT_MS=15000`. Smaller log ranges may be necessary for your provider. Optional `ETH_EXPLORER_URL=https://etherscan.io` centralizes transaction links. No paid NFT API is required, but production historical RPC capacity must be provisioned.

Deploy sequence:

1. Back up the UglyDex database, deploy the additive migration, and import the canonical dataset with `sync:squigs` if needed.
2. Configure and verify the deployment boundary using `chain:discover-start` or independently reviewed creation evidence. Run a small block batch first.
3. Start the worker; watch `chain.chunk`, `chain.rpc_retry`, `chain.failed`, `chain.rewind` and existing `ownership.batch` logs. Monitor `/admin/provenance` or `chain:status` for lag, dirty records and last error.
4. Once caught up, run `provenance:verify`; retain the report as the rollout baseline. Do not announce complete coverage until 4,444 token checks and provider comparisons have been reviewed.
5. Configure dedicated SELECT-only legacy credentials, run `integrations:inspect`, and pilot identity/history imports separately. Review historical attribution cases before publishing collector associations.

Graceful SIGTERM stops after the current bounded unit of work. A hard restart releases PostgreSQL session locks; committed cursors and dirty projections persist. RPC failures do not invalidate the web service's own health. Deep-reorg errors intentionally require an operator rather than truncating historical facts automatically. External schema validation and OAuth/provider rollout remain environment-specific operational checks.

## Phase 3 ecosystem worker

Apply `202609250005_activity` to **UglyDex only**, then redeploy web and workers from the same revision. It extends activities/import runs and adds native source state, correction audit, rejection and attribution-job tables. Existing blockchain deployment/start-block configuration is unchanged.

Add a third Railway service using `railway.ecosystem.toml` and `npm run worker:ecosystem`. Share the UglyDex database, supply only dedicated read-only legacy connection variables for each configured source, and do not attach a public domain or HTTP healthcheck. No new mandatory secret variables. Keep one ecosystem worker initially; each feed has a session advisory lock, with crash-resumable checkpoints. It runs roughly every five minutes after work, takes up to two forward pages and one rolling audit page per mutable source, and processes dated attribution jobs. Large timestamp-less histories have a rolling reconciliation delay; monitor source coverage rather than promising immediate updates.

Run `integrations:validate` first, inspect missing columns and permission warnings, then pilot `sync:uglybot -- --pages 2`, `sync:gauntlet -- --pages 2`, and `sync:images -- --pages 2`. Repeat bounded imports to finish available backfills; use `sync:activity` for all feeds. Reserve `--replay` for operator audits. Do not call a source complete merely because its current query is exhausted. `/admin/integrations` and `/admin/activity` show state, runs, source IDs, unresolved attribution and rejections. Validate production retention, time zones, delivery/payout states, image moderation corrections and actual read-only grants before announcing history coverage.

Public activity requires profile visibility plus the relevant Discord/wallet visibility. Confirm those settings with a real OAuth/wallet account after Railway setup. The native health endpoint still does not depend on legacy services. Failure of one source is retried without blocking other feeds or the web app; no heavy import runs in a page request.

## Progression worker (Phase 4)

Deploy a separate service from this repository with `railway.progression.toml`: reuse the existing Dockerfile build, start `npm run worker:progression`. Supply only the existing UglyDex `DATABASE_URL` plus the app's required validated base configuration. No external DB or RPC credentials are required for progression. Use the same migration release step as the web service; never migrate legacy databases. The worker has no HTTP health path or PORT binding; use Railway process/restart monitoring and `/admin/progression` for queue/run health.

After migration `202609260006_progression`, seed definitions with `npm run progression:seed` and run `npm run progression:rebuild` once. Start the worker, which processes up to 50 queued subjects per 15-second cycle. Subject advisory locks, a transactionally enqueued generation and deterministic grant keys protect multiple replicas/manual replays. Begin with one replica. Failed jobs retain a safe error code and are retried in later cycles without blocking unrelated subjects. Monitor oldest queue time, run failures and 60-second subject timeouts before raising concurrency. Existing blockchain and ecosystem workers remain independent.

Set the worker's `DATABASE_URL` to UglyDex PostgreSQL and `PUBLIC_BASE_URL` to the existing HTTPS application origin; the shared production environment validator requires that origin. `NODE_ENV=production` is set by the Dockerfile. The progression worker does not need `AUTH_SECRET`, Discord, external database or RPC credentials. SIGTERM/SIGINT stops after the current subject and interrupts the idle wait; a hard termination rolls back the open transaction and leaves its durable job for restart.

Run initial production read-only pilots/backfills before announcing earned totals; replay after those histories arrive. No new secrets are mandatory. Rules are code/version controlled, never edited from admin pages. See [progression operations](progression.md#durable-incremental-work-and-replay).

## Collection worker (Phase 5)

Deploy additive native migration `202609270007_collections` with the matching web revision, then run `npm run collections:verify`, `npm run collections:seed` and `npm run collections:rebuild`. Create a service using `railway.collections.toml`, the existing Dockerfile and `npm run worker:collections`. Share UglyDex DATABASE_URL, NODE_ENV=production and the existing HTTPS PUBLIC_BASE_URL required by the common environment validator. No legacy database/RPC credentials or new secrets are needed. Do not give the worker a public domain or HTTP healthcheck.

The worker handles up to 25 collectors then waits 15 seconds. Keep blockchain, ecosystem and progression workers unchanged. Generation-fenced jobs, advisory locks and transactions permit safe retries/overlap. SIGTERM stops between subjects. Monitor `/admin/collections`, failed CollectionJob rows and SyncRun latency. Metadata backfills invalidate candidate hints globally; run them outside peak traffic and drain queues before publishing completion. Global replay resumes via CollectionReplay; targeted `collections:rebuild -- --collector <uuid>` repairs one subject without truncating evidence. Ruleset/catalog changes require a code version bump and explicit replay.

## Phase 6 gallery and image rendering

Run `npm run db:migrate` against UglyDex only to apply `202609280008_sharing`, then deploy the matching web revision. Existing workers remain unchanged. No additional mandatory environment variables, secret, rendering worker, image storage service or native package is introduced. Set PUBLIC_BASE_URL to the canonical HTTPS origin for share links and OG metadata; retain existing AUTH_SECRET for owner sessions. The standard Node/Next runtime bundles image rendering and the Latin font.

Allow outbound HTTPS to gateway.pinata.cloud for canonical Squig artwork. Failed/oversized images use token tiles. Start with 512 MB or more web memory (1 GB gives rendering headroom), monitor `/admin/sharing`, and measure before raising the two-render process limit. The DB supplies shared request/render budgets across replicas. Per-process image cache is capped at 24 PNGs under 2 MB for 60 seconds; responses are private/no-store and must not be overridden by a public CDN cache. There is no durable image artifact to migrate. Keep ShareRenderMetric retention bounded; delete old diagnostic rows during normal UglyDex maintenance, never source/history rows. See [sharing operations](sharing.md#seo-and-operations).
