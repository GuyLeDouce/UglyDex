# Field Guide v2: verified possession and coherent counters

## Cause

The profile counted all `SquigDiscovery.everOwned` rows. V1 completion instead
required CONFIRMED attribution, an exact CollectorOwnershipPeriod join, and a
complete, clean SquigProvenance record. Correctly signed point-in-time ownerOf
observations were excluded. V1 also discarded current ownerOf holdings whenever
transfer reconstruction was dirty, even though the current ownership index still
contained finalized ownership evidence.

## Correction

V2 retains the strict full-period branch and also accepts OBSERVED discoveries
only when their exact source observation still exists for the same token and
wallet, the credential is cryptographic (SIWE/SIGNATURE), and the observation's
discovery date falls within the verified credential interval. It does not infer
control before signature verification. Reorg deletion or INVALIDATED status
removes eligibility. Selling or unlinking does not erase valid past evidence.

Finalized ownerOf current holdings no longer depend on full transfer-history
reconstruction. Ledger-derived holdings still fail closed while dirty. Digested
Squigs remain excluded from current holdings. The profile counter, discovery
list and completion engine share the same discovery query. Unsupported recorded
history is shown as an explicit count awaiting verification, not silently
presented as earned completion. Traits and sets use the same qualifying tokens.

This is a versioned semantics change: `uglydex-collection-v2`. V1 snapshots/audits
are retained and are not presented as V2. No schema migration is required.

## Staging repair

After merging and staging deployment, sign in and open `/me`. Select
**Recalculate my Field Guide**. The authenticated POST accepts no target identity;
it rebuilds only the session collector. Same-origin, rate limit, staging-only
and registered database binding checks apply. No Railway shell is required.
The rebuild uses existing correction/audit/generation-locking behavior and
returns the actual discovery/trait counts. Reloading updates the profile.

For all collectors, use the existing approved `collections:seed` and
`collections:rebuild` operational flow with V2-compatible workers. Do not publish
a mixture of old workers and new web semantics. Production replay/deployment is
not authorized by this change. Rollback to prior code reads the preserved V1
snapshots, which must be reconciled with any intervening evidence changes using
the established replay gates.

## Validation limits

The disposable regression models 274 current holdings and 315 independently
verified observations with incomplete transfer history. It checks counter/
completion agreement, traits, current sets, sale retention, signature timing,
unlinking, deleted source evidence and invalidation. This is a fixture, not a
claim that all 315 records on the live user's account meet verification rules.
Live counts require the authenticated staging recalculation. DRIP balance refresh
is a separate integration concern and is unchanged.
