# Roadmap

Sequencing depends on verified data quality, not a promise to implement an economy before its inputs are trustworthy.

Phase 1 now delivers the collector dashboard, privacy/editing, multiwallet settings, paginated collection/explorer, traits/points/rank, immutable artwork, discovery views and resumable refresh worker. See [Phase 1 report](phase1-report.md). Those UI/trait/discovery items originally proposed for Phase 2 moved forward because the canonical dataset was already available.

Phase 2 now implements Transfer indexing and completeness reporting, provable mint/acquisition/loss periods, paginated passports, audited historical attribution and bounded reorg recovery. Production coverage remains to be measured. Live Railway/provider configuration and read-only source pilots remain prerequisites for production confidence, not a reason to invent data.

| Phase                                        | Scope and exit criteria                                                                                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 — foundation                               | Standalone application, dedicated schema, read-only adapter boundaries, actual inventory, replayable activities/passports, auth proofs and conflict cases, RPC jobs, diagnostics, tests and Railway configuration                                                                    |
| 1 — usable collector identity and collection | Implemented: authenticated dashboard, profile privacy/editing, signature wallet linking/revocation, aggregated collection, discovery, explorer, canonical image delivery and durable ownership refresh. Production credentials/provider validation remain operational prerequisites. |
| 2 — complete ownership passports             | Complete finalized Transfer coverage and coverage reporting, provable mint/acquisition/loss dates, paginated passports, reviewed historical wallet attribution and reorg recovery. Login-account merges remain a separate reviewed operation.                                        |
| 3 — ecosystem history                        | Expand tested adapters for duel rounds/winners, Bounty winners, Maw inventory and prize claims, both marketplaces/refunds, Mad Libs, image usage/legacy creator attribution and reward confirmations. Establish correction/retraction semantics and source completeness reporting.   |
| 4 — progression                              | Versioned XP and level calculation, collector/Squig achievements, reproducible rebuilds, explainable earned events, anti-duplication and correction rules                                                                                                                            |
| 5 — challenges                               | Implemented: versioned trait discovery, historical/current sets, completion snapshots, explorer gaps and opt-in showcases. Recurring quests remain deferred.                                                                                                                         |
| 6 — public expression                        | Opt-in public galleries, sharing, accessible profiles and verified leaderboards. Do not expose historical wallet evidence by default.                                                                                                                                                |
| 7 — utility                                  | Confirmed CHARM utility, cosmetics and premium collector customization. Customs/Editions indexing once contracts and authoritative sources are known. Keep payments/reward delivery in their owning systems.                                                                         |

Phase 0 does not claim a production-data reconciliation, completed on-chain backfill, live Discord OAuth approval, deployed Railway service or complete ecosystem history. Those require credentials, provider setup and schema validation. The application and test fixtures are independently runnable today.

## Phase 2 delivery and next scope

Phase 2 implements raw finalized transfers, resumable scan/checkpoints, bounded reorg recovery, wallet/collector holding periods, historical attribution review, discovery correction, paginated Passports, verification and repair commands. Full production coverage is an operational rollout gate and has not been claimed from fixture results. See [Phase 2 report](phase2-report.md).

The exact Phase 3 scope is: validate deployed read-only schemas and pilot imports; add correction/retraction and completeness tracking to normalized ecosystem events; then expose completed Duels and rounds, Survival results, confirmed Bounty/Maw outcomes, marketplace purchases/refunds, and approved creator contributions in the shared collector/Squig timeline. Attach events to tokens only when source evidence identifies chain/contract/token. Preserve reward attempt versus confirmed payout distinctions. Defer XP, unlock rules, quests and paid features until those historical inputs are reliable.

## Phase 3 delivered

The unified historical activity layer now extends the existing ledger with source coverage, stable event slots, correction audits, unresolved attribution, bounded backfills/incremental reconciliation, game/creator/currency aggregates, public/private activity and creator views, ecosystem Squig Passports, and an ecosystem worker. No XP, achievements or paid features were implemented. See [activity model](activity-model.md) and [Phase 3 report](phase3-report.md).

Recommended Phase 4: first validate production read-only schemas, run pilot backfills and reconcile counts/identity conflicts; then introduce a versioned, replayable progression rules engine over confirmed active events. Define XP/level and achievement rules with source-completeness gates, correction reversals, deterministic awards, explainable evidence, and no currency issuance. Defer quests, stores, subscriptions and financial valuation.

## Phase 4 delivered and Phase 5 scope

Phase 4 adds `uglydex-progression-v1`, evidence-backed XP ledgers, distinct Collector/Squig curves, 43 Collector and 22 Squig achievements, historical unlock dates, audited reversal/replay, completeness gates, titles/featured badges, privacy-safe progression pages and a durable targeted worker. See [progression](progression.md) and [Phase 4 report](phase4-report.md). Production credential/backfill validation remains an operational prerequisite for reliable public rollout, not a dependency for fixture-tested progression.

Recommended Phase 5: first run production source pilots, provenance verification, attribution review and progression replay/count reconciliation. Then implement versioned, non-financial collection-set challenges using canonical traits, explicit currently-held versus historically-discovered criteria, evidence-backed completion snapshots and the same correction/privacy gates. Add bounded quest definitions only after those set semantics are validated. Keep currencies, cosmetics, subscriptions, purchasable XP, seasons and advanced leaderboards outside that scope. Branded holder-role thresholds require reading the actual approved UglyBot holder_rules configuration; do not invent them from names.

## Phase 5 delivered and Phase 6 scope

Phase 5 now delivers a canonical Trait Dex, 52 versioned sets with explicit historical/current modes, three hidden sets, deterministic evidence/replay, collection completion, personalized explorer gaps, opt-in showcases and an operational worker. No recurring quests, financial rewards or new XP rules were added. See [Phase 5 report](phase5-report.md).

Exact Phase 6 scope: first run approved production ownership/provenance and read-only legacy pilots, reconcile attribution and audit real completion counts; then build opt-in named galleries and share cards using existing favourite Squigs/earned titles/badges/completed sets, accessible public gallery layouts, privacy-safe Open Graph images and share previews. Keep public collection denominators explicitly scoped to UglyDex. Defer paid cosmetics, recurring quests, seasons, currency rewards and XP leaderboards.
