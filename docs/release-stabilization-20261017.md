# Release stabilization — October 17, 2026

This is a staging release candidate, not production approval. The final revision,
deployment IDs and revision-bound gate results belong in the release PR's current
validation record. Later evidence supersedes the checkpoints below.

## Consolidation and fixes

`release-stabilization-20261017` preserves the history of `main` at `6cce840`,
`phase11-launch-evidence` at `a8d5e47`, and its Phase 13 ancestor `bf125c7`.
This includes the visual, account-menu, accessibility, rarity, branding,
typography, DRIP identity-preservation and contained-restore changes.
No migration SQL or applied ledger checksum was rewritten.

Release fixes install Chromium in CI, preserve browser-launch failure diagnostics,
align the Prisma merge-request UUID default with the existing database default,
generate Prisma before clean-checkout unit tests, create the Windows evidence
directory, and make browser assertions follow the approved heading hierarchy and
randomized landing artwork. Phase 12 network fixtures temporarily suspend and
restore earlier browser-fixture refresh hints, retaining all meaningful assertions.
Deployment packaging now reproduces the reviewed migration bytes for each database;
see [migration packaging](migration-bytes.md).

Populated gallery review found decorative pale accents still applied to text on
the Phase 13 white surfaces. Gallery labels and links now use the approved dark
green, while decorative accent choices remain intact. Browser coverage measures
normal-text contrast for all four accent choices against computed surfaces.

A cross-platform restore exposed timezone-dependent JSON digests in the migration
ledger: identical rows differed between UTC and America/Toronto sessions. Inventory
serialization now uses transaction-local UTC. Stored timestamps, migration SQL and
ledger checksums are unchanged. A populated database regression verifies identical
inventories across both zones and confirms that the session change is scoped to
the transaction.

Next and Sharp security patches remove the reported runtime dependency advisories.
`npm audit --omit=dev` reported zero vulnerabilities. Five high development-tool
advisories remain in the braces/micromatch/fast-glob ESLint dependency chain; the
registry did not offer a compatible patched braces release. No forced framework
downgrade was applied. These packages remain installed in the current build image.

The CHARM gate now requires a recent full sweep after the current alignment proof.
A current single-account balance cannot certify an old sweep. The operational
`DRIP_SWEEP_PAUSED` switch stops automatic sweeps during permission recovery while
allowing queued exact account refreshes; it explicitly keeps CHARM_DRIP pending.
Use it only while resolving the denied read access, then revalidate a complete
scheduled cycle. It does not waive any launch requirement.

## Observed checkpoints

