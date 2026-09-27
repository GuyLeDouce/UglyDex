# Phase 11 bounded staging source pilots

Date: 2026-09-27 UTC. Branch: `phase11-launch-evidence`.

This report covers bounded staging samples, not full source history. Each import
invocation uses the existing `ops.ts pilot` command with `--since
1970-01-01T00:00:00Z`, one keyset page, and at most 200 primary source rows. Parent
lookups enrich only those rows. Repeated invocations revisit the same bounded
samples to validate corrections and idempotency. All historical/reconciliation
cursors and completion flags must remain unchanged.

## Source prerequisites and scope

Eight physical PostgreSQL databases supply nine logical integrations through the
three staging HTTPS/HMAC bridges. The registry maps 26 required tables; 25 exist,
with all required columns present. Before each pilot, the operator checked the
configured bridge, authenticated reachability, logical integration/table mapping,
schema compatibility and effective read-only role. No source role, bot account or
upstream row was modified. Seven previous readers and the narrowly scoped
Gauntlet-main reader remain unchanged.

The existing staging-client bridge instances remain beside the source databases:
UglyBot bridge in Ugly Bot / production, and Gauntlet/image bridges in The Gauntlet
/ production. UglyDex web uses its staging environment. No production-client
bridge was created or configured. The HTTPS/HMAC/private-network transport model
and source-reader privileges are unchanged.

`onlineRewards` is **UNAVAILABLE_SOURCE_TABLE** because
`public.gauntlet_online_reward_events` does not exist. It was not piloted and is
not empty, passing, complete, or approved. Its absence does not disable `runs`.

| Feed               | Logical source              | Primary table                                                |
| ------------------ | --------------------------- | ------------------------------------------------------------ |
| duels              | uglybot / Team              | squig_duels; squig_duel_rounds enrichment                    |
| marketplace        | prizes                      | malformed_marketplace_purchases                              |
| purchases          | prizes                      | marketplace_purchases                                        |
| bounty             | prizes                      | bounty_submissions                                           |
| bountyEntries      | prizes                      | bounty_pool_entries                                          |
| bountyResults      | prizes                      | bounty_draw_results; bounty_submissions enrichment           |
| maw                | prizes                      | maw_return_sessions                                          |
| mawPrizes          | prizes                      | maw_squig_pool                                               |
| claimEvents        | claims                      | claim_events                                                 |
| runs               | gauntlet                    | gauntlet_runs                                                |
| survival           | survival                    | squig_survival_game_players; squig_survival_games enrichment |
| imageUses          | survival                    | squig_survival_image_uses                                    |
| submissions        | submissions / shared Images | squig_survival_image_submissions                             |
| liveImages         | images / shared Images      | squig_survival_images                                        |
| madlibPublications | prizes                      | madlib_publications                                          |
| madlibOperations   | prizes                      | madlib_operations                                            |

## Defects reproduced and corrected

1. The Duel sample contained 60 bot participant slots, including 56 completed
   Duels and 18 bot wins. These were incorrectly treated as Collector events.
   The normalizer now excludes only the explicitly configured, authoritative
   UglyBot application identity. Human wins/losses still follow persisted winner
   identity, and recorded wagers are not fabricated payouts. The normal importer
   retracts obsolete bot slots and retains correction/source evidence. No identity
   was merged by name, and no history was manually deleted with SQL.
2. General marketplace purchases lost their persisted `purchase_type`; all 200
   sampled rows were raffle purchases. That metadata is now retained. The shared
   public label is `Marketplace purchase`, rather than mislabeling general
   purchases as Malformed purchases. `spent_amount` is the persisted total cost;
   it is not multiplied by quantity again.
3. Claims lost persisted `nft_count`; the normalizer now retains it as metadata.
   A recorded claim remains a private observation, not a reconstructed balance or
   an additional confirmed payout ledger entry.
4. Runs and image-use pilots attempted a nonexistent `created_at` filter. They now
   use the registry's `finished_at` and `used_at`, respectively.
5. Survival players have no native event timestamp. A bounded player page is now
   enriched from parent games and date-filtered using `started_at`. Out-of-range
   rows are skipped without retracting previously imported events.
6. Maw-prize updated-time pagination rejected `updated_at` because the column is
   required rather than optional. Both declared cases are now supported.
