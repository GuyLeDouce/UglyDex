# Official collectibles and personalization

## Source evidence

Re-inspected upstream HEADs on 2026-09-26 using `git ls-remote`; they match the existing read-only inspection checkouts:

| Repository   | Revision                                   | Relevant finding                                                                                                                                                                                                 |
| ------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UglyBot      | `a693d46c4a8ccaf663d8b308dee0a7578e1268e6` | `modules/marketplaceCommand.js` names a “Custom Edition Squig” item. This is a marketplace listing, not an authoritative artwork catalog, contract registry, fulfilled Custom record or Edition ownership proof. |
| The-Gauntlet | `780fa8692e1d4789ced85defbd3269fdf968699e` | Existing community/live-image and game references do not establish official alternate-art approval or Edition ownership.                                                                                         |
| ImageSubmit  | `c18e8620644ec52290008529581914a0acd6ffb3` | Community submission approval must not be reinterpreted as official Custom issuance.                                                                                                                             |

No upstream files or databases were modified. There is no authoritative import to invent. **Zero official Customs and zero Editions are seeded**. The reviewed UglyDex-owned admin catalog is the initial authority; deployment operators must supply documented approvals. Fixture records are test-only.

## Semantics and storage

A Custom is a verified alternate representation of one canonical Reloaded Squig. `SquigCustom` references the existing Squig ID; token, contract, traits, canonical artwork, UglyPoints and ownership remain unchanged. Stable lowercase keys, explicit issue/verification dates, artist, source/reference, order and revision support administration. DRAFT is admin-only, VERIFIED is public, RETIRED withdraws presentation permanently while preserving history. No hard-delete route exists. A replacement gets a new reviewed key; ordinary edits require the current revision.

`CollectibleArtwork` stores immutable IPFS URI, SHA-256 of approved bytes, MIME type, dimensions, byte length and validation date. `CollectibleAudit` stores actor, action and before/after snapshots, including asset hashes and relations. Admin actor IDs and source references never enter public DTOs. A Custom's first verification writes one unique `CUSTOM_VERIFIED` Passport event; public history shows currently verified Custom names and verification dates. Routine metadata edits are audit-only.

`SquigDisplayPreference` belongs to the Collector and Squig, with an ownership observation key. Every read checks current verified-wallet eligibility, clean provenance, live Custom status and that ownership key. A transfer, retirement or uncertain ownership falls back to Original. A returning owner must choose again after a changed observation. Official Customs remain attached to the Squig, independently of preferences. A refreshed snapshot may conservatively require reselecting artwork if its observation key changes. Preferences affect featured showcase/share presentation; canonical field-guide artwork is always labeled Original. Gallery items keep their canonical Squig reference and a separate optional Custom FK; only current owners may choose a Custom. Historical items revert to Original once no longer owned.

An Edition is a separate official catalog entry (`SquigEdition`), with optional reviewed chain/contract/token identity, documented supply, issue date and explicit many-to-many `SquigEditionRelation` character associations. No speculative artistic category taxonomy is imposed. Technical standards are NONE (catalog only), ERC721 and ERC1155. Chain references must be complete together and cannot reuse the Reloaded/zero contract. No Edition or Custom enters Reloaded discovery, trait or set denominators. Collection ruleset v1 is unchanged.

## Edition ownership

The read-only adapter supports reviewed VERIFIED Ethereum mainnet ERC721 `ownerOf` and ERC1155 `balanceOf`. It pins reads to a finalized block, checks deployed code/chain, rechecks the block hash and catalog revision, and records amount/block/hash/revision/time in `EditionOwnership`. It never accepts a client contract, ABI or arbitrary call, requests a signature, or sends a transaction. Linked verified wallets are checked on demand from Edition detail, with a per-Collector rate limit.

Observations expire after 15 minutes and are invalidated by catalog revision changes. Private profiles and featured-only/hidden full-collection settings suppress public Edition holdings. No observation means **ownership unavailable**, not “owns none.” Off-chain or unsupported-chain Editions remain browsable official catalog entries without ownership assertions. There is no fabricated Edition transfer history or discovery ledger; add those only after an authoritative deployment and historical adapter have been reviewed.

## Secure import, administration and export

Use `/admin/customs`, `/admin/editions` and `/admin/collectibles` with an allowlisted authenticated Discord admin. The forms support token search, create/edit, explicit verification/retirement, display order, artwork preview, relations and audit history. Origin checks, body limits and per-admin budgets apply. Web imports allow 10 records; CLI manifests allow 100 and 1 MB. Source/approval review is explicit, never derived from a social post or community submission.

