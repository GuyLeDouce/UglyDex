# Phase 12A — LIVE convergence and read-only $CHARM

Date: 2026-10-03. Branch: `phase11-launch-evidence`.

## Current checkpoint

- Starting evidence head: `047aef3387f15f6eb5af2477fb57da30738693cf`.
- Current staging application revision: `f3386acef5f8ea9aa4f9b911869eb89962fce6a7`.
- The evidence report is committed separately; that documentation-only commit was not deployed.
- Current staging web deployment: `2a27f487-f138-47e7-ade2-dc18effbeeaa`, SUCCESS.
- Production application revision: `c764e2810715be0608e5fadc47d45a6a391ba674`; production was not changed.
- The prior staging app was `0c8e5f8fc0d5db8c587c749479922accde723ae3`, rather than the expected frozen replay revision `cd15cd3`. Work continued from the checked-out safe branch head and preserved its history.
- The Phase 11 populated restore evidence was not repeated. Phase 11 chain, source, identity, activity, progression, and collection values were inspected and preserved. The live chain advanced normally; no cursor reset, ledger truncation, reimport, or rebuild was run.

## Live convergence

- Frozen Replay A/B proof: `b6a1d45d-d9fc-454a-9771-37da3cb450c1`, application commit `cd15cd36c835be38b316ea7bd6fc9c45bab0f77f`, input fingerprint `83b5ec1c293e1452ee560ddd3afd35da72a6c2d61494b3273184d7419f7162f1`. The recorded A/B result matched all 11 derived tables with zero semantic differences.
- Live input had legitimately advanced from the frozen fingerprint during source indexing/reconciliation. The implementation adds a separate `LiveDerivationProof` and compares deterministic read-only recomputation to the current persisted projections; frozen ReplayProof semantics are unchanged.
- Current-revision live proof: `8af4c0f8-69ed-4dcf-b4df-8c6678614047`, status VERIFIED, application commit `f3386acef5f8ea9aa4f9b911869eb89962fce6a7`, captured `2026-10-03T16:50:10.246Z`.
- Captured input fingerprint: `db6ec888cc6b77024cb186f3fde186042212979a71b7345555176bb39a8d7dcd`.
- All queues were drained at that boundary: attribution 0, progression 0, collections 0, failed jobs 0, dirty provenance 0. All four workers were LIVE and healthy.
- Read-only deterministic checks passed: provenance recomputation (4,444 ledgers, zero discrepancies); progression recomputation (4,822 subjects, zero discrepancies); collection recomputation (zero discrepancies); ingestion/worker boundary (all four workers healthy).
- All 11 derived-table fingerprints matched recomputation:

| Derived table           |   Rows | SHA-256                                                            |
| ----------------------- | -----: | ------------------------------------------------------------------ |
| CollectorProgress       |    378 | `1f8b808b9eb72a4f5cbe95a37af6beb01585d47ffddca3f63b9b50098319bd92` |
| SquigProgress           |  4,444 | `942e5ca0c3ddc5a6a27018f8a64791831e4f73f9a6757a6b3adf95f56fb34767` |
| XpLedgerEntry           | 13,271 | `3d0c417b8acfb405f33299ddf552dcadea17c7167ecb4ee5af3ae056fbeb385d` |
| CollectorAchievement    | 16,254 | `eaf901081af7ed05e881a1247e70ed3b52075d0c1b060461eb9cf0f4b02641c0` |
| SquigAchievement        | 97,768 | `9fbc964b69ec26aa31cd6fef5bd7b139f8e58938ef28e29845e567f5cd8be43c` |
| ProgressionMilestone    |    574 | `f726cb584222612a9b01ad4674c7108626ba19a3c69e047a45788e3c0b4541a9` |
| SquigDiscovery          |  2,940 | `8ee68482c02e181396db916a876b56a48f72e677b8257b829b7e3a716555a18f` |
| CollectorTraitDiscovery |  8,880 | `2f61febb93522f30627fac41e01675855b11985e7b7920cefbc79e648c64936c` |
| CollectorSetProgress    | 19,656 | `2978939920ebc4bbab3fdda4c06dcbef77fb7d6dc3b443b39b2ecf52b7bcddc3` |
| CollectionSnapshot      |    378 | `ac95a5cb55a00e5250830461b5bea00417dbaaf1e146d6fb0d52b13d40fc0af1` |
| CollectionMilestone     | 10,183 | `04a85358312be86d87bf613359a695a5623844dcef75ccc839ac3f184810feca` |

