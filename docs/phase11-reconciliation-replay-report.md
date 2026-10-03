# Phase 11 staging reconciliation and derived replay

Date: 2026-09-27 UTC. Branch: `phase11-launch-evidence`.
Application revision: `2ab0fc39a4ba7d392086d5d66597457ca326a751`.
Starting evidence revision: `195b213`.

This report records the completed authorized staging batch execution.
No production mutation, worker enablement, historical-to-live handoff, restore
drill, Customs/Edition import, engagement feature or ruleset change is authorized
or claimed by this stage.

## Preconditions and private backup

The branch started clean. Staging reported the intended application revision,
11,052 immutable Transfers and cursor 26,068,941. All ten initial staging smoke
checks passed. All 16 stored source semantic fingerprints matched their completed
full-import repeat evidence; no source import was active. Coverage remains
SOURCE_EXHAUSTED / PARTIAL with TRACKED_AVAILABLE_HISTORY_NOT_LIFETIME.
`onlineRewards` remains UNAVAILABLE_SOURCE_TABLE.

Pre-reconciliation backup: 2026-09-27T17:43:17Z; 10,102,245 bytes;
SHA-256 `f3355a087ed9d02e12005cbe478fbaa479d3a1c35417dd8a478501ebee35d577`.
Custom-format pg_dump and all 79 public-table inventories share one exported
repeatable-read snapshot. The private local archive hash matches the database-side
hash; pg_restore archive listing succeeded. No restore ran.

## Identity evidence policy

All 284 historical review cases were inspected against exact canonical
wallet-link evidence, exact Discord ExternalIdentity, attribution intervals,
other wallet links and competing Collector evidence. No username, nickname,
display-name, current-token-owner or address-similarity matching was used.

The reviewed source implementation at UglyBot revision
`a693d46c4a8ccaf663d8b308dee0a7578e1268e6` permits links to be created unverified
and updates `updated_at` when verification changes. Therefore `created_at` alone
does not prove verified historical association. A deterministic confirmation uses
the verified canonical row's `sourceUpdatedAt` as its conservative effective
start. Earlier periods remain unsupported. This is legacy association evidence,
not a new wallet signature or login credential.

The initial inspection found 283 cases without competing attribution and one
case overlapping another Collector's signed evidence. The latter requires owner
review and must remain unresolved; the legacy record cannot override it.

The normal reconciliation service recorded 283 CONFIRM and one UNRESOLVED
decision, preserving before/after evidence, timestamps and effective intervals.
Of the confirmations, 282 moved the effective start forward from creation to
the last recorded verified source state; one already had matching timestamps.
No case was rejected, manually adjudicated or split. The normal attribution
processor evaluated all 284 wallet jobs in 29 bounded batches and removed only
completed jobs through its existing generation-checked completion path. Zero
jobs remained. The open identity case remains PENDING independently of the
completed processing queue.

The service's existing confidence value is `ADMIN_REVIEWED`; these decisions'
actor and reasons explicitly identify deterministic CLI evidence review. That
storage label is not a claim that a human adjudicated the cases.

Sanitized owner-review case: `d41dd5c7046a7f35f333ed575e9c06aa13216b56a98e5e971f7626372729badc`
(hash of the internal case identifier). Reason: overlapping claims to different
Collectors. Evidence: canonical legacy wallet link versus signed UglyDex wallet
evidence. Legacy candidate interval: 2026-07-14T15:11:54.961Z onward, with no
asserted end. Conflict category: SIGNED_VS_LEGACY. Dated historical-control
evidence and owner review are required; neither claim is silently merged.

## Provenance

The existing derivation service processed all 3,319 dirty projections under the
chain lock. Dirty after: zero. Wallet periods: 11,003. Collector periods: 2,604.
Confirmed discoveries: 2,600. Transfer count remained 11,052 and its semantic
SHA-256 remained `9aa68fd90cfbcf3ac86aae2b8c36dbd52d03e193eb7aed0a189c36d9788748d8`.

Fresh pinned verification checked all 4,444 tokens, found 4,444 mints and 4,444
ownerOf matches, with zero unavailable reads, missing metadata or anomalies.
Cursor remained 26,068,941 and start block remained 25,342,921. No historical
chain rescan, raw Transfer replacement or cursor reset occurred. Normal current
revision checks restored MINT_COVERAGE and OWNERSHIP_CONTINUITY to VERIFIED.

