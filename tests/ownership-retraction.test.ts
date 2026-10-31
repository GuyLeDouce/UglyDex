import { expect, it, vi } from 'vitest';
import type { Prisma } from '../src/generated/prisma/client';
import { rewindFrom } from '../src/sync/transfers';

it('retracts direct and post-link discoveries sourced from removed observations', async () => {
  const invalidate = vi.fn();
  const tx = {
    $executeRaw: vi.fn(),
    nftTransfer: {
      findMany: vi.fn().mockResolvedValue([{ squigId: 's1' }]),
      deleteMany: vi.fn(),
    },
    chainBlock: { deleteMany: vi.fn() },
    squigOwnership: {
      findMany: vi
        .fn()
        .mockResolvedValueOnce([{ squigId: 's1' }])
        .mockResolvedValueOnce([{ sourceKey: 'snapshot:1' }]),
      deleteMany: vi.fn(),
    },
    squigDiscovery: { updateMany: invalidate },
    squigPassportEvent: { deleteMany: vi.fn() },
    squigProvenance: { updateMany: vi.fn() },
    ownershipRefresh: { updateMany: vi.fn() },
  };
  expect(
    await rewindFrom(tx as unknown as Prisma.TransactionClient, 100n),
  ).toBe(1);
  expect(invalidate).toHaveBeenCalledWith({
    where: {
      sourceKey: { in: ['snapshot:1', 'linked:snapshot:1'] },
      attributionStatus: 'OBSERVED',
    },
    data: { everOwned: false, attributionStatus: 'INVALIDATED' },
  });
  // Retraction preserves the discovery record and does not blanket-invalidate confirmed attribution.
  expect(tx.squigOwnership.deleteMany).toHaveBeenCalledWith({
    where: { blockNumber: { gte: 100n } },
  });
});
