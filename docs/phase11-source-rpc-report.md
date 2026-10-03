# Phase 11 source connectivity and RPC repair — 2026-09-27 UTC

Application repair: `d4d74242e95e3963ef82a830360902059fe5732a`, deployed to
UglyDex staging and three source bridges. Branch: `phase11-launch-evidence`.
Starting application/evidence checkpoints were `0687d01` / `3b62207` with a clean
tree. The documentation commit containing this report is the new evidence
checkpoint. Production web remains on `c764e2810715be0608e5fadc47d45a6a391ba674`.

**No gate-approved production launch occurred.** No legacy source pilots/imports,
identity reconciliation, production chain backfill, progression/collection replay,
worker enablement, Customs or Editions imports were performed. Local fixture
replays in the release suite are not deployment evidence. Manual staging Transfer
indexing and its existing provenance projections were the only backfill work.

## Source mapping and readers

Eight physical databases serve nine explicitly configured logical connections.
The registry requires 26 tables; 25 exist, with every required column present.

| Physical database/service    | Logical connection(s)                                  | Present/required tables | Reader result                 |
| ---------------------------- | ------------------------------------------------------ | ----------------------: | ----------------------------- |
| Ugly Bot / Holders Side      | WALLET_LINKS_DATABASE_URL                              |                     1/1 | Existing reader unchanged     |
| Ugly Bot / Team Side         | UGLYBOT_DATABASE_URL                                   |                     3/3 | Existing reader unchanged     |
| Ugly Bot / Prizes            | UGLYBOT_PRIZES_DATABASE_URL                            |                   10/10 | Existing reader unchanged     |
| Ugly Bot / NFTs Claims       | UGLYBOT_CLAIMS_DATABASE_URL                            |                     2/2 | Existing reader unchanged     |
| Ugly Bot / Points Mapping    | UGLYBOT_POINTS_DATABASE_URL                            |                     1/1 | Existing reader unchanged     |
| The Gauntlet / Main          | GAUNTLET_DATABASE_URL                                  |                     1/2 | New authorized reader created |
| The Gauntlet / Survival      | GAUNTLET_SURVIVAL_DATABASE_URL                         |                     4/4 | Existing reader unchanged     |
| The Gauntlet / Shared Images | GAUNTLET_IMAGE_DATABASE_URL; IMAGE_SUBMIT_DATABASE_URL |                     3/3 | Existing reader unchanged     |

The only absent table is `public.gauntlet_online_reward_events`. It was neither
created nor granted. `onlineRewards` is UNAVAILABLE; `gauntlet_runs` remains usable.
The [earlier inventory](operator/phase11-reader-review/README.md) retains the exact
table lists and reviewed SQL.

Only Gauntlet main's `uglydex_reader` was created, at 03:40 UTC, using the reviewed
narrow proposal and a generated password delivered through memory/stdin. Grants:
CONNECT to its real `railway` database, USAGE on public, SELECT on
`public.gauntlet_runs`. It defaults to read-only transactions and a five-second
statement timeout. Login was tested. Superuser, database/role creation, replication
and bypass-RLS attributes are false; no privileged memberships were added. Existing
bot accounts and the seven existing reader roles were untouched.

Live bridge catalog checks returned **VERIFIED_READ_ONLY for all nine logical
connections**: read-only transaction on, superuser false, effective table/column
writes false, unsafe database/schema ownership or creation/membership/security-
definer checks false. Authenticated schema inspection and aggregate reads succeeded
for the available tables. No permissions were tested by writing source rows.

## Deployed bridges and transport

| Staging bridge instance | Upstream project/environment | HTTPS hostname                                            | Deployment |
| ----------------------- | ---------------------------- | --------------------------------------------------------- | ---------- |
| UglyBot                 | Ugly Bot / production        | uglydex-uglybot-bridge-staging-production.up.railway.app  | SUCCESS    |
| Gauntlet                | The Gauntlet / production    | uglydex-gauntlet-bridge-staging-production.up.railway.app | SUCCESS    |
| Images                  | The Gauntlet / production    | uglydex-image-bridge-staging-production.up.railway.app    | SUCCESS    |

These instances serve the staging client, although the upstream databases live in
their projects' production environments. Each has its own generated staging secret,
only its group's private reader URLs, one replica, and no UglyDex writable database.
Their committed source was packaged as isolated Docker bundles without the web
service's migration/start configuration. Railway rejected a new deprecated
config-file-path override; supported service settings and Dockerfile auto-detection
were used instead. No upstream application service was redeployed.

