# UglyDex technical audit and repair — October 31, 2026

## Evidence boundary

Starting main: `650f8dff7c0646b07ccbda0d80843dc1645b23ec`.
Work branch: `audit/technical-review-2026-10-31`.
This is a source audit and a draft repair candidate, **not production certification**.
No production database, variables, worker controls, cursors or deployments were changed.
No migrations, backfills, source imports, identity merges or historical cleanup were run.
The supplied brief stops at “Evaluate a collector”; no unstated requirements are assumed.

The repository was cloned in full. Architecture, identity, V3 discovery, reconciliation,
activity, progression, collection, production/launch readiness, Phase 12/13, reliability,
rollback, newer startup/favorites/community documents, schema and CI were inspected.
The inventory appendix enumerates routes, services, integrations, models and scripts;
it is an inventory, not a claim that every line or runtime path has been independently
verified. Source-confirmed defects below are distinguished from live conditions and
unmeasured performance hypotheses. Database/browser coverage remains incomplete here.

Recent main changes include #48 (profile thread scoping), #47 (Squig startup recovery),
#46 (share highlight ranking), #45 (share backgrounds), #44 (startup recalculation
recovery), and #43 (share owned count). Those changes were retained. GitHub returned
no open issues and one open PR, #29, “Temporarily hide Galleries and My Galleries.”
That PR reported `mergeable: false`; this branch does not duplicate its visibility edits.

Initial Railway discovery returned `UNAUTHORIZED`; subsequent read-only access succeeded.
UglyDex is in the **Ugly Bot** project. Production deployment
`798da2de-6cb1-4b27-bdf4-ef5a5c3aa41c` reports SUCCESS at the exact starting main SHA,
created October 25. Production uses Railpack, `npm start`, pre-deploy
`npm run db:migrate`, `/api/ready`, one replica and `source.checkSuites=false`.
The latter is an operational risk: Railway does not wait for CI before deployment.
Changing this production setting requires approval and was not performed.
All six returned staging UglyDex services were online with one running replica,
no pending changes and no failures in the default eight-hour window. Sampled
collections-worker logs on October 31 report LIVE, successful batches and zero
processed/failed/deferred records. These samples do not prove queue completeness.
Staging web logs record `collections.startup_complete` on October 25; no reproduced
`CHECK_COLLECTION_DIAGNOSTICS` failure was present in the sampled logs.
Queue sizes, live ownership totals, backup health, source permissions and latencies
remain operationally unverified. No secret variable values were requested.
Historical phase reports must not be treated as current observations.

## Architecture and boundaries

The existing Next.js App Router modular monolith is preserved. Server components
call explicit server projections backed by the UglyDex PostgreSQL database through
Prisma's pg adapter. Client components receive card and profile DTOs. viem reads
Ethereum mainnet; source adapters/bridges read ecosystem records; neither grants
wallet authority nor changes upstream game state. DRIP identity verification and
balance observations are separate from the canonical NFT ownership pipeline.

The chain pipeline is: fixed mainnet contract and deployment-bound transfer scan →
finalized block/hash checks → transactional raw transfer ledger and cursor → wallet
periods/provenance → dated identity attribution → collector periods/discoveries →
collection/progression queues → profile, Field Guide, sharing and ranking projections.
The ownerOf refresh path has a separate bounded leased checkpoint. Burned tokens
remain in the 4,444-ID catalog; current ownership and lifetime discovery remain distinct.

Background processes comprise ownership, ecosystem, progression, collections and
optional Editions workers, source bridges, optional artwork warming and the startup
derivation process. WorkerControl, WorkerHeartbeat, SyncRun, replay checkpoints,
advisory locks and outbox generations already exist. Manual recalculation remains
staging-only; this branch does not enable it in production.

## Audit matrix

Classification appears at the start of “Verified issue.” “None confirmed” means
source inspection found an existing mechanism, not proof of operational health.

