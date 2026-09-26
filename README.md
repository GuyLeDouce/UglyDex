# UglyDex

Phase 9 adds [launch evidence gates](docs/launch-readiness.md), [replay proof](docs/replay-validation.md) and [reconciliation reporting](docs/data-reconciliation.md). Use `npm run release:check` for code readiness and `npm run launch:check` for the actual deployment. The latter intentionally fails until critical external evidence exists. See [Phase 9 report](docs/phase9-report.md).

## Phase 8 operations

Follow [production rollout](docs/production-rollout.md), [rollback](docs/rollback.md), [reliability](docs/reliability.md) and [device validation](docs/device-validation.md). Phase 7 is checkpointed at `2c6eda2`. Phase 8 adds environment-bound operational intent, staging/smoke/restore tools, pilot/stage gates, Edition history indexing and reliability diagnostics. See [Phase 8 report](docs/phase8-report.md) for measured local results and explicitly pending external gates. Run `npm run release:check` before release; never treat fixtures as production evidence.

The identity layer for the Ugly ecosystem. UglyDex unifies collector identity, Squig metadata, ownership observations and historical events above UglyBot, The Gauntlet and ImageSubmit. Those systems remain authoritative. UglyDex never migrates or writes to their databases.

Phases 0–7 provide canonical ownership/provenance, tracked history, progression, a Trait Dex and sets, opt-in galleries/share cards, verified Customs/Editions and free personalization. Phase 7 adds safe worker onboarding, preflight, resumable backfill and verification. Start with the [Phase 7 report](docs/phase7-report.md), [production deployment order](docs/production-readiness.md), [collectibles guide](docs/collectibles.md), [privacy policy](docs/privacy.md) and [Railway operations](docs/railway.md). Quests, seasons, leaderboards and paid features remain deferred.

New routes: `/editions`, `/editions/[slug]`, `/collection/editions`, `/settings/appearance`, `/admin/production`, `/admin/collectibles`, `/admin/customs` and `/admin/editions`. `/api/health` checks connectivity; `/api/ready` also checks migration readiness and is the Railway rollout gate. All workers now start **disabled**, even with configured RPC/source URLs. Enable them explicitly after following the production guide. No official Customs or Editions are seeded without reviewed evidence.

Operational commands: `production:preflight`, `production:backfill` (plan only unless `--execute`), `production:verify`, `production:worker`, `customs:import`, `editions:import`, `collectibles:verify` and `collectibles:export`. See the linked guides for exact flags and ordering.

## Local development

Use Node 24 LTS (supported: 22.12–24), npm and a dedicated PostgreSQL 16+ database.

```sh
npm ci
cp .env.example .env
# Set DATABASE_URL to a new UglyDex database; set AUTH_SECRET for login.
npm run db:generate
npm run db:migrate
npm run sync:squigs
npm run dev
```

PowerShell: `Copy-Item .env.example .env`. Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Never reuse external service secrets. No real `.env` is committed. Page data comes only from UglyDex; artwork is delivered from immutable IPFS references. Legacy service outages do not block collection browsing. New collector profiles are private by default.

Public routes include `/`, `/connect`, `/squigs`, `/collector/[slug]`, `/collector/[slug]/collection`, `/collector/[slug]/gallery/[gallerySlug]`, `/squig/[tokenId]` and `/share`. Profile and gallery visibility is enforced on every public request. Private routes include `/me`, `/collection`, `/settings/profile`, `/settings/wallets`, `/settings/galleries` and `/settings/sharing`. `/api/health` checks connectivity; `/api/ready` checks migration readiness. Production admin pages, including `/admin/sharing`, require an authenticated configured Discord administrator. Read-only API diagnostics use `Authorization: Bearer <ADMIN_DIAGNOSTICS_TOKEN>`; never put that token in a URL or browser bundle.

## Architecture and database

Server components → profile services → UglyDex PostgreSQL. CLI jobs → isolated external SELECT adapters → validated normalized activities → collector/passport projections. See [architecture](docs/architecture.md), [source schema inventory](docs/external-schema-inventory.md), [integrations](docs/integrations.md), [identity rules](docs/identity.md), and [roadmap](docs/roadmap.md).

