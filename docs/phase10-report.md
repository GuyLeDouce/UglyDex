# Phase 10 — actual Railway execution

Execution: **2026-09-26 to 2026-09-27 UTC**. Tested/deployed application commit: **`c764e2810715be0608e5fadc47d45a6a391ba674`**. Phase 9 `811314b` and Phase 8 `4fe652f` are ancestors. Documentation is committed separately after these measurements; its commit does not replace the deployed application evidence context.

**Staging: NOT_READY. Production: BLOCKED. No gate-approved production launch occurred.** The owner pushed the application to the existing production service during execution, then authorized repair of its startup. That repair is deployed and passes public smoke tests. Workers remain disabled. No engagement features, ruleset changes or upstream database writes were introduced.

## Starting state

The initial `git status` was **not clean**: nine documentation files had earlier Phase 10 notes and `docs/phase10-report.md` was untracked. These were preserved. HEAD was `811314b`; its ancestry was verified. The unconfigured local `launch:status` reported 0 VERIFIED, 31 PENDING, 20 blocking, 11 optional/warning and 0 FAILED. Existing remote evidence was not blindly reset.

The initial release check passed 505 unit tests and 814 DB/HTTP/browser/catalog assertions. A remaining disposable test PostgreSQL process required targeted cleanup after assertions completed; no production process was stopped. The subsequent code fix received its own full successful release check described below. The owner committed/pushed the then-current work, including the fix, as `c764e28` during this session; that commit was not rewritten.

## Actual access inventory

| Resource                                            | Actual availability / restriction                                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Railway production                                  | Existing UglyDex web and dedicated PostgreSQL accessible; owner-authorized startup repair performed                        |
| Railway staging                                     | Created isolated environment, PostgreSQL and web service; distinct DB and AUTH_SECRET                                      |
| Public origins                                      | Production `https://uglydex-production.up.railway.app`; staging `https://uglydex-staging-staging.up.railway.app`           |
| Backup / recovery                                   | Both databases backed up; production and staging archives restored to new disposable databases on staging PostgreSQL       |
| Ethereum archive RPC                                | Mainnet/archive/ERC721/boundary verified; later HTTP 429 prevents completing backfill                                      |
| Wallet links / UglyBot main, prizes, claims, points | Connect and schemas match; all five credentials have effective write/admin privileges                                      |
| Gauntlet                                            | Configured, authentication rejected: `28P01`                                                                               |
| Survival / ImageSubmit                              | Configured hosts do not resolve: `ENOTFOUND`                                                                               |
| Separate Gauntlet image DB                          | URL absent                                                                                                                 |
| Discord / admin IDs                                 | Credentials present; existing allowlist formatting corrected; callback URLs configured on each web service                 |
| Devices / wallets                                   | Owner reports Brave + MetaMask signature login and persistence after reload; OS/browser version unspecified. No phone test |
| Customs                                             | Owner supplied contract and OpenSea collection; RPC probe hit 429; reviewed token/artwork manifest absent                  |
| Editions                                            | No authoritative manifest or contracts supplied                                                                            |

Source credentials were not copied into isolated staging. Railway private network reachability must be established explicitly. Secrets, database URLs, personal identifiers, raw source rows and backups are excluded from this report and Git. The temporary Railway SSH public-key registration was revoked after operations; recovery archives remain in ignored private storage.

## Backup and restore evidence

The original production database was empty: zero user tables/migrations. Its logical baseline backup was 885 bytes, SHA256 `fe0721983b04172929facbc84c50d061da44021edb535e4ed36541f13d68ce9a`, and restored correctly on a separate staging recovery database. Measured end-to-end restore operation: 1,413 ms. This empty baseline was not treated as proof of populated application recovery.

| Snapshot                        | UTC / method                                                                    | Size and integrity                                                                         | Restore result                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Staging canonical catalog       | 2026-09-27, PostgreSQL 18.6 custom `pg_dump`, exported repeatable-read snapshot | 1,867,433 bytes; SHA256 `76894b01cbc938094bcd269bdd28a119c6b04709015fe53c9458f449e0002e21` | All 79 table counts/digests identical; restore/compare below one-second timer resolution   |
| Production after startup repair | 2026-09-27T00:57:11Z, same consistent logical method                            | 1,872,545 bytes; SHA256 `0cb46f65950a8d57ad7ebdb0e6b88812024f753f9abd91de2f2d38575f18c6cf` | All 79 table counts/digests identical; restore/compare 1 second at whole-second resolution |

