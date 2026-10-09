# Phase 13 Visual Overhaul Report

## Reference audit

Inspected the current Vince reference archive from an ignored temporary extraction: `UglyDex Neon.dc.html`, the supplied visual screenshots, and `assets/uglydex-logo.svg`. The supplied mark is copied once to `public/brand/uglydex-logo.svg` and used by the shared header and landing page.

Adopted the deep night setting, bold Montserrat typography, paper boards, strong ink outlines, hard offset shadows, pill navigation and controls, and the yellow, green, lilac, and pink collectible accents. The reference's card hierarchy informed the presentation, while all card content continues to come from UglyDex records and artwork.

Rejected the demo's application structure, demo records, placeholder features, and build prompt as implementation material. No reference cards or demo data were added to the app or database.

## Design system

- Palette tokens live in `src/app/visual.css`: midnight navy, paper, ink, green, yellow, lilac, pink, and muted text.
- Montserrat is loaded through `next/font/google`; headings and stats use heavy weights, while body copy remains sentence case.
- Panels use 3px ink borders, 18–28px corners, and crisp 4–9px offset shadows.
- Background stars and radial rays stay behind content. Motion is CSS-only and reduced for `prefers-reduced-motion`.
- Shared shell and reusable styles cover the brand header, mobile menu, paper boards, cards, controls, stats, pills, and badges.

## Route coverage

- Dedicated landing treatment: `/` with the existing “Every Squig has a story” line, real catalog sample, and wallet/explore actions.
- Flagship collector board: `/me`, with identity, summary stats, $CHARM/DRIP linking, completion, progression, activity, discoveries, standouts, collection history, galleries, and share/profile controls retained.
- Catalog and collection surfaces: `/collection`, `/collection/dex`, `/collection/discovered`, `/squigs`, `/collection/sets`, `/collection/traits`, `/collection/editions`, `/traits/[traitType]/[traitValue]`, and `/sets/[key]`. Existing filters and pagination remain available; secondary filters stay expandable.
- Squig information: `/squig/[tokenId]` and `/squig/[tokenId]/achievements`, with the art framed first and deeper history and provenance retained below.
- Achievements and activity: `/me/achievements`, `/me/activity`, `/me/creations`, and public collector activity, achievement, set, creation, and gallery pages.
- $CHARM: `/charm` preserves the existing current-balance state, private behavior, exact DRIP-ID verification form, and tracked history semantics.
- Shared styles also reach public collector passports, galleries/share studio, settings, connect, and Editions pages. All existing routes remain in the production build.

Collection cards retain their filters and underlying holding data. Holding-history detail is de-emphasized in the default grid and remains visible in compact/detail presentations.

## Responsive review

Captured and inspected at 1440px, 1024px, 768px, and 390px. The mobile header uses a keyboard-operable native disclosure menu instead of overflowing desktop navigation. Browser assertions checked document width at the captured viewports; no horizontal overflow was found. Mobile boards stack, stats wrap, and the Squig detail becomes a vertical layout.

## Accessibility

- Preserved the skip link and added visible focus styling.
- Native `<details>` navigation reports open/closed state and works with keyboard activation.
- Reduced-motion preferences disable decorative animation.
- Controls retain labels and semantic elements; card relationships and important details do not rely on hover.

## Screenshots

Fourteen regenerated PNGs are in the ignored local folder `.data/phase13-visual/review2/`. The previous-round files at the folder root were left untouched because they were open in the local image viewer.

- Desktop: `landing-1440.png`, `my-uglydex-1440.png`, `collection-1440.png`, `squig-3157-1440.png`, `achievements-1440.png`, `charm-1440.png`, `connect-1440.png`.
- Additional widths: `collection-1024.png`, `collection-768.png`.
- Mobile: `landing-390.png`, `my-uglydex-390.png`, `collection-390.png`, `squig-3157-390.png`, `connect-390.png`.

They use the local visual-test Collector fixture and the real canonical catalog artwork paths, not Vince's example records. The Collector fixture is intentionally empty, so `/me` and `/collection` show their true empty states; authenticated populated layouts remain available for operator review against staging data. The screenshot files and extracted reference project are ignored and are not part of Git.

## Validation

