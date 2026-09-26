# Progression

## Phase 8 replay safety

CLI seed/rebuild/replay commands require environment/database-bound replay intent in staging/production. Backfill gates stop on earlier evidence failures; deterministic verification recomputes existing grants and achievements. production:report exposes actual active/revoked grants and evaluated gates, never fabricated production totals. Completion and XP rules are unchanged.

Phase 7 adds free appearance eligibility from active achievements. Achievement amber requires an awarded, unrevoked achievement and settled Collector progression. No XP rule, level curve, payout or achievement definition changed. Entitlement rows materialize on appearance save; live eligibility governs public display and falls back after corrections. The progression worker now starts disabled until explicitly enabled. See [collectibles](collectibles.md) and [production readiness](production-readiness.md).

UglyDex progression describes recorded collecting and participation. XP is not currency, purchasing power, an NFT valuation or a promise of rewards. It never issues CHARM. Current holdings remain separate from historical discoveries and progression.

## Rules and eligible evidence

`uglydex-progression-v1` is code controlled in `src/domain/progression.ts`. Seeding persists its complete configuration, level curves and fingerprint in `ProgressionRuleset`, and extends the existing achievement definitions. A different configuration under the same version is rejected. Change the version and explicitly replay to introduce a new ruleset; old ledger entries and definitions remain isolated. The implementation's evidence semantics must also be versioned when changed. There is no browser rule editor.

Only UglyDex-owned normalized data is read. No legacy client or RPC provider is part of evaluation. Active PUBLIC source events qualify; private or unpublished content, cancelled Duels, rejected submissions, operational/payment observations and unresolved Collector attribution do not. PUBLIC is the source-content classification, not permission to reveal an associated Discord/wallet identity. Public progression shows generic earned badges/counts, never source details or identity associations.

Collector events require resolved Discord/dated wallet attribution. A pending wallet-attribution job excludes its wallet-only activity. Explicit Squig events remain eligible independently of Collector resolution. Survival/creator/Marketplace Collector events never award Squig XP. Duplicate Duel participant slots for one subject count as one game; contradictory outcomes award no win bonus. Image submissions take precedence over matching live-image rows, including subsequent declines.

Confirmed discoveries require a clean, complete provenance projection and their matching Collector ownership period. Phase 1 ownerOf observations alone do not prove historical discovery for progression. Sale does not remove the confirmed discovery. Invalidated attribution does. Canonical OG/Legendary flags come from the indexed Squig dataset.

Squig mint XP/origin badges use the Phase 2 materialized mint record only when provenance is complete and clean. Squig travel badges count distinct confidently attributed collectors with **completed holds of at least seven days**. Ongoing holds are deliberately not counted in V1, avoiding clock-dependent replay. They earn no transfer XP. Internal wallet moves earn no XP. Squig progress remains attached to its UUID/token after transfer or burn.

## V1 XP table

| Subject   | Evidence                                          |           XP | Limit                                                   |
| --------- | ------------------------------------------------- | -----------: | ------------------------------------------------------- |
| Collector | Unique confirmed discovery                        |           40 | Once per token                                          |
| Collector | OG discovery bonus                                |           20 | Once per token                                          |
| Collector | Legendary discovery bonus                         |           40 | Once per token                                          |
| Collector | Completed Duel / win bonus                        |      15 / 10 | Per confirmed game                                      |
| Collector | Completed Survival / podium / first-place bonuses | 15 / 10 / 15 | Per recorded participant/game; bonuses stack            |
| Collector | Approved image                                    |           40 | Submission/live-image deduplicated                      |
| Collector | Distinct illustrated milestone                    |           15 | Once per milestone                                      |
| Collector | Accepted Bounty contribution / Bounty win         |      30 / 30 | Per confirmed record                                    |
| Collector | Maw feed                                          |           20 | One receipt/disposition slot; digestion is not extra XP |
| Collector | Public Mad Lib publication                        |           20 | Per publication                                         |
| Collector | Completed solo Gauntlet run                       |           10 | Per run                                                 |
| Collector | Confirmed Marketplace participation               |           20 | First qualifying purchase only                          |
| Squig     | Verified mint                                     |           20 | Once                                                    |
| Squig     | Completed Duel / win bonus                        |      15 / 10 | Explicit token, per game                                |
| Squig     | Bounty entry / win                                |      10 / 30 | Explicit Squigs contract/token                          |
| Squig     | Maw feed                                          |           10 | Explicit token, per receipt slot                        |

