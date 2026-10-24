# Automatic Field Guide recalculation

`npm start` launches a separate background process in staging. It seeds the current collection rules and queues **all existing collectors**, including discovered unclaimed wallets, linked users, private profiles, and former holders. It runs the same `rebuildCollection` calculation as the manual button. No sign-in is needed. Current holdings of unclaimed profiles use the discovery mapping, never fabricated wallet credentials. Existing credential assignments take precedence, including revoked credentials.

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
