# Unified discovered total (Field Guide v3)

Discovered is the token-ID union of currently owned Squigs across active verified
wallets and already attributed, non-retracted collector lifetime discoveries.
Each token contributes once. Full provenance reconstruction is not an additional
eligibility filter for this collection metric. Acquisition-period evidence stays
separate and is not fabricated or backdated.

Profile counters, the discovery gallery, traits, historical sets and completion
use this same union. Current-holding sets use only current holdings. Rebuilding
materializes missing current discoveries transactionally, dating them no earlier
than wallet verification/observation, so subsequent sales retain encounters.
Existing attributed history survives changed credentials; linking a wallet does
not import arbitrary past wallet observations as personal history. Canonical
reorg/correction invalidation still removes retracted historical records.

This supersedes the V2 filtering rules in field-guide-v2.md. It does not modify
source history or invent a specific live count. If the existing attributed set
contains 315 unique tokens and current holdings are a subset, completion uses 315.

Deploy compatible web/workers, then use the staging-only **Recalculate my Field
Guide** button on /me. It seeds V3 and rebuilds the signed-in collector without a
Railway console. V1/V2 snapshots and audits remain; no schema migration is needed.
For all collectors, use the existing approved collections seed/rebuild procedure.
No production replay or deployment is performed by this change. Rollback reads
preserved older-version snapshots and requires the standard reconciliation gates.
