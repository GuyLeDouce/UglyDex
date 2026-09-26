# Reliability evidence and internal targets

These are internal operating targets, not advertised SLAs. `/admin/production` combines readiness, deterministic subsystem states, data quality, worker observations and recent incidents. A missing observation is DEGRADED or DISABLED, never evidence of health.

| Signal           | Rule / target                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core worker      | DISABLED if control absent/disabled; FAILED on recorded task error while enabled; DEGRADED if missing heartbeat, older than 90 seconds, stopped or waiting; HEALTHY only observed running/idle/peer-lock state                                                            |
| Reloaded index   | FAILED on cursor error; DEGRADED if no success, older than 5 minutes or finalized lag over 64 blocks; disabled if no cursor                                                                                                                                               |
| Legacy source    | FAILED on ERROR; DEGRADED for unvalidated/incomplete/stale (>15 minutes) source; absent is DISABLED                                                                                                                                                                       |
| Edition contract | Independent enablement/cursor/error; 5-minute age and 64-block lag targets; first failed batch disables that contract and records an incident                                                                                                                             |
| Sharing          | Hourly observed statuses; missing samples DEGRADED; any failure/busy/fallback DEGRADED, over 5% FAILED. Busy admission refusals are visible, not hidden as successes                                                                                                      |
| Web / DB         | Health probe observation is process-local; database queries establish current connectivity. Hourly WEB_ERROR/DATABASE_FAILURE counters persist when DB is reachable. During DB outage use process counters and Railway logs; storage failure cannot durably record itself |
| Data quality     | Unresolved import rejections, reconciliation cases, provenance anomalies and failed derivative jobs remain visible with admin drill-down                                                                                                                                  |

Core workers back off exponentially (capped at five minutes) and disable after three consecutive failed tasks. SIGTERM finishes/rolls back bounded tasks and stops scheduling. Contract controls and core worker controls are independent. OperationalAudit retains stage gate, circuit-open, contract halt/reorg and deployment records. No outbound email/SMS or tracking service was added.

`production:report` prints measured catalog/mint/continuity/owner-match counts and anomalous token IDs, identity/reconciliation totals, normalized-event duplicate counts, grants/unlocks/revocations, discovery/set/snapshot counts and source completeness. It never labels tracked observations lifetime totals. Use `production:verify`, `provenance:verify` and admin evidence views for detailed consistency; counters alone do not prove correctness.

## Measured local baseline

Final controlled run on Node 24.14.0, Windows, disposable PostgreSQL; no remote artwork requests. Cold refers to an empty card cache in the existing test process, not a fresh Node process. The renderer card deliberately contains no network artwork, so these are rendering/admission/cache measurements, not production artwork latency.

| Render case   | Requests | Total time | p95    | Busy/refused |
| ------------- | -------- | ---------- | ------ | ------------ |
| Cold          | 1        | 122 ms     | 122 ms | 0            |
| Cached        | 1        | 3 ms       | 3 ms   | 0            |
| Distinct cold | 5        | 104 ms     | 104 ms | 3            |
| Distinct cold | 10       | 389 ms     | 387 ms | 8            |
| Cached        | 10       | 7 ms       | 6 ms   | 0            |
| Cached burst  | 20       | 9 ms       | 7 ms   | 0            |

Process RSS grew from approximately 235 MiB to 242 MiB during this short run; this is not a leak diagnosis or steady-state bound. Existing two-render concurrency protection deliberately rejects extra cold work. Keep it until Railway measurements justify a bounded queue or additional capacity. Cached cards remained reliable; production gateway timeouts/fallbacks require a separate staging run with a small approved asset set. Never load-test third-party gateways.

Fixture Edition batches (1–3 normalized events) took approximately 263–402 ms, with process RSS approximately 235 MiB before rendering. These include local PostgreSQL and mock RPC, not archive network latency. Existing logs measure chain/source batch counts and durations; worker task logs now include RSS. Real worker/source performance remains PENDING. Do not size Railway solely from tiny fixtures; start with existing documented memory headroom and measure actual work.

`capacity:render` writes a local JSON report using controlled assets. `capacity:web` performs five sequential requests per approved path against PUBLIC_BASE_URL; optional Collector/gallery paths are tightly validated. Authenticated collection/activity measurements are part of the local fixture suite; live authenticated staging measurements need a reviewed session. Reports in `.data` are ignored. Local production-build browser/HTTP regression records route timings in `.data/phase8-web-capacity.json`; it is distinct from an actual staging baseline.

Final local production-build HTTP sample (three sequential fixture requests per route):

| Route                    | p50   | p95    |
| ------------------------ | ----- | ------ |
| Homepage                 | 14 ms | 14 ms  |
| Explorer                 | 64 ms | 111 ms |
| Squig                    | 35 ms | 36 ms  |
| Collector                | 41 ms | 45 ms  |
| Authenticated activity   | 16 ms | 20 ms  |
| Authenticated collection | 20 ms | 24 ms  |

## Query/cache/security review

Explorer/collection/activity/gallery routes retain existing pagination and indexes. Featured presentation work remains capped at six Squigs. Edition collection history batches balance/acquisition reads instead of a query pair per Edition; bounded caps return no incomplete attribution claim when exceeded. Admin lists/incident windows are bounded; expensive full verification stays in explicit CLI operations.

Public share endpoints re-project and recheck visibility before returning bytes; server caches key projected artwork/style/privacy state, use bounded TTLs and no permanent public artifacts. Private transitions, Custom retirement and owner preference transfer fallback retain regression coverage. Edition historical pages publish event type/quantity/date/block only, with no wallet or historical identity evidence. Current owner reads still expire after 15 minutes. Authenticated Edition historical attribution uses effective-time confirmed identity evidence; revocation is reflected on the next query.

Security review includes existing signed/HttpOnly cookies, OAuth state, consumed wallet nonce replay tests, same-origin mutation checks, allowlisted admin identity, parameterized source queries, constrained URLs/redirects, raster signatures/hash validation and request limits. Phase 8 adds exact operational intent/database binding, empty-target restore guards and server-enforced collectible review acknowledgment. Archives remain trusted-operator artifacts, not arbitrary user uploads. No object storage upload feature or blockchain write operation exists.

`npm audit --json` reported **0 vulnerabilities** in the dependency audit performed for this phase. The secret scan reviews current files and reachable local Git blobs without printing matched values; it is heuristic and does not prove absence of every credential form. Real secrets require rotation if discovered. Example/local test URLs are not credentials for external systems. Database dumps/key files are ignored. Railway backup support/retention must be checked in the actual account.
