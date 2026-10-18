import 'server-only';
import { db } from './db';
import { catalogScope, cardSelect, cardsWithBadges } from './collections';
import { collectionOrder } from '@/domain/collection';
import {
  isListingSort,
  sortedListings,
  type ListingSort,
  type OpenSeaListings,
} from '@/domain/opensea';

export type ListedSort =
  ListingSort | 'points-desc' | 'points-asc' | 'rank' | 'rank-desc';
export async function listedSquigPage(
  market: OpenSeaListings,
  sort: ListedSort,
  page = 1,
) {
  const listed = market.status === 'available' ? market.listings : [];
  const where = {
    ...catalogScope,
    tokenId: { in: listed.map((l) => l.tokenId) },
  };
  // Read lightweight IDs in global order before slicing, including nulls last.
  const candidates = await db().squig.findMany({
    where,
    orderBy: collectionOrder(sort),
    select: { tokenId: true },
  });
  const known = new Set(candidates.map((s) => s.tokenId));
  const ordered = isListingSort(sort)
    ? sortedListings(listed, sort).filter((l) => known.has(l.tokenId))
    : candidates;
  const pages = Math.max(1, Math.ceil(ordered.length / 24));
  page = Math.min(Math.max(1, page), pages);
  const ids = ordered.slice((page - 1) * 24, page * 24).map((s) => s.tokenId);
  const cards = await cardsWithBadges(
    await db().squig.findMany({
      where: { ...catalogScope, tokenId: { in: ids } },
      select: cardSelect,
    }),
  );
  const byToken = new Map(cards.map((c) => [c.tokenId, c]));
  return {
    page,
    pages,
    total: ordered.length,
    items: ids.flatMap((id) => {
      const card = byToken.get(id);
      return card ? [card] : [];
    }),
  };
}
