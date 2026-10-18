# Achievement badge integration

Feature branch: `feature/achievement-badge-integration`, based on `origin/main` at `e899aa0` (the merged release stabilization branch). No deployment or merge is part of this change.

## Assets and mapping

All 65 supplied originals are preserved byte-for-byte: 43 Collector and 22 Squig PNGs, each 512 × 512 RGBA. All decode successfully, have transparent corners, and have distinct SHA-256 hashes. The supplied CSV and JSON manifests contain identical records. Matching used **subject plus exact catalog name**, then stored the canonical key; the two “Certified Menace” achievements have separate mappings.

- `public/achievements/collector/`: 42 public Collector images.
- `public/achievements/squig/`: all 22 Squig images.
- `assets/achievements/collector/part-of-the-furniture.png`: the remaining Collector image, protected from static access.
- `src/server/achievement-badge-assets.ts`: the single typed canonical ID → URL registry and local-file resolver.
- `src/server/achievement-badges.ts`: viewer-safe presentation, URL resolution, deterministic ordering, and batched Squig award reads.
- `data/achievement-badges.json`: source filenames, subject/name associations, approved ring labels, destination files, and original hashes for reproducible integrity tests.

The originals total 22.07 MiB. Public thumbnails use Next Image optimization, fixed dimensions, stable URLs, lazy loading, and `object-fit: contain`. No artwork, rings, borders, colours, or transparency were edited. The extracted `Badges/` package remains untouched and untracked.

## Presentation and privacy

`AchievementBadge` accepts a viewer-safe server projection. It supports 24, 32, 48, 64, 96, and 128 px sizes. Earned artwork remains full colour; locked and blocked artwork uses grayscale, slight darkening, and reduced opacity. Accessible labels include status, and detail-grid tooltips respond to keyboard focus. Preference-checkbox artwork is decorative within the existing text label, preserving control names.

Locked secrets project only `{ status: 'hidden' }` to the badge component. Neither the complete registry nor the canonical achievement catalog is imported into new client code. The secret image route checks the existing progression projection and Collector privacy; even the owner cannot fetch a locked secret. Earned private artwork is available only to its owner. Responses use `private, no-store`, and Next's local image optimizer allowlist excludes protected API routes to prevent shared-cache bypasses.

Compact strips show up to three earned badges, followed by the remaining count. Ordering uses the existing achievement display tier, descending, with canonical catalog order breaking ties. It does not use NFT rarity, XP, or an invented score. Squig and Collector strips enforce their own subjects. Pending evaluations suppress stale badges; ready subjects without awards show an empty state.

## Changed surfaces

- Achievement grids, recent awards, signature preferences, and trophy cases use approved images.
- Squig cards in the catalog, home page, collections, featured profile collections, and galleries receive batched token-bound summaries. A batch uses three queries inside one repeatable-read snapshot, avoiding per-card database requests.
- Squig detail pages show all 22 achievements; existing dedicated achievement routes remain available. Compact NFT cards open those existing detail pages.
- Collector profile highlights show the compact Collector strip and link to the complete 43-achievement page. The signed-in dashboard uses the same presentation.
- Collector, Squig, passport, trophy, and individual achievement sharing use projected badge images. The existing PNG renderer embeds the original transparent PNG bytes. Landscape 1200 × 630 and square 1080 × 1080 dimensions remain unchanged. Multi-NFT collages keep their established artwork layout.

No changes were made to canonical definitions, requirements, progression evaluation, XP rules, provenance or transfer handling, indexing, schema, migrations, or persistence. New database operations in application code are reads only.

## Validation

Final reviewed source, 2026-10-18:

| Check                                          | Actual result                                                                                                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset/presentation test file                   | 76 tests passed, including all 65 original hashes, decoding, dimensions, alpha, canonical mappings, ownership categories, hidden states, ordering, overflow counts, and PNG exports |
| `npm test`                                     | 856 tests passed across 35 files                                                                                                                                                    |
| `npm run typecheck`                            | Passed                                                                                                                                                                              |
| `npm run lint`                                 | Passed, zero warnings                                                                                                                                                               |
| `npm run format:check`                         | Passed                                                                                                                                                                              |
| `npm run build -- --webpack`                   | Passed with Next 16.3.8, including TypeScript and route generation                                                                                                                  |
| `npm run test:db -- --web --browser --catalog` | 1,063 assertions passed; disposable database cleanup completed                                                                                                                      |
| Browser matrix                                 | Seven routes at 1440, 390, and 320 px: 21 checks, no horizontal overflow, no browser runtime errors                                                                                 |
| Existing rule/persistence source audit         | No diff in progression definitions/engine, sync/provenance code, Prisma schema, or migrations                                                                                       |

The database suite includes the existing ownership, progression, provenance, marketplace/collection, sharing, restore, and full-catalog Replay A/B checks. New checks exercise public/private/owner secret-image access, optimizer-cache bypass rejection, pending-award suppression, unchanged XP after badge reads, matching shared-card captions, complete 43/22 catalogs, keyboard tooltips, decoded images, and both export sizes. An earlier browser run caught a checkbox accessible-name regression; the decorative image fix was included in the passing final run.

The full database suite requires `--catalog`: a reduced-fixture invocation stopped at the existing full-catalog restore assertion. The documented full invocation passed. No unresolved badge integration failures remain.

The E: workspace contains an unrelated untracked staging source copy and an older installed Next version. Final verification uses an isolated NTFS copy of tracked files plus this feature, with the existing dependency installation whose lockfile matches the branch (Next 16.3.8). Direct E: builds hit the same filesystem junction/readlink problem documented in earlier project reports. The isolated build uses `npm run build -- --webpack`; no application workaround or dependency change was introduced for that environment issue.

Screenshots are captured from the production build using disposable local fixtures with 25 verified Duel wins. They are review evidence, not production account records. The full suite creates and cleans up its own PostgreSQL cluster.

## Reproduction

```text
npm ci
npm run typecheck
npm test
npm run lint
npm run format:check
npm run build -- --webpack
npm run test:db -- --web --browser --catalog
```

Browser evidence is generated under `.data/badges/`. The test checks complete catalogs, exact compact counts, locked/earned treatment, decoded images, secret-route access, exported PNG dimensions, keyboard tooltips, and overflow at 1440, 390, and 320 px.

## Review evidence

- [Achievement grid, earned and locked](evidence/achievement-badges/achievement-grid-desktop.png)
- [Squig card with three earned badges and overflow count](evidence/achievement-badges/squig-card.png)
- [Collector profile, desktop](evidence/achievement-badges/collector-desktop.png)
- [Collector profile, mobile](evidence/achievement-badges/collector-mobile.png)
- [Landscape export](evidence/achievement-badges/export-landscape.png) and [square export](evidence/achievement-badges/export-square.png)
- [All 21 route/viewport checks and browser error results](evidence/achievement-badges/browser-validation.json)

The complete page screenshots, build log, and regression logs remain in the ignored `.data/badges/` directory. The selected review images above are committed with the feature.
