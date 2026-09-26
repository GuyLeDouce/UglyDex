# Public presentation privacy

Phase 7's public Custom and Edition DTOs exclude approval references, admin actor IDs, audit snapshots and ownership wallet addresses. Draft/retired records are omitted; public Custom status is rechecked after rendering. Public Edition ownership requires a public profile, FULL collection visibility, active verified wallets, current catalog revision and recent read-only evidence. Missing/stale evidence means unavailable. Community submissions are not official Customs.

Public appearance contains only enumerated theme/accent/frame/gallery/share selections; entitlement evidence stays internal. A private profile never becomes public by selecting a theme. Operational dashboards and mutation/export APIs require existing admin authorization. Readiness error payloads contain no schema or secret details. Admin-only catalog exports omit Collector holdings and audit actor IDs. Share artwork now accepts server-projected verified IPFS URI/hash pairs as well as canonical token artwork, never client-supplied URLs.

UglyDex profiles are opt-in. Wallet and Discord visibility remain independently consented. Full current collection, featured-only and hidden collection modes control collection display; published galleries are separate explicit selections. A private profile overrides gallery visibility. Unlisted is a direct-link visibility choice, not a password or secrecy guarantee.

Share rendering uses explicit public projections, validates source eligibility on each request, suppresses pending/revoked earned claims, and excludes credentials, private identities, evidence and moderation records. Owner previews require authentication. Public URLs cannot retrieve private previews. Captions are plain React text, never HTML. Artwork fetches accept canonical token IDs or server-projected verified immutable assets. No cross-site tracker is installed.

Privacy changes revoke future UglyDex preview requests, including process-cache hits. Previously downloaded or socially cached images are outside UglyDex control. See [sharing](sharing.md) for the complete access/caching policy.
