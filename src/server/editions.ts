import 'server-only';
import { parseAbi, type Address } from 'viem';
import { db } from './db';
import { rpc } from '@/integrations/blockchain';
import { collectibleImageUrl } from '@/domain/collectibles';
import { activeAddresses } from './collections';
const editionAbi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner,uint256 id) view returns (uint256)',
]);
const freshAfter = () => new Date(Date.now() - 15 * 60000);
export async function recentEditionOwnershipCount() {
  return db().editionOwnership.count({
    where: { verifiedAt: { gt: freshAfter() }, amount: { not: '0' } },
  });
}
const editionSelect = {
  slug: true,
  name: true,
  description: true,
  artist: true,
  issuedAt: true,
  supply: true,
  standard: true,
  chainId: true,
  contractAddress: true,
  tokenId: true,
  verifiedAt: true,
  artwork: { select: { uri: true } },
  relations: {
    select: { relationType: true, squig: { select: { tokenId: true } } },
  },
} as const;
type EditionRow = NonNullable<Awaited<ReturnType<typeof findEdition>>>;
const findEdition = (slug: string) =>
  db().squigEdition.findFirst({
    where: { slug, status: 'VERIFIED' },
    select: editionSelect,
  });
const dto = (e: EditionRow) => ({
  slug: e.slug,
  name: e.name,
  description: e.description,
  artist: e.artist,
  issuedAt: e.issuedAt?.toISOString() ?? null,
  supply: e.supply,
  standard: e.standard,
  chainId: e.chainId,
  contractAddress: e.contractAddress,
  tokenId: e.tokenId,
  verifiedAt: e.verifiedAt?.toISOString() ?? null,
  image: collectibleImageUrl(e.artwork.uri),
  relatedTokens: e.relations.map((r) => r.squig.tokenId).sort((a, b) => a - b),
});
export async function editionCatalog(page = 1) {
  const total = await db().squigEdition.count({
    where: { status: 'VERIFIED' },
  });
  const current = Math.min(
    Math.max(1, page),
    Math.max(1, Math.ceil(total / 24)),
  );
  const rows = await db().squigEdition.findMany({
    where: { status: 'VERIFIED' },
    orderBy: [{ issuedAt: 'desc' }, { slug: 'asc' }],
    take: 24,
    skip: (current - 1) * 24,
    select: editionSelect,
  });
  return {
    items: rows.map(dto),
    total,
    page: current,
    pages: Math.max(1, Math.ceil(total / 24)),
  };
}
export async function editionDetail(slug: string) {
  const e = await findEdition(slug);
  return e ? dto(e) : null;
}

// Fixed view-only ABI, reviewed catalog targets, Ethereum only. No write client exists.
export async function refreshEditionOwnership(
  slug: string,
  collectorId: string,
  client = rpc(),
) {
  const e = await db().squigEdition.findFirst({
    where: { slug, status: 'VERIFIED' },
  });
  if (
    !e ||
    e.chainId !== 1 ||
    !e.contractAddress ||
    e.tokenId === null ||
    !['ERC721', 'ERC1155'].includes(e.standard)
  )
    throw new Error('EDITION_OWNERSHIP_UNAVAILABLE');
  const wallets = await activeAddresses(collectorId);
  if (!wallets.length || wallets.length > 20)
    throw new Error('VERIFIED_WALLET_REQUIRED');
  if ((await client.getChainId()) !== 1) throw new Error('WRONG_CHAIN');
  const block = await client.getBlock({ blockTag: 'finalized' });
  const code = await client.getCode({
    address: e.contractAddress as Address,
    blockNumber: block.number,
  });
  if (!code || code === '0x') throw new Error('EDITION_CONTRACT_UNAVAILABLE');
  const amounts = new Map<string, string>();
  if (e.standard === 'ERC721') {
    const owner = await client.readContract({
      address: e.contractAddress as Address,
      abi: editionAbi,
      functionName: 'ownerOf',
      args: [BigInt(e.tokenId)],
      blockNumber: block.number,
    });
    for (const wallet of wallets)
      amounts.set(wallet, owner.toLowerCase() === wallet ? '1' : '0');
  } else
    for (const wallet of wallets) {
      const amount = await client.readContract({
        address: e.contractAddress as Address,
        abi: editionAbi,
        functionName: 'balanceOf',
        args: [wallet as Address, BigInt(e.tokenId)],
        blockNumber: block.number,
      });
      amounts.set(wallet, amount.toString());
    }
  if (
    (await client.getBlock({ blockNumber: block.number })).hash !== block.hash
  )
    throw new Error('EDITION_BLOCK_CHANGED');
  await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'edition:' + e.id},0))`;
    const current = await tx.squigEdition.findUniqueOrThrow({
      where: { id: e.id },
    });
    if (current.revision !== e.revision || current.status !== 'VERIFIED')
      throw new Error('EDITION_CHANGED');
    const latest = await tx.editionOwnership.findFirst({
      where: { editionId: e.id },
      orderBy: { blockNumber: 'desc' },
    });
    if (latest && latest.blockNumber > block.number)
      throw new Error('EDITION_STALE_BLOCK');
    if (e.standard === 'ERC721')
      await tx.editionOwnership.updateMany({
        where: { editionId: e.id },
        data: {
          amount: '0',
          blockNumber: block.number,
          blockHash: block.hash,
          verifiedAt: new Date(),
          editionRevision: e.revision,
        },
      });
    for (const [walletAddress, amount] of amounts) {
      const data = {
        amount,
        blockNumber: block.number,
        blockHash: block.hash,
        editionRevision: e.revision,
        verifiedAt: new Date(),
      };
      await tx.editionOwnership.upsert({
        where: { editionId_walletAddress: { editionId: e.id, walletAddress } },
        create: { editionId: e.id, walletAddress, ...data },
        update: data,
      });
    }
  });
  return { checked: wallets.length, block: block.number.toString() };
}
export async function ownedEditions(collectorId: string, publicView = false) {
  if (
    publicView &&
    !(await db().collector.findFirst({
      where: { id: collectorId, isPublic: true, collectionVisibility: 'FULL' },
      select: { id: true },
    }))
  )
    return [];
  const rows = await db().squigEdition.findMany({
    where: {
      status: 'VERIFIED',
      chainId: 1,
      ownership: {
        some: {
          walletAddress: { in: await activeAddresses(collectorId) },
          verifiedAt: { gt: freshAfter() },
          amount: { not: '0' },
        },
      },
    },
    select: {
      ...editionSelect,
      revision: true,
      ownership: {
        where: {
          walletAddress: { in: await activeAddresses(collectorId) },
          verifiedAt: { gt: freshAfter() },
          amount: { not: '0' },
        },
        select: { amount: true, editionRevision: true, verifiedAt: true },
      },
    },
    orderBy: { slug: 'asc' },
    take: 100,
  });
  return rows.flatMap((e) => {
    const valid = e.ownership.filter((o) => o.editionRevision === e.revision);
    return valid.length
      ? [
          {
            ...dto(e),
            amount: valid.reduce((n, o) => n + BigInt(o.amount), 0n).toString(),
            checkedAt: valid
              .reduce(
                (a, o) => (a < o.verifiedAt ? a : o.verifiedAt),
                valid[0].verifiedAt,
              )
              .toISOString(),
          },
        ]
      : [];
  });
}
