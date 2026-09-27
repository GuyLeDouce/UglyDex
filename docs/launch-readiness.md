# Launch evidence, not configuration

Phase 9 separates code readiness (`release:check`) from deployment evidence (`launch:check`). No production credential or real device was supplied during implementation. The unconfigured workspace reports **NOT_READY**, all 31 gates PENDING, and `launch:check` exits 1. Fixture tests never close production gates.

## Persistent policy

`LaunchGate` stores VERIFIED, PARTIAL, PENDING, DEGRADED or FAILED, check time, summary, evidence SHA256, private notes, APP_ENV, database fingerprint and commit. Blocking policy lives in `src/domain/launch.ts`; an operator cannot waive a critical gate by changing input JSON. Records are audited. Evidence expires after 24 hours and becomes PENDING when the environment, database or code revision differs. Supply `APP_COMMIT` if Railway does not supply `RAILWAY_GIT_COMMIT_SHA`.

`/admin/production` and `launch:status` display the same projection. `launch:report` emits JSON. `/api/admin/launch` exports JSON or `?format=text`; it requires the existing Discord-admin session and sends private/no-store/noindex headers. Notes, actor IDs, database binding, source extracts, Discord IDs and wallet linkage evidence are excluded. Reports are as-of evidence, not a promise of continuous health; the adjacent reliability dashboard shows live degradation.

Overall policy:

- NOT_READY: at least one critical gate is pending or partial.
- BLOCKED: a critical gate is failed or degraded.
- READY_WITH_WARNINGS: every critical gate verified, optional evidence incomplete.
- READY: all gates verified.

Critical: database, migrations, web, four workers, backup, restore, archive RPC, start block, mint coverage, ownership continuity, ownerOf, attribution, activity review, duplicate review, progression, collections, replay stability, historical/live handoff, privacy/auth and real-device sharing. Optional: individual unavailable legacy histories, unresolved identity review where excluded from claims, external crawler previews, official Customs/Editions/contracts and branded holder tiers. Optional absence never permits invented totals or rewards. A known privacy/auth flaw or unexplained source double counting blocks launch.

## Commands

| Command                                             | Action                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `launch:status`, `launch:report`                    | Read stored evidence; safe without configured DB, reporting PENDING.                                       |
| `launch:check`                                      | Evaluate gates and rehash existing Replay A/B inputs/results; nonzero until critical evidence passes.      |
| `launch:verify`                                     | Safe database, migration, current heartbeat and stored provenance checks; no import or scan.               |
| `launch:rpc`                                        | Mainnet/ERC721, archive bytecode binary search, exact boundary and bounded historical Transfer probe.      |
| `launch:provenance`                                 | Full existing pinned ownerOf/provenance verification, persisting owner gate and printing anomalous tokens. |
| `launch:spot`                                       | Deterministic low/high/OG/Legendary/transfer-count/attributed/burn sample; first/last raw log comparisons. |
| `launch:sources`                                    | Read-only schema/privilege inspection and bounded-time count/date queries; never writes externally.        |
| `launch:audit`                                      | Source/import, identity, progression/collection and duplicate-candidate aggregate report.                  |
| `launch:explain -- --activity <UUID>`               | Explain exact identity/effective-time attribution without exporting raw identity values.                   |
| `launch:replay`                                     | Guarded complete Replay A/B comparison; see replay-validation.md.                                          |
| `launch:handoff -- --feed <feed>`                   | Guarded bounded cursor/reconciliation/cursor probe after reviewed backfill.                                |
| `launch:attest -- --file <private-file> --reviewed` | Record reviewed manual evidence for permitted gates. Requires launch operational intent.                   |

For manual gates, store reviewed evidence in protected operator storage and pass `{ "key": "RESTORE_DRILL", "status": "VERIFIED", "reference": "incident-123", "sha256": "<64 lowercase hex characters>", "notes": "Private operator context" }`. URLs, arbitrary fields and blocker overrides are rejected. This is an operator attestation, not automatic verification of the external artifact. The referenced hash must match the reviewed artifact. Automatic gates such as replay, ownerOf and migration integrity cannot be manually marked verified through this command.

Use the existing environment/database-bound confirmations: `replay` for replay, `pilot` for handoff, `launch` for manual attestation. No new mandatory secrets. Keep real outputs in ignored `operational-evidence/`, `production-exports/` or `.data/`; do not commit raw reports or sensitive notes. A safe report still needs human review before publication.

## Evidence collection order

Checkpoint/release → isolated staging and migrations → database binding → backup/restore → RPC boundary → transfers/provenance → source schemas/roles → bounded pilots → reviewed full backfill → identity review → Replay A/B → handoff probes → workers individually → privacy/auth → physical devices → external OG → launch check. No upstream write freeze: existing source cursors and rotating reconciliation capture new/changed records. Quiesce UglyDex writers during replay; changed inputs invalidate proof.

RPC evidence persists deployment number/hash, first mint observed in the bounded probe, finalized reference, duration and a provider-origin hash. It does not store RPC URLs. If the first mint is outside the bounded deployment probe, START_BLOCK stays PARTIAL; inspect further bounded ledger evidence rather than expanding to an automatic giant scan. Archive binary search assumes this immutable contract's bytecode presence is monotonic. Provider throughput, unusual archive behavior and full coverage still need actual credentials.

All external operational gates remain PENDING until executed on the intended deployment. A successful local test does not count as a real restore, wallet session, external preview or Railway measurement.

## Phase 10 execution — 2026-09-26

At revision `811314b`, the unconfigured operator environment still reports NOT_READY: 31 PENDING gates, 20 blocking and 11 optional warnings. No production gate database is configured, so remote records were not inspected or reset. No gate was attested from fixture results. See [the Phase 10 access inventory and actual results](phase10-report.md).
