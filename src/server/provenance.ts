import 'server-only';
import { zeroAddress } from 'viem';
import { db } from './db';
import { readEnv } from './env';
import { chainKey } from '@/sync/provenance';
import {
  passportFilters,
  publicAttribution,
  explorerTransaction,
  confident,
} from '@/domain/provenance';
export async function chainStatus() {
  const [
    cursor,
    events,
    mints,
    complete,
    dirty,
    anomalies,
    verified,
    matches,
    cases,
  ] = await Promise.all([
    db().chainCursor.findUnique({ where: { key: chainKey } }),
    db().nftTransfer.count(),
    db().squigProvenance.count({
      where: { mintAt: { not: null }, dirty: false },
    }),
    db().squigProvenance.count({ where: { complete: true, dirty: false } }),
    db().squigProvenance.count({ where: { dirty: true } }),
    db().squigProvenance.count({
      where: {
        dirty: false,
        OR: [{ complete: false }, { ownerMatches: false }],
      },
    }),
    db().squigProvenance.count({
      where: { verifiedAt: { not: null }, dirty: false },
    }),
    db().squigProvenance.count({ where: { ownerMatches: true, dirty: false } }),
    db().identityReconciliation.count({ where: { status: 'PENDING' } }),
  ]);
  return {
    chain: 1,
    contract: readEnv().SQUIGS_CONTRACT_ADDRESS,
    startBlock:
      cursor?.startBlock?.toString() ??
      readEnv().SQUIGS_START_BLOCK?.toString() ??
      null,
    latestIndexedBlock: cursor?.blockNumber.toString() ?? null,
    latestFinalizedBlock: cursor?.finalizedBlock?.toString() ?? null,
    lag:
      cursor?.finalizedBlock === null || !cursor
        ? null
        : (cursor.finalizedBlock - cursor.blockNumber).toString(),
    lastSuccess: cursor?.lastSuccessAt?.toISOString() ?? null,
    lastError: cursor?.lastError ?? null,
    events,
    mints,
    missingMintProvenance: 4444 - mints,
    complete,
    dirty,
    anomalies,
    verified,
    ownersMatched: matches,
    unresolvedCases: cases,
    coverage:
      cursor?.finalizedBlock === cursor?.blockNumber && cursor
        ? 'CAUGHT_UP'
        : 'INCOMPLETE',
  };
}
export async function passport(
  squigId: string,
  params: Record<string, string | string[] | undefined>,
) {
  const f = passportFilters.parse(params),
    take = 20;
  const where = {
    squigId,
    ...(f.event === 'mint'
      ? { fromAddress: zeroAddress }
      : f.event === 'burn'
        ? { toAddress: zeroAddress }
        : f.event === 'transfer'
          ? {
              fromAddress: { not: zeroAddress },
              toAddress: { not: zeroAddress },
            }
          : {}),
  };
  const total = await db().nftTransfer.count({ where }),
    page = Math.min(f.page, Math.max(1, Math.ceil(total / take)));
  const [rows, summary, periods, cursor] = await Promise.all([
    db().nftTransfer.findMany({
      where,
      orderBy: [
        { blockNumber: f.order === 'oldest' ? 'asc' : 'desc' },
        { logIndex: f.order === 'oldest' ? 'asc' : 'desc' },
      ],
      skip: (page - 1) * take,
      take,
    }),
    db().squigProvenance.findUnique({ where: { squigId } }),
    db().collectorOwnershipPeriod.findMany({
      where: {
        squigId,
        squig: { provenance: { is: { dirty: false, complete: true } } },
      },
      include: {
        collector: {
          select: {
            slug: true,
            displayName: true,
            isPublic: true,
            showWallets: true,
          },
        },
      },
    }),
    db().chainCursor.findUnique({ where: { key: chainKey } }),
  ]);
  const evidence = await db().historicalIdentityAttribution.findMany({
    where: {
      chainId: 1,
      walletAddress: {
        in: [
          ...new Set([
            ...rows.flatMap((r) => [r.fromAddress, r.toAddress]),
            summary?.minter ?? '',
            summary?.currentWallet ?? '',
          ]),
        ],
      },
      status: { notIn: ['REJECTED', 'INVALIDATED'] },
    },
    include: {
      collector: {
        select: {
          slug: true,
          displayName: true,
          isPublic: true,
          showWallets: true,
        },
      },
    },
  });
  const indexedAt = cursor
    ? await db().chainBlock.findUnique({
        where: { chainId_number: { chainId: 1, number: cursor.blockNumber } },
      })
    : null;
  function actor(address: string, at: Date, before = false) {
    if (!summary?.complete || summary.dirty) return null;
    const matching = evidence.filter(
      (p) =>
        p.walletAddress === address &&
        (before ? p.effectiveFrom < at : p.effectiveFrom <= at) &&
        (!p.effectiveTo || (before ? p.effectiveTo >= at : p.effectiveTo > at)),
    );
    const owners = new Set(matching.map((p) => p.collectorId)),
      trusted = matching.find(confident);
    return owners.size === 1 && trusted
      ? publicAttribution(trusted.collector, true)
      : null;
  }
  const clean = summary && !summary.dirty;
  const knownPublic = new Set(
    periods
      .filter((p) => publicAttribution(p.collector, true))
      .map((p) => p.collector.slug),
  );
  return {
    page,
    pages: Math.max(1, Math.ceil(total / take)),
    total,
    filters: f,
    ageDays: summary?.mintAt
      ? Math.max(
          0,
          Math.floor((Date.now() - summary.mintAt.getTime()) / 86400000),
        )
      : null,
    summary: clean
      ? {
          complete: summary.complete,
          mintAt: summary.mintAt?.toISOString() ?? null,
          minter: summary.minter,
          mintTransaction: summary.mintTransaction
            ? explorerTransaction(
                1,
                summary.mintTransaction,
                readEnv().ETH_EXPLORER_URL,
              )
            : null,
          minterCollector:
            summary.minter && summary.mintAt
              ? actor(summary.minter, summary.mintAt)
              : null,
          currentWallet: summary.currentWallet,
          currentSince: summary.currentSince?.toISOString() ?? null,
          currentCollector: summary.currentWallet
            ? actor(summary.currentWallet, indexedAt?.timestamp ?? new Date(0))
            : null,
          transferCount: summary.transferCount,
          uniqueWallets: summary.uniqueWallets,
          knownPublicCollectors: knownPublic.size,
          longestHoldSeconds: summary.longestHoldSeconds?.toString() ?? null,
          issues: summary.issues,
          through: summary.derivedThrough?.toString() ?? null,
          ownerMatches: summary.ownerMatches,
          verifiedAt: summary.verifiedAt?.toISOString() ?? null,
        }
      : null,
    entries: rows.map((r) => {
      const from = actor(r.fromAddress, r.eventAt, true),
        to = actor(r.toAddress, r.eventAt);
      const kind =
        r.fromAddress === zeroAddress
          ? 'MINTED'
          : r.toAddress === zeroAddress
            ? 'BURNED'
            : r.fromAddress === r.toAddress
              ? 'SELF_TRANSFER'
              : from && to && from.slug === to.slug
                ? 'WALLET_MOVE'
                : from && to
                  ? 'COLLECTOR_CHANGED'
                  : 'TRANSFERRED';
      return {
        id: r.id,
        eventType: kind,
        eventAt: r.eventAt.toISOString(),
        fromAddress: r.fromAddress,
        toAddress: r.toAddress,
        fromCollector: from,
        toCollector: to,
        transaction: explorerTransaction(
          r.chainId,
          r.transactionHash,
          readEnv().ETH_EXPLORER_URL,
        ),
        block: r.blockNumber.toString(),
        logIndex: r.logIndex,
      };
    }),
  };
}
export async function collectorHistory(collectorId: string, limit = 12) {
  const first = await db().collectorActivity.findFirst({
    where: {
      collectorId,
      sourceSystem: 'provenance',
      eventType: 'SQUIG_DISCOVERED',
      squig: { provenance: { is: { dirty: false } } },
    },
    orderBy: [{ eventAt: 'asc' }, { eventKey: 'asc' }],
    select: { id: true },
  });
  const rows = await db().collectorActivity.findMany({
    where: {
      collectorId,
      sourceSystem: 'provenance',
      squig: { provenance: { is: { dirty: false } } },
    },
    orderBy: [{ eventAt: 'desc' }, { id: 'desc' }],
    take: limit,
    select: {
      id: true,
      eventType: true,
      eventAt: true,
      squig: { select: { tokenId: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    eventType: r.id === first?.id ? 'COLLECTOR_FIRST_DISCOVERY' : r.eventType,
    eventAt: r.eventAt.toISOString(),
    tokenId: r.squig?.tokenId ?? null,
  }));
}
