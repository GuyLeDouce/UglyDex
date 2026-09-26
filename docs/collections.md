# Collections and the UglyDex

## Phase 8 verification

Replay commands are operationally guarded. The collections stage drains its queue and final verification recomputes evidence/snapshots. Editions and their indexed discoveries stay outside all Reloaded denominators and v1 set/completion calculations. Real-data second-replay comparison remains PENDING until sources and attribution settle.

Phase 7 preserves `uglydex-collection-v1`, 4,444 Reloaded tokens and all trait/set denominators. Customs represent the same tokens; Editions are a separate catalog/ownership category. Currently complete enabled sets with settled evaluation can unlock free frames/gallery presentation; loss or correction falls back on read. The collection worker now starts disabled. See [collectibles](collectibles.md) and [production readiness](production-readiness.md).

`uglydex-collection-v1` is a permanent collection interpretation layer, separate from `uglydex-progression-v1`. It reads only UglyDex's indexed metadata, ownership, discoveries and provenance. It issues no XP, CHARM, NFT, payment, financial reward or purchase recommendation. The Phase 4 ruleset and achievements are unchanged; future collection achievements require a separately reviewed progression version.

## Canonical trait catalog

The versioned catalog derives from all 4,444 records in `data/squigs.json`, exported from UglyBot revision `a693d46c4a8ccaf663d8b308dee0a7578e1268e6`. Existing canonical OG, Legendary, rarity and UglyPoints calculations are preserved.

| Category                   |  Values |
| -------------------------- | ------: |
| Background                 |      30 |
| Skin                       |      20 |
| Type                       |       5 |
| Body                       |     106 |
| Mouth                      |      22 |
| Eyes                       |      19 |
| Head                       |     125 |
| Special                    |      18 |
| **Completion denominator** | **345** |

Normalization is NFC, trim, and collapse whitespace. Case and spelling are preserved, including canonical unusual spellings. `Super Gold ` and `Diving Suit\r\n` normalize to clean display labels. Explorer predicates retain the source aliases, so those values remain searchable without modifying original NFT metadata. `Special: None` is a real collectible state and counts. Blank values do not count. Status (OG/Reloaded) is excluded as a separate classification; Legend's 31 one-of-one names are excluded to avoid distorting normal trait completion. Token IDs, filenames, names, description, points and other technical fields are not traits. Normal non-Legend traits with frequency one remain included; 100% is not promised to be attainable.

`CanonicalTrait` stores each versioned key, count, first token, OG distribution and Legendary-only flag. Frequencies use 4,444 as denominator, not the number of onboarded collectors. Frequencies describe the V1 canonical metadata snapshot. Membership/denominator/configuration changes require a new collection version; same-version seeding rejects fingerprint changes. Indexed corrections using existing canonical values re-evaluate affected collectors; unknown values fail closed and require catalog review/versioning. Never patch the fingerprint to bypass this gate.

## Two kinds of evidence

**Historical discovery:** `SquigDiscovery.everOwned`, CONFIRMED attribution, clean complete SquigProvenance and an exact matching CollectorOwnershipPeriod (collector, token, first acquisition timestamp). Observation-only or unresolved history is excluded. Sales and revoked active wallet associations do not erase supported past. Invalidated discovery/provenance removes unsupported trait/set progress. A later legitimate restoration re-unlocks it with its qualifying evidence date.

**Current holding:** canonical indexed current ownership across active verified Ethereum wallets, deduplicated by token. Dirty provenance and confirmed active Maw digestion exclude a token. Current ownership may use a finalized ownerOf snapshot while deeper historical backfill remains incomplete. It does not thereby grant historical discovery. No chain or external database call happens in collection evaluation or a page request.

Trait discoveries choose the earliest legitimate discovery, then lowest token ID for a tie. Raw period evidence is retained internally. Current trait counts and historical trait counts are separate snapshot fields. Metadata corrections can change them; they are never inferred from watchlists, external donated NFTs or client submissions.

## Requirement engine and catalog

There are **52 authored sets: 39 historical, 13 current, three hidden** (two historical, one current). The visible historical completion denominator is **37**. Historical and current versions of similar themes are distinct goals. Hidden sets never enter the permanent percentage or explorer hints.

Typed requirement primitives:

- COUNT with optional canonical trait-value groups, OG, Legendary, rarity or token filters.
- UNIQUE_TRAIT_VALUES within a category, optionally constrained by another trait (e.g. Purple Skin with different Body values).
- TOKEN_IDS for explicit token membership, available to reviewed future definitions.
- Multiple requirements combine with AND; filters within one requirement apply to the same token. Theme groupings explicitly enumerate existing values.

