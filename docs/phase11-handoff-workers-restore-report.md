# Phase 11 staging restore, handoff and workers

Execution dates: 2026-09-27–28 UTC.
Branch: `phase11-launch-evidence`. Starting evidence revision: `0b15073`.
Starting application revision: `2ab0fc3`. Worker fixes: `cf49141`, `cd15cd3`.
Production application remains `c764e28`; production was read-only throughout.

This report covers the populated disposable restore, 16 historical-to-live
handoff probes, and the four staging core workers. Privacy/authentication and
real-device validation are separate, unfinished launch gates. Neither ruleset
was changed. Customs and Editions were not imported or enabled.

## Populated restore

The retained private post-replay archive was reused. Its timestamp is
`2026-09-27T18:32:04Z`, size **34,920,589 bytes**, and SHA-256 is
`9e0e77769aff4cdb5cb534ab6fbce6473218d42b86662a75b00dce8c62062ba3`.
Both its hash and `pg_restore` readability passed.

All staging workers remained disabled during the drill. The disposable target
contained zero application tables before the single-transaction restore.
Its fingerprint was
`dcceb28bbe1fdd44417fca99426a0c1082c44714bb1cbae2b2263ef11de27bd3`,
distinct from canonical staging and production. The existing restore target
guard and required short-lived restore intent were used. The PostgreSQL-side
operator workflow used `pg_restore --single-transaction --exit-on-error`.

All **79 retained table inventories and hashes matched**, including all 11
migration records. Inventory evidence hash:
`71d3ad48297fafcc165aa8f4e9166329f3a1229667e0f214caacc197f80865ff`.
Selected restored counts:

| Table               |   Rows |
| ------------------- | -----: |
| Squig               |  4,444 |
| SquigTrait          | 44,440 |
| NftTransfer         | 11,052 |
| SquigProvenance     |  4,444 |
| CollectorActivity   | 32,400 |
| XpLedgerEntry       | 13,058 |
| CollectionSnapshot  |    377 |
| CollectionMilestone |  9,958 |
| ReplayProof         |      1 |

Read-only production verification, migration checks, populated progression and
collection integrity, reconciliation evidence, and privacy-safe data checks
passed. No real user authenticated against this copy. Containment was verified:
zero enabled workers, zero enabled Edition contracts, and zero DeploymentIdentity
rows after removal of the restored binding. No worker service used this database.
The disposable database was deleted after evidence was retained. Its URL was
never persisted in Railway variables or committed.

## Worker-readiness defects

Initial blockchain readiness was `WAITING_BACKFILL`: the verified chain had no
`ProductionStage(transfers)` row. Initial ecosystem readiness was
`WAITING_SOURCE_VALIDATION`: the unavailable optional feed blocked all feeds.

`cf49141` added regressions before fixing these conditions. Blockchain accepts
the normal completed stage or caught-up, error-free chain evidence with current
revision/binding and all five required chain gates verified. Ecosystem readiness
and polling recognize explicit unavailable-source state; invalid required feeds,
unfinished available history, and unexpected source errors still block readiness.
No historical stage row was fabricated.

The first LIVE blockchain cycle exposed another defect: after one bounded page
advanced the finalized target, readiness re-applied the bootstrap condition and
stopped catch-up. It entered `WAITING_BACKFILL`, with no RPC error or circuit
breaker. The worker was disabled for investigation. A bounded recovery processed
only blocks after its durable checkpoint, adding one legitimate Transfer.

`cd15cd3` added the failing continuation regression and records a real
`BLOCKCHAIN_LIVE_ADMISSION` audit through normal WorkerControl. Continued catch-up
requires matching environment, revision, database, chain, start block, and an
unchanged indexed block anchor. Missing, future, reorged, or mismatched admission
evidence remains rejected. No cursor reset, ledger replacement, or historical
rescan occurred. Focused tests passed; the full fix release passed **584 unit
tests and 837 database/HTTP/browser assertions**.

## Handoff

All 16 approved available feeds passed their guarded forward/reconciliation/
forward probes while ecosystem was disabled. The reviewed aggregate records
4,416 scanned rows, zero inserts, 13 corrections, zero retractions, zero failures,
and zero unresolved ImportRejections. All forward cursors were monotonic and all
approved schema fingerprints remained intact.

The 13 corrections affected upstream timestamps and corresponding source hashes
for madlib publications. No financial, identity, event-type, visibility, or
metadata semantics changed. Repeated reconciliation/forward passes added no
duplicates. Nine normal progression jobs were processed successfully.

