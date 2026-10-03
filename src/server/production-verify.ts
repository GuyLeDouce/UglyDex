import 'server-only';
import { db } from './db';
import { Prisma } from '@/generated/prisma/client';
import { type Check } from '@/domain/operations';
import { SQUIGS_CONTRACT } from '@/domain/validation';
import { canonicalTokens, verifyCatalog } from '@/domain/dex-catalog';
import { verifyDerived } from './derived-verification';
import { migrationChecks } from './production';
import { chainKey } from '@/sync/provenance';

// Read-only verification. Run with workers paused for a stable evidence view.
export async function productionVerify(
  options: { owners?: 'spot' | 'full' } = {},
): Promise<Check[]> {
  const checks = await migrationChecks();
  if (checks.some((c) => c.status === 'FAIL')) return checks;
  const add = (name: string, failures: number, detail: string) =>
    checks.push({
      name,
      status: failures ? 'FAIL' : 'PASS',
      detail: `${failures} discrepancies; ${detail}`,
    });
  const rows = await db().squig.findMany({
    where: { chainId: 1, contractAddress: SQUIGS_CONTRACT },
    select: {
      tokenId: true,
      og: true,
      legendary: true,
      traits: { select: { traitType: true, value: true } },
    },
  });
  let invalid = Math.abs(4444 - rows.length) + verifyCatalog().length;
  for (const t of canonicalTokens) {
    const row = rows.find((r) => r.tokenId === t.tokenId);
    if (
      !row ||
      row.og !== t.og ||
      row.legendary !== t.legendary ||
      Object.keys(t.traits).length !== row.traits.length ||
      row.traits.some((v) => t.traits[v.traitType] !== v.value)
    )
      invalid++;
  }
  add('catalog.integrity', invalid, 'Canonical 4444 token and trait catalog');
  const count = async (query: Prisma.Sql) =>
    Number((await db().$queryRaw<{ n: bigint }[]>(query))[0].n);
  add(
    'ownership.unique',
    await count(
      Prisma.sql`SELECT count(*) AS n FROM (SELECT "squigId" FROM "SquigOwnership" WHERE "isCurrent" GROUP BY "squigId" HAVING count(*)>1) x`,
    ),
    'At most one current owner per Squig',
  );
  add(
    'provenance.dirty',
    await db().squigProvenance.count({ where: { dirty: true } }),
    'Derivation queue drained',
  );
  add(
    'provenance.continuity',
    await count(
      Prisma.sql`SELECT count(*) AS n FROM "WalletOwnershipPeriod" a JOIN "WalletOwnershipPeriod" b ON a."squigId"=b."squigId" AND a.id<b.id AND a."acquiredAt"<COALESCE(b."lostAt",'infinity'::timestamp) AND b."acquiredAt"<COALESCE(a."lostAt",'infinity'::timestamp)`,
    ),
    'No overlapping wallet periods',
  );
  add(
    'identity.attribution',
    await count(
      Prisma.sql`SELECT count(*) AS n FROM "SquigDiscovery" d LEFT JOIN "CollectorOwnershipPeriod" p ON p.id=d."firstOwnershipPeriod" WHERE d."attributionStatus"='CONFIRMED' AND (p.id IS NULL OR p."collectorId"<>d."collectorId" OR p."squigId"<>d."squigId")`,
    ),
    'Confirmed discoveries reference the same Collector and Squig',
  );
  add(
    'activity.idempotency',
    await count(
      Prisma.sql`SELECT count(*) AS n FROM (SELECT "eventKey" FROM "CollectorActivity" GROUP BY "eventKey" HAVING count(*)>1) x`,
    ),
    'Unique normalized event keys',
  );
  const jobs =
    (await db().progressionJob.count()) +
    (await db().collectionJob.count()) +
    (await db().activityAttributionJob.count());
  add('derived.queues', jobs, 'All evaluation and attribution queues drained');
  checks.push(
    ...(await db().$transaction((tx) => verifyDerived(tx), {
      isolationLevel: 'RepeatableRead',
      timeout: 1800000,
    })),
  );
  const { shareCard } = await import('./sharing');
  const { shareSchema } = await import('@/domain/sharing');
  let privacyFailures = 0;
  let cursor: string | undefined;
  do {
    const privateProfiles = await db().collector.findMany({
      where: { isPublic: false, ...(cursor ? { id: { gt: cursor } } : {}) },
      select: { id: true, slug: true },
      take: 100,
      orderBy: { id: 'asc' },
    });
    for (const c of privateProfiles)
      if (await shareCard(shareSchema.parse({ entity: c.slug })))
        privacyFailures++;
    cursor =
      privateProfiles.length === 100 ? privateProfiles.at(-1)!.id : undefined;
  } while (cursor);
  add(
    'privacy.private_cards',
    privacyFailures,
    'Private Collectors have no personalized anonymous share projection',
  );
  const coverage = await db().squigProvenance.count({
    where: { complete: true, dirty: false },
  });
  checks.push({
    name: 'history.coverage',
    status: coverage === 4444 ? 'PASS' : 'WARN',
    detail: `${coverage}/4444 complete provenance; tracked counts are not lifetime totals`,
  });
  if (options.owners) {
    try {
      const { validateContract, getOwnershipBatch } =
        await import('@/integrations/blockchain');
      const client = await validateContract();
      const cursor = await db().chainCursor.findUniqueOrThrow({
        where: { key: chainKey },
      });
      const block = await client.getBlock({ blockNumber: cursor.blockNumber });
      if (block.hash !== cursor.blockHash)
        throw new Error('CURSOR_HASH_MISMATCH');
      const tokens =
        options.owners === 'full'
          ? Array.from({ length: 4444 }, (_, i) => i + 1)
          : [1, 444, 888, 1333, 1777, 2222, 2666, 3111, 3555, 4000, 4444];
      let failures = 0;
      for (let i = 0; i < tokens.length; i += 100) {
        const batch = tokens.slice(i, i + 100),
          owners = await getOwnershipBatch(client, batch, block.number);
        const stored = await db().squig.findMany({
          where: {
            chainId: 1,
            contractAddress: SQUIGS_CONTRACT,
            tokenId: { in: batch },
          },
          select: {
            tokenId: true,
            provenance: { select: { currentWallet: true } },
          },
        });
        owners.forEach((o, index) => {
          if (
            o.status !== 'success' ||
            o.result.toLowerCase() !==
              stored.find((s) => s.tokenId === batch[index])?.provenance
                ?.currentWallet
          )
            failures++;
        });
      }
      if (
        (await client.getBlock({ blockNumber: block.number })).hash !==
        block.hash
      )
        throw new Error('BLOCK_CHANGED');
      add(
        'chain.ownerOf',
        failures,
        `${tokens.length} reads pinned to indexed block ${block.number}`,
      );
    } catch {
      checks.push({
        name: 'chain.ownerOf',
        status: 'FAIL',
        detail: 'RPC verification unavailable or cursor changed',
      });
    }
  } else
    checks.push({
      name: 'chain.ownerOf',
      status: 'WARN',
      detail: 'Use --owners spot or --owners full for RPC verification',
    });
  const { verifyCollectibles } = await import('./collectibles-verify');
  checks.push(...(await verifyCollectibles()));
  return checks;
}