All nine logical sources were reachable and authenticated through HTTPS with normal
certificate verification. Public raw PostgreSQL TLS remains fail-closed; no
certificate or hostname bypass was introduced. Internally, PostgreSQL traffic uses
Railway's encrypted authenticated private WireGuard network, without an additional
PostgreSQL TLS layer. This explicit transport boundary and the HMAC replay-cache
restart limitation are documented in [source-bridges.md](source-bridges.md).

Live authentication checks on **each** bridge: valid request 200, replay 401,
invalid signature 401, unknown/session feed 404. The Gauntlet online-rewards page
returned 422 `FEED_UNAVAILABLE`, without a source row read. Runtime endpoints expose
fixed feed/lookup definitions, parameterized values, bounded keyset pages and safe
schema/permission aggregates; no client SQL or arbitrary identifiers are accepted.

From the deployed staging application, `integrations:validate` and `launch:sources`
passed connectivity/schema/role validation for the available feeds. Actual stored
states: **16 READY, 1 UNAVAILABLE (onlineRewards)**. READY here means schema/read
availability, not approved pilot quality or complete history. All five source launch
gates remain PARTIAL until their later evidence requirements are met.

Production's existing web application does not yet consume these bridges. Before
production integration rollout, provision separate production instances/secrets
and validate the approved application revision. Do not reuse staging secrets.

## Replacement RPC and preserved provenance

Provider: archive-capable Alchemy, `eth-mainnet.g.alchemy.com`; no API key or full
URL is retained here. Chain ID 1, deployed bytecode, ERC721 support, historical
block/log access and pinned ownerOf were independently checked. Bytecode is absent
at **25,342,920**, present at **25,342,921**. Token 1's mint log was rechecked at
**25,349,689**. Final probes were repeated against the deployed repair revision.

Configuration: `TRANSFER_BLOCK_BATCH=1000`, `RPC_CONCURRENCY=1`, `RPC_RETRIES=4`,
`RPC_TIMEOUT_MS=15000`, `REORG_REWIND_BLOCKS=128`. No indexer code or retry limit
increase was needed. The existing cursor and ledger were preserved throughout.

| Measured stage                                               | Cursor before → after   | Successful batches | RPC requests | Retries | HTTP 429 |   Duration |
| ------------------------------------------------------------ | ----------------------- | -----------------: | -----------: | ------: | -------: | ---------: |
| Archive probe and initial bounded batches                    | 25,352,920 → 25,355,920 |                  3 |          906 |       0 |        0 |  71,775 ms |
| Remaining finalized history, including provenance derivation | 25,355,920 → 26,066,169 |                711 |        6,828 |       0 |        0 | 591,704 ms |
| Post-deployment catch-up                                     | 26,066,169 → 26,068,941 |                  3 |           33 |       0 |        0 |   2,571 ms |

Total measured resume windows: **717 successful batches, 7,767 RPC requests,
zero retries, zero 429s, 666,050 ms**. The first window includes nine independent
archive-probe requests. Later full owner verifications and final archive probes
are separate and excluded from that request/duration total.

| Staging provenance metric             | Starting checkpoint | Final observation |
| ------------------------------------- | ------------------: | ----------------: |
| Indexed cursor                        |          25,352,920 |        26,068,941 |
| Stored finalized height               |                   — |        26,068,941 |
| Transfer events                       |               3,405 |        **11,052** |
| Mint events                           |               2,035 |         **4,444** |
| Unique token IDs                      |               2,035 |         **4,444** |
| Provenance-complete Squigs            |                   — |         **4,444** |
| Pinned ownerOf matches                |                   — |   **4,444/4,444** |
| Unavailable owner reads / mismatches  |                   — |         **0 / 0** |
| Missing mints / missing metadata      |                   — |         **0 / 0** |
| Dirty provenance / verifier anomalies |                   — |         **0 / 0** |
| Stored cursor lag                     |                   — |             **0** |

`chain:status`, `provenance:verify` and `launch:provenance` were executed. Full
ownership verification was repeated after deployment/catch-up at block 26,068,941.
Coverage is CAUGHT_UP relative to that stored finalized boundary, not a promise of
continuous indexing. The chain continues advancing while workers remain disabled.
No provenance rows were copied to production. The final staging metadata query
observed 266 total activity rows; this count is not a legacy import result. Existing
provenance projection code can create ownership activities. No source import
command was executed.

## Validation and defects addressed

The repair replaces an observed cross-project certificate/hostname incompatibility
with authenticated HTTPS transport and preserves direct PostgreSQL operation for
valid local/private/operator routes. It also makes the observed missing optional
Gauntlet feed a feed-level availability result instead of disabling runs.

