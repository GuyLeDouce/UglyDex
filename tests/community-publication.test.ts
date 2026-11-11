import { expect, it, vi } from 'vitest';
import {
  publicationBaseline,
  publishCommunityCard,
} from '../src/server/community-publication';
import type { Prisma } from '../src/generated/prisma/client';
const at = (year: number) => new Date(`${year}-01-01`);
function fixture(overrides = {}) {
  const collector = {
    claimedAt: at(2020),
    onboardingCompletedAt: at(2020),
    communityFeedSince: at(2026),
    isPublic: true,
    showCommunityActivity: true,
    mergedIntoCollectorId: null,
    wallets: [{ firstSeenAt: at(2020) }],
    identities: [],
    ...overrides,
  };
  const create = vi.fn();
  const tx = {
    collector: { findUniqueOrThrow: vi.fn().mockResolvedValue(collector) },
    communityFeedEvent: { upsert: create },
  } as unknown as Prisma.TransactionClient;
  return { tx, create };
}
it('requires an established account and prior projection', async () => {
  const { tx } = fixture();
  expect(await publicationBaseline(tx, 'id', null)).toBeNull();
  expect(
    await publicationBaseline(fixture({ claimedAt: null }).tx, 'id', at(2025)),
  ).toBeNull();
  expect(
    await publicationBaseline(fixture({ isPublic: false }).tx, 'id', at(2025)),
  ).toBeNull();
  expect(await publicationBaseline(tx, 'id', at(2025))).toEqual(at(2026));
});
it('silences the first calculation after profile setup or a new wallet/identity link', async () => {
  expect(
    await publicationBaseline(
      fixture({ wallets: [{ firstSeenAt: at(2027) }] }).tx,
      'id',
      at(2025),
    ),
  ).toBeNull();
  expect(
    await publicationBaseline(
      fixture({ identities: [{ linkedAt: at(2027) }] }).tx,
      'id',
      at(2025),
    ),
  ).toBeNull();
  expect(
    await publicationBaseline(
      fixture({ onboardingCompletedAt: at(2027) }).tx,
      'id',
      at(2025),
    ),
  ).toBeNull();
  expect(
    await publicationBaseline(
      fixture({ wallets: [{ firstSeenAt: at(2027) }] }).tx,
      'id',
      at(2028),
    ),
  ).toEqual(at(2027));
});
it('retains the original announcement on repeat imports and recalculations', async () => {
  const { tx, create } = fixture();
  await publishCommunityCard(tx, 'id', 'set', 'set-key', at(2027));
  expect(create).toHaveBeenCalledWith({
    where: {
      collectorId_kind_key: { collectorId: 'id', kind: 'set', key: 'set-key' },
    },
    create: { collectorId: 'id', kind: 'set', key: 'set-key', at: at(2027) },
    update: {},
  });
});
