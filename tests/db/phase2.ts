import assert from 'node:assert/strict';
import { zeroAddress } from 'viem';
import { db } from '../../src/server/db';
import { transferBatch, type ChainReader } from '../../src/sync/transfers';
import { deriveToken, chainKey } from '../../src/sync/provenance';
import { passport, chainStatus } from '../../src/server/provenance';
import { decideAttribution } from '../../src/server/reconciliation';
import { verifyProvenance } from '../../src/sync/verify-provenance';
import { SQUIGS_CONTRACT } from '../../src/domain/validation';
export async function phase2DatabaseTests(
  check: (value: unknown, message: string) => void,
) {
  const old = {
    start: process.env.SQUIGS_START_BLOCK,
    batch: process.env.TRANSFER_BLOCK_BATCH,
    rewind: process.env.REORG_REWIND_BLOCKS,
    retries: process.env.RPC_RETRIES,
  };
  Object.assign(process.env, {
    SQUIGS_START_BLOCK: '100',
    TRANSFER_BLOCK_BATCH: '2',
    REORG_REWIND_BLOCKS: '2',
    RPC_RETRIES: '0',
  });
  try {
    const collector = await db().collector.create({
        data: {
          slug: 'history-alice',
          displayName: 'History Alice',
          isPublic: true,
          showWallets: true,
        },
      }),
      other = await db().collector.create({
        data: { slug: 'history-bob', isPublic: true, showWallets: true },
      });
    const a = '0x' + '1'.repeat(40),
      b = '0x' + '2'.repeat(40),
      c = '0x' + '3'.repeat(40);
    const when = (n: number) => new Date(Date.UTC(2026, 5, n - 99));
    const evidence = [];
    for (const [address, id] of [
      [a, collector.id],
      [b, collector.id],
      [c, other.id],
    ])
      evidence.push(
        await db().historicalIdentityAttribution.create({
          data: {
            sourceKey: `fixture-history:${address}`,
            collectorId: id,
            walletAddress: address,
            source: 'FIXTURE',
            status: 'REVIEWED',
            confidence: 'ADMIN_REVIEWED',
            effectiveFrom: when(100),
            evidence: { fixture: true },
          },
        }),
      );
    const s = await db().squig.upsert({
      where: {
        chainId_contractAddress_tokenId: {
          chainId: 1,
          contractAddress: SQUIGS_CONTRACT,
          tokenId: 3157,
        },
      },
      create: {
        chainId: 1,
        contractAddress: SQUIGS_CONTRACT,
        tokenId: 3157,
        metadataSourceHash: 'fixture',
      },
      update: { metadataSourceHash: 'fixture' },
    });
    const hash = (n: number, suffix = 0) =>
      `0x${(n + suffix).toString(16).padStart(64, '0')}` as `0x${string}`;
    let deep = false;
    let reorg = false,
      fail = false,
      tip = 105;
    const calls: bigint[] = [];
    const block = (n: number) => ({
      number: BigInt(n),
      hash: hash(n, deep && n >= 102 ? 2000 : reorg && n >= 104 ? 1000 : 0),
      timestamp: BigInt(Math.floor(when(n).getTime() / 1000)),
    });
    const reader = {
      getBlock: async ({ blockNumber }: { blockNumber?: bigint }) => {
        const n = Number(blockNumber ?? tip);
        calls.push(BigInt(n));
        return block(n);
      },
      getCode: async ({ blockNumber }: { blockNumber: bigint }) =>
        blockNumber >= 100n ? '0x1234' : '0x',
      getContractEvents: async ({
        fromBlock,
        toBlock,
      }: {
        fromBlock: bigint;
        toBlock: bigint;
      }) => {
        if (fail) throw Error('fixture outage');
        const rows = [
          [100, zeroAddress, a],
          [101, a, b],
          [103, b, c],
          [104, c, reorg ? b : a],
        ] as const;
        return rows
          .filter(([n]) => BigInt(n) >= fromBlock && BigInt(n) <= toBlock)
          .map(([n, from, to]) => ({
            args: { tokenId: 3157n, from, to },
            blockNumber: BigInt(n),
            blockHash: block(n).hash,
            transactionHash: hash(n + 10000, reorg && n >= 104 ? 1000 : 0),
            transactionIndex: 0,
            logIndex: 0,
            removed: false,
          }))
          .reverse();
      },
    } as unknown as ChainReader;
    check(await transferBatch(reader), 'scanner commits first range');
    check(
      (await db().nftTransfer.count({ where: { squigId: s.id } })) === 2,
      'raw mint + transfer persisted',
    );
    check(
      (await db().collectorOwnershipPeriod.count({
        where: { squigId: s.id, collectorId: collector.id },
      })) === 1,
      'internal move keeps continuous collector period',
    );
    fail = true;
    await assert.rejects(() => transferBatch(reader));
    check(
      (await db().chainCursor.findUniqueOrThrow({ where: { key: chainKey } }))
        .blockNumber === 101n,
      'RPC failure retains durable cursor',
    );
    fail = false;
    await transferBatch(reader);
    let discovery = await db().squigDiscovery.findUniqueOrThrow({
      where: {
        collectorId_squigId: { collectorId: collector.id, squigId: s.id },
      },
    });
    check(discovery.everOwned, 'transfer away preserves discovery');
    await transferBatch(reader);
    check(
      (await db().collectorOwnershipPeriod.count({
        where: { squigId: s.id, collectorId: collector.id },
      })) === 2,
      'reacquisition creates second collector period',
    );
    check(
      (await db().squigDiscovery.count({
        where: { collectorId: collector.id, squigId: s.id },
      })) === 1,
      'reacquisition does not duplicate discovery',
    );
    check(
      !(await transferBatch(reader)),
      'caught-up scanner does not rescan committed pages',
    );
    check(
      (await db().nftTransfer.count({ where: { squigId: s.id } })) === 4,
      'idempotent scan has four facts',
    );
    const p = await passport(s.id, { order: 'oldest' });
    check(
      p.entries[0].eventType === 'MINTED' &&
        p.entries[1].eventType === 'WALLET_MOVE',
      'passport labels mint and internal move',
    );
    check(
      p.entries[2].eventType === 'COLLECTOR_CHANGED',
      'passport recognizes a public collector change',
    );
    check(
      (await passport(s.id, { event: 'mint' })).total === 1,
      'passport type filter',
    );
    check(
      (await passport(s.id, { page: '99' })).page === 1,
      'passport bounds page',
    );
    check(
      p.summary?.minter === a && p.summary.mintAt === when(100).toISOString(),
      'mint provenance exact chain data',
    );
    await db().collector.update({
      where: { id: collector.id },
      data: { showWallets: false },
    });
    const hidden = JSON.stringify(await passport(s.id, {}));
    check(
      !hidden.includes('history-alice') && !hidden.includes('History Alice'),
      'hidden wallet identity absent from public DTO',
    );
    await db().collector.update({
      where: { id: collector.id },
      data: { showWallets: true, isPublic: false },
    });
    check(
      !JSON.stringify(await passport(s.id, {})).includes('history-alice'),
      'private collector identity absent from public DTO',
    );
    await db().collector.update({
      where: { id: collector.id },
      data: { isPublic: true },
    });
    const review = await db().identityReconciliation.create({
      data: {
        dedupeKey: 'fixture-review',
        reason: 'FIXTURE',
        evidence: { attributionId: evidence[0].id },
      },
    });
    await decideAttribution('fixture-admin', {
      caseId: review.id,
      attributionId: evidence[0].id,
      action: 'REJECT',
      reason: 'Fixture rejection with supporting evidence.',
    });
    check(
      (
        await db().squigProvenance.findUniqueOrThrow({
          where: { squigId: s.id },
        })
      ).dirty,
      'review queues derived rebuild',
    );
    check(
      (await db().reconciliationDecision.count({
        where: { caseId: review.id },
      })) === 1,
      'review is audited',
    );
    await deriveToken(s.id);
    discovery = await db().squigDiscovery.findUniqueOrThrow({
      where: {
        collectorId_squigId: { collectorId: collector.id, squigId: s.id },
      },
    });
    check(
      discovery.discoveredAt.getTime() === when(101).getTime(),
      'rejected first wallet shifts discovery to first still-confirmed hold',
    );
    await decideAttribution('fixture-admin', {
      caseId: review.id,
      attributionId: evidence[0].id,
      action: 'CONFIRM',
      effectiveFrom: when(100),
      reason: 'New evidence confirms this historical interval.',
    });
    await deriveToken(s.id);
    check(
      (
        await db().squigDiscovery.findUniqueOrThrow({
          where: {
            collectorId_squigId: { collectorId: collector.id, squigId: s.id },
          },
        })
      ).discoveredAt.getTime() === when(100).getTime(),
      'admin confirmation restores proved discovery',
    );
    const conflict = await db().historicalIdentityAttribution.create({
      data: {
        sourceKey: 'fixture-conflict',
        collectorId: other.id,
        walletAddress: a,
        source: 'LEGACY',
        status: 'UNCONFIRMED',
        confidence: 'LEGACY',
        effectiveFrom: when(100),
        evidence: { fixture: true },
      },
    });
    await deriveToken(s.id);
    check(
      (await db().identityReconciliation.count({
        where: { dedupeKey: `history-conflict:${a}`, status: 'PENDING' },
      })) === 1,
      'conflicting attribution creates review case',
    );
    check(
      (await passport(s.id, { event: 'mint' })).entries[0].toCollector === null,
      'unresolved attribution never exposes identity',
    );
    await db().historicalIdentityAttribution.update({
      where: { id: conflict.id },
      data: { status: 'REJECTED' },
    });
    await deriveToken(s.id);
    reorg = true;
    await transferBatch(reader);
    check(
      (
        await db().nftTransfer.findFirstOrThrow({
          where: { squigId: s.id, blockNumber: 104n },
        })
      ).toAddress === b,
      'hash mismatch rewinds and replaces orphan event',
    );
    check(
      (
        await db().squigProvenance.findUniqueOrThrow({
          where: { squigId: s.id },
        })
      ).currentWallet === b,
      'reorg rebuild restores canonical owner',
    );
    check(
      (await db().nftTransfer.count({ where: { squigId: s.id } })) === 4,
      'reorg reindex has no duplicates',
    );
    check(
      (
        await db().walletOwnershipPeriod.findMany({
          where: { squigId: s.id, lostAt: null },
        })
      ).length === 1,
      'one open wallet period after reorg',
    );
    const before = await db().nftTransfer.count();
    await deriveToken(s.id);
    await deriveToken(s.id);
    check(
      (await db().nftTransfer.count()) === before,
      'targeted rebuild preserves raw ledger',
    );
    check(
      (await db().collectorOwnershipPeriod.count({
        where: { squigId: s.id, collectorId: collector.id },
      })) === 2,
      'rebuild remains idempotent',
    );
    const owners: Parameters<typeof verifyProvenance>[1] = async (_r, tokens) =>
      tokens.map((t) => ({
        status: 'success' as const,
        result: (t === 3157 ? b : a) as `0x${string}`,
      }));
    const verification = await verifyProvenance(reader, owners);
    check(verification?.checked === 4444, 'verifier checks full token range');
    check(
      !verification?.anomalies.some((a) => a.tokenId === 3157),
      'healthy fixture provenance verifies against ownerOf',
    );
    check(
      verification?.anomalies.some((a) => a.reasons.includes('MISSING_MINT')),
      'verifier reports missing mint',
    );
    const wrong: Parameters<typeof verifyProvenance>[1] = async (_r, tokens) =>
      tokens.map(() => ({
        status: 'success' as const,
        result: c as `0x${string}`,
      }));
    const mismatch = await verifyProvenance(reader, wrong);
    check(
      mismatch?.anomalies
        .find((a) => a.tokenId === 3157)
        ?.reasons.includes('OWNER_OF_MISMATCH'),
      'verifier reports incorrect current owner',
    );
    check(
      (await chainStatus()).events === 4,
      'diagnostics count actual raw facts',
    );
    // Large history exercises actual SQL pagination and stable same-block ordering.
    for (let n = 0; n < 25; n++)
      await db().nftTransfer.create({
        data: {
          id: `fixture-extra:${n}`,
          chainId: 1,
          contractAddress: SQUIGS_CONTRACT,
          tokenId: 3157,
          squigId: s.id,
          fromAddress: b,
          toAddress: b,
          transactionHash: hash(50000 + n),
          logIndex: n,
          transactionIndex: 0,
          blockNumber: 105n,
          blockHash: block(105).hash,
          eventAt: when(105),
        },
      });
    await deriveToken(s.id);
    const first = await passport(s.id, {}),
      second = await passport(s.id, { page: '2' });
    check(
      first.entries[0].eventType === 'SELF_TRANSFER',
      'self-transfer passport does not claim a new wallet',
    );
    check(
      first.entries.length === 20 && second.entries.length === 9,
      'passport SQL pagination limits payload',
    );
    check(
      !first.entries.some((e) => second.entries.some((v) => v.id === e.id)),
      'passport pages do not overlap',
    );
    check(calls.length < 100, 'timestamps resolved by block, not by transfer');
    tip = 106;
    check(await transferBatch(reader), 'resumes next finalized range');
    deep = true;
    await assert.rejects(
      () => transferBatch(reader),
      /DEEP_REORG_REVIEW_REQUIRED/,
    );
    check(
      (await db().chainCursor.findUniqueOrThrow({ where: { key: chainKey } }))
        .blockNumber === 106n,
      'deep reorg fails closed without advancing cursor',
    );
    check(
      (await db().nftTransfer.count({ where: { squigId: s.id } })) === 29,
      'deep reorg does not erase canonical ledger without a verified anchor',
    );
    deep = false;
    await transferBatch(reader);
    const raw = await db().nftTransfer.findFirstOrThrow({
      where: { squigId: s.id },
    });
    await assert.rejects(() =>
      db().nftTransfer.create({ data: { ...raw, id: 'duplicate-fixture' } }),
    );
    check(true, 'database prevents duplicate chain transaction/log identity');
    const d = '0x' + '4'.repeat(40);
    const split = await db().historicalIdentityAttribution.create({
      data: {
        sourceKey: 'fixture-split',
        collectorId: collector.id,
        walletAddress: d,
        source: 'LEGACY',
        status: 'UNCONFIRMED',
        confidence: 'LEGACY',
        effectiveFrom: when(100),
        evidence: { fixture: true },
      },
    });
    const splitCase = await db().identityReconciliation.create({
      data: {
        dedupeKey: 'fixture-split-case',
        reason: 'FIXTURE',
        evidence: { attributionId: split.id },
      },
    });
    await decideAttribution('fixture-admin', {
      caseId: splitCase.id,
      attributionId: split.id,
      action: 'SPLIT',
      effectiveTo: when(103),
      secondCollectorId: other.id,
      reason: 'Control changed at this supported interval boundary.',
    });
    const splitRows = await db().historicalIdentityAttribution.findMany({
      where: { walletAddress: d },
      orderBy: { effectiveFrom: 'asc' },
    });
    check(
      splitRows.length === 2 &&
        splitRows[0].effectiveTo?.getTime() ===
          splitRows[1].effectiveFrom.getTime(),
      'audited admin split creates adjacent evidence intervals',
    );
    await decideAttribution('fixture-admin', {
      caseId: splitCase.id,
      attributionId: split.id,
      action: 'UNRESOLVED',
      reason: 'Further evidence review is needed before confirmation.',
    });
    check(
      (
        await db().historicalIdentityAttribution.findUniqueOrThrow({
          where: { id: split.id },
        })
      ).status === 'UNCONFIRMED',
      'leave unresolved withholds attribution',
    );
    const bCase = await db().identityReconciliation.create({
      data: {
        dedupeKey: 'fixture-b-review',
        reason: 'FIXTURE',
        evidence: { attributionId: evidence[1].id },
      },
    });
    for (const [reviewId, attr] of [
      [review.id, evidence[0].id],
      [bCase.id, evidence[1].id],
    ])
      await decideAttribution('fixture-admin', {
        caseId: reviewId,
        attributionId: attr,
        action: 'REJECT',
        reason: 'Fixture invalidates all supporting evidence.',
      });
    await deriveToken(s.id);
    check(
      !(
        await db().squigDiscovery.findUniqueOrThrow({
          where: {
            collectorId_squigId: { collectorId: collector.id, squigId: s.id },
          },
        })
      ).everOwned,
      'invalidated attribution removes discovery eligibility without deleting its row',
    );
    for (const [reviewId, attr] of [
      [review.id, evidence[0].id],
      [bCase.id, evidence[1].id],
    ])
      await decideAttribution('fixture-admin', {
        caseId: reviewId,
        attributionId: attr,
        action: 'CONFIRM',
        reason: 'Fixture restores reviewed evidence after appeal.',
      });
    await deriveToken(s.id);
    let hashReads = 0;
    const changedDuringVerify = {
      ...reader,
      getBlock: async () => ({
        ...block(106),
        hash: ++hashReads === 1 ? block(106).hash : hash(99999),
      }),
    } as unknown as ChainReader;
    await assert.rejects(
      () => verifyProvenance(changedDuringVerify, owners),
      /CHAIN_CHANGED_DURING_VERIFY/,
    );
    check(
      (
        await db().squigProvenance.findUniqueOrThrow({
          where: { squigId: s.id },
        })
      ).verifiedAt === null,
      'verification never publishes success before final block-hash validation',
    );
    const fast = await db().squig.upsert({
      where: {
        chainId_contractAddress_tokenId: {
          chainId: 1,
          contractAddress: SQUIGS_CONTRACT,
          tokenId: 3158,
        },
      },
      create: { chainId: 1, contractAddress: SQUIGS_CONTRACT, tokenId: 3158 },
      update: {},
    });
    for (const [index, from, to] of [
      [0, zeroAddress, a],
      [1, a, b],
    ] as const)
      await db().nftTransfer.create({
        data: {
          id: `fixture-same-block:${index}`,
          chainId: 1,
          contractAddress: SQUIGS_CONTRACT,
          tokenId: 3158,
          squigId: fast.id,
          fromAddress: from,
          toAddress: to,
          transactionHash: hash(60000),
          logIndex: index,
          transactionIndex: 0,
          blockNumber: 105n,
          blockHash: block(105).hash,
          eventAt: when(105),
        },
      });
    await deriveToken(fast.id);
    check(
      (await db().collectorOwnershipPeriod.count({
        where: { squigId: fast.id },
      })) === 1,
      'same-block internal move preserves one collector period',
    );
    check(
      (await db().collectorActivity.count({
        where: { squigId: fast.id, eventType: 'WALLET_MOVE' },
      })) === 1,
      'same-block internal move appears in collector timeline',
    );
  } finally {
    for (const [key, value] of Object.entries({
      SQUIGS_START_BLOCK: old.start,
      TRANSFER_BLOCK_BATCH: old.batch,
      REORG_REWIND_BLOCKS: old.rewind,
      RPC_RETRIES: old.retries,
    }))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
}