| Area                         | Current implementation                                                                             | Verified issue                                                                                                                | Severity           | Evidence                                                                  | Proposed solution                                                                                                           | Files affected                                    | Test plan                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Runtime dependencies         | Locked Next 16.3.8, Zod 4.6.5                                                                      | Confirmed dependency finding: registry audit flags Next critical, Zod high, fast-uri moderate; exploitability not established | Critical priority  | `npm audit --omit=dev`, advisory links below                              | Update compatible patched versions; rerun build, tests and audit                                                            | package.json, package-lock.json                   | Clean install, unit/type/lint/build, runtime audit                                           |
| Unverified holder discovery  | V3 holdings query unions credentials and DiscoveredWallet                                          | Confirmed defect: unverified mappings become personal lifetime discoveries during rebuild                                     | High               | `currentCollectionHoldings` + `retainCurrentDiscoveries`                  | Remove unverified mappings from personal discovery input; preserve public ownership projection                              | src/server/dex-engine.ts                          | DB possession fixture: shell owned=1, discoveries=0, no credential fabricated                |
| Holder claiming              | Empty-shell adoption rejects shells with discovery rows                                            | Confirmed defect: the preceding rebuild makes otherwise empty shells unclaimable through adoption                             | High               | `adoptDiscoveredWallet` checks SquigDiscovery count                       | Prevent new fabricated rows; leave existing populated shells for reviewed reconciliation                                    | dex-engine.ts; tests/db/field-guide-possession.ts | Rebuild shell, then adopt through existing transaction; HTTP signature tests remain required |
| Existing shell history       | Historical discovery rows retained                                                                 | Architectural risk: rows previously created without proof may already exist                                                   | High               | Old union and materialization path                                        | Separately review affected records and provenance; no automatic deletion or reassignment                                    | No data mutation in this PR                       | Read-only affected-record inventory, then approved recovery fixture and plan                 |
| Reorg discovery invalidation | Rewind invalidates OBSERVED discoveries by sourceKey                                               | Confirmed defect: `linked:` keys emitted at wallet verification do not match raw observation keys                             | High               | discoveries.ts prefixes key; transfers.ts previously matched raw key only | Include exact raw and linked keys; keep retraction status and evidence row                                                  | src/sync/transfers.ts                             | New mocked rewind regression; real DB reorg tests required                                   |
| Chain scope and cursor       | Mainnet/contract validation, exact deployment boundary, durable cursor and block hashes            | None confirmed in inspected boundary logic; live configuration unverified                                                     | Operational        | integrations/blockchain, sync/transfers, domain/validation                | Preserve; verify deployed chain/start block and ownerOf against indexed snapshot later                                      | No change                                         | Existing provenance fixtures plus authorized read-only live verification                     |
| Deep reorg recovery          | Bounded rewind with stored anchor; deep mismatch stops                                             | Architectural risk: legacy rewind deletes orphan ledger rows rather than retaining an archive                                 | Medium             | `rewindFrom` deletes bounded NftTransfer rows                             | Do not redesign canonical ledger in this repair; separate reviewed archival design if required                              | No ledger redesign                                | Disposable fork/reorg tests; operator review for deep mismatches                             |
| Discovery total              | Unique current verified union plus non-invalidated attributed history                              | None confirmed in inspected deduplication; summaries can read multiple DB snapshots                                           | Medium risk        | collectionDiscoveries Map; collectionSummary Promise.all                  | Keep semantics; evaluate single-snapshot summary reads with concurrency fixtures before broad refactor                      | Existing collections/dex services                 | Existing 274 owned/315 discovered, sale, unlink, rebuy and retraction fixtures               |
| Manual recalculation errors  | Synchronous seed → collections → achievements; generic 400 on any exception                        | Confirmed defect/UX weakness: successful Field Guide phase hidden if achievements fail; safe cause discarded                  | Medium             | POST route catch                                                          | Return phase, allowlisted cause and partial completion; 429 + retry interval; refresh updated guide                         | recalculate route/component                       | Route regressions for auth, origin, binding, rate, partial success and secret suppression    |
| Recalculation diagnostics    | Error allowlist supports nested causes                                                             | Confirmed defect: collection engine emits COLLECTION_VERSION_BUMP_REQUIRED, absent from allowlist                             | Medium             | seedCollections throw versus recalculation-error.ts                       | Add exact known code; no raw messages                                                                                       | recalculation-error.ts                            | Allowlist test including unknown/circular errors                                             |
| Recalculation progress/retry | Indeterminate progress + elapsed time; durable worker queues, subject locks                        | Architectural risk: synchronous manual request can outlive proxy/client; no durable request-level progress resource           | Medium             | component, POST route, dex-engine, progression-engine                     | Preserve truthful indeterminate status; durable asynchronous orchestration remains a follow-up requiring DB/HTTP validation | No new job schema                                 | Multi-replica submission, disconnect, restart and idempotency tests on disposable DB         |
| Sparse rankings              | 24-row pagination; current ruleset snapshot; pending jobs excluded; dense rank                     | Operationally unverified cause of reported three-profile result                                                               | Medium             | topCollectors eligibility query                                           | Preserve eligibility; show public profiles awaiting evaluation; normalize invalid page inputs                               | community.ts; collectors/page.tsx                 | Page clamp tests; disposable mixed private/public/pending ranking fixture                    |
| Registered users             | uglyUsers requires authenticated identity, SIWE wallet or session; holder directory separate       | None confirmed in inspected distinction                                                                                       | Informational      | community.ts collectorListing                                             | Preserve directories and “Unverified Squig Holder” label                                                                    | No change                                         | Existing identity/privacy DB suite                                                           |
| SIWE/session security        | Exact expiring browser-bound challenge, signature, atomic consumption, HMAC session tokens         | Live authentication unverified; no confirmed bypass in inspected flow                                                         | High assurance gap | auth.ts; wallet routes; manageWallet invalidates sessions on revoke       | Retain proof boundary; exercise full concurrent HTTP fixture and real-device login before release                           | No auth-policy change                             | Existing test:identity and test:db --web                                                     |
| Merge/privacy                | Explicit dual-proof merge request, collector locks, publication reset and audits                   | Architectural risk: complex cross-identity merge requires real DB concurrency coverage                                        | High assurance gap | collector-merge.ts; auth.ts                                               | Preserve consent; no source-driven automatic merges                                                                         | No merge rewrite                                  | Merge/revocation/expiry/concurrency fixture suite                                            |
| DRIP and external IDs        | Exact account proof, private mapping, allowlisted public DTOs                                      | Operationally unverified provider permission/linking state                                                                    | Medium             | charm-link.ts, drip-sync.ts, profile DTOs                                 | Preserve UNKNOWN/unavailable states and read-only integration                                                               | No provider changes                               | Existing route/provider fixtures; authorized live account test later                         |
| Favorites                    | Six-item locked mutation; current ownership on reads; shared profile/card selections               | Missing feature/UX weakness: no focused favorites browse and dashboard shows top-UP standouts instead of all favorites        | Medium             | favorites.ts; catalog.tsx; me/page.tsx                                    | Add viewer-scoped filter and dashboard section; sold/unlinked favorites remain excluded                                     | catalog/collection services, private pages        | DB fixture: six, sale reduces to five, anonymous query empty; visual review pending          |
| Field Guide filters          | Server pagination, OG/Legendary/traits/search/sorts/set hints                                      | UX weakness: private collection pages omit viewerId, hiding personal filter controls                                          | Low                | private Catalog call sites                                                | Pass authenticated viewer ID; retain public privacy boundary                                                                | collection and discovered pages                   | Unit/build checks; populated browser fixture                                                 |
| Collection performance       | 24 full cards/request; hints/catalog evaluated server-side                                         | Performance opportunity: repeated full eligible-history reads and repeated projection queries                                 | Medium, unmeasured | collectionPage, collectionSummary, dexView                                | Profile query plans and p95 before caching or virtualization; avoid browser-wide 4,444-record fetch                         | No speculative cache/index changes                | EXPLAIN on disposable representative data; mobile slow-network benchmark                     |
| Passports                    | Paginated chain timeline, separate ecosystem facts, provenance warnings, existing passport sharing | None confirmed in inspected display/sharing path; historical coverage unverified                                              | Informational      | provenance.ts, passport.tsx, activity.ts, sharing.ts                      | Preserve chronological facts and partial/unattributed boundaries; no duplicate passport                                     | No rewrite                                        | Existing provenance/activity/sharing tests; burned/unattributed fixtures                     |
| Collector Thread             | Union of earned projections and transfers; profile scope before pagination                         | Architectural risk/performance opportunity: offset paging and post-query card rejection can yield sparse pages                | Medium, unmeasured | community.ts collectorThread                                              | Preserve #48 scope/privacy; separately benchmark candidate paging/keyset strategy                                           | No thread rewrite                                 | Mixed eligible/ineligible events, dedupe and profile/global isolation fixtures               |
| Dashboard hierarchy          | Identity, stats, CHARM, guide, progression, global feed, standouts                                 | UX weakness: favorites absent and secondary integration precedes guide                                                        | Low                | me/page.tsx                                                               | Move guide/favorites before secondary ecosystem connection card                                                             | me/page.tsx                                       | Production build; responsive/keyboard review pending                                         |
| Documentation                | Historical phase reports and newer feature docs coexist                                            | Confirmed documentation weakness: older README privacy/deferred-feature statements are easy to misread as current             | Low                | README versus collector-discovery/community/V3 docs                       | Add current audit pointer; correct startup discovery statement                                                              | README; V3/startup/favorites docs                 | Review links and formatting                                                                  |
| CI and tests                 | Two jobs: checks and isolated identity; browser installation present                               | Operational limitation: local browser download fails, tsx IPC denied, root PostgreSQL unsupported                             | Release blocker    | Baseline results below                                                    | Keep CI intact and PR draft; require full checks on supported non-root runner                                               | Existing .github/workflows                        | No skipped DB/browser checks counted as passed                                               |
| Railway/release              | Docker configs, migrations pre-deploy, readiness and rollout gates                                 | Architectural risk: production CI gating disabled; data/backup conditions still unverified                                    | Release blocker    | Read-only deployment/config/status and sampled worker logs                | Review CI gating and complete data/backup checks; explicit production approval still required                               | No infra changes                                  | Verify exact SHA, controls, queues, backups, source scope before approval                    |

