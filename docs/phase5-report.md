# Phase 5 implementation report

UglyDex now has a versioned collection encyclopedia over its existing identity, ownership and provenance architecture. External systems and Phase 4 XP rules remain unchanged.

## Delivered

- **Ruleset:** `uglydex-collection-v1`, fingerprint checked, code controlled and seeded idempotently.
- **Trait catalog:** 345 canonical values across Background (30), Skin (20), Type (5), Body (106), Mouth (22), Eyes (19), Head (125), Special (18). Whitespace is normalized centrally. Status is excluded because OG is a separate classification; blank values, technical metadata and 31 one-of-one Legend names are excluded. Canonical `None` remains included.
- **Sets:** 52 authored goals: 39 historical-discovery and 13 current-holding sets; three hidden sets (two historical, one current). 37 visible historical sets enter the completion denominator. Definitions use actual Suit, Portal, Amphibian, Astronaut, species and other canonical distributions.
- **Requirements:** filtered counts (trait values, OG, Legendary, rarity, token filters), unique trait values, explicit token IDs and AND combinations. Qualifying token selection is deterministic and explainable. All 52 goals are feasible against the real catalog.
- **Completion:** 40% Squig discovery + 35% trait discovery + 25% visible historical-set completion. Each component is shown separately. Current holdings and hidden sets are excluded from permanent completion.
- **Evidence:** confirmed discoveries require matching Collector ownership periods and clean complete provenance. Current sets aggregate active verified wallets without duplicate tokens. Sale retains historical discovery but can remove current completion. Metadata/identity/provenance corrections revoke unsupported evidence and restore it when justified.
- **Replay/audit:** durable global enqueue checkpoints, targeted rebuilds, transaction locks, generation acknowledgement, correction audit and derived milestones. Historical threshold dates come from qualifying evidence. Current first-completion dates are explicitly first observed complete; transient holdings between evaluations may not be recorded.
- **Showcase:** up to three currently completed featured sets, with server validation and automatic suppression when evidence becomes pending or current completion is lost. No financial reward, set XP, paid feature, quest or feedback loop was introduced.

## UI

New routes: `/collection/dex`, `/collection/traits`, `/collection/sets`, `/traits/[traitType]/[traitValue]`, `/sets/[key]`, `/collector/[slug]/sets`, `/admin/collections`.

Collector dashboard/public profiles now show explained completion and featured collections. The Trait Dex supports category, discovered, missing, current and rare filters. Set views support mode, state, difficulty, category and secrets. Detail pages link missing requirements into the paginated explorer. Explorer personalization supports undiscovered Squigs, missing traits and visible sets advanced; cards show real batched hints. Full token records remain server paginated at 24 cards.

Public projections exclude hidden identities, period/reconciliation evidence and private collectors. Hidden incomplete conditions do not appear in HTML/RSC or candidate hints. Qualifying token evidence is suppressed for public collectors who hide wallet attribution. The admin page provides guarded rule viewing, Collector/set explanation, queue failures, runs and replay state; it offers no arbitrary SQL or rule editing.

## Schema and deployment

Migration `202609270007_collections` extends the existing CollectionSetDefinition/CollectorSetProgress and Collector showcase preferences; adds CollectionRuleset, CanonicalTrait, CollectorTraitDiscovery, CollectionSnapshot, CollectionAudit, CollectionMilestone, CollectionJob and CollectionReplay; and adds indexes/owned-database enqueue triggers. Existing source and XP ledgers are retained.

```
npm run collections:verify
npm run collections:seed
npm run collections:rebuild
npm run collections:rebuild -- --collector <uuid>
npm run collections:rebuild -- --restart
npm run worker:collections -- --once
npm run worker:collections
```

Railway: apply the UglyDex migration, seed, replay and add `railway.collections.toml` as a separate worker using the existing Dockerfile. It processes up to 25 collectors per 15-second cycle. Existing DATABASE_URL, NODE_ENV and HTTPS PUBLIC_BASE_URL validation applies; no new secrets, external credentials, public worker domain or HTTP healthcheck. Existing workers continue unchanged.

## Validation

Final validation on 2026-09-26:

- **322 unit tests passed** across eight files, including 95 collection tests. They cover all 52 sets against canonical metadata, normalization/Legendary exclusions, requirements, stable evidence, completion weights, hidden projections, safe trait URLs and batched candidate hints.
- **429 disposable PostgreSQL / production HTTP / Chromium / catalog assertions passed** with `npm run test:db -- --web --browser --catalog`. All 4,444 canonical records imported successfully; all 4,444 were skipped on identical replay. Real migration, deterministic replay, concurrent evaluation, sale persistence, revocation/restoration, metadata corrections, unknown-value rejection, privacy, preferences, route protection, filtering and mobile layout were exercised.
- ESLint, explicit TypeScript checking, Prettier, `collections:verify`, Git whitespace checks and the production build passed. Catalog verification reports 345 trait values, 52 feasible sets and zero errors.
- Trait routes with encoded spaces and the personalized explorer accessible label were fixed after failing assertions, then passed the full rerun. Desktop Dex and mobile Trait Dex screenshots were inspected. The existing Playwright harness provided browser validation.
- Disposable database/web processes shut down successfully. No production database or ecosystem repository was changed.

## Limits and exact Phase 6 scope

Production legacy credentials are unavailable locally; no production collector completion, holder thresholds or historical coverage is claimed. Tests use the canonical catalog and isolated PostgreSQL fixtures. Nothing is seeded into production. UglyBot, The Gauntlet and ImageSubmit remain unchanged.

V1 catalog frequencies/denominator are a versioned canonical snapshot. Corrections within known values replay; new values require catalog/version review. Metadata backfills enqueue all collectors because their missing-opportunity hints may change; monitor queue latency and per-collector snapshot storage at scale. Current completion history is observation based, while historical completion dates are evidence based. Actual holder names and thresholds remain deferred until authoritative `holder_rules` configuration is available.

**Phase 6:** first validate approved production ownership/provenance and read-only legacy pilots, reconcile attribution and audit real completion totals. Then add opt-in named galleries and share cards using favourite Squigs, earned titles/badges and completed sets; accessible public gallery layouts; privacy-safe Open Graph images and share previews. Keep denominators scoped to UglyDex. Defer paid cosmetics, recurring quests, seasons, currency rewards and XP leaderboards.

See [collection rules, complete catalog and operations](collections.md).