Recovery targets were new databases on the **staging database service**, never production or either active app database. Guards checked the exact staging environment/service, source/target separation, explicit restore intent, new database creation and empty target. `pg_restore` used a single transaction and exit-on-error. Inventory equality was checked before recovery containment disabled worker/Edition controls and removed the copied deployment binding.

Both restored catalog snapshots passed all eleven migration/checksum checks and eight app boot/HTTP/PNG assertions using application commit `c764e28`. Catalog counts were 4,444 Squigs and 44,440 traits. Empty activity/progression/collection/provenance/collectible categories were validated as empty; no claim of populated historical recovery is made. A new drill is required after real historical imports.

Production platform snapshots were created before changes (00:03:50Z, approximately 845 MB referenced) and before startup repair (00:36:35Z, approximately 846 MB). Staging platform snapshot at 00:22:49Z referenced approximately 903 MB. Daily, weekly and monthly schedules were enabled on both volumes; reported retention is 6, 27 and 89 days respectively. PITR is disabled. Actual logical archives are retained privately in ignored storage; scheduling does not imply long-term restore reliability.

## Deployment and migrations

Staging final deployment: `d779753e-b468-465f-ad1c-1c5b67bc8cce`. Production repaired deployment: `8a9cba84-24d9-443b-a00b-b5dd8fd27c5c`. Both use the tested `c764e28` source and eleven migrations.

Railway initially reported successful builds without effective migration/readiness settings. Explicit service configuration and a fresh upload from the archived project root produced active manifests with `npm run db:migrate`, `npm start`, `/api/ready`, 120-second health timeout and three restart retries. Production additionally needed valid diagnostics-token length, normalized existing admin-ID separators, explicit APP_ENV and the exact Discord callback. Its AUTH_SECRET was preserved. Staging uses a separate AUTH_SECRET and database binding.

Both deployments pass ten smoke assertions: home, health, ready, explorer, Squig 1, invalid Squig, missing Collector, unauthenticated admin page/API denial and PNG share. Staging preflight passes with unavailable-source warnings. Production offline preflight and migration drift/checksum checks pass; its start-block configuration remains pending for a future controlled provenance rollout. The initially empty production share endpoint returned 404; canonical catalog/ruleset seeding corrected it to PNG 200 without application code changes.

## Ethereum provenance — partial, resumable

Contract: `0x8c9a02c0585200c4c65608df6b8def543d33792a`. Independent archive RPC checks confirmed chain ID 1, deployed 45-byte proxy bytecode, ERC721 support, a successful pinned `ownerOf(1)` response, historical block access and Transfer logs. Blockscout/OpenSea were not used as chain proof.

- Deployment boundary: **25,342,921**, hash `0x93ca8bc722009e26a0d160ced1b89f91e5f488c8d275747031bf8711c6859bad`.
- Bytecode absent at 25,342,920 and present at 25,342,921 and 25,342,922.
- First observed mint: token 1, block **25,349,689**, transaction `0x80d047b0ed1a0e6c7f850df54d74f81891dc2ed37e1b3a2d3607d0645548af16`.
- A 1,000-block probe beginning at deployment correctly found no mint; a 10,000-block probe found 3,405 Transfers and 2,035 mints. No later block was substituted as the deployment boundary.

| Staging ledger metric                                             | Actual value                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Expected canonical Squigs                                         | 4,444                                                                       |
| Indexed range                                                     | 25,342,921 through **25,352,920**                                           |
| Finalized head observed during successful batch                   | **26,065,214**; not fully indexed                                           |
| Imported Transfers / mint events / unique token IDs               | **3,405 / 2,035 / 2,035**                                                   |
| Burn events in imported range                                     | 0; not a whole-collection burn count                                        |
| First batch duration                                              | **39,798 ms**                                                               |
| Clean derived provenance rows                                     | **100**                                                                     |
| Dirty provenance rows awaiting derivation                         | **1,935**                                                                   |
| Wallet ownership periods / Collector ownership periods            | **171 / 0**                                                                 |
| Full ownerOf comparisons / matches                                | Not run / 0 stored matches; single token RPC probe is not a full comparison |
| Whole-history duplicates, missing mints, broken chains, anomalies | Not determined; incomplete ledger                                           |

Initial staging RPC concurrency was reduced from 3 to 1 after rate-limit evidence; a 10,000-block batch was accepted and committed with **45 logged RPC retries**. Two resumptions failed before advancing: 62,393 ms with 600-ms pacing, then 152,274 ms with a 1,000-block batch and one-second pacing. The last failure was `getBlock` HTTP 429 followed by `RPC_RETRIES_EXHAUSTED`. A separate 1,000-block `eth_getLogs` diagnostic returned 3,088 events, but these were **not imported**. No cursor reset or duplicate reimport occurred.