- Ruleset and catalog fingerprints matched the reviewed Phase 11 manifest. The verifier accepts the frozen proof only for its exact ID, full application SHA, frozen input, and compatible configuration; advanced live inputs require the new convergence proof.
- **DERIVED_REPLAY_STABLE: VERIFIED** by frozen A/B proof plus the current live proof above.

## DRIP read integration

- Current API base: `https://api.drip.re/api/v1`; authentication uses Bearer authorization.
- Current documentation checked: [authentication](https://docs.drip.re/api-reference/authentication), [realm member search](https://docs.drip.re/api-reference/realm-members/search-realm-member), [currencies](https://docs.drip.re/api-reference/currencies/get-currencies), and [rate limits](https://docs.drip.re/developer/rate-limits).
- Current documented limit: 24 requests/minute and 100,000/month per Realm. UglyDex defaults are 6 requests/minute, 30,000 monthly soft budget, 25 exact Discord IDs per request, and a 30-minute full sweep. The 25-member batch is an UglyDex safety default, not a claimed DRIP maximum.
- The adapter has only fixed GET operations for Realm, currencies, and exact `discord-id` member search. It has no generic method or write operation. **UglyDex DRIP write requests: 0.** Tests assert that the adapter uses GET only.
- Realm and currency validation succeeded using staging reads. The configured currency ID resolved to the existing active $CHARM Realm Point.
- The operator was asked to replace the key after enabling member/point-balance read permission. The configured key could not be independently fingerprinted as new, so this is recorded as the currently configured key, not a confirmed rotation. Its one exact `discord-id` member-search validation returned `credentials.access=false`, `credentials.approved` absent, and sanitized reason `INSUFFICIENT_PERMISSION`. Per the stop rule, member/balance sync was stopped. One additional documented exact-ID credentials GET returned 404 (`CREDENTIAL_SCOPE`); no username lookup or retry was made.
- Latest observed counters after that test: 48 total/month requests, 0 HTTP 429s, minimum remaining quota 59. No completed full sweep or stored balances. Current balance status is **unknown**, not zero. Retry-After handling and quota-header tracking are implemented; there was no 429 to exercise live.

## $CHARM alignment

Configuration comparisons used fingerprints; raw Realm, currency, and member IDs are intentionally omitted.

| Check                                       | Result                                                             |
| ------------------------------------------- | ------------------------------------------------------------------ |
| UglyBot Realm matches UglyDex               | Yes                                                                |
| UglyBot currency matches UglyDex            | Yes                                                                |
| The Gauntlet Realm matches UglyDex          | Yes                                                                |
| The Gauntlet point/currency matches UglyDex | Yes                                                                |
| Configured existing $CHARM point is active  | Yes                                                                |
| Exact member balance read works             | No — the latest exact-ID probe returned `credentials.access=false` |

The exact bot/staging fingerprints were compared during the earlier read-only alignment check. Neither bot production deployment changed afterward. The persisted staging alignment record is still bound to application revision `632e7f7`, so the current-revision `CHARM_DRIP` gate remains pending even though the previously compared configurations matched. Exact member access and a current balance read remain unproven; record `DRIP_MEMBER_CREDENTIAL_ACCESS_DENIED` and require DRIP account/Realm permission review.

UglyBot’s production revision was `1460da2185f338a373dcd556c2c37bd91b66c2b2`; The Gauntlet’s production revision was `59506e284cfb3296bd0ab8781e0b89cebcf6ad01`. Both were inspected read-only and neither was changed or deployed.

The Gauntlet helper retains compatibility payout paths without an explicit currency ID. This is **GAUNTLET_DRIP_CURRENCY_FALLBACK_RISK**. UglyDex requires the exact configured Realm and currency ID and does not copy that fallback.

## Gauntlet online rewards

The live Gauntlet app and its source bridge were checked read-only. Both run against the same database fingerprint (`154994f4c151df504008114feca2120c80dd94a6aa333e9d3b584146dff705f9`); the app revision is `59506e284cfb3296bd0ab8781e0b89cebcf6ad01` and the bridge revision is `2ab0fc39a4ba7d392086d5d66597457ca326a751`. The table exists and its schema matches the reviewed registry. The app DB role can query it and sees zero rows; the bridge role receives PostgreSQL `42501` permission denied on SELECT. The cause is bridge-role table permission, not wrong database routing or stale schema observation. App startup initializes the table with `CREATE TABLE IF NOT EXISTS`; no Gauntlet schema fix is indicated. No role grant or production Gauntlet change was made.

The source bridge still cannot expose `onlineRewards`, so UglyDex keeps it `UNAVAILABLE_SOURCE_TABLE / FEED_UNAVAILABLE`. Zero rows are known only from the app’s read-only connection and do not establish an accessible, exhausted historical feed. No pilot/import was performed.

## Identity and balances

- Staging had 378 Collectors; 375 had exact Discord identities at the inspected snapshot.
- UglyDex uses `ExternalIdentity(provider=DISCORD)` and exact `discord-id` lookup only. Username lookup count: **0**.
- DRIP members resolved: 0; unresolved: 375; conflicts: 0. The latest exact-ID probe was denied before resolution could complete. No Collector was created from DRIP data.
- Balances synced: 0. Fresh: 0; stale: 0; errors: member reads denied for credential scope. No zero balance was inferred.

## Tracked ecosystem activity

These are categorized from available normalized `CollectorActivity`; they are not a reconstruction of current DRIP balance or lifetime account history.

| Category    |                           Rows |             Amount |
| ----------- | -----------------------------: | -----------------: |
| EARN        |                             14 |        1,400 CHARM |
| SPEND       |                            416 |    5,494,231 CHARM |
| PAYOUT      |                             76 |    2,917,500 CHARM |
| REFUND      |                              2 |           20 CHARM |
| WAGER       |                            229 |      183,557 CHARM |
| OBSERVATION |                          1,855 | Not money movement |
| METADATA    | 0 normalized reward-point rows | Not money movement |

The UI label is “Tracked available ecosystem history.” The current DRIP balance is **not** computed from these totals. Claim events remain observations, and creator/image reward points remain metadata.

## Claimable and refresh

- Claimable: **not implemented**. UglyBot’s authoritative passive reward accrual is per NFT and transfer-aware. No read-only authoritative endpoint or proven calculation parity was available, so no approximate claimable number is shown.
- UglyDex scheduled full refresh and authenticated on-demand refresh are implemented in the ecosystem worker path, with durable scheduling and targeted refresh coalescing. A successful member read is still blocked by the current DRIP credential permission response.
- UglyBot dirty hook: not implemented, not tested, not committed, not deployed.
- Gauntlet dirty hook: not implemented, not tested, not committed, not deployed.
- **PUSH_REFRESH_NOT_ACTIVE**. Periodic and on-demand refresh code is present; successful balance refresh awaits DRIP member read access.

## Privacy and secret safety

- Current balance preference defaults to private. Public Collector output, public profile/OG/share surfaces omit it unless the owner explicitly opts in. Automated privacy assertions found no public balance or DRIP ID leaks; the API key is server-only and absent from client bundles.
- `/charm` requires authenticated owner access. No real Discord OAuth, wallet transition, or physical-device validation was performed in this phase.
- UglyDex secret/history scan at the preceding checkpoint: 402 files and 659 historical blobs; no findings. DRIP-specific history scans found no DRIP credential assignments in UglyBot’s tracked `.env` history or The Gauntlet’s scanned history. No `DRIP_SECRET_ROTATION_REQUIRED` finding. A repeat of the general scanner in this follow-up could not start because the local Node runtime returned `uv_os_get_passwd` / `ENOMEM`; no credential contents were printed.
- No API key or private DRIP identifiers are included in this report.

## Workers

Exactly four mandatory staging workers are configured: blockchain, ecosystem, progression, and collections. All four were deployed to the current application revision and directly observed in LIVE mode with fresh heartbeats, successful post-deploy cycles, zero failed cycles, and zero queues. The live convergence proof independently recorded all four healthy at its captured boundary. No fifth worker was added. Chain processing continued forward from the existing cursor and ledger. Current `ownerOf` verification matched all 4,444 mints at block `26,113,076`, with no anomalies.

## Validation

- Automated unit suite: 696 tests across 26 files passed; lint and typecheck passed.
- Full `npm run release:check` completed successfully in an isolated NTFS temp clone after the repository’s source-drive build hit Windows junction handling. It reached the end of the release script: unit tests (696), ESLint, Prettier, Prisma generation, type checks, catalog verification, Next.js production build, and DB/browser/catalog checks (895 assertions) passed. A C: temp clone was used; the workspace check on E: alone could not build due filesystem junction handling.
- Staging HTTP smoke passed all 10 probes, including readiness, representative pages/API paths, expected 404s, and a valid PNG share response.
- Staging migrations were applied and migration verification passed before this report.
- Repository-wide Prettier check now passes; platform line-ending behavior is normalized with `endOfLine: auto`. The formatting changes are committed separately from implementation. The full release check passed in the isolated NTFS clone noted above.
- Current-revision convergence, launch verification, bounded RPC, owner verification, source verification, and final launch report were run over Railway SSH. Source bridges were reachable, authenticated, and verified read-only; source coverage remains tracked history rather than lifetime completeness. The current Gauntlet bridge still reports `gauntlet_online_reward_events` unavailable.
- Current staging deployment and all 10 HTTPS smoke probes passed again. `WEB_DEPLOYMENT` was attested against the current deployment and smoke artifact.

## Gates and decision

| Gate                  | Phase 12A result                                                                   |
| --------------------- | ---------------------------------------------------------------------------------- |
| CHARM_DRIP            | PENDING — member credential read access denied; no live balances                   |
| DERIVED_REPLAY_STABLE | VERIFIED — frozen A/B plus current live proof above                                |
| WORKERS               | VERIFIED — all four LIVE and healthy in launch and convergence checks              |
| WEB_DEPLOYMENT        | VERIFIED — current staging deployment and 10/10 HTTPS smoke                        |
| RESTORE_DRILL         | PENDING for this revision — Phase 11 populated restore passed and was not repeated |
| HANDOFF               | PENDING for this revision — Phase 11 handoff passed and was not repeated           |
| PRIVACY_AUTH          | PENDING; intentionally not closed                                                  |
| REAL_DEVICE_SHARE     | PENDING; intentionally not closed                                                  |

The final current-revision launch report had 9 critical gates verified, 12 pending, and 0 failed. `ARCHIVE_RPC`, `MINT_COVERAGE`, `OWNERSHIP_CONTINUITY`, and `OWNER_OF` are verified. `START_BLOCK` is PARTIAL because the bounded RPC check has not established the first mint boundary. Current staging launch decision: **NOT READY**. Critical pending gates are `BACKUP`, `RESTORE_DRILL`, `START_BLOCK`, `REATTRIBUTION`, `ACTIVITY`, `DUPLICATE_REVIEW`, `PROGRESSION`, `COLLECTIONS`, `CHARM_DRIP`, `HANDOFF`, `PRIVACY_AUTH`, and `REAL_DEVICE_SHARE`. `PRIVACY_AUTH` and `REAL_DEVICE_SHARE` remain reserved for the later manual stage. Production remains at `c764e28` and was not mutated.

**NOT_READY_FOR_CHARM_HOOK_DEPLOYMENT_AND_FINAL_PRIVACY_DEVICE_VALIDATION**

## Follow-up evidence after the formatting and START_BLOCK commits

- Branch was fetched at `6f91dc9faad3cafde0def21fcc34847b81d24496`, equal to `origin/phase11-launch-evidence`. Commits after `47615bf` are `450310d` (verified mint-ledger START_BLOCK fallback), `9207e7a` (formatting), and `6f91dc9` (platform-safe Prettier line endings). The follow-up report commit is `0175d48`; no history was reset.
- Actual staging runtime remains `f3386acef5f8ea9aa4f9b911869eb89962fce6a7` (deployment `257f846b-208c-4241-a98b-08e78fc078fe`). Production runtime remains `c764e2810715be0608e5fadc47d45a6a391ba674`. Production received no mutation. The START_BLOCK fix is committed but not deployed, so staging still runs the prior bounded-only verifier.
- START_BLOCK supporting ledger evidence from the current staging database: 4,444 unique token mints covering IDs 1–4,444; earliest canonical mint is block `25,349,689`; deployment/start block is `25,342,921`; no invalid provenance was observed. `450310d` adds a bounded-RPC fallback using only complete verified stored mint/provenance evidence and includes regressions. Targeted tests passed 18/18 and the full suite passed 696/696. Since the staging app is intentionally still `f338`, its runtime gate remains `PARTIAL` until the new application revision is deployed and revalidated.
- An initial current-boundary evaluation ran while legitimate live progression jobs were still draining and marked `DERIVED_REPLAY_STABLE` failed. We let the existing LIVE worker process the backlog; the five convergence prerequisites then all reached zero without disabling workers or changing cursors. The successful current-revision `LiveDerivationProof` is `fce4f6d4-26ad-4626-a0cc-65c80346dd31`, application revision `f3386acef5f8ea9aa4f9b911869eb89962fce6a7`, captured `2026-10-03T19:34:40.755Z`, input fingerprint `a689c8bef08ff06116edb9aa76d6bcb80cb56b8795f5dddd05e65a514cb2ce32`. It records attribution 0, progression 0, collections 0, failed jobs 0, and dirty provenance 0. Read-only recomputation passed with zero discrepancies for 4,444 provenance ledgers/attribution projections, 4,822 progression subjects, and collection/set evidence; the ingestion boundary passed. The earlier proof `8af4c0f8-69ed-4dcf-b4df-8c6678614047` remains preserved.
- A fresh staging launch report after that proof returned `NOT_READY`, 9 critical gates passed, 12 pending, 0 failed. `DERIVED_REPLAY_STABLE` is `VERIFIED`; `START_BLOCK` remains `PARTIAL`; `CHARM_DRIP` remains `PENDING`. The frozen ReplayProof was not modified. No replay was repeated, and no cursor or ledger was repaired manually. The four required workers remain in LIVE intent and the WORKERS gate is VERIFIED.
- Historical HANDOFF and semantic reviews were not re-attested on `f338` during this follow-up. They remain revision-bound and pending. No new backup, populated restore, or current-revision handoff proof was created; `BACKUP`, `RESTORE_DRILL`, and `HANDOFF` remain pending.
- The locally re-run `security:secrets` command could not initialize `tsx` because Node’s OS user lookup returned `ENOMEM`. The earlier recorded cross-repository DRIP-specific history scans remain clean; no secret was printed and no key was rotated.
- No DRIP balance sync was run after member access denial. The required next action is operator/DRIP support review of member/point-balance read permission; do not retry until permission is changed and a new key is supplied through Railway variables.

The current blocking gate set is `BACKUP`, `RESTORE_DRILL`, `START_BLOCK` (PARTIAL), `REATTRIBUTION`, `ACTIVITY`, `DUPLICATE_REVIEW`, `PROGRESSION`, `COLLECTIONS`, `CHARM_DRIP`, `HANDOFF`, `PRIVACY_AUTH`, and `REAL_DEVICE_SHARE`. `DERIVED_REPLAY_STABLE` is now VERIFIED. The current staging decision remains **NOT READY**. Production remains unchanged.

## Current checkpoint reconciliation — 2026-10-04

This section supersedes earlier follow-up statements above where current source, deployment, gate, or feed state has since changed.

### Branch and deployment

- Fetched `origin/phase11-launch-evidence`; remote branch remains `36da807d00c59251d252e3050b527edce115d2fa`. Local branch head before this report update is `2da147ab5faa84ab1957ac5886616639105663de`, one test-only commit ahead (`2da147a`, Gauntlet online reward semantic fixtures). No history was reset.
- Current application-bearing source revision is `6f91dc9faad3cafde0def21fcc34847b81d24496`. Staging web deployment `0158f6c6-e154-415e-9fc5-b5f43f0de106` succeeded. A fresh staging HTTPS smoke passed 10/10 and current-revision `WEB_DEPLOYMENT` evidence was recorded.
- The staging blockchain worker was rebuilt from the verified `6f91dc9` worktree as deployment `6cea1b9d-5a46-45f6-a08c-10d6d90c0c6a`. Ecosystem `2a12b11b-c643-46b3-b85c-263717ec443f`, progression `0055c898-5b86-44c6-8191-3b4a1bc0b712`, and collections `6b428690-0967-47db-b410-60705a1673c6` remained deployed. All four services report `APP_COMMIT=6f91dc9faad3cafde0def21fcc34847b81d24496`; Railway's inherited `RAILWAY_GIT_COMMIT_SHA` in those services still reads `0c8e5f8fc0d5db8c587c749479922accde723ae3` and is not the application commit used by UglyDex launch context.
- Production remains `c764e2810715be0608e5fadc47d45a6a391ba674`. No production app, worker, variable, source import, or bot deployment was changed.

### Current live convergence and workers

- Latest current-revision `LiveDerivationProof`: `720cc105-66f9-4e91-ae67-540be45a298e`, captured `2026-10-04T00:28:28.070Z`, commit `6f91dc9faad3cafde0def21fcc34847b81d24496`, input fingerprint `1e6489ac9ddc2eb867f33c1d5bf862a23d9083f3041bb6f2468c8f29903169f5`.
- Attribution, progression, collection, failed-job, and dirty-provenance queues were all zero. Read-only recomputation passed for 4,444 provenance ledgers, 4,822 progression subjects, and collection/set state; all 11 derived fingerprints matched. **DERIVED_REPLAY_STABLE: VERIFIED.** Frozen Replay A/B semantics and evidence remain unchanged.
- All four WorkerControl modes are `LIVE`. Latest heartbeats were fresh and successful for blockchain, ecosystem, progression, and collections; queues and dirty provenance remain zero. No chain reset, source reimport, or fifth worker was used.

### DRIP permission and Gauntlet source

- The currently configured operator-supplied Realm Client key was tested once with GET only: Realm, currencies, and one exact Discord-ID member lookup (3 requests). The Realm and configured active `$CHARM` point remained valid. The member response returned `credentials.access=false`, `credentials.approved` absent, with a sanitized reason category `OTHER`. **DRIP_MEMBER_CREDENTIAL_ACCESS_DENIED**. No retry, username lookup, realm scrape, member/balance sync, or write was made. No balances are stored; balance remains unknown, not zero. This validation observed 0 HTTP 429s and minimum remaining quota 22.
- Earlier read-only alignment evidence still shows the existing point and Realm match UglyBot and The Gauntlet. UglyDex remains structurally GET-only with 0 DRIP writes. `CHARM_DRIP: PENDING` because exact member resolution and current balance reads are denied.
- The source bridge and Gauntlet main application use the same physical database. The dedicated existing reader role was verified non-superuser and without unsafe membership, CREATE, or write privileges. The authorized narrow grant was applied: `SELECT` on exactly `public.gauntlet_online_reward_events` to `uglydex_reader`. Post-grant SELECT is allowed; INSERT, UPDATE, DELETE, TRUNCATE, table/schema CREATE and sequence grants remain absent.
- The table is reachable through the deployed read-only bridge, schema-compatible, and currently contains 0 rows. It is **AVAILABLE / SOURCE_EXHAUSTED_CURRENTLY / TRACKED_AVAILABLE_HISTORY_NOT_LIFETIME**. No records were invented and no historical activity was imported. With no live sample to pilot, fixture tests cover successful, pending, failed, privacy, and canonical-key behavior; the focused activity suite passed 82 tests. Commit `2da147a` contains only these tests.
- Current source validation reports 17 schema-valid source rows, including onlineRewards. A one-page empty onlineRewards observation scanned 0 rows and made no activity writes.

### START_BLOCK and bounded handoff

- The archive deployment boundary and configured start are both block `25,342,921`; bytecode was absent immediately before and present at deployment. The complete stored canonical ledger derives earliest mint `25,349,689` and covers 4,444 unique token IDs, 1–4,444. Current owner verification matched 4,444/4,444 at block `26,114,192`, with zero provenance anomalies. **START_BLOCK: VERIFIED** using the bounded RPC boundary plus complete verified stored mint ledger.
- Current-revision probes exist for the 16 reviewed historical feeds. Aggregate outcome: 0 inserts, 13 source corrections on `madlibPublications`, 0 failures, and 0 unresolved rejections. Seven latest per-feed records show reconciliation sweep complete. Nine do not: `duels`, `bountyEntries`, `bountyResults`, `claimEvents`, `runs`, `survival`, `imageUses`, `submissions`, and `liveImages`. The ecosystem worker was restored to LIVE after the bounded pass. **HANDOFF: PARTIAL** until those cursor proofs are safely completed and re-recorded. No unrestricted full import was run.
- `onlineRewards` has a separate empty-source availability check; it is not fabricated into a historical handoff activity proof.

### Semantic gates, backup, and restore

- The reviewed identity attribution, activity normalization, duplicate canonicalization, progression, and collection code was compared with the last reviewed implementation and no semantic change was found. Current attribution queue is zero. The one signed-versus-legacy identity conflict remains unresolved; 47 Bounty entry activities remain intentionally unattributed because Collector ownership is unknown.
- Historical gate rows for `ACTIVITY`, `DUPLICATE_REVIEW`, `PROGRESSION`, `COLLECTIONS`, and `REATTRIBUTION` remain bound to the earlier `cd15cd36` evidence context. The current launch report treats them as pending for `6f91dc9`; live convergence supports current progression/collection correctness but does not rewrite frozen or revision-bound evidence.
- No new current-revision backup archive or populated restore was created in this continuation. Historical backup/restore rows remain bound to the older revision, so current `BACKUP` and `RESTORE_DRILL` are **PENDING**. The available backup helper requires `pg_dump`/`pg_restore`; neither binary is installed on the local Windows host, and the managed database service does not expose an SSH instance. No disposable database was created.

### Tracked $CHARM history and privacy

Current eligible tracked activity aggregates are EARN 14 / 1,400; SPEND 417 / 5,494,731; PAYOUT 76 / 2,917,500; REFUND 2 / 20; WAGER 229 / 183,557; OBSERVATION 1,858; METADATA 0. Current DRIP balance is **not** reconstructed from these incomplete tracked totals. Claimable remains **not implemented** because UglyBot's transfer-aware per-NFT calculation has no proven read-only parity path. Balance remains private by default and the existing automated public-surface privacy assertions pass; no member ID or API key is exposed.

### Validation and current gate decision

- The current application source had already passed the full `npm run release:check` on the isolated NTFS environment: 700 unit tests and 895 DB/HTTP/browser/catalog assertions, plus lint, Prettier, typecheck, catalog verification, and production build. This continuation added no application source changes; it added four focused Gauntlet online reward fixtures, and the focused suite passed 82 tests.
- Current deployed staging smoke: 10/10. Current `launch:check` completed its convergence evaluation and correctly returned `NOT_READY`.
- Current critical gate result: `DATABASE`, `MIGRATIONS`, `WEB_DEPLOYMENT`, `WORKERS`, `ARCHIVE_RPC`, `START_BLOCK`, `MINT_COVERAGE`, `OWNERSHIP_CONTINUITY`, `OWNER_OF`, and `DERIVED_REPLAY_STABLE` are VERIFIED. `BACKUP`, `RESTORE_DRILL`, `REATTRIBUTION`, `ACTIVITY`, `DUPLICATE_REVIEW`, `PROGRESSION`, `COLLECTIONS`, `CHARM_DRIP`, `PRIVACY_AUTH`, and `REAL_DEVICE_SHARE` are PENDING for the current revision; `HANDOFF` is PARTIAL. The final two manual gates remain intentionally open.
- Therefore the only intended final decision is **NOT_READY_FOR_CHARM_HOOK_DEPLOYMENT_AND_FINAL_PRIVACY_DEVICE_VALIDATION**. Exact blockers are current-revision backup and restore evidence, completion/attestation of all handoff cursor proofs, revision-current semantic gate evidence, DRIP member credential permission/current balance validation, and the separately authorized privacy/device stage. Production remains unchanged.

## DRIP mapping follow-up — 2026-10-04

- The profile report was traced to the durable sweep stopping on the first exact Discord-ID batch that received HTTP 403. The Collector’s active authenticated wallet and Discord identity already have a verified exact-pair `wallet_links` mapping. The sync path uses that returned `drip_member_id` with `type=drip-id`; it never tries username, nickname, or fuzzy matching.
- Commit `2668e0a846f892fe7284c8eba373d663eb9fae37` changes a denied exact lookup into an unresolved result and advances the bounded sweep cursor. The balance remains UNKNOWN and no guessed zero is stored. Added coverage exercises exact mapped `drip-id` balance extraction and denied Discord lookup behavior. Unit tests passed 701/701, typecheck, lint, and targeted formatting checks passed. `npm run test:db` stopped in the pre-existing Phase 7 preflight assertion (`preflight CLI verifies live schema drift`) before reaching the new Phase 12 database tests; that database scenario is not claimed as passed.
- The commit is pushed to `phase11-launch-evidence` and deployed to the staging web service and all four staging workers. Railway deployments succeeded: web `38b50c57-f028-49af-9f53-017e61c1b168`; blockchain `1dd69d00-c345-40af-8239-07ceb7c47f7a`; ecosystem `265e4a5c-b271-49a8-9042-38e87dd1ee99`; progression `f3a90b14-9812-4168-a620-dc9cb8b0fcbc`; collections `c8c84435-0482-43e3-8de5-cf9f51e6dbca`. All four workers returned to LIVE with fresh heartbeats and no circuit breaker.
- A single bounded `survival` forward page cleared a prior source-validation error: 200 rows scanned, 200 duplicate skips, zero inserts, zero failures. The ecosystem worker returned to LIVE/IDLE and the source-error count is zero. No history replay or cursor reset was performed.
- After deployment, one current-revision alignment attempt successfully read the Realm but received HTTP 403 on the currencies GET. The alignment remains bound to the prior revision `4dec11d53828afaa7b68d38d74a55c9837256e7c`; no alignment evidence was copied or fabricated. Current `DripIdentity` resolved count and current `CharmBalance` count remain zero. The API sync error is `DRIP_HTTP_403`; balances remain UNKNOWN. Do not retry DRIP reads until the current staging key’s Realm/currency read permission is corrected and confirmed.
- `CHARM_DRIP` remains **PENDING**. Production remains `c764e2810715be0608e5fadc47d45a6a391ba674` and was not changed. Overall staging remains **NOT READY**; the previous critical blockers remain, with DRIP permission/current-balance validation explicitly unresolved.
- Deployment follow-up: the first uploaded web build had the old runtime `APP_COMMIT` because the variable was updated after that build started. The active `UglyDex-Staging` web container was therefore redeployed as `da5239f5-d1fa-4d2b-a803-d4d4425be1d7`. Its runtime now reports `APP_COMMIT=2668e0a`; all four running staging workers independently report the same revision. The web deployment is `SUCCESS` and startup configuration validation passed.

## DRIP-ID linking form staging follow-up — 2026-10-04

- Branch advanced without reset from `0fa78ef` through `5485036` (link-flow tests and empty-search handling) and `1b02bf5` (safe migration diagnostic names). Both commits are pushed to `phase11-launch-evidence`. The untracked visual-reference ZIP was left untouched.

### Tests

- `npm test`: 728 tests across 28 files passed. Focused API/link/readiness coverage: 30 tests passed. Focused Phase 12 database coverage: 52 assertions passed, including exact `drip-id` lookup, persistence, decimal balance, and zero DRIP writes.
- `npm run lint`, `npm run typecheck`, and `npm run format:check` passed.
- `npm run release:check` did not complete: it stopped at the existing Phase 7 preflight assertion `preflight CLI verifies live schema drift` (`migration.drift: Schema drift detected; inspect manually; nothing was repaired`). Do not count it as a passed release check.

### Railway failure and recovery

- The first failed deployment for `0fa78ef` was `31b19619-388e-433d-ad08-3dd865f5f369`. Build/image push, migration pre-deploy, and Next.js startup succeeded. Railway then received HTTP 503 from `/api/ready` and failed readiness at the configured 120-second health check because `migration.checksums` did not match.
- The exact cause was mixed line endings in the already-applied migration files: the staging migration ledger checksums matched CRLF for the first 12 migrations and LF for the latest migration. Uniformly normalized deployment snapshots therefore failed startup checksum validation. A temporary source snapshot preserving the deployed hybrid line endings resolved this without changing database contents, weakening readiness, or changing the migration policy. Safe migration names are now available in server logs; public readiness responses remain redacted.
- The later corrected deployment is active: `1bfb62f6-4c84-4bc1-8f8f-4d88e340cfc1`. Runtime `APP_COMMIT` is `1b02bf5a114cecec25b72ed4349473e5b52cb265`. `/api/ready` returned HTTP 200 with `{"status":"ready"}`. Public staging smoke passed 10/10.

### Feature and security status

- The `/charm` page and `POST /api/charm/link` are deployed. The deployed route returned the expected 403 for a deliberately invalid Origin. The real authenticated form flow has **not** yet been exercised: no browser session was available to enter the operator’s private DRIP ID. No live DRIP request was made for this form test, and no `DripIdentity` or `CharmBalance` was written by it.
- Automated coverage verifies authentication, Origin checks, malformed IDs, throttling, identity ownership proofs and conflicts, exact member response matching, balance extraction/precision, UNKNOWN handling, safe API output, persistence, and zero DRIP writes. Production-facing privacy behavior remains private by default. No raw DRIP ID, Discord ID, wallet, balance, or API key was included in this report.
- Production remains at `c764e2810715be0608e5fadc47d45a6a391ba674` and was not modified.

**Required operator action:** open `https://uglydex-staging-staging.up.railway.app/charm`, authenticate, and enter the DRIP ID through the form. Share only the outcome category (success with balance, success without configured $CHARM balance, HTTP 403, or identity mismatch), not the ID. Until that test runs, the real-link result is pending; this report does not claim a successful account link or current balance.