### Additional confirmed build finding

| Area                     | Current implementation   | Verified issue                                                                        | Severity | Evidence                                                       | Proposed solution                                                | Files affected                                                   | Test plan                                                                          |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Asset and policy tracing | Dynamic filesystem paths | Performance opportunity: Next build traced the whole project for two filesystem reads | Low      | CI build warnings at legal-policy.tsx and share-backgrounds.ts | Statically scope artwork directory and explicit policy filenames | src/components/legal-policy.tsx; src/server/share-backgrounds.ts | Production build passes without these warnings; all 20 existing artwork tests pass |

## Dependency findings and applicability

The registry reported three runtime dependency findings at baseline. Its critical
Next classification is a package-version finding, not proof of an exposed RCE.
The image advisory documents Sharp >=0.35.5 as a workaround; the baseline already
resolves Sharp 0.35.5. Other Next advisories still justify the compatible update.
A subsequent full dependency audit also flagged the Vite development toolchain.
Vite was updated compatibly from 8.3.1 to 8.3.5 and all 986 non-browser tests
passed again. The final full audit reports 18 moderate findings, no high or critical findings.
The minimatch advisory in the ESLint/tooling dependency chain
requires a separate compatibility review: the suggested ESLint/Next config
fix includes major downgrades, which were not applied. The existing Dockerfile
retains development dependencies, so these are shipped-package findings even
though no Vite development server is started by the production command.
No exploit probes were sent to the application. Existing framework and validation
APIs are retained; no forced major upgrade or blanket `npm audit fix` was used.

References checked during this audit:

- https://github.com/advisories/GHSA-2464-fhr4-w9xw
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- Next audit also reports GHSA-p3m5-59mp-jv5r and GHSA-673q-mjm6-r5xr.
- fast-uri audit reports GHSA-w74x-v6f9-j3xg, GHSA-xhq7-xmqj-769h,
  GHSA-wjr9-j795-jxcr and GHSA-333x-w4r6-6crp.

## Baseline validation

Node 24.22.1; npm 11.9.0; clean `npm ci` installed 588 packages.
No production environment file or credentials were configured by this work.

