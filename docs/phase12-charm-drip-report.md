# Phase 12A — LIVE convergence and read-only $CHARM

Date: 2026-10-03. Branch: `phase11-launch-evidence`.

## Current checkpoint

- Starting evidence head: `047aef3387f15f6eb5af2477fb57da30738693cf`.
- Current application/evidence head: `f3386acef5f8ea9aa4f9b911869eb89962fce6a7`.
- Current staging web deployment: `2a27f487-f138-47e7-ade2-dc18effbeeaa`, SUCCESS.
- Production application revision: `c764e2810715be0608e5fadc47d45a6a391ba674`; production was not changed.
- The prior staging app was `0c8e5f8fc0d5db8c587c749479922accde723ae3`, rather than the expected frozen replay revision `cd15cd3`. Work continued from the checked-out safe branch head and preserved its history.
- The Phase 11 populated restore evidence was not repeated. Phase 11 chain, source, identity, activity, progression, and collection values were inspected and preserved. The live chain advanced normally; no cursor reset, ledger truncation, reimport, or rebuild was run.

## Live convergence

- Frozen Replay A/B proof: `b6a1d45d-d9fc-454a-9771-37da3cb450c1`, application commit `cd15cd36c835be38b316ea7bd6fc9c45bab0f77f`, input fingerprint `83b5ec1c293e1452ee560ddd3afd35da72a6c2d61494b3273184d7419f7162f1`. The recorded A/B result matched all 11 derived tables with zero semantic differences.
- Live input had legitimately advanced from the frozen fingerprint during source indexing/reconciliation. The implementation adds a separate `LiveDerivationProof` and compares deterministic read-only recomputation to the current persisted projections; frozen ReplayProof semantics are unchanged.
- The new proof has **not** been recorded for current application revision `f3386ac`. The revision-bound launch command could not reach staging’s private database from the local Railway environment. Railway SSH also reports that the temporary key still needs account linking. Therefore there is no current-revision live input fingerprint or derived comparison to report.
- Last directly inspected staging state after worker recovery: attribution, progression, and collection queues were zero; failed queues were zero; dirty provenance was zero. All four worker controls were LIVE, with fresh IDLE heartbeats and successful work. These observations do not substitute for the current-revision convergence proof.
- Ruleset and catalog fingerprints matched the reviewed Phase 11 manifest. The verifier accepts the frozen proof only for its exact ID, full application SHA, frozen input, and compatible configuration; advanced live inputs require the new convergence proof.
- **DERIVED_REPLAY_STABLE: PENDING** until current-revision convergence is recorded.

## DRIP read integration

