# Production recovery — 2026-10-31 (America/Toronto)

## Scope and initial evidence

The owner authorized production UglyDex repairs, including variables and data
initialization. UglyBot services and source databases must remain unchanged.

Production runs main `b93f92c5022cef876b3b4e1e0f5f46cb6edc5cb9` (PR 54),
deployment `27c2e195-8d0e-4dfc-968e-ee5cba6f681a`. PRs 49–54 are merged;
the remaining floating-panels branch only removes gallery entry points and does
not explain missing production data.

The opt-in read-only diagnostic measured 4,444 catalog tokens, zero current
ownerships, zero transfers, no chain cursor, no worker controls/heartbeats, zero
collection snapshots and zero collector activity. Two collection jobs and 4,446
progression jobs had never been attempted. Environment and database binding both
matched production. This establishes missing production initialization, not a
failed login or a merely stale frontend cache.

## Completed verification and changes

- Correct production OAuth origin/callback; owner corrected Discord client
  credentials and confirmed successful login.
- PR 54 adds OpenSSL/CA certificates and bounded, opt-in read-only diagnostics.
  Deployment succeeded; previous Prisma OpenSSL detection warnings disappeared.
  The diagnostic flag was returned to false for the next deployment.
- Offline and live production preflight passed schema checksum/drift, deployment
  binding, RPC chain/contract/deployment-boundary checks, all configured external
  read-only source connections, PNG rendering and canonical artwork fetch.
- Refreshed integration validation in UglyDex only. External queries use validated
  read-only transports; no source credentials or raw source rows are in this report.
- Verified scheduled daily/weekly/monthly volume backups and enabled PITR in the
  dedicated UglyDex Database dashboard. Two additional on-demand backup requests
  did not produce visible new inventory entries; neither is claimed successful.
- Created an additional private custom-format logical backup on the existing
  UglyDex database volume, before historical import. File permissions are 0600;
  size 1,880,923 bytes. Both archive listing and full SQL extraction to `/dev/null`
  succeeded. This is readability validation, not a new restore drill. The archive
  is on the database volume; independently stored scheduled backups/PITR remain
  the protection against volume loss.

Backup operator path: `/var/lib/postgresql/data/uglydex-pre-recovery-20261101.dump`.
SHA256: `89cdc85d251a37ca91d45a9e779ccaa5ac5c632ef7e5f48b21813f30518b10f9`.

## Recovery in progress

Used the existing `production:backfill --execute` orchestrator, with per-command
production intent and the verified database fingerprint, inside the existing web
service console. No permanent mutation-confirmation variables were set. Catalog
stage completed without changing any of the 4,444 canonical records. Transfer
indexing started at the independently verified deployment block 25,342,921 and
preserves its durable checkpoint. Subsequent stages and live worker activation
must be verified separately; an incomplete scan is not current ownership proof.

The first 21 transfer batches paused without error at block 25,363,920. The
finalized target observed then was 26,316,781. A separate backfill dependency
defect was confirmed: `queueCollections` enqueues progression after the former
progression stage had drained. The corrected stage sequence runs collections
before progression. A pause/resume orchestrator regression fails with the old
sequence (two stranded jobs) and passes with the corrected sequence. Stage IDs,
existing checkpoints, admission checks and source ledgers are unchanged.

No new worker services have been provisioned. Earlier automatic approval review
rejected adding infrastructure because of scope/cost; explicit provisioning
approval remains outstanding. No cursors or historical evidence were reset.

## Local validation

Diagnostic regression tests (2), targeted ESLint, TypeScript through the production
build, production build and diff whitespace checks passed. The broader unit run
passed 995 tests; 17 browser tests in two suites could not start because Chromium
was unavailable. Browser download returned an invalid archive. This is an
environment limitation, not a passing browser regression run.

The isolated database regression runner could not initialize here: the direct
tsx entrypoint failed its IPC setup, and the Node loader entrypoint reached
PostgreSQL but refused the root runtime. Preparing a disposable non-root copy
was blocked by unsupported ownership changes. The equivalent orchestrator unit
regression is executable; the database regression is retained for CI.
