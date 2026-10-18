# Production release package — approval required

Select only the exact candidate SHA and PR recorded in the final validation
record. Do not deploy a moving branch. No command in this document is permission
to merge, deploy production, change external services or enable production workers.
PR #7 was externally merged during stabilization and triggered production's
autodeploy; the remaining release requires a new approval after all critical gates.

## Configuration review

Compare the actual production image, APP_COMMIT and RAILWAY_GIT_COMMIT_SHA. Resolve
the observed stale APP_COMMIT only in the approved production rollout. Build and
runtime APP_COMMIT must equal the candidate SHA; check release-manifest.json in
each image. Use MIGRATION_BYTE_PROFILE=production. The staging profile is different.

Required configuration names, without credential values:

- APP_ENV, APP_COMMIT, DATABASE_URL, PUBLIC_BASE_URL, PRODUCTION_BASE_URL,
  MIGRATION_BYTE_PROFILE, DB_POOL_MAX, WORKER_INTERVAL_MS.
- AUTH_SECRET, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI,
  ADMIN_DISCORD_IDS, ADMIN_DIAGNOSTICS_TOKEN. OAuth callback must use the exact
  production origin. Signing secrets and writable databases must be distinct
  from staging.
- ETH_RPC_URL, SQUIGS_CONTRACT_ADDRESS, SQUIGS_START_BLOCK,
  ECOSYSTEM_GUILD_ID, UGLYBOT_BOT_DISCORD_ID.
- UGLYBOT_BRIDGE_URL, UGLYBOT_BRIDGE_SECRET, GAUNTLET_BRIDGE_URL,
  GAUNTLET_BRIDGE_SECRET, IMAGE_BRIDGE_URL, IMAGE_BRIDGE_SECRET, or the reviewed
  SELECT-only direct-source configuration: UGLYBOT_DATABASE_URL,
  UGLYBOT_PRIZES_DATABASE_URL, UGLYBOT_CLAIMS_DATABASE_URL,
  UGLYBOT_POINTS_DATABASE_URL, GAUNTLET_DATABASE_URL,
  GAUNTLET_SURVIVAL_DATABASE_URL, GAUNTLET_IMAGE_DATABASE_URL,
  IMAGE_SUBMIT_DATABASE_URL, WALLET_LINKS_DATABASE_URL.
- DRIP_READ_API_KEY, DRIP_REALM_ID, DRIP_REALM_POINT_ID, DRIP_MAX_RPM,
  DRIP_SYNC_INTERVAL_MS, DRIP_STALE_AFTER_MS, DRIP_SWEEP_PAUSED. Do not release
  while the required sweep is paused or member credential access remains denied.

Provision separate production bridge instances/secrets and source reader credentials
where required. Staging credentials are not production provisioning evidence.
Any external account/database/permission change requires the owner's separate
authorization. No bot hooks or currency writes are part of this release.
OPS_CONFIRM and OPS_DATABASE_FINGERPRINT are short-lived operator intent only,
never permanent worker configuration. RESTORE_TARGET_URL and
RESTORE_DRILL_CONFIRM belong only to the disposable restore operator process.

## Deployment and migration order

1. Re-read the final PR checks and every critical staging gate. Complete genuine
   account/device validation below. Inspect current production state again; it
   may have changed since October 17. Approval must name the exact SHA.
2. Keep all production workers and Edition processing disabled. Confirm the
   production database identity, environment binding and isolation from staging.
   Take a consistent production backup before rollout; protect the archive and
   inventory. Verify its digest and a populated disposable restore with workers,
   external reads and Edition processing disabled. Confirm disposable cleanup.
   Railway retention/PITR settings require actual account review; no guarantee is
   inferred from a successful logical backup.
3. Build the exact commit using the committed Dockerfile and reviewed production
   migration-byte profile. Compare all 13 packaged checksums with the current
   production ledger before running migrations. This release changes no SQL
   semantics and introduces no new migration. Unknown ledger differences stop
   the rollout; never rewrite checksums or use migrate resolve to conceal them.
4. Deploy web with the supported pre-deploy `npm run db:migrate`. Then run
   `production:preflight`, `production:smoke`, and `collectibles:verify` on that
   runtime. Verify readiness, schema drift, exact image manifest and APP_COMMIT.
   Register a database binding only if absent and independently verified.
5. Deploy blockchain, ecosystem, progression and collections from the same exact
   candidate, still disabled. Use their committed service start commands. A
   Railway variable update does not replace an already-built image.

## Bounded production synchronization

Production was observed with catalog data but no transfers, provenance or activity.
Staging contents must not be copied into production as a substitute for imports.

