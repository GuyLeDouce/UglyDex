import 'server-only';
import { db } from './db';
import { catalogScope, collectionAddresses, ownedScope } from './collections';

export function avatarSquigId(value: string | null) {
  const match = value?.match(
    /^https:\/\/squigs\.io\/images\/images\/(\d+)\.png$/,
  );
  return match ? Number(match[1]) : null;
}
export function squigAvatarUrl(tokenId: number) {
  return `https://squigs.io/images/images/${tokenId}.png`;
}
export async function collectorAvatar(
  collectorId: string,
  avatar: string | null,
) {
  const addresses = await collectionAddresses(collectorId);
  const selected = avatarSquigId(avatar);
  const where = { AND: [catalogScope, ownedScope(addresses)] };
  if (
    selected &&
    (await db().squig.count({ where: { ...where, tokenId: selected } }))
  ) {
    return { tokenId: selected, url: squigAvatarUrl(selected) };
  }
  const best = await db().squig.findFirst({
    where,
    orderBy: [{ mawRank: { sort: 'asc', nulls: 'last' } }, { tokenId: 'asc' }],
    select: { tokenId: true },
  });
  return best
    ? { tokenId: best.tokenId, url: squigAvatarUrl(best.tokenId) }
    : null;
}