No rule scales with spend, wagers, CHARM or ETH. Lower-bound achievements do not require complete lifetime history: ten proven wins suffice for ten wins. No undefeated, first-ever, financial or inferred-use achievements exist.

## Levels and historical time

For level L >= 1, Collector threshold = `50 * L * (L - 1)` and Squig threshold = `25 * L * (L - 1)`. Collector levels 1–5 start at 0, 100, 300, 600, 1,000 XP. Squig levels 1–5 start at 0, 50, 150, 300, 500. BigInt arithmetic and binary search support growing totals without a low maximum. UI reads XP, next threshold, remaining XP and percentage from this one curve implementation.

Replay orders grants by source time then stable grant key. `ProgressionMilestone` stores the historical threshold-crossing date. Achievement awardedAt is the time the threshold-th distinct qualifying fact occurred; evaluatedAt is the processing time. Locked never-earned achievements have no awardedAt. Source observation timestamps retain Phase 3's documented limits: a Survival timestamp is game start, not an invented finish. No replay date is presented as a historical unlock.

## Ledger, evidence and reversals

`XpLedgerEntry` is the authoritative XP grant ledger. Deterministic IDs include ruleset, subject, rule/source key, XP and the normalized evidence revision. A partial unique index permits one active revision of a grant key. Entries retain source activity ID when one exists; discovery/mint/hold evidence has a durable local projection key instead. These are textual references, deliberately not cascading foreign keys, so Phase 2 re-derivation cannot destroy audit history.

A rebuild computes the desired set, revokes superseded/missing grants, restores/creates qualifying revisions, and rematerializes existing CollectorProgress/SquigProgress. `ProgressionAudit` records grant, unlock, revocation and corrected-evidence transitions. Repeated identical evaluation creates no new grants or correction noise. Achievement rows retain progress/gate result even while locked/revoked; their bounded evidence contains qualifying keys, count, threshold, gate and qualifying date. Unlocked history is not deleted by seeding.

If attribution moves A → B, both subjects are queued: A loses dependent grants/awards and B receives them when its evidence qualifies. Retractions, token correction, creator decline, provenance reorg/dirty state and identity review are handled the same way. Generic public projections withhold earned claims while a subject has pending work. Selected badges/titles are filtered against currently valid unlocks; a stored preference cannot keep a revoked title visible.

## Gates

Definitions declare NONE, IDENTITY, PROVENANCE, READY:source or COMPLETE:source. READY accepts validated usable READY/PARTIAL/COMPLETE history; COMPLETE accepts only COMPLETE. The latter is never inferred from cursor exhaustion. V1 uses identity and provenance gates plus monotone counts, avoiding claims requiring unavailable full history. Source readiness/complete gate primitives are tested for future definitions. No production source-completeness claim is made by this phase.

## Durable incremental work and replay

UglyDex-only PostgreSQL triggers enqueue `ProgressionJob` for old/new activity subjects, discoveries, holding periods, canonical metadata, provenance, attribution work and changed source completeness. Creator correction queues affected live-image subjects too. Jobs coalesce and increment a generation. Per-subject transaction advisory locks plus repeatable-read snapshots, deterministic keys and conditional generation acknowledgement protect against overlapping imports/replays/workers. A concurrent modification causes a retryable failed transaction, retaining the job; no partial grant set is committed. Failed subjects move to the back of the queue; other subjects continue.