- `npm test`: 728 tests passed across 28 files in the isolated NTFS validation copy.
- `npm run lint`: passed in the isolated NTFS validation copy.
- `npm run typecheck`: passed in the isolated NTFS validation copy.
- `npm run format:check`: passed in the repository workspace.
- Production build: `npm run build -- --webpack` passed in the isolated NTFS validation copy; all 43 app routes were generated.
- Focused visual DB/browser capture: 80 assertions passed, including route responses, desktop/mobile overflow, keyboard mobile navigation, exact 4-desktop/2-mobile artwork priority, and Squig detail share/caption behavior. It used local catalog and private-balance fixtures and skipped unrelated Phase 1–11 DB/replay/bridge checks.
- The direct E: test/lint attempt hit filesystem-junction module-read errors; reruns in the NTFS copy passed. No application workaround was added for that environment issue.
- Staging, production, workers, bridges, and database state were not changed before the dedicated visual-preview deploy.

## Operator review round 1

- Reduced the header logo by roughly one fifth and removed the duplicate hero logo. The landing hero now pairs its headline with an overlapping composition of real catalog Squigs; the manifesto uses a real specimen to balance the copy.
- Refined the landing specimen layout so all three faces remain visible, widened the manifesto board into its intended balanced two-column composition, tightened section spacing, and moved the Ethereum / Squigs Reloaded badge beside its specimen heading. The existing three sample cards and their information density remain intact.
- Rebuilt `/connect` as a centered, compact two-column onboarding panel with a decorative UglyDex lightning/ray treatment. Wallet and Discord actions, messaging, and identity behavior are unchanged.
- Explore filters have less padding while retaining their controls and advanced filters. The first desktop row prioritizes four artworks and the first mobile row prioritizes two; remaining catalog art stays lazy-loaded. The count updates after client mount and when the viewport crosses the breakpoint. Artwork loading now shows a quiet color specimen rather than “Loading artwork…” text.
- Left the approved Squig detail hero composition intact. Tightened its controls and breadcrumb spacing; distinguished image sharing from passport sharing; attached the canonical-art label as a caption strip; made the provenance summary a responsive set of evidence tiles; and reduced chain-event row height while keeping event details expandable.
- Added compact, real-achievement mini cards for recently earned items. Ecosystem summaries now use small category-accented tiles rather than nested panels, and activity rows are tighter while observation-only styling remains distinct.
- Continued restrained lilac, green, yellow, and blue accents below the hero. Ownership and UglyPoints cards now size to their content; collection filters, authenticated dashboard sections, and `$CHARM` totals use less padding and fewer nested outlines. All existing data, routes, filters, and actions remain present.

## Operator review responsive checks

The refreshed screenshots cover desktop at 1440px; the collection at 1024px and 768px; and mobile at 390px. The Connect route now has desktop and mobile captures. Browser assertions cover route responses, width overflow, native keyboard mobile navigation, desktop/mobile artwork priority counts, and the detail sharing/caption controls. Detailed test results are recorded below after the latest capture run.

## Backend preservation

No changes were made to Prisma schema, migrations, authentication or identity semantics, DRIP integration semantics, source integrations, progression rules, collection engine, worker behavior, or launch gates. The landing page only reads existing catalog records. $CHARM and its DRIP-ID link flow retain their existing server behavior and privacy rules.

No unresolved visual preference is blocking operator review. Landing catalog image delivery should be reviewed in the deployed network context alongside these local previews.

## Final operator approval / staging merge

