# Phase 11 full staging source imports and duplicate review

Date: 2026-09-27 UTC. Branch: `phase11-launch-evidence`.
Application and staging revision: `2ab0fc39a4ba7d392086d5d66597457ca326a751`.
Starting evidence revision: `33a1eac`. Production remains `c764e28`.
This report is committed as a subsequent evidence-only revision; no application code changed.

## Decision and authorized scope

**READY_FOR_IDENTITY_RECONCILIATION_AND_DERIVED_REPLAY** as the next separately authorized stage. All 16 approved available feeds reached their reviewed historical end, passed a full reconciliation repeat, and passed populated semantic/privacy review. The full duplicate audit has no unresolved blocking candidates. This is not a production launch approval and does not authorize executing the next stage.

Only staging identity evidence preload, historical source imports, source-import repeats, duplicate/privacy review and launch evidence updates ran. No production imports or bridges, workers, broad/manual reconciliation, deployed progression/collection replay, populated restore drill, Customs or Editions imports ran. Local release tests use disposable fixture databases and are separate from staging replay.

The prior [bounded pilot report](phase11-pilot-report.md) remains historical evidence. Pilot records, 60 prior bot-event retractions and canonical source evidence were retained. The absent `onlineRewards` table remains **UNAVAILABLE_SOURCE_TABLE**; it was neither scanned nor labeled empty or complete.

## Preconditions and chain compatibility

The branch started clean. Staging reported the exact intended application revision. Before any source import, the release suite passed 556 unit tests and 837 database/HTTP/browser assertions, and all ten staging smoke probes passed. All nine logical source connections again authenticated through the three staging HTTPS/HMAC bridges and returned VERIFIED_READ_ONLY. Eight physical databases provide 25/26 required tables; all required columns on the 25 present tables remain compatible. Feed prerequisites were checked again before each historical import. Reader roles, bot accounts and upstream rows were unchanged.

ARCHIVE_RPC and START_BLOCK were revalidated with chain/ERC721 checks, bytecode absent at 25,342,920 and present at 25,342,921, historical block access, and a single-block Transfer-log probe confirming token 1's mint at 25,349,689. OWNER_OF was reverified using the existing pinned ledger: 4,444 checked, 4,444 mints, 4,444 matches, zero unavailable owner reads, missing metadata or anomalies, at block 26,068,941. No historical chain scan, reset or cursor advancement occurred.

### Fresh pre-import backup

- Environment/database logical identifier: UglyDex staging PostgreSQL.
- Timestamp: 2026-09-27T16:12:18Z.
- Method: custom-format `pg_dump` using an exported repeatable-read snapshot; inventories for all 79 public tables share that snapshot.
- Size: 5,862,330 bytes.
- SHA256: `59388dceae0dd35d5e8ba81ae21594df9be0eac7fb372560bab099c856df3d60`.
- Integrity: local archive hash matched the database-side hash; `pg_restore --list` succeeded. Inventory includes 11,052 Transfers, 11,003 wallet ownership periods, 2,245 activities, 21 gate records and 11 migrations.
- Archive and inventory retained only in ignored/private operational storage. Existing platform backup schedules remain separate retained evidence. No restore was performed or claimed.

## Identity evidence preload

The existing `syncIdentities` path read 377 wallet-link rows in the configured canonical guild scope. It inserted 377 wallet-evidence records, updated zero, skipped zero and rejected zero. Discord identities and Collectors each increased by 219 (121 → 340 Discord identities; 123 → 342 Collectors). It created 284 dated historical evidence records, bringing the total to 286. Those 284 legacy attributions remain UNCONFIRMED and require review; no username matching or forced merge occurred.

Conflicting legacy links: zero. Historical attribution review cases: 284. Queued attribution jobs changed from one to 284, through the normal evidence path. No job was manually deleted. The path marked 3,319 provenance rows dirty because identity evidence changed; this is queued downstream work, not lost or corrupt chain history. No broad reconciliation or derivation was run to clear it.

