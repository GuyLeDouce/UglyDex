# Reproducible migration packaging

The October 17, 2026 read-only ledger inspection found migrations 1–11 applied
with CRLF in both staging and production. Migration 12 was applied with CRLF in
staging and LF in production. Migration 13 uses LF in both. The committed SQL
source is LF. These are byte differences only; normalizing CRLF to LF reproduces
the exact committed source hash for every migration.

`prisma/migration-bytes.json` records the reviewed source and applied hashes.
`scripts/package-migrations.mjs` validates all inputs before reproducing those
bytes. It rejects changed SQL, unknown profiles and unlisted migrations. It never
connects to a database or changes `_prisma_migrations`. Readiness still compares
the exact deployed file checksum to the ledger.

The Docker build packages migrations before building the application. Set the
build argument `MIGRATION_BYTE_PROFILE=staging` for the existing isolated staging
database. The default `production` profile matches the inspected production
ledger and is the baseline for a new database. `APP_COMMIT` must be the exact
candidate SHA at build time and runtime. `release-manifest.json` in the image
records that SHA, the profile and every packaged hash. Compare this immutable
file with runtime `APP_COMMIT` after deploying; a variable change alone does not
rebuild an image.

For an operator package outside Docker, export the exact commit with `git archive`
into a new disposable directory, then run:

```powershell
node scripts/package-migrations.mjs --profile staging
```

Do not package the working checkout or copy a historical staging directory. Run
the same command with `--profile production` only for a reviewed production
artifact. Build from that package and retain the generated manifest privately
with the release evidence. Fresh-checkout fixture tests exercise both profiles,
idempotency and rejection of modified SQL. The database test suite independently
applies all migrations and rejects checksum tampering.

For a new migration, add its reviewed source/output hashes to the manifest and
use LF in both profiles. Never amend an already applied SQL statement, change a
ledger checksum, or normalize database history to make a failing gate pass.
Any third database with a different ledger requires investigation before rollout.
