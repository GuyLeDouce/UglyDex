# Physical device and external share validation

## Phase 10 execution status

On 2026-09-27 UTC, staging and production public origins and Discord credentials are configured. A staging HTTP probe verified the Discord authorization redirect, exact callback, state, S256 PKCE and Secure/HttpOnly cookie; an invalid callback returns 400. No real consent/token exchange or wallet session was completed. A Twitterbot user-agent probe received public Squig metadata and a PNG, but no actual third-party preview or public-to-private transition was certified. Physical iPhone/Android and interactive desktop rows below remain PENDING. The in-app browser tool failed before opening a session. See [phase10-report.md](phase10-report.md).

The owner reports Brave + MetaMask message signing and session persistence after reload on the live deployment. OS/device/browser version were not supplied; other wallet flows and native sharing remain PENDING. Local Playwright Chromium viewport assertions are separate evidence and cannot certify Safari, Edge, mobile wallets or native share sheets.

| Device / OS             | Browser / version           | Release / date           | Result  | Issue / evidence                                                                          |
| ----------------------- | --------------------------- | ------------------------ | ------- | ----------------------------------------------------------------------------------------- |
| iPhone / pending        | Safari / pending            | pending                  | PENDING | No physical device session                                                                |
| Android / pending       | Chrome / pending            | pending                  | PENDING | No physical device session                                                                |
| Desktop / pending       | Chrome / pending            | pending                  | PENDING | No interactive production session                                                         |
| Desktop / pending       | Edge / pending              | pending                  | PENDING | No interactive production session                                                         |
| Device / OS unspecified | Brave / version unspecified | c764e28 / 2026-09-27 UTC | PARTIAL | Owner tested MetaMask signature login and persistence after reload; slow loading reported |

For each row record exact hardware, OS/browser version, SHA, URL, UTC time and issue references. Test homepage, 360px/zoom navigation, collection/explorer filters, Squig Original/Custom selection, Edition history, gallery create/reorder/captions/visibility and keyboard focus. Test private transitions in a separate anonymous browser.

Wallet support is the implemented injected EIP-1193/EOA signature flow. Do not claim WalletConnect or unsupported wallet-provider support. Check provider absent, signature rejection and retry, accepted nonce/signature, consumed nonce replay, account change, network mismatch, unlink and multiple wallets. In a mobile wallet browser test its actual injected provider; ordinary Safari/Chrome may have no provider. No transaction should be requested. Record unsupported routes as such rather than silently substituting another wallet.

Complete/cancel Discord OAuth, test session persistence/logout, reject mismatched state and confirm exact callback origin. Use a reviewed admin account for denial/allowlist checks; never store credentials in test artifacts.

For sharing: copy link; native Web Share when available; cancel; prepare PNG then share under a fresh gesture; download/save PNG to Photos/Files; square/landscape preview; long names; artwork gateway failure; offline recovery. Test profile, gallery, Squig, Custom, set, achievement and completion cards. Inspect readability and absence of hidden wallet/Discord identity.

## External Open Graph checks — all PENDING

Use deployed public URLs in appropriate platform preview tools/manual share drafts. Record platform/tool, URL, fetch time, card title/description/image, status and screenshot. Include Collector, Squig, set, public and unlisted gallery, completion and achievement. Do not automate posting.

Then make the reviewed test profile/gallery private or retire a Custom. The origin must immediately return generic/denied projections and no-index where applicable; fetch the old image URL directly to confirm authorization is rechecked. Separately record whether the external platform retains its cached preview, and request re-scrape/purge where available. Third-party caches are outside UglyDex control; never claim that prior social copies disappear.

Authenticated real-device checks, known-private URL smoke fixtures and external crawler results remain PENDING until supplied through an approved operator session. No secret URLs, sessions or wallet signatures belong in committed evidence.

## Phase 9

Phase 9 REAL_DEVICE_SHARE and EXTERNAL_OG gates remain PENDING. Actual operator evidence is required; browser automation does not certify a physical phone, mobile wallet, native share sheet or external crawler. All existing manual matrix results remain unchanged.

## Phase 11 checkpoint — 2026-09-27 UTC

See the [actual Phase 11 report](phase11-report.md) and [reader provisioning/access walkthrough](operator/phase11-readers/README.md). Historical Phase 10 evidence above is retained. Staging runs `0687d01`; production remains `c764e28`. Source readers were provisioned with explicit authorization, but public TLS and Gauntlet schema issues remain. RPC retries preserved the existing incomplete cursor. No production replay, populated restore, LIVE worker rollout, physical-device certification or gate-approved launch was claimed. Current gate counts and revision-binding limitations are in the report.
