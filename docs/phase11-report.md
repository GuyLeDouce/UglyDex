# Phase 11 operational evidence — 2026-09-27 UTC

Later focused source-connectivity/RPC work is recorded in
[the source/RPC follow-up](phase11-source-rpc-report.md). The checkpoint below is
retained as historical evidence; it predates that repair.

**No gate-approved production launch occurred.** Staging runs application commit `0687d01cc565c90b9af7068ec88baf06abc42fc4`; production continues serving `c764e2810715be0608e5fadc47d45a6a391ba674`. Work is on `phase11-launch-evidence`, descended from Phase 10 evidence commit `d6684d6` on `phase10-evidence-20260927`. The documentation commit containing this report is the evidence checkpoint; no application change follows `0687d01` in this checkpoint.

## Checkpoint and launch decision

The initial tree was clean. The Phase 9 and application checkpoints were verified in ancestry. Phase 10 reports, rollout instructions and stored gates were inspected before changes. Initial release validation passed 506 unit tests and 814 DB/HTTP/browser assertions.

| Environment / observation        | Decision      | VERIFIED | PENDING | PARTIAL | DEGRADED | FAILED | Blockers | Optional warnings |
| -------------------------------- | ------------- | -------: | ------: | ------: | -------: | -----: | -------: | ----------------: |
| Staging, Phase 10 checkpoint     | NOT_READY     |        7 |      22 |       2 |        0 |      0 |       13 |                11 |
| Production, Phase 10 checkpoint  | BLOCKED       |        5 |      20 |       0 |        1 |      5 |       15 |                11 |
| Staging, final Phase 11 check    | **BLOCKED**   |    **3** |  **21** |   **2** |    **1** |  **4** |   **17** |            **11** |
| Production, final Phase 11 check | **NOT_READY** |    **5** |  **21** |   **2** |    **0** |  **3** |   **15** |            **11** |

Both final `launch:verify`, `launch:check` and `launch:report` ran on their actual Railway environments. Both launch checks returned **exit 1**. Staging ARCHIVE_RPC is DEGRADED from observed sustained HTTP 429; four optional source gates fail TLS connectivity. Production WALLET_LINKS/UGLYBOT improved from FAILED to PARTIAL after one-shot reader validation; the other three source gates remain FAILED. Production REATTRIBUTION recovered from DEGRADED to PENDING after normal processing and correction of stale evidence. It was not waived or marked VERIFIED.

The reduced staging VERIFIED count follows strict commit binding: old BACKUP, RESTORE_DRILL, ARCHIVE_RPC and START_BLOCK records refer to `c764e28`, while staging now runs `0687d01`. Historical backup/restore/boundary evidence remains valid evidence of those earlier executions and is retained in Phase 10 reports/audits. No evidence table or cursor was reset. No bulk carry-forward was performed. The archive gate additionally has new adverse throughput evidence.

Current verified staging gates: DATABASE, MIGRATIONS, WEB_DEPLOYMENT. Current verified production gates: DATABASE, MIGRATIONS, WEB_DEPLOYMENT, BACKUP, RESTORE_DRILL. **No additional launch gate became fully VERIFIED** during this phase; reader provisioning, privacy checks and queue recovery are useful partial evidence, not completed downstream gates.

Production blockers: WORKERS, ARCHIVE_RPC, START_BLOCK, MINT_COVERAGE, OWNERSHIP_CONTINUITY, OWNER_OF, REATTRIBUTION, ACTIVITY, DUPLICATE_REVIEW, PROGRESSION, COLLECTIONS, DERIVED_REPLAY_STABLE, HANDOFF, PRIVACY_AUTH, REAL_DEVICE_SHARE. Staging has the same seventeen-key list including BACKUP and RESTORE_DRILL for its new revision.

All eleven optional warning keys remain unresolved: WALLET_LINKS, UGLYBOT, GAUNTLET, SURVIVAL, IMAGE_SUBMIT, IDENTITY_REVIEW, EXTERNAL_OG, CUSTOM_MANIFEST, EDITION_MANIFEST, EDITION_CONTRACTS, HOLDER_TIERS. Optional-source policy does not waive the blocking activity/reconciliation/replay requirements. Evidence also expires after 24 hours; this report is a dated checkpoint.

