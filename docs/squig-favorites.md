# Squig favorites

Collectors select hearts on owned Squig cards in `/collection` and their `/me` standouts. The selected heart is pressed, keyboard accessible and at least 44px. Saves show a pending state, prevent repeated clicks within the grid, report failures, and synchronize other editable grids. Up to six currently owned Squigs can be selected across active verified wallets.

Reuse `Collector.featuredTokenIds`: existing featured selections remain favorites, and the profile form edits the same list. No migration or backfill. Favorites are shown on the public profile, above the full public collection, and on collector share cards (up to six). Existing featured/favorites share presets reuse this list. Public collection HIDDEN suppresses favorites; private profiles remain private. Read-only public cards have a heart marker and never edit the viewer's choices.

`POST /api/settings/favorites` accepts only `{tokenId, favorite}`. It requires a session, same-origin request and rate limit. The collector comes from the session, never the payload. A transaction and collector advisory lock (shared with profile/wallet settings) serialize concurrent selections; a seventh favorite is rejected. Requests are idempotent, stale sold selections are pruned during mutation, and unowned additions are rejected. Public projections recheck canonical current ownership on every read so sold or unlinked tokens are not shown as current favorites. A stored selection can return if reacquired before a subsequent edit prunes it. Incomplete transfer reconstruction does not suppress valid current ownership.

No credentials or private external identifiers are returned. Share image cache keys include the projected favorites, so changing the selection generates a new image; social platforms may independently cache their previews.

Validation covers API authentication/origin/rate limits and errors, plus isolated database fixtures for concurrent six-item limits, idempotency, unowned rejection, profile/share consistency, hidden collection privacy and sales. Roll out through the normal staging PR deployment. Reverting restores the old featured-token settings UI; selections remain compatible and are not deleted. No production deployment was executed.

## October 31 browsing improvements

The private dashboard shows all current favorites immediately after Field Guide
completion, before secondary ecosystem details. `/collection?favorites=1` filters
to the authenticated viewer's currently owned favorites; the same control is
available alongside personal Field Guide filters in the discovery catalog.
Anonymous favorite requests return an empty result. Filters preserve existing
pagination, trait, OG, Legendary and sort controls. A sold favorite disappears
from the filtered view through the same ownership check used by sharing.
