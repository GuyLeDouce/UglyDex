import 'server-only';
import { db } from './db';
import { progressionView } from './progression';
import { dexView } from './dex';
import { collectorAvatar } from './collector-avatar';
import { publicCollectorName, publicNameSelect } from './public-collector-name';
import {
  achievementTrophy,
  setTrophy,
  type TrophyCardData,
} from '@/domain/trophy-card';

export async function trophyAlbum(id: string, isPublic = false) {
  const c = await db().collector.findUnique({
    where: { id },
    select: { ...publicNameSelect, id: true, avatar: true, isPublic: true },
  });
  if (!c || (isPublic && !c.isPublic)) return null;
  const [p, d, avatar] = await Promise.all([
    progressionView('COLLECTOR', id, isPublic),
    dexView(id, isPublic),
    collectorAvatar(id, c.avatar),
  ]);
  const identity = {
    collector: publicCollectorName(c),
    avatarTokenId: avatar?.tokenId ?? null,
  };
  const cards: TrophyCardData[] = [
    ...(p?.status === 'ready'
      ? p.cards.flatMap((a) => {
          const card = achievementTrophy(a, identity);
          return card ? [card] : [];
        })
      : []),
    ...(d?.status === 'ready'
      ? d.holdingCards.flatMap((s) => {
          const card = setTrophy(s, identity);
          return card ? [card] : [];
        })
      : []),
  ];
  return {
    name: identity.collector,
    slug: c.slug,
    cards,
    pendingAchievements: p?.status !== 'ready',
    pendingSets: d?.status !== 'ready',
    level: p?.status === 'ready' ? p.level : null,
    xp: p?.status === 'ready' ? p.xp : null,
    locked:
      p?.status === 'ready'
        ? p.cards
            .filter((a) => !a.unlocked)
            .map((a) => ({
              key: a.key,
              name: a.name,
              description: a.description,
              tier: a.tier,
              progress: a.progress,
              threshold: a.threshold,
              blocked: a.blocked,
            }))
        : [],
  };
}
