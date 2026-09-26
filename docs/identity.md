# Collector identity and reconciliation

## Phase 8 reconciliation evidence

Production rollout requires reviewed confirm/reject/time-split cases, audit history and targeted downstream replay. Unresolved conflicts block the identity gate and remain visible in production:report. No conflict was auto-resolved during this phase. Edition historical acquisition uses only CONFIRMED attribution whose effective interval contains the event; current wallet linking alone is not historical evidence. Edition public timelines never expose raw identity/wallet evidence.

## Phase 1 active associations and public privacy

Profile controls are independent: `isPublic`, `showWallets`, `showDiscord` (all false by default). Only authenticated Discord usernames may be published. Public Squig owner links require an active association and public collector; raw addresses additionally require wallet visibility. Public passport entries do not include internal evidence, raw activity metadata, Discord IDs, nonces or sessions. Public collections can still be correlated with public blockchain records; hiding an address is not blockchain anonymity.

Slug changes normalize lowercase, validate 3–48 characters, reject reserved routes, and enforce a database lower(slug) unique index. All relations stay on the unchanged Collector UUID. Featured token IDs are validated against current active-wallet holdings on save and checked again on display.

The wallet settings page selects one primary wallet or revokes a manually proved SIWE association. Revocation updates status/timestamp without deleting wallets, activities, observations or discoveries. It requires another active wallet or authenticated Discord credential. All sessions and pending collector-bound auth challenges are invalidated because Phase 0 sessions do not track credential provenance. Sign back in with a remaining method. A revoked wallet cannot silently reclaim or move its old Collector; reconciliation review remains required.

New wallet proofs reconcile already indexed current holdings (discovery date is the reconciliation observation, not an invented acquisition date), then queue current-owner refresh when RPC is configured. Transfer imports attribute both sender and recipient only within known verification/revocation intervals. Replays move discovery dates earlier when an earlier provable event is found. Sale, transfer between a collector's wallets, or revocation never removes discovery. A signature today does not silently attribute every past action of a potentially transferred wallet; earlier legacy evidence needs reviewed reconciliation. Conflicting Discord/wallet identities remain explicitly unresolved.

Collector UUID is the internal identity. Discord IDs are external keys, stored as strings to avoid JavaScript precision loss. Usernames are display values and never matching keys. Normalized EVM addresses are lowercase; checksummed representation is optional display metadata. Unique `(chainId, walletAddress)` prevents two active credential claims. Wallet history and source evidence are separate records.

## Trust levels

1. `ExternalIdentity`: provider + authoritative ID, unique. Historical imports may reserve an unclaimed Discord collector. `authenticatedAt` remains null until OAuth proves control.
2. `CollectorWallet`: a signature-proven login credential, with verifiedAt, first/last seen, status and revokedAt. Multiple wallets can link to one UUID. One primary wallet per chain is enforced by partial SQL index.
3. `WalletLinkEvidence`: observations of upstream `(guild_id, discord_id, wallet_address, verified)` with source timestamps and observation time. UglyBot does not provide chain or verified_at; the configured ecosystem is Ethereum. Never treat source created_at as wallet-control start time. Gauntlet's loose resolver is not copied as an authentication rule.
4. `IdentityReconciliation`: deduplicated pending/resolved/rejected review record. Evidence persists inside UglyDex. No implicit merges, no upstream edits.

## Three-wallet example

Import Discord D's three legacy verified wallet links as evidence and reserve a Collector A for its Discord history. A new signature from wallet W proves current control of W, so it creates Collector B unless W is already a credential or the user has an existing session. It never silently logs into A through legacy data. A pending case points to the possible Discord history without publishing private records.

When B authenticates Discord D, both proofs exist but two collector records may already hold history. Phase 0 opens a COLLECTOR_CONFLICT review rather than automatically merging. If D had no pre-existing collector, its verified identity can be linked directly to B. If the user signs in through Discord first, additional independently signed wallets link directly to A. The other legacy wallets remain historical evidence; they do not become login credentials without their own signatures.

Phase 1 should provide a review/merge service: require fresh proofs for both accounts (or authenticated admin adjudication), choose a survivor UUID explicitly, lock both collectors and credential keys, move identities/sessions/wallets and event associations transactionally, deduplicate discoveries and achievements, preserve stable source event keys, record immutable merge evidence and invalidate old sessions. This is deliberately not a Phase 0 automated operation.

## Conflict rules

| Situation                                       | Rule                                                                                                                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One wallet linked to multiple Discord IDs       | Retain every guild-scoped source observation; open conflict case; choose none automatically                                                                                                                                      |
| Credential already belongs to another collector | Refuse cross-account link and record review; never steal it                                                                                                                                                                      |
| Upstream username changes                       | Update display metadata after provider authentication; Discord ID remains authoritative                                                                                                                                          |
| Stale/deleted upstream wallet link              | Retain observed evidence as historical; never use it for login/current ownership. Absence is not proof of revocation                                                                                                             |
| Wallet sold or control changes                  | A signature only proves current control, not continuity. Revoked/conflicting credentials need review; no automatic collector reassignment                                                                                        |
| User revokes wallet                             | Set REVOKED and revokedAt, clear primary, invalidate sessions as appropriate, preserve evidence/activity. A later signature must not silently reactivate. Phase 0 has the state/guard; self-service revoke UI follows in Phase 1 |
| Duplicate collectors                            | Explicit audited merge, never username matching or address-only history reassignment                                                                                                                                             |
| NFT transferred away                            | Ownership projection updates; existing discoveries stay. Preferences and past activity never establish current ownership                                                                                                         |

