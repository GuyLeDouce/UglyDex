# Production recovery — 2026-10-31 (America/Toronto)

## Scope and initial evidence

The owner authorized production UglyDex repairs, including variables and data
initialization. UglyBot services and source databases must remain unchanged.

Production runs main `b93f92c5022cef876b3b4e1e0f5f46cb6edc5cb9` (PR 54),
deployment `27c2e195-8d0e-4dfc-968e-ee5cba6f681a`. PRs 49–54 are merged;
the remaining floating-panels branch only removes gallery entry points and does
not explain missing production data.

The opt-in read-only diagnostic measured 4,444 catalog tokens, zero current
ownerships, zero transfers, no chain cursor, no worker controls/heartbeats, zero
collection snapshots and zero collector activity. Two collection jobs and 4,446
progression jobs had never been attempted. Environment and database binding both
matched production. This establishes missing production initialization, not a
failed login or a merely stale frontend cache.

## Completed verification and changes

- Correct production OAuth origin/callback; owner corrected Discord client
  credentials and confirmed successful login.
- PR 54 adds OpenSSL/CA certificates and bounded, opt-in read-only diagnostics.
  Deployment succeeded; previous Prisma OpenSSL detection warnings disappeared.
  The diagnostic flag was returned to false for the next deployment.
- Offline and live production preflight passed schema checksum/drift, deployment
  binding, RPC chain/contract/deployment-boundary checks, all configured external
  read-only source connections, PNG rendering and canonical artwork fetch.
- Refreshed integration validation in UglyDex only. External queries use validated
  read-only transports; no source credentials or raw source rows are in this report.
- Verified scheduled daily/weekly/monthly volume backups and enabled PITR in the
  dedicated UglyDex Database dashboard. Two additional on-demand backup requests
  did not produce visible new inventory entries; neither is claimed successful.
- Created an additional private custom-format logical backup on the existing
  UglyDex database volume, before historical import. File permissions are 0600;
  size 1,880,923 bytes. Both archive listing and full SQL extraction to `/dev/null`
  succeeded. This is readability validation, not a new restore drill. The archive
  is on the database volume; independently stored scheduled backups/PITR remain
  the protection against volume loss.

Backup operator path: `/var/lib/postgresql/data/uglydex-pre-recovery-20261101.dump`.
SHA256: `89cdc85d251a37ca91d45a9e779ccaa5ac5c632ef7e5f48b21813f30518b10f9`.

## Recovery in progress

Used the existing `production:backfill --execute` orchestrator, with per-command
production intent and the verified database fingerprint, inside the existing web
service console. No permanent mutation-confirmation variables were set. Catalog
stage completed without changing any of the 4,444 canonical records. Transfer
indexing started at the independently verified deployment block 25,342,921 and
preserves its durable checkpoint. Subsequent stages and live worker activation
must be verified separately; an incomplete scan is not current ownership proof.

The first 21 transfer batches paused without error at block 25,363,920. The
finalized target observed then was 26,316,781. A separate backfill dependency
defect was confirmed: `queueCollections` enqueues progression after the former
progression stage had drained. The corrected stage sequence runs collections
before progression. A pause/resume orchestrator regression fails with the old
sequence (two stranded jobs) and passes with the corrected sequence. Stage IDs,
existing checkpoints, admission checks and source ledgers are unchanged.

No new worker services have been provisioned. Earlier automatic approval review
rejected adding infrastructure because of scope/cost; explicit provisioning
approval remains outstanding. No cursors or historical evidence were reset.

## Follow-up evidence — 2026-11-01 02:35 UTC

PR 55 is merged at `095e1eb28c00a5323e9b878b46e701e75aba404a` and deployed
successfully as `099b40f8-cca9-418d-889d-3c2f66bbd60e`. GitHub Actions run
41264437622 passed both jobs, including lint, typecheck, unit tests, build,
isolated database/web/browser/catalog tests, format check and identity tests.

Transfer recovery reached the observed finalized block 26,316,877 with no cursor
error and 11,270 persisted transfers. A single 10,000-block trial passed before
using that supported batch size for catch-up; the override was per-command only.
The provenance stage passed for all 4,444 tokens with no dirty records at that
point. The public `/thread` page then visibly showed the November 1 transfer and
October 31 transfers, confirming frontend consumption of imported data.

The subsequent identity import scanned and inserted 384 source records with zero
failures. It created 296 `HISTORICAL_ATTRIBUTION_REVIEW` cases and stopped with
`IDENTITY_REVIEW_REQUIRED`. These are unconfirmed legacy attribution reviews,
not observed conflicting-Discord cases. No reviews were bulk approved or
resolved. Importing that evidence queued 3,380 provenance records for fresh
derivation; therefore the earlier clean-provenance measurement does not describe
the final state. Ecosystem pilots/backfill, collection/progression rebuilding,
final verification and continuous worker operation remain incomplete. The
backfill process exited and its checkpoint is durable; no unattended command is
running. No UglyBot service or database was changed.

The existing worker configurations are `railway.worker.toml`,
`railway.ecosystem.toml`, `railway.collections.toml`, and
`railway.progression.toml`. New production services remain unprovisioned pending
explicit infrastructure approval after the earlier automatic-review rejection.

## Worker provisioning — owner approval received