7. Successful pilots replaced the validated schema fingerprint with a different
   hash format, immediately invalidating their approval evidence. Validation and
   import now share a deterministic fingerprint of registry-visible columns;
   pilot audits record the checked post-import fingerprint.

Four initial pilots (`mawPrizes`, `runs`, `survival`, `imageUses`) failed before
reading any primary rows. Those are operational failures, not rejected source
records. `purchases` and `claimEvents` were held after preview identified their
metadata omissions. Successful initial pilots retained their rows and cursors;
reruns use canonical updates, skips and retractions.

Sanitized regressions first reproduced five normalization/pagination failures and
both bot win/loss cases. Added coverage includes metadata retention, actual date
columns, required update cursors, parent-dated filtering, stable schema
fingerprints, unchanged pilot cursors, bot-slot correction and idempotent replay.
The public HTTP label assertion was updated to require the corrected label;
coverage was not removed.

## Review limits and financial meaning

The sample bounds deliberately exclude claims about lifetime completeness.
Missing optional details and states not represented in a sample are disclosed
per feed. No source was marked COMPLETE. Full imports, broad reconciliation,
progression/collection replay, worker enablement, production bridge deployment,
Customs/Editions and production launch remain outside this task.

Claims store the source's recorded amount, payout type and NFT count privately.
Upstream claim recording follows a successful transfer but its recorded quote may
differ from an adjusted payout; it is not counted again as confirmed $CHARM.
Creator reward points describe source metadata/eligibility, not proof of payment.
Only confirmed Mad Lib operations and explicitly persisted paid payout states
contribute their respective financial observations. No balances are reconstructed.

## Actual pilot results

Application and all three staging bridge services: `2ab0fc39a4ba7d392086d5d66597457ca326a751`. Production web remains `c764e28`. Baseline evidence was `a1cbb3e`; this report is committed separately from the application fix. All four staging deployments reported SUCCESS.

The corrected pass inspected **1889 primary rows**, with **1809 eligible rows** and **1919 normalized events**. Across initial and corrected passes, 1979 canonical activity rows are retained: **1919 active and 60 retracted**. None is full-history import evidence.

The following counters are the corrected pilot pass, not lifetime totals. Inserted/updated/skipped count events or correction slots; skipped also includes ignored source rows (15 Maw sessions and 65 Maw-prize pool rows). Consequently those columns need not sum to scanned or normalized. Rejected is the unresolved source-record rejection count, distinct from the four initial operational failures.

| Feed               | Scanned | Eligible | Normalized | Inserted | Updated | Skipped | Rejected | Unresolved | Collector-linked | Squig-linked |
| ------------------ | ------- | -------- | ---------- | -------- | ------- | ------- | -------- | ---------- | ---------------- | ------------ |
| duels              | 200     | 200      | 287        | 0        | 60      | 287     | 0        | 0          | 287              | 177          |
| marketplace        | 45      | 45       | 45         | 0        | 45      | 0       | 0        | 0          | 45               | 0            |
| purchases          | 200     | 200      | 202        | 202      | 0       | 0       | 0        | 0          | 202              | 0            |
| bounty             | 12      | 12       | 12         | 0        | 0       | 12      | 0        | 0          | 12               | 0            |
| bountyEntries      | 43      | 43       | 43         | 0        | 0       | 43      | 0        | 43         | 0                | 43           |
| bountyResults      | 6       | 6        | 6          | 0        | 0       | 6       | 0        | 0          | 6                | 6            |
| maw                | 81      | 66       | 87         | 0        | 0       | 102     | 0        | 0          | 87               | 87           |
| mawPrizes          | 66      | 1        | 1          | 1        | 0       | 65      | 0        | 0          | 1                | 1            |
| claimEvents        | 200     | 200      | 200        | 200      | 0       | 0       | 0        | 0          | 200              | 0            |
| runs               | 200     | 200      | 200        | 200      | 0       | 0       | 0        | 0          | 200              | 0            |
| survival           | 200     | 200      | 200        | 200      | 0       | 0       | 0        | 0          | 200              | 0            |
| imageUses          | 200     | 200      | 200        | 200      | 0       | 0       | 0        | 0          | 200              | 0            |
| submissions        | 200     | 200      | 200        | 0        | 0       | 200     | 0        | 0          | 200              | 0            |
| liveImages         | 200     | 200      | 200        | 0        | 0       | 200     | 0        | 0          | 200              | 0            |
| madlibPublications | 13      | 13       | 13         | 0        | 13      | 0       | 0        | 0          | 13               | 0            |
| madlibOperations   | 23      | 23       | 23         | 0        | 0       | 23      | 0        | 0          | 23               | 0            |

