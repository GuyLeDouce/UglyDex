# Collector support

`/admin` lists connected profiles, including private profiles and their linked Ethereum wallets, Discord IDs and the configured realm's DRIP ID. Search by any of these identifiers and filter manual support status. ERROR and UPDATING expand to show private support notes. These flags are not automatic sync health indicators.

All admin pages and mutations require a session established by Discord OAuth for exactly one owner ID, plus that authenticated identity still linked to the session's collector. Wallet sessions, legacy sessions without proof, another Discord account linked to the same collector, and development-mode bypasses are denied.

Set `ADMIN_OWNER_DISCORD_ID` to the owner's numeric Discord ID. If absent, exactly one distinct ID in existing `ADMIN_DISCORD_IDS` is accepted for backward compatibility. Empty or multiple legacy IDs fail closed. Confirm the owner ID before rollout. Sign in through Discord again if the current session was established with a wallet.

Edits require a reason, same-origin requests, rate limiting, current profile/identity revision, and an atomic audit record containing before/after values. Conflicting usernames, wallet credentials, Discord identities and DRIP identities are rejected. The owner Discord credential cannot be reassigned or removed. Identity corrections revoke the affected collector's sessions, outstanding challenges and pending merges.

Removing a wallet revokes its credential and closes current attribution periods without erasing history. Adding a wallet is an explicit administrative identity grant dated to the correction; confirm it against the support case. Existing credentials belonging to another profile cannot be transferred here. A new Discord ID is not marked OAuth-authenticated: the holder signs in with a wallet and authenticates the corrected Discord account. DRIP corrections clear cached balances and await verification through the existing DRIP link/sync flow; they do not modify UglyBot, The Gauntlet, or the upstream DRIP account.

Validation: owner authentication unit tests, migration packaging checks, and database/HTTP integration cases in the isolated identity test runner. The latter also exercises existing onboarding and collector identity behavior.