The stored cursor retains `RPC_RETRIES_EXHAUSTED`. Continuous workers remain disabled. Full backfill, full provenance verification, deterministic raw-to-UI spot audit and historical/live handoff remain pending. No claims were manufactured from the 100 currently derived rows. Resolve provider throughput/quota first, then resume from the cursor.

## Legacy schema/privilege results

`launch:sources` ran from production using the existing SELECT-only query wrapper and read-only transactions. Wallet-links and all four UglyBot groups have matching required schemas but effective elevated role, database/schema CREATE and table-write privileges. They are **not VERIFIED_READ_ONLY**; the tool reports UNABLE_TO_VERIFY and failed source gates. No permission was tested by writing.

Safe count/date probes returned the following source availability, not imported history or completeness:

| Group / table                            |  Rows | Earliest / latest available timestamp (UTC date) |
| ---------------------------------------- | ----: | ------------------------------------------------ |
| links / wallet_links                     |   377 | 2026-02-16 / 2026-09-22                          |
| uglybot / squig_duels                    |   281 | 2026-04-25 / 2026-09-05                          |
| uglybot / squig_duel_rounds              | 1,896 | 2026-04-25 / 2026-09-05                          |
| uglybot / squig_duel_player_squigs       |     7 | 2026-04-30 / 2026-07-11                          |
| prizes / malformed_marketplace_purchases |    45 | 2026-07-06 / 2026-09-19                          |
| prizes / marketplace_purchases           |   323 | 2026-04-08 / 2026-08-04                          |
| prizes / bounty_submissions              |    12 | 2026-08-26 / 2026-09-16                          |
| prizes / bounty_draw_results             |     6 | 2026-08-31 / 2026-08-31                          |
| prizes / maw_return_sessions             |    81 | 2026-07-10 / 2026-08-17                          |
| prizes / madlib_sessions                 |    30 | 2026-09-13 / 2026-09-23                          |
| prizes / bounty_pool_entries             |    36 | 2026-08-26 / 2026-09-25                          |
| prizes / madlib_publications             |    13 | 2026-09-13 / 2026-09-19                          |
| prizes / madlib_operations               |    23 | 2026-09-13 / 2026-09-17                          |
| prizes / maw_squig_pool                  |    66 | 2026-07-10 / 2026-08-17                          |
| claims / claim_events                    | 1,779 | 2026-03-01 / 2026-09-26                          |
| claims / nft_claims                      | 3,664 | Timestamp probe unavailable                      |
| points / holder_point_mappings           |     4 | Timestamp probe unavailable                      |

Gauntlet, Survival, images and submissions have no usable row/count/date result because of the inventory failures above. Exact timestamp outputs remain in ignored operational reports.

No pilot or full import was run for any of the 17 feeds: duels, marketplace, purchases, bounty, bountyEntries, bountyResults, maw, mawPrizes, claimEvents, runs, survival, onlineRewards, imageUses, submissions, liveImages, madlibPublications and madlibOperations. Thus Phase 10 import scanned/inserted/updated/skipped counts are zero operations; eligibility, normalization, unresolved attribution, rejection and linkage distributions are **not evaluated**, not clean zero-rate evidence. All source completeness remains PENDING. Cross-feed payment/reward double-count review awaits valid pilots/imports.

## Identity, replay and derived counts

At 2026-09-27T00:58:54Z, production had **1 Collector, 1 linked wallet, 0 Discord identities, 0 reconciliation cases and 0 decisions**. The owner independently tested the live wallet flow. No legacy identities were automatically reconciled or resolved by names. Final launch verification found **1 pending attribution job and 0 unattributed activities**, producing a DEGRADED REATTRIBUTION gate. It was not manually cleared or processed out of sequence to improve the launch result.

Production had 0 Transfers, 0 activities, 0 discoveries, 0 Collector/Squig progression rows, 0 XP grants, 0 Collector/Squig achievements, 0 trait discoveries, 0 set progress/snapshots/milestones. It had **4,445 progression jobs and 1 collection job** queued. Staging had no Collectors/wallets/Discord identities or reconciliation decisions, no XP/achievement/collection outputs, and **4,444 progression jobs**. These are observed empty/unprocessed states, not completed evaluations or valid completion distributions. Revocation/completeness-gated evaluation reports are pending.