At `8d04ab99cf292a77b3b06948f4388bb600a08934`,
[GitHub CI](https://github.com/GuyLeDouce/UglyDex/actions/runs/39063718407)
and the complete local release check passed: 780 unit tests and 921 database,
HTTP, browser and catalog assertions. Node was upgraded to 24.22.0 and npm to
12.2.0 at the owner's request. All five staging images matched that revision.
Replay A/B matched with stable inputs and no differences. Ten staging smoke
checks passed. Stored privacy checks covered 35,957 active activity projections
and 379 private profiles with zero failures; genuine account flows remain pending.

The first backup captured 190 queued derivations and 62 stale collection results;
its restore correctly failed. After normal replay recovery, a fresh archive passed
all 31 selected-table inventories and contained verification, with zero queued
derivations or collection discrepancies. Both disposable staging restore targets
were removed and verified absent. Further Windows HTTP restore validation exposed
the timezone issue fixed above. Final-revision reruns belong in the PR record.

Paced desktop/mobile browsing found no horizontal overflow or page-script errors.
The public artwork gateway returned HTTP 429 for the tested passport image and
occasional timeouts. Artwork fallback is honest but does not certify availability;
gateway capacity remains an operational launch issue. No alternate gateway was
substituted to bypass its limits.

At `8ace28f69b42b4cf870bc0bbe251b616382295ae`,
[GitHub CI](https://github.com/GuyLeDouce/UglyDex/actions/runs/39060875356)
passed all steps after the DRIP sweep freshness/pause change. All five staging
images had matching APP_COMMIT and baked release manifests, including the staging
migration-byte profile. These results precede the final gallery contrast fix.

At `7bba4be92dce6fb12a50f1e9f41336bd6c853410`,
[GitHub CI](https://github.com/GuyLeDouce/UglyDex/actions/runs/39057761160)
passed every step, including database, HTTP, browser, full catalog and formatting.
The local populated database/browser/catalog suite passed 916 assertions; the
preceding release run passed 776 unit tests, lint, formatting, types, catalog
verification and build. These results predate the sweep freshness/pause change;
they must not be represented as final-revision evidence.

Staging web and workers were deployed from a clean archive of that commit. Runtime
APP_COMMIT and immutable image manifests matched on web, ecosystem, progression
and collections. The blockchain build's Google-font resolver failed once; an
identical-package retry built successfully. Its new process waited for renewed
revision-bound chain admission. No cursor was reset. Collections recovered by
normal deployment after its old process had stopped on October 15.

Ten staging HTTP/PNG smoke checks passed. Staging retained 4,444 canonical Squigs,
4,444 provenance records, 11,133 transfers, 36,017 activities and 380 Collectors.
Pinned chain verification matched all 4,444 mints and current owners, with zero
anomalies, at indexed block 26213986. Nine configured source integrations were
reachable, schema-compatible and read-only. `gauntlet_online_reward_events` was
accessible with zero rows: an empty source does not establish lifetime coverage.
Intentional unattributed events and source-coverage limits remain visible.

A consistent staging backup was created with archive digest and 31 selected-table
inventories. The populated disposable restore reached contained verification with
4,444 Squigs, no deployment binding and all restored workers disabled. Completion
and cleanup must be confirmed in the final validation record; this checkpoint
does not claim a completed restore drill. Raw archives and private evidence are
ignored artifacts, never release attachments.

## DRIP and genuine user evidence

Read-only checks independently matched UglyDex's Realm/currency to UglyBot's
guild settings and The Gauntlet's runtime configuration. Exact verified wallet-link
mapping plus `type=drip-id` returned HTTP 200. The normal targeted sync processed
one account, resolved one identity, persisted one exact currency balance, and
advanced its proof timestamps; the balance view became current. This was an
operator-queued request, not an authenticated browser action.

Scheduled batches still encountered HTTP 403. A bounded exact Discord-ID probe
returned HTTP 200 with `credentials.access=false`. Stop denied sweep retries;
the Realm/key owner must review member-search and credential-read permissions for
the scoped read key. Do not paste keys, member IDs or wallet mappings into chat.
Preserve exact matching and cached evidence. A manual refresh button already
exists on `/charm`; it cannot supply missing upstream permission.

Real Discord consent, wallet signatures, account switching, populated privacy
transitions and authenticated CHARM linking/refresh remain pending genuine account
interaction. No connected interactive browser was available at this checkpoint.
Automated fixtures do not close these gates or certify a physical device.

## Production observations and approval boundary

PR #7 was externally merged at 17:35:23 UTC during validation. This agent did not
merge it or deploy production. Railway automatically deployed `44b5e5c9e51c44a8b05d8c69cf9dae1feff88ecf`
as deployment `4ee49263-df43-48f8-b810-d347ff25699b`. Read-only inspection found
RAILWAY_GIT_COMMIT_SHA at that revision but stale APP_COMMIT at
`c764e2810715be0608e5fadc47d45a6a391ba674`. Production had 13 applied migrations,
4,444 catalog entries, zero transfers/provenance/activities, one Collector and no
worker-control or heartbeat rows. Historical claims of eleven migrations and the
old serving code are superseded. No production correction was performed.

The remaining candidate must stay unmerged until final approval. Code readiness,
staging launch readiness and production readiness are separate decisions.
Use the [concrete rollout package](release-rollout-20261017.md), and refresh all
revision-bound evidence after any further change.
