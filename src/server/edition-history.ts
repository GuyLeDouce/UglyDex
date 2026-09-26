import 'server-only';
import { db } from './db';
import { activeAddresses } from './collections';
import { zero } from '@/domain/edition-history';
export async function editionHistory(slug: string) {
  const edition = await db().squigEdition.findFirst({
    where: { slug, status: 'VERIFIED' },
    select: { chainId: true, contractAddress: true, tokenId: true },
  });
  if (!edition?.contractAddress || edition.tokenId === null) return null;
  const c = await db().editionContract.findUnique({
    where: { id: `${edition.chainId}:${edition.contractAddress}` },
  });
  if (c?.status !== 'VERIFIED' || !c.tokenIds.includes(edition.tokenId))
    return null;
  const [events, total] = await Promise.all([
    db().editionTransfer.findMany({
      where: { contractId: c.id, tokenId: edition.tokenId },
      orderBy: [
        { blockNumber: 'desc' },
        { logIndex: 'desc' },
        { batchIndex: 'desc' },
      ],
      take: 50,
      select: {
        id: true,
        fromAddress: true,
        toAddress: true,
        quantity: true,
        eventAt: true,
        blockNumber: true,
      },
    }),
    db().editionTransfer.count({
      where: { contractId: c.id, tokenId: edition.tokenId },
    }),
  ]);
  // Do not publish wallet addresses or infer Collector identity from current wallet links.
  return {
    complete:
      !c.errorCode && c.cursor !== null && c.cursor === c.finalizedBlock,
    through: c.cursor?.toString() ?? null,
    total,
    events: events.map((e) => ({
      id: e.id,
      kind:
        e.fromAddress === zero
          ? 'Minted'
          : e.toAddress === zero
            ? 'Burned'
            : 'Transferred',
      quantity: e.quantity,
      at: e.eventAt.toISOString(),
      block: e.blockNumber.toString(),
    })),
  };
}
export async function collectorEditionHistory(collectorId: string) {
  const wallets = await activeAddresses(collectorId);
  const attributions = await db().historicalIdentityAttribution.findMany({
    where: { collectorId, status: 'CONFIRMED' },
    select: { walletAddress: true, effectiveFrom: true, effectiveTo: true },
  });
  const contracts = await db().editionContract.findMany({
    where: { status: 'VERIFIED' },
    take: 100,
  });
  const editions = await db().squigEdition.findMany({
    where: {
      status: 'VERIFIED',
      chainId: 1,
      contractAddress: { in: contracts.map((c) => c.address) },
    },
    select: { slug: true, name: true, contractAddress: true, tokenId: true },
    take: 100,
  });
  const allAcquired = attributions.length
    ? await db().editionTransfer.findMany({
        where: {
          contractId: { in: contracts.map((c) => c.id) },
          quantity: { not: '0' },
          OR: attributions.map((a) => ({
            toAddress: a.walletAddress,
            eventAt: {
              gte: a.effectiveFrom,
              ...(a.effectiveTo ? { lt: a.effectiveTo } : {}),
            },
          })),
        },
        orderBy: { eventAt: 'asc' },
        take: 10001,
        select: { eventAt: true, contractId: true, tokenId: true },
      })
    : [];
  const allBalances = await db().editionBalance.findMany({
    where: {
      contractId: { in: contracts.map((c) => c.id) },
      walletAddress: { in: wallets },
    },
    take: 10001,
  });
  if (allAcquired.length > 10000 || allBalances.length > 10000) return [];
  const result = [];
  for (const e of editions) {
    const c = contracts.find((c) => c.address === e.contractAddress)!;
    if (e.tokenId === null || c.errorCode || !c.tokenIds.includes(e.tokenId))
      continue;
    const acquired = allAcquired.filter(
      (a) => a.contractId === c.id && a.tokenId === e.tokenId,
    );
    const balances = allBalances.filter(
      (b) => b.contractId === c.id && b.tokenId === e.tokenId,
    );
    if (!acquired.length && !balances.length) continue;
    result.push({
      slug: e.slug,
      name: e.name,
      firstAcquired: acquired[0]?.eventAt.toISOString() ?? null,
      lastAcquired: acquired.at(-1)?.eventAt.toISOString() ?? null,
      quantity: balances
        .reduce((n, b) => n + BigInt(b.quantity), 0n)
        .toString(),
      through: c.cursor?.toString() ?? null,
      complete: c.cursor !== null && c.cursor === c.finalizedBlock,
      fresh:
        !!c.lastSuccessAt && Date.now() - c.lastSuccessAt.getTime() < 900000,
    });
  }
  return result;
}
