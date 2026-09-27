# Replay A/B proof

## Phase 10 evidence boundary

Production Replay A and B remain PENDING as of 2026-09-27 UTC. Both deployed databases now exist, but legacy source imports and reviewed identity inputs are not ready. The complete release check passed at `c764e28`, including local fixture Replay A/B with zero semantic differences; those fingerprints are not production evidence. Both v1 rulesets are unchanged. See [phase10-report.md](phase10-report.md).

Run `npm run launch:replay` after input backfills and reviewed identity attribution settle. In staging/production require `OPS_CONFIRM=<environment>:replay`, matching `OPS_DATABASE_FINGERPRINT`, registered deployment identity and known commit. Disable all four workers and Edition contracts. Pause other UglyDex import/reconciliation writers; upstream services remain read-only and need no freeze.

The command takes the existing backfill and worker advisory locks plus the Reloaded chain lock. It seeds existing catalogs, drains attribution, then runs complete progression and collection queues twice. Existing engine cursors/unique grants/milestones remain authoritative. Cosmetics derive from these states at read time; share rendering reprojects state rather than maintaining a permanent PNG snapshot.

Each pass records sorted JSONB SHA256 digests and counts for Collector/Squig progress, XP ledger, both achievement tables, progression milestones, Squig/trait discovery, set state, collection snapshots and collection milestones. SQL cursors stream 1,000 rows at a time. A repeatable-read transaction keeps each fingerprint set coherent. Input digests cover canonical assets/traits, raw transfers, ownership/provenance, identities, activities, source completeness, rulesets and cosmetic configuration.

Only explicit processing clocks (`calculatedAt`, `evaluatedAt`, ledger `createdAt`) and surrogate discovery IDs are omitted from derived comparison. Award/acquisition/revocation/milestone dates, XP, completion, evidence and quantities remain semantic. Input fingerprints are taken before A, between A/B, and after B. Any input change, lost lock, job failure or output difference refuses proof. Replay B is not allowed to silently bless an unstable Replay A.

`ReplayProof` persists run status, input hash, both per-table fingerprints, differing table names and safe error code. Incomplete runs never certify launch; the next guarded run marks older unfinished proofs INTERRUPTED and runs a new pair. Queue checkpoints survive process loss. An interruption may leave valid partial derived work, which existing idempotent engines can resume; no reset or raw-source deletion is needed.

`DERIVED_REPLAY_STABLE` is critical. It cannot be manually attested. `launch:check` rehashes inputs/results and changes the gate to PENDING when evidence has since changed. Evidence is also bound to commit/environment and expires after 24 hours. A stable empty fixture cannot prove production provenance: independent catalog, mint, continuity, ownerOf, activity and deployment gates remain mandatory.

Local fixture proof and production proof must be reported separately. Test-generated fingerprints live in ignored `.data/phase9-replay.json`; no fixture fingerprint is a production metric. Production Replay A/B remains PENDING without real evidence/access.
