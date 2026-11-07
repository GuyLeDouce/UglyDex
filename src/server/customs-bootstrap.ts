import 'server-only';
import { db } from './db';
import { importCollectibles } from './collectibles';
import { SQUIGS_CUSTOMS_CONTRACT } from '@/domain/customs-collection';

// Reviewed from the owner's collection and its original IPFS metadata.
// Custom #2 is token 4, not token 2. Never infer token IDs from display names.
export const initialCustoms = [
  {
    slug: 'squigs-custom-1',
    tokenId: '1',
    name: 'Squigs Custom #1',
    description:
      'Samurai Panduh Squig. A custom 1/1 created for its commissioning collector.',
    imageUri:
      'ipfs://bafybeidaza62gccnyufqixwiu5yztinkqunwkdkixbonzaic2m7uqrwzvm',
    sourceReference: 'ipfs://QmQy6zbzy4RdVYuRrqr8uWX4FZkvSwZBmSYN5jYtuKUVNS/1',
  },
  {
    slug: 'squigs-custom-2',
    tokenId: '4',
    name: 'Squigs Custom #2',
    description:
      'Mysterious Bun. A custom 1/1 created for its commissioning collector.',
    imageUri:
      'ipfs://bafybeiaiit342kje56ufzwcobbvv745fuzqzvghdfzh7moihpwqzywznja',
    sourceReference:
      'ipfs://bafybeibdeyrgnnh6immlmqrvv7zjnmjihyxesg4p5yjg6kdsr5tq4nn5vq/4',
  },
] as const;

export async function importInitialCustoms() {
  const existing = await db().squigEdition.findMany({
    where: {
      OR: [
        { slug: { in: initialCustoms.map((r) => r.slug) } },
        {
          chainId: 1,
          contractAddress: SQUIGS_CUSTOMS_CONTRACT,
          tokenId: { in: initialCustoms.map((r) => r.tokenId) },
        },
      ],
    },
    select: { slug: true, chainId: true, contractAddress: true, tokenId: true },
  });
  const missing = initialCustoms.filter((record) => {
    const collision = existing.find((row) => row.slug === record.slug);
    if (
      collision &&
      (collision.chainId !== 1 ||
        collision.contractAddress !== SQUIGS_CUSTOMS_CONTRACT ||
        collision.tokenId !== record.tokenId)
    )
      throw new Error('CUSTOMS_CATALOG_CONFLICT');
    // Keep later editorial changes, retirement, and ownership records intact.
    return !existing.some(
      (row) =>
        row.chainId === 1 &&
        row.contractAddress === SQUIGS_CUSTOMS_CONTRACT &&
        row.tokenId === record.tokenId,
    );
  });
  if (!missing.length) return { created: 0, updated: 0, unchanged: 2 };
  // Existing importer validates and decodes both artworks, computes their hashes,
  // and writes catalog records plus audit history in one transaction.
  return importCollectibles(
    {
      version: 1,
      kind: 'EDITION',
      records: missing.map((record) => ({
        ...record,
        source: 'SQUIGS_CUSTOMS_METADATA',
        status: 'VERIFIED',
        standard: 'ERC1155',
        chainId: 1,
        contractAddress: SQUIGS_CUSTOMS_CONTRACT,
        supply: 1,
        relatedTokens: [],
      })),
    },
    'release:initial-squigs-customs',
  );
}
