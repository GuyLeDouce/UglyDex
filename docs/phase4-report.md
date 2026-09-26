# Phase 4 implementation report

UglyDex now has a permanent, versioned progression engine built on the existing activity and provenance layers. It does not read external databases or RPCs during evaluation, issue financial rewards, or replace Phase 0–3 systems.

## Delivered

- `uglydex-progression-v1`: fingerprint-checked, idempotent code-controlled seeding. 16 Collector and 6 Squig XP rules; fixed participation, unique discovery and metadata bonuses; first Marketplace participation only. No spend/wager multiplier.
- Collector threshold `50 × level × (level − 1)`; Squig threshold `25 × level × (level − 1)`. BigInt totals, historical crossing dates and materialized progress.
- 43 Collector and 22 Squig one-time achievements with reusable metric/threshold evaluators, source/provenance/identity gate primitives, display tiers, one hidden achievement, four selectable titles and up to four featured badges.
- Auditable XP ledger with deterministic revision IDs and unique active grant keys. Retractions/corrections/reattribution revoke or restore grants, recalculate totals and reevaluate awards. Achievement transitions and prior evidence remain auditable. Squig progress survives owner changes.
- Global checkpointed replay and targeted reevaluation. Transactional UglyDex-only outbox triggers catch old/new activity subjects, provenance, discovery, metadata and attribution changes. Subject locks and generation acknowledgement prevent lost updates and duplicate grants.
- Public DTOs exclude evidence IDs, private records, Discord IDs, hidden wallets and reconciliation details. Private profiles return 404. Pending corrections withhold stale earned claims. Selected titles/badges cannot remain visible after revocation.

The complete XP table, achievement catalog, gate meanings and timestamp limits are in [progression](progression.md).

## UI and operations

New routes: `/me/achievements`, `/collector/[slug]/achievements`, `/squig/[tokenId]/achievements`, `/admin/progression`. Existing `/me`, public collector and Squig profiles show compact level/XP/badge summaries, recent historical unlocks and XP explanations. Achievement pages group locked/unlocked cards with threshold progress. The authenticated presentation form validates and saves earned title/badge choices.

Admin progression provides ruleset status, subject counts, grants/revocations, achievement counts, unresolved attribution candidates, pending work, source completeness, global enqueue state, recent evaluations and per-subject explain. Grant searches accept Collector, Squig, rule and source activity; achievement explain includes count/threshold/gate/evidence. No raw SQL or editable rules UI exists.

Commands:

```
npm run progression:seed
npm run progression:rebuild
npm run progression:rebuild -- --collector <uuid>
npm run progression:rebuild -- --squig 3157
npm run progression:rebuild -- --restart
npm run worker:progression -- --once
npm run worker:progression
```

Migration `202609260006_progression` adds ProgressionRuleset, XpLedgerEntry, ProgressionAudit, ProgressionJob, ProgressionMilestone and ProgressionReplay; extends the existing achievement tables and Collector presentation preferences; adds query indexes and durable enqueue triggers. CollectorProgress/SquigProgress and SyncRun are reused. Old migrations and all external schemas remain unchanged. The polymorphic XP subject/evidence references intentionally survive source projection rebuilds; they are validated by the evaluation service.

Railway: deploy the additive migration, seed definitions, run the first replay, then add `railway.progression.toml` as a separate worker service. It processes at most 50 subjects per 15-second cycle. Share the UglyDex database; no new secrets, public domain, HTTP worker health route or legacy credentials are required. Keep the existing blockchain/ecosystem workers running. See [Railway operations](railway.md).

## Validation

Final validation on 2026-09-26:

- **227 unit tests passed** across seven files, including 25 progression tests. Coverage includes XP eligibility, deduplication, corrections, multi-level replay, exact level boundaries, historical timestamps, thresholds, metadata, hidden achievements and gates.
- **365 disposable PostgreSQL / production HTTP / Chromium / catalog assertions passed** with `npm run test:db -- --web --browser --catalog`. This includes all 4,444 canonical Squigs, idempotent catalog replay, all-subject checkpointed progression enqueue, bounded worker acknowledgement, canonical ecosystem fixtures, atomic XP/achievement revocation/restoration, sale persistence, pending wallet attribution, ruleset isolation, seed mismatch protection, concurrency, privacy, admin access and title/badge persistence.
- ESLint, TypeScript, Prettier checks and the clean production build passed. A Windows/OneDrive generated-directory cleanup error was resolved by removing only `.next` and rebuilding.
- Desktop/mobile screenshots were inspected; progression/preferences fit both viewports. The in-app browser connector was unavailable, so the repository's Playwright harness was used. Some unrelated external artwork requests timed out during the final run; the canonical artwork rendering assertion and all browser assertions still passed using the existing image/fallback behavior.
- Disposable servers/databases shut down successfully. No production database was used. The three inspected ecosystem repository working trees remain clean.

## Production limits

No production legacy credentials were available. Production backfills, XP totals, Collector award counts and source completeness are therefore **not claimed validated**. Fixtures and canonical local catalog data are the test evidence. All three ecosystem repositories/databases remain unchanged.

Current holder counts remain separate from historical achievements. UglyBot's actual holder names/thresholds are database-configured in `holder_rules`; without that approved configuration, branded holder status tiers are deliberately not invented. Travel badges count completed seven-day holds only. Phase 1 observations without confirmed historical provenance do not earn discovery XP. Source observation times retain their documented precision/meaning. Very large single-subject histories require proportional evaluation time and should be monitored during rollout. Source availability can increase tracked XP later; no lifetime-total claim is made.

## Exact recommended Phase 5

First validate production read-only schemas and retention, pilot historical backfills, resolve identity conflicts, verify provenance, and reconcile progression replay counts. Then deliver versioned **non-financial collection-set challenges** based on canonical traits, explicit current-holding versus historical-discovery eligibility, explainable completion evidence, reversible snapshots and privacy/completeness gates. Add bounded quest definitions only after these set semantics are validated. Defer currencies, stores, seasons, subscriptions, purchasable XP and advanced leaderboards.