No arbitrary executable rule language exists. Evidence selection sorts by qualifying discovery time then token ID; current holdings have token-ID order because an observed current set does not prove all earlier simultaneous holdings. Evidence is bounded by each requirement threshold. One token may satisfy multiple distinct requirements, but cannot count twice toward a count or unique-value requirement. Difficulty is presentation only.

The code-controlled catalog is `src/domain/dex-catalog.ts`; the complete generated list follows below. Hidden rules are visible in this operator documentation/source code, but not in public projections before completion. This is UI secrecy, not cryptographic secrecy.

## Completion formula

Fractions are capped to [0,1].

```
Squig fraction = valid unique discoveries / 4444
Trait fraction = valid unique canonical trait discoveries / 345
Historical set fraction = complete visible historical sets / 37
Overall percent = 40 * Squig fraction + 35 * Trait fraction + 25 * Historical set fraction
```

Overall is materialized to four decimal places, displayed to one. Current sets and hidden sets are excluded. Selling a token therefore cannot reduce historical completion; a correction invalidating its evidence can. The UI shows all three fractions separately and current-set completion separately. No unknown metric is fabricated.

## Replay, corrections and time

`CollectorSetProgress` is extended rather than replaced. It holds current completion, typed progress/evidence, first/last completion, transition count and evaluation time. Historical completedAt uses the last threshold-satisfying historical acquisition. Current firstCompletedAt is explicitly **first observed complete**, not an invented chain-wide simultaneous completion date. Between-worker transient holdings may never be observed as a completed current set. Transition counts describe recorded evaluations, not every state on chain.

An atomic subject-locked repeatable-read transaction recomputes eligible evidence, reconciles trait discovery/revocation, set progress, completion snapshots, candidate hints and derived milestones. CollectionAudit records set advancement/completion/loss/invalidation/restoration and trait/milestone changes. Replay with identical evidence emits no new audit transitions. Earlier first-observed completion remains auditable after loss; current active completion and featured display reflect present evidence. Historical invalidation revokes dependent milestones; restoration uses corrected evidence. First-ever recorded completion fields are audit history and need not equal a currently valid qualifying date after correction.

CollectionMilestone stores trait discovery, set completion and 1/5/10/25/50/75/90/100% threshold crossings. Historical crossings replay chronologically from real discovery/set qualification dates. Current first-completion milestones use an explicit FIRST_OBSERVED_COMPLETE time basis. These are derived records, never fake ecosystem CollectorActivity rows.

## Workers and operational commands

```
npm run db:migrate
npm run collections:verify
npm run collections:seed
npm run collections:rebuild
npm run collections:rebuild -- --collector <uuid>
npm run collections:rebuild -- --restart
npm run worker:collections -- --once
npm run worker:collections
```

Verify validates all 4,444 canonical IDs, trait references, unique set keys, feasibility against actual metadata, replay order independence and completion denominator arithmetic. It works without production credentials. Seed is idempotent and fingerprint checked. A global replay has durable batches of 200 Collector UUIDs, resumes incomplete enqueue passes and begins a new pass after a previous completed run. It never truncates source history. Targeted rebuild and the worker share the same evaluator.

UglyDex-only PostgreSQL outbox triggers queue old/new collectors on wallet, ownership, discovery, period, attribution and provenance changes. Canonical token/trait changes queue all collectors because missing-opportunity hints can change even for collectors who have never held that token. Jobs coalesce by Collector UUID with a generation, use transaction advisory locks and acknowledge only the processed generation. Concurrent updates either retry or remain queued. A failed subject retains its job and safe error code, while unrelated subjects proceed. Each evaluation uses SyncRun. The worker evaluates up to 25 collectors per 15-second cycle and stops between subjects on SIGTERM/SIGINT. Forced interruption rolls back derived changes and retains pending work.

Metadata imports cause broad queue invalidation; schedule large metadata migrations/backfills as background work and monitor the queue. Evaluation reads at most the fixed 4,444-token catalog plus one collector's eligible evidence. Explorer hints are computed by prepared incomplete requirements, then materialized once per subject. Explorer requests read the hint map server-side and fetch only 24 full cards. No full artwork records or rules are shipped to the browser, no per-card set evaluation, no external reads. Snapshot storage is proportional to indexed token count per collector; monitor database size before large-scale onboarding.

## UI and privacy

- `/collection/dex`: fractions, closest sets, recent completions, missing opportunities.
- `/collection/traits`: grouped Trait Dex with discovery/current/rare/category filters.
- `/traits/[traitType]/[traitValue]`: canonical frequency, personal state and paginated explorer.
- `/collection/sets`: state/mode/category/difficulty/hidden filters and up to three earned featured sets.
- `/sets/[key]`: requirements, deterministic qualifying tokens, missing links and completion history.
- `/collector/[slug]/sets`: public opt-in collection guide and showcase.
- `/admin/collections`: authenticated operational status, queues/runs, rules and Collector + set evidence explanation.