Full source imports subsequently created 35 additional Discord identities/Collectors. Final counts: 377 Collectors, 375 Discord identities, 377 wallet-link evidence records, 286 historical attribution records, 284 review cases, zero reconciliation decisions, and 284 queued attribution jobs.

## Historical import method and metrics

A read-only full-source semantic preview inspected 29,395 primary rows before importing. Every normalized event was checked against the pilot decisions, including exact participant/token/date/financial meanings and safe DTO projection. There were zero normalization rejections or privacy leaks. Two automated purchase-type warnings were reviewed as refund slots: the 323 purchase slots all retained `purchaseType=raffle`; the two separate refund slots correctly carry correction semantics. No adapter fix was needed.

The operator invoked existing `runActivityFeed(feed, { maxPages: 5 })` in the requested three groups, sequentially, checking each bounded run for failures. Pages contain at most 200 source rows. All historical cursors began null, independently of pilot samples. Mutable feeds used their existing updated-time/key cursors, including preserved PostgreSQL microsecond precision; other feeds used source keys. The importer persisted SyncRun metrics and cursor checkpoints. Each feed then ran its full keyset reconciliation pass with `{ maxPages: 5, reconcile: true }`, continuing the reconciliation cursor until source exhaustion. This was source-import idempotency, not derived Replay A/B.

| Feed               | Scanned | Eligible | Normalized | Inserted | Updated | Skipped | New retractions | Rejected |
| ------------------ | ------- | -------- | ---------- | -------- | ------- | ------- | --------------- | -------- |
| duels              | 281     | 281      | 403        | 116      | 0       | 287     | 0               | 0        |
| runs               | 542     | 542      | 542        | 342      | 0       | 200     | 0               | 0        |
| survival           | 14694   | 14694    | 14694      | 14494    | 0       | 200     | 0               | 0        |
| imageUses          | 9584    | 9584     | 9584       | 9384     | 0       | 200     | 0               | 0        |
| marketplace        | 45      | 45       | 45         | 0        | 0       | 45      | 0               | 0        |
| purchases          | 323     | 323      | 325        | 123      | 0       | 202     | 0               | 0        |
| bounty             | 12      | 12       | 12         | 0        | 0       | 12      | 0               | 0        |
| bountyEntries      | 43      | 43       | 43         | 0        | 0       | 43      | 0               | 0        |
| bountyResults      | 6       | 6        | 6          | 0        | 0       | 6       | 0               | 0        |
| maw                | 81      | 66       | 87         | 0        | 0       | 102     | 0               | 0        |
| mawPrizes          | 66      | 1        | 1          | 0        | 0       | 66      | 0               | 0        |
| claimEvents        | 1783    | 1783     | 1783       | 1583     | 0       | 200     | 0               | 0        |
| submissions        | 866     | 866      | 866        | 666      | 0       | 200     | 0               | 0        |
| liveImages         | 1033    | 1033     | 1033       | 833      | 0       | 200     | 0               | 0        |
| madlibPublications | 13      | 13       | 13         | 0        | 13      | 0       | 0               | 0        |
| madlibOperations   | 23      | 23       | 23         | 0        | 0       | 23      | 0               | 0        |

Totals: **29,395 scanned; 29,315 eligible; 29,460 normalized slots; 27,541 inserted; 13 updated; 1,986 skipped; zero new retractions; zero rejected**. Existing 60 bot retractions remain retained. The legacy skipped counter mixes 1,906 unchanged event slots and 80 ineligible rows (15 Maw sessions and 65 undelivered Maw-prize rows); it is not a count of failed rows.

