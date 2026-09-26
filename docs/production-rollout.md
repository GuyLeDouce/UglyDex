# Phase 8 rollout gates

## Phase 9 evidence overlay

Deploy all **eleven** migrations through `202610010011_phase9`. Follow [launch-readiness.md](launch-readiness.md), [replay-validation.md](replay-validation.md) and [data-reconciliation.md](data-reconciliation.md). Use APP_COMMIT/Railway revision for evidence binding. Add `launch:verify`, `launch:rpc`, `launch:provenance`, `launch:spot` and `launch:sources` at the matching steps below. After reviewed imports/reconciliation, run `launch:replay`, then each `launch:handoff` probe. Record manual restore/device/auth/OG evidence only after actual execution. Finish with `launch:check`; a release-check pass alone is insufficient. The Phase 8 sequence below remains the operational base; its ten-migration count is historical.

No real Railway rollout, production archive RPC, legacy database, official manifest or physical device has been validated by the local fixture suite. Record each gate as PENDING, PASS, WARN or FAIL with UTC date, commit, operator, evidence location and issue reference. WARN never becomes PASS through acknowledgment.

## Isolated staging

Create a separate Railway environment/project with its own web, PostgreSQL, blockchain, ecosystem, progression, collections and optional Editions services. Use the committed service TOMLs and the same Docker image/revision as production. Never share the writable UglyDex database or AUTH_SECRET. External sources may be shared only through approved SELECT-only roles. Configure `APP_ENV=staging`, `PUBLIC_BASE_URL`, matching `STAGING_BASE_URL`, a different `PRODUCTION_BASE_URL`, and the production database fingerprint if available. `PRODUCTION_AUTH_SECRET_SHA256` optionally proves that the staging signing secret differs without exposing it. Missing references remain WARN and require recorded manual review of actual Railway resources, including hostname aliases.

`NODE_ENV=production` describes the Next runtime, not the deployment destination. Deployed services require an explicit APP_ENV. Before migrations are applied, `/api/ready` is expected to fail; web's pre-deploy migration runs before readiness becomes green. Do not reverse this ordering.

## Operational intent

After migrations, `npm run ops:fingerprint` prints a non-secret database target fingerprint. In a short-lived operator shell set `OPS_DATABASE_FINGERPRINT` to it and `OPS_CONFIRM=staging:register` (or `production:register`), then run `npm run ops:register`. Registration binds the database to APP_ENV and refuses a conflicting existing identity. Never casually rebind a production database.

Mutating commands require an exact action confirmation and this binding in staging/production:

| Action suffix | Commands                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------- |
| backfill      | production:backfill --execute                                                                      |
| replay        | sync commands, activity reattribution, progression/collections seed or rebuild, provenance rebuild |
| pilot         | integrations:pilot, integrations:pilot:approve                                                     |
| workers       | enabling worker modes, including admin UI                                                          |
| collectibles  | CLI Custom/Edition imports                                                                         |
| editions      | contract registration, indexing batch, contract enablement                                         |
| backup        | consistent logical backup                                                                          |
| release       | deployment record                                                                                  |
| capacity      | capacity measurements                                                                              |

For example use `OPS_CONFIRM=production:backfill` only for the reviewed backfill invocation. Disabling workers/contracts never requires an enablement override. Do not leave mutation confirmation flags permanently in Railway services; enable via the CLI operator environment. The authenticated admin UI can always disable workers; enabling requires the same server environment confirmation.

## Exact operator sequence