Public collector routes require isPublic. Public view models omit wallets, Discord, raw period/attribution evidence and private profile fields. Qualifying historical token evidence is also suppressed when wallet attribution visibility is off. Hidden incomplete sets expose only a mystery card, no criteria/count/requirement links. Hidden goals do not contribute personalized recommendations. Pending jobs withhold stale completed/featured claims. Featured-set saving is authenticated and validated server-side against active completion under the subject lock; max three distinct choices. Losing a current set removes it from active showcase without destroying its preference/audit history.

Explorer personalization requires an authenticated viewer. Anonymous personalized filters return no private candidates. Hints distinguish currently owned, already discovered, new discovery, missing traits and visible sets advanced. A public profile's collection is never used as the browsing viewer's identity. Public global counts include only opted-in public UglyDex Collectors with settled projections, and never claim to represent all Squigs holders.

## Holder status and production limits

Reinspection of UglyBot's current local source finds `holder_rules` with role names, chain/contract, min_tokens/max_tokens and enabled status. Authoritative names/thresholds remain production configuration, not constants. No branded holder status is invented. Current counts remain separate from historical sets and XP.

Production legacy credentials are not needed for this engine, but actual historical collection progress depends on production ownership indexing, provenance completeness and reviewed attribution. No fixture completion is seeded to production. After approved source/backfill validation, run provenance/identity processing, collection replay and verify representative evidence. Inspect failed jobs before publishing completion totals. Unknown catalog values require review; dirty provenance requires the chain worker; rejected identity evidence requires reconciliation, not manual progress edits.

## V1 set catalog

<!-- Generated from code-controlled definitions. -->