| Feed               | Collector-linked | Squig-linked | Unresolved | Import seconds | Repeat seconds | Repeat inserts / updates / semantic changes |
| ------------------ | ---------------- | ------------ | ---------- | -------------- | -------------- | ------------------------------------------- |
| duels              | 403              | 254          | 0          | 2.343          | 1.788          | 0 / 0 / 0                                   |
| runs               | 542              | 0            | 0          | 3.853          | 2.655          | 0 / 0 / 0                                   |
| survival           | 14694            | 0            | 0          | 118.004        | 74.687         | 0 / 0 / 0                                   |
| imageUses          | 9584             | 0            | 0          | 77.093         | 47.431         | 0 / 0 / 0                                   |
| marketplace        | 45               | 0            | 0          | 0.451          | 0.349          | 0 / 0 / 0                                   |
| purchases          | 325              | 0            | 0          | 2.243          | 1.577          | 0 / 0 / 0                                   |
| bounty             | 12               | 0            | 0          | 0.259          | 0.201          | 0 / 0 / 0                                   |
| bountyEntries      | 0                | 43           | 43         | 0.319          | 0.285          | 0 / 0 / 0                                   |
| bountyResults      | 6                | 6            | 0          | 0.212          | 0.174          | 0 / 0 / 0                                   |
| maw                | 87               | 87           | 0          | 0.645          | 0.615          | 0 / 0 / 0                                   |
| mawPrizes          | 1                | 1            | 0          | 0.364          | 0.328          | 0 / 0 / 0                                   |
| claimEvents        | 1783             | 0            | 0          | 14.469         | 8.795          | 0 / 0 / 0                                   |
| submissions        | 866              | 0            | 0          | 8.670          | 5.157          | 0 / 0 / 0                                   |
| liveImages         | 1033             | 0            | 0          | 8.692          | 5.946          | 0 / 0 / 0                                   |
| madlibPublications | 13               | 0            | 0          | 0.304          | 0.211          | 0 / 0 / 0                                   |
| madlibOperations   | 23               | 0            | 0          | 0.300          | 0.257          | 0 / 0 / 0                                   |

All repeats together scanned the same 29,395 rows and normalized 29,460 slots, with **zero inserts, zero updates, zero new retractions and zero semantic differences**. Repeat skipped = 29,540: 29,460 unchanged event slots plus 80 ineligible rows. Each feed's semantic fingerprint matched its post-historical-import fingerprint. The only first-pass updates were 13 Mad Lib publication `sourceUpdatedAt` refreshes; event timestamps, visibility, attribution and meaning were unchanged. No other source correction appeared during the observed repeat window.

### Available source coverage

| Feed               | Earliest available source timestamp (UTC) | Latest available source timestamp (UTC) | Historical cursor end SHA256 prefix |
| ------------------ | ----------------------------------------- | --------------------------------------- | ----------------------------------- |
| duels              | 2026-04-25 17:32:33.994319+00             | 2026-09-05 01:10:35.4698+00             | e5ac883536bae77e                    |
| runs               | 2025-11-23 16:23:27.49254+00              | 2026-05-28 16:55:35.463449+00           | ca6c4d4ce33b1e21                    |
| survival           | 2026-02-14T22:25:19.554Z                  | 2026-09-27T02:31:51.493Z                | acd6e90631be752d                    |
| imageUses          | 2026-02-14T22:57:08.529Z                  | 2026-09-27T02:42:13.766Z                | bb257b6a873f1805                    |
| marketplace        | 2026-07-06 13:57:12.688696+00             | 2026-09-19 09:04:39.20875+00            | 2fb1dc7699d145e9                    |
| purchases          | 2026-04-08 20:22:23.235356+00             | 2026-08-04 16:47:25.464965+00           | 262650562392c4a7                    |
| bounty             | 2026-08-26 14:09:33.451539+00             | 2026-09-16 14:55:05.142127+00           | d35f5efc8c294d67                    |
| bountyEntries      | 2026-08-26 14:14:52.481309+00             | 2026-09-27 01:15:17.845966+00           | d35d93509ae15a9a                    |
| bountyResults      | 2026-08-31 20:00:24.695624+00             | 2026-08-31 20:00:24.695624+00           | 0e71c9d61a801b86                    |
| maw                | 2026-07-10 02:18:42.791139+00             | 2026-08-17 14:42:25.853174+00           | e20d0633953b9c13                    |
| mawPrizes          | 2026-07-10 02:20:36.232929+00             | 2026-08-17 14:43:28.344617+00           | 50dd8129b121298e                    |
| claimEvents        | 2026-03-01 15:02:27.953692+00             | 2026-09-27 12:55:20.084957+00           | 489a9565650ccffd                    |
| submissions        | 2026-04-11 22:50:13.777177+00             | 2026-09-25 17:59:04.428874+00           | 776641c2545360fb                    |
| liveImages         | 2026-02-14 23:12:43.482349+00             | 2026-09-14 21:52:55.341989+00           | 2021bfcf916adca8                    |
| madlibPublications | 2026-09-13 03:30:28.331111+00             | 2026-09-19 17:33:46.285503+00           | 3ba3235011e7d9b2                    |
| madlibOperations   | 2026-09-13 03:19:32.588584+00             | 2026-09-17 01:53:10.418743+00           | 0a112f4b57eda64a                    |

