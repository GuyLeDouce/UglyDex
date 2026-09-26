# Phase 1 — collector, collection and discovery

## Delivered

Built on the existing Next.js/Prisma modular monolith without replacing Phase 0 integrations or changing any ecosystem repository/database. New private routes: `/me`, `/collection`, `/collection/discovered`, `/settings/profile`, `/settings/wallets`; new sign-in page `/connect`. Rebuilt `/`, `/squigs`, `/collector/[slug]`, and `/squig/[tokenId]` with an artwork-led dark field-guide design and responsive navigation.

The collection aggregates active proved Ethereum wallets, has grid/compact preferences, URL-backed token/OG/Legendary/class/trait/points filters, seven ordering choices, and 24-record server pagination. Real database summaries include points, OGs, Legendaries, discoveries, rarity distribution, common owned traits and the top three by points. Public profiles support up to six owned featured Squigs. Discovery cards distinguish current and previous ownership and show stored discovery dates. The Squig page presents artwork, canonical traits/points/rank, privacy-safe ownership, viewer relationship and the latest 30 indexed blockchain passport events.

## Schema and migration

`202609250003_collections` adds `Collector.showWallets`, `showDiscord`, `featuredTokenIds`, a unique `lower(slug)` index, collection query indexes, `OwnershipRefresh` and `CollectorRefreshRequest`. Existing UUID identities, events, achievements/XP/quests foundations remain intact. Run `npm run db:migrate` only against UglyDex. Existing case-colliding slugs would cause the new unique index to fail explicitly; resolve them deliberately before retrying rather than silently renaming users.

## Ownership and discovery

`sync:ownership` and `worker:ownership` use the same durable job. The worker pins one finalized block, checks its hash on resume, reads at most 100 owners per batch and commits observations/discoveries/checkpoint together. Three-minute leases are fenced with a shared advisory lock; crashed workers are recoverable. A failed RPC batch preserves its checkpoint and is retried after an explicit request. Unknown/reverted ownerOf calls do not erase an existing owner or pretend a token was burned. A finalized reorg requires operator investigation, not silent rollback.

Manual refresh is authenticated, origin checked and throttled to ten minutes per collector. Concurrent requests coalesce across collectors. The UI polls a small status endpoint; no page performs RPC scans. A new signature reconciles already indexed holdings and queues a refresh when RPC is configured. Historical finalized Transfer import remains a separate explicit job with its existing cursor.

Current ownership and discovery are separate. Transfers out remove a Squig from current collection; transfers between the same collector's wallets keep one card. Discovery survives both sale and revocation. Historical imports attribute sender/recipient inside proved verification/revocation intervals, and correct discovery to the earliest provable event. A current ownerOf observation is not treated as an acquisition date. Earlier transfer backfill can supply the actual acquisition date for recent-acquisition sorting.

Pre-verification wallet history is deliberately not automatically claimed: wallet control may change. Existing UglyBot links remain evidence requiring reconciliation, not login credentials. This is a known boundary on completeness of historical discovery until reviewed evidence establishes earlier attribution intervals.

## Privacy and authentication

Profiles, wallet addresses and Discord names are private by default. Explicit allowlisted projections prevent raw Collector/session/nonce/reconciliation metadata from reaching public pages or browser components. Public Squig ownership links check collector visibility and wallet status; raw addresses also require opt-in. Blockchain passport metadata is not serialized. Authenticated settings validate session, origin, field lengths, slug rules, uniqueness and ownership of featured tokens.

Multiwallet SIWE authentication and Discord OAuth/PKCE remain the Phase 0 implementations. Primary wallet changes use transaction locks and the existing partial unique index. Revoking a manual wallet preserves historical rows, requires a remaining credential, invalidates all sessions/challenges, and forces sign-in with a remaining method. Revoked/conflicting identities cannot silently merge. Browser wallet support currently requires an injected Ethereum EOA provider; contract wallets and mobile wallet deep-link transport are not implemented.

## Images

Live public Ethereum `eth_call tokenURI(1)` on contract `0x8c9a02c0585200c4c65608df6b8def543d33792a` returned `ipfs://QmPmicAfPKQzmortxrfZEpDSN6s6aNSBpf1VbmKbzNs8FU/1`. Retrieved metadata for **#1, #3157 and #4444** consistently identifies artwork as `ipfs://QmTVMmCGAYyRZ7QhdR6khzv4yvJwoVvtuc2Uq5eRuUVoFQ/{tokenId}`. The #1 image downloaded as image/png, 254,318 bytes. The immutable directory pattern is used for the imported catalog; all 4,444 images were not downloaded during development.

