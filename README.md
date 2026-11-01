# UglyDex

**Every Squig has a story.**

UglyDex is the collector identity, Field Guide, and historical record for the Squigs ecosystem, built by **Ugly Labs**. Explore the collection, follow each Squig’s journey, and bring your verified holdings and community participation together in one collector profile.

[Explore UglyDex](https://uglydex-production.up.railway.app) · [Documentation](#documentation) · [Development](#local-development) · [Privacy](PRIVACY.md) · [Terms](TERMS.md)

## Discover the collection

The canonical Squigs Reloaded collection contains **4,444 token IDs**. UglyDex connects their artwork and traits with ownership records and supported ecosystem activity, preserving their history as they move between collectors.

| Experience                | What you can explore                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| **Field Guide**           | Current holdings, unique discoveries, trait discovery, and current and historical set completion.   |
| **Squig Passports**       | Individual artwork, traits, ownership history, transfers, and recorded ecosystem milestones.        |
| **Collector profiles**    | Verified wallets, collection progress, achievements, and up to six currently owned favorite Squigs. |
| **Collector Thread**      | Recorded activity across the ecosystem, with individual collector activity feeds.                   |
| **Progression**           | Evidence-backed collector and Squig achievements, levels, titles, and badges.                       |
| **Galleries and sharing** | Curated showcases and downloadable share cards, subject to profile and sharing preferences.         |
| **Customs and Editions**  | Separately tracked collectible records supported by reviewed evidence.                              |

Feature data depends on source coverage, verification, and synchronization. A historical record is not a promise of complete lifetime coverage, and an implemented feature does not by itself establish production readiness.

## Owned and Discovered

These numbers tell different parts of a collector’s story:

- **Owned** describes current holdings at the indexed blockchain snapshot.
- **Discovered** is the unique union of current holdings across active verified wallets and already attributed, non-retracted historical discoveries. Each token counts once.
- **Current sets** measure what a collector holds now. **Historical sets** measure eligible discoveries retained in their Field Guide.

For a verified collector at the same canonical snapshot, Discovered includes Owned. Linking a wallet does **not** automatically turn its entire pre-verification history into that collector’s personal history. Public ownership observations and verified personal attribution remain separate.

The [Field Guide rules](docs/field-guide-v3.md) explain these boundaries in detail. Burned tokens remain part of the canonical record; their history is preserved without changing their on-chain state.

## Identity and privacy

UglyDex supports Discord authentication and Ethereum wallet verification. Wallet verification uses a sign-in message; the connection flow does not request a transaction or token approval.

A wallet holding a Squig may have an automatically discovered public profile labeled **Unverified Squig Holder**. That profile records public ownership observations—it is not an authenticated account. Claiming it requires proof of wallet control, and multiple verified wallets can belong to one collector.

Profile publication and sharing follow the collector’s visibility settings. Private Discord and DRIP identifiers, wallet-link evidence, and internal reconciliation records are excluded from public views. Account merges require the existing verification and consent process.

Read the [identity model](docs/identity.md), [holder discovery rules](docs/collector-discovery.md), [Privacy Policy](PRIVACY.md), and [Terms of Service](TERMS.md).

## Built around verifiable history

Ethereum provides the canonical ownership and transfer evidence. UglyBot, The Gauntlet, and ImageSubmit remain authoritative for their own ecosystem records. UglyDex reads supported sources, normalizes their evidence, and builds its own collector and Passport views.

- **Read-only integrations:** external databases are never migrated or written to by UglyDex.
- **Separate storage:** application records and projections live in a dedicated UglyDex PostgreSQL database.
- **Traceable attribution:** uncertain observations are not silently promoted into verified personal history.
- **Resumable processing:** background jobs use persisted checkpoints and idempotent processing.
- **Correction-aware history:** reconciliation and retractions remain explicit rather than silently replacing source evidence.

Public browsing reads UglyDex’s own data rather than querying every upstream service on each request. Updates depend on blockchain finality and worker progress; they are not instantaneous.

## Technology

UglyDex uses **Next.js 16**, **React 19**, **TypeScript**, **Prisma**, **PostgreSQL**, and **viem**. The existing application is a modular monolith with separate background workers for blockchain indexing, ecosystem activity, collections, and progression. Railway hosts the deployment infrastructure.

See the [architecture guide](docs/architecture.md) for service boundaries and data flow.

## Local development

Use Node.js **24** (supported range: **22.12–24**), npm, and a dedicated local PostgreSQL **16+** database.

```sh
git clone https://github.com/GuyLeDouce/UglyDex.git
cd UglyDex
npm ci
cp .env.example .env
```

Configure `.env` before continuing:

- Point `DATABASE_URL` at a **new, isolated local UglyDex database**.
- Set `AUTH_SECRET` to a random secret of at least 32 characters.
- Review `.env.example` for authentication and optional integration settings. Keep production and ecosystem database credentials out of local setup.

```sh
npm run db:generate
npm run db:migrate
npm run sync:squigs
npm run dev
```

Open `http://localhost:3000`. On PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

`sync:squigs` imports the checked-in canonical metadata dataset. External activity and current blockchain ownership require separately configured sources and indexing; local catalog setup does not populate those records. Metadata provenance and scoring are preserved rather than independently recalculated.

Discord authentication requires its client credentials and an exactly matching callback at `${PUBLIC_BASE_URL}/api/auth/discord/callback`. Wallet verification currently supports Ethereum externally owned accounts; smart-contract wallet verification is not implemented. See [.env.example](.env.example) and the [integration guide](docs/integrations.md) for configuration.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
npm run test:db
npm run test:identity
npm run release:check
```

Database tests provision an isolated disposable loopback PostgreSQL cluster. Run them as a non-root user; PostgreSQL refuses to initialize as root. They do not target production or accept an external database URL. Additional HTTP, browser, and catalog checks are available through `test:db`; see the [production readiness guide](docs/production-readiness.md).

Code checks and deployment evidence are distinct: `release:check` validates code readiness, while `launch:check` evaluates the configured deployment’s evidence gates.

## Deployment and operations

Start with the [production readiness guide](docs/production-readiness.md), [rollout procedure](docs/production-rollout.md), and [Railway guide](docs/railway.md).

Use a dedicated UglyDex database, verified backups, the canonical HTTPS origin, and least-privilege read-only credentials for external sources. Web and worker releases must remain compatible. Worker activation is explicit and environment-bound; configuring a source URL alone does not enable processing.

`/api/health` checks connectivity; `/api/ready` additionally checks migration readiness. Follow the operational guides for source validation, bounded backfills, worker controls, and monitoring. Review the deployed service settings as well as repository configuration before making changes.

## Documentation

| Topic                         | Guides                                                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture and integrations | [Architecture](docs/architecture.md), [Integrations](docs/integrations.md), [Source inventory](docs/external-schema-inventory.md)                                    |
| Identity and attribution      | [Identity](docs/identity.md), [Holder discovery](docs/collector-discovery.md), [Reconciliation](docs/data-reconciliation.md)                                         |
| Collection experience         | [Field Guide V3](docs/field-guide-v3.md), [Collections](docs/collections.md), [Collectibles](docs/collectibles.md)                                                   |
| Activity and progression      | [Activity model](docs/activity-model.md), [Progression](docs/progression.md), [Sharing](docs/sharing.md)                                                             |
| Operations                    | [Production readiness](docs/production-readiness.md), [Launch readiness](docs/launch-readiness.md), [Reliability](docs/reliability.md), [Rollback](docs/rollback.md) |
| Review and planning           | [October 31 technical audit](docs/technical-audit-20261031.md), [Roadmap](docs/roadmap.md)                                                                           |

Dated audits and phase reports describe their respective checkpoints, not a live deployment status. Where older phase notes differ, use the current implementation and the superseding identity and Field Guide documentation.

## Feedback

Report reproducible bugs or suggest improvements through [GitHub Issues](https://github.com/GuyLeDouce/UglyDex/issues). Include the affected page, expected behavior, and relevant browser or app version. Remove private account details and credentials from screenshots and logs before posting publicly.

Built by **Ugly Labs** for the Squigs community.
