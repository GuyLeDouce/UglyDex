import { expect, it, vi } from 'vitest';
import { collectionDiscoveries } from '../src/server/dex-engine';
import type { DerivedReadClient } from '../src/server/derived-verification';

it('keeps current discovery evidence stable when the observation is persisted', async () => {
  const at = new Date('2026-02-01T00:00:00Z');
  const recorded = vi.fn().mockResolvedValue([]);
  const tx = {
    squigDiscovery: { findMany: recorded },
    $queryRaw: vi
      .fn()
      .mockResolvedValue([
        { squigId: 's1', discoveredAt: at, sourceKey: 'ownerOf:100:s1' },
      ]),
  } as unknown as DerivedReadClient;
  const current = await collectionDiscoveries(tx, 'collector');
  recorded.mockResolvedValue([
    {
      squigId: 's1',
      discoveredAt: at,
      sourceKey: 'ownerOf:100:s1',
      firstOwnershipPeriod: null,
    },
  ]);
  expect(await collectionDiscoveries(tx, 'collector')).toEqual(current);
});

it('preserves an established historical ownership period over current possession', async () => {
  const tx = {
    squigDiscovery: {
      findMany: vi.fn().mockResolvedValue([
        {
          squigId: 's1',
          discoveredAt: new Date('2025-01-01T00:00:00Z'),
          sourceKey: 'original',
          firstOwnershipPeriod: 'verified-period',
        },
      ]),
    },
    $queryRaw: vi
      .fn()
      .mockResolvedValue([
        { squigId: 's1', discoveredAt: new Date(), sourceKey: 'rebuy' },
      ]),
  } as unknown as DerivedReadClient;
  expect(await collectionDiscoveries(tx, 'collector')).toEqual([
    {
      squigId: 's1',
      discoveredAt: new Date('2025-01-01T00:00:00Z'),
      firstOwnershipPeriod: 'verified-period',
    },
  ]);
});
