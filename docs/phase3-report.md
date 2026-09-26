# Phase 3 — unified ecosystem history

## Delivered

Built on the existing UUID Collector model, read-only adapter pools, normalized activity/Passport models, historical identity attribution and Railway ownership worker. No external application or database was changed.

- Seventeen registered activity feeds cover completed Duels and round counts; Survival players/games/image use; solo Gauntlet runs and paid online rewards; Bounty donations, eligible pool entries and revealed winners; Maw receipts/disposition, verified digestion and delivered prize Squigs; both Marketplaces and refunds; ImageSubmit submissions/live creator library; safe Mad Lib publications and confirmed operations; conservative claim observations.
- Stable source-record/role slots, transactional idempotency, payload corrections, immutable correction audits, retracted obsolete slots, unresolved Collector attribution, token-contract validation and targeted audited reassignment.
- Source schema/permission validation, fingerprints, observed import bounds, durable cursors, microsecond-safe timestamp pagination, bounded rolling reconciliation, restart/interruption records, row rejection tracking and structured counters.
- Private/public activity and creator routes, server-side category/cursor filters, tracked collector aggregates, source freshness/coverage, ecosystem Squig Passport section, and source-confirmed Maw memorial state. Existing blockchain Passport/provenance remains intact.
- Production-admin source/record/Collector/Discord/wallet/token/type inspection, source diagnostics, recent import runs and rejected records. The bearer diagnostics API remains read-only.

## Sources and actual production coverage

Rechecked GitHub HEAD for UglyBot `a693d46`, The Gauntlet `780fa86`, and ImageSubmit `c18e862`; unchanged from the pinned inspection copies. Re-read the source-defined schemas and status transitions. See [inventory](external-schema-inventory.md) and the [canonical event catalog](activity-model.md).

`integrations:inspect` reports all nine connection groups NOT CONFIGURED in this workspace: UglyBot/team, prizes, claims, points, Gauntlet core, Survival, Gauntlet images, ImageSubmit and wallet links. No production database or credential-bearing environment file was available.

| Requested production metric                             | Actual result                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| Legacy schemas/permissions validated against production | None; all await dedicated read-only credentials                   |
| Historical production rows scanned                      | No production backfill run                                        |
| Production activities inserted / updated / skipped      | No production import writes performed; deployed totals unknown    |
| Production unresolved attribution                       | Unknown, not zero                                                 |
| Source completeness                                     | NOT_CONFIGURED here; production retention/completeness unverified |
| External systems modified                               | None                                                              |

Disposable fixture results establish implementation behavior, not production history. Do not advertise lifetime totals until source retention and backfill coverage are independently verified.

## Models and migration

`202609250005_activity` extends `CollectorActivity` with nullable Collector, internal Discord/wallet evidence, attribution/category/visibility/importance, active/retracted state, amounts and source/correction timestamps. It extends `SyncRun` with cursors/error code and indexes. New native models: `IntegrationSource`, `ActivityCorrection`, `ImportRejection`, `ActivityAttributionJob`. Existing `SquigPassportEvent`, Phase 2 provenance/identity models and future progression placeholders are retained. Indexes cover source-record lookup, collector/category/time, token/time, unresolved attribution, source time, currency/event lookups through existing scope indexes, image reference/deduplication and run time. Native SQL constraints enforce normalized wallet addresses and nonnegative amounts.

Apply migrations only through UglyDex `DATABASE_URL`. No external migration, DDL or write is needed.

## Events, stats and money

Collector aggregates: completed Duels/wins/losses, unique/most-used Squig, largest wager, first/latest Duel; Survival participation, placement counts, eliminations/deaths/images; confirmed Marketplace purchase/item/spending totals; submitted/approved/declined creator records, approved reward points, milestones and gallery usage; concise Bounty/Maw/Mad Lib event counts. Squig queries reuse completed Duel stats and expose source-confirmed Bounty/Maw/Duel history. Service-level Duel win rate is computed from recorded completed participations.

Passport events: Duel entered/cancelled/completed (pending/cancelled private), Bounty pool entry/win, Maw fed/regurgitated/swallowed/digested/prize delivered. Explicit collection/token evidence is mandatory; Survival and Marketplace never inherit a Collector's Squig. Blockchain mint/transfer/acquisition/loss remains the Phase 2 authority.

