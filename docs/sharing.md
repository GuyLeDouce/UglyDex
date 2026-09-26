# Galleries and sharing

Phase 7 adds `custom` cards, per-item verified gallery artwork and owner-specific featured/share art. URLs carry only canonical token and catalog key. The server projects verified immutable IPFS URI/hash pairs into the renderer, decodes bounded PNG/JPEG bytes, validates the hash and rechecks catalog/privacy state before returning PNG. Retirement revokes future requests, including cache hits. Enumerated accents/share styles preserve dimensions, no-store responses and render budgets. See [collectibles](collectibles.md).

Phase 6 is a presentation layer over indexed UglyDex data. It does not import external databases, change ownership, award XP or issue rewards.

## Gallery semantics

CollectorGallery has a stable UUID, normalized per-collector unique slug, name/description, visibility, evidence mode, layout, cover token, featured flag, revision and timestamps. CollectorGalleryItem references the canonical Squig, with explicit order, plain-text caption and section. A gallery contains at most 100 distinct tokens; a collector has at most 12 galleries and one featured gallery. The editor has accessible up/down controls. Current galleries require active verified-wallet ownership and suppress dirty provenance or confirmed Maw digestion. Historical galleries use settled Phase 5 confirmed discovery projections. Every public read reevaluates eligibility: sales hide current items, historical items remain labelled Previously Owned, and invalidated discovery disappears. The stored gallery reference survives these transitions.

PUBLIC galleries appear on public profiles. UNLISTED galleries require the direct URL and are noindex, but are not password-protected. PRIVATE galleries are owner-only. A private profile hides **all** its galleries from everyone else, including unlisted links. The owner can preview them. An individually published gallery is an explicit disclosure separate from the full-collection setting. Slug edits retain the UUID and contents but change URLs; no alias redirects are created in V1. Rename the title without changing the slug to keep a shared URL.

Mutations require a session, same-origin POST/DELETE, a shared DB rate limit, validated fields and ownership. Advisory locks serialize gallery saves; revisions reject stale edits. Database constraints enforce lowercase slugs, unique featured gallery and item bounds. Gallery deletion cascades presentation items only; NFTs, discoveries, progression and history are preserved.

## Profile and public projections

Collector.collectionVisibility supports FULL (existing behaviour), FEATURED_ONLY and HIDDEN. Hidden suppresses profile artwork and public collection collages. Featured-only shows the collector's ordered six-token selection. Public set evidence is also suppressed unless full collection and wallet-attribution visibility are enabled. Explicit public galleries are independent disclosures. Public blockchain records may still be correlated with intentionally disclosed artwork; hiding a collection does not make blockchain records private.

Profile identity, gallery views and ShareCard are explicit allowlisted projections. ShareCard contains only title, description, presentation labels, stats, canonical token IDs, permitted dates, path and indexing status. No wallet/Discord ID, source record, attribution/reconciliation evidence, session data or unpublished submission enters the renderer. Pending collection/progression evaluations withhold stale claims. Private resources and unknown resources return the same unavailable response.

## Cards and links

- Collector identity/level, My UglyDex completion, Trophy Case.
- Squig artwork/points/rank/level and Passport tracked Duel/transfer facts.
- Active achievement unlocks, including historical qualifying dates.
- Currently valid historical/current set completions, with deterministic qualifying-token subsets when evidence visibility permits. Current sets say Currently complete.
- Gallery cover token or automatic first-nine collage.
- Collection collage: explicit 4/9/16 token IDs, featured/favourites, top UglyPoints, recent indexed acquisition (observation time fallback), or stable seeded shuffle. Presets use up to the selected count when holdings are smaller; every token is revalidated. Public featured-only collages cannot select other holdings.
- Confirmed discovery cards (public requests require historical-attribution visibility and the selected collection visibility mode) and durable completion/level milestones. Featured-only profiles can share only featured discoveries. No uncertain before/after percentages or invented set-advancement deltas are shown.

