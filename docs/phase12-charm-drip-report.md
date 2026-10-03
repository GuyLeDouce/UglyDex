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

- Branch was fetched and is clean at `6f91dc9faad3cafde0def21fcc34847b81d24496`, equal to `origin/phase11-launch-evidence`. Commits after `47615bf` are `450310d` (verified mint-ledger START_BLOCK fallback), `9207e7a` (formatting), and `6f91dc9` (platform-safe Prettier line endings). No history was reset.
- Actual staging runtime remains `f3386acef5f8ea9aa4f9b911869eb89962fce6a7` (deployment `257f846b-208c-4241-a98b-08e78fc078fe`). Production runtime remains `c764e2810715be0608e5fadc47d45a6a391ba674`. Production received no mutation. The START_BLOCK fix is committed but not deployed, so staging still runs the prior bounded-only verifier.
- START_BLOCK supporting ledger evidence from the current staging database: 4,444 unique token mints covering IDs 1–4,444; earliest canonical mint is block `25,349,689`; deployment/start block is `25,342,921`; no invalid provenance was observed. `450310d` adds a bounded-RPC fallback using only complete verified stored mint/provenance evidence and includes regressions. Targeted tests passed 18/18 and the full suite passed 696/696. Since the staging app is intentionally still `f338`, its runtime gate remains `PARTIAL` until the new application revision is deployed and revalidated.
- The latest staging `launch:report` returned `BLOCKED`, 8 critical gates passed, 13 pending and 1 failed. `START_BLOCK` is `PARTIAL`; `CHARM_DRIP` is `PENDING`; `DERIVED_REPLAY_STABLE` is currently `FAILED` with “Current replay boundary requires review.” The frozen ReplayProof and retained LiveDerivationProof `8af4c0f8-69ed-4dcf-b4df-8c6678614047` were not modified. The failed current evaluation followed legitimate live advancement/backlog; it is not a failure of frozen Replay A/B. A fresh convergence proof is required once queues and all other boundary conditions are clear.
- At the most recent queue observation before this follow-up, attribution, collection, dirty provenance, and failed jobs were zero; progression jobs were still draining under normal LIVE worker operation. No worker was disabled, no replay was repeated, and no cursor or ledger was repaired manually. All four worker intents remain LIVE.
- Historical HANDOFF and semantic reviews were not re-attested on `f338` during this follow-up. They remain revision-bound and pending. No new backup, populated restore, or current-revision handoff proof was created; `BACKUP`, `RESTORE_DRILL`, and `HANDOFF` remain pending.
- The locally re-run `security:secrets` command could not initialize `tsx` because Node’s OS user lookup returned `ENOMEM`. The earlier recorded cross-repository DRIP-specific history scans remain clean; no secret was printed and no key was rotated.
- No DRIP balance sync was run after member access denial. The required next action is operator/DRIP support review of member/point-balance read permission; do not retry until permission is changed and a new key is supplied through Railway variables.

The current blocking gate set therefore still includes `BACKUP`, `RESTORE_DRILL`, `START_BLOCK`, `REATTRIBUTION`, `ACTIVITY`, `DUPLICATE_REVIEW`, `PROGRESSION`, `COLLECTIONS`, `DERIVED_REPLAY_STABLE`, `CHARM_DRIP`, `HANDOFF`, `PRIVACY_AUTH`, and `REAL_DEVICE_SHARE`. The current staging decision remains **NOT READY**. Production remains unchanged.