1. Run `launch:rpc`, `chain:discover-start`, source inspection and
   `integrations:validate`. Confirm source roles, schema fingerprints and coverage.
2. Run reviewed bounded `integrations:pilot` imports for each configured feed;
   review normalized attribution and duplicate/source-reference semantics, then
   use `integrations:pilot:approve` for those actual runs. An empty source has
   bounded observable coverage, not complete historical coverage.
3. Run `production:backfill` plan, then its guarded `--execute --batches 20`
   procedure. Resume durable checkpoints in order: catalog, transfers, provenance,
   identity review, activity, progression, collections, verification. Inspect each
   batch before continuing. Preserve intentional unresolved attribution; do not
   link identities by name or clear errors/queues to improve status.
4. Run `production:verify -- --owners full`, `provenance:verify`, `launch:audit`
   and `collectibles:verify`. Review actual duplicate candidates and unresolved
   identities. Official Custom/Edition manifests require separate supplied evidence.
5. At a stable boundary with workers and Editions disabled, run guarded
   `launch:replay` and the bounded `launch:handoff` probes for reviewed feeds.
   Require unchanged canonical ledgers and matching semantic Replay A/B outputs.
   Use normal targeted processing to resolve failures; never reset chain cursors,
   truncate history or delete queues.
6. Verify exact DRIP economy and identifiers with the production-scoped read key.
   Complete a fresh scheduled sweep and genuine authenticated linking/refresh.
   Permission denial stops retries and leaves CHARM_DRIP pending. Cached values
   remain stale/unknown as appropriate and must never be inferred from activity.

## Worker activation and validation

Enable LIVE blockchain first through guarded `production:worker`, after fresh
chain admission evidence. Confirm a successful bounded processing cycle, canonical
cursor continuity and finalized lag. Then enable ecosystem, progression and
collections in that order, checking source validation, processing success and
queue drain at each step. LIVE alone is not health. A persistent WAITING_BACKFILL,
WAITING_SOURCE_VALIDATION, circuit breaker, failed job or stale heartbeat stops
activation of dependent workers.

Run `launch:verify`, `launch:check`, `production:smoke` and actual account/privacy
flows on the deployed revision. Record deployment evidence with `ops:deployment`.
Check image loading/download, explorer pagination/filtering, passports/history,
achievements/sets, collector navigation and public/private/unlisted gallery behavior.
Monitor safe error codes, failed jobs, source lag and share-render failures. Do not
export raw account data, private links, balances, wallet mappings or session tokens.

## Stop and recovery

Stop for migration/drift/checksum mismatch, unexpected database binding, changed
source permissions/schema, canonical inconsistency, duplicate awards, privacy
leakage, failed replay, unresolved DRIP access or stale revision-bound evidence.
Disable affected workers through audited controls and preserve checkpoints and
logs. Roll back the web image only to a reviewed schema-compatible image after
approval. Do not automatically down-migrate or overwrite a live database.
If data restoration is necessary, first restore the protected backup to a new
isolated database, verify inventories/containment and request separate approval
for production cutover. See [rollback](rollback.md) and
[existing rollout procedure](production-rollout.md) for command syntax.

## Exact owner validation checklist

Record staging URL, candidate SHA, UTC time, device model, OS/browser/wallet
versions and pass/fail evidence without secrets for each row.

| Device                                                                                              | Required genuine interaction                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop with supported injected EIP-1193 wallet, including the owner's Brave + MetaMask combination | Complete/cancel Discord sign-in; logout; accept/reject wallet message signature; reload persistence; switch accounts and verify isolation; reject reused nonce/link conflict; verify private/public/unlisted profile and gallery in a separate anonymous session; link exact DRIP ID and click refresh; check stale/error display, keyboard focus/account menu; copy link and download PNG. |
| Android, including the owner's Samsung phone                                                        | Record model/Android version; inspect Chrome layout and artwork; verify the honest no-provider state where applicable; use an actual wallet browser for message signing/account switch; open/cancel native sharing; save/download image and reopen it; repeat gallery/passport sharing and privacy checks.                                                                                  |
| iPhone/iOS                                                                                          | Record model/iOS/Safari version; inspect Safari layout, menu/focus and artwork; use a supported injected wallet browser for signatures; verify no-provider messaging in Safari where applicable; open/cancel native share sheet, save to Photos/Files and reopen PNG; share gallery/passport and check private transitions anonymously.                                                     |

Use no blockchain transaction: this flow requests an authentication message only.
Emulation does not certify physical devices, Safari/WebKit, mobile wallet injection
or native share sheets. External OG previews require a real platform preview/draft
check and a public-to-private rescrape observation; do not publish a post merely
to test. Third-party cached copies cannot be claimed erased by an origin change.
