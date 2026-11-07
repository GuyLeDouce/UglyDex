# UglyDex visual identity refinement

## Audit and preservation contract

Baseline: main 7ca5dd4. Reviewed the live landing page, Explorer, Squig #210 Passport, and GuyLeDouce's public collector record; the current Pudgy reference is a character-led storefront. Its useful principles are generous composition, confident type, recognizable artwork, and clear navigation—not its commerce structure or palette.

The existing UI loads nine global stylesheets. visual.css alone contains 3,349 lines, repeated landing treatments, night-background contrast overrides, and broad panel rules. The same heavy borders, offset shadows, pill navigation, and pastel boxes recur across statistics, provenance, profiles and filters. Mobile filters are all expanded before the collection begins. The recent trading-card faces are already a strong exception and remain intact.

Preserve:

- SiteHeader: signed-out public access; authenticated collection/profile/account menus; immediate POST logout; galleries feature flag; wallet/settings links.
- Catalog: q, dex, favorites, set, sort, rarity, og, legendary, trait/value, min/max; GET query semantics, listing availability, pagination, grid/compact preference.
- TradingCardFace and CompactSquigCard: full traits, rank, rarity, official artwork, badges, discovery, ownership, favourites, external market links.
- Passport: identity, traits, power, provenance, ownership, custom art selection, level/XP, achievements, activity, share/export.
- Collector: public/private visibility, verified wallets, owned/discovered history, completion, six favourites, sets, badges, activity, share and optional galleries.
- My collection/Dex: all calculations, navigation, refresh, discovery search shortcuts and advanced filters.
- Authentication: wallet signatures, Discord, DRIP, multi-wallet linking, onboarding, opt-out and settings unchanged.
- Rankings, timeline polling, Customs, legal/admin states, APIs and workers unchanged.

No production data, metadata, scoring, rules, identities or server algorithms are part of this change. Authenticated visual review uses isolated test identities, never fabricated production sessions.

## Direction

An illustrated field guide: warm paper, charcoal ink, forest green, small amber/lilac accents. The existing Lilita display face supplies personality; Montserrat handles reading and metadata. Broad sections, numbered editorial headings, inline figures, thin rules, and original Squigs create hierarchy. Detailed collectible cards keep their own rarity frames and cream interiors. Controls use modest corner radii; pills are reserved for meaningful small states. Motion is brief, optional and respects reduced motion.

Home introduces the universe, then offers public collection, collector, sets/history and Customs routes. Shared shell, content surfaces, forms, navigation, progression, timelines and rankings receive the same system. Advanced Explorer controls remain available through disclosure, which opens automatically when those filters are active.

## Assets

Use existing official artwork through Artwork and the existing delivery/cache pipeline; retain the established UglyDex logo. No new image service, generated character substitutes, or per-card rendering request. Additional canonical transparent group art could enrich future campaign sections but is not required for this release.
