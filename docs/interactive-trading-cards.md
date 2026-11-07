# Premium Squigs Reloaded cards

## Audit and preserved behavior

UglyDex uses Next/React, not Svelte. `TradingCardFace` is a DOM grid face;
`renderTradingCard` is a separate next/og renderer at 1500 × 2100. Both use
`tradingCardData` and the same rarity palette. Compact cards are a separate
component and are deliberately unchanged. Share Passport prepares a real PNG
blob, handles retry/privacy, and shares the prepared file. The ownership-checked
shortcut added in #80 still opens this existing format. Public viewing/sharing
remains public; the owner shortcut remains restricted to current verified
wallet holdings.

The renderer embeds Lilita One and Montserrat, fetches original artwork through
the existing safe artwork pipeline, and uses existing render concurrency/cache
limits. It already contains the brand, number, UP, Maw rank, OG, rarity, seven
possible traits, Legendary name, and footer. These fields and all canonical
metadata are preserved. Card render version 2 invalidates the existing image
cache after material changes; the existing printed V1 identifier stays unchanged. No metadata, ownership, authentication, schema,
rank, score, or progression changes are included.

## Reference assessment

Inspected the live https://poke-holo.simey.me/ and source of
https://github.com/simeydotme/pokemon-cards-css: Svelte spring motion feeds CSS
variables for rotation, glare and background position; masked gradients,
blend modes and texture layers create rarity finishes. Its LICENSE is GPL-3.0.
https://github.com/simeydotme/hover-tilt uses pointer normalization, spring
motion, glare masks and requestAnimationFrame batching; its LICENSE is MIT.
Neither codebase, its assets, textures, Pokémon art, or runtime is copied or
included. The implementation here is original procedural Canvas drawing and a small native WebGL projection shader.
No new package or hosted service is required. This avoids introducing a
reference-code licensing obligation into the application.

## Finish system

| Indexed rarity | Finish          | Treatment                                                 |
| -------------- | --------------- | --------------------------------------------------------- |
| Common         | Matte print     | Restrained edge sheen; no rainbow                         |
| Uncommon       | Satin metal     | Directional metallic highlight; no rainbow                |
| Rare           | Spectrum foil   | Moving spectrum and fine engraved diagonal lines          |
| Epic           | Prismatic foil  | Stronger spectrum, crossed engraving                      |
| Legendary      | Legendary prism | Gold palette, three engraved layers, strongest reflection |
| Unclassified   | Standard print  | Safe neutral treatment, no invented rarity                |

OG is orthogonal: a gold printed OG seal and gold brand rail accompany the
indexed rarity. No OG rarity is invented. Foil is clipped to frame rails and
the artwork-window edge; the original character pixels and printed information
are not recolored by the material layer. No fictional abilities or back are
introduced.

## Rendering and interaction

The existing PNG is the master face. Its response includes additive public
finish/description headers from the **same** card snapshot, preventing a
second metadata fetch from disagreeing with the image. The existing API body,
authorization, refresh check and limits are unchanged.

`card-material.ts` paints the same material for focused preview, finished PNG
and animation. A single GPU-projected plane presents the complete card without tile seams, with
restrained angles and room on all sides. Only the focused modal paints frames;
collection grids have no animation loop or export work. If WebGL is unavailable, the readable flat card and material remain available. GPU resources are explicitly released on close and after export. Canvas code is loaded
through a dynamic component only for a prepared trading card.

The native modal supports Escape, focus containment/return, pointer/touch,
keyboard arrows, reset, motion toggle, reduced-motion default, and hidden-tab
pause. It has an expandable, readable card description and full-size original
PNG fallback. Touch interaction does not request orientation/camera access.

## Export decision

Static: existing 1500 × 2100 PNG remains available, plus a finished PNG using
the shared material at a fixed light angle. Original fonts are already baked
into the server PNG, avoiding client font races and browser text differences.
Same-origin blob input prevents cross-origin canvas tainting.

Animated: draw real frames to a 900 × 1260 canvas, capture at up to 30 fps,
record a six-second closed motion cycle using MediaRecorder, then decode the
result before offering save/share. Prefer supported H.264 MP4; use honestly
labelled WebM where MP4 encoding is unavailable. Runtime feature detection is
required: MIME support alone is not proof an encode succeeds. Export has
progress, cancellation, error feedback, watchdog and cleanup. Switching away
from the tab cancels rather than silently saving a frozen recording.

MP4/WebM are video containers; looping depends on the receiving app. The
movement is cyclic and the built-in result player loops. Animated WebP has no
standard native browser animation encoder, and GIF would require a dependency
and compromise colors/text. Neither is added. There is no cloud encoder,
FFmpeg runtime, WebAssembly encoder download, or additional server workload.
FFmpeg is used **only in CI** to inspect actual downloaded videos.

Primary technical references:

- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static
- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/MediaRecorder
- https://developer.chrome.com/blog/capture-stream
- https://webkit.org/blog/11353/mediarecorder-api/

## Validation

`scripts/test-interactive-cards.ts` runs an isolated fixture database and production build. `tests/db/interactive-cards.ts` uses canonical examples of all five rarities,
plus OG Rare and OG Legendary. It downloads finished PNGs and real videos,
checks PNG dimensions, probes codec/dimensions with ffprobe and decodes frames
with ffmpeg to prove actual motion. It records rendered desktop and mobile
screenshots (360, 390, 430, 768) and checks overflow, reduced motion, reset and
Escape. Chromium and WebKit are tested; WebKit automation is not certification
on a physical iPhone, and desktop Chrome with mobile dimensions is not a
physical Android device. Actual run results and remaining limitations must be
recorded after CI and visual review, not inferred from these test definitions.

The new work is a feature branch and requires approval before production.
