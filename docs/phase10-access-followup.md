# Phase 10 access follow-up

The app is reachable. Completing the historical imports requires safer database logins and a working archive provider. Nothing here requires sharing a password, wallet address, private key or token in chat.

## What “read-only credentials” means

A database login is an account with permissions. The current wallet-links and four UglyBot logins can change or administer their databases. UglyDex only needs to **read** their history. Its probes already use read-only transactions, but a separate account with SELECT-only permissions also prevents an accidental write by the account itself.

Keep the bots' current logins unchanged. Give UglyDex a separate login. Do not revoke permissions from the accounts the bots use.

1. In Railway, identify the source PostgreSQL service for each connection below. Open the database's supported SQL connection/admin tool using its owner account.
2. Have the database owner create a dedicated `uglydex_reader` login with a generated password, no superuser/create-database/create-role privileges, CONNECT on the required database, USAGE on the required schema, and SELECT on the exact integration tables listed in `src/integrations/registry.ts`. Grant no write permissions or membership in a privileged role. Review inherited/public privileges and executable SECURITY DEFINER routines too.
3. Arrange SELECT access to future required tables with the source owner; default privileges must be set for the role that actually creates those tables. Setting `default_transaction_read_only` is useful defense in depth but is not a substitute for these grants.
4. In **UglyDex → Variables**, replace only the relevant source URL with a connection using that new reader account. Keep it in Railway, not Git or chat. Do the equivalent for staging using a network address that staging can actually resolve.
5. Rerun `launch:sources`. Once schema and privileges validate, run a bounded pilot, review normalized records, and only then perform a full import.

Creating roles is a write to a source system. Phase 10 explicitly prohibited source writes, so the execution did not create accounts or change grants. This is the remaining database-owner step; the intended grants above are a review checklist, not SQL to paste blindly across unrelated databases.

| UglyDex variable                 | Observed issue / next action                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `WALLET_LINKS_DATABASE_URL`      | Connects; replace write/admin login with dedicated reader                             |
| `UGLYBOT_DATABASE_URL`           | Connects; dedicated reader needed                                                     |
| `UGLYBOT_PRIZES_DATABASE_URL`    | Connects; dedicated reader needed                                                     |
| `UGLYBOT_CLAIMS_DATABASE_URL`    | Connects; dedicated reader needed                                                     |
| `UGLYBOT_POINTS_DATABASE_URL`    | Connects; dedicated reader needed                                                     |
| `GAUNTLET_DATABASE_URL`          | Password rejected (`28P01`); verify the correct database and reader login             |
| `GAUNTLET_SURVIVAL_DATABASE_URL` | Host does not resolve from production; correct hostname/network routing               |
| `GAUNTLET_IMAGE_DATABASE_URL`    | Not configured; identify the actual image source before supplying a reader connection |
| `IMAGE_SUBMIT_DATABASE_URL`      | Host does not resolve from production; correct hostname/network routing               |

Railway private hostnames are environment-scoped. Copying a production private URL into staging is not proof that staging can reach it. Use an explicitly approved route and reader login; do not expose a database publicly merely to make a probe pass.

## Ethereum RPC

In the provider dashboard for the existing `ETH_RPC_URL`, inspect HTTP 429 responses, throughput/credit limits and other applications sharing that key. Mainnet/archive reads and a 10,000-block query succeeded, but later historical block calls failed even with one request per second. A smaller 1,000-block log query succeeded. This does not establish whether the limit is shared traffic, a provider plan limit or another provider restriction.

Supply a suitable archive endpoint or resolve its quota/throughput restriction, then resume staging from the stored cursor **25,352,920**. Do not reset the ledger. Start with a bounded batch and confirm progress before enabling a continuous worker. OpenSea metadata cannot replace this provenance evidence.

## Discord callbacks

Use the existing Discord application as requested. In the Discord Developer Portal, select that application, open OAuth2 settings, and add/save both exact redirect URLs:

- `https://uglydex-production.up.railway.app/api/auth/discord/callback`
- `https://uglydex-staging-staging.up.railway.app/api/auth/discord/callback`

These full paths are already configured on the corresponding Railway web services. The site's `/` homepage is not the OAuth callback. A staging redirect with state and S256 PKCE was observed; completing consent and returning to the app still needs a real user test.

## Devices and official collectibles

Record the actual device/OS, browser version and wallet provider while testing connect, signature approval/rejection, account change, multiple-wallet linking, unlink, session persistence, Discord login/logout, collection/gallery and native PNG sharing. Tell the operator which actions actually passed; a connected-wallet row alone does not certify the matrix.

The owner supplied the Customs contract `0x64abc24b4e26b89ec4ed03563fafa82dd5f61576`, its OpenSea collection, and `https://squigs.io/`. Contract verification hit HTTP 429. A reviewed token/artwork manifest with hashes is still required before importing Customs. No Edition manifest or contracts were supplied. Neither catalog belongs in Reloaded's 4,444 completion denominator.