All bounded reconciliation passes completed. A pass completing does not imply
the entire rolling reconciliation sweep completed; the retained per-feed flag
distinguishes these facts. Coverage remains `SOURCE_EXHAUSTED / PARTIAL` with
`TRACKED_AVAILABLE_HISTORY_NOT_LIFETIME`.

`onlineRewards` remains `UNAVAILABLE_SOURCE_TABLE` because its source table does
not exist. Its explicit stored state is `UNAVAILABLE / FEED_UNAVAILABLE`, with
no schema validation, backfill completion, or handoff proof fabricated. The
availability rule applies to explicit source state, not a feed-name exception.

## Pre-worker replay

Handoff corrections changed the input-bound proof, so a fresh real A/B ran with
all workers disabled. Proof `6488a39d-df15-4b9d-be55-e0f86b0146fa` verified all
11 derived tables with zero differences. Both inputs hashed to
`e9dab8cdb3ddfe239feff1fc500892cee8d8b510c39b64157323f38b7f4a9e15`.
The later LIVE inputs require a final coexistence check; this earlier proof is
not evidence for a changed input set.

## Live workers and restart observation

All four worker deployments use `cd15cd36c835be38b316ea7bd6fc9c45bab0f77f`.
They were enabled through WorkerControl in the required order, each after its
LIVE readiness returned `READY`. All four were then restarted once through
Railway after successful LIVE work. New process instances acquired their worker
advisory locks, resumed durable state, and reported fresh successful cycles.
No manual cursor or job repair was needed after these acceptance restarts.
Old heartbeat records remain historical observations, not proof of a currently
held database lock.

First retained heartbeat observations (UTC) were blockchain
`2026-09-27T23:26:53.417Z`, ecosystem `2026-09-27T23:30:06.543Z`, progression
`2026-09-27T23:39:51.483Z`, and collections `2026-09-27T23:55:05.701Z`.
These are first observed heartbeats, not invented process-start timestamps.

The retained log window before the final replay contains:

| Worker      | First successful LIVE cycle (UTC) | Last success before freeze (UTC) | Successful cycles | Logged jobs processed | Failures |
| ----------- | --------------------------------- | -------------------------------- | ----------------: | --------------------: | -------: |
| blockchain  | 2026-09-27 23:27:00.501           | 2026-09-28 00:08:18.869          |               399 |                   n/a |        0 |
| ecosystem   | 2026-09-27 23:35:08.281           | 2026-09-28 00:07:59.187          |                 8 |                   n/a |        0 |
| progression | 2026-09-27 23:40:08.712           | 2026-09-28 00:08:06.540          |               101 |                 4,593 |        0 |
| collections | 2026-09-27 23:55:31.750           | 2026-09-28 00:08:14.367          |                47 |                   189 |        0 |

These are retained completed-cycle log counts, not a fabricated exact total of
all work across container termination. At the freeze, attribution, progression
and collection queues were all **zero**, with zero failed jobs and zero dirty
provenance. The normal workers achieved this drain before the operator's final
settling step. No circuit-breaker event occurred.

Ecosystem processed exactly the 16 available feeds. Its retained live logs show
27,213 scanned rows, one insert, 101 updates, and zero reported retractions.
The new source activity is a Discord-attributed charm claim. Reviewed source
corrections affected madlib publication source timestamps and hashes; financial
and identity fields were unchanged. No bot-attribution or hidden-identity leak
was found in the populated audits.

The chain start block remained 25,342,921. From the original cursor 26,068,941,
only forward bounded catch-up occurred. One legitimate later Transfer increased
the ledger from 11,052 to 11,053. Mints remained 4,444, and all 4,444 projections
were clean with matching owners. Normal derivation added one confirmed
historical discovery and one Collector ownership period. Historical discovery
was preserved independently of current holdings.

Before the final freeze, activity was 32,342 active, 32,299 Collector-linked,
3,272 Squig-linked, 43 unattributed, zero conflicting, and 60 retracted.
Progression had 13,059 active XP entries and zero revocations: 8,149 Collector
grants totaling 210,340 XP and 4,910 Squig grants totaling 94,805 XP. XP is a
progression measure, not financial value. There were 1,349 active Collector
awards and 6,104 active Squig awards. Duplicate XP grant groups were zero.

Collections had 2,601 confirmed Squig discoveries, 8,696 active trait discoveries,
917 completed historical sets, 13 completed current-holding sets, 377 snapshots,
and 9,962 active milestones. Duplicate milestone groups were zero. There were
zero active cosmetic entitlements. The existing 40/35/25 completion formula and
both ruleset fingerprints were preserved.

Against the pre-worker baseline, Collector XP increased by one 40-XP grant;
Squig XP and awarded achievement counts were unchanged. Historical/current set
completion counts were unchanged. The additional confirmed ownership discovery
added four trait discoveries and four collection milestones. There were no
unexplained achievement, set, or entitlement changes.

