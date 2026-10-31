# Replay repair and release gates

## Confirmed failure and repair

Main `dddc284fd1cdff435a9f8904a4d0f02c4cfaff12` includes PR #49. Its final
PR validation run 41196965923 failed at `REPLAY_UNSTABLE`. Production Railway
reported SUCCESS for that merge; deployment success did not establish replay safety.
The earlier technical audit's pending/draft statements are historical checkpoints.

A confirmed semantic drift exists in discovery materialization. A current holding
without a saved discovery used `possession:<sourceKey>` as its evidence period.
Once collections saved it, the same observation used `discovery:<sourceKey>`.
Progression hashes fact metadata into XP grant IDs, so this transition can revoke
and replace a grant without any change in ownership evidence. The repair uses the
persisted identifier for both states and retains explicit historical period IDs.
A regression fails on the original implementation and passes with the repair.
The isolated DB test also checks unchanged facts and zero created/revoked grants.
Existing grants keyed with the old transient identifier may be reconciled once
during an explicitly approved reevaluation. Review those ledger transitions; the
repair does not authorize a production replay or erase prior grant records.
Full A/B replay is still required; this finding alone does not prove the absence
of other drift.

Replay diagnostics now preserve the specific comparison error, log only changed
table names, and upload sanitized fixture fingerprints before cleanup. Raw identity
records and credentials are excluded. The comparison remains strict: no extra
semantic columns are excluded to make the test pass.

## Reviewable production gate proposal — not applied

- GitHub repository: `GuyLeDouce/UglyDex`, branch `main`. Require pull requests and
  the existing `checks` and `identity` status checks. Resolve their exact check-run
  identities from a successful PR before setting branch protection. Require the
  branch to be up to date. Review existing administrator bypass rules rather than
  assuming they are absent. No protection settings have been changed.
- Railway project: `Ugly Bot` (`b9823dd4-e398-4aaa-b266-069ca9e604b1`).
- Environment: production (`bcdfc79e-f8e2-4745-99b5-b3c67e4b75d9`).
- Service: UglyDex (`29c00191-5f48-422c-a349-9ad38cb96127`).
- Proposed setting: `source.checkSuites`, currently `false`, to `true`.
- First demonstrate with a disposable failing branch that a failed check blocks
  promotion. Do not deliberately fail main as a test.
- Do not change the tracked branch, environment variables, worker controls or
  pre-deploy migration command as part of this setting change. Inspect any staged
  Railway patch before approving it so unrelated changes are not committed.

These are production controls and need explicit approval under this task's scope.
No merge, deployment, migration, backfill, worker activation or production replay
is part of the code PR. A failing replay test alone does not justify an automatic
rollback or deletion of historical records.

## Read-only data triage

`collector-data-review.sql` contains aggregate-only queries in a repeatable-read,
read-only transaction with a 15-second statement timeout. Run first against the
isolated fixture or an approved disposable restore, using a read-only role.
It has not been run against production. Results are candidate counts, not automatic
correction instructions. The narrow shell query can miss cases involving older
credentials or identities; investigate provenance before expanding it.

For any affected record, separately review credential history, observation dates,
source/retraction state and collector merges. Prepare an explicit before/after list
and recovery procedure before requesting approval for a correction. Never delete
all discoveries on an unclaimed profile based on the aggregate query.

## Next implementation gates

1. Require a green full replay/database/browser suite on the repair commit.
2. Establish baseline candidate counts and ranking queue age without mutation.
3. Implement single-snapshot collector summary reads with a concurrent-transfer
   regression; retain the same 4,444 catalog and attribution definition.
4. Expose actual queued/running/failed/completed recalculation state using existing
   jobs, with duplicate suppression and reconnect support. Avoid invented percent
   progress and do not enable the endpoint in production implicitly.
5. Surface snapshot freshness and explain current versus attributed historical
   discovery consistently in dashboard, profiles and share views.

Field Guide already has missing-trait, undiscovered and set-advancement navigation,
closest sets, and a last-evaluated timestamp on its overview. Extend those existing
components rather than building duplicate browsing or passport systems.