- Approved visual source: `b474298232da01c99a7be37e30da1e64408ec740`. The final optional polish improved contrast on the landing collection badge and provenance caption readability. The merged functional branch is `bf125c7715003418045a662f2e4f1b61376b8fdc`.
- Staging deployment used the reviewed migration-byte snapshot for this schema-neutral visual revision. Web deployment `d43d16d0-09ca-4ec4-a168-7131fe6cbb27`; worker deployments: blockchain `4bbefa16-a9dc-4bba-a4a5-11759e4de91e`, ecosystem `f94f6be6-de90-4967-9abd-c6b7c030c6c8`, progression `73124948-9152-469b-b20d-842fc653f10b`, collections `351222ae-f72f-4a31-9a75-0cd6dcf6efbf`. All five staging services reported the intended `APP_COMMIT` value. The web healthcheck and public `/api/ready` returned 200; staging smoke passed 10/10.
- Public routes returned 200 for `/`, `/connect`, `/squigs`, `/squig/1`, and `/editions`. Protected routes redirected to authentication when checked without a session. Authenticated real-account QA was not completed in this environment.
- Read-only browser QA against staging at 1440, 1024, 768, and 390 pixels found no horizontal overflow on the checked routes. First-row artwork loaded for four desktop cards and two mobile cards; the mobile navigation opened; Squig detail artwork, traits, UglyPoints, provenance, events, and progression rendered. The existing staging smoke explicitly left authenticated wallet/OAuth and private-resource checks pending.
- `npm run staging:smoke`: 10/10. Unit, lint, typecheck, format, and production build passed in the isolated NTFS validation copy as recorded above. A new focused visual DB/browser harness attempt was blocked by existing Phase 7 migration-drift and Phase 12 fixture-phase assumptions; it did not invalidate the independent 80-assertion visual run from the approved visual branch.
- No $CHARM, DRIP identity, balance, or privacy code changed. No authenticated $CHARM account regression was run here; existing balance/link behavior was not exercised with an authenticated browser session during this deployment check.
- Production was not deployed or changed. The web-only visual preview remains available at `https://uglydex-visual-preview-staging.up.railway.app/` (deployment `60d7d889-8af4-42bd-b620-772316e1a3c5`).

### Staging credential follow-up

During a staging-only diagnostic, Railway tunnel output exposed the staging database credential in tool output; no database write or SQL operation occurred. The operator authorized rotation. Railway's current supported procedure is the Postgres service's Config → Connection → Regenerate control, which synchronizes the in-database password and Railway variables. This environment has no Railway dashboard browser session, and the Railway CLI exposes no Postgres password-regeneration command. No manual variable edit or `ALTER USER` was attempted because either alone would leave credential state inconsistent.

At the time of this note, rotation and restart were still pending and the ecosystem worker's post-rotation heartbeat had not been verified. The results below supersede that status.

### Post-rotation staging validation

This section supersedes the pending status above. The operator regenerated the staging Postgres credential. Railway-managed `DATABASE_URL` references were applied to the web service and all four staging workers. In-memory fingerprints of host, user, password, and database matched the current Postgres service across all five services; no credential value was printed. The prior exposed credential was not retained or tested.

- All five services run `APP_COMMIT=46d442fd89570074d4f6dbc118ec8e97ed5ffe58`. Web deployment `da8914a7-fa43-4587-b526-483713d73422`; blockchain `b859ae51-435f-4446-8495-93f1761f3d5e`; ecosystem `61149da3-c951-4f6c-a7e7-915a093f5a85`; progression `c251ea49-0e6a-415f-82a1-57a168d65891`; collections `e6cd339d-9bd0-46aa-a867-de0748d6ce3d`. All five deployments completed successfully.
- Web `/api/ready`, `/`, `/connect`, `/squigs`, and `/squig/1` returned 200. `/me`, `/collection`, and `/charm` redirected unauthenticated requests to sign-in as expected. Staging smoke passed 10/10.
- Progression and collections have fresh heartbeats and successful LIVE cycles; failed job counts are zero. Their `WorkerControl` modes remain LIVE.
- Blockchain and ecosystem have fresh heartbeats and remain in LIVE mode, but have not completed a successful cycle. Blockchain is `WAITING_BACKFILL`: its durable cursor is finalized at block 26,151,970 but has a persisted prior error. Ecosystem is `WAITING_SOURCE_VALIDATION`: the `claimEvents` source remains `ERROR` with `IMPORT_FAILED`. No cursor, queue, source status, or data was manually reset or changed. These two worker blockers mean the full worker-health requirement is not yet met.
- Read-only aggregate checks found 4,444 Squigs, 11,105 transfers, 4,444 provenance rows, 378 Collectors, 33,903 activity rows, 14,003 XP ledger rows, populated achievements and collection/discovery state, one DRIP identity, one current balance record, and 13 migration records. Web migration logs reported no pending migrations. No database writes were performed during these checks.
- The account-menu stacking regression test passed 3/3. The deployed revision includes the header stacking fix; an authenticated interactive menu click test was not run in a browser session during this rotation check.
- Production was not accessed or changed. The visual preview was left untouched.

### Worker recovery after post-rotation validation

The current application revision was `18dea7c833e4294ac93d59898e9bb87009715df3`. No application code, schema, migration, or production service was changed.

#### Blockchain