Regression coverage includes HMAC validity/tampering/skew/replay, rate/page/body
limits, unknown feeds and arbitrary identifier rejection, schemas/unsafe roles,
missing optional rewards, source failure and error redaction, request timeout,
HTTPS-only configuration, precise composite timestamp cursors, correction detection
and canonical import idempotency using disposable fixture databases. Existing
direct-PostgreSQL tests still pass.

- `release:check`: **PASS**, 547 unit tests across 15 files and **830 DB/HTTP/browser
  assertions**. New coverage adds 38 unit tests and 16 database assertions over the
  previous checkpoint.
- Lint, formatting, type checks, production build, fresh migrations and existing
  fixture security/privacy/replay suites passed.
- Dependency audit: **0 vulnerabilities**. Secret scan: **0 findings** across
  365 working files and 585 historical blobs at the code checkpoint.
- The first bridge fixture changed completeness state used by later UI tests; it
  was isolated after those tests. A Windows sandbox fixture-cleanup restriction
  required process-control permission; abandoned fixture processes were removed,
  and the complete rerun exited successfully.
- Real deployed staging smoke: **10/10 PASS**, including health/readiness, explorer,
  token 1, invalid resources, unauthenticated admin denial and PNG share response.
- Temporary Railway SSH authorization was revoked after final checks.

## Launch decision and next authorized scope

As of the final checks around 13:13–13:14 UTC:

| Environment            | Decision      | VERIFIED | PENDING | PARTIAL | DEGRADED | FAILED | Blocking gates remaining | Optional warnings |
| ---------------------- | ------------- | -------: | ------: | ------: | -------: | -----: | -----------------------: | ----------------: |
| Staging (`d4d7424`)    | **BLOCKED**   |    **8** |  **17** |   **5** |    **1** |  **0** |                   **12** |            **11** |
| Production (`c764e28`) | **NOT_READY** |    **5** |  **21** |   **2** |    **0** |  **3** |                   **15** |            **11** |

Both `launch:check` commands returned **1**. No evidence was bulk-reset or copied
across revisions. Historical backup/restore evidence remains retained; staging's
new revision still needs its applicable backup/recovery evidence.

Five staging blocking gates closed versus the starting checkpoint: **ARCHIVE_RPC,
START_BLOCK, MINT_COVERAGE, OWNERSHIP_CONTINUITY, OWNER_OF**. DATABASE, MIGRATIONS
and WEB_DEPLOYMENT were revalidated on the deployed revision. Source gates
WALLET_LINKS, UGLYBOT, GAUNTLET, SURVIVAL and IMAGE_SUBMIT are PARTIAL.

Exact staging blockers: WORKERS, BACKUP, RESTORE_DRILL, REATTRIBUTION, ACTIVITY,
DUPLICATE_REVIEW, PROGRESSION, COLLECTIONS, DERIVED_REPLAY_STABLE, HANDOFF,
PRIVACY_AUTH, REAL_DEVICE_SHARE. REATTRIBUTION is DEGRADED because **one attribution
job remains pending**; it was not cleared or processed in this task. No worker
control records are enabled; absent controls default to DISABLED.

Exact production blockers: WORKERS, ARCHIVE_RPC, START_BLOCK, MINT_COVERAGE,
OWNERSHIP_CONTINUITY, OWNER_OF, REATTRIBUTION, ACTIVITY, DUPLICATE_REVIEW,
PROGRESSION, COLLECTIONS, DERIVED_REPLAY_STABLE, HANDOFF, PRIVACY_AUTH,
REAL_DEVICE_SHARE. Its previously observed source failures have not been relabeled
as production successes based on staging bridge evidence.

Both environments' eleven unresolved optional keys: WALLET_LINKS, UGLYBOT,
GAUNTLET, SURVIVAL, IMAGE_SUBMIT, IDENTITY_REVIEW, EXTERNAL_OG, CUSTOM_MANIFEST,
EDITION_MANIFEST, EDITION_CONTRACTS, HOLDER_TIERS.

**Staging is ready for the bounded source-pilot portion of Phase 11 for the 16
available feeds. It is not cleared for full imports or launch.** Review each pilot's
normalization, attribution, privacy and duplicate findings before authorizing its
historical import. Keep onlineRewards unavailable until legitimate upstream source
data exists. Production bridge deployment, later source/reconciliation/replay/
handoff/recovery evidence and remaining auth/device gates remain future launch
work; engagement development is not recommended.
