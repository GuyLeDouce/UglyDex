# UglyDex

The identity layer for the Ugly ecosystem. UglyDex unifies collector identity, Squig metadata, ownership observations and historical events above UglyBot, The Gauntlet and ImageSubmit. Those systems remain authoritative. UglyDex never migrates or writes to their databases.

Phase 2 adds a canonical Transfer ledger, resumable finalized-chain indexing, reorg recovery, wallet/collector holding periods, audited historical identity review, provenance verification and paginated Squig Passports. It builds on the Phase 1 collection/profile experience. XP, achievements, sets and quests remain foundations only. See the [Phase 2 report](docs/phase2-report.md), [provenance guide](docs/provenance.md) and [Railway operations](docs/railway.md).

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

Public routes: `/`, `/connect`, `/squigs`, `/collector/[slug]`, `/squig/[tokenId]`. Private routes: `/me`, `/collection`, `/collection/discovered`, `/settings/profile`, `/settings/wallets`. `/api/health` checks readiness. `/admin/integrations` exists only in development. Production diagnostics use `/api/admin/integrations` with `Authorization: Bearer <ADMIN_DIAGNOSTICS_TOKEN>`; never put that token in a URL or browser bundle.

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

1. Create a Railway project with **new PostgreSQL dedicated to UglyDex** and a GitHub web service for this repository. Do not link UglyBot's writable database.
2. Set the web service `DATABASE_URL` from the new Postgres service reference. Add its canonical HTTPS `PUBLIC_BASE_URL`, `AUTH_SECRET`, and optional Discord credentials/callback. Railway supplies `PORT`.
3. Use the committed Dockerfile and `railway.toml`: build generates Prisma and runs `next build`; pre-deploy runs `npm run db:migrate`; start runs `npm start`; readiness is `/api/health`.
4. Run `npm run sync:squigs` once in the service environment. Supply independently provisioned SELECT-only legacy roles and run `integrations:inspect` before importing history.
5. Add an ownership worker service from the same repo/artifact with `npm run worker:ownership`, the same UglyDex `DATABASE_URL`, `PUBLIC_BASE_URL`, and `ETH_RPC_URL`. Use `railway.worker.toml` as its config path; it has no HTTP health check. Run `npm run sync:ownership` for the initial scan. Schedule `npm run sync:transfers` separately after verifying the contract deployment block. Ownership leases handle competing workers and interruptions; Transfer cursor guards reject competing commits. Pages never initiate chain scans.
6. Enable database backups and verify a restore before making profiles public. Set `ADMIN_DIAGNOSTICS_TOKEN` only for administrative API access.

The image includes dev dependencies because migrations and CLI workers share the Phase 0 artifact. A later split can slim the web image. Requests use the configured public origin for CSRF/OAuth; untrusted forwarded headers do not determine identity, redirect targets or auth rate-limit keys. Cookies are Secure in production, HttpOnly and SameSite=Lax. External outages do not fail readiness; loss of UglyDex PostgreSQL returns 503. Startup clearly fails if its DB URL is missing. Builds require no production DB or secrets. No deployment has been made by this phase.

## Phase 3 — ecosystem history

UglyDex now connects the existing collector/Squig views to source-backed historical activity. `/me/activity`, `/collector/[slug]/activity`, private/public creations, ecosystem Passport entries, and protected `/admin/activity` use the same normalized ledger. Coverage is explicitly tracked; totals are not represented as lifetime activity or a CHARM balance.

Apply the new native migration with `npm run db:migrate`. Then configure dedicated read-only legacy variables, run `npm run integrations:validate`, and pilot `npm run sync:activity -- --pages 2`. Existing `sync:uglybot`, `sync:gauntlet`, `sync:images`, and `sync:all` remain available. The resumable ecosystem worker is `npm run worker:ecosystem` using `railway.ecosystem.toml`; it does not replace the blockchain worker. Targeted identity repair uses `npm run activity:reattribute -- --wallet <lowercase-address>` (also `--discord` / `--collector`).

See [activity model](docs/activity-model.md), [Railway](docs/railway.md), and [Phase 3 report](docs/phase3-report.md). Production legacy credentials were unavailable during development; imported test records are disposable fixtures, never deployed statistics.

## Phase 4 progression

Evidence-backed Collector/Squig XP, levels, 65 achievements, titles, featured badges, correction-safe replay and a dedicated progression worker are implemented. See [progression rules and operations](docs/progression.md) and [Phase 4 report](docs/phase4-report.md). Apply migrations, run `npm run progression:seed`, then `npm run progression:rebuild`; keep `npm run worker:progression` running alongside the existing sync workers. No external credentials or financial rewards are involved in progression evaluation.