- Before recovery, the durable cursor was at block `26,151,970`, with finalized boundary `26,151,970`, start block `25,342,921`, and `lastError=CHAIN_SYNC_FAILED`. The preceding worker log recorded only `OPERATION_FAILED`; the wrapper suppressed the underlying exception, so its precise original cause is not recoverable from retained evidence.
- Read-only checks confirmed mainnet chain ID 1, the configured Squigs contract and start block, cursor below the live finalized head, matching live hashes at the cursor and four recent stored anchors, and the intact 4,444-token provenance baseline. No reorg or cursor-integrity discrepancy was found.
- With only the blockchain WorkerControl disabled and its advisory lock free, one normal `transferBatch()` succeeded for blocks `26,151,971–26,152,161` (`0` transfer events). It advanced the durable cursor/finalized boundary to `26,152,161`, refreshed the block hash and success time, and cleared the stored error through the normal codepath. The transfer count stayed at 11,105; no rescan or rewind occurred.
- Blockchain control was returned to LIVE through the guarded operator control API. Its latest worker cycle completed successfully at `2026-10-09T03:53:46Z`; state `IDLE`, heartbeat fresh, `errorCode=null`, circuit breaker clear.

#### claimEvents

- The prior run ended `FAILED/IMPORT_FAILED` after scanning 200 already-canonical records; it reported 200 duplicates, zero inserts, and zero unresolved identities. There are no unresolved ImportRejections. The source table is reachable through the configured read-only bridge; its seven columns include all required fields and match fingerprint `0ef037d6d807a714f3bc9105209ebb57774b518525f2413651454a3b39440c9d`. A bounded cursor-based read returned a row whose timestamp and amount were parseable, without exposing values or identifiers.
- The retained failure is generic and does not identify whether the exception occurred during post-page persistence or another importer step. Current evidence rules out a present schema, permission, or bridge-query failure; the exact historical throw remains unavailable, so no more specific cause is asserted.
- With only the ecosystem WorkerControl disabled and its worker lock free, one normal `runActivityFeed('claimEvents', { maxPages: 1 })` succeeded. It scanned 200 records, normalized 200, classified all 200 as duplicates, inserted or updated none, and failed on none. The existing backfill and keyset/reconciliation state were used; no source state or cursor was reset. The bounded run remains `PARTIAL` because one full page was deliberately limited; source validation is true, `lastSuccessAt` updated, the source is no longer ERROR, warning is `TRACKED_AVAILABLE_HISTORY_NOT_LIFETIME`, and unresolved rejections remain zero. The sync run stores both cursor endpoints; its `cursorStart` field reflects the source's base cursor rather than the reconciliation cursor for a rotating feed, so that audit field cannot independently establish the prior reconciliation-cursor comparison.
- Ecosystem control was returned to LIVE through the guarded operator control API. Its latest worker cycle completed successfully at `2026-10-09T03:53:42Z`; state `IDLE`, heartbeat fresh, `errorCode=null`, circuit breaker clear. The source's remaining PARTIAL status is the normal bounded tracked-history state and does not block worker readiness.

#### Final worker and data status

- All four controls are LIVE and each latest heartbeat is fresh, state `IDLE`, with a successful cycle and no worker error: blockchain `03:53:46Z`, ecosystem `03:53:42Z`, progression `03:53:37Z`, collections `03:53:41Z`. Progression and collection failed-job counts are both zero.
- Aggregate staging data remains present: 4,444 Squigs, 4,444 provenance rows, 378 Collectors, 11,105 transfers, 33,970 activity rows, populated progression and collection/discovery records, one DRIP identity and one CharmBalance record. Dirty provenance is zero. No migration was run and no schema change was made.
- `launch:verify` and `launch:report` were run after recovery. `WORKERS` is VERIFIED; overall launch remains `NOT_READY` with 16 critical gates pending: `WEB_DEPLOYMENT`, `BACKUP`, `RESTORE_DRILL`, `ARCHIVE_RPC`, `START_BLOCK`, `OWNER_OF`, `REATTRIBUTION`, `ACTIVITY`, `DUPLICATE_REVIEW`, `PROGRESSION`, `COLLECTIONS`, `DERIVED_REPLAY_STABLE`, `CHARM_DRIP`, `HANDOFF`, `PRIVACY_AUTH`, and `REAL_DEVICE_SHARE`. No revision-bound gates were manually attested in this recovery.
- Production was untouched. The web-only visual preview was left unchanged.