Every feed is **SOURCE_EXHAUSTED / PARTIAL**, with `TRACKED_AVAILABLE_HISTORY_NOT_LIFETIME`. None is COMPLETE_HISTORY_VERIFIED. Source retention before the earliest available record is unproven. Source statistics count exactly the rows scanned for every feed. The statistics endpoint lacks dates for Survival and image uses; their dates above are measured from the complete scanned parent-game `started_at` and image-use `used_at` population respectively. No `finished_at` was invented. Full cursor values remain in private SyncRun/IntegrationSource records; only hash prefixes are published because composite keys can contain private source identifiers. All final reconciliation cursors are the empty keyset, indicating a completed sweep; historical cursors are retained.

### Normalized event coverage

| Feed               | Earliest normalized event (UTC) | Latest normalized event (UTC) |
| ------------------ | ------------------------------- | ----------------------------- |
| duels              | 2026-04-25T17:42:33.607Z        | 2026-09-05T01:18:08.102Z      |
| runs               | 2025-11-23T16:23:27.492Z        | 2026-05-28T16:55:35.463Z      |
| survival           | 2026-02-14T22:25:19.554Z        | 2026-09-27T02:31:51.493Z      |
| imageUses          | 2026-02-14T22:57:08.529Z        | 2026-09-27T02:42:13.766Z      |
| marketplace        | 2026-07-06T13:57:12.688Z        | 2026-09-19T09:04:39.208Z      |
| purchases          | 2026-04-08T20:22:23.235Z        | 2026-08-04T16:47:25.464Z      |
| bounty             | 2026-08-27T14:11:12.911Z        | 2026-09-17T15:01:22.185Z      |
| bountyEntries      | 2026-08-26T14:14:52.481Z        | 2026-09-27T01:15:17.845Z      |
| bountyResults      | 2026-08-31T20:00:37.155Z        | 2026-08-31T20:01:00.585Z      |
| maw                | 2026-07-10T02:20:36.232Z        | 2026-08-17T14:43:28.344Z      |
| mawPrizes          | 2026-07-10T09:48:47.646Z        | 2026-07-10T09:48:47.646Z      |
| claimEvents        | 2026-03-01T15:02:27.953Z        | 2026-09-27T12:55:20.084Z      |
| submissions        | 2026-04-11T22:50:13.777Z        | 2026-09-25T17:59:04.428Z      |
| liveImages         | 2026-02-14T23:12:43.482Z        | 2026-09-14T21:52:55.341Z      |
| madlibPublications | 2026-09-13T03:30:28.331Z        | 2026-09-19T17:33:46.285Z      |
| madlibOperations   | 2026-09-13T03:19:32.588Z        | 2026-09-17T01:53:10.837Z      |