## Replay scope and freeze

Method B: UglyDex source synchronization stays disabled. Upstream bots continue
independently. No imports or identity decisions occur between Replay A and B.
The normal baseline rebuild is separate from the measured Replay A/B pair.
The existing ReplayProof implementation supplies input and derived fingerprints,
guards workers with advisory locks, and rejects changing inputs.

Rulesets remain `uglydex-progression-v1` and `uglydex-collection-v1`. Completion
remains 40% Squig Discovery, 35% Trait Discovery and 25% visible Historical Set
Completion. Current holdings remain separate from permanent historical discovery.

## Execution results

The baseline evaluated 377 Collectors and 4,444 Squigs, followed by all 377
Collector collections. Input fingerprints did not change during the baseline.
Normal read-only verification recomputed all 4,821 progression subjects and all
collection results with zero discrepancies. Attribution, progression and
collection queues were empty, with no evaluation errors. This baseline was not
counted as Replay A.

### Identity and provenance outcomes

Final historical evidence: 283 REVIEWED, two VERIFIED and one UNCONFIRMED.
Derivation also created one normal OVERLAPPING_ATTRIBUTION review case for the
same unresolved wallet conflict. Thus 285 cases exist: 283 RESOLVED and two
PENDING views of one conflicting evidence relationship. Decisions remain 283
CONFIRM and one UNRESOLVED. No automated account merge or authentication grant
occurred. IDENTITY_REVIEW remains an optional warning.

There are 8,399 wallet periods with no overlapping Collector attribution and
2,548 additional wallet periods with an uncovered portion. These are counts of
chain wallet periods, not missing Transfers or invented identities. There are
313 distinct projections whose historical wallet periods intersect the remaining
unconfirmed evidence. All are clean chain projections; uncertain Collector
segments remain withheld. Discovery storage retains 266 INVALIDATED historical-discovery rows for
audit in addition to the 2,600 confirmed discoveries used by collections.

### Activity

| Measure                       |  Count |
| ----------------------------- | -----: |
| Active activities             | 32,340 |
| Collector-linked              | 32,297 |
| Squig-linked                  |  3,271 |
| Unattributed                  |     43 |
| Conflicting active activities |      0 |
| Retracted                     |     60 |

Collector and Squig linkage overlap; they are not mutually exclusive counts.
The source-import population remains 29,460 active slots. The total now includes
2,880 derived provenance timeline events, an increase of 2,614 over the prior
266-event projection. The 43 Bounty
entries remain Squig-only; neither `added_by` nor current token ownership supplied
a Collector identity.

### Progression

| Measure                                                                      |           Count |
| ---------------------------------------------------------------------------- | --------------: |
| Collectors evaluated / CollectorProgress rows                                |             377 |
| Squigs evaluated / SquigProgress rows                                        |           4,444 |
| Active XP ledger entries                                                     |          13,058 |
| Collector XP entries / total XP                                              | 8,148 / 210,300 |
| Squig XP entries / total XP                                                  |  4,910 / 94,805 |
| Revoked XP entries / XP revocation audit records                             |           0 / 0 |
| Active Collector achievements                                                |           1,349 |
| Active Squig achievements                                                    |           6,104 |
| Collector achievement evaluation rows                                        |          16,211 |
| Squig achievement evaluation rows                                            |          97,768 |
| Previously awarded achievements now revoked                                  |               0 |
| Title unlocks across subjects                                                |             312 |
| Progression milestones                                                       |             551 |
| Evaluation errors / queued jobs                                              |           0 / 0 |
| Unattributed / conflicting / retracted activities excluded from Collector XP |     43 / 0 / 60 |

Completeness-gated achievements not awarded: zero. V1 has no achievement
definition requiring COMPLETE source history; its existing completeness-gate
primitive remains enforced and source exhaustion remains PARTIAL. This zero
does not assert lifetime completeness. Locked, never-awarded achievement rows
are not reported as revoked historical awards. XP is progression evidence, not
financial value.

### Collections and cosmetics