## Infrastructure and source access

Both Railway databases and web services were accessible. Staging deployment `df66acec-55c9-4cfb-8d14-12a332524857` succeeded from an exact Git archive of the tested fix. Runtime source and APP_COMMIT were checked. Eleven migrations/checksums and ten HTTP/PNG smoke assertions passed. Staging preflight returned non-zero because source TLS checks failed; deployment, origin/isolation, database, catalog, contract and boundary checks passed.

No production deployment was initiated. An already-existing GitHub deployment of `c764e28` failed readiness before this work; the earlier successful deployment remains serving. Logs showed eleven applied migrations and repeated readiness 503; the root cause of that failed attempt is unresolved. It is not evidence of a successful rollout.

The owner explicitly authorized **dedicated reader roles and SELECT grants**. Seven physical source databases received `uglydex_reader`, covering eight logical connections. Passwords were generated in memory, passed privately to PostgreSQL and stored directly in Railway. Bot credentials, source rows and table definitions were not modified. Existing public TCP endpoints were reused; no new public endpoint was provisioned.

| Logical connection | Provisioning / privilege evidence                                                | Actual routing / schema result                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Wallet links       | Dedicated reader; VERIFIED_READ_ONLY catalog review                              | Production one-shot private connection and required schema pass                                                                                 |
| UglyBot main/team  | Dedicated reader; VERIFIED_READ_ONLY catalog review                              | Production one-shot private connection and required schema pass                                                                                 |
| UglyBot prizes     | Dedicated reader; VERIFIED_READ_ONLY catalog review                              | Production one-shot private connection and required schema pass                                                                                 |
| UglyBot claims     | Dedicated reader; VERIFIED_READ_ONLY catalog review                              | Production one-shot private connection and required schema pass                                                                                 |
| UglyBot points     | Dedicated reader; VERIFIED_READ_ONLY catalog review                              | Production one-shot private connection and required schema pass                                                                                 |
| Gauntlet main      | Role transaction aborted before creation                                         | gauntlet_runs exists; gauntlet_online_reward_events absent; old cross-project private hostname resolves to unrelated database and returns 28P01 |
| Survival           | Dedicated reader; source-local login/catalog guards pass                         | Public endpoint reached, but certificate validation fails; deployment schema remains unverified                                                 |
| Gauntlet Images    | Dedicated reader shared with ImageSubmit; source-local login/catalog guards pass | Public endpoint reached, but certificate validation fails; deployment schema remains unverified                                                 |
| ImageSubmit        | Same physical image database and reader, separate logical variable               | Public endpoint reached, but certificate validation fails; deployment schema remains unverified                                                 |

The five private-network readers have CONNECT/SELECT, read-only transaction defaults, no superuser/create-db/create-role/replication/bypass-RLS attributes, no database/schema ownership or CREATE, and no detected table/column write grants or executable user SECURITY DEFINER routines. The provisioning transaction checked required SELECT access and inherited/public privilege hazards before COMMIT. No source-row write was used as a privilege test. Built-in `launch:sources` conservatively labels its own narrower check LIKELY_READ_ONLY and leaves source gates PARTIAL; the stronger operator review does not prove imported history.

All eight public reader connection tests failed with SELF_SIGNED_CERT_IN_CHAIN under normal TLS validation. The inspected image source certificate has only DNS:localhost, signed by root-ca, valid 2026-02-14 through 2028-05-14. A CA trust addition alone would still leave a hostname mismatch. Public URLs now explicitly use sslmode=verify-full. Verification was never disabled. Cross-project DNS errors were replaced by a reachable endpoint, but secure connectivity is **not yet complete**.

New reader variables are active on staging. Production desired variables are saved; the private-reader checks used a one-shot operator process. The serving production web process has **not** activated those new variables through redeployment. Workers remain disabled. Main Gauntlet still needs a reviewed schema resolution and dedicated reader. See [the exact SQL, service mapping and operator walkthrough](operator/phase11-readers/README.md).

## RPC and provenance

