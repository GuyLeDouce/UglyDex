# Read-only source bridges

The bridge replaces cross-project PostgreSQL transport. Registry projections,
normalizers, source IDs, keyset cursors and reconciliation lookbacks are unchanged.
It does not import source rows itself and has no UglyDex database connection.

## Deployment boundaries

| Bridge group | Upstream Railway project/environment | Logical connections                                |
| ------------ | ------------------------------------ | -------------------------------------------------- |
| uglybot      | Ugly Bot / production                | links, uglybot, prizes, claims, points             |
| gauntlet     | The Gauntlet / production            | gauntlet, survival                                 |
| image        | The Gauntlet / production            | images, submissions (one shared physical database) |

Deploy each instance in the same environment as its source databases. Staging
clients use explicitly named staging bridge instances; a future production client
must receive separate instances and independently generated secrets. Never reuse a
staging secret for production. Do not change source application accounts.

Required server variables: `BRIDGE_GROUP`, `BRIDGE_SECRET` (32 random bytes encoded
as hex), `PORT`, and only that group's registry database URL variables. URLs must
use `uglydex_reader` and `.railway.internal`. Startup rejects a `DATABASE_URL` or
public source hostname. Each source reader is checked through PostgreSQL privilege
catalogs before feed reads. Grant scripts and exact tables are documented in
[the source mapping](operator/phase11-reader-review/README.md).

UglyDex client variables: `UGLYBOT_BRIDGE_URL`/`UGLYBOT_BRIDGE_SECRET`,
`GAUNTLET_BRIDGE_URL`/`GAUNTLET_BRIDGE_SECRET`, and
`IMAGE_BRIDGE_URL`/`IMAGE_BRIDGE_SECRET`. URLs must be HTTPS origins without paths,
credentials or queries. A configured bridge takes precedence over direct database
URLs. Half-configured or failed bridges fail closed; there is no fallback to a
public PostgreSQL connection. Keep direct URLs for operator inspection with normal
certificate and hostname verification.

## Transport and authentication

Public requests use normally verified HTTPS through Railway web networking. The
bridge rejects feed requests lacking Railway's HTTPS forwarding marker. PostgreSQL
uses Railway's authenticated, encrypted WireGuard private network; PostgreSQL TLS
is not layered inside that tunnel. This is an explicit private-network transport,
not a certificate-verification exception. Never expose this listener through a
public TCP database route. Railway describes its isolation and encryption in
[private networking](https://docs.railway.com/networking/private-networking/how-it-works).

HMAC-SHA256 binds protocol version, method, path, timestamp, nonce and body hash.
Signatures use constant-time comparison, 60-second clock skew, and random 24-byte
nonces. A bounded in-memory replay cache rejects repeated nonces and fails closed
at capacity. Run **one replica**. A restart clears this cache; a previously captured
request could be replayed within the remaining skew window after restart. HTTPS,
short validity and read-only endpoints limit that exposure; multiple replicas
would require shared replay storage before enabling them.

Limits per instance: 120 non-health requests/minute, four concurrent authenticated
requests, 16 KiB request bodies, 2 MB responses, 500 rows/page, 10-second client
timeout, 12-second server socket timeout, five-second SQL statement timeout, two
connections per logical source. Inspection is sequential to stay below the bridge
concurrency limit. HTTP errors contain fixed codes, never upstream messages or rows.

## Fixed API

`GET /healthz` is public and returns only `{ "ok": true }`; it is process liveness,
not proof of database health. All `/v1/` endpoints require HMAC authentication:

- `GET /v1/status/:integration`: registry-only schema inspection.
- `GET /v1/permissions/:integration`: effective read-only privilege evidence.
- `GET /v1/feeds/:feed/columns` and `/stats`: declared columns and aggregate counts/dates.
- `POST /v1/feeds/:feed/page`: bounded keyset page, optional date/lookback and fixed scopes.
- `POST /v1/lookups/:lookup`: fixed, typed application lookup with parameterized values.

Feed/integration/lookup names must exist in the compiled registry and belong to
the bridge group. There is no SQL, table or column input. Unknown JSON properties
and query parameters are rejected. Existing timestamp cursor precision is retained.
Updated-time pagination remains a composite key; corrections update the canonical
source event rather than create a second event.

`onlineRewards` reports `FEED_UNAVAILABLE` while its source table is absent.
`gauntlet_runs` remains usable. Never create or backfill a fabricated rewards table.
`integrations:validate` and `launch:sources` inspect bridge schema and permissions;
successful connectivity does not prove pilot quality or historical completeness.

## Build and rollout

Build with `Dockerfile.bridge`. Its runtime copies integrations and the safe logger,
not the application, Prisma database or web workers. `npm run bridge:start` is the
standalone start command. `railway.bridge.toml` documents equivalent service values
for existing config-file deployments; Railway currently rejects new config-file
path overrides. For new services, upload a dedicated bridge bundle containing
`package.json`, `package-lock.json`, `tsconfig.json`, `src/integrations/`,
`src/server/log.ts`, `scripts/source-bridge.ts`, and `Dockerfile.bridge` renamed to
`Dockerfile`. No web `railway.toml`, migration command, `.env` or `.data` is included.
Configure Dockerfile build, empty pre-deploy commands, the standalone start command,
one replica, `/healthz` health check, and three maximum restart attempts.

After deployment, validate authenticated schema/permissions from staging, test
invalid and replayed signatures, then run `integrations:validate` and
`launch:sources`. Run source pilots only in a separately authorized next step.
For rollback, disable bridge client variables together and keep unavailable direct
TLS connections fail-closed; never weaken certificate verification.