| Measure                                                            |     Count |
| ------------------------------------------------------------------ | --------: |
| Collectors evaluated                                               |       377 |
| Confirmed Squig discoveries                                        |     2,600 |
| Active trait discoveries                                           |     8,692 |
| Historical set-progress rows                                       |    14,703 |
| Historical sets currently completed                                |       917 |
| Current-holding sets completed                                     |        13 |
| Hidden sets revealed                                               |         3 |
| Completion snapshots                                               |       377 |
| Active collection milestones                                       |     9,958 |
| Revoked collection milestones                                      |         0 |
| Invalid collection evaluations / evaluation failures / queued jobs | 0 / 0 / 0 |
| Unconfirmed historical evidence records excluded                   |         1 |

The existing cosmetic engine computes eligibility on demand. Eligible
Collector/cosmetic pairs are 4,524 FREE, 241 ACHIEVEMENT, 378 SET, one OG and one
LEGENDARY. Persisted CosmeticEntitlement rows generated by these rebuilds: zero;
the existing model materializes these only when an owner saves appearance.
No synthetic appearance preferences or entitlement rows were inserted. The
achievement and collection eligibility functions, including pending-job and
revocation checks, were evaluated for every Collector.

## Real staging Replay A/B

ReplayProof run: `ffbb9b1e-df99-4e34-8daf-05f22a881344`. Status: **VERIFIED**.

- Input fingerprint A: `967c15d21558d4aadde4c612043de08bb5a31bf2d8aec25ab5c5e6c7f3d21ed7`.
- Input fingerprint B: `967c15d21558d4aadde4c612043de08bb5a31bf2d8aec25ab5c5e6c7f3d21ed7`.
- Baseline, A-start, between A/B and B-end inputs matched.
- Semantic differing tables: **0**.

| Derived table           | Rows A | Rows B | SHA-256 A                                                          | SHA-256 B                                                          |
| ----------------------- | -----: | -----: | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| CollectorProgress       |    377 |    377 | `94491a6fbf1d15d97ffed3dbdd2e08a129ce3ce78c0e53257fc48f9d543b1c7c` | `94491a6fbf1d15d97ffed3dbdd2e08a129ce3ce78c0e53257fc48f9d543b1c7c` |
| SquigProgress           |   4444 |   4444 | `659eea58f070645310ed6d07313c4df416146961288ad62197107957f02f3848` | `659eea58f070645310ed6d07313c4df416146961288ad62197107957f02f3848` |
| XpLedgerEntry           |  13058 |  13058 | `b46010ccd5d96afe9220190c1de88792c7f93cf3c97e5fac2c1daedf097cee98` | `b46010ccd5d96afe9220190c1de88792c7f93cf3c97e5fac2c1daedf097cee98` |
| CollectorAchievement    |  16211 |  16211 | `fc3f157ad4c31f02a5dedfb9d064482adb1492b490401f0e4ce43c47b46a25b5` | `fc3f157ad4c31f02a5dedfb9d064482adb1492b490401f0e4ce43c47b46a25b5` |
| SquigAchievement        |  97768 |  97768 | `1ef48cc13c97f31887654855275bdca699cd62992c3acbc4a4e91d0bc9e988f5` | `1ef48cc13c97f31887654855275bdca699cd62992c3acbc4a4e91d0bc9e988f5` |
| ProgressionMilestone    |    551 |    551 | `98606b3c43a59ded78140f90c2cef2ddc21256656d8d4c27252e6d8d7d1df512` | `98606b3c43a59ded78140f90c2cef2ddc21256656d8d4c27252e6d8d7d1df512` |
| SquigDiscovery          |   2866 |   2866 | `a6951da94b6cb0959725355f88779460ead13bdfb18b8b7e2a0cad39da5518ae` | `a6951da94b6cb0959725355f88779460ead13bdfb18b8b7e2a0cad39da5518ae` |
| CollectorTraitDiscovery |   8692 |   8692 | `46b1692adfa142ac1cc5aaa038f36b021b13490fe9ff98ff77ff17329a538196` | `46b1692adfa142ac1cc5aaa038f36b021b13490fe9ff98ff77ff17329a538196` |
| CollectorSetProgress    |  19604 |  19604 | `2c63ef7666e47ac1ebc58e51bca597232d498660cec3a9f99de4281b4c0a5ec6` | `2c63ef7666e47ac1ebc58e51bca597232d498660cec3a9f99de4281b4c0a5ec6` |
| CollectionSnapshot      |    377 |    377 | `fd3cbaee67b33ce017049032f943327668ef6fd53e3037d7317998da68c5af72` | `fd3cbaee67b33ce017049032f943327668ef6fd53e3037d7317998da68c5af72` |
| CollectionMilestone     |   9958 |   9958 | `35bb9210d164545cd23812ab5e6c899b9552bb254e177d1f8795acee1cccaafa` | `35bb9210d164545cd23812ab5e6c899b9552bb254e177d1f8795acee1cccaafa` |