All 16 corrected pilots returned exit 0, preserved historical and reconciliation cursors/completion, and retained matching validation/import/approval schema fingerprints. All 16 feed states are PARTIAL with PILOT_RANGE, never COMPLETE.

### Observed event times and updates

Timestamps below are UTC normalized event times. Updated-source rows means updated_at was later than created_at in the bounded source sample; it does not alone prove a semantic correction.

| Feed               | Earliest event (UTC)     | Latest event (UTC)       | Source rows updated after creation | Stored correction records |
| ------------------ | ------------------------ | ------------------------ | ---------------------------------- | ------------------------- |
| duels              | 2026-04-25T17:42:33.607Z | 2026-07-10T13:28:44.907Z | 192                                | 60                        |
| marketplace        | 2026-07-06T13:57:12.688Z | 2026-09-19T09:04:39.208Z | 45                                 | 45                        |
| purchases          | 2026-04-08T20:22:23.235Z | 2026-07-12T00:53:59.550Z | 0                                  | 0                         |
| bounty             | 2026-08-27T14:11:12.911Z | 2026-09-17T15:01:22.185Z | 12                                 | 0                         |
| bountyEntries      | 2026-08-26T14:14:52.481Z | 2026-09-27T01:15:17.845Z | 0                                  | 0                         |
| bountyResults      | 2026-08-31T20:00:37.155Z | 2026-08-31T20:01:00.585Z | 0                                  | 0                         |
| maw                | 2026-07-10T02:20:36.232Z | 2026-08-17T14:43:28.344Z | 81                                 | 0                         |
| mawPrizes          | 2026-07-10T09:48:47.646Z | 2026-07-10T09:48:47.646Z | 0                                  | 0                         |
| claimEvents        | 2026-03-01T15:02:27.953Z | 2026-04-09T05:23:37.591Z | 0                                  | 0                         |
| runs               | 2025-11-23T16:23:27.492Z | 2026-03-03T20:18:21.510Z | 0                                  | 0                         |
| survival           | 2026-02-14T22:25:19.554Z | 2026-02-22T15:57:36.675Z | 0                                  | 0                         |
| imageUses          | 2026-02-14T22:57:08.529Z | 2026-03-11T00:31:22.024Z | 0                                  | 0                         |
| submissions        | 2026-04-11T22:50:13.777Z | 2026-06-28T02:28:26.317Z | 0                                  | 0                         |
| liveImages         | 2026-02-14T23:12:43.482Z | 2026-04-06T17:35:46.830Z | 0                                  | 0                         |
| madlibPublications | 2026-09-13T03:30:28.331Z | 2026-09-19T17:33:46.285Z | 13                                 | 14                        |
| madlibOperations   | 2026-09-13T03:19:32.588Z | 2026-09-17T01:53:10.837Z | 23                                 | 0                         |

The 60 Duel corrections changed only recordStatus to RETRACTED. The 45 marketplace corrections add the explicit null purchaseType metadata for the Malformed feed. Fourteen Mad Lib publication corrections changed only sourceUpdatedAt. No manual history deletion or upstream edit was used.

### Final bounded repeat

The repeat scanned the same 1889 primary-row sample sizes, inserted **0** events, and had **0** failures. Fifteen feeds had zero updates. madlibPublications had **one** upstream sourceUpdatedAt-only update; its content, eventAt, actor and public meaning were unchanged. There were zero new canonical events and zero unexplained semantic changes. This is pilot idempotency evidence, not derived Replay A/B evidence.

## Individual semantic decisions

### duels: APPROVED_WITH_WARNING

107 completed, 83 cancelled, nine setup and one awaiting acceptance. After excluding the authoritative bot: 158 public completed human events and 129 private entries/cancellations. Explicit source tokens only (177 events); 110 human events have no Squig link. Winner/loser, participant, wager and timestamp checks passed. No payout inferred. Bot configuration is required for subsequent imports.

### marketplace: APPROVED_WITH_WARNING

43 delivered and two paid-pending-delivery purchases. Price and actor checks passed; no Squig inferred from names or URLs. All 43 delivered rows have delivery timestamps; eventAt deliberately remains source creation time, not delivery time. No reserved row was present in this bounded sample; reservation privacy/financial exclusion remains covered by fixtures.