## Authentication protocol

Wallet POST nonce requires canonical Origin, validated address and shared PostgreSQL rate limit. Server generates SIWE text with canonical domain, URI, Ethereum chain ID, random nonce and five-minute expiration. The server stores the exact message, an HMAC challenge identifier, expiry and initiating collector. A HttpOnly SameSite=Lax cookie binds browser to challenge. Verify accepts only a signature, never client-authored message/domain/collectorId. It checks signature, expiration and session binding, then atomically consumes the challenge with the credential update. Concurrent/repeated consumption fails. Phase 0 supports EOA personal_sign; ERC-1271 smart-wallet support is future work.

Discord POST start requires Origin. OAuth uses state, a HttpOnly state cookie, PKCE S256 and a five-minute, one-use server record bound to the initiating session. Callback checks both state and session before token exchange, uses canonical redirect_uri and bounded Discord requests, and trusts only `/users/@me`'s ID. Tokens are not stored or logged. Provider errors return safe error codes.

Sessions use random opaque tokens stored only as HMAC hashes. Successful login rotates the previous browser session. Cookies are Secure in production, HttpOnly, path=/, SameSite=Lax; sessions expire in seven days. Linking requires an authenticated session plus proof of the new credential. Logout is a same-origin POST. Auth rate limits are database-backed (global and wallet-specific); no client-controlled proxy IP is trusted. Add Railway-edge abuse protection and authenticated account limits before public high-volume rollout. Schedule deletion of expired auth challenges, sessions and rate buckets in the UglyDex database as operational housekeeping; never delete activity history.

Public profiles default to private. The owner uses `/me` and authenticated settings; `/collector/[slug]` returns 404 while private, including for the owner. Public output is explicitly projected and never renders raw source metadata. Phase 1 implements editing/consent and separate wallet/Discord visibility controls.

## Phase 2 historical evidence

Current authentication and historical attribution are separate permissions. `HistoricalIdentityAttribution` stores source, confidence/status, effective dates and evidence references. Signed credentials start at `verifiedAt`; imported wallet links remain unconfirmed review candidates. A present-day proof never silently grants all earlier wallet activity. Revocation bounds an interval without erasing its valid past.

Collector holding periods intersect chain wallet periods with uncontested evidence. Direct moves between two confidently associated wallets continue the same hold; reacquisition after an intervening owner creates another period. Conflicts with another collector, including pending legacy claims, withhold the affected interval. Audited admin review can confirm, reject, split or leave it unresolved. It cannot merge login accounts or write to ecosystem databases. See [provenance identity review](provenance.md#identity-review-and-privacy).

Historical public attribution now requires BOTH public profile visibility AND wallet visibility, plus resolved evidence. The Squig passport may show a public blockchain address without revealing the hidden UglyDex collector behind it. Invalidated attribution can invalidate discovery; sale alone never does. Production review pages require an authenticated allowlisted Discord ID (`ADMIN_DISCORD_IDS`).

## Phase 3 event attribution

Explicit Discord IDs resolve through ExternalIdentity. Wallet-only events require a dated, unambiguous historical attribution at event time; missing or conflicting evidence leaves collectorId null without losing an explicit Squig event. Review changes queue ActivityAttributionJob in the same transaction as historical projection invalidation. A bounded worker reattributes existing local records with correction audits; the targeted `activity:reattribute` command can also select a Discord ID, wallet, or Collector. Source events never grant login credentials.

Public Discord-derived activity requires showDiscord; wallet-derived activity requires showWallets; private profiles have no public history/gallery. Public Squig ecosystem events expose no Collector identity, Discord ID or hidden wallet association. Pending wallet attribution jobs withhold stale associations. Source corrections and retractions are operational evidence visible only to admins. See [activity model](activity-model.md).

## Phase 4 identity and progression

Progression requires confirmed evidence. Pending wallet attribution excludes affected Collector activities; confirmed discovery must reference its valid ownership period. Corrections queue old and new subjects, preserve grant/revocation audit, and filter revoked titles/badges from public output. Generic public levels/achievement summaries do not publish hidden credential associations or source evidence. Private profiles have no public progression route. See [progression privacy](progression.md#presentation-and-privacy).

## Phase 5 collection evidence

Collection replay uses confirmed discoveries only when the first CollectorOwnershipPeriod matches the collector/token/date and provenance is complete and clean. Wallet unlinking affects current sets but retains valid historical traits/sets. Reconciliation and dirty provenance queue reevaluation; pending jobs suppress stale public claims. Public set evidence never contains attribution IDs or wallets; qualifying token evidence is also hidden when wallet attribution visibility is disabled. See [collections](collections.md).

## Phase 6 gallery and share privacy

Private profiles hide every public/unlisted gallery and personalized public card. Gallery visibility and full-collection visibility are independent explicit disclosures; private galleries remain owner-only even on public profiles. HIDDEN collection suppresses featured artwork/collages and public set token evidence. Sharing consumes explicit safe DTOs and rechecks state before returning image bytes. Downloaded images cannot be recalled from their recipients. See [sharing privacy](sharing.md#profile-and-public-projections).