Per-feed cursor hashes, all three pass counts, rejection counts, sweep flags,
timestamps, full restored table counts, and replay table fingerprints are in
[the safe aggregate artifact](phase11-handoff-workers-restore-evidence.json).

The replay fingerprint policy was not changed. Derived exclusions remain:
`calculatedAt` on CollectorProgress, SquigProgress, CollectorSetProgress and
CollectionSnapshot; `createdAt` on XpLedgerEntry; `evaluatedAt` on CollectorAchievement
and SquigAchievement; and the surrogate `id` on SquigDiscovery. The other four
derived tables omit no fields. Award, ownership, acquisition, revocation and
milestone dates remain semantic. Input exclusions are unchanged from the
[prior reconciliation report](phase11-reconciliation-replay-report.md); live
cursor state and new semantic records were not removed from hashing.

## Final frozen replay

All four controls were disabled, worker advisory locks drained, and all queues
were confirmed empty before the final replay. No source synchronization or
identity decision changed during either pass. Upstream bots were not stopped.

Proof `b6a1d45d-d9fc-454a-9771-37da3cb450c1` completed successfully on `cd15cd3`.
Replay A started at `2026-09-28T00:10:09.893Z`; Replay B started at
`2026-09-28T00:22:40.294Z` and finished its collection evaluation at
`2026-09-28T00:34:33.344Z`. Both inputs hashed to
`83b5ec1c293e1452ee560ddd3afd35da72a6c2d61494b3273184d7419f7162f1`.
All **11/11 derived table fingerprints matched**, with zero semantic differences.
Supplemental reconciliation-case, decision, and entitlement hashes also matched.
No differences were whitelisted and no derived rows were manually edited.

The pair covered 377 CollectorProgress rows, 4,444 SquigProgress rows, 13,059 XP
entries, 16,211 CollectorAchievement evaluations, 97,768 SquigAchievement
evaluations, 551 progression milestones, 2,867 discovery records (2,601
confirmed), 8,696 trait discoveries, 19,604 set-progress rows, 377 completion
snapshots, and 9,962 collection milestones. Both ruleset and catalog fingerprints
matched their pre-worker values.

The subsequent pinned provenance verification passed all 4,444 owner reads at
block 26,072,176, with zero chain anomalies. That verifier writes verification
fields; existing provenance triggers conservatively queued 4,633 progression
subjects and 189 Collectors for collection reevaluation. The concurrent read-only
integrity verifier therefore reported a queue failure while all 4,821 recomputed
subjects and collection results matched. This was identified as verification-
generated work, not lost source data or a worker failure. Workers stayed disabled
while normal incremental processors settled that work. No trigger, ruleset, or
fingerprint exclusion was changed to avoid it.

The incremental follow-up finished at `2026-09-28T00:51:07.001Z` with all three
queues and dirty provenance at zero. Exact replay verification remained true
afterward, resolving the queue-only integrity failure without another rebuild
or a new fingerprint policy. All four controls resumed LIVE, in the required
order, at `2026-09-28T00:52:26.326Z` after readiness checks.

## Final LIVE coexistence and gates

All four services completed successful cycles after resumption. At the final
snapshot (`2026-09-28T01:00:22.505Z`), every control was LIVE and every latest
heartbeat was healthy, with no error. Attribution, progression and collection
queues were zero; dirty provenance and circuit-breaker events were zero.
The chain cursor and stored finalized boundary both reached **26,072,429**,
with **11,053 Transfers**, **4,444 mints**, and **4,444 clean projections**.

| Worker      | Latest retained heartbeat (UTC) | Latest success at snapshot (UTC) | State       |
| ----------- | ------------------------------- | -------------------------------- | ----------- |
| blockchain  | 2026-09-28 01:00:17.771         | 2026-09-28 01:00:17.770          | LIVE / IDLE |
| ecosystem   | 2026-09-28 01:00:13.543         | 2026-09-28 00:58:27.209          | LIVE / IDLE |
| progression | 2026-09-28 01:00:13.886         | 2026-09-28 01:00:13.886          | LIVE / IDLE |
| collections | 2026-09-28 01:00:20.317         | 2026-09-28 01:00:13.436          | LIVE / IDLE |

The current derived state still matched **all 11** Replay B fingerprints, with
zero duplicate XP or milestone groups. However, the input fingerprint changed
to `fbc1e59c2be11a5f16495142d460da13cbc13053b203386f2f2e0fb49f4054e3`.
The differing input tables were **CollectorActivity** and **IntegrationSource**.
LIVE madlib publication corrections changed source timestamps and payload
hashes. Source polling also advanced cursor/reconciliation state and refreshed
`backfillFinishedAt`. The safe artifact lists changed field names per feed.
No identity decision, catalog, ruleset, Transfer ledger, or derived fingerprint
changed in this comparison.

