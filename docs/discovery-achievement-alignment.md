# Discovery achievement alignment

Collector discovery achievements and discovery XP now use the same unique current-plus-recorded-historical Squig union as the Field Guide. OBSERVED and CONFIRMED attributed history count; INVALIDATED/UNRESOLVED history does not. Current holdings remain eligible independently of incomplete transfer reconstruction. Sales, rebuys, linked-wallet transfers and credential changes do not duplicate or erase legitimate discoveries. OG/Legendary discovery achievements use canonical token metadata for that same union.

The defect was a second, stricter discovery query in progressionFacts requiring complete clean provenance and an exact ownership-period match. Correcting evidence ingestion does not change achievement thresholds, XP amounts or definition IDs. Existing stable discovery grant keys are reused, preserving deduplication and selected badge IDs. Squig mint/ownership-duration provenance gates and external activity attribution remain unchanged.

The authenticated staging recalculation endpoint now rebuilds collector progression after the Field Guide. The deployment startup pass seeds progression, atomically queues collector progression alongside collection jobs, and drains collector progression in bounded batches before reporting success. Persistent failures remain in progression diagnostics and retry on startup. Existing progression workers continue to process ongoing event changes.

At 315 discoveries, Walking Encyclopedia (250) should unlock; The Living Dex (500) should remain locked. OG/Legendary owned counters describe current holdings, while discovery achievements describe lifetime encounters and may legitimately differ.

No schema migration or external source write is needed. Merge and deploy to staging; its automatic startup pass repairs existing collectors, or use Recalculate my Field Guide for one signed-in collector. Production remains opt-in under the existing startup flag. No deployment or production database operation was performed during implementation. Reverting code restores the older filter on subsequent recalculation; source ownership records remain intact.