The configured provider was identified as Infura without printing its endpoint/key. Initial probes of latest height, historical block, deployment bytecode, pinned ownerOf and historical logs all returned HTTP 429: **10/10 failures**, sequential, 2.5 seconds apart, no Retry-After header. Response hints did not identify daily quota, compute budget, concurrency or range restrictions.

After staging redeployment, the same ten probe types all succeeded: **10/10 HTTP 200**. Each 1,000-block log probe for 25,352,921–25,353,920 returned **3,088 events**. This temporary recovery did not establish sustained capacity.

| Resume attempt | Block batch |          Request pacing | Calls through paced reader | HTTP 429 failures | Bounded retries |   Duration | Committed batches |
| -------------- | ----------: | ----------------------: | -------------------------: | ----------------: | --------------: | ---------: | ----------------: |
| First          |       1,000 |   500 ms, concurrency 1 |    322: 321 block + 1 logs |                 5 |               4 | 166,340 ms |                 0 |
| After cooldown |         100 | 1,000 ms, concurrency 1 |    124: 123 block + 1 logs |                 5 |               4 | 127,291 ms |                 0 |

Contract-validation requests preceding the paced reader are excluded from these call counters. Each attempt stopped with RPC_RETRIES_EXHAUSTED. The atomic ledger checkpoint was preserved; intermediate uncommitted block reads did not become evidence of indexed progress. No cursor rewind/reset occurred. Sustained capacity at the measured settings is insufficient; the exact account/provider limiting mechanism remains unknown.