### purchases: APPROVED_WITH_WARNING

200 persisted raffle purchases plus two distinct refund slots. Persisted total spend, quantity, purchase type and refund amount/time checked. Refunds retain their source identity and direction; purchase type is purchase metadata, not duplicated into the refund slot. Potential overlap with Malformed purchases still needs historical review.

### bounty: APPROVED_WITH_WARNING

Ten vaulted, one drawn-pending-delivery and one expired submission. Eleven accepted/public events and one unaccepted/private event. Donor, status and persisted votes retained. Donated NFT identity stays external; zero Reloaded links and zero inferred payout amounts. A rejected submission was not represented.

### bountyEntries: APPROVED_WITH_WARNING

42 active and one removed entry. All 43 exact Ethereum/Reloaded contract-token entries link to Squigs. All 43 remain unattributed to a Collector: added_by is not ownership evidence. Month/status retained; the removed entry is private. No forced attribution.

### bountyResults: APPROVED_FOR_FULL_IMPORT

One NFT prize and five CHARM prizes. All six winning entry tokens are distinct in meaning from the prize NFT token; all six link only through the winning Reloaded contract/token. The five paid CHARM outcomes carry persisted payouts. Winner and delivery/payout-state review passed; NFT delivery timestamp is not fabricated.

### maw: APPROVED_WITH_WARNING

81 sessions; 66 with receipt evidence produce 66 feed events plus 21 source-verified burn events. Fifteen unreceived sessions are ignored. One says session status paid but has neither received_at nor paid payout_status; neither receipt nor payout is inferred from that status. Paid payout amounts, explicit contract/token, rarity/rank/disposition and receipt basis checked. Swallowed alone does not create a burn event; burn timestamp and transaction evidence are required.

### mawPrizes: APPROVED_WITH_WARNING

One delivered prize retained; 44 available and 21 digested pool rows produce no receipt event. Recipient and explicit Reloaded token checked. EventAt is the persisted last source update, not an exact delivery timestamp. Recorded transaction/rarity retained; no ownership inferred from an offer.

### claimEvents: APPROVED_WITH_WARNING

200 private recorded claim observations retain amount, nft_count and payout type. Discord attribution is explicit. No additional financial amount/currency ledger entry and no balance reconstruction. See the recorded-quote limitation above.

### runs: APPROVED_WITH_WARNING

200 completed-run rows with user, score and finished_at. The live table lacks optional result_type, final_round and max_greed_level columns; these details are unavailable, not invented. The unavailable online reward table was not read or piloted.

### survival: APPROVED_WITH_WARNING

200 player rows use their exact parent game started_at. Placement, eliminations, deaths and images-used checks passed. 42 placed/public and 158 null-placement/private events; zero Squig links. No finished_at invented.

### imageUses: APPROVED_FOR_FULL_IMPORT

200 participant-attributed uses at used_at, retained as DETAIL events. Image URLs are assets, never Squig identities. No creator identity or reward inferred from use rows.

### submissions: APPROVED_WITH_WARNING

132 approved/public and 68 declined/private rows; no pending row in this sample. Creator and reviewed/submitted time basis checked. Declined image URLs are excluded; moderator/reviewer notes and free-form NFT text are not public projections. Reward points/milestones remain metadata, not confirmed CHARM payments.

### liveImages: APPROVED_WITH_WARNING

200 approved live images retain creator, creation date and available milestone metadata. No payout or Squig inference. No overlapping approval pair appeared in these bounded windows; the existing submission-authority rule remains in place. Historical overlap must still be audited.

### madlibPublications: APPROVED_WITH_WARNING

13 published public records; private answers/story content are excluded. No suspended record appeared in the sample. Thirteen sourceUpdatedAt-only corrections occurred on the corrected pass and one more on the repeat; stored semantic fields did not change. This is an observed upstream clock refresh, not a duplicate event.

### madlibOperations: APPROVED_WITH_WARNING

23 private operations: nine debits and 14 rewards; 20 confirmed_success and three confirmed_failure. Only the 20 successful operations carry recorded amounts and the corresponding spend/earn direction. No prepared, pending or refund operation appeared; those remain fixture-covered/limited real-state coverage.