1. Select a commit that passed `npm run release:check`. Record its SHA and all source/catalog versions. Confirm a recent backup and tested recovery procedure.
2. Provision isolated staging as above. Keep every worker DISABLED and every Edition contract disabled. Configure OAuth callback for the staging origin and separate signing secret.
3. Deploy web. Its pre-deploy command applies all ten migrations through `202609300010_phase8`. Investigate failed migration/checksum/drift; never automatically resolve it.
4. Register the deployment identity. Run `npm run staging:preflight`, then `npm run production:preflight` for the Prisma live drift comparison. Empty data is WARN, not a validated backfill.
5. Run `npm run staging:smoke`; validate the allowlisted admin interactively. Check anonymous admin denial and a known private profile/gallery, not only nonexistent slugs.
6. Configure the archive RPC. Run `chain:discover-start`, verify code absent immediately before deployment and present at the configured start, then run full preflight. The existing chain cursor persists the validated start/block hash during indexing. A reported explorer start block is not accepted as independent proof.
7. Validate all external roles/schemas with `integrations:inspect` and `integrations:validate`. Review adapter assumptions, guild scoping, rejected rows and missing tables. No external write role is acceptable.
8. For each configured feed run `npm run integrations:pilot -- --feed <feed> --since <ISO-date>`. This imports at most 200 rows, without advancing the full cursor or declaring history complete. Inspect normalization, event identities, attribution, Squig links, corrections and privacy. Review marketplace/payment, CHARM/payout and creator reward pairs using existing canonical event rules. Record evidence; no real-data normalization changes are inferred without source rows.
9. Approve a successful reviewed pilot with `npm run integrations:pilot:approve -- --run <printed-audit-id> --reviewed`. Approval is tied to the source schema fingerprint. Changed schemas require another pilot.
10. Review/import official collectible candidates using the workflow in collectibles.md. No manifest is seeded as official by this release. Catalog presence is separate from Edition ownership.
11. Take the pre-backfill backup. Run `production:backfill` plan, then bounded `--execute --batches 20`. Observe each checkpoint and gate. Resume the same command; `--from` requires earlier completed stages. Provenance/reconciliation/rejections and verification FAIL cannot be bypassed. A reviewed noncritical WARN can be acknowledged with `--accept-warning activity.coverage,...`; the audit retains the WARN. Completed stages are revalidated on normal resume.
12. Order remains catalog → transfers → provenance → identity review → activity → progression → collections → verification. Keep background workers disabled until queues drain. Resolve actual conflicts through `/admin/reconciliation`; test confirm/reject/time-split/audit and downstream rebuild with reviewed cases. Never resolve merely to improve totals.
13. Save `production:report`, `production:verify -- --owners full`, `provenance:verify` and `collectibles:verify`. Review anomalous token IDs, missing mint coverage, owner mismatches and unavailable reads. Rebuild derived data a second time only after evidence settles; compare canonical ledger/evidence and completion, excluding calculation timestamps. Reloaded completion v1 stays unchanged.
14. Exercise backup/restore drill, deployment interruption/resume, source outage and RPC outage in staging. Run smoke and the device/OG matrix. Resolve FAIL before production approval.
15. Repeat steps 1–13 against the dedicated production database using APP_ENV=production and production-specific intent. Never copy staging credentials or restore into production.
16. Enable LIVE blockchain first; confirm finalized lag and successful heartbeats. Then ecosystem, progression and collections, checking each dependency and queue before the next. Enable an Edition contract only after official registry verification and a bounded historical pilot. Deploy `railway.editions.toml` if continuous indexing is required.
17. Run `production:smoke`, public crawler/device checks and modest `capacity:web`. Record the deployment using `ops:deployment -- --commit <sha> --note <public-safe-note>` with release intent. Monitor `/admin/production`, Railway logs/memory, rejection counts and share busy responses.

## Backups and restore drill

Verify scheduled/on-demand backup support, retention, storage costs and PITR support in the actual Railway plan/image. No retention or PITR guarantee is asserted here. See [Railway backups](https://docs.railway.com/reference/backups) and [PostgreSQL pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html). Choose and record retention sufficient for the incident detection window; retain pre-backfill, pre-major-migration, pre-ruleset-change and pre-remediation backups until verification and rollback windows close.

Where a logical archive is needed, use an approved operator host with version-compatible PostgreSQL client binaries. `npm run ops:backup -- <private-path.dump>` takes a custom-format pg_dump at an exported repeatable-read snapshot and writes a companion inventory/hash. Archive and inventory are private, access-controlled, encrypted by the operator's storage tooling, and ignored by Git. The command does not implement encryption or retention. Use a read-only source role; credentials are passed through process environment, not command arguments or logs. Associate the archive timestamp/hash with deployment SHA and migration version in the release record.

Create an EMPTY database named `uglydex_restore_<unique-suffix>` on an isolated recovery service. Set `RESTORE_TARGET_URL` only in the operator shell and `RESTORE_DRILL_CONFIRM=RESTORE_INTO_EMPTY_DISPOSABLE_DATABASE`. Run `npm run ops:restore:drill -- <private-path.dump>`. It rejects production-looking names/hosts, source/current database fingerprints, known production fingerprints and any nonempty target. It never uses `--clean` or `--create`. Only trusted reviewed UglyDex archives may be restored; a database archive can contain executable SQL.

The drill checks archive SHA256, all inventoried table row counts/digests, then disables restored automation and runs production integrity verification. A successful pg_restore alone is insufficient. FAIL leaves the isolated target for diagnosis. The database is never automatically deleted or promoted. Verify auth/private galleries on a matching isolated web service before marking the restore drill PASS. Record duration, restored recovery point and all discrepancies. Restore tests for production-looking/same-source/missing-confirmation targets run locally; a real archive drill is PENDING until client binaries and a reviewed backup are available.