`SyncRun` records each subject evaluation's scope, time, counts and safe failure code. An older unfinished run for a subject is marked interrupted by its next lock holder. `ProgressionReplay` checkpoints global enqueue batches of 200 IDs, separately for Collectors and Squigs. Source history is read in 500-row pages per subject. Only the affected subject is recalculated after a new event; web requests never replay histories. A very large individual history still needs memory/time proportional to that subject's records. Observe run latency before raising worker throughput.

```
npm run db:migrate
npm run progression:seed
npm run progression:rebuild
npm run progression:rebuild -- --collector <uuid>
npm run progression:rebuild -- --squig 3157
npm run progression:rebuild -- --restart
npm run worker:progression -- --once
npm run worker:progression
```

A global rebuild resumes an incomplete enqueue pass; a completed prior pass starts a new audit. `--restart` deliberately restarts enqueue scanning without deleting evidence. A crash after enqueue/before acknowledgement is safe. A failed global command leaves jobs for the worker or another replay. Run the first full replay after historical backfill, and again after a version change. Do not seed fictional Collector events or progress.

## Presentation and privacy

`/me/achievements`, `/collector/[slug]/achievements` and `/squig/[tokenId]/achievements` show grouped cards, thresholds, historical dates, hidden mystery cards and progression summaries. A collector can select up to four unlocked badges and one achievement title. Server actions authenticate the session and validate every choice; Next's same-origin action protection applies behind Railway's normal host-preserving proxy. Presentation is not a new financial reward.

Public DTOs never contain raw evidence, source IDs, Discord IDs, wallets, reconciliation notes or private source content. A private Collector has no public achievements page. Generic level/badge summaries may reflect eligible source-public activity even when that collector hides the associated credential; they do not identify that credential or publish the activity record. Unlock percentages are not fabricated.

`/admin/progression` uses the existing authenticated admin policy. It provides rule viewing, subject/achievement explanation, paginated XP evidence searches by rule/activity, recent runs, queued failures, attribution candidates and completeness state. It does not accept arbitrary SQL or edits to rules.

## Holder status and known limits

UglyBot `index.js` stores holder roles in `holder_rules` with guild/role/chain/contract/min_tokens/max_tokens/enabled. Its current source compares count to those configured ranges; the community names and thresholds are not hardcoded canonical constants. Without read-only production configuration, UglyDex continues showing the actual current holdings count separately from historical XP and does **not** invent branded holder-role thresholds. Importing approved role configuration is a later, separately validated integration.

Production sources remain unconfigured locally. Imported test fixtures validate behavior, not production award counts. COMPLETE requirements remain unavailable until independently established. Eligibility intentionally withholds unconfirmed early wallet history. No quests, sets, seasons, cosmetics, payments, leaderboards or financial issuance are included.

## Troubleshooting

- Pending UI: inspect ProgressionJob and recent SyncRun; run the progression worker. Resolve attribution/provenance dirty work in its existing worker first.
- Missing historical badge: use admin explain; check count, attribution, source visibility, provenance gate, source coverage and rejection logs. Do not bypass gates to match anecdotal totals.
- Ruleset mismatch: revert the unintended configuration change or introduce a reviewed new version; never overwrite the fingerprint to force deployment.
- Failed transaction: retry the retained job. Persistent timeouts require inspecting subject size/indexes; do not truncate the ledger.
- Wrong attribution: use the Phase 2 reconciliation process, then run activity reattribution/provenance and progression workers. Preserve both original source evidence and progression audit.

## V1 achievement catalog

All achievements are one-time historical thresholds. Display tiers are visual classifications only. The catalog below is generated from the code-controlled definitions.

