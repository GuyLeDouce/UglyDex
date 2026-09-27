# Phase 10 — external launch execution, access-limited

Execution date: **2026-09-26 UTC**. Application revision: **811314b**, with Phase 8 checkpoint **4fe652f** in its ancestry. `git status --short` was empty at the start. This phase records actual checks and unavailable prerequisites; it does not introduce application features or substitute fixture evidence for a production launch.

## Starting state and access inventory

`launch:status` returned **NOT_READY**, 0 VERIFIED, 31 PENDING, 20 blocking, 11 optional warnings and 0 FAILED. The operator process defaults to development, with runtime commit unknown and no configured UglyDex database. The source checkout revision is known independently. This is the unconfigured launch projection, not a query of a remote production gate store. No production launch records were read, reset, overwritten or attested.

Presence checks covered process, Windows user and machine environment variables without displaying values. Only `.env.example` exists in the working tree. No Railway CLI/configured local session or callable Railway tool was found. The plugin directory offers a Railway integration, but its returned installation state was not installed; connection was suggested and has not been confirmed. An access-location question was left with the operator. PostgreSQL client commands were not on PATH; local embedded test PostgreSQL is not a production database or a backup source.

| Resource                                   | Availability / result                                             | Next prerequisite                                                       |
| ------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Railway staging                            | PENDING; no connected account/project                             | Approved staging account/project access                                 |
| Railway production                         | PENDING; no connected account/project                             | Approved production access; blocking gates must clear first             |
| Staging / production PostgreSQL            | PENDING; URLs absent                                              | Dedicated UglyDex database and environment binding                      |
| Backup capability / archive                | PENDING; no database, account backup evidence or supplied archive | Confirm actual plan/storage and create or identify a reviewed backup    |
| Restore target                             | PENDING; no target configured                                     | Empty disposable recovery database, trusted archive and explicit intent |
| Ethereum archive RPC                       | PENDING; ETH_RPC_URL absent                                       | Approved archive-capable mainnet endpoint                               |
| Wallet links                               | PENDING; source URL absent                                        | Reviewed SELECT-only role and guild scope                               |
| UglyBot main / prizes / claims / points    | PENDING; all four URLs absent                                     | Reviewed source credentials                                             |
| Gauntlet / Survival / image DB             | PENDING; all three URLs absent                                    | Reviewed source credentials                                             |
| ImageSubmit                                | PENDING; source URL absent                                        | Reviewed source credentials                                             |
| Discord OAuth / admin identities           | PENDING; client ID, secret, callback and admin IDs absent         | Staging OAuth registration and authorized admin account                 |
| Auth secret                                | PENDING; absent                                                   | Separate staging and production secrets through approved configuration  |
| Public staging / production URL            | PENDING; all public/deployment URL variables absent               | Reachable, identified staging origin                                    |
| Official Custom manifest                   | PENDING; none supplied                                            | Authoritative reviewed manifest and artwork hashes                      |
| Official Edition manifest / contracts      | PENDING; none supplied                                            | Reviewed manifest and verified registry evidence                        |
| Physical phones / interactive desktop auth | PENDING; no approved device session supplied                      | Actual devices, browsers, wallet and staging auth session               |
| External OG previews                       | PENDING; no deployed URL / preview evidence                       | Public staging origin and crawler validation                            |

No secret values, source extracts, personal identifiers, private paths or backups are included in this inventory. Existing ignored test artifacts were not treated as official collectible manifests or production data.

## Execution by prerequisite

Backup and restore could not begin without a source database/archive and a safe recovery target. Staging deployment could not begin without Railway access. RPC verification and backfills could not begin without an archive endpoint and an identified UglyDex destination. Every later production evidence operation remained PENDING rather than bypassing these dependencies.

No production/staging mutation, source pilot, full import, identity decision, worker enablement, collectible import or load test was executed. No upstream source was written. Existing launch policies, `uglydex-progression-v1` and `uglydex-collection-v1` remain unchanged.

| Evidence requested                                                                                               | Actual Phase 10 production/staging result                                          |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Backup environment / timestamp / size / integrity                                                                | PENDING; no backup performed or confirmed                                          |
| Restore source / target / duration / integrity / app boot                                                        | PENDING; no real restore drill performed                                           |
| Staging deployment / preflight / smoke / migrations                                                              | PENDING; no deployment accessed                                                    |
| Production deployment / post-launch observation                                                                  | PENDING; no production launch occurred                                             |
| Verified start block / indexed finalized height                                                                  | PENDING; no RPC probe executed; 25,342,921 is not accepted as proof                |
| Transfers / mints / unique tokens / retries / burn states                                                        | PENDING; no chain backfill executed                                                |
| Continuous provenance / ownerOf matches / anomalies / spot audit                                                 | PENDING; no real ledger or chain queried                                           |
| Source schema / effective privilege classification                                                               | PENDING for every source; no external database contacted                           |
| Pilot/full-import scanned, eligible, normalized, inserted, updated, skipped, unresolved, rejected, linked counts | PENDING for every configured source group and supported feed; no imports performed |
| Source earliest/latest/imported-through/completeness                                                             | PENDING; no source history inspected                                               |
| Canonical duplicate review                                                                                       | PENDING; no real events available for review                                       |
| Collectors / Discord identities / wallets / conflicts / review cases                                             | PENDING; no production identity data queried                                       |
| Real reconciliation decisions / downstream correction                                                            | PENDING; no real-user decisions made                                               |
| Production Replay A / B fingerprints / semantic diff                                                             | PENDING; local regression replay is separate evidence                              |
| Production XP / achievements / revoked grants / evaluated subjects                                               | PENDING; no production replay or report executed                                   |
| Production discoveries / traits / sets / completion distribution                                                 | PENDING; no production replay or report executed                                   |
| Historical-to-live handoff / worker stability window                                                             | PENDING; no deployed workers observed or enabled                                   |
| Railway web/render p50/p95, failure rate, memory, pools and batch timing                                         | PENDING; no Railway measurements collected; no tuning applied                      |
| Physical iPhone / Android / interactive Chrome / Edge / wallet providers                                         | PENDING; none tested against a deployment                                          |
| Real Discord OAuth / auth cookies / proxy behavior                                                               | PENDING; no deployed authentication session                                        |
| External Collector / Squig / gallery / achievement / set / completion OG                                         | PENDING; no external previews tested                                               |
| Official Customs / Editions / registered contract ownership                                                      | PENDING; zero import/index operations performed; live catalog counts unknown       |
| Staging outage injection / worker termination / alert recovery                                                   | PENDING; existing local failure fixtures are not staging evidence                  |