**Production Replay A fingerprint: unavailable. Replay B fingerprint: unavailable. Semantic diff: not evaluated.** Stable source/provenance/identity prerequisites are incomplete. No empty replay was used to close the gate. The full local release suite produced a VERIFIED fixture replay with eleven derived-table fingerprints and zero differences; fixture input hash `ec6c8e8f0926c6dc0712414f0c8a108717987037623dc0dacce8dba0653454a6` is not production proof. Both v1 rulesets are unchanged.

## Workers and Railway measurements

All four worker controls resolve to DISABLED in both deployments; zero worker heartbeat records were observed. No worker service was enabled, no live observation window is claimed, and no historical/live handoff was attempted over incomplete inputs. Staging RPC/legacy outage injection, forced worker restart, failed progression/collection items and production-dashboard alert recovery remain pending. Local recovery tests passed but are separate evidence.

Small staging baseline at `811314b`, 2026-09-27T00:28Z, five sequential public requests per route from the operator workstation:

| Route      | p50 / p95 ms | Failures |
| ---------- | ------------ | -------- |
| `/`        | 106 / 570    | 0/5      |
| `/squigs`  | 105 / 155    | 0/5      |
| `/squig/1` | 86 / 100     | 0/5      |

Staging PNG first/repeat square: **5,105 / 342 ms**; landscape: **217 / 203 ms**. Two concurrent first square requests: **5,241 / 4,662 ms**. Four-request cached burst, maximum concurrency two: **307, 95, 113, 129 ms**. All ten PNG requests returned 200 with PNG signatures. “First” is inferred from first access, not forced cache eviction; this is not a large-sample cold-cache benchmark. No render concurrency limit was raised.

After the owner reported slow loading, production `c764e28` was measured from its Railway web container via public HTTPS, five sequential requests each:

| Existing public route | p50 / p95 ms | Failures |
| --------------------- | ------------ | -------- |
| Collector profile     | 53 / 126     | 0/5      |
| Collector activity    | 35 / 37      | 0/5      |
| Collector collection  | 38 / 43      | 0/5      |

These samples did not reproduce the browser delay. They exclude browser rendering, wallet-extension latency and the user's network. The slow first share render is a possible contributor, not an established cause. No real gallery measurement was available.

A staging database sample had **1 client / max_connections 100**, with no workers active. This is not full-topology pool certification. Railway staging web metrics across a 15-minute operator/recovery window: average CPU **0.0390 vCPU**, peak **0.3738331**; average memory **273.54 MB**, current **388.18 MB**, peak **704.96 MB**. Reported service limits were 24 vCPU / 24,576 MB. The sample includes operator/recovery processes and is not steady-state capacity proof. Database pools, render limits and worker cadence were not increased.

## Auth, devices, privacy and OG

The owner reports **Brave + MetaMask**, successful message signature and remaining signed in after reload. Device/OS and version are unspecified. This certifies that reported path only; rejection, account change, multi-wallet, unlink, logout and physical-device share remain pending. No iPhone Safari or Android Chrome test occurred. In-app browser automation failed before session creation with a tool infrastructure error; local test Chromium is not a substitute.

Staging HTTP auth probes observed a 303 to Discord, exact staging callback, state, S256 PKCE and Secure/HttpOnly challenge cookie. An invalid callback returned 400/no-store. No real Discord consent/code exchange/conflict/logout test completed. The existing application is used for both environments at the owner's request; registration of both callback paths in Discord remains to be confirmed.

Anonymous admin/missing-profile/missing-share denial checks passed. A later production sample found one **public** profile with wallet display enabled; profile and collection returned 200 with OG title/image metadata. No private profile or hidden wallet existed in that sample, so it cannot establish those boundaries. No personal values were exported. Public-to-private transition, declined submissions, unpublished Mad Libs and reconciliation privacy with real imported data remain pending.

Twitterbot user-agent requests received staging Squig metadata and its PNG. This is crawler-facing HTTP evidence, **not** an actual Discord/Twitter crawler preview. Collector/gallery/achievement/set/completion third-party previews and privacy transitions remain pending. Third-party caches may retain images after UglyDex stops serving private personalized data.

## Official collections and OpenSea

Owner-provided references:

- [Squigs official website](https://squigs.io/).
- [Squigs Reloaded on OpenSea](https://opensea.io/collection/squigs-reloaded): `0x8c9a02c0585200c4c65608df6b8def543d33792a`.
- [Squigs Customs on OpenSea](https://opensea.io/collection/squigs-customs): `0x64abc24b4e26b89ec4ed03563fafa82dd5f61576`.

The website and Reloaded page were accessible during research; the Customs page was not accessible through the browsing tool. The bounded Customs chain probe returned HTTP 429 before standard verification. No reviewed Customs token/artwork manifest or Edition manifest/contracts exist. **Customs imported: 0. Editions imported: 0. Edition contracts indexed: 0.** No official claims were inferred from names or marketplace listings.

OpenSea's [NFT metadata](https://docs.opensea.io/reference/get_nft), [owners](https://docs.opensea.io/reference/get_nft_owners) and [collection events](https://docs.opensea.io/reference/list_events_by_collection) endpoints may help cross-check metadata/listings. No API integration was added; archive logs and pinned on-chain ownership remain the launch proof.

## Observed fixes and release validation

One application defect was fixed: the Phase 9 archive-boundary verifier failed immediately on transient HTTP 429 despite the indexer already having bounded retries. `src/server/launch-rpc.ts` now uses the existing retry helper for contract validation, finalized/historical block reads, bytecode, logs and final hash confirmation, and records retry count. The probe range, strict boundary requirements and fail-closed behavior are unchanged.

A new regression in `tests/launch-rpc.test.ts` failed before the fix and passed afterward: transient contract/code/log failures recover without widening the probe range, retry evidence is counted, and secret values do not enter evidence. Permanent failure still fails closed. The owner committed this fix as part of `c764e28`; no unrelated refactor was added.

Full post-fix `npm run release:check`: **PASS**, 506 unit tests across 13 files, lint, formatting, typecheck, catalog/build validation and **814 DB/HTTP/browser/catalog assertions**, including local Replay A/B. `npm audit --json`: **0 vulnerabilities / 689 dependencies**. Final secret/history scan: **329 working-tree files, 542 historical blobs, zero findings**. Existing auth/nonce/PKCE/origin, SSRF/rate-limit, SQL parameterization, admin, privacy/share and recovery regressions remain passing. No new tests were added for reversible environment-formatting/service-configuration fixes. The npm major-version notice is informational; no npm major upgrade was performed.

## Final launch decision

Both `launch:check` commands returned **exit 1**, and `launch:report` exported actual per-environment records at application commit `c764e28`. Every verified gate has a timestamp, environment/database/commit binding and evidence hash. Evidence expires after 24 hours; this report is historical, not a perpetual READY assertion.

| Environment | Decision      | VERIFIED | PENDING | PARTIAL | DEGRADED | FAILED | Blocking remaining | Optional warnings |
| ----------- | ------------- | -------: | ------: | ------: | -------: | -----: | -----------------: | ----------------: |
| Staging     | **NOT_READY** |        7 |      22 |       2 |        0 |      0 |                 13 |                11 |
| Production  | **BLOCKED**   |        5 |      20 |       0 |        1 |      5 |                 15 |                11 |

Staging gates closed: **DATABASE, MIGRATIONS, WEB_DEPLOYMENT, BACKUP, RESTORE_DRILL, ARCHIVE_RPC, START_BLOCK**. Production gates closed: **DATABASE, MIGRATIONS, WEB_DEPLOYMENT, BACKUP, RESTORE_DRILL**. Evidence was reviewed individually, never bulk-verified by category.

Staging blocking keys remaining: WORKERS, MINT_COVERAGE, OWNERSHIP_CONTINUITY, OWNER_OF, REATTRIBUTION, ACTIVITY, DUPLICATE_REVIEW, PROGRESSION, COLLECTIONS, DERIVED_REPLAY_STABLE, HANDOFF, PRIVACY_AUTH, REAL_DEVICE_SHARE. Production additionally requires ARCHIVE_RPC and START_BLOCK in its own deployment context. Its REATTRIBUTION is DEGRADED because the new wallet has one queued attribution job; this was not waived.

All eleven optional warning keys remain unresolved: WALLET_LINKS, UGLYBOT, GAUNTLET, SURVIVAL, IMAGE_SUBMIT, IDENTITY_REVIEW, EXTERNAL_OG, CUSTOM_MANIFEST, EDITION_MANIFEST, EDITION_CONTRACTS, HOLDER_TIERS. The first five are FAILED in production from real source checks; absent staging source configurations remain PENDING. Optional source policy does not waive blocking activity/identity/replay requirements.

## Next execution scope

Continue operational launch completion, not feature development. Follow [the access walkthrough](phase10-access-followup.md): obtain dedicated source readers and repair routing/passwords, resolve RPC 429, then resume provenance, full verification and spot audit. Run bounded source pilots before full imports and duplicate/identity review; then real Replay A/B, handoff, staged workers and populated backup recovery. Complete Discord, privacy transitions, device/share/third-party OG, failure recovery and full-topology measurements. Official collectibles remain conditional on reviewed manifests. Production rollout and post-launch observation require cleared blocking gates. No engagement system is recommended for Phase 11.
