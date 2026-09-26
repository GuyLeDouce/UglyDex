# Squig provenance

## Phase 8 production proof

`production:report` reports stored mint/continuous-history/owner-match coverage and every anomalous token ID. Run archive start-boundary validation plus provenance:verify and production:verify --owners full before enabling dependent workers. The start reported by an explorer remains unverified until actual archive code/block evidence is checked. Backfill provenance gates refuse incomplete/dirty records. Edition history has separate cursors and cannot alter Reloaded provenance. Real mainnet verification remains PENDING.

## Facts, observations and identity

`NftTransfer` is the canonical Ethereum Transfer ledger for the configured Squigs contract. Its primary ID is `1:<transactionHash>:<logIndex>`, with an additional unique `(chainId, transactionHash, logIndex)` constraint. It retains contract, token, both addresses, transaction index, block number/hash/time, ingestion time and finalized flag. Token records must already exist; run `sync:squigs` first. An event key with inconsistent contents stops the scan. Raw records are never edited by profile settings, identity review or a normal rebuild.

`ChainBlock` caches timestamps and hashes by chain and block. A block containing 200 transfers requires one timestamp resolution, not 200. Chunk boundaries and rewind anchors are also retained. `ChainCursor` extends the Phase 0 cursor with the validated deployment boundary, observed finalized height, successful checkpoint time and safe error code. A Phase 0 cursor without raw-ledger coverage restarts the new ledger from deployment rather than claiming historical completeness.

`SquigOwnership` remains the Phase 1 current-observation read model. A newer pinned `ownerOf` snapshot wins over an older ledger projection. It is not treated as proof of acquisition date. `WalletOwnershipPeriod` and `CollectorOwnershipPeriod` are rebuildable projections; their event references and timestamps identify actual starts and ends. Open periods mean owned through the indexed horizon, not proof of future possession.

## Deployment boundary and production coverage

The contract is Ethereum mainnet `0x8c9a02c0585200c4c65608df6b8def543d33792a`, matching the existing pinned ecosystem source/configuration.