Source creation dates and event dates are intentionally separate: Duel completion, Bounty acceptance, Maw receipt/digestion, refunds and image approvals can occur after row creation. Maw-prize timestamp limitations from the pilot remain explicit.

### Preserved feed semantics and warnings

- Duels: 281 rows yield 403 human events (229 completed, 163 cancelled, 11 entered). The known bot has zero active events; its 60 old retractions remain. Wagers are participant observations, not payouts; explicit token links only.
- Marketplace: 43 delivered and two paid-pending-delivery purchases; no inferred Squig or extra delivery payment. Purchases: 323 raffle purchases and two refunds; persisted spent amount is total cost. Upstream code writes `totalCost` directly and separately records refunds.
- Bounty: 11 accepted and one submitted observation; donated NFTs remain external. Entries: 42 active and one removed, all 43 unattributed. `added_by` is not ownership evidence. Results: one NFT prize and five CHARM prizes; winning entry, prize NFT and paid CHARM remain distinct.
- Maw: 66 received sessions produce 87 events, including 21 source-evidenced digestions. Fifteen unreceived sessions produce no receipt/payout event, including one whose operational status says paid. Swallowed alone is not a burn. Maw prizes: only the single delivered prize is activity; 65 available/digested inventory rows are excluded.
- Claims: 1,783 private recorded observations retain amount/count/type metadata; none becomes a second ledger payout or balance.
- Runs: 542 completed run observations; unavailable optional result/final-round/greed fields remain absent. Survival: 14,694 player records use parent game start time, exact counters and no inferred Squig. Image uses: 9,584 participant-use records, with no creator or token inference.
- Submissions: 762 approved, 97 declined and seven pending; 104 non-approved details remain private. Live images: 1,033 approved contributions. Reward points remain metadata, not payment; free-form NFT text is not linkage.
- Mad Libs: 13 published contributions exclude private story content. Operations: 20 confirmed-success (six debits, 14 rewards) and three confirmed-failure records; only successful operations carry tracked amounts, and all operation records remain private.

## Full historical duplicate review

Deterministic candidates required exact source actor and decimal amount, with one-minute, one-hour and one-day windows; the same actor/amount comparison was also run without a time window. Decimal comparison removes insignificant trailing zeros without rounding. Amount/time similarity never automatically merged records. Independent actor/currency/amount/direction comparisons found zero financial candidate pairs both at exact timestamps and within one day.

| Source combination                                      | 1 minute | 1 hour | 1 day | Same actor/amount, any time       | Decision                                                                     |
| ------------------------------------------------------- | -------- | ------ | ----- | --------------------------------- | ---------------------------------------------------------------------------- |
| marketplace / purchases                                 | 0        | 0      | 0     | 0                                 | Distinct observed purchase families: Malformed items versus raffle purchases |
| bountyResults / claimEvents                             | 0        | 0      | 0     | 0                                 | Claims remain observation-only                                               |
| maw / claimEvents                                       | 0        | 0      | 0     | 0                                 | Claims remain observation-only                                               |
| madlibOperations / claimEvents                          | 0        | 0      | 0     | 0                                 | Confirmed operation identity retained; claims remain observation-only        |
| submissions / liveImages                                | —        | —      | —     | 760 explicit ID/image-key matches | SAME_EVENT_CANONICALIZED                                                     |
| creator reward metadata / confirmed earn-payout records | 0        | 0      | 4     | 1,512                             | OBSERVATION_ONLY metadata; matching numbers are not payment evidence         |

The 760 approval pairs have matching actors and approved/public submission authority, with zero authority conflicts. Both source records remain stored. Existing public query rules suppress the 760 overlapping live-image events. Exhaustive pagination through 44 public creator pages returned 1,035 visible contributions: 762 canonical submission approvals plus 273 non-overlapping live images. No suppressed duplicate or private submission appeared.