The final retained cycle logs contain 489 successful blockchain cycles, 10
ecosystem cycles, 137 progression cycles and 83 collection cycles, with zero
failed cycles. Logged worker processing totals are 4,611 progression jobs and
189 collection jobs. The separate operator follow-up after provenance
verification processed 4,633 progression jobs and 189 collection jobs; these
are not counted as worker throughput. Final ecosystem logs contain 33,940 rows
scanned, one insert, 127 source corrections and zero reported retractions.

Consequently, the frozen ReplayProof remains a successful historical A/B proof,
but **DERIVED_REPLAY_STABLE is PENDING for current LIVE inputs**. The required
freeze/replay/resume sequence was performed; the resumed source cycle changed
the input again. Repeating that sequence does not establish an unchanged LIVE
input. No field was excluded, gate manually overridden, or differing input set
represented as an A/B determinism failure. Resolving this LIVE proof-validity
blocker requires further reviewed work within the existing evidence policy.

Final staging decision: **NOT_READY**. Gate totals: **17 VERIFIED, 9 PENDING,
5 PARTIAL, 0 DEGRADED, 0 FAILED**. There are 17 verified critical gates, three
critical blockers, and 11 optional warnings.

| Gate                  | Final status | Evidence                                                                            |
| --------------------- | ------------ | ----------------------------------------------------------------------------------- |
| RESTORE_DRILL         | VERIFIED     | Reviewed populated disposable restore; safe manual attestation                      |
| HANDOFF               | VERIFIED     | All 16 reviewed bounded probes; safe manual attestation                             |
| WORKERS               | VERIFIED     | Automatic verification of four actual LIVE workers with fresh successful heartbeats |
| DERIVED_REPLAY_STABLE | PENDING      | LIVE inputs changed after the successful frozen A/B pair                            |
| PRIVACY_AUTH          | PENDING      | Not authorized in this stage                                                        |
| REAL_DEVICE_SHARE     | PENDING      | Not authorized in this stage                                                        |

MINT_COVERAGE, OWNERSHIP_CONTINUITY, OWNER_OF, REATTRIBUTION, ACTIVITY,
DUPLICATE_REVIEW, PROGRESSION and COLLECTIONS remain VERIFIED. The unresolved
identity conflict remains an optional warning. The four healthy staging workers
remain LIVE as authorized; production remains untouched.

`npm run staging:smoke` passed all **10 checks** after resumption.
`launch:verify`, `launch:report`, and `launch:check` were run against the final
LIVE state. `launch:check` correctly returned its non-ready exit status for the
three blockers above. Pinned provenance verification and chain status passed;
the verification-generated queue backlog was processed and confirmed empty.

**NOT_READY_FOR_FINAL_PRIVACY_AUTH_AND_DEVICE_VALIDATION**

## Security and scope

The four services exist only in staging, with one replica each, no public
domains, the canonical staging database, 90-second draining, and bounded pools.
Blockchain receives its required RPC configuration; ecosystem receives bridge
credentials. Progression and collections receive neither RPC nor bridge/source
credentials. Operational intent is process-local. No permanent `OPS_CONFIRM` or
`RESTORE_TARGET_URL` was configured. Archives and raw operational evidence remain
private and ignored. Committed evidence contains only safe counts and hashes.
The temporary operator SSH key was revoked after evidence collection.

The genuine `SIGNED_VS_LEGACY` identity conflict remains unresolved. The 43 Bounty
entry events remain intentionally unattributed. Production topology and its
running application were checked read-only; no production gate was attested
from staging evidence.

## Validation

The final `npm run release:check` passed: **584 unit tests** and **837 database,
HTTP and browser assertions**, with lint, formatting, type checking, build,
fresh migrations, and fixture verification. Coverage was not reduced. The
earlier readiness-fix release encountered one browser screenshot timeout; its
unchanged rerun passed. The continuation fix and final release both passed the
full suite. Anonymous populated-route checks exposed zero private identity
values; these checks do not satisfy the separate authenticated PRIVACY_AUTH gate.

No production application, bridge, environment variable, worker, import,
chain index or gate evidence was changed. Its final read-only report identifies
`c764e2810715be0608e5fadc47d45a6a391ba674` and `NOT_READY`, with five critical
gates verified, 15 critical blockers, 11 optional warnings and three failed
gates. Production retains its original 14-service inventory.