Tracked CHARM: completed wagers, confirmed Marketplace spending/refunds, paid Maw/Bounty draw/online Gauntlet payouts, and confirmed Mad Lib debits/rewards/refunds. No Duel winnings are inferred, no donor amount is synthesized from present configuration, no approval reward points are relabeled as paid CHARM, no generic claim row is treated as payment proof, and no balance/fiat value is invented. Amounts remain exact PostgreSQL decimals. Source observations lacking a payout timestamp retain their actual event time and documented time basis.

## Routes, commands and workers

New routes: `/me/activity`, `/me/creations`, `/collector/[slug]/activity`, `/collector/[slug]/creations`, `/admin/activity`. Existing `/me`, public profiles, `/squig/[tokenId]`, navigation, collections and `/admin/integrations` are extended.

New commands: `integrations:validate`, `sync:activity`, `activity:reattribute -- --collector|--discord|--wallet`, `worker:ecosystem [-- --once]`. Existing source sync/all commands use the new pipeline. Source CLI supports `--pages`, `--since` for registered timestamp sources, and explicit `--replay`. Per-source session locks prevent concurrent ingestion; jobs commit record changes before checkpoints and safely replay after interruption. Malformed rows are recorded for rolling retry. Source failures do not stop subsequent worker feeds.

Railway: deploy the native migration, then matching web/worker revisions; add `railway.ecosystem.toml` with `npm run worker:ecosystem`, dedicated read-only legacy URLs and the shared UglyDex database. No new mandatory secret variables. Keep the existing blockchain worker separate. See [Railway](railway.md) for pilot commands and cadence.

## Privacy and security

Public profiles must be public and expose activity only under the corresponding Discord/wallet visibility setting. Public Squig ecosystem entries expose no Collector attribution. Source IDs, raw metadata, hidden Discord IDs/wallet associations, private/declined images, unpublished stories, moderation notes, correction evidence and auth data never enter public DTOs. Exact source keys and correction history remain admin-only. All external SQL is bounded, parameterized and registry-defined, wrapped in read-only transactions. Validation checks permissions without attempting a write.

## Validation

Final validation: **202 unit tests passed** across six files; **297 disposable PostgreSQL / production HTTP / Chromium assertions passed** with `npm run test:db -- --web --browser --catalog`. The catalog run imports all 4,444 Squigs and skips all 4,444 on replay. A final database/HTTP/browser regression run after the display and environment-guard refinements passed **284 assertions** without repeating the catalog import. ESLint, TypeScript, production Next build and formatting checks pass. Desktop/mobile activity screenshots were captured and visually inspected. Tests cover each feed's first/repeated/corrected import, private/public projections, cancelled matches, refunds, donor-versus-entry tokens, Maw burn/retraction, creator deduplication/decline, historical attribution/conflict/review, filters/pagination, resumable source scans, microsecond timestamp cursors, mutable rows, source deletion retention and isolated rejections. The disposable harness applies real migrations and cannot target a caller-provided production database. Production HTTP and Playwright checks include protected routes, public/privacy behavior, gallery/activity, filters and mobile layout alongside all prior phase checks.

## Known limits and recommended Phase 4

Production rollout requires read-only credentials, real schema validation, bounded pilots, count reconciliation and source retention review. Timestamp-less mutable records may take a rolling sweep to update. Source deletion alone is not interpreted as retraction. Historical completeness remains PARTIAL after available-source exhaustion; no automatic lifetime claim is made. Survival has no exact finish/Squig identity, creator reward points do not prove payment, some source lifecycle timestamps are observations, and detailed private Mad Lib content is intentionally excluded. Login-account merging remains a separate reviewed operation. Provider/archive-chain backfill still needs the Phase 2 production configuration.

Exact Phase 4 scope: finish production pilots/coverage and ambiguous identity review first; then implement versioned, deterministic Collector/Squig XP, levels and achievement evaluation only over eligible confirmed active facts, with source-completeness gates, duplicate prevention, correction reversal, explainable award evidence and replayable tests. Keep quests, cosmetics, subscriptions, loot crates, financial valuation and currency issuance out of that phase.
