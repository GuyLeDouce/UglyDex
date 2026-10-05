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

Twelve PNGs are in the ignored local folder `.data/phase13-visual/`:

- Desktop: `landing-1440.png`, `my-uglydex-1440.png`, `collection-1440.png`, `squig-3157-1440.png`, `achievements-1440.png`, `charm-1440.png`.
- Additional widths: `collection-1024.png`, `collection-768.png`.
- Mobile: `landing-390.png`, `my-uglydex-390.png`, `collection-390.png`, `squig-3157-390.png`.

They use the seeded app fixture and catalog artwork paths, not Vince's example records. The screenshot files and extracted reference project are ignored and are not part of Git.

## Validation

- `npm test`: 728 tests passed across 28 files.
- `npm run lint`: passed in the isolated C: NTFS validation copy.
- `npm run typecheck`: passed in the isolated C: NTFS validation copy.
- `npm run format:check`: passed; final changed CSS and screenshot helper also passed Prettier.
- Production build: `npx next build --webpack` passed in the isolated C: validation copy; all app routes were generated.
- Focused visual DB/browser capture: 688 assertions passed, including route responses and viewport overflow checks. It ran in the isolated copy with visual-only skips for unrelated legacy migration-drift, wallet-link environment, and compact-preference checks; the complete unit suite above ran without those skips.
- No staging or production deployment was made.

## Backend preservation

No changes were made to Prisma schema, migrations, authentication or identity semantics, DRIP integration semantics, source integrations, progression rules, collection engine, worker behavior, or launch gates. The landing page only reads existing catalog records. $CHARM and its DRIP-ID link flow retain their existing server behavior and privacy rules.

No unresolved visual preference is blocking operator review. Landing catalog image delivery should be reviewed in the deployed network context alongside these local previews.