The [published PublicNode Ethereum endpoint](https://ethereum.publicnode.com/) was tested as a possible free replacement. Four latest/historical-block requests passed; six required historical bytecode/owner/log requests returned HTTP 403 / JSON-RPC -32602. It was not selected or configured. Standard ETH_RPC_URL replacement remains supported; no provider-specific application logic was added.

Known deployment boundary remains **25,342,921**, with token 1 first observed mint at **25,349,689** from Phase 10 archive evidence. This historical fact was not inferred from OpenSea or redefined because throughput failed.

| Provenance metric              |       Staging | Production |
| ------------------------------ | ------------: | ---------: |
| Expected Reloaded Squigs       |         4,444 |      4,444 |
| Canonical traits               |        44,440 |     44,440 |
| Transfer ledger events         |         3,405 |          0 |
| Mint events / unique token IDs | 2,035 / 2,035 |      0 / 0 |
| Indexed cursor                 |    25,352,920 |       None |
| Stored finalized target        |    26,065,214 |       None |
| Provenance rows                |         2,035 |          0 |
| Clean continuous rows          |           100 |          0 |
| Dirty provenance rows          |         1,935 |          0 |
| Wallet ownership periods       |           171 |          0 |
| Collector ownership periods    |             0 |          0 |
| Persisted ownerOf matches      |             0 |          0 |
| Recorded burn events           |             0 |          0 |

The stored finalized target is an earlier observation, not a claim to current head or completed indexing. Dirty rows await completion of the input ledger. Full ownerOf verification, current-owner/mismatch/revert/RPC-failure totals, duplicate-transfer/missing-mint/broken-chain audit and raw-to-UI sample audit were **not run**; unresolved anomaly count is **not established**. Zero persisted owner matches is not a successful full verification. Production did not copy staging rows or start an unsafe rollout.

Existing configuration names remain TRANSFER_BLOCK_BATCH, RPC_CONCURRENCY, RPC_RETRIES and RPC_TIMEOUT_MS. Attempts used concurrency 1 and the existing four bounded retries; no retry budget was increased. Minimum-interval pacing was an operator wrapper, **not a newly implemented environment variable**. Neither measured configuration is certified for sustained production use. Resolve account/key quota or supply an independently validated archive provider before resuming this exact cursor.

## Imports, identity and derived state

No pilots or full historical imports ran. All 17 feeds remain NOT RUN: duels, marketplace, purchases, bounty, bountyEntries, bountyResults, maw, mawPrizes, claimEvents, runs, survival, onlineRewards, imageUses, submissions, liveImages, madlibPublications, madlibOperations. Pilot/full-import rows scanned and inserted during this phase: **0**. Eligibility, normalization, update/skip/rejection/attribution/linking metrics were not evaluated; they are not fabricated as zero. No source was declared COMPLETE. Schema/count inspection is separate from import scanning.

No cross-source duplicate/economic audit was performed on unimported inputs. Production's one pending attribution job was processed through reattributePending: **before 1, processed 1, remaining 0, new corrections 0, activities 0**. Staging's synthetic login likewise produced one job; normal processing drained it. No manual SQL queue deletion occurred.

| Identity / derived metric                                          |                          Staging |           Production |
| ------------------------------------------------------------------ | -------------------------------: | -------------------: |
| Collectors / linked wallets                                        | 1 / 1, synthetic privacy fixture | 1 / 1, existing user |
| Discord external identities                                        |                                0 |                    0 |
| Reconciliation cases / decisions                                   |                            0 / 0 |                0 / 0 |
| Collector activities / discoveries                                 |                            0 / 0 |                0 / 0 |
| XP grants / Collector progress / Squig progress                    |                        0 / 0 / 0 |            0 / 0 / 0 |
| Collector / Squig achievements                                     |                            0 / 0 |                0 / 0 |
| Trait discovery / set progress / completion snapshots / milestones |                    0 / 0 / 0 / 0 |        0 / 0 / 0 / 0 |
| Progression jobs / collection jobs                                 |                        4,445 / 1 |            4,445 / 1 |

No ambiguous identity decision was forced. The empty case table does not prove a conflict-free imported population. Historical attribution and downstream correction samples remain untested. Revoked-grant/completeness-gated/invalid-evaluation production reports were not run on stable populated inputs.

**Production Replay A fingerprint: unavailable. Replay B fingerprint: unavailable. Semantic diff: not measured.** Replay prerequisites remain unstable/incomplete. Local fixture Replay A/B passed release validation but were not submitted as production evidence.

## Recovery, workers and capacity

Phase 10 backup/restore evidence is retained. No new populated backup or populated restore drill was claimed: historical/derived inputs remain incomplete. Staging's old catalog recovery evidence is not automatically rebound to the new application commit. Production's existing catalog backup/restore gates still match its unchanged application revision at this checkpoint.

All four workers remain effectively DISABLED; worker-control rows and heartbeat rows are both zero. No LIVE enablement, successful-cycle observation, handoff proof or full-topology capacity measurement occurred. No cadence/pool/renderer limit was raised. Staging failure injection and kill/restart tests were not executed; natural RPC retries demonstrated safe failure/cursor preservation, not the full required failure/alert/recovery matrix.

Actual Railway staging HTTP samples, five sequential requests per route from the operator machine:

| Route    |    p50 |    p95 | Failures |
| -------- | -----: | -----: | -------: |
| Home     | 104 ms | 558 ms |      0/5 |
| Explorer | 157 ms | 211 ms |      0/5 |
| Squig 1  | 113 ms | 156 ms |      0/5 |

Share measurements: first square **6,836 ms**, repeat **524 ms**; first landscape for the same already-warmed artwork **172 ms**, repeat **106 ms**. Two concurrent first requests for different tokens took **3,585 / 7,749 ms**. Four-request cached burst with maximum concurrency two took **592 / 532 / 131 / 111 ms**. All ten image responses were valid PNG/HTTP 200. First-request labels infer cache state; no forced global cache eviction was performed. Landscape was not an independent cold-artwork test.

Separate staging-process breakdown on three additional public Squigs:

| Token | Projection | Artwork headers / full read | PNG render | Fallback |
| ----- | ---------: | --------------------------: | ---------: | -------- |
| 54    |     123 ms |            4,375 / 4,378 ms |     198 ms | No       |
| 55    |       6 ms |            3,784 / 3,792 ms |      67 ms | No       |
| 56    |       6 ms |            4,558 / 4,563 ms |      65 ms | No       |

Operator-process RSS moved from 352,485,376 to 489,877,504 bytes across those three renders. This is not a measurement of the web service's steady-state memory or evidence of a leak. Recent actual web render metrics showed status OK, zero artwork failures and cache hits at 0 ms internal render duration. The observed first-render bottleneck is remote artwork fetching. Existing bounded cache and render concurrency were retained; no speculative cache architecture, timeout reduction or provider change was added. Populated Collector/activity/gallery/collection capacity and the complete worker topology remain unmeasured.

## Auth, privacy, devices, OG and collectibles

A real staging HTTP exercise on `c764e28` passed **26 assertions** using an ephemeral unfunded synthetic wallet: signature/domain verification; Secure/HttpOnly session cookie; nonce replay rejection; cross-origin rejection; private/public profile transition; wallet shown/hidden; public profile/gallery PNG; public-to-private gallery/profile; denial of previously cached private share responses with private/no-store; logout and subsequent unauthorized settings denial. The fixture profile and empty gallery were left private, the session logged out, and the key was not retained. This is API evidence, not a physical-device wallet test. The later `0687d01` change only affects gate recovery; ten smoke assertions and the full regression suite passed on that revision.

Actual Discord consent/code exchange, linking/conflict and complete wallet-provider interaction remain PENDING. Both configured callback paths still need registration confirmation in the Discord application and a real consent round trip. Phase 10 user-reported Brave + MetaMask signature login/session persistence is preserved; no new device/browser-version result was invented. Physical iPhone tests: **0**. Physical Android tests: **0**. New third-party OG crawler previews: **0**. All six preview categories remain PENDING; HTTP/custom user-agent checks are not third-party validation. UglyDex stopped serving personalized images immediately in the tested privacy transitions, but third-party copies may persist outside UglyDex control.

Customs imported: **0**. Editions imported: **0**. Edition contracts indexed: **0**. The supplied Customs contract reference still requires reviewed authoritative token/artwork evidence; no official relationship or entitlement was inferred from its name. OpenSea can assist metadata cross-checks, not replace archive Transfer and pinned owner evidence. No engagement or financial feature was added; progression-v1 and collection-v1 are unchanged.

## Defect, tests and evidence handling

One observed operational defect was fixed separately in `0687d01`: launch:verify retained a stale DEGRADED attribution gate after its real job queue drained. It now refreshes that observation to PENDING, never auto-VERIFIED. Three regression tests cover recovery, continued backlog, and preserving reviewed VERIFIED evidence when the queue is empty. The recovery case failed before the fix. Staging reproduced DEGRADED with its real queued fixture job and PENDING after normal queue processing. Production's stale record was separately corrected from actual queue counts using the tested condition; its web code remains `c764e28`.

Full post-fix release:check **PASS**: **509 unit tests / 14 files, 814 DB/HTTP/browser assertions**, lint, formatting, typecheck, build, migrations and fixture replay. Dependency audit: **0 vulnerabilities / 689 dependencies**. No npm major upgrade or unrelated refactor was performed. Final documentation formatting passed. The secret/history scan inspected 350 working-tree files and 555 historical blobs with zero findings.

Private SSH logs, hashes, source inspections and operational outputs remain ignored under .data/phase11. No passwords, credential URLs, identity exports or database dumps are committed. Public-safe source count observations are in [phase11-source-observations.md](phase11-source-observations.md). SQL templates contain no credentials. The temporary Railway SSH key registration was removed after operational checks and the follow-up source reinspection completed.

## Next scope

Continue launch operations. First resolve public source TLS/hostname trust and the missing Gauntlet feed, activate reader configuration through controlled deployment, and obtain sustainable archive RPC throughput. Resume the preserved ledger, complete provenance/owner/sample verification, then source pilots/full imports, duplicate review, identity reconciliation, real Replay A/B, handoff and staged workers. Follow with populated recovery, Discord/device/share/third-party OG, failure recovery and complete topology measurements. Revalidate revision-bound gates individually. Production rollout stays prohibited while blockers remain. No Phase 12 engagement work is recommended.

## Follow-up source review requested by the owner

At 2026-09-27T03:05:17.665Z, fresh repository fetches and live catalog-only reinspection confirmed 25/26 mapped required tables and all required columns on the present tables. The missing table remains gauntlet_online_reward_events. Seven reader roles already exist from the earlier authorization; none was added or changed during this follow-up. The owner requested review before further grants. [Eight new exact SQL proposals and the full table mapping](operator/phase11-reader-review/README.md) are prepared but **not executed**. The proposed Gauntlet script covers only gauntlet_runs and explicitly leaves the missing feed unresolved.
