import 'server-only';
import { db } from './db';
import { exportCollectibles } from './collectibles';
import { customSchema, editionSchema } from '@/domain/collectibles';
import { inspectCollectibleArtwork } from './collectible-art';
import type { Check } from '@/domain/operations';
import { SQUIGS_CONTRACT } from '@/domain/validation';
export async function verifyCollectibles(
  options: { artwork?: boolean } = {},
): Promise<Check[]> {
  const checks: Check[] = [];
  for (const kind of ['CUSTOM', 'EDITION'] as const) {
    const manifest = await exportCollectibles(kind);
    let invalid = 0;
    for (const r of manifest.records)
      if (
        !(kind === 'CUSTOM' ? customSchema : editionSchema).safeParse(r).success
      )
        invalid++;
    checks.push({
      name: `collectibles.${kind.toLowerCase()}`,
      status: invalid ? 'FAIL' : 'PASS',
      detail: `${manifest.records.length} official records; ${invalid} invalid metadata or chain references`,
    });
  }
  const [customs, editions, preferences, gallery] = await Promise.all([
    db().squigCustom.findMany({
      select: {
        id: true,
        status: true,
        verifiedAt: true,
        squig: { select: { chainId: true, contractAddress: true } },
      },
    }),
    db().squigEdition.findMany({
      select: {
        id: true,
        status: true,
        verifiedAt: true,
        revision: true,
        ownership: { select: { amount: true, editionRevision: true } },
      },
    }),
    db().squigDisplayPreference.findMany({
      select: { squigId: true, custom: { select: { squigId: true } } },
    }),
    db().collectorGalleryItem.findMany({
      where: { customId: { not: null } },
      select: { squigId: true, custom: { select: { squigId: true } } },
    }),
  ]);
  let issues = 0;
  issues += customs.filter(
    (c) => c.squig.chainId !== 1 || c.squig.contractAddress !== SQUIGS_CONTRACT,
  ).length;
  issues += editions.flatMap((e) =>
    e.ownership.filter(
      (o) =>
        !/^(0|[1-9][0-9]{0,77})$/.test(o.amount) ||
        o.editionRevision > e.revision,
    ),
  ).length;
  issues += await db().squigEditionRelation.count({
    where: {
      OR: [
        { relationType: { not: 'ASSOCIATED_CHARACTER' } },
        { squig: { chainId: { not: 1 } } },
        { squig: { contractAddress: { not: SQUIGS_CONTRACT } } },
      ],
    },
  });
  for (const item of [...customs, ...editions]) {
    if (item.status === 'VERIFIED' && !item.verifiedAt) issues++;
    if (!(await db().collectibleAudit.count({ where: { entityId: item.id } })))
      issues++;
  }
  issues += [...preferences, ...gallery].filter(
    (p) => p.custom && p.custom.squigId !== p.squigId,
  ).length;
  checks.push({
    name: 'collectibles.relations_audit',
    status: issues ? 'FAIL' : 'PASS',
    detail: `${issues} inconsistent representation references, missing verification dates or audit histories`,
  });
  const assets = await db().collectibleArtwork.findMany();
  let failures = 0;
  for (const asset of assets) {
    if (
      !['image/png', 'image/jpeg'].includes(asset.mime) ||
      asset.width < 1 ||
      asset.height < 1 ||
      asset.width > 4096 ||
      asset.height > 4096 ||
      asset.byteLength > 3000000 ||
      !/^[a-f0-9]{64}$/.test(asset.sha256)
    )
      failures++;
    if (options.artwork)
      try {
        const fresh = await inspectCollectibleArtwork(asset.uri);
        if (fresh.sha256 !== asset.sha256) failures++;
      } catch {
        failures++;
      }
  }
  checks.push({
    name: 'collectibles.artwork',
    status: failures ? 'FAIL' : options.artwork ? 'PASS' : 'WARN',
    detail: `${assets.length} assets; ${failures} failures; ${options.artwork ? 'gateway bytes revalidated' : 'use collectibles:verify to revalidate gateway bytes'}`,
  });
  checks.push({
    name: 'editions.ownership',
    status: 'WARN',
    detail:
      'Ethereum ERC721/ERC1155 observations require a reviewed verified catalog entry and expire after 15 minutes. Other chains and off-chain catalogs have no ownership claims.',
  });
  const { verifyEditionIndex } = await import('./edition-verify');
  checks.push(...(await verifyEditionIndex()));
  return checks;
}