On 2026-09-25 Toronto time, [Blockscout's address API](https://eth.blockscout.com/api/v2/addresses/0x8c9a02c0585200c4c65608df6b8def543d33792a) reported creation transaction [0x89813e58e6342ca49e8c301fcad8c16228b91d4d50584e0a2968c9ee80390571](https://eth.blockscout.com/tx/0x89813e58e6342ca49e8c301fcad8c16228b91d4d50584e0a2968c9ee80390571). Its transaction API reported block **25,342,921**, timestamp **2026-06-18 07:21:35 UTC**. This is deployment evidence, not an assertion that every token minted then. The public RPC refused archive `eth_getCode` requests and did not provide a usable receipt for independent confirmation in this session.

Set `SQUIGS_START_BLOCK=25342921` only with that evidence reviewed, or independently run `chain:discover-start` with an archive-capable provider. On first ingestion the scanner requires code at the configured block and no code at the preceding block. An incorrect/partial start fails. No block-zero fallback exists. Per-token mint dates come exclusively from that token's zero-address Transfer event.

No production UglyDex DB or configured RPC credentials were available during implementation. Production event, mint, owner-match, anomaly and review-case counts are **unmeasured**, not zero. Test fixture counts are not production coverage.

## Scan and interruption behavior

`sync:transfers` scans deployment through the provider's `finalized` block tag. `TRANSFER_BLOCK_BATCH` bounds each range; `RPC_CONCURRENCY`, `RPC_RETRIES` and `RPC_TIMEOUT_MS` bound timestamp requests, exponential retry/backoff and HTTP request time. Rate-limit and transient provider errors retry with capped exponential delays. Provider URLs and raw error responses are never logged. Reduce block batch size if a provider consistently rejects log ranges. The provider must support archive code reads, historical logs, block queries and pinned contract calls.

A dedicated PostgreSQL connection holds a session advisory lock for each scan batch. Crashes release that lock. Raw inserts, cached blocks, dirty projection flags and cursor advancement commit together. A failed range leaves the prior checkpoint intact. Dirty token projections survive interruption and are processed independently by the worker. Each token rebuild takes its own transaction/advisory lock and cannot interleave with ingestion for the same token. Structured chunk logs include block range, event count and finalized target; diagnostics expose actual ledger counts.

The worker alternates one Transfer chunk, pending derivations and one existing ownership-refresh batch. It does not put historical RPC scans in a web request. Signature links and reviews mark affected records dirty; evidence boundaries crossing an otherwise empty chain range also trigger projection work. Multiple workers coalesce using the chain advisory lock and the existing ownership-refresh lease. Run a single worker initially to simplify operations and provider budgeting.

## Reorgs

Only provider-finalized blocks enter the ledger. Before advancing, the scanner rereads persisted event/boundary block hashes within `REORG_REWIND_BLOCKS` (default 128), including the cursor hash. It also rechecks a chunk's end block after fetching logs and validates each log's block hash.

On mismatch, it verifies the block immediately before the rewind window, then transactionally removes orphan-branch transfers, cached blocks and affected ownership observations, resets affected snapshot jobs, marks projections dirty and moves the cursor back. Reindexing replaces canonical facts; derived wallet/collector periods, discoveries and ownership timelines rebuild from the surviving ledger. Public collector attribution is withheld while projections are dirty. Logs record the rewind boundary and affected token count.

If the prior anchor also mismatches or is absent, the scanner stops with `DEEP_REORG_REVIEW_REQUIRED`. A deeper repair requires operator investigation; the normal derived rebuild command intentionally cannot erase the raw ledger. A finalized-height regression also stops. This is a bounded recovery policy, not a claim that an arbitrarily deep consensus failure can be repaired automatically.

## Ownership and discovery derivation

Sort facts by block number and log index. A zero-address sender is mint evidence; a zero-address receiver ends possession. Other sink-looking addresses remain transfers: the application cannot prove their private keys are inaccessible. Self transfers remain visible facts without restarting a wallet hold. Each non-self transfer closes the prior period and opens the next, retaining zero-duration periods for multiple transfers in a single block. Gaps, duplicate input events, timestamp regressions and multiple mints produce explicit anomalies. Broken continuity withholds confident holding projections.

Collector periods intersect wallet periods with confidently dated attribution intervals. Evidence is half-open `[effectiveFrom, effectiveTo)`. Pending evidence for a different collector blocks the overlapping segment. Adjacent periods merge only when the collector matches and chain event references prove direct continuity; an intervening owner is not erased merely because timestamps match. Reacquisition therefore creates a new period. Holding duration uses indexed block time, never import time. Discovery retains the earliest supported ownership interval and its first period ID. Selling or revoking a current wallet does not erase valid past ownership. Rejection/conflict/reorg may invalidate or move a discovery; rows remain with an invalidated status for audit rather than being deleted.

`CollectorActivity` events with source `provenance` are a separate rebuildable projection of discovery, acquisition, loss and internal wallet movement. Rebuilds do not delete external-system events. The reusable `Timeline` view model is event-source agnostic; no game or reward engine is added.

An interval clipped by identity evidence is not asserted to begin/end with a chain transfer. Collection cards distinguish “First acquired” from “First confirmed holding”, and an evidence expiry is not labeled an NFT sale or loss. Corresponding timeline events distinguish ownership confirmation and attribution expiry. Internal moves use log ordering as well as timestamps, so same-block moves remain visible; self transfers receive a separate label and do not create a new holding period.

New wallet linking does not create a discovery from a stale snapshot predating its signature. Current indexed holdings can still appear with their sync timestamp, but discovery waits for a chain-dated observation after proof or a reviewed historical interval. A finalization lag can therefore delay the first discovery after linking. Existing Phase 1 observation-based discoveries are re-evaluated as canonical history reaches their dates.

## Identity review and privacy

`HistoricalIdentityAttribution` records source, status, confidence, effective interval and evidence references. A signature starts a `VERIFIED` interval at verification time. Revocation ends it and marks it `REVOKED`, preserving its supported past. Legacy imports are `UNCONFIRMED`, not credentials. `INFERRED` and `CONFLICTING` statuses are non-authoritative. Only `VERIFIED`, `REVIEWED` and bounded `REVOKED` evidence can support collector periods, and overlapping conflicting collector claims withhold attribution.

`/admin/reconciliation` supports confirm, reject, split by time and leave unresolved. Every decision stores actor, reason, before/after evidence and timestamp in `ReconciliationDecision`, linked to the existing `IdentityReconciliation` case. A split requires an explicit second collector UUID and boundary; no username matching or account merging occurs. Cases concerning Phase 0 credential merges cannot be repurposed as historical grants. Review does not change external data or grant wallet login access.

Production admin pages require an authenticated Discord identity whose ID appears in `ADMIN_DISCORD_IDS`; development allows local diagnostics. Mutations require the configured origin, database rate limiting and admin session authorization. The existing bearer diagnostic token is read-only and is not a browser admin credential.

Public DTOs expose a collector attribution only if the interval is unambiguous, the projection is clean, the collector profile is public **and** `showWallets` is true. Otherwise the passport shows the public chain address without connecting it to an UglyDex identity. It never returns evidence JSON, Discord IDs, session details or review notes. Public collector counts refer only to publicly attributed collectors. Public profiles show ownership timelines only with wallet visibility enabled.

## Verification and repair

```sh
npm run chain:discover-start
npm run sync:transfers
npm run chain:status
npm run chain:verify
npm run provenance:verify
npm run provenance:rebuild -- --token 3157
npm run provenance:rebuild -- --from-block 25342921
```

`chain:verify` and `provenance:verify` are aliases. They check all 4,444 expected token IDs, metadata presence, mint, raw continuity, materialized periods and derived owner against batched `ownerOf` calls pinned to the cursor block. The cursor hash is checked before and after verification. Comparing a lagged ledger to current chain head would produce false anomalies, so verification deliberately uses the same indexed block. Failed calls remain `OWNER_OF_UNAVAILABLE`, including burn reverts; they are not counted as owner matches. The report separately states coverage, missing data, successful comparisons and token-specific anomaly reasons, and exits nonzero on incomplete/anomalous results.

Rebuild commands only flag selected tokens and reconstruct derived data. They preserve raw transfers and unrelated activities. `/admin/provenance` shows sync status, paginated raw records and holding periods, supports token lookup and queues the same safe derivation. There is no arbitrary SQL endpoint. Web pages always read PostgreSQL, never scan the chain.

## Phase 9

Phase 9 launch:rpc persists bounded archive boundary evidence; launch:provenance runs full pinned verification; launch:spot samples low/high/OG/Legendary/transfer-count/attributed/burn categories. Missing categories remain PENDING. No actual RPC/start-block proof has been performed in this workspace.
