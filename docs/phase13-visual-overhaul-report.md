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