There were zero duplicate XP grants, unexplained achievement/discovery/set/completion changes, duplicate milestones or unexplained entitlement changes. Existing primary/composite uniqueness constraints and the matching complete semantic table fingerprints cover the persisted derived scope. Supplemental hashes of reconciliation decisions, review cases and stored cosmetic entitlements also matched; all-Collector cosmetic eligibility matched before and after the pair. Titles are projections of the included achievement state. No unexplained difference was excluded or manually edited.

### Frozen inputs and rulesets

| Input table                   |  Rows | SHA-256                                                            |
| ----------------------------- | ----: | ------------------------------------------------------------------ |
| Collector                     |   377 | `9e642255272ea523340365bebf308e142a950655eedbcac5993fdf35772e8641` |
| ExternalIdentity              |   375 | `dfe1b13eefdbb8aab28662c8457cf44ea522e1ff1c00cd4f775b06c86eb3707f` |
| CollectorWallet               |     2 | `7758f5d3ecc78db6677d34fa4fd8c2c7ae9816e1e16780b7efbab927f89c50a4` |
| HistoricalIdentityAttribution |   286 | `f5a1ba6be4e3233da878d25276ae34694bd84aabe2eb48dba069f2c3269c2652` |
| CollectorOwnershipPeriod      |  2604 | `5c92c30053c1562bbfadfca62ae51febac6fe2b2a0a8c27a0647eda4d1464a14` |
| NftTransfer                   | 11052 | `9aa68fd90cfbcf3ac86aae2b8c36dbd52d03e193eb7aed0a189c36d9788748d8` |
| SquigProvenance               |  4444 | `05ed9ea84a67b7862bcfd0fd91813544f833902a6fc3ef6d94fa57878c2a2edf` |
| SquigOwnership                |  7264 | `69af5c75197ae18832bb2f34014fd5a83984dc60e411a847859d2d87fe3b51dc` |
| Squig                         |  4444 | `8b345e5dfdf49cf83c30a918d5967803dd0ecf1ca87f67bab3eea5ffdc9019bf` |
| SquigTrait                    | 44440 | `4afb9741d9bbdbd932ed71ed64d4843d2a4c5d167896740b6c2f23b926591b77` |
| CollectorActivity             | 32400 | `58393820b510f2194b0930ce38e7b0b00c5d29e341ddf15af6d5afad7fbe6fd9` |
| IntegrationSource             |    17 | `ac6eaaa4117d9a0dab85cb617df31356496f27d56bd104c3e18b0d51f462d969` |
| ProgressionRuleset            |     1 | `04eb87c3edd95874ec224949aabfd5d1a12231491e9f0cfa6d84425d56e8742f` |
| CollectionRuleset             |     1 | `8e4ddedf18fc7bb66ad37d0f76d8060e3a45ebacd403626849d353e60553d817` |
| AchievementDefinition         |    65 | `312fdb054f7d05f06642359c4f517b49ed118e2a559dcb934874670ad3c298af` |
| CollectionSetDefinition       |    52 | `a8960623ae7790457bce47270fe93cb405f072525d1635c73f145f09598732dd` |
| CollectionSetRequirement      |    81 | `312ac4a83d79b9dd7349b74888df2c70682db2e59b54e2a0e083a6ee591f3365` |
| CosmeticDefinition            |    17 | `37e415220c540864414a2399562c1b0c5784958e394f743e3b21e0ee47323a3c` |
| CollectorCosmeticPreference   |     0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

Ruleset `uglydex-progression-v1`: configuration fingerprint `31587ed34d35f222e42a55e6870af23a6c73770816af2674c59597d57d2040f2`.

Ruleset `uglydex-collection-v1`: configuration fingerprint `25fbb6d64d961f8b1ca38f4e3b3f90038626cffc23858ae00f63e7001501b573`.

Supplemental decisions hash: `644e7c88374603bab6d0b71305b2dace48e603ac89a0e43be45eda4db83ab33e`; review-cases hash: `eb013bcf259d14a12248ab645f6d4c46158b4558e65662b9e329275382dd33a0`; stored-entitlements hash: `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`; cosmetic availability hash: `2ae5de04f921658eb27ca66ff7f8f77cb4496cfb98057db546658f1b2806437d`.