Decision counts are deliberately scoped: **760 SAME_EVENT_CANONICALIZED pairs; 1,512 broad creator-metadata candidate pairs classified OBSERVATION_ONLY (four within one day); zero financial candidate pairs requiring DISTINCT_EVENTS decisions; two CORRECTION/REFUND events within purchases; zero UNRESOLVED candidates**. The creator comparison inspected all 1,899 metadata records against 85 confirmed earned/payout records. None of the creator records carries a monetary ledger amount: matching reward-point numbers do not prove payment or a shared real-world event, and no financial event was merged or suppressed on that basis. The 1,783 claims are also classified OBSERVATION_ONLY as a feed, rather than invented duplicate pairs. The two purchase families are semantically distinct. No new canonicalization rule, source deletion or manual SQL correction was needed.

## Tracked economic observations

| Feed             | Direction | Tracked CHARM    | Confirmed observations |
| ---------------- | --------- | ---------------- | ---------------------- |
| bountyResults    | PAYOUT    | 32500.00000000   | 5                      |
| duels            | WAGER     | 183557.00000000  | 229                    |
| madlibOperations | EARN      | 1400.00000000    | 14                     |
| madlibOperations | SPEND     | 6000.00000000    | 6                      |
| marketplace      | SPEND     | 3910000.00000000 | 45                     |
| maw              | PAYOUT    | 2852500.00000000 | 66                     |
| purchases        | REFUND    | 20.00000000      | 2                      |
| purchases        | SPEND     | 1120231.00000000 | 323                    |

Tracked earned = **1,400 CHARM**; tracked spent = **5,036,231 CHARM**; tracked participant wagers = **183,557 CHARM**; tracked payouts = **2,885,000 CHARM**. Separate recorded refunds = **20 CHARM**. Earned and payout are disjoint stored directions here; wagers are not winnings. These are gross confirmed observations in the available source coverage, not a balance, net wealth, lifetime total or promise of exhaustive history. Claims and creator reward metadata contribute zero to these monetary aggregates. The audit found no confirmed economic double counting.

## Final activity and attribution population

Imported source scope: 29,460 active events, 29,417 Collector-linked, 391 Squig-linked, 43 unattributed and zero conflicting. Including 266 retained provenance activities: **29,726 active**, **29,683 Collector-linked**, **657 Squig-linked**, **43 unattributed**, **zero conflicting**, plus **60 retracted** records. Squig and Collector linkage can overlap and must not be added together.

The 43 Bounty entries remain unclaimed. Historical wallet cases remain safely unresolved, with 284 queued attribution jobs and zero manual decisions. Source import success does not certify downstream reconciliation.

## Populated privacy evidence

All 29,460 imported active events across all 16 feeds passed safe DTO checks for identity/source/moderation/private-content exclusions. Fifteen feeds had an attributed private-profile sample, and every such public profile query returned zero activity; Bounty entries had no Collector to test. The exhaustive creator query excluded all 104 private submission events and all 760 duplicate live approvals. Eight populated Squig projection samples exposed 39 public entries and zero private identity values. Known bot active events: zero.

Public HTTP checks passed: private Collector HTML 404, private activity HTML 404, private Collector share 404, populated Squig HTML 200. An initial blanket value detector flagged two wallet values in Squig HTML. Review proved both belong to that Squig's public Transfer ledger and neither links to a hidden Collector; this is the documented [provenance privacy policy](provenance.md). A requested private activity URL in its canonical metadata was likewise not evidence of disclosed profile data. The original detector outputs are retained privately; reviewed checks found zero hidden identity relationships or Discord IDs. No application privacy defect or code change was required. This does not complete OAuth/device/privacy-transition launch validation.

## Gate state

As of the final staging checks at approximately 2026-09-27T16:40Z:

| Environment | Launch state | VERIFIED | PENDING | PARTIAL | DEGRADED | FAILED | Blocking gates remaining |
| ----------- | ------------ | -------- | ------- | ------- | -------- | ------ | ------------------------ |
| staging     | BLOCKED      | 9        | 14      | 7       | 1        | 0      | 11                       |
| production  | NOT_READY    | 5        | 21      | 2       | 0        | 3      | 15                       |