`domain/assets.ts` centralizes safe URI resolution. `sync:squigs` fills missing image references while preserving existing imported references. Pinata's public IPFS gateway was reachable; ipfs.io/dweb returned migration/rate-limit responses, so they are not the default. Next Image optimizes/cache-delivers artwork from the allowlisted gateway; arbitrary HTTPS avatar/override URLs are loaded directly in the browser with explicit failure states, avoiding server-side arbitrary URL fetching. Original artwork/metadata is unchanged. Public gateway availability still needs operational monitoring; pin the immutable directory with a controlled delivery service if needed. No temporary marketplace URLs or paid NFT API dependency.

The unused Gauntlet `getMonsterImageUrl` helper was inspected and excluded: it refers to a different CID and a 126-image set. UglyPoints, OG, Legendary and Maw Rank remain the pinned UglyBot dataset/ranking outputs, never UI recalculations.

## Validation

Unit coverage includes privacy DTOs, slug rules, field validation, asset resolution, canonical classifications, points/rank, filter parsing/order, pagination bounds, refresh throttle and the existing Phase 0 environment/adapter/identity/event tests. Disposable PostgreSQL tests apply all real migrations and cover aggregation, transfers, immutable discovery, newly linked wallets, case-insensitive uniqueness, featured ownership, revocation/session invalidation, filters, pagination, refresh coalescing and real worker checkpoints/lease recovery with an injected RPC fixture.

Production HTTP/browser tests additionally exercise wallet signing/linking, protected routes and mutations, full rendered-page privacy, public opt-ins, profile form saving, image delivery, persisted display mode, responsive collection/Squig pages and integration diagnostics. Tests only create owned loopback databases with random credentials; configured external/Discord/RPC credentials are blanked in test child processes. The loopback browser harness forwards its own API requests with the configured HTTPS origin; separate HTTP tests enforce rejection of foreign origins. PostgreSQL 18 test clusters use synchronous I/O to avoid orphaned Windows I/O workers.

Completed validation: **88 unit tests**, **115 database/production-HTTP/browser assertions** with `--web --browser --catalog`, all 4,444 catalog records imported and 4,444 skipped on replay. Lint, TypeScript, formatting and the production Next build pass. Ignored desktop/mobile verification screenshots are saved under `.data/`. No production fixture statistics are shipped.

## Deployment and outstanding production validation

No new mandatory secret variables. Web requires its own `DATABASE_URL`, canonical HTTPS `PUBLIC_BASE_URL`, `AUTH_SECRET` for login, and `ETH_RPC_URL` for refresh requests. Apply migrations, run `sync:squigs`, then the initial `sync:ownership`. Add a worker service using `railway.worker.toml` and `npm run worker:ownership`, sharing only the UglyDex DB and appropriate RPC/config variables. Deploy web migrations before starting the new worker. The worker has no HTTP health check. Transfer backfill requires an independently verified `SQUIGS_START_BLOCK` and an RPC supporting the requested history.

No production database credentials or configured private RPC/Discord credentials were available. UglyBot, Gauntlet, Survival, image, submissions, points/prizes/claims and wallet-links production schema validation/pilot backfills still await dedicated read-only credentials. The only live ecosystem validation performed was public Ethereum/IPFS metadata/artwork reading. No deployment or production ownership backfill was performed.

Remaining operational work: configure and smoke-test Railway auth callbacks and the ownership worker with real RPC limits; inspect production sources safely; measure actual collection latency; monitor gateway availability and worker failures. Complete old wallet attribution and exceptional identity merges through review. No XP economy, achievements, quests, financial valuations or other excluded product scope was implemented.

## Recommended Phase 2

Finish the verified deployment-block-to-finalized Transfer backfill and expose explicit coverage bounds. Add provable mint/acquisition/loss dates, complete paginated NFT passports, transfer counts with completeness semantics, reviewed historical wallet attribution/duplicate-collector reconciliation, and a tested finalized-reorg recovery procedure. Expand discovery only when evidence supports it. Keep ecosystem game/reward timelines and progression in later phases.