```sh
npm run customs:import -- --file reviewed-customs.json
npm run editions:import -- --file reviewed-editions.json
npm run collectibles:verify
npm run collectibles:export -- --kind CUSTOM --file customs-export.json
npm run collectibles:export -- --kind EDITION --file editions-export.json
```

Version 1 JSON manifest shape:

```json
{
  "version": 1,
  "kind": "CUSTOM",
  "records": [
    {
      "key": "approved-stable-key",
      "tokenId": 3157,
      "name": "Approved official name",
      "imageUri": "ipfs://REPLACE_WITH_REVIEWED_IMMUTABLE_CID/artwork.png",
      "source": "Official approval record",
      "sourceReference": "REPLACE_WITH_REVIEWED_REFERENCE",
      "status": "DRAFT",
      "sortOrder": 0
    }
  ]
}
```

The placeholders are intentionally invalid; the example is not a claim that a Custom exists. Edition records use `slug` instead of `key`, omit the Reloaded `tokenId`, and may include `relatedTokens`, `supply` and `standard`. For on-chain Editions, `tokenId` is the Edition token's decimal string and `chainId`/`contractAddress` are required. Updates include the exported current `revision`. Export is an admin operation and contains official catalog fields plus revision, never Collector holdings, sessions, admin actor IDs or audit snapshots. It refuses to overwrite existing local files. JSON is the supported format; CSV is not implemented.

All keys/relations/dates/chain fields and **all artwork** validate before the catalog transaction. Invalid rows roll back the entire manifest. Identical replay skips rows without duplicate audit/Passport events. IPFS CID/path syntax excludes traversal, query strings, credentials and arbitrary hosts. Server fetches reconstruct one fixed HTTPS gateway, reject redirects, impose an 8-second timeout and 3 MB stream limit, accept PNG/JPEG MIME only and use Sharp to decode bounded 4096×4096 raster data. SVG, HTML, animation and malformed compressed content are rejected. A changed hash for an existing immutable URI fails closed. Social rendering revalidates the hash and falls back safely if the gateway fails.

No uploads or object-storage secret are necessary. Artwork is already durably pinned by the issuing source; never store production artwork on Railway's ephemeral disk. Public IPFS is not private submission storage. If uploads are added later, use durable object storage with a separate approval pipeline; do not weaken the URI/fetch boundary.

## Free personalization

`uglydex-cosmetics-v1` seeds 17 `CosmeticDefinition` records: Classic Ugly/Ugly Labs/Minimal themes; moss/bone/violet accents; achievement amber; classic/OG/Legendary/set frames; classic/laboratory/trophy gallery styles; clean/ugly/stats share styles. Sources are FREE, ACHIEVEMENT, SET, OG and LEGENDARY. There is no purchase, currency, minting or tradable entitlement.

`/settings/appearance` previews and saves `CollectorCosmeticPreference` choices. `CosmeticEntitlement` materializes eligible grants/revocations when choices are saved; **live eligibility remains authoritative**, never the materialized row alone. Earned accents require an active achievement with settled progression, set options require a currently complete enabled set with settled collection evaluation, and ownership frames require a currently owned OG/Legendary. Disabled catalog definitions, lost ownership and pending/removed evidence fall back immediately on read. Public clients get only selected safe enumerated configuration, not the underlying entitlement evidence.

Profile framing, gallery borders and share styles consume this safe configuration. CSS is fixed in the application and accent colors are a reviewed palette; arbitrary CSS, backgrounds, uploads and scriptable HTML are rejected. Custom/Edition artwork includes alt text and shares use the existing ratios, bundled font, rendering limits, fresh visibility checks and private/no-store response policy.

## Troubleshooting

- `EDIT_CONFLICT`: reload/export the current revision; do not overwrite another administrator's approval.
- `UNKNOWN_SQUIG`: import the canonical catalog first; do not create substitute token records.
- `INVALID_ARTWORK_RESPONSE`, hash mismatch or timeout: repair/pin the official asset and review it. Do not substitute an arbitrary URL or lower the validation limits.
- Missing Custom: check status, canonical token relation and current ownership. Draft/retired records are deliberately absent publicly.
- Missing Edition holding: check supported chain/standard, verified linked wallets, revision and observation age. Refresh on the detail page; catalog presence alone is not evidence.
- Cosmetic reverted: inspect actual ownership, pending jobs, revoked achievements/current sets or disabled definition. Do not grant a paid/manual bypass.