## Local security and release validation

The requested `release:check` rerun is in progress; its final result will be recorded below. One complete-suite attempt failed locally before Replay B, as detailed below; prior Phase 9 success does not override that failure. No production incompatibility or application root cause has been established. No application code, migration, ruleset or tests were added or changed.

The first release attempt passed 505 unit tests, lint, formatting, typecheck and catalog verification, then hit Windows/OneDrive EPERM while cleaning old `.next` output. Only the exact resolved workspace `.next` directory was removed; the release suite was restarted with temporary database/browser process permissions. This was generated-output recovery, not a code fix or a production incident.

The local web run logged closed response streams, an upstream Pinata artwork timeout and a database connection timeout. These observations are retained even if the suite's assertions pass. They are not Railway error rates or proof of a production root cause; no production pool/concurrency setting was changed on that basis. Deployed asset delivery, connection headroom and cancellation/error behavior still require staging measurement.

Headless browser teardown also paused for several minutes after the final admin screenshot. A process-tree inspection identified the remaining test browser; it exited before a guarded cleanup action ran, so no forced termination occurred. The existing suite then continued into worker recovery and Replay A/B. This local delay is not a diagnosed application defect or a successful staging restart drill.

That attempt completed Replay A progression in 221,792 ms and collection processing in 237,680 ms, then failed with `Connection terminated due to connection timeout` through the PostgreSQL/Prisma pool before Replay B started. It did not produce a fresh successful A/B artifact. Web, database and PostgreSQL cleanup all completed. Available disk space was approximately 334 GB. One controlled retry uses the same application code, connection pool size and timeouts; no limit was relaxed to obtain a pass. Its result is recorded separately below. The prior `.data/phase9-replay.json` is not evidence for this failed attempt.

A Windows host counter sample during the retry showed only **85 MB available RAM** and approximately **39.6% total CPU use**. This establishes local memory pressure, not the root cause of every error and not a Railway capacity result. Repeat deployment validation on adequately provisioned staging before drawing production pool/performance conclusions.

`npm audit --json` required network permission after its sandboxed request failed. The successful audit reported **0 vulnerabilities across 689 dependencies**. The secret scan inspected **327 working-tree files and 530 historical Git blobs with zero findings**. It is a heuristic scan, not proof that every possible secret form is absent. Final local database/browser/replay results are recorded after completion. Existing tests exercise authentication, nonce replay, OAuth callback state rejection, same-origin mutations, SSRF/rate limits, privacy enumeration, admin/share authorization and operational failure recovery; they do not certify deployment configuration or physical-device behavior. Static inspection confirmed the existing S256 challenge and token-request verifier code; a real Discord PKCE exchange remains PENDING without OAuth credentials.

## Launch decision and handover

External gates closed: **none**. Final `launch:check` and `launch:report` will be recorded after local validation. No critical gate is waived because access is absent.

Remaining blocking keys: DATABASE, MIGRATIONS, WEB_DEPLOYMENT, WORKERS, BACKUP, RESTORE_DRILL, ARCHIVE_RPC, START_BLOCK, MINT_COVERAGE, OWNERSHIP_CONTINUITY, OWNER_OF, REATTRIBUTION, ACTIVITY, DUPLICATE_REVIEW, PROGRESSION, COLLECTIONS, DERIVED_REPLAY_STABLE, HANDOFF, PRIVACY_AUTH, REAL_DEVICE_SHARE.

Optional pending/warning keys: WALLET_LINKS, UGLYBOT, GAUNTLET, SURVIVAL, IMAGE_SUBMIT, IDENTITY_REVIEW, EXTERNAL_OG, CUSTOM_MANIFEST, EDITION_MANIFEST, EDITION_CONTRACTS, HOLDER_TIERS. Absence is not evidence of a clean source, safe identity decision or valid catalog.

Recommended Phase 11 scope: continue the external launch execution after approved access is configured. Begin with real backup and disposable restore proof, then staging, migrations, archive boundary/provenance/ownerOf, source roles/pilots/full imports, duplicate/identity review, Production Replay A/B, handoff and individually observed workers. Complete real auth/device/OG checks and reviewed collectibles, measure Railway before tuning, then run launch checks before any production rollout. Fix only observed defects with regression tests. No engagement systems, financial mechanics or speculative architecture are justified by the remaining access gaps.
