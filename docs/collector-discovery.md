# Automatic collector discovery and unified identity (Issue #32)

## Identity boundary

`DiscoveredWallet` is a unique Ethereum address → Collector UUID mapping. It is
public ownership evidence, never a credential. Finalized ownerOf observations
and canonical provenance projection create mappings in the existing ownership
transaction. Zero addresses are excluded. Repeated indexing shares the SIWE
address advisory lock and does not duplicate profiles. Existing claimed profile
privacy is preserved. Revoked credentials are conflicts, never reactivated.

New holder shells are public and show their blockchain address. They contain no
Discord association, fabricated signature, session, verification timestamp or
historical personal attribution. The directory includes these records without
waiting for progression. Holdings read the canonical current ownership index;
reorg corrections change holdings, not the permanent identity record. Clean,
complete wallet periods appear separately as blockchain history, with explicit
wording that the current owner may not have controlled the wallet historically.

SIWE still accepts only the exact server-generated, expiring, browser-bound
challenge and a valid signature. Claiming reuses a shell UUID; historical personal
attribution starts at the actual proof time. An already signed-in collector can
adopt an empty discovered shell after proving that wallet. No claimed identity,
imported activity, or external identity can be silently absorbed by that path.
Claimed conflicts retain the existing dual-proof explicit merge workflow.
Merges move discovery mappings, clear conflicting primary flags, preserve source
records and queue existing progression/collection engines. Original source keys
are unchanged. The absorbed identity remains a non-public tombstone. As before, explicit merges
reset publication preferences to private; the owner reviews and re-enables them
afterward to avoid disclosing newly combined identities without consent.

A chosen unique slug is the username. Generated `holder-<uuid>` and
`collector-<uuid>` routes are not chosen usernames. A second active wallet or
username display requires a chosen username. Single-wallet owners can leave it
blank in settings. Primary-address display is the default for new records;
username/display-name publication requires the explicit setting. Existing name
publication is preserved by migration. Existing hidden wallet relationships stay
hidden: public blockchain addresses remain inspectable on Squig records even
when the collector has not consented to linking those addresses to their identity.

## Source integration and privacy

UglyBot/Gauntlet adapters and their read-only databases are unchanged. Their
stable Discord IDs reserve historical identities; OAuth proves the external
account independently of UglyBot. If that history already belongs to a separate
collector, the existing explicit merge moves events with correction audits and
rebuild jobs. Replays/corrections/retractions continue through existing source
ledgers. A name match never links identities. No rewards are issued by discovery.

DRIP retains the existing server-verified account linking flow. Settings exposes
connection state and its existing form. Missing provider credential access or
ownership evidence is a hard failure, not an invented verification. Actual DRIP
capabilities, source credentials and live OAuth require staging validation.

Public DTOs are explicit allowlists. Discord/DRIP IDs, provider tokens, metadata,
proof records and operational audit detail are never included. `showDiscord`
continues to mean consenting to authenticated Discord names/activity, not IDs.
`showWallets` continues to protect previously hidden collector/address links.
Discovery itself never reads private bot mappings.

## Migration and controlled backfill

1. Review the additive migration `202610240001_collector_discovery` and the
   migration-byte manifest. Take the normal deployment-bound backup.
2. Apply via the existing `npm run db:migrate` process on an explicitly approved
   non-production environment. Deploy web and ownership workers together after
   migration readiness passes. No production migration was run for this change.
3. Preview one bounded batch: `npm run collectors:discover` (dry-run default).
4. On an approved non-production database, use the existing deployment binding
   and operational intent gates. Staging requires
   `OPS_CONFIRM=staging:collector-discovery` and the reviewed
   `OPS_DATABASE_FINGERPRINT`. Then run: `npm run collectors:discover -- --apply`.
5. Pass the returned cursor to the next invocation:
   `npm run collectors:discover -- --apply --after=0x...`.
   Repeat until `complete=true`. Output contains scanned/created/existing/conflict
   counts. An interrupted invocation can replay its prior cursor safely.
6. Repeat a dry run from the beginning to reconcile earlier addresses. Newly
   indexed holders are discovered automatically by normal ownership workers.

The CLI refuses `--apply` when APP_ENV=production or the database is registered
as production, and validates the existing operational intent/deployment binding. A production run needs a
separately reviewed operational change after explicit approval; do not bypass
this guard by changing APP_ENV. No new API keys or credentials are introduced.

## Rollback and recovery

Stop the affected worker/deployment and prepare a compatibility rollback build:
restore the prior feature behavior while retaining the additive schema, migration
files and checksum manifest. An unchanged old binary fails the existing readiness
gate on an unknown applied migration; do not delete migration bookkeeping to
bypass it. Leave the additive table/columns in place. Do not delete discovery mappings,
ownership evidence, or successfully claimed identities. Existing authentication
still uses CollectorWallet, so the discovery table never grants access to an old
version. A pre-change binary will not implement claim reuse; keep claiming and
indexing paused during rollback to prevent parallel identities. Recovery resumes
the last reviewed backfill cursor; a full repeat is idempotent. Account merges
remain irreversible in the UI and retain the existing backup/audit requirements.

## Validation

New unit tests cover public name choice, primary wallet, optional username,
private-field exclusion and hidden cross-wallet mappings. New disposable database
and real HTTP tests cover canonical discovery, concurrent discovery, dry runs,
transfers/zero holdings, retention, shell adoption, claim signature rejection,
concurrent challenge consumption, UUID preservation, multi-wallet username rules
and HTML privacy. Existing suites retain SIWE/OAuth, merge, provider verification,
source correction and historical-attribution coverage.

Local typecheck, lint and production build passed during implementation. Full
validation results and environment blockers are recorded in the pull request.
Staging and production were not modified.