All decisions are recorded separately as PILOT_APPROVED plus PILOT_SEMANTIC_REVIEW audits, tied to the source run, preview input hash, schema fingerprint, staging environment and application commit. The semantic review explicitly records that a full historical import is not yet authorized.

## Preliminary duplicate observations

The bounded review found zero same-actor/same-amount candidates within one minute across marketplace/purchases, Bounty-result/claim, Maw/claim and Mad Lib-operation/claim pairs. It also found zero matching ImageSubmit/live-image approval pairs. These are narrow candidate checks, not a clean historical duplicate audit: several sampled date windows do not overlap.

Real patterns that the full-import review must preserve:

- General marketplace rows are raffle purchases, while the Malformed feed has item purchases; two refunds are separate corrective facts, not second spends.
- Claims carry recorded quote observations privately and must not add a second payout beside a Bounty, Maw or other payment record.
- Mad Lib debit/reward operations have their own canonical source slots; unconfirmed states do not carry tracked amounts.
- Submission and live-image approvals can describe the same contribution. Existing submission authority suppresses duplicate public approval projection without deleting source evidence.
- Creator reward-point metadata is not a payment and must not be added to an observed currency payout.

DUPLICATE_REVIEW remains PENDING. No historical cross-source deduplication or deletion was performed.

## Attribution and privacy

1876 active pilot events resolve by exact Discord external identity. Current-wallet-only resolutions: **0**; historical-wallet resolutions: **0**; conflicting pilot events: **0**. The **43** unresolved Bounty-entry events remain Squig-linked and excluded from Collector claims. There was no username/display-name matching and no broad reconciliation.

Staging now stores **123 Collectors** and **121 Discord identities**. These are storage counts, not verified human/active-user counts; the bot identity stub created by the initial defective pilot is retained with its retracted evidence. The existing **1 queued attribution job** remains untouched.

All 1919 active normalized/persisted pilot projections were checked against their source identity values and the explicit public DTO field allowlist. **Zero leaks found.** A representative private Collector per linked feed (15 feed cases) returned **zero public activity entries**. Bounty entries have no Collector to use for that check.

Public projections exclude raw Discord IDs, wallet relationships, source/database row IDs, internal provider identifiers, attribution/reconciliation evidence, moderation notes and private Mad Lib content. Declined submission details/image URLs remain private or omitted. Approved image assets and explicitly public transaction references retain their intended public meaning. Operational source IDs remain internal. These checks do not substitute for authenticated privacy-transition, OAuth, physical-device or external-crawler gates.

## Validation and retained provenance

`npm run release:check` **PASS**: **556 unit tests** (baseline 547) and **837 database/HTTP/browser assertions** (baseline 830). Added nine unit regressions and seven database assertions; all existing direct-PostgreSQL tests remain. The focused disposable bridge test also passed 23 assertions, overlapping the full suite. Initial test-fixture mismatches were corrected; the final complete suite passed. Local fixture replays were part of that required suite; no staging or production progression/collection replay ran.

Deployed staging smoke: **10/10 PASS**, covering home, health/readiness, explorer, known Squig, invalid Squig/Collector, unauthenticated admin denial and PNG share output. This is application smoke, not new device/OAuth/third-party OG evidence.

The chain ledger was neither reset nor rescanned: cursor **26,068,941**, Transfers **11052**, mints **4444**, complete clean provenance rows **4444**, retained ownerOf matches **4444**, dirty rows **0**. The earlier zero-anomaly evidence remains retained. No new ownerOf/archive scan is claimed. Worker controls remain absent/default DISABLED; no worker was enabled. Customs/Editions remain outside this task.

## Launch state

| Environment | Decision  | VERIFIED | PENDING | PARTIAL | DEGRADED | FAILED | Blockers |
| ----------- | --------- | -------- | ------- | ------- | -------- | ------ | -------- |
| staging     | BLOCKED   | 5        | 19      | 6       | 1        | 0      | 15       |
| production  | NOT_READY | 5        | 21      | 2       | 0        | 3      | 15       |

Staging launch:check returned nonzero as required. The UglyDex production environment was read-only in this task: no deployment, bridge provisioning, source import or gate rewrite. No blocking launch gate was closed by pilots alone. ACTIVITY is PARTIAL; full-import and downstream requirements remain unmet.

The new staging commit makes the earlier ARCHIVE_RPC, START_BLOCK and OWNER_OF gate records PENDING under the existing exact-commit policy. Their historical records and successful pinned-chain evidence are retained, not erased or contradicted. Database/migrations, stored mint coverage/continuity and web smoke were revalidated on this commit. An authorized later launch-validation pass must revalidate the three revision-bound gates without resetting completed chain history.

