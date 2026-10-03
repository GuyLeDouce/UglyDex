# Production evidence reconciliation

## Phase 11 staging historical review

The [full import report](phase11-full-import-report.md) records 29,395 source rows,
29,460 active imported events, zero rejected rows, and zero inserts or semantic
differences on full repeats. The historical duplicate audit canonicalized 760
submission/live-image approval pairs through existing rules, found no matching
cross-source financial candidates, and retained all source evidence. Claims and
creator reward metadata remain observation-only. Forty-three Bounty entries
remain unattributed; 284 dated wallet cases await the next authorized identity
stage. Source exhaustion remains PARTIAL tracked coverage, not lifetime history.
No production import or broad reconciliation was performed.

## Phase 10 actual evidence

On 2026-09-27 UTC, source probes ran from the existing production network in read-only transactions. Wallet links and four UglyBot connection groups connect but their credentials have effective write/admin capabilities. Gauntlet authentication fails; Survival and ImageSubmit hosts do not resolve; the separate image database URL is absent. No credential is classified VERIFIED_READ_ONLY. No source pilot, full import, duplicate review or identity decision was performed, and no upstream database was modified. Import completeness remains PENDING. Safe aggregate schema/count results and the credential follow-up are in [phase10-report.md](phase10-report.md).

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

## Phase 11 checkpoint — 2026-09-27 UTC

See the [actual Phase 11 report](phase11-report.md) and [reader provisioning/access walkthrough](operator/phase11-readers/README.md). Historical Phase 10 evidence above is retained. Staging runs `0687d01`; production remains `c764e28`. Source readers were provisioned with explicit authorization, but public TLS and Gauntlet schema issues remain. RPC retries preserved the existing incomplete cursor. No production replay, populated restore, LIVE worker rollout, physical-device certification or gate-approved launch was claimed. Current gate counts and revision-binding limitations are in the report.
