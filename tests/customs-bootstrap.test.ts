import { beforeEach, expect, it, vi } from 'vitest';
import { collectibleManifest } from '@/domain/collectibles';
import { SQUIGS_CUSTOMS_CONTRACT } from '@/domain/customs-collection';
const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  importCollectibles: vi.fn(),
}));
vi.mock('@/server/db', () => ({
  db: () => ({ squigEdition: { findMany: mocks.findMany } }),
}));
vi.mock('@/server/collectibles', () => ({
  importCollectibles: mocks.importCollectibles,
}));
import {
  importInitialCustoms,
  initialCustoms,
} from '@/server/customs-bootstrap';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([]);
  mocks.importCollectibles.mockResolvedValue({
    created: 2,
    updated: 0,
    unchanged: 0,
  });
});
it('imports original token IDs 1 and 4 with valid ERC1155 metadata', async () => {
  await importInitialCustoms();
  const manifest = collectibleManifest.parse(
    mocks.importCollectibles.mock.calls[0][0],
  );
  expect(manifest.kind).toBe('EDITION');
  expect(manifest.records.map((r) => 'tokenId' in r && r.tokenId)).toEqual([
    '1',
    '4',
  ]);
  expect(
    manifest.records.every(
      (r) => r.status === 'VERIFIED' && r.imageUri.startsWith('ipfs://'),
    ),
  ).toBe(true);
});
it('skips existing tokens even under a renamed slug, preserving editorial state', async () => {
  mocks.findMany.mockResolvedValue(
    initialCustoms.map((r) => ({
      ...r,
      slug: 'renamed-' + r.tokenId,
      chainId: 1,
      contractAddress: SQUIGS_CUSTOMS_CONTRACT,
    })),
  );
  await importInitialCustoms();
  expect(mocks.importCollectibles).not.toHaveBeenCalled();
});
it('only imports the missing token', async () => {
  mocks.findMany.mockResolvedValue([
    {
      slug: 'squigs-custom-1',
      tokenId: '1',
      chainId: 1,
      contractAddress: SQUIGS_CUSTOMS_CONTRACT,
    },
  ]);
  await importInitialCustoms();
  expect(
    mocks.importCollectibles.mock.calls[0][0].records.map(
      (r: { tokenId: string }) => r.tokenId,
    ),
  ).toEqual(['4']);
});
it('rejects a conflicting slug without overwriting its record', async () => {
  mocks.findMany.mockResolvedValue([
    {
      slug: 'squigs-custom-1',
      tokenId: '99',
      chainId: 1,
      contractAddress: SQUIGS_CUSTOMS_CONTRACT,
    },
  ]);
  await expect(importInitialCustoms()).rejects.toThrow(
    'CUSTOMS_CATALOG_CONFLICT',
  );
  expect(mocks.importCollectibles).not.toHaveBeenCalled();
});
it('propagates artwork validation failures so deployment cannot claim a completed import', async () => {
  mocks.importCollectibles.mockRejectedValue(
    new Error('INVALID_ARTWORK_SIGNATURE'),
  );
  await expect(importInitialCustoms()).rejects.toThrow(
    'INVALID_ARTWORK_SIGNATURE',
  );
});