Exact staging blockers: `WORKERS` (PENDING), `BACKUP` (PENDING), `RESTORE_DRILL` (PENDING), `ARCHIVE_RPC` (PENDING), `START_BLOCK` (PENDING), `OWNER_OF` (PENDING), `REATTRIBUTION` (DEGRADED), `ACTIVITY` (PARTIAL), `DUPLICATE_REVIEW` (PENDING), `PROGRESSION` (PENDING), `COLLECTIONS` (PENDING), `DERIVED_REPLAY_STABLE` (PENDING), `HANDOFF` (PENDING), `PRIVACY_AUTH` (PENDING), `REAL_DEVICE_SHARE` (PENDING).

Exact production blockers: `WORKERS` (PENDING), `ARCHIVE_RPC` (PENDING), `START_BLOCK` (PENDING), `MINT_COVERAGE` (PENDING), `OWNERSHIP_CONTINUITY` (PENDING), `OWNER_OF` (PENDING), `REATTRIBUTION` (PENDING), `ACTIVITY` (PENDING), `DUPLICATE_REVIEW` (PENDING), `PROGRESSION` (PENDING), `COLLECTIONS` (PENDING), `DERIVED_REPLAY_STABLE` (PENDING), `HANDOFF` (PENDING), `PRIVACY_AUTH` (PENDING), `REAL_DEVICE_SHARE` (PENDING).

Unresolved optional keys in both environments: `WALLET_LINKS`, `UGLYBOT`, `GAUNTLET`, `SURVIVAL`, `IMAGE_SUBMIT`, `IDENTITY_REVIEW`, `EXTERNAL_OG`, `CUSTOM_MANIFEST`, `EDITION_MANIFEST`, `EDITION_CONTRACTS`, `HOLDER_TIERS`. Production source failures remain actual production failures; staging bridge results were not substituted for them.

## Evidence retention

Safe aggregate operator outputs are ignored local artifacts; live pilot import/preview/approval/correction audits remain in staging. No raw private source rows, credentials, backups or identity exports are committed. SHA-256 references:

| Aggregate artifact    | SHA-256                                                          |
| --------------------- | ---------------------------------------------------------------- |
| run-final.jsonl       | 94ea846a8ada297f7d5d5fe79f75e62ba0e446e5aac5a5621e103834fd4a393b |
| run-idempotent.jsonl  | bf3e73cbb02e8088249e762a3995fd6ead682823a17e819d8ccb20e94131236f |
| review-checked.jsonl  | 93d3042f7d3f55ad97d33aa296a84309f07f7c1a03d388abd55a68ec7365ee9b |
| stored-review.jsonl   | 1305258283ef09a8ca8f437e9658666f56bc81beae36ae9f962055a858d26e62 |
| approvals-final.jsonl | e436171f5fcb459fd6ad0b5df89afc596ce7eafaf790ab98ec85886d9f4f0ffa |
| edges.jsonl           | 8a202e51591e1d5f7ac2167eb8687f4c6a03a26161144b8f03d8ae094183b61b |
| staging-final.txt     | a141300bda3ac551a1b7fee9dec5f7ef966cfa01c057864cfaa93c46757a01a9 |
| production-final.json | 23e980bd4113ab664e9a079c7bec3be70597d045b0d11aea3cd1c2ff5b929bd5 |
| release-complete.txt  | 9d3150934360b8c14f06fb4d1fa58957d34fc6483cb33b92bfd66d4981f2bda7 |

## Recommendation

**READY_FOR_FULL_SOURCE_IMPORTS — staging, limited to the 16 reviewed available feeds.** Two are APPROVED_FOR_FULL_IMPORT and fourteen are APPROVED_WITH_WARNING as listed above. **Blocked available feeds: 0. Unavailable feeds: onlineRewards only.**

This is a recommendation for the next explicit operator decision, not authorization already exercised. No full historical source import occurred. If approved next, preserve feed-specific partial-history labels, source IDs and correction evidence; stop on new normalization/privacy/attribution defects; perform the full duplicate audit before reconciliation/replay and worker handoff. Keep onlineRewards excluded until legitimate upstream source evidence exists. Production remains unlaunched and engagement work is not recommended.
