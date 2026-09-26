# Phase 0 implementation report

Implemented in the UglyDex workspace. No external ecosystem application or production database was changed. Railway deployment and production backfills have not been run.

- Next.js 16.3.6 / React 19.3 / TypeScript / Tailwind modular monolith; own PostgreSQL with Prisma 7.10 (stable release selected instead of the registry's Prisma 8 release candidate).
- UUID collectors, Discord identities, multiple signature-proven wallets, legacy evidence and reconciliation cases. Metadata/traits, ownership observations, persistent discovery, normalized activities/passports, versioned progression/achievement/set/quest foundations and operational/auth records.
- Nine isolated external database connections, read-only transactions, source schema diagnostics, bounded keyset replay, stable event keys, transactionally updated passports and sanitized logs.
- Three ecosystem source repositories inspected at pinned revisions. [Inventory](external-schema-inventory.md) distinguishes both marketplaces, claims, Duels, Bounty, Maw, Mad Libs, Gauntlet, Survival and image moderation/library sources. It identifies absent historical ledgers rather than inventing data.
- Canonical 4,444-Squig snapshot, including 31 legendary Squigs; Maw ranks come from the reviewed UglyBot module. Ethereum ownerOf/multicall and finalized Transfer CLI indexing with an UglyDex cursor and block-hash checks.
- Wallet EOA signing works end to end with one-use SIWE challenges, replay protection, session rotation and multiple-wallet linking. Discord OAuth state/PKCE/callback is implemented; live provider completion awaits credentials. Ambiguous merges and revoked-wallet recovery require review; no automated merges or self-service revoke UI yet.
- Landing, collection entry, collector and Squig profile shells, empty/unavailable states, private profiles, health endpoint and protected diagnostics. No fabricated stats or economic awards.
- Railway Docker configuration, pre-deploy migrations, PORT support and deployment documentation. No production secrets required for builds.

Validation completed:

| Check                                                               | Result                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| ESLint                                                              | Passed, zero warnings                                                                |
| TypeScript + generated Next/Prisma types                            | Passed                                                                               |
| Vitest                                                              | 49 tests passed                                                                      |
| Production build                                                    | Passed                                                                               |
| Disposable PostgreSQL + production HTTP + Chromium + catalog replay | 37 assertions passed                                                                 |
| Prisma migrate deploy                                               | Both migrations applied to a new disposable DB                                       |
| Complete catalog import                                             | 4,444 scanned; 4,442 inserted and 2 updated existing test records; zero failures     |
| Catalog replay                                                      | 4,444 skipped; zero duplicates/failures                                              |
| Desktop/mobile browser                                              | Rendered, wallet-unavailable state works, no JS errors or mobile horizontal overflow |
| Integration inspection without credentials                          | Nine sources report unconfigured; no secret/record output                            |
| Prettier / git whitespace                                           | Passed                                                                               |
| npm audit, including development dependencies                       | Zero known vulnerabilities at validation time                                        |

The tests create their own loopback database and synthetic external fixture. They do not validate production data completeness or Ethereum provider behavior. No live OAuth authorization was performed. CHARM balances, individual Bounty voter history and per-game Squig assignments are not fabricated from incomplete sources. Deep finalized-reorg recovery is an operator review procedure, not automatic rollback.

Recommended next scope: provision and inspect SELECT-only connections; pilot imports with reconciliation review; add profile privacy/slug editing and wallet link/revoke/merge UX; build a paginated collection viewer backed by scheduled finalized ownership observations; configure a verified image origin; schedule import and auth-record housekeeping jobs. Keep XP, economic rewards and broad feature expansion for later phases.