### Exact existing hash exclusions

Derived exclusions: CollectorProgress and SquigProgress omit `calculatedAt`; XpLedgerEntry omits `createdAt`; CollectorAchievement and SquigAchievement omit `evaluatedAt`; SquigDiscovery omits its surrogate `id`; CollectorSetProgress and CollectionSnapshot omit `calculatedAt`. ProgressionMilestone, CollectorTraitDiscovery and CollectionMilestone omit no fields. Award, acquisition, revocation, completion and milestone dates remain semantic.

Input exclusions: Collector, ExternalIdentity, CollectorWallet and Squig omit `updatedAt`; HistoricalIdentityAttribution omits `createdAt` and `reviewedAt`; NftTransfer omits `indexedAt`; SquigProvenance omits `updatedAt` and `verifiedAt`; CollectorActivity omits `importedAt` and `updatedAt`; IntegrationSource omits `updatedAt`, `lastAttemptAt` and `lastSuccessAt`; ProgressionRuleset and CollectionRuleset omit `createdAt`; CollectorCosmeticPreference omits `updatedAt`. The other input tables above omit no fields.

SyncRun, worker timestamps, queue checkpoints and audit-run identifiers are outside the existing semantic table scope. CosmeticEntitlement is outside the eleven-table ReplayProof scope because rebuilds do not materialize it; its unchanged full rows and live eligibility were checked separately without replacing or weakening ReplayProof. Wallet-link evidence was additionally fingerprinted before the baseline. No fingerprint policy was changed.

## Final gates and stage decision

**READY_FOR_HANDOFF_WORKERS_AND_POPULATED_RESTORE** for the next separately authorized stage. This is not production launch approval or authorization to execute that next stage.

Staging launch decision: **NOT_READY**. Gate counts: {"VERIFIED":15,"PENDING":11,"PARTIAL":5}; 15 blocking gates verified, 5 blockers remaining.

Closed by current-revision evidence: MINT_COVERAGE, OWNERSHIP_CONTINUITY, REATTRIBUTION, PROGRESSION, COLLECTIONS and DERIVED_REPLAY_STABLE. Normal provenance verification supplied the first two; the existing successful ReplayProof policy supplied the latter four. That policy requires processed attribution/evaluation queues and stable derived results, while identity review remains a separate optional warning. No new gate bypass or all-identities-resolved policy was invented.

Blockers remaining: **HANDOFF, PRIVACY_AUTH, REAL_DEVICE_SHARE, RESTORE_DRILL, WORKERS**. None was closed by this task. All four workers remain disabled by the existing absent-control default.

Production decision: **NOT_READY**, application `c764e2810715be0608e5fadc47d45a6a391ba674`; gate counts {"VERIFIED":5,"PENDING":21,"PARTIAL":2,"FAILED":3}; 15 blockers. This was a read-only report of existing evidence. Production imports, deployment, bridges, chain cursor, derived data and gate records were not changed.

Identity decision timestamps: 2026-09-27T17:55:22.158Z through 2026-09-27T17:55:24.787Z. Confirmed effective starts: 2026-06-19T16:34:39.682Z through 2026-09-27T12:55:19.716Z.

## Populated post-replay backup

- Timestamp: 2026-09-27T18:32:04Z.
- Size: 34,920,589 bytes.
- SHA-256: `9e0e77769aff4cdb5cb534ab6fbce6473218d42b86662a75b00dce8c62062ba3`.
- Custom-format pg_dump plus all 79 public-table inventories from one exported repeatable-read snapshot.
- Database-side and local archive hashes matched; pg_restore archive listing succeeded.
- Private/ignored archive, complete inventory and compatible normal restore-tool manifest retained. No archive, identity evidence, database URL or secret is committed.
- The temporary operational SSH key registration was revoked after evidence collection.
- No restore drill performed.

