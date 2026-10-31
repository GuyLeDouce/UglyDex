# Automatic Field Guide recalculation

`npm start` launches a separate background process in staging. It seeds the current collection rules and queues **all existing collectors**, including discovered unclaimed wallets, linked users, private profiles, and former holders. It runs the same `rebuildCollection` calculation as the manual button. No sign-in is needed. Public current holdings of unclaimed profiles use the discovery mapping, but personal Field Guide evaluation uses active verified wallets only. Startup never creates personal discoveries from unverified holder mappings. Existing attributed history remains preserved for evidence-based review.

The web server starts immediately. Totals update progressively as batches of ten complete; launch does not imply every profile is already rebuilt. This does not import missing upstream history or create missing holder profiles: ownership indexing and the controlled holder-discovery backfill remain responsible for those.

## Configuration and rollout

- Staging: automatic by default when `APP_ENV=staging`.
- Production: explicitly set `COLLECTIONS_RECALCULATE_ON_START=true` in an approved rollout.
- Set `COLLECTIONS_RECALCULATE_ON_START=false` to disable the startup pass.
- Registered deployment/database binding must match; failures do not affect web readiness.
- Railway uses `RAILWAY_DEPLOYMENT_ID`, falling back to `RAILWAY_GIT_COMMIT_SHA`. Other hosts should set `DEPLOYMENT_REVISION` to a unique release revision. Without either, the checkpoint is per collection ruleset.

A durable `CollectionReplay` checkpoint queues each deployment once, in pages of 200. Replicas share the checkpoint and existing collector transaction locks. Restarts resume outstanding jobs without resetting the checkpoint. A new deployment queues everyone again. Five bounded retry attempts tolerate transient errors; persistent failures stay in the existing collection job/run diagnostics for repair and the collection worker or next startup to retry. SIGTERM stops between collector transactions. Existing continuous collection workers remain responsible for later activity.

Monitor `collections.startup_batch`, `collections.startup_complete`, and `collections.startup_retry` logs and `/admin/collections`. A replay checkpoint means enqueueing finished, not that all evaluations finished; the completion log is emitted only after the queue drains. Logs contain counts and checkpoint keys, no wallet or external identifiers.

No migration, production backfill, external source writes, or production deployment is performed by this change. To roll back, disable the flag or revert the code. Derived results and historical evidence are retained. Fix failed jobs and restart with the same deployment revision to resume.

## Failure isolation and diagnosis

Startup evaluates healthy work even when a collection or achievement evaluation fails. Failed jobs have three attempts per fresh replay; exhausted failures remain durable and are excluded from that startup pass, without blocking other profiles or later enqueue pages. A fresh deployment replay resets the retry budget as it queues each collector. New source evidence clearing a job error makes it eligible again. The ordinary workers/manual rebuilds can still retry exhausted jobs.

Serialization/deadlock deferrals are retried with bounded backoff. Five consecutive batches with no progress stop that attempt with `COLLECTION_STARTUP_STALLED`. After draining healthy work, any remaining failed jobs produce `COLLECTION_STARTUP_BLOCKED`, never a false completion event. Bootstrap exceptions still have bounded process-level retries. Shutdown is not logged as a failed recalculation.

The startup log and job/run rows now expose allowlisted error codes such as `DEPLOYMENT_IDENTITY_MISMATCH`, `RULESET_VERSION_BUMP_REQUIRED`, `UNKNOWN_CANONICAL_TRAIT_REQUIRES_VERSION`, or `P2028` (transaction timeout). Unknown failures remain `EVALUATION_FAILED`; raw database messages, query values and credentials are never logged. Inspect `/admin/collections` for actual deployment checkpoints, failed collection counts, collector achievement jobs, and achievement failures. A generic “paused” line alone cannot establish the underlying cause.

This change does not bypass environment binding or ruleset validation, delete failed work, or claim the live cause has been diagnosed without logs. For a stalled deployment, inspect its safe code and protected diagnostics; repair the indicated configuration/evidence issue and deploy/rebuild to retry.

## Protecting in-flight queue generations

Collection and progression evaluations lock their existing queue row with `FOR UPDATE` before reading evidence. An indexer enqueueing new evidence during a long repeatable-read evaluation now waits for that evaluation to commit, then creates or updates the next queued generation. Previously, that enqueue could change the row during evaluation and cause the final conditional delete to fail with a serialization conflict, rolling back all computed achievements. Subject advisory locks remain in place. New evidence is not discarded, transaction isolation is not weakened, and other subjects remain independent.

The isolated PostgreSQL regression pauses the real progression evaluator before its projection write and races an enqueue from a second connection. It verifies that evaluation commits, the incoming update remains queued, and a follow-up evaluation drains it. This reproduces a concrete conflict path; it does not prove which writer caused the supplied live deferrals.
