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
