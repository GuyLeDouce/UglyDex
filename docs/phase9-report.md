# Phase 9 — Production Evidence & Launch Proof

Phase 8 checkpoint: **4fe652f**, `Phase 8: rollout safety, reliability and edition indexing`. Before committing, 69 files were reviewed, staged names/large artifacts checked, and 473 unit tests, lint, typecheck, formatting and secret/history scan passed. No existing work was discarded.

## Implementation

- Persistent 31-gate launch registry, strict critical/optional policy, deployment/database/commit binding, 24-hour expiry and audited changes. Admin dashboard plus safe JSON/text exports. Missing evidence stays PENDING; local code checks do not certify production.
- Safe local launch verification, evidence-backed archive RPC boundary probing, full pinned provenance verification and deterministic raw-log spot audit. Real RPC values have not been guessed or seeded.
- Source schema/privilege/count/date probes, expanded pilot comparison counts, empty/lock-busy pilot rejection, cross-feed monetary duplicate candidates and exact-identity/effective-time attribution explanations.
- Complete guarded Replay A/B using existing progression/collection engines, streamed semantic fingerprints, stable-input checks, persisted proof and current-state revalidation. Processing timestamps are excluded; earned dates and real semantic changes remain material.
- Bounded historical-to-live handoff evidence, existing independent worker controls, configurable database pool limit and worker cadence. No vendor-specific tuning without measurements.
- Backup inventory now includes gate/replay evidence. Sensitive operational export locations are ignored. Reviewed manifests and official Edition registry/indexers remain required; no speculative adapters or official catalog rows were added.

## Database and commands

Additive eleventh migration `202610010011_phase9`: `LaunchGate` and `ReplayProof`. No canonical metadata, NFT contract, progression ruleset or `uglydex-collection-v1` formula changes.

Commands: `launch:status`, `launch:report`, `launch:check`, `launch:verify`, `launch:attest`, `launch:rpc`, `launch:provenance`, `launch:spot`, `launch:sources`, `launch:audit`, `launch:explain`, `launch:replay`, `launch:handoff`. Existing `release:check` adds safe launch status but does not require production credentials. Routes: upgraded `/admin/production`, `/api/admin/launch`, `/api/admin/activity/[id]/explain`.

## Actual evidence and limitations

The unconfigured workspace's launch status is **NOT_READY: 31 PENDING, 0 VERIFIED, 0 FAILED**: 20 blocking gates and 11 optional warnings. `launch:check` correctly exited 1. All critical external gates remain outstanding. Database/RPC/source URLs, public deployment URL and Railway token were absent. No actual Ethereum/provider/start-block verification, production transfer backfill, legacy schema/pilot/full import, real-user identity decision, production replay, staging deployment, real archive restore, Railway capacity measurement, physical-device test or external crawler test was performed. These are PENDING, not zero-count successes.

Official manifest/contract status: **PENDING**. No authoritative manifest was supplied; official catalogs remain unseeded (zero Customs/Editions/contracts introduced). Existing generic ERC721/ERC1155 fixture indexing is retained. Holder thresholds are database-driven in the available UglyBot source and remain PENDING without authoritative configuration. UglyBot, The Gauntlet and ImageSubmit checkouts remain unchanged.

Dependency audit: **0 vulnerabilities across 689 dependencies**. Secret scan: **476 historical Git blobs and the working tree, zero findings**; operational artifact ignore rules were checked explicitly. Current limitations include five-second source count timeouts, duplicate-candidate heuristics requiring human source-reference review, 24-hour evidence recency, immutable-code binary-search assumptions, local-only fixture capacity numbers and unchanged Phase 8 Edition adapter bounds. Manual attestations identify reviewed external evidence; they do not automatically verify the supplied artifact itself.

## Final local validation

Unit suite: **505 tests across 13 files**. The dedicated database/catalog run passed **509 assertions**. The final combined release suite passed **814 database/HTTP/browser/catalog assertions**, including fresh migrations, privacy, admin authorization, image fallback, mobile layout, complete fixture Replay A/B, current fingerprint revalidation, semantic-tampering detection and progression/collection failure recovery. **Lint, formatting, typecheck, production build and `release:check` all passed.** Temporary web/database/PostgreSQL cleanup completed successfully. Production metrics and production replay fingerprints remain PENDING independently of these fixture results.

The final fixture Replay A/B had **zero differences across 11 derived tables**. It contained 18 Collector progression rows, 4,444 Squig progression rows, 515 XP ledger rows, 214 Squig discoveries, 58 trait discoveries and 19 collection snapshots. These are test-state row counts, not production statistics or awarded-achievement totals. Replay A took 188,343 ms and Replay B took 187,076 ms through collection completion; process RSS at those points was 465,981,440 and 451,440,640 bytes. These local fixture measurements are not Railway capacity results.

Input fingerprint: `32cda80d6f45b0a7b094c5f83292146e0c41f12dc365a90a9ffea08079221f6b`. Selected identical A/B fingerprints from this run:

| Derived state         | SHA256                                                             |
| --------------------- | ------------------------------------------------------------------ |
| Collector progression | `4ffcfcf66277039294262fd02ac41d8390da1479d6cf10d3723da95d317aa55b` |
| XP ledger             | `2e4dcaf9f3b755230b1f3399464c6e2b0311b59c5385337cf0b50de30fd30d95` |
| Squig discovery       | `010b637cf6806c166fa6f3b3aa2fce614e89e04f224dda12e7c2b2980cb5b853` |
| Collection snapshots  | `b97b334cb0e6fd1a5cc51af3aae63740021ab3964f79e96dc6a6d87431efae97` |

The complete local fingerprint artifact is ignored at `.data/phase9-replay.json`. Random fixture identities and fixture dates make hashes specific to this run; stability is assessed within the unchanged-input A/B pair. No production extracts, identity evidence or backups are included in this report or commit.

The Windows release runner emits Node DEP0190 for its fixed npm command arguments; no user input reaches the shell invocation. One intermediate build hit a OneDrive EPERM while deleting old generated output; removing only the verified workspace `.next` directory allowed a clean successful build. No source or database data was discarded.

A legacy browser assertion depended on live Pinata availability and timed out during this release. It now uses controlled PNG responses at the canonical Next image URL and explicitly injects a 502 to verify the accessible fallback. This checks browser delivery/fallback without claiming that a real gateway or deployed optimizer was externally validated. Server share-render image validation/fallback remains covered by the existing controlled tests; real artwork/crawler validation remains PENDING.

## Exact recommended Phase 10

Supply approved staging/production access and close the Phase 9 launch gates in runbook order: real backup/restore, archive deployment/mint/provenance proof, source roles and reviewed pilots/full imports, evidence-based identity reconciliation, stable production Replay A/B, historical/live handoff, staged workers, real-device auth/share and external previews. Review official manifests/contracts if supplied. Measure Railway before changing pool/cadence/RPC/render limits. Add only regression fixes or contract adapters justified by observed evidence. No quests, seasons, leaderboards, paid/financial mechanics, trading, minting or blockchain writes.