ACTIVITY and DUPLICATE_REVIEW are now VERIFIED for this staging revision and available-source scope. ARCHIVE_RPC, START_BLOCK, OWNER_OF and BACKUP were revalidated with current evidence. Source integration gates remain PARTIAL because availability is not lifetime completeness. Progression, collections, replay, handoff and workers were not credited.

Identity preload dirtied 3,319 projections, so fresh launch verification truthfully moved MINT_COVERAGE and OWNERSHIP_CONTINUITY to PARTIAL (1,125 clean projections). The underlying ledger still has 11,052 Transfers, 4,444 mint rows, 4,444 complete stored provenance rows and 4,444 pinned owner matches, with cursor 26,068,941 unchanged. Those projection gates need normal identity/derivation processing in the next authorized stage; no chain rescan is indicated. REATTRIBUTION is DEGRADED with 284 queued jobs.

### Staging blockers

- `WORKERS`: PENDING.
- `RESTORE_DRILL`: PENDING.
- `MINT_COVERAGE`: PARTIAL.
- `OWNERSHIP_CONTINUITY`: PARTIAL.
- `REATTRIBUTION`: DEGRADED.
- `PROGRESSION`: PENDING.
- `COLLECTIONS`: PENDING.
- `DERIVED_REPLAY_STABLE`: PENDING.
- `HANDOFF`: PENDING.
- `PRIVACY_AUTH`: PENDING.
- `REAL_DEVICE_SHARE`: PENDING.

### Production blockers

- `WORKERS`: PENDING.
- `ARCHIVE_RPC`: PENDING.
- `START_BLOCK`: PENDING.
- `MINT_COVERAGE`: PENDING.
- `OWNERSHIP_CONTINUITY`: PENDING.
- `OWNER_OF`: PENDING.
- `REATTRIBUTION`: PENDING.
- `ACTIVITY`: PENDING.
- `DUPLICATE_REVIEW`: PENDING.
- `PROGRESSION`: PENDING.
- `COLLECTIONS`: PENDING.
- `DERIVED_REPLAY_STABLE`: PENDING.
- `HANDOFF`: PENDING.
- `PRIVACY_AUTH`: PENDING.
- `REAL_DEVICE_SHARE`: PENDING.

All eleven optional gates remain warnings in both environments: WALLET_LINKS, UGLYBOT, GAUNTLET, SURVIVAL, IMAGE_SUBMIT, IDENTITY_REVIEW, EXTERNAL_OG, CUSTOM_MANIFEST, EDITION_MANIFEST, EDITION_CONTRACTS and HOLDER_TIERS. Production received only a read-only launch report; its evidence and deployment were not changed. Staging `launch:check` correctly returned 1.

## Defects, validation and next authorization

No application normalization/privacy defect was found. No code fix, regression fixture, dependency change or coverage reduction was needed. Application revision remains `2ab0fc3`; this change commits safe aggregate documentation only. Operational archives, source identifiers, private evidence and connection material remain uncommitted.

- Initial release: PASS, 556 unit tests and 837 database/HTTP/browser assertions.
- Final release: PASS, 556 unit tests and 837 database/HTTP/browser assertions; completed 2026-09-27T16:55Z. Lint, formatting, type checking, catalog validation, build and disposable migration/privacy/browser checks passed.
- Final staging smoke: PASS, 10/10.
- Actual device/OAuth/external crawler tests in this task: none.
- Customs and Editions: zero, unchanged.
- Production launch: did not occur.

The next operator authorization should cover reviewing dated identity evidence and conflicts, normal downstream attribution/provenance derivation, then stable-input derived Replay A/B with refreshed projection gates. Source imports and their duplicate/privacy review are ready prerequisites; deployment launch remains blocked. Do not start reconciliation, replay, workers or production imports from this report alone.
