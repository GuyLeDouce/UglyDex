# Production evidence reconciliation

No real source database, wallet-link source or archive RPC was configured during Phase 9 implementation. Real import counts, identities, rejected rows, duplicates and remediation decisions are **PENDING**, not zero.

## Source proof and pilots

Run `integrations:inspect`, `integrations:validate`, then `launch:sources`. Registry-owned table identifiers are used for SELECT-only queries under read-only transactions and existing five-second statement limits. Count/date probes report unavailable results as PENDING. Earliest/latest dates describe source availability, not lifetime history. Privilege inspection rejects obvious write/admin capabilities but labels apparent read-only access LIKELY_READ_ONLY: catalog inspection does not prove every SECURITY DEFINER or inherited privilege path. Obtain reviewed SELECT-only roles; never test permissions with destructive statements.

Use existing `integrations:pilot -- --feed <feed> --since <ISO-date>` first. It imports at most 200 source rows, preserves the full cursor, and reports scanned rows, eligible rows, normalized events, inserted/updated events, duplicate events, ignored rows, unresolved events, rejected rows and Collector/Squig linkage counts. The legacy skipped counter is retained; explicit duplicates/ignoredRows avoid mixing units. Rows and normalized events are different units. Linkage counts are gathered in one query per page. Empty or lock-busy pilots cannot be approved. Review the exact run before `integrations:pilot:approve`; source schema changes invalidate approval.

`launch:audit` reports the latest 50 pilots using numeric fields only, source availability/import-through boundaries, attribution-status counts, reconciliation decision counts, observed historical wallets, active/revoked XP and achievement totals, set modes and completion distribution. Raw IDs/amount/time identity evidence are not exported through the public launch report. `launch:explain` and admin-only `/api/admin/activity/[id]/explain` expose aggregate reasons for a selected activity: exact Discord identity agreement, effective-time wallet evidence and conflicts/reviewed evidence. No username heuristic is introduced.

## Duplicate review

Existing canonical event identity remains source system/type/record/subject/event slot. Replays reuse that identity and corrections supersede payloads. Marketplace paid intent represents the purchase, not a second payment; generic claim observations do not invent a payout. Inspect Duel/Bounty/Maw/creator/reward and webhook pairs in their authoritative adapters.

The Phase 9 audit flags cross-feed active monetary events with the same Collector, currency, amount, direction and exact timestamp. These are review candidates, not proven duplicates; delayed timestamps, unresolved identities and absent source references can escape this heuristic. No automatic merge/retraction is performed. Review source references and capture any newly discovered canonical pattern as a regression fixture before adjusting adapters. The critical DUPLICATE_REVIEW gate requires reviewed evidence, not merely zero heuristic candidates.

## Reconciliation and handoff

Use existing `/admin/reconciliation` confirm/reject/time-split actions only with real evidence. Preserve audit decisions; trigger activity reattribution and targeted progression/collection correction. Ambiguous historical identities may remain excluded with a warning. They must never gain login authority or be merged by display name. Existing Phase 8 stage gates remain strict about unresolved review cases; no new bypass was added.

After each approved historical feed completes, use `launch:handoff -- --feed <feed>` with ecosystem disabled. It performs a bounded cursor pass, rotating reconciliation pass and second cursor pass, persisting hashed cursors and counts. New records/corrections are measured, not interpreted as replay corruption. The probe remains PARTIAL until operators review all feed boundaries, complete any unfinished sweeps and attest HANDOFF. Enable LIVE ecosystem only after the existing backfill/readiness gates pass. Mutable sources use updated timestamps where supported and rotating reconciliation otherwise; no upstream write freeze is required.

The available UglyBot checkout reads `holder_rules` from its database (`getHolderRules`, min/max token bounds); it contains no verified production branded-tier catalog. HOLDER_TIERS stays PENDING. No thresholds or speculative Edition adapters were added.