Prisma's only datasource is UglyDex `DATABASE_URL`. Models include Collector, ExternalIdentity, CollectorWallet, WalletLinkEvidence, IdentityReconciliation, Squig, SquigTrait, SquigOwnership, SquigDiscovery, CollectorActivity, SquigPassportEvent, CollectorProgress, SquigProgress, achievements, sets, quests, SyncRun, ChainCursor, and auth/session/rate-limit records. SQL migrations add normalized-address checks and partial unique indexes for primary wallets/current ownership.

`npm run db:migrate` runs committed migrations after validating database separation. To create a new migration on a disposable development database, use `npx prisma migrate dev --name descriptive_name`; review its SQL before committing. Never run Prisma against an external URL. Database aliases can defeat URL equality checks: independent database/service provisioning and least-privilege roles are the real isolation boundary.

## Configuration

Required for the web service: `DATABASE_URL`, and production `PUBLIC_BASE_URL=https://your-domain`. `PORT` is provided by Railway (local default 3000).

Authentication: `AUTH_SECRET` (random 32+ characters), `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` exactly `${PUBLIC_BASE_URL}/api/auth/discord/callback`. Wallet signing uses Ethereum EOAs in Phase 0; contract-wallet verification is deferred. No transaction is requested. OAuth tokens are used only to fetch Discord identity and are not persisted. No NextAuth dependency or `NEXTAUTH_SECRET` is needed.

Optional read-only databases: `WALLET_LINKS_DATABASE_URL`, `UGLYBOT_DATABASE_URL`, `UGLYBOT_PRIZES_DATABASE_URL`, `UGLYBOT_CLAIMS_DATABASE_URL`, `UGLYBOT_POINTS_DATABASE_URL`, `GAUNTLET_DATABASE_URL`, `GAUNTLET_SURVIVAL_DATABASE_URL`, `GAUNTLET_IMAGE_DATABASE_URL`, `IMAGE_SUBMIT_DATABASE_URL`. Set `ECOSYSTEM_GUILD_ID` for wallet evidence import. Each logical integration has its own pool even when URLs address the same physical DB. Unset sources are reported as unconfigured; no URL fallback points at the writable database.

Chain jobs: `ETH_RPC_URL`, fixed `SQUIGS_CONTRACT_ADDRESS`, independently verified `SQUIGS_START_BLOCK` for transfers, optional `TRANSFER_BLOCK_BATCH`. Images default to the immutable IPFS image directory verified from on-chain tokenURI metadata; `SQUIG_IMAGE_BASE_URL` remains an optional operator override for the dataset's PNG filenames. See [image provenance](docs/phase1-report.md#images). No image API subscription is needed.

See [.env.example](.env.example) for all variables. Previously committed production credentials in other repositories should be rotated by their owners; this phase does not alter those repositories.

## Import and inspection commands

```sh
npm run integrations:inspect
npm run sync:identities
npm run sync:squigs
npm run sync:uglybot
npm run sync:gauntlet
npm run sync:images
npm run sync:all
npm run sync:ownership
npm run sync:transfers
npm run worker:ownership
npm run chain:discover-start
npm run chain:status
npm run provenance:verify
npm run provenance:rebuild -- --token 3157
npm run provenance:rebuild -- --from-block 25342921
```

`sync:all` runs the first five import groups and intentionally excludes potentially expensive chain scans. Imports use bounded keyset pages, transactional projection writes, durable event identities and structured scanned/inserted/updated/skipped/failed counts. Event counts can exceed row counts when a duel produces two participant events. Unconfigured sources are skipped; unavailable/schema-invalid sources and invalid rows set a nonzero exit status. Replays revisit mutable records, including late completions and moderation changes. No routine truncation.

The checked-in 4,444-record dataset is a derived snapshot from the pinned UglyBot revision and its canonical `mawRarity.js`, with hashes and provenance. To update, first inspect a new source revision and review the offline exporter `scripts/export-squigs.mjs`; update its revision constant and run it against that reviewed snapshot. Never run arbitrary upstream application startup code to obtain metadata. UglyDex does not independently recalculate scoring.