After the owner approved the estimated additional US$15–30/month planning
allowance, four production-only empty services were created and configured:

| Service             | Railway ID                           | Command                    |
| ------------------- | ------------------------------------ | -------------------------- |
| UglyDex-blockchain  | 740d0d9c-028c-45e9-8d46-c930ddc692d7 | npm run worker:ownership   |
| UglyDex-ecosystem   | dbb1a8fd-123e-4660-a417-96f74f003089 | npm run worker:ecosystem   |
| UglyDex-collections | 98625a8f-9efd-49d4-be3c-1f85053e5270 | npm run worker:collections |
| UglyDex-progression | c561932f-74ef-4ade-86dd-fc706371c2ee | npm run worker:progression |

Each has one replica in us-east4-eqdc4a, a 0.5 GB memory limit, 0.5 vCPU limit,
DB_POOL_MAX=3, 90-second draining and the existing Dockerfile. These resource
limits are not a US$30 billing cap. Variables reference the production UglyDex
service; external integration credentials are included only for the ecosystem
worker and RPC/ownership credentials only for blockchain. No public domains or
new volumes were created. No permanent operational-override variables were set.

Railway rejected new legacy Config-as-Code paths as deprecated. Its documentation
says new services do not read those files, so the equivalent worker settings were
applied directly through the supported service configuration API. Existing web
and staging configuration was not migrated or modified.

An unscoped source-connection attempt was rejected by automatic approval review;
the safer production-scoped staged operation succeeded. The staged patch
`5e6ac057-3da9-43b4-a23e-745cdfd41008` contains only four worker source changes,
pinned to main revision `095e1eb28c00a5323e9b878b46e701e75aba404a`, and is
non-destructive. The accept-deploy tool returned cancellation, but the owner
subsequently clarified that they clicked Deploy directly in Railway. A fresh
platform read confirmed all four deployments started at 02:45 UTC and the staged
patch was cleared. The cancelled tool response must not be interpreted as a
cancelled dashboard deployment.

## Continuous processing and source pilots

The blockchain control was enabled through `production:worker --mode LIVE` after
its transfer-stage completion. A real worker task succeeded, advancing beyond
the recovery checkpoint, deriving 100 pending tokens and refreshing 100 current
owners in its first observed cycle. Unconfirmed legacy attributions remain
unconfirmed. The initial provenance backlog is being processed incrementally.

Bounded pilots ran against all 17 configured feeds (at most 200 source rows each),
with zero failed rows. Sixteen returned records and their pilot approvals were
recorded after reviewing normalizer semantics, event classifications and privacy
checks. Claim events and unfinished/cancelled duels had zero public visibility
violations. `onlineRewards` returned zero rows; no artificial pilot approval or
historical activity was created for it. Schema and source-role validation had
already passed for all feeds. Source databases remained read-only.

The ecosystem worker was enabled in the existing HISTORICAL mode for bounded
source catch-up, retaining source cursors and normal attribution rules. Collection
and progression controls were enabled in LIVE mode to process their durable
queues. These supported worker paths do not resolve the 296 legacy review cases,
and do not mark the stopped all-stage production backfill as verified. Direct
Discord-attributed ecosystem records remain distinct from wallet-history claims.
Read-only DRIP credential/realm references were added to the ecosystem service;
that configuration change redeploys only this new UglyDex service. DRIP sync
success must be checked separately from successful deployment.

At 02:52 UTC all four deployments were SUCCESS. The collection worker completed
a real batch and had created 25 snapshots at the observed checkpoint. The
ecosystem worker completed its first observed historical cycle successfully with
zero reported failures at 02:52:23; source polling runs at five-minute intervals
and resumes durable cursors. At the preceding aggregate checkpoint there were
4,434 activities, 9 of 17 feeds marked historical coverage complete, no ERROR
feeds and 2,081 pending provenance derivations. These are moving catch-up counts,
not final completeness claims. Blockchain and progression also had recent
successful heartbeats without errors. Historical mode remains enabled until
source coverage is complete; no transition to LIVE for ecosystem is claimed.

Successful deployments: blockchain `bb4468bd-a4a5-4a96-869c-76ecf1207335`,
collections `6e05f243-b51c-4d4c-a65a-d7d238ddff47`, progression
`85eada61-7da9-4bd1-a7f2-c7f7113c0ba2`, ecosystem (with DRIP references)
`96512896-4df2-4c24-aef1-49a995d278d9`. Source is pinned to PR 55; future code
rollouts must deliberately update worker revisions rather than assume pushes to
main deploy them. The original full launch/backfill verification remains blocked
by pending identity review; no complete production-readiness certification is
claimed. No UglyBot or TheGauntlet service or source database was modified.

## Earlier local validation results

Diagnostic regression tests (2), targeted ESLint, TypeScript through the production
build, production build and diff whitespace checks passed. The broader unit run
passed 995 tests; 17 browser tests in two suites could not start because Chromium
was unavailable. Browser download returned an invalid archive. This is an
environment limitation, not a passing browser regression run.

The isolated database regression runner could not initialize here: the direct
tsx entrypoint failed its IPC setup, and the Node loader entrypoint reached
PostgreSQL but refused the root runtime. Preparing a disposable non-root copy
was blocked by unsupported ownership changes. The equivalent orchestrator unit
regression is executable; the database regression is retained for CI.
