import 'server-only';
import { db } from './db';
import { validateContract, squigsAbi } from '@/integrations/blockchain';
import { SQUIGS_CONTRACT } from '@/domain/validation';
import { chainKey } from '@/sync/provenance';
import { assertDeploymentBinding } from './deployment';
export async function chainSpotAudit() {
  await assertDeploymentBinding();
  const client = await validateContract();
  const cursor = await db().chainCursor.findUniqueOrThrow({
    where: { key: chainKey },
  });
  const scope = { chainId: 1, contractAddress: SQUIGS_CONTRACT };
  const candidates = await Promise.all([
    db().squig.findFirst({ where: scope, orderBy: { tokenId: 'asc' } }),
    db().squig.findFirst({ where: scope, orderBy: { tokenId: 'desc' } }),
    db().squig.findFirst({
      where: { ...scope, og: true },
      orderBy: { tokenId: 'asc' },
    }),
    db().squig.findFirst({
      where: { ...scope, legendary: true },
      orderBy: { tokenId: 'asc' },
    }),
    db().squig.findFirst({
      where: { ...scope, provenance: { transferCount: { gt: 1 } } },
      orderBy: [{ provenance: { transferCount: 'desc' } }, { tokenId: 'asc' }],
    }),
    db().squig.findFirst({
      where: { ...scope, provenance: { transferCount: 1 } },
      orderBy: { tokenId: 'asc' },
    }),
    db().squig.findFirst({
      where: { ...scope, collectorPeriods: { some: { lostAt: null } } },
      orderBy: { tokenId: 'asc' },
    }),
    db().squig.findFirst({
      where: {
        ...scope,
        transfers: { some: { toAddress: '0x' + '0'.repeat(40) } },
      },
      orderBy: { tokenId: 'asc' },
    }),
  ]);
  const names = [
    'low',
    'high',
    'OG',
    'Legendary',
    'many-transfers',
    'one-transfer',
    'attributed-current',
    'burn',
  ];
  const results = [];
  for (const [i, s] of candidates.entries()) {
    if (!s) {
      results.push({ category: names[i], status: 'PENDING', tokenId: null });
      continue;
    }
    const transfers = await db().nftTransfer.findMany({
      where: { squigId: s.id },
      orderBy: [{ blockNumber: 'asc' }, { logIndex: 'asc' }],
    });
    let matched = 0;
    // First and last recorded event, not unbounded per-token gateway traffic.
    for (const t of [
      ...new Map(
        [transfers[0], transfers.at(-1)]
          .filter(Boolean)
          .map((t) => [t!.id, t!]),
      ).values(),
    ]) {
      const logs = await client.getContractEvents({
        address: SQUIGS_CONTRACT,
        abi: squigsAbi,
        eventName: 'Transfer',
        fromBlock: t.blockNumber,
        toBlock: t.blockNumber,
        strict: true,
      });
      if (
        logs.some(
          (l) =>
            l.transactionHash === t.transactionHash &&
            l.logIndex === t.logIndex &&
            l.blockHash === t.blockHash &&
            Number(l.args.tokenId) === s.tokenId &&
            l.args.from.toLowerCase() === t.fromAddress &&
            l.args.to.toLowerCase() === t.toAddress,
        )
      )
        matched++;
    }
    const periods = await db().walletOwnershipPeriod.count({
      where: { squigId: s.id },
    });
    const provenance = await db().squigProvenance.findUnique({
      where: { squigId: s.id },
    });
    results.push({
      category: names[i],
      tokenId: s.tokenId,
      status:
        matched === Math.min(2, transfers.length) &&
        !!transfers.length &&
        provenance?.complete &&
        !provenance.dirty
          ? 'VERIFIED'
          : 'PARTIAL',
      ledgerEvents: transfers.length,
      rawSampleMatches: matched,
      periods,
      passportBoundary: provenance?.derivedThrough?.toString() ?? null,
    });
  }
  if (
    (await client.getBlock({ blockNumber: cursor.blockNumber })).hash !==
    cursor.blockHash
  )
    throw new Error('CHAIN_CHANGED_DURING_AUDIT');
  await db().operationalAudit.create({
    data: {
      actor: 'launch:operator',
      action: 'CHAIN_SPOT_AUDIT',
      subject: chainKey,
      detail: { block: cursor.blockNumber.toString(), results },
    },
  });
  return results;
}