| Subject   | Achievement                    | Criterion                                                                                     | Tier      | Title             |
| --------- | ------------------------------ | --------------------------------------------------------------------------------------------- | --------- | ----------------- |
| COLLECTOR | First Ugly                     | Record at least 1 unique confirmed Squig discoveries.                                         | Common    | Certified Ugly    |
| COLLECTOR | Getting Ugly                   | Record at least 5 unique confirmed Squig discoveries.                                         | Uncommon  | —                 |
| COLLECTOR | Certified Hoarder              | Record at least 10 unique confirmed Squig discoveries.                                        | Rare      | —                 |
| COLLECTOR | Deep in the Dex                | Record at least 20 unique confirmed Squig discoveries.                                        | Rare      | —                 |
| COLLECTOR | Field Researcher               | Record at least 25 unique confirmed Squig discoveries.                                        | Epic      | —                 |
| COLLECTOR | Ugly Archivist                 | Record at least 50 unique confirmed Squig discoveries.                                        | Epic      | —                 |
| COLLECTOR | Creature Curator               | Record at least 100 unique confirmed Squig discoveries.                                       | Legendary | —                 |
| COLLECTOR | Walking Encyclopedia           | Record at least 250 unique confirmed Squig discoveries.                                       | Legendary | —                 |
| COLLECTOR | The Living Dex                 | Record at least 500 unique confirmed Squig discoveries.                                       | Legendary | —                 |
| COLLECTOR | Original Encounter             | Record at least 1 OG discoveries.                                                             | Common    | —                 |
| COLLECTOR | Old Guard                      | Record at least 5 OG discoveries.                                                             | Uncommon  | —                 |
| COLLECTOR | OG Obsession                   | Record at least 10 OG discoveries.                                                            | Rare      | —                 |
| COLLECTOR | An Unlikely Legend             | Record at least 1 Legendary discoveries.                                                      | Common    | —                 |
| COLLECTOR | Step into the Ring             | Record at least 1 completed Duels.                                                            | Common    | —                 |
| COLLECTOR | Battle Regular                 | Record at least 10 completed Duels.                                                           | Rare      | —                 |
| COLLECTOR | Ring Resident                  | Record at least 50 completed Duels.                                                           | Epic      | —                 |
| COLLECTOR | First Victory                  | Record at least 1 Duel wins.                                                                  | Common    | —                 |
| COLLECTOR | Duel Freak                     | Record at least 10 Duel wins.                                                                 | Rare      | Duel Freak        |
| COLLECTOR | Certified Menace               | Record at least 25 Duel wins.                                                                 | Epic      | —                 |
| COLLECTOR | Arena Apparition               | Record at least 50 Duel wins.                                                                 | Epic      | —                 |
| COLLECTOR | Into the Gauntlet              | Record at least 1 completed Survival games.                                                   | Common    | —                 |
| COLLECTOR | Still Here                     | Record at least 10 completed Survival games.                                                  | Rare      | —                 |
| COLLECTOR | Hard to Kill                   | Record at least 50 completed Survival games.                                                  | Epic      | —                 |
| COLLECTOR | On the Podium                  | Record at least 1 Survival podium finishes.                                                   | Common    | —                 |
| COLLECTOR | Survivor                       | Record at least 1 Survival wins.                                                              | Common    | Survivor          |
| COLLECTOR | Last Ugly Standing             | Record at least 5 Survival wins.                                                              | Uncommon  | —                 |
| COLLECTOR | Survival Instinct              | Record at least 25 Survival wins.                                                             | Epic      | —                 |
| COLLECTOR | Make it Ugly                   | Record at least 1 approved image contributions.                                               | Common    | —                 |
| COLLECTOR | Ugly City Builder              | Record at least 5 approved image contributions.                                               | Uncommon  | Ugly City Builder |
| COLLECTOR | Prolific Freak                 | Record at least 10 approved image contributions.                                              | Rare      | —                 |
| COLLECTOR | Milestone Maker                | Record at least 1 distinct illustrated milestones.                                            | Common    | —                 |
| COLLECTOR | City Cartographer              | Record at least 5 distinct illustrated milestones.                                            | Uncommon  | —                 |
| COLLECTOR | Vault Contributor              | Record at least 1 accepted Bounty contributions.                                              | Common    | —                 |
| COLLECTOR | Vault Regular                  | Record at least 5 accepted Bounty contributions.                                              | Uncommon  | —                 |
| COLLECTOR | Bounty Claimed                 | Record at least 1 Bounty wins.                                                                | Common    | —                 |
| COLLECTOR | Dinner is Served               | Record at least 1 confirmed Maw feeds.                                                        | Common    | —                 |
| COLLECTOR | Maw Regular                    | Record at least 5 confirmed Maw feeds.                                                        | Uncommon  | —                 |
| COLLECTOR | The Maw Remembers              | Record at least 10 confirmed Maw feeds.                                                       | Rare      | —                 |
| COLLECTOR | Malformed Taste                | Record at least 1 confirmed Marketplace purchases.                                            | Common    | —                 |
| COLLECTOR | Published Weirdness            | Record at least 1 public Mad Lib publications.                                                | Common    | —                 |
| COLLECTOR | Ugly Around Town               | Record at least 3 distinct ecosystem categories.                                              | Common    | —                 |
| COLLECTOR | Ugly Everywhere                | Record at least 5 distinct ecosystem categories.                                              | Uncommon  | —                 |
| COLLECTOR | Part of the Furniture (hidden) | Record at least 7 distinct ecosystem categories.                                              | Uncommon  | —                 |
| SQUIG     | Born Ugly                      | Record at least 1 verified mint records.                                                      | Common    | —                 |
| SQUIG     | Into the Ring                  | Record at least 1 completed Duels.                                                            | Common    | —                 |
| SQUIG     | Battle Tested                  | Record at least 10 completed Duels.                                                           | Rare      | —                 |
| SQUIG     | Arena Veteran                  | Record at least 25 completed Duels.                                                           | Epic      | —                 |
| SQUIG     | Scar Tissue                    | Record at least 50 completed Duels.                                                           | Epic      | —                 |
| SQUIG     | Living Weapon                  | Record at least 100 completed Duels.                                                          | Legendary | —                 |
| SQUIG     | First Blood                    | Record at least 1 Duel wins.                                                                  | Common    | —                 |
| SQUIG     | Troublemaker                   | Record at least 5 Duel wins.                                                                  | Uncommon  | —                 |
| SQUIG     | Dangerous Company              | Record at least 10 Duel wins.                                                                 | Rare      | —                 |
| SQUIG     | Certified Menace               | Record at least 25 Duel wins.                                                                 | Epic      | —                 |
| SQUIG     | Arena Legend                   | Record at least 50 Duel wins.                                                                 | Epic      | —                 |
| SQUIG     | Bounty Hunter                  | Record at least 1 Bounty pool entries.                                                        | Common    | —                 |
| SQUIG     | Vault Familiar                 | Record at least 5 Bounty pool entries.                                                        | Uncommon  | —                 |
| SQUIG     | Prize Fighter                  | Record at least 1 Bounty wins.                                                                | Common    | —                 |
| SQUIG     | Fed to the Maw                 | Record at least 1 confirmed Maw feeds.                                                        | Common    | —                 |
| SQUIG     | Regurgitated                   | Record at least 1 regurgitations.                                                             | Common    | —                 |
| SQUIG     | Swallowed                      | Record at least 1 swallowed dispositions.                                                     | Common    | —                 |
| SQUIG     | Remembered Forever             | Record at least 1 verified digestions.                                                        | Common    | —                 |
| SQUIG     | Original Ugly                  | Canonical OG metadata with verified mint provenance.                                          | Common    | —                 |
| SQUIG     | Legendary Specimen             | Canonical Legendary metadata with verified mint provenance.                                   | Common    | —                 |
| SQUIG     | Well Travelled                 | Record at least 3 distinct attributed collectors with completed holds of at least seven days. | Common    | —                 |
| SQUIG     | Many Homes                     | Record at least 5 distinct attributed collectors with completed holds of at least seven days. | Uncommon  | —                 |

## Phase 5 integration boundary

`uglydex-collection-v1` is independent of this XP ruleset. Sets, trait discovery and completion milestones do not grant XP or modify the 65 V1 achievements. There is no progression/collection feedback loop. Future set-based achievements require an explicit new progression version and evidence review. Current-holder sets remain reversible while confirmed historical discoveries survive sale. See [collections](collections.md).
