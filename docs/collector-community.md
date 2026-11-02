# Collector community and presentation

The header logo has no button background, border or shadow. Account and mobile
menus close after a link/button is activated; Escape closes the active menu.
Top Collectors sits beside Editions in desktop navigation and in the mobile menu.

Squig card trait tags use canonical collection frequency, rarest first, with a
stable trait-name tie-break. Unknown traits sort last; blank/None tags are omitted.
The listed-only Explore view supports asking price, UglyPoints and Maw Rank in
both directions. Sorting precedes pagination and missing stats sort last.

Squig detail ownership dates come from the open, chain-derived wallet holding
period only when provenance is complete and clean. Discovery and observation
dates are never substituted. Missing history has an explicit empty state.
Chain of custody follows Ecosystem field notes. Public profile badge strips show
the three latest earned badges, retaining the total overflow count.

## Collector thread

The landing page and My UglyDex show the latest six earned sharing cards. `/thread`
provides older pages. Cards appear automatically from existing achievement/set
projections on the next page load; no publish action or new event table is needed.
The HTML preview uses the public Sharing DTO and shared badge components. The existing
Sharing page and image-download renderer remain available when a card is opened.
Browsing the feed does not generate PNGs or consume image-render capacity.

`Collector.showCommunityActivity` is a new Boolean preference, default true.
The additive migration adds this one field. Profile settings can turn it off;
omitting it from older clients' save requests preserves the current value.
Private and merged profiles never appear. Pending/rebuilding projections,
revoked achievements and incomplete sets are excluded. Hidden achievement/set
details only appear when the existing sharing rules permit the earned item.
Turning this off removes entries from subsequent thread reads; existing explicit
public sharing links retain their existing semantics.

## Top Collectors

`/collectors` includes public, unmerged collectors and unclaimed wallets holding
at least one canonical Squig. Current holdings use the same ownership evidence as
the displayed held count; historical discoveries alone do not qualify. This
filter runs before ranking, totals and pagination. Selling the last Squig removes
the entry; acquiring another restores eligibility on the next indexed page read.
Profiles and historical records remain intact.

Claimed collectors use `CollectionSnapshot.overall`; unclaimed wallets use their
observed wallet Field Guide score and remain clearly labeled. Updating profiles
with current holdings remain visible. Equal scores share a dense rank, with
stable slug tie-breaking and 24 profiles per page. Private and blocked profiles
stay hidden. Thread opt-out is independent of leaderboard eligibility.

No XP, achievement qualification, collection-completion, chain indexing or
provenance verification rules change. Production needs existing indexers to
populate ownership and progression data before those results can be displayed.
