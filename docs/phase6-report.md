# Phase 6 implementation report

Phase 6 builds a social presentation layer on the existing canonical Squig, provenance, progression and collection projections. No external repository/database was changed and no reward or financial logic was added.

## Delivered

- **Galleries:** CollectorGallery and CollectorGalleryItem, stable IDs, normalized unique per-collector slugs, revisions, bounded plain captions/sections, keyboard ordering, cover selection/automatic collage, featured gallery, safe deletion. Grid, Exhibition and Compact layouts; up to 12 galleries of 100 items each.
- **Visibility:** PUBLIC listed, UNLISTED direct-link/noindex, PRIVATE owner-only. A private Collector profile hides all galleries publicly. Current galleries filter out sold/ineligible Squigs at read time; historical galleries preserve confirmed discoveries labelled Previously Owned and remove invalidated evidence.
- **Showcase:** collector level/title and concise completion lead into ordered favourite Squigs, earned badge and completed-set trophy case, a featured public gallery and three recent permitted activity entries. Coherent collector navigation and a dedicated public collection subpage keep detail off the showcase. Full / featured-only / hidden collection controls are validated server-side.
- **Sharing:** Collector, completion, trophy, Squig, Passport, achievement, set, gallery, collection collage, confirmed discovery and durable completion/level milestone cards. Square 1080×1080 and landscape 1200×630 PNG, Clean/Ugly/Stats styles, copy/native link sharing, native file sharing where available, download and safe suggested copy. No automated posting.
- **Collages:** manually ordered 4/9/16 current tokens, featured/favourites, top UglyPoints, recent indexed acquisition, deterministic seeded shuffle; deterministic set-evidence subsets. Every request rechecks token eligibility and visibility.
- **OG/SEO:** centralized public projections feed dynamic Open Graph/Twitter images and canonical metadata. Private/admin/settings/self pages and unlisted galleries are noindex. Unknown/private resources do not receive personalized previews.
- **Privacy/security:** no raw database records passed to the renderer. No wallet/Discord IDs, attribution evidence, source IDs, session material or unpublished content in cards. Pending/revoked earned facts are withheld. Fixed canonical-CID artwork fetches, no caller URLs/avatar fetches, redirect rejection, timeout/body/signature limits, bounded concurrency, corrupt-raster fallback, DB request/render budgets and same-origin gallery mutation guards.
- **Caching:** fresh privacy/evidence lookup before cache access and a second projection check before image delivery. Private/no-store HTTP. A bounded 24-entry/60-second PNG cache and separate 24 MB immutable-artwork cache; no permanently public PNG objects. External social caches/downloads cannot be recalled.
- **Diagnostics:** protected /admin/sharing with gallery visibility totals, latest rendering/cache/fallback/duration metrics and public-entity preview links. No invasive analytics.

## Routes

/settings/galleries, /settings/sharing, /collector/[slug]/gallery/[gallerySlug], /collector/[slug]/collection, /share, /api/settings/galleries, /api/share and /admin/sharing. Existing profile, Squig, achievement, trait, set, explorer and dashboard surfaces gained navigation/sharing/metadata or privacy presentation.

## Schema and deployment

Additive native migration **202609280008_sharing** adds galleries/items, gallery enums, Collector.collectionVisibility and ShareRenderMetric. Database constraints cover case-normalized slugs, one featured gallery and bounded items. Existing ownership/evidence/progression ledgers remain authoritative.

Run npm run db:migrate against UglyDex, then deploy the matching web service. No new package, mandatory secret or worker is required. Keep existing workers running. PUBLIC_BASE_URL supplies canonical HTTPS links; existing AUTH_SECRET protects owner sessions. Rendering uses Next's bundled font/runtime. Allow canonical gateway egress, provision web memory with rendering headroom, and retain private/no-store headers. See [Railway](railway.md) and [sharing](sharing.md).

## Validation

Final validation on **2026-09-26**:

- **371 unit tests passed** across nine files, including 49 sharing tests covering validation, gallery access, deterministic selection, bounded request bodies, SSRF rejection, artwork limits and fallbacks.
- **383 disposable PostgreSQL assertions passed** with `npm run test:db`, without the optional canonical catalog import.
- **584 PostgreSQL / production HTTP / Chromium / catalog assertions passed** with `npm run test:db -- --web --browser --catalog`. This includes all Phase 0–5 regressions, import/replay of all 4,444 canonical Squigs, gallery CRUD and ownership semantics, ordering/captions, public/unlisted/private access, profile and gallery visibility transitions, owner preview authorization, featured-only discovery/collage privacy, earned cards and durable milestones, exact OG metadata, actual PNG bytes/dimensions, cache revocation, rate limiting and authenticated admin diagnostics.
- Browser assertions cover the collector showcase and earned trophy case at 320, 390 and 768 pixels; gallery layouts; collage studio; set and Squig sharing; safe captions; keyboard ordering and saving; PNG download; and native link/file payloads. Native file sharing is invoked from a fresh user gesture. OS share targets are mocked in Chromium; real-device smoke testing remains part of deployment validation.
- Mobile gallery, collector/trophy showcase, share-panel screenshots and actual server-rendered cards were visually inspected. Live canonical artwork rendered successfully; missing/corrupt artwork also produced valid fallback cards. Rapid browser navigations produce non-fatal Next stream-cancellation diagnostics; all HTTP assertions and browser runtime-error checks passed.
- **ESLint, Prettier, explicit TypeScript checking, Git whitespace checks and the production build passed.** `collections:verify` reports 345 traits, 52 feasible sets and zero errors.
- Disposable web/database processes shut down successfully. The inspected UglyBot, The Gauntlet and ImageSubmit working trees remain clean. No production database migration, deployment or backfill was performed.

## Production limitations

Production ownership/provenance and legacy backfills remain unconfigured here; fixture results are not production lifetime totals. The canonical artwork gateway was checked successfully with a real PNG and an actual rendered card; it also exhibited cold-start latency/rate limits. Bounded caches and token-tile fallbacks handle these conditions. PNG typography is intentionally Latin/ASCII to avoid implicit remote emoji/font fetches; web text remains Unicode. Gallery slug changes do not create redirects. Presets show fewer images if fewer eligible tokens exist. No uncertain completion deltas are invented for discovery cards. No QR code, external posting integration or visitor tracking was introduced.

## Recommended Phase 7

First configure and audit production provenance/legacy pilots, reconcile identities and replay progression/collections; verify real mobile wallet/gallery/share flows and rendering budgets on Railway. Then implement non-financial collector customization and ownership/indexing for verified Customs/Editions contracts. Keep any paid customization, subscriptions or currency spending behind a separately approved design with explicit source-of-truth, authorization and refund semantics. Do not attach automatic currency rewards to achievements or collection sets.