| Table                         | Snapshot rows |
| ----------------------------- | ------------: |
| AchievementDefinition         |            65 |
| ActivityAttributionJob        |             0 |
| ActivityCorrection            |           132 |
| AuthChallenge                 |            48 |
| AuthSession                   |             1 |
| CanonicalTrait                |           345 |
| ChainBlock                    |          4785 |
| ChainCursor                   |             1 |
| CollectibleArtwork            |             0 |
| CollectibleAudit              |             0 |
| CollectionAudit               |         38254 |
| CollectionJob                 |             0 |
| CollectionMilestone           |          9958 |
| CollectionReplay              |             1 |
| CollectionRuleset             |             1 |
| CollectionSetDefinition       |            52 |
| CollectionSetRequirement      |            81 |
| CollectionSnapshot            |           377 |
| Collector                     |           377 |
| CollectorAchievement          |         16211 |
| CollectorActivity             |         32400 |
| CollectorCosmeticPreference   |             0 |
| CollectorGallery              |             1 |
| CollectorGalleryItem          |             0 |
| CollectorOwnershipPeriod      |          2604 |
| CollectorProgress             |           377 |
| CollectorRefreshRequest       |             2 |
| CollectorSetProgress          |         19604 |
| CollectorTraitDiscovery       |          8692 |
| CollectorWallet               |             2 |
| CosmeticDefinition            |            17 |
| CosmeticEntitlement           |             0 |
| DeploymentIdentity            |             1 |
| EditionBalance                |             0 |
| EditionCheckpoint             |             0 |
| EditionContract               |             0 |
| EditionOwnership              |             0 |
| EditionTransfer               |             0 |
| ExternalIdentity              |           375 |
| HistoricalIdentityAttribution |           286 |
| IdentityReconciliation        |           285 |
| ImportRejection               |             0 |
| IntegrationSource             |            17 |
| LaunchGate                    |            22 |
| NftTransfer                   |         11052 |
| OperationalAudit              |           568 |
| OperationalMetric             |             0 |
| OwnershipRefresh              |             1 |
| ProductionStage               |             0 |
| ProgressionAudit              |         20511 |
| ProgressionJob                |             0 |
| ProgressionMilestone          |           551 |
| ProgressionReplay             |             1 |
| ProgressionRuleset            |             1 |
| QuestDefinition               |             0 |
| QuestProgress                 |             0 |
| RateLimitBucket               |            91 |
| ReconciliationDecision        |           284 |
| ReplayProof                   |             1 |
| ShareRenderMetric             |            58 |
| Squig                         |          4444 |
| SquigAchievement              |         97768 |
| SquigCustom                   |             0 |
| SquigDiscovery                |          2866 |
| SquigDisplayPreference        |             0 |
| SquigEdition                  |             0 |
| SquigEditionRelation          |             0 |
| SquigOwnership                |          7264 |
| SquigPassportEvent            |           391 |
| SquigProgress                 |          4444 |
| SquigProvenance               |          4444 |
| SquigTrait                    |         44440 |
| SyncRun                       |         15726 |
| WalletLinkEvidence            |           377 |
| WalletOwnershipPeriod         |         11003 |
| WorkerControl                 |             0 |
| WorkerHeartbeat               |             0 |
| XpLedgerEntry                 |         13058 |
| _prisma_migrations            |            11 |

## Defects and validation

No application defect or semantic replay difference was discovered. No application fix, ruleset change, new regression or staging redeployment was required. Application revision remains `2ab0fc3`; this report is an evidence-only commit after `195b213`.

The daemon interruption and sandbox restriction on disposable PostgreSQL cleanup affected early local validation attempts. One diagnostic rerun also ended with a connection timeout. The complete unrestricted pre-operation and final release checks both subsequently passed, including normal test cleanup; those incomplete attempts are not counted as successful checks.

- Initial and final `npm run release:check`: PASS.
- Unit tests: **556 passed**.
- Database/HTTP/browser assertions: **837 passed**.
- Initial and final staging smoke: **10/10 passed**.
- Fresh chain owner verification: **4,444/4,444**, zero anomalies.
- Populated read-only verification before and after real replay: zero progression/collection discrepancies, zero evaluation/attribution backlog and zero dirty provenance rows.
- Final stored source stability check: all 16 fingerprints still match the full-import evidence, zero active imports.
- Real staging Replay A/B: all eleven semantic derived tables match on identical inputs.
- Final formatting check: PASS. Secrets scan: 370 working-tree files and 649 historical blobs, zero findings.

Local release fixture replay is separate from the deployed real ReplayProof above. The normal verifier retains warnings for optional unconfigured collectibles and its optional RPC mode; the independently executed full pinned provenance verification supplies actual ownerOf evidence. No OAuth/device testing, populated restore, handoff, worker observation or production rollout was performed.