The share studio is /settings/sharing. /share uses validated kind/entity/key queries as a public landing page. Collector/Squig/gallery cards link to their canonical resource; Passport, trophy and earned cards link to their distinct public share page. Copy, native link sharing, native PNG sharing when supported, and download work without posting APIs. Native file sharing first prepares the PNG, then uses a fresh Share image tap so slow rendering cannot consume the browser's required user activation. Unsupported browsers download instead. See the [Web Share API requirements](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share). Private owner previews intentionally disable public link sharing; sharing a downloaded file is the owner's explicit disclosure. Public collectors can explicitly select Owner preview in the studio to generate a card containing their privately held collection or qualifying evidence. No analytics tracker or automated social posting is installed.

## Rendering and assets

/api/share runs in Node using Next ImageResponse, producing 1200×630 landscape or 1080×1080 square PNG. Clean, Ugly and Stats presentations share a single layout renderer. Native raster generation uses Next's bundled Noto Sans Latin font, not desktop fonts. PNG text is transliterated to printable Latin/ASCII with unsupported glyphs omitted (a wholly unsupported name uses generic UglyDex); web text retains Unicode. This prevents automatic remote font/emoji fetches. Artwork dominates the layout; a token tile replaces missing artwork.

The renderer accepts **no remote image parameter** and does not fetch profile avatars or arbitrary stored URLs. It reconstructs the existing canonical artwork CID through the centralized resolver, restricts tokens to 1–4444 and uses the fixed HTTPS Pinata gateway. Fetches reject redirects, time out after eight seconds, check JPEG/PNG signatures/content type and bound the streamed body to 3 MB. A separate immutable-artwork cache holds up to 24 MB / 128 entries for 24 hours, coalesces duplicate downloads, and briefly caches failures for 30 seconds. At most four artwork fetches per render run concurrently, for at most 16 tokens. SVG and other formats are rejected. A failed image cannot break the whole card.

## Privacy and caching

Every request loads current visibility/evidence before rendering or cache reuse, then rechecks its projection before sending bytes. A concurrent state change returns 409 for a reload. Responses use private, no-store, max-age=0; no public CDN artifact or permanent PNG URL is written. Each web process keeps at most 24 PNGs under 2 MB for 60 seconds, keyed by the complete safe DTO, template, ratio and renderer version. Privacy checks are never cached. Requests to old URLs stop working after profile/gallery visibility changes. External social networks may retain their own already-fetched previews or downloaded copies; UglyDex cannot retract a file someone has already saved.

DB-backed minute buckets impose a 120-request global ceiling, 20 per authenticated user, and 30 new renders globally; two renders may run per web process. These conservative defaults do not trust client-provided forwarded IP headers. Scale limits intentionally after observing load. A 429 includes Retry-After. This shared global ceiling protects anonymous preview traffic without tracking visitors; it can also make previews temporarily unavailable during bursts.

## SEO and operations

Public Collector/Squig/gallery/share resources have canonical URLs and Open Graph/Twitter large-image metadata. Private resources use generic noindex metadata. Unlisted galleries are noindex. /me, /settings, /admin and private /collection pages inherit noindex. Gallery/page previews use the same public projection as downloadable cards.

/admin/sharing is protected by the existing authenticated Discord admin policy. It reports gallery visibility counts and the latest 50 render outcomes, cache hits, durations and failed artwork counts, and links to validated public previews. Diagnostics store no private image contents, viewer IPs or collector identifiers. ShareRenderMetric contains only type/status/count/timing. Keep operational metric retention bounded during routine DB maintenance; PNGs are never persisted.

Deploy migration 202609280008_sharing to UglyDex only. Rendering stays in the web service, with no new worker, package, mandatory secret or external credentials. PUBLIC_BASE_URL must be the canonical HTTPS origin. Allow outbound HTTPS to the canonical artwork gateway. Start with at least 512 MB web memory and measure peak render memory before increasing concurrency; a 1 GB budget provides more headroom. See Railway instructions.

If a card is unavailable: verify public/profile/gallery privacy, canonical token eligibility, an active unlock/completion, and drained progression/collection queues. Retry 429 after the advertised interval. Artwork fallback indicates gateway timeout, malformed response or size/type rejection, not missing ownership. Changing a title/slug/privacy takes effect on the next request. No production backfill or lifetime-history completeness is implied by fixture validation.