| Requested check       | Baseline result                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| npm ci                | Passed                                                                                                        |
| npm run lint          | Passed                                                                                                        |
| npm run typecheck     | Passed                                                                                                        |
| npm test              | 54 files passed, 2 browser-dependent files failed to launch missing Chromium; 977 passed and 17 skipped tests |
| npm run build         | Passed                                                                                                        |
| npm run format:check  | Passed                                                                                                        |
| npm run test:db       | Blocked before tests: tsx Unix IPC socket EPERM                                                               |
| npm run test:identity | Blocked before tests: same tsx IPC restriction                                                                |
| npm run release:check | Blocked before suite: same tsx IPC restriction                                                                |

A direct Node/tsx loader invocation bypassed the CLI IPC step but reached the
fixture's explicit refusal to run PostgreSQL as root. A non-root `runuser` attempt
was unavailable because setting groups is prohibited. No harness guard was disabled.
Playwright's Chromium download returned invalid/truncated ZIP data and exhausted
its normal retries. Database, HTTP integration, visual and full-release checks are
therefore not claimed as passed.

A repeated Turbopack build later hit its local persistence-cache error
“invalid digit found in string.” The generated `.next` cache was isolated before
rechecking the final dependency revision; this is not an application database error.
Final validation is recorded in [checks.json](evidence/technical-audit-20261031/checks.json).
The patched dependency revision passes the production build and lint, and all 986
non-browser tests across 56 files. Next and eslint-config-next are now 16.4.3,
Zod 4.6.7, and the compatible fast-uri dependency is updated. The final runtime
audit reports zero known vulnerabilities; this is not a general security guarantee.
GitHub run [41195558603](https://github.com/GuyLeDouce/UglyDex/actions/runs/41195558603)
on `7f1427d` passed the isolated identity job, lint, typecheck, full Vitest run
(including browser-dependent tests) and build. The DB fixture stopped at phase 1:
an older assertion expected zero total discoveries after verifying a wallet with
two current holdings. That contradicts the V3 union rule. The revised assertion
independently requires zero attributed historical rows and two current discoveries;
it does not relax historical attribution safeguards. The complete DB/HTTP/browser
release gate remains pending the rerun.

The build also confirmed broad filesystem tracing for dynamic share-art and policy
reads. Paths now statically constrain artwork to `assets/share-backgrounds` and
policy reads to the two checked-in filenames, preserving the existing assets and
renderers while preventing whole-project tracing from those calls.

## Features and remaining work

Implemented already: holder profiles and claiming, multi-wallet identity, V3
unique discoveries, trait/set progress, ranked public guides, six favorites,
passports, ecosystem history, achievements, public/privacy settings, gallery/share
infrastructure, global/profile threads, worker diagnostics and reconciliation tools.
Manual Field Guide recalculation is staging-only. Workers are controlled by durable
state and cannot be assumed LIVE from the presence of configuration. Claimable
CHARM parity, broader quests/seasons and expanded thread filtering are not implemented
by this PR. Existing optional galleries are the subject of open PR #29.

The manual endpoint still uses the existing synchronous evaluator. This candidate
improves truthful failure/completion feedback; it does not claim durable browser
reconnection, actual percentage progress, or request-level duplicate suppression.
The subject locks and deterministic ledger continue to provide existing serialization
and idempotency. A persistent orchestration resource needs additional DB and HTTP
validation before it can safely replace this path.

No production SQL query plans, p95 timings, mobile frame measurements, live rankings
or on-chain owner comparisons were available. These are explicit remaining audit
items, not optimizations claimed as completed. In particular, deploying this repair
will not automatically repair pre-existing unverified shell history.

## Release and recovery

Keep this PR draft until the supported non-root CI runner passes database, identity,
browser and full release checks. Inspect the corrected shell-discovery case against
a disposable restored dataset and review any existing suspect history. Do not run
a broad production replay as a test. Validate the added dashboard/filter layout at
390px, tablet and desktop widths, keyboard navigation and reduced motion.

No new schema migration is included. Canonical catalog, rarity, 4,444 denominator,
XP formulas, raw transfer cursors and existing historical discoveries are preserved.
The discovery change enforces the documented V3 proof boundary rather than inventing
new qualification rules. Before an approved rollout, review how existing snapshots
and history will be reconciled; the startup process can enqueue work on staging.

Rollback is a code rollback of this branch's changes, keeping historical data and
migration bookkeeping intact. It reintroduces the identified defects and affected
dependency versions, so prefer a forward compatibility fix. Never reset cursors,
delete discoveries, weaken readiness checks or restore production just to make
counts match an expectation. No rollout or rollback was executed here.

## Repository inventory appendix

### App pages (52)

- `src/app/admin/activity/page.tsx`
- `src/app/admin/collectibles/page.tsx`
- `src/app/admin/collections/page.tsx`
- `src/app/admin/collectors/page.tsx`
- `src/app/admin/customs/page.tsx`
- `src/app/admin/editions/page.tsx`
- `src/app/admin/integrations/page.tsx`
- `src/app/admin/production/page.tsx`
- `src/app/admin/progression/page.tsx`
- `src/app/admin/provenance/page.tsx`
- `src/app/admin/reconciliation/page.tsx`
- `src/app/admin/sharing/page.tsx`
- `src/app/charm/page.tsx`
- `src/app/collection/dex/page.tsx`
- `src/app/collection/discovered/page.tsx`
- `src/app/collection/editions/page.tsx`
- `src/app/collection/page.tsx`
- `src/app/collection/sets/page.tsx`
- `src/app/collection/traits/page.tsx`
- `src/app/collector/[slug]/achievements/page.tsx`
- `src/app/collector/[slug]/activity/page.tsx`
- `src/app/collector/[slug]/collection/page.tsx`
- `src/app/collector/[slug]/creations/page.tsx`
- `src/app/collector/[slug]/gallery/[gallerySlug]/page.tsx`
- `src/app/collector/[slug]/page.tsx`
- `src/app/collector/[slug]/sets/page.tsx`
- `src/app/collectors/directory/page.tsx`
- `src/app/collectors/page.tsx`
- `src/app/connect/page.tsx`
- `src/app/editions/[slug]/page.tsx`
- `src/app/editions/page.tsx`
- `src/app/me/achievements/page.tsx`
- `src/app/me/activity/page.tsx`
- `src/app/me/creations/page.tsx`
- `src/app/me/page.tsx`
- `src/app/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/sets/[key]/page.tsx`
- `src/app/settings/appearance/page.tsx`
- `src/app/settings/galleries/page.tsx`
- `src/app/settings/identity/merge/page.tsx`
- `src/app/settings/profile/page.tsx`
- `src/app/settings/sharing/page.tsx`
- `src/app/settings/wallets/page.tsx`
- `src/app/share/page.tsx`
- `src/app/squig/[tokenId]/achievements/page.tsx`
- `src/app/squig/[tokenId]/page.tsx`
- `src/app/squigs/listings/page.tsx`
- `src/app/squigs/page.tsx`
- `src/app/terms/page.tsx`
- `src/app/thread/page.tsx`
- `src/app/traits/[traitType]/[traitValue]/page.tsx`

### API handlers (32)

- `src/app/api/achievement-badges/[key]/route.ts`
- `src/app/api/admin/activity/[id]/explain/route.ts`
- `src/app/api/admin/collectibles/route.ts`
- `src/app/api/admin/collector-discovery/route.ts`
- `src/app/api/admin/integrations/route.ts`
- `src/app/api/admin/launch/route.ts`
- `src/app/api/admin/production/route.ts`
- `src/app/api/admin/provenance/route.ts`
- `src/app/api/admin/reconciliation/route.ts`
- `src/app/api/artwork/squigs/[cid]/[token]/[size]/route.ts`
- `src/app/api/auth/discord/callback/route.ts`
- `src/app/api/auth/discord/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/merge/confirm/route.ts`
- `src/app/api/auth/wallet/nonce/route.ts`
- `src/app/api/auth/wallet/verify/route.ts`
- `src/app/api/charm/link/route.ts`
- `src/app/api/charm/refresh/route.ts`
- `src/app/api/collection/recalculate/route.ts`
- `src/app/api/collection/refresh/route.ts`
- `src/app/api/editions/ownership/route.ts`
- `src/app/api/health/route.ts`
- `src/app/api/internal/charm/dirty/route.ts`
- `src/app/api/opensea/listings/route.ts`
- `src/app/api/ready/route.ts`
- `src/app/api/settings/appearance/route.ts`
- `src/app/api/settings/display-art/route.ts`
- `src/app/api/settings/favorites/route.ts`
- `src/app/api/settings/galleries/route.ts`
- `src/app/api/settings/profile/route.ts`
- `src/app/api/settings/wallets/route.ts`
- `src/app/api/share/route.ts`

### Components (48)

- `src/components/achievement-badge.tsx`
- `src/components/achievement-strip.tsx`
- `src/components/activity.tsx`
- `src/components/admin-collectibles.tsx`
- `src/components/admin-review.tsx`
- `src/components/appearance-editor.tsx`
- `src/components/artwork.tsx`
- `src/components/catalog.tsx`
- `src/components/charm-balance.tsx`
- `src/components/charm-drip-link.tsx`
- `src/components/charm-refresh.tsx`
- `src/components/collectible-editor.tsx`
- `src/components/collection.tsx`
- `src/components/collector-merge-confirm.tsx`
- `src/components/collector-nav.tsx`
- `src/components/collector-repair.tsx`
- `src/components/collector-thread.tsx`
- `src/components/connect.tsx`
- `src/components/dex.tsx`
- `src/components/display-art.tsx`
- `src/components/edition-check.tsx`
- `src/components/editions.tsx`
- `src/components/gallery-editor.tsx`
- `src/components/gallery.tsx`
- `src/components/legal-policy.tsx`
- `src/components/listing-sort-options.tsx`
- `src/components/opensea.tsx`
- `src/components/passport.tsx`
- `src/components/profile-form.tsx`
- `src/components/progression-preferences.tsx`
- `src/components/progression.tsx`
- `src/components/recalculate-field-guide.tsx`
- `src/components/refresh.tsx`
- `src/components/set-completion-badge.tsx`
- `src/components/set-icon-strip.tsx`
- `src/components/set-preferences.tsx`
- `src/components/share-card-preview.tsx`
- `src/components/share-controls.tsx`
- `src/components/share-studio.tsx`
- `src/components/showcase.tsx`
- `src/components/site-header.tsx`
- `src/components/stats.tsx`
- `src/components/status-icon-strip.tsx`
- `src/components/thread-refresh.tsx`
- `src/components/timeline.tsx`
- `src/components/ugly-users.tsx`
- `src/components/wallet-actions.tsx`
- `src/components/worker-controls.tsx`

### Server services (80)

- `src/server/achievement-badge-assets.ts`
- `src/server/achievement-badges.ts`
- `src/server/activity.ts`
- `src/server/admin.ts`
- `src/server/artwork-store.ts`
- `src/server/auth.ts`
- `src/server/card-personalization.ts`
- `src/server/chain-spot-audit.ts`
- `src/server/charm-gate.ts`
- `src/server/charm-history.ts`
- `src/server/charm-link.ts`
- `src/server/collectible-art.ts`
- `src/server/collectibles-verify.ts`
- `src/server/collectibles.ts`
- `src/server/collection-startup.ts`
- `src/server/collections.ts`
- `src/server/collector-discovery.ts`
- `src/server/collector-merge.ts`
- `src/server/collector-share-render.tsx`
- `src/server/community.ts`
- `src/server/cosmetics.ts`
- `src/server/db.ts`
- `src/server/deployment.ts`
- `src/server/derived-verification.ts`
- `src/server/dex-engine.ts`
- `src/server/dex.ts`
- `src/server/discoveries.ts`
- `src/server/drip-alignment.ts`
- `src/server/drip-sync.ts`
- `src/server/edition-history.ts`
- `src/server/edition-indexer.ts`
- `src/server/edition-verify.ts`
- `src/server/editions.ts`
- `src/server/env.ts`
- `src/server/evidence-audit.ts`
- `src/server/favorites.ts`
- `src/server/galleries.ts`
- `src/server/handoff-proof.ts`
- `src/server/http.ts`
- `src/server/launch-rpc.ts`
- `src/server/launch-verify.ts`
- `src/server/launch.ts`
- `src/server/listed-squigs.ts`
- `src/server/live-convergence.ts`
- `src/server/log.ts`
- `src/server/metrics.ts`
- `src/server/opensea.ts`
- `src/server/operational-metrics.ts`
- `src/server/production-backfill.ts`
- `src/server/production-report.ts`
- `src/server/production-verify.ts`
- `src/server/production.ts`
- `src/server/profiles.ts`
- `src/server/progression-engine.ts`
- `src/server/progression-preferences.ts`
- `src/server/progression.ts`
- `src/server/provenance-convergence.ts`
- `src/server/provenance-semantics.ts`
- `src/server/provenance.ts`
- `src/server/public-collector-name.ts`
- `src/server/recalculation-error.ts`
- `src/server/reconciliation.ts`
- `src/server/refresh.ts`
- `src/server/reliability.ts`
- `src/server/replay-proof.ts`
- `src/server/session.ts`
- `src/server/settings.ts`
- `src/server/share-art.ts`
- `src/server/share-avatar.ts`
- `src/server/share-backgrounds.ts`
- `src/server/share-cache.ts`
- `src/server/share-render.tsx`
- `src/server/share-selection.ts`
- `src/server/sharing.ts`
- `src/server/squig-startup.ts`
- `src/server/stage-gates.ts`
- `src/server/status-icons.ts`
- `src/server/trait-presentation.ts`
- `src/server/transaction-conflict.ts`
- `src/server/worker-runtime.ts`

### Domain modules (32)

- `src/domain/achievement-badges.ts`
- `src/domain/activity.ts`
- `src/domain/artwork-delivery.ts`
- `src/domain/assets.ts`
- `src/domain/charm-dirty.ts`
- `src/domain/charm.ts`
- `src/domain/collectibles.ts`
- `src/domain/collection.ts`
- `src/domain/cosmetics.ts`
- `src/domain/deployment.ts`
- `src/domain/dex-catalog.ts`
- `src/domain/dex.ts`
- `src/domain/edition-history.ts`
- `src/domain/events.ts`
- `src/domain/identity.ts`
- `src/domain/launch.ts`
- `src/domain/opensea.ts`
- `src/domain/operations.ts`
- `src/domain/profile.ts`
- `src/domain/progression.ts`
- `src/domain/provenance.ts`
- `src/domain/reliability.ts`
- `src/domain/replay-policy.ts`
- `src/domain/set-icons.ts`
- `src/domain/share-capacity.ts`
- `src/domain/share-styles.ts`
- `src/domain/sharing.ts`
- `src/domain/squig-rarity.ts`
- `src/domain/start-block.ts`
- `src/domain/status-icons.ts`
- `src/domain/thread-icons.ts`
- `src/domain/validation.ts`

### Integrations (29)

- `src/integrations/activity.ts`
- `src/integrations/availability.ts`
- `src/integrations/blockchain/index.ts`
- `src/integrations/bridge-auth.ts`
- `src/integrations/bridge-client.ts`
- `src/integrations/bridge-config.ts`
- `src/integrations/bridge-protocol.ts`
- `src/integrations/bridge-server.ts`
- `src/integrations/drip.ts`
- `src/integrations/gauntlet/index.ts`
- `src/integrations/gauntlet/survival.ts`
- `src/integrations/images/activity.ts`
- `src/integrations/images/index.ts`
- `src/integrations/inspect.ts`
- `src/integrations/permissions.ts`
- `src/integrations/queries.ts`
- `src/integrations/read-only.ts`
- `src/integrations/registry.ts`
- `src/integrations/source-schema.ts`
- `src/integrations/source-stats.ts`
- `src/integrations/table.ts`
- `src/integrations/uglybot/bounty.ts`
- `src/integrations/uglybot/duels.ts`
- `src/integrations/uglybot/index.ts`
- `src/integrations/uglybot/madlibs.ts`
- `src/integrations/uglybot/marketplace.ts`
- `src/integrations/uglybot/maw.ts`
- `src/integrations/validate.ts`
- `src/integrations/wallet-links/index.ts`

### Sync modules (10)

- `src/sync/activity.ts`
- `src/sync/blockchain.ts`
- `src/sync/import-event.ts`
- `src/sync/normalize.ts`
- `src/sync/ownership-worker.ts`
- `src/sync/provenance.ts`
- `src/sync/run.ts`
- `src/sync/squigs.ts`
- `src/sync/transfers.ts`
- `src/sync/verify-provenance.ts`

### Operational and test scripts (31)

- `scripts/activity-worker.ts`
- `scripts/activity.ts`
- `scripts/capacity.ts`
- `scripts/collectibles.ts`
- `scripts/collection-startup.ts`
- `scripts/collections.ts`
- `scripts/collector-discovery.ts`
- `scripts/edition-worker.ts`
- `scripts/export-squigs.mjs`
- `scripts/inspect.ts`
- `scripts/launch.ts`
- `scripts/migrate.ts`
- `scripts/ops.ts`
- `scripts/ownership-worker.ts`
- `scripts/package-migrations.mjs`
- `scripts/production.ts`
- `scripts/progression.ts`
- `scripts/provenance.ts`
- `scripts/release.ts`
- `scripts/restore-drill.ts`
- `scripts/secrets-audit.ts`
- `scripts/smoke.ts`
- `scripts/source-bridge.ts`
- `scripts/start.mjs`
- `scripts/sync.ts`
- `scripts/test-collector-identity.ts`
- `scripts/test-db.ts`
- `scripts/test-postgres.ts`
- `scripts/validate-integrations.ts`
- `scripts/warm-artwork.ts`
- `scripts/web-capacity.ts`

### Prisma models (86)

`Collector`, `DiscoveredWallet`, `ExternalIdentity`, `CollectorWallet`, `WalletLinkEvidence`, `IdentityReconciliation`, `Squig`, `CollectorGallery`, `CollectorGalleryItem`, `ShareRenderMetric`, `SquigTrait`, `SquigOwnership`, `SquigDiscovery`, `CollectorActivity`, `ActivityCorrection`, `IntegrationSource`, `ImportRejection`, `ActivityAttributionJob`, `ProgressionRuleset`, `XpLedgerEntry`, `ProgressionAudit`, `ProgressionJob`, `ProgressionMilestone`, `ProgressionReplay`, `SquigPassportEvent`, `CollectorProgress`, `SquigProgress`, `AchievementDefinition`, `CollectorAchievement`, `SquigAchievement`, `CollectionSetDefinition`, `CollectionSetRequirement`, `CollectorSetProgress`, `QuestDefinition`, `QuestProgress`, `SyncRun`, `ChainCursor`, `ChainBlock`, `NftTransfer`, `WalletOwnershipPeriod`, `HistoricalIdentityAttribution`, `CollectorOwnershipPeriod`, `SquigProvenance`, `ReconciliationDecision`, `CollectorMergeRequest`, `AuthChallenge`, `AuthSession`, `RateLimitBucket`, `OwnershipRefresh`, `CollectorRefreshRequest`, `CollectionRuleset`, `CanonicalTrait`, `CollectorTraitDiscovery`, `CollectionSnapshot`, `CollectionAudit`, `CollectionMilestone`, `CollectionJob`, `CollectionReplay`, `WorkerControl`, `WorkerHeartbeat`, `ProductionStage`, `OperationalAudit`, `CollectibleArtwork`, `SquigCustom`, `SquigDisplayPreference`, `SquigEdition`, `SquigEditionRelation`, `EditionOwnership`, `CollectibleAudit`, `CosmeticDefinition`, `CosmeticEntitlement`, `CollectorCosmeticPreference`, `DeploymentIdentity`, `EditionContract`, `EditionTransfer`, `EditionBalance`, `EditionCheckpoint`, `OperationalMetric`, `LaunchGate`, `ReplayProof`, `LiveDerivationProof`, `DripIdentity`, `CharmBalance`, `DripSyncState`, `CharmRefreshRequest`, `CharmDirtyNonce`.

### Deployment configuration

- `railway.bridge.toml`
- `railway.collections.toml`
- `railway.ecosystem.toml`
- `railway.editions.toml`
- `railway.progression.toml`
- `railway.toml`
- `railway.worker.toml`

### npm entrypoints

| Script                       | Command                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| `dev`                        | `next dev`                                                           |
| `build`                      | `prisma generate && next build`                                      |
| `start`                      | `node scripts/start.mjs`                                             |
| `lint`                       | `eslint . --max-warnings=0`                                          |
| `typecheck`                  | `prisma generate && next typegen && tsc --noEmit`                    |
| `format`                     | `prettier --write .`                                                 |
| `format:check`               | `prettier --check .`                                                 |
| `test`                       | `vitest run`                                                         |
| `test:db`                    | `tsx --conditions=react-server scripts/test-db.ts`                   |
| `db:generate`                | `prisma generate`                                                    |
| `db:migrate`                 | `tsx --conditions=react-server scripts/migrate.ts`                   |
| `integrations:inspect`       | `tsx --conditions=react-server scripts/inspect.ts`                   |
| `bridge:start`               | `tsx --conditions=react-server scripts/source-bridge.ts`             |
| `sync:identities`            | `tsx --conditions=react-server scripts/sync.ts identities`           |
| `sync:squigs`                | `tsx --conditions=react-server scripts/sync.ts squigs`               |
| `sync:uglybot`               | `tsx --conditions=react-server scripts/activity.ts uglybot`          |
| `sync:gauntlet`              | `tsx --conditions=react-server scripts/activity.ts gauntlet`         |
| `sync:images`                | `tsx --conditions=react-server scripts/activity.ts images`           |
| `sync:ownership`             | `tsx --conditions=react-server scripts/sync.ts ownership`            |
| `worker:ownership`           | `tsx --conditions=react-server scripts/ownership-worker.ts`          |
| `sync:transfers`             | `tsx --conditions=react-server scripts/sync.ts transfers`            |
| `sync:all`                   | `tsx --conditions=react-server scripts/sync.ts all`                  |
| `chain:status`               | `tsx --conditions=react-server scripts/provenance.ts status`         |
| `chain:verify`               | `tsx --conditions=react-server scripts/provenance.ts verify`         |
| `chain:discover-start`       | `tsx --conditions=react-server scripts/provenance.ts discover-start` |
| `provenance:verify`          | `tsx --conditions=react-server scripts/provenance.ts verify`         |
| `provenance:rebuild`         | `tsx --conditions=react-server scripts/provenance.ts rebuild`        |
| `integrations:validate`      | `tsx --conditions=react-server scripts/validate-integrations.ts`     |
| `sync:activity`              | `tsx --conditions=react-server scripts/activity.ts all`              |
| `activity:reattribute`       | `tsx --conditions=react-server scripts/activity.ts reattribute`      |
| `worker:ecosystem`           | `tsx --conditions=react-server scripts/activity-worker.ts`           |
| `progression:seed`           | `tsx --conditions=react-server scripts/progression.ts seed`          |
| `progression:rebuild`        | `tsx --conditions=react-server scripts/progression.ts rebuild`       |
| `worker:progression`         | `tsx --conditions=react-server scripts/progression.ts worker`        |
| `collections:seed`           | `tsx --conditions=react-server scripts/collections.ts seed`          |
| `collections:rebuild`        | `tsx --conditions=react-server scripts/collections.ts rebuild`       |
| `collections:verify`         | `tsx --conditions=react-server scripts/collections.ts verify`        |
| `worker:collections`         | `tsx --conditions=react-server scripts/collections.ts worker`        |
| `production:preflight`       | `tsx --conditions=react-server scripts/production.ts preflight`      |
| `production:backfill`        | `tsx --conditions=react-server scripts/production.ts backfill`       |
| `production:verify`          | `tsx --conditions=react-server scripts/production.ts verify`         |
| `production:worker`          | `tsx --conditions=react-server scripts/production.ts worker`         |
| `customs:import`             | `tsx --conditions=react-server scripts/collectibles.ts customs`      |
| `editions:import`            | `tsx --conditions=react-server scripts/collectibles.ts editions`     |
| `collectibles:verify`        | `tsx --conditions=react-server scripts/collectibles.ts verify`       |
| `collectibles:export`        | `tsx --conditions=react-server scripts/collectibles.ts export`       |
| `ops:fingerprint`            | `tsx --conditions=react-server scripts/ops.ts fingerprint`           |
| `ops:register`               | `tsx --conditions=react-server scripts/ops.ts register`              |
| `ops:backup`                 | `tsx --conditions=react-server scripts/restore-drill.ts backup`      |
| `ops:restore:drill`          | `tsx --conditions=react-server scripts/restore-drill.ts restore`     |
| `staging:preflight`          | `tsx --conditions=react-server scripts/ops.ts staging`               |
| `staging:smoke`              | `tsx --conditions=react-server scripts/smoke.ts --staging`           |
| `production:smoke`           | `tsx --conditions=react-server scripts/smoke.ts`                     |
| `integrations:pilot`         | `tsx --conditions=react-server scripts/ops.ts pilot`                 |
| `editions:register`          | `tsx --conditions=react-server scripts/ops.ts contract`              |
| `editions:control`           | `tsx --conditions=react-server scripts/ops.ts edition-control`       |
| `editions:index`             | `tsx --conditions=react-server scripts/ops.ts edition-batch`         |
| `worker:editions`            | `tsx --conditions=react-server scripts/edition-worker.ts`            |
| `ops:deployment`             | `tsx --conditions=react-server scripts/ops.ts record`                |
| `capacity:render`            | `tsx --conditions=react-server scripts/capacity.ts`                  |
| `capacity:web`               | `tsx scripts/web-capacity.ts`                                        |
| `release:check`              | `tsx scripts/release.ts`                                             |
| `security:secrets`           | `tsx scripts/secrets-audit.ts`                                       |
| `production:report`          | `tsx --conditions=react-server scripts/ops.ts report`                |
| `integrations:pilot:approve` | `tsx --conditions=react-server scripts/ops.ts pilot-approve`         |
| `launch:status`              | `tsx --conditions=react-server scripts/launch.ts status`             |
| `launch:report`              | `tsx --conditions=react-server scripts/launch.ts report`             |
| `launch:check`               | `tsx --conditions=react-server scripts/launch.ts check`              |
| `launch:verify`              | `tsx --conditions=react-server scripts/launch.ts verify`             |
| `launch:attest`              | `tsx --conditions=react-server scripts/launch.ts attest`             |
| `launch:rpc`                 | `tsx --conditions=react-server scripts/launch.ts rpc`                |
| `launch:sources`             | `tsx --conditions=react-server scripts/launch.ts sources`            |
| `launch:replay`              | `tsx --conditions=react-server scripts/launch.ts replay`             |
| `launch:audit`               | `tsx --conditions=react-server scripts/launch.ts audit`              |
| `launch:provenance`          | `tsx --conditions=react-server scripts/launch.ts provenance`         |
| `launch:handoff`             | `tsx --conditions=react-server scripts/launch.ts handoff`            |
| `launch:explain`             | `tsx --conditions=react-server scripts/launch.ts explain`            |
| `launch:spot`                | `tsx --conditions=react-server scripts/launch.ts spot`               |
| `artwork:warm`               | `tsx --conditions=react-server scripts/warm-artwork.ts`              |
| `collectors:discover`        | `tsx --conditions=react-server scripts/collector-discovery.ts`       |
| `test:identity`              | `tsx --conditions=react-server scripts/test-collector-identity.ts`   |