- Current API base: `https://api.drip.re/api/v1`; authentication uses Bearer authorization.
- Current documentation checked: [authentication](https://docs.drip.re/api-reference/authentication), [realm member search](https://docs.drip.re/api-reference/realm-members/search-realm-member), [currencies](https://docs.drip.re/api-reference/currencies/get-currencies), and [rate limits](https://docs.drip.re/developer/rate-limits).
- Current documented limit: 24 requests/minute and 100,000/month per Realm. UglyDex defaults are 6 requests/minute, 30,000 monthly soft budget, 25 exact Discord IDs per request, and a 30-minute full sweep. The 25-member batch is an UglyDex safety default, not a claimed DRIP maximum.
- The adapter has only fixed GET operations for Realm, currencies, and exact `discord-id` member search. It has no generic method or write operation. **UglyDex DRIP write requests: 0.** Tests assert that the adapter uses GET only.
- Realm and currency validation succeeded using staging reads. The configured currency ID resolved to the existing active $CHARM Realm Point.
- The API accepted the existing key but returned `credentials.access=false` / insufficient permission for member credentials. The user authorized granting read access and retaining the same key, but the live API response still denied balance reads at the latest check. No repeated balance probes were made after that denial.
- Last recorded API observations: 23 requests, 0 HTTP 429s, lowest remaining quota observed 22. No completed full sweep, balance observations, or stored balances. Current balance status is **unknown**, not zero. Retry-After handling and quota-header tracking are implemented; there was no 429 to exercise live.

## $CHARM alignment

Configuration comparisons used fingerprints; raw Realm, currency, and member IDs are intentionally omitted.

| Check | Result |
|---|---|
| UglyBot Realm matches UglyDex | Yes |
| UglyBot currency matches UglyDex | Yes |
| The Gauntlet Realm matches UglyDex | Yes |
| The Gauntlet point/currency matches UglyDex | Yes |
| Configured existing $CHARM point is active | Yes |
| Exact member balance read works | No — DRIP denies credential read access |

UglyBot’s production revision was `1460da2185f338a373dcd556c2c37bd91b66c2b2`; The Gauntlet’s production revision was `59506e284cfb3296bd0ab8781e0b89cebcf6ad01`. Both were inspected read-only and neither was changed or deployed.

The Gauntlet helper retains compatibility payout paths without an explicit currency ID. This is **GAUNTLET_DRIP_CURRENCY_FALLBACK_RISK**. UglyDex requires the exact configured Realm and currency ID and does not copy that fallback.

## Gauntlet online rewards

The current Gauntlet source defines `gauntlet_online_reward_events`; its startup initialization calls `CREATE TABLE IF NOT EXISTS`. A read-only query against the current Gauntlet main database found the table with zero rows. The prior UglyDex source inspection used a connection that failed TLS verification, so its absent-table result does not establish that the live Gauntlet main database lacked the table. The Gauntlet live deployment revision was `59506e284cfb3296bd0ab8781e0b89cebcf6ad01`.

No upstream schema defect was confirmed, and no Gauntlet fix was prepared. UglyDex did not create or alter this table. Historical `onlineRewards` remains `UNAVAILABLE_SOURCE_TABLE / FEED_UNAVAILABLE`; there is no claim of an empty or complete feed.

## Identity and balances

- Staging had 378 Collectors; 375 had exact Discord identities at the inspected snapshot.
- UglyDex uses `ExternalIdentity(provider=DISCORD)` and exact `discord-id` lookup only. Username lookup count: **0**.
- DRIP members resolved: 0; unresolved: 375; conflicts: 0. Member reads were denied before resolution could complete. No Collector was created from DRIP data.
- Balances synced: 0. Fresh: 0; stale: 0; errors: all attempted member reads denied for credential scope. No zero balance was inferred.

## Tracked ecosystem activity

These are categorized from available normalized `CollectorActivity`; they are not a reconstruction of current DRIP balance or lifetime account history.

| Category | Rows | Amount |
|---|---:|---:|
| EARN | 14 | 1,400 CHARM |
| SPEND | 415 | 5,464,231 CHARM |
| PAYOUT | 76 | 2,917,500 CHARM |
| REFUND | 2 | 20 CHARM |
| WAGER | 229 | 183,557 CHARM |
| OBSERVATION | 1,848 | Not money movement |
| METADATA | 0 normalized reward-point rows | Not money movement |

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
- UglyDex secret/history scan: 402 files and 659 historical blobs; no findings. DRIP-specific history scans found no DRIP credential assignments in UglyBot’s tracked `.env` history or The Gauntlet’s scanned history. No `DRIP_SECRET_ROTATION_REQUIRED` finding.
- No API key or private DRIP identifiers are included in this report.

## Workers

Exactly four mandatory staging workers are configured: blockchain, ecosystem, progression, and collections. All four were deployed to the current application revision and directly observed in LIVE mode with fresh heartbeats, successful post-deploy cycles, zero failed cycles, and zero queues. No fifth worker was added. Chain processing continued forward from the existing cursor and ledger.

## Validation

- Automated unit suite: 686 tests across 25 files passed; lint and typecheck passed.
- Railway Linux build completed successfully, including TypeScript and static route generation.
- Staging HTTP smoke passed all 10 probes, including readiness, representative pages/API paths, expected 404s, and a valid PNG share response.
- Staging migrations were applied and migration verification passed before this report.
- `release:check` did not complete: the repository-wide Prettier check reports 312 existing files needing formatting. Local Windows Next build also fails on filesystem junction handling (`EISDIR`); the Railway Linux build succeeds.
- The local `railway run` launch check could not connect to the private staging database and reported launch evidence storage unavailable. A direct Railway SSH attempt returned `signup_required` for the temporary SSH key. Therefore final current-revision launch, convergence, source, provenance, and DRIP gate revalidation remain outstanding.

## Gates and decision

| Gate | Phase 12A result |
|---|---|
| CHARM_DRIP | PENDING — member credential read access denied; no live balances |
| DERIVED_REPLAY_STABLE | PENDING — current-revision live convergence proof not recorded |
| WORKERS | Previously verified on current deployment; fresh operational snapshot showed all four LIVE and healthy |
| RESTORE_DRILL | Phase 11 populated restore passed; not repeated. Current revision evidence was not re-attested. |
| HANDOFF | Phase 11 handoff passed; current revision evidence was not re-attested. |
| PRIVACY_AUTH | PENDING; intentionally not closed |
| REAL_DEVICE_SHARE | PENDING; intentionally not closed |

Current staging launch decision: **NOT READY**. Exact Phase 12A blockers are DRIP member-read permission plus the resulting lack of live balance evidence, missing current-revision live convergence proof, and revision-bound gates not revalidated. `PRIVACY_AUTH` and `REAL_DEVICE_SHARE` remain separately required later-stage manual gates. Production remains at `c764e28` and was not mutated.

**NOT_READY_FOR_CHARM_HOOK_DEPLOYMENT_AND_FINAL_PRIVACY_DEVICE_VALIDATION**