| Set                            | Mode       | Category  | Difficulty | Requirements                                                                                                                                                                |
| ------------------------------ | ---------- | --------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First Specimen                 | Historical | Starter   | Easy       | 1 Squig                                                                                                                                                                     |
| Field Notes                    | Historical | Starter   | Easy       | 5 Squigs                                                                                                                                                                    |
| Strange Company                | Historical | Starter   | Medium     | 10 Squigs                                                                                                                                                                   |
| Deep Archive                   | Historical | Mastery   | Hard       | 100 Squigs                                                                                                                                                                  |
| Living Library                 | Historical | Mastery   | Insane     | 500 Squigs                                                                                                                                                                  |
| OG Curious                     | Historical | OG        | Easy       | 1 OG Squig                                                                                                                                                                  |
| OG Problem                     | Historical | OG        | Medium     | 5 OG Squigs                                                                                                                                                                 |
| Original Archive               | Historical | OG        | Hard       | 25 OG Squigs                                                                                                                                                                |
| Legendary Encounter            | Historical | Legendary | Hard       | 1 Legendary Squig                                                                                                                                                           |
| Legend Lore                    | Historical | Legendary | Insane     | 3 Legendary Squigs                                                                                                                                                          |
| Purple People Eater            | Historical | Traits    | Medium     | 5 Squigs with Skin: Purple                                                                                                                                                  |
| Elf Research                   | Historical | Traits    | Medium     | 4 different Skin values with Type: Squig Elf                                                                                                                                |
| Amphibian Atlas                | Historical | Traits    | Medium     | 1 Squig with Skin: Amphibian Red; 1 Squig with Skin: Amphibian Green; 1 Squig with Skin: Amphibian Purple                                                                   |
| Machine Learning               | Historical | Traits    | Medium     | 1 Squig with Skin: Robot; 1 Squig with Skin: Dark Robot                                                                                                                     |
| Afterlife Studies              | Historical | Traits    | Medium     | 1 Squig with Skin: Zombie; 1 Squig with Skin: Dark Zombie                                                                                                                   |
| Crystal Clear                  | Historical | Traits    | Hard       | 1 Squig with Skin: Crystal; 1 Squig with Skin: Crystal Elf                                                                                                                  |
| Suit Yourself                  | Historical | Traits    | Hard       | 1 Squig with Body: White Suit; 1 Squig with Body: Black Suit; 1 Squig with Body: Brown Suit                                                                                 |
| Ugly Space Program             | Historical | Weird     | Hard       | 1 Squig with Body: White Astronaut; 1 Squig with Body: Black Astronaut                                                                                                      |
| Splash Notes                   | Historical | Traits    | Medium     | 1 Squig with Background: Green Splash; 1 Squig with Background: Pink Splash; 1 Squig with Background: Purple Splash                                                         |
| Portal Tour                    | Historical | Traits    | Hard       | 4 different Background values with Background: Portal or Yellow Portal or Light Blue Portal or Pink Portal or Orange Portal or Grey Portal or Purple Portal or Green Portal |
| Eyes Wide Ugly                 | Historical | Variety   | Hard       | 10 different Eyes values                                                                                                                                                    |
| Many Faces                     | Historical | Variety   | Medium     | 8 different Mouth values                                                                                                                                                    |
| Wardrobe Malfunction           | Historical | Variety   | Hard       | 20 different Body values                                                                                                                                                    |
| Hat Laboratory                 | Historical | Variety   | Hard       | 25 different Head values                                                                                                                                                    |
| Species Survey                 | Historical | Variety   | Hard       | 5 different Type values                                                                                                                                                     |
| Skin Deep                      | Historical | Variety   | Hard       | 10 different Skin values                                                                                                                                                    |
| Background Check               | Historical | Variety   | Medium     | 10 different Background values                                                                                                                                              |
| Special Interest               | Historical | Variety   | Hard       | 8 different Special values                                                                                                                                                  |
| Triple Vision                  | Historical | Traits    | Medium     | 1 Squig with Eyes: Triple; 1 Squig with Eyes: Triple Lashes; 1 Squig with Eyes: Sleepy Triple                                                                               |
| Laser Laboratory               | Historical | Traits    | Hard       | 1 Squig with Special: Green Laser; 1 Squig with Special: Yellow Laser; 1 Squig with Special: Multi Laser                                                                    |
| Pet Project                    | Historical | Weird     | Hard       | 1 Squig with Special: Piranha; 1 Squig with Special: Parakeet; 1 Squig with Special: Dino                                                                                   |
| Mood Board                     | Historical | Starter   | Easy       | 1 Squig with Mouth: Smile; 1 Squig with Mouth: Sad; 1 Squig with Mouth: Afraid                                                                                              |
| Rainy Day Research             | Historical | Weird     | Hard       | 1 Squig with Head: Umbrella Hat; 1 Squig with Body: Diving Suit                                                                                                             |
| Gold Standard                  | Historical | Weird     | Hard       | 1 Squig with Skin: Gold; 1 Squig with Mouth: Gold Duck                                                                                                                      |
| Eye Encyclopedia               | Historical | Mastery   | Insane     | 19 different Eyes values                                                                                                                                                    |
| Wardrobe Archive               | Historical | Mastery   | Insane     | 106 different Body values                                                                                                                                                   |
| Head Office                    | Historical | Mastery   | Insane     | 125 different Head values                                                                                                                                                   |
| Static Signal (hidden)         | Historical | Hidden    | Insane     | 1 Squig with Eyes: Gold Terminator; 1 Squig with Head: Atomic                                                                                                               |
| Late Night Television (hidden) | Historical | Hidden    | Hard       | 1 Squig with Body: Beavis Tee; 1 Squig with Body: Butthead Tee                                                                                                              |
| Room for One                   | Current    | Starter   | Easy       | 1 Squig                                                                                                                                                                     |
| Crowded Laboratory             | Current    | Hoarding  | Medium     | 10 Squigs                                                                                                                                                                   |
| Hoarder Rack                   | Current    | Hoarding  | Hard       | 25 Squigs                                                                                                                                                                   |
| Specimen Wing                  | Current    | Hoarding  | Insane     | 50 Squigs                                                                                                                                                                   |
| Ugly Rainbow                   | Current    | Traits    | Hard       | 1 Squig with Background: Purple; 1 Squig with Background: Green; 1 Squig with Background: Light Blue; 1 Squig with Background: Pink; 1 Squig with Background: Yellow        |
| Suit Rack                      | Current    | Traits    | Hard       | 1 Squig with Body: White Suit; 1 Squig with Body: Black Suit; 1 Squig with Body: Brown Suit                                                                                 |
| Three-Eyed Army                | Current    | Traits    | Medium     | 5 Squigs with Eyes: Triple or Triple Lashes or Sleepy Triple or Angry Triple or Angry Triple Lashes                                                                         |
| Old Guard                      | Current    | OG        | Medium     | 5 OG Squigs                                                                                                                                                                 |
| Legend in Residence            | Current    | Legendary | Hard       | 1 Legendary Squig                                                                                                                                                           |
| Five Species, One Home         | Current    | Variety   | Hard       | 5 different Type values                                                                                                                                                     |
| Purple Wardrobe                | Current    | Weird     | Hard       | 5 different Body values with Skin: Purple                                                                                                                                   |
| Colour Clash                   | Current    | Variety   | Hard       | 8 different Skin values                                                                                                                                                     |
| The Quiet Room (hidden)        | Current    | Hidden    | Hard       | 3 Squigs with Mouth: Sewn; 3 Squigs with Mouth: Tape                                                                                                                        |

## Phase 9

Phase 9 includes discovery, set, completion and milestone state in replay fingerprints. The uglydex-collection-v1 formula and denominators remain unchanged. Production replay evidence is separate from local fixtures.