## Testing

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:db
# Optional production HTTP and headless-browser checks:
npx playwright install chromium
npm run test:db -- --web --browser
npm run test:db -- --catalog
npm run format:check
```

Database tests create their own disposable loopback PostgreSQL cluster with random credentials under `.data/test-<UUID>`. They do not accept a database URL or read `.env`; inherited external database URLs are cleared. No tests target production. Run as a normal user (PostgreSQL refuses root). The harness validates migrations, replay/concurrency, passport correction, real read-only roles and source schema variation. `--web` additionally exercises the production server, wallet challenges/signatures/replay/linking, privacy and OAuth CSRF rejection. The browser check saves ignored screenshots under `.data`.

## Railway

For first deployment, follow the complete [Phase 7 production order](docs/production-readiness.md). Workers remain disabled until explicit enablement; take backups before the first backfill. The notes below describe the underlying service configuration.

1. Create a dedicated UglyDex PostgreSQL service, enable backups and verify an isolated restore. Never link an ecosystem writable datasource.
2. Configure canonical HTTPS origin, session secret, Discord OAuth/admin allowlist and the UglyDex database. Deploy web first: `railway.toml` migrates before `npm start` and gates readiness on `/api/ready`.
3. Run production preflight, configure/validate RPC and SELECT-only sources, then take a pre-backfill backup. Run the explicit bounded production backfill and consistency verification commands in the production guide.
4. Deploy the four CLI workers from the same release. They start disabled, share only UglyDex's writable database and have no HTTP health check. Enable LIVE individually after onboarding, monitor heartbeats and configure a 90-second deployment drain grace.
5. Complete real-device wallet/OAuth/gallery/share checks before public rollout. `ADMIN_DIAGNOSTICS_TOKEN` remains a separate read-only integration diagnostic credential.

The image includes dev dependencies because migrations and CLI workers share the Phase 0 artifact. A later split can slim the web image. Requests use the configured public origin for CSRF/OAuth; untrusted forwarded headers do not determine identity, redirect targets or auth rate-limit keys. Cookies are Secure in production, HttpOnly and SameSite=Lax. External outages do not fail readiness; loss of UglyDex PostgreSQL returns 503. Startup clearly fails if its DB URL is missing. Builds require no production DB or secrets. No deployment has been made by this phase.

## Phase 3 — ecosystem history

UglyDex now connects the existing collector/Squig views to source-backed historical activity. `/me/activity`, `/collector/[slug]/activity`, private/public creations, ecosystem Passport entries, and protected `/admin/activity` use the same normalized ledger. Coverage is explicitly tracked; totals are not represented as lifetime activity or a CHARM balance.

Apply the new native migration with `npm run db:migrate`. Then configure dedicated read-only legacy variables, run `npm run integrations:validate`, and pilot `npm run sync:activity -- --pages 2`. Existing `sync:uglybot`, `sync:gauntlet`, `sync:images`, and `sync:all` remain available. The resumable ecosystem worker is `npm run worker:ecosystem` using `railway.ecosystem.toml`; it does not replace the blockchain worker. Targeted identity repair uses `npm run activity:reattribute -- --wallet <lowercase-address>` (also `--discord` / `--collector`).

See [activity model](docs/activity-model.md), [Railway](docs/railway.md), and [Phase 3 report](docs/phase3-report.md). Production legacy credentials were unavailable during development; imported test records are disposable fixtures, never deployed statistics.

## Phase 4 progression

Evidence-backed Collector/Squig XP, levels, 65 achievements, titles, featured badges, correction-safe replay and a dedicated progression worker are implemented. See [progression rules and operations](docs/progression.md) and [Phase 4 report](docs/phase4-report.md). Apply migrations, run `npm run progression:seed`, then `npm run progression:rebuild`; keep `npm run worker:progression` running alongside the existing sync workers. No external credentials or financial rewards are involved in progression evaluation.

## Collection Dex (Phase 5)

Versioned trait discovery, 52 curated historical/current sets, explained completion, private/public showcases and personalized explorer hints now build on confirmed local provenance. Start at `/collection/dex`; see [collection operations](docs/collections.md) and [Phase 5 report](docs/phase5-report.md). Deploy the native migration, run `collections:verify`, `collections:seed`, `collections:rebuild`, and start `worker:collections`. No additional secrets or financial rewards.

## Galleries and sharing

Phase 6 adds opt-in galleries, ordered showcases, public collection visibility, earned trophy cards and downloadable social PNGs. Start at `/settings/galleries` or `/settings/sharing`. Public share resources use the same privacy gates as profiles. Apply native migration `202609280008_sharing` with `npm run db:migrate`; no new secrets or worker are needed. See [sharing architecture](docs/sharing.md) and [Phase 6 report](docs/phase6-report.md).
