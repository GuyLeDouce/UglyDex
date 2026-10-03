import { db } from '../../src/server/db';
import {
  importCollectibles,
  publicCustoms,
  saveDisplayPreference,
  displayCustom,
  exportCollectibles,
} from '../../src/server/collectibles';
import { inspectCollectibleArtwork } from '../../src/server/collectible-art';
import {
  editionCatalog,
  editionDetail,
  ownedEditions,
  refreshEditionOwnership,
} from '../../src/server/editions';
import {
  appearance,
  saveAppearance,
  cosmeticAvailability,
  seedCosmetics,
} from '../../src/server/cosmetics';
import { migrationChecks, preflight } from '../../src/server/production';
import { productionBackfill } from '../../src/server/production-backfill';
import {
  workerReadiness,
  runWorker,
  setWorkerControl,
} from '../../src/server/worker-runtime';
import { shareCard } from '../../src/server/sharing';
import { saveGallery, galleryView } from '../../src/server/galleries';
import { passport } from '../../src/server/provenance';
import { SQUIGS_CONTRACT } from '../../src/domain/validation';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
export async function phase7DatabaseTests(
  check: (v: unknown, m: string) => void,
) {
  const rejects = async (fn: () => Promise<unknown>, label: string) => {
    let rejected = false;
    try {
      await fn();
    } catch {
      rejected = true;
    }
    check(rejected, label);
  };
  check(
    (await migrationChecks()).every((c) => c.status === 'PASS'),
    'phase7 migration ordering/checksums',
  );
  const preflightCLI = spawnSync(
    process.execPath,
    [
      'node_modules/tsx/dist/cli.mjs',
      '--conditions=react-server',
      'scripts/production.ts',
      'preflight',
      '--offline',
    ],
    { env: process.env, encoding: 'utf8', windowsHide: true, timeout: 90000 },
  );
  if (!preflightCLI.stdout.includes('PASS migration.drift'))
    console.error(
      (
        preflightCLI.stdout +
        preflightCLI.stderr +
        String(preflightCLI.error ?? '')
      )
        .replaceAll(process.env.DATABASE_URL!, '[fixture database]')
        .replaceAll(process.env.AUTH_SECRET!, '[fixture secret]'),
    );
  check(
    preflightCLI.stdout.includes('PASS migration.drift'),
    'preflight CLI verifies live schema drift',
  );
  check(
    !preflightCLI.stdout.includes(process.env.AUTH_SECRET!) &&
      !preflightCLI.stdout.includes(process.env.DATABASE_URL!),
    'preflight CLI redacts secrets',
  );
  const migration = (
    await db().$queryRaw<
      { id: string; checksum: string; finished_at: Date }[]
    >`SELECT id,checksum,finished_at FROM _prisma_migrations ORDER BY migration_name DESC LIMIT 1`
  )[0];
  await db()
    .$executeRaw`UPDATE _prisma_migrations SET checksum=${'0'.repeat(64)} WHERE id=${migration.id}`;
  check(
    (await migrationChecks()).some(
      (c) => c.name === 'migration.checksums' && c.status === 'FAIL',
    ),
    'changed migration checksum rejected',
  );
  await db()
    .$executeRaw`UPDATE _prisma_migrations SET checksum=${migration.checksum}, finished_at=NULL WHERE id=${migration.id}`;
  check(
    (await migrationChecks()).filter((c) => c.status === 'FAIL').length === 2,
    'failed and pending migrations diagnosed',
  );
  await db()
    .$executeRaw`UPDATE _prisma_migrations SET finished_at=${migration.finished_at} WHERE id=${migration.id}`;
  check(
    (await workerReadiness('blockchain', 'DISABLED')) === 'DISABLED',
    'worker disabled before config',
  );
  let ran = false;
  await runWorker(
    'blockchain',
    async () => {
      ran = true;
      return {};
    },
    { once: true },
  );
  check(!ran, 'absent worker control never launches scans');
  const heartbeat = await db().workerHeartbeat.findFirst({
    where: { service: 'blockchain' },
  });
  check(
    heartbeat?.state === 'STOPPED' &&
      heartbeat.mode === 'DISABLED' &&
      !heartbeat.lockHeld,
    'disabled heartbeat persists truthful status',
  );
  check(
    (await workerReadiness('blockchain', 'LIVE')) === 'WAITING_CONFIGURATION',
    'missing RPC waits safely',
  );
  await setWorkerControl(
    { service: 'progression', mode: 'HISTORICAL' },
    'test-admin',
  );
  await runWorker('progression', async () => ({ processed: 1 }), {
    once: true,
  });
  check(
    !!(await db().workerHeartbeat.findFirst({
      where: { service: 'progression', lastSuccessAt: { not: null } },
    })),
    'worker successful task heartbeat',
  );
  check(
    (await db().operationalAudit.count({ where: { subject: 'progression' } })) >
      0,
    'worker control audited',
  );
  await rejects(
    () =>
      productionBackfill({
        batches: 1,
        runner: async () => ({ complete: true, counts: {} }),
      }),
    'backfill refuses active worker controls',
  );
  await setWorkerControl(
    { service: 'progression', mode: 'DISABLED' },
    'test-admin',
  );
  await db().productionStage.deleteMany();
  await productionBackfill({
    batches: 1,
    runner: async () => {
      await rejects(
        () =>
          setWorkerControl(
            { service: 'collections', mode: 'LIVE' },
            'test-admin',
          ),
        'worker cannot enable during backfill',
      );
      return { complete: false, counts: { cursor: 1 } };
    },
  });
  check(
    (await db().productionStage.findUnique({ where: { stage: 'catalog' } }))
      ?.status === 'PAUSED',
    'bounded backfill pauses checkpoint',
  );
  await rejects(
    () =>
      productionBackfill({
        batches: 1,
        runner: async () => {
          throw new Error('SIMULATED_OUTAGE');
        },
      }),
    'stage failure reported',
  );
  check(
    (await db().productionStage.findUnique({ where: { stage: 'catalog' } }))
      ?.errorCode === 'SIMULATED_OUTAGE',
    'failed stage retains recoverable error',
  );
  await productionBackfill({
    batches: 1,
    runner: async () => ({ complete: true, counts: { cursor: 2 } }),
  });
  check(
    (await db().productionStage.findUnique({ where: { stage: 'catalog' } }))
      ?.attempts === 3,
    'resumed stage retains attempts without duplicate stages',
  );
  await rejects(
    () =>
      productionBackfill({
        from: 'collections',
        batches: 1,
        runner: async () => ({ complete: true, counts: {} }),
      }),
    'from refuses incomplete prerequisites',
  );
  await db().productionStage.deleteMany();
  const checks = await preflight();
  check(
    checks.some((c) => c.name === 'rpc.configured' && c.status === 'WARN'),
    'preflight warns missing RPC',
  );
  check(
    !JSON.stringify(checks).includes(process.env.AUTH_SECRET!),
    'preflight never prints secret',
  );
  const c = await db().collector.create({
      data: {
        slug: 'phase7-collector',
        displayName: 'The Alternate Cabinet',
        isPublic: true,
        featuredTokenIds: [4307],
      },
    }),
    other = await db().collector.create({ data: { slug: 'phase7-other' } });
  const wallet = '0x0000000000000000000000000000000000077777';
  await db().collectorWallet.create({
    data: {
      collectorId: c.id,
      chainId: 1,
      walletAddress: wallet,
      source: 'SIGNATURE',
      verifiedAt: new Date(),
    },
  });
  const s = await db().squig.upsert({
    where: {
      chainId_contractAddress_tokenId: {
        chainId: 1,
        contractAddress: SQUIGS_CONTRACT,
        tokenId: 4307,
      },
    },
    create: {
      chainId: 1,
      contractAddress: SQUIGS_CONTRACT,
      tokenId: 4307,
      og: true,
    },
    update: {},
  });
  await db().squigOwnership.create({
    data: {
      squigId: s.id,
      walletAddress: wallet,
      sourceKey: 'phase7-current',
      source: 'test',
      blockNumber: 1n,
      blockHash: 'fixture',
      isCurrent: true,
    },
  });
  const bytes = await sharp({
    create: { width: 40, height: 40, channels: 3, background: '#558855' },
  })
    .png()
    .toBuffer();
  const uri = 'ipfs://QmTVMmCGAYyRZ7QhdR6khzv4yvJwoVvtuc2Uq5eRuUVoFQ/4307';
  const inspect = (input: string) =>
    inspectCollectibleArtwork(
      input,
      (async () =>
        new Response(bytes, {
          headers: { 'Content-Type': 'image/png' },
        })) as typeof fetch,
    );
  const custom = {
    key: 'phase7-custom',
    tokenId: 4307,
    name: 'Cabinet specimen',
    description: 'Official alternate art',
    imageUri: uri,
    source: 'Reviewed test manifest',
    sourceReference: 'PRIVATE_SOURCE_REFERENCE',
    artist: 'Test artist',
  };
  const manifest = (records: unknown[]) => ({
    version: 1,
    kind: 'CUSTOM',
    records,
  });
  check(
    (await importCollectibles(manifest([custom]), 'PRIVATE_ADMIN_ID', inspect))
      .created === 1,
    'Custom draft created',
  );
  check((await publicCustoms(4307)).length === 0, 'draft excluded publicly');
  check(
    (await importCollectibles(manifest([custom]), 'PRIVATE_ADMIN_ID', inspect))
      .unchanged === 1,
    'manifest replay idempotent',
  );
  await rejects(
    () => importCollectibles(manifest([custom, custom]), 'admin', inspect),
    'duplicate manifest rejected',
  );
  await rejects(
    () =>
      importCollectibles(
        manifest([{ ...custom, key: 'missing-token', tokenId: 4445 }]),
        'admin',
        inspect,
      ),
    'invalid token rejected',
  );
  await rejects(
    () =>
      importCollectibles(
        manifest([{ ...custom, status: 'VERIFIED', revision: 99 }]),
        'admin',
        inspect,
      ),
    'optimistic revision conflict',
  );
  await importCollectibles(
    manifest([{ ...custom, status: 'VERIFIED', revision: 1 }]),
    'PRIVATE_ADMIN_ID',
    inspect,
  );
  const publicRows = await publicCustoms(4307);
  check(publicRows.length === 1, 'verified Custom public');
  check(
    !JSON.stringify(publicRows).includes('PRIVATE_'),
    'Custom explicit public projection',
  );
  const beforeHash = createHash('sha256')
    .update(
      JSON.stringify(s, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
    )
    .digest('hex');
  const after = await db().squig.findUniqueOrThrow({ where: { id: s.id } });
  check(
    createHash('sha256')
      .update(
        JSON.stringify(after, (_k, v) =>
          typeof v === 'bigint' ? v.toString() : v,
        ),
      )
      .digest('hex') === beforeHash,
    'Custom leaves canonical Squig unchanged',
  );
  check(
    (await passport(s.id, {})).customs.length === 1,
    'verified Custom Passport projection',
  );
  check(
    (await db().squigPassportEvent.count({
      where: { eventKey: { startsWith: 'custom:verified:' } },
    })) === 1,
    'Custom Passport event durable and unique',
  );
  await saveDisplayPreference(c.id, 4307, custom.key);
  check(
    (await displayCustom(c.id, 4307))?.key === custom.key,
    'current owner display selection',
  );
  await rejects(
    () => saveDisplayPreference(other.id, 4307, custom.key),
    'non-owner cannot select display art',
  );
  const gallery = await saveGallery(c.id, {
    slug: 'alternate-gallery',
    name: 'Alternate Gallery',
    visibility: 'PUBLIC',
    items: [{ tokenId: 4307, customKey: custom.key }],
  });
  check(
    (
      await galleryView(c.slug, gallery.slug)
    )?.items[0].representation.startsWith('Official Custom'),
    'gallery verified representation',
  );
  check(
    !!(await shareCard({ kind: 'custom', entity: '4307', key: custom.key }))
      ?.variants?.[4307],
    'custom share safe asset projection',
  );
  check(
    !!(await shareCard({ kind: 'collector', entity: c.slug }))
      ?.variants?.[4307],
    'Collector preferred display in shares',
  );
  await db().squigOwnership.update({
    where: { sourceKey: 'phase7-current' },
    data: { walletAddress: '0x' + '8'.repeat(40) },
  });
  check(
    (await displayCustom(c.id, 4307)) === null,
    'transfer invalidates former owner preference',
  );
  check(
    (await galleryView(c.slug, gallery.slug))?.items.length === 0,
    'transferred gallery Squig hidden',
  );
  await db().squigOwnership.update({
    where: { sourceKey: 'phase7-current' },
    data: { walletAddress: wallet, sourceKey: 'phase7-new-epoch' },
  });
  check(
    (await displayCustom(c.id, 4307)) === null,
    'returning owner must choose again after transfer',
  );
  await saveDisplayPreference(c.id, 4307, custom.key);
  await importCollectibles(
    manifest([{ ...custom, status: 'RETIRED', revision: 2 }]),
    'admin',
    inspect,
  );
  check(
    (await shareCard({ kind: 'custom', entity: '4307', key: custom.key })) ===
      null,
    'retired Custom share inaccessible',
  );
  check(
    (await displayCustom(c.id, 4307)) === null,
    'retirement falls back to Original',
  );
  check(
    (await galleryView(c.slug, gallery.slug))?.items[0].representation ===
      'Original',
    'retired gallery representation falls back',
  );
  await rejects(
    () =>
      importCollectibles(
        manifest([{ ...custom, status: 'VERIFIED', revision: 3 }]),
        'admin',
        inspect,
      ),
    'retirement cannot erase history',
  );
  check(
    (await db().collectibleAudit.count({ where: { kind: 'CUSTOM' } })) === 3,
    'create verify retire audit retained',
  );
  await importCollectibles(
    manifest([{ ...custom, key: 'phase7-live-custom', status: 'VERIFIED' }]),
    'admin',
    inspect,
  );
  await saveDisplayPreference(c.id, 4307, 'phase7-live-custom');
  const edition = {
    slug: 'phase7-edition',
    name: 'The Companion',
    imageUri: uri,
    source: 'Reviewed test manifest',
    sourceReference: 'PRIVATE_EDITION_SOURCE',
    status: 'VERIFIED',
    relatedTokens: [4307],
  };
  await importCollectibles(
    { version: 1, kind: 'EDITION', records: [edition] },
    'admin',
    inspect,
  );
  check(
    (await editionCatalog()).items.length === 1,
    'official Edition catalog',
  );
  check(
    (await editionDetail(edition.slug))?.relatedTokens[0] === 4307,
    'Edition explicit Reloaded relation',
  );
  check(
    (await ownedEditions(c.id)).length === 0,
    'catalog entry does not fabricate ownership',
  );
  await rejects(
    () => refreshEditionOwnership(edition.slug, c.id),
    'off-chain ownership unavailable',
  );
  const onchain = {
    ...edition,
    slug: 'phase7-onchain',
    standard: 'ERC721',
    chainId: 1,
    contractAddress: '0x' + 'a'.repeat(40),
    tokenId: '7',
    supply: 1,
  };
  await importCollectibles(
    { version: 1, kind: 'EDITION', records: [onchain] },
    'admin',
    inspect,
  );
  const fake = {
    getChainId: async () => 1,
    getBlock: async () => ({ number: 100n, hash: '0x' + 'b'.repeat(64) }),
    getCode: async () => '0x1234',
    readContract: async () => wallet,
  } as unknown as Parameters<typeof refreshEditionOwnership>[2];
  await refreshEditionOwnership(onchain.slug, c.id, fake);
  check(
    (await ownedEditions(c.id)).length === 1,
    'supported adapter verifies ownerOf evidence',
  );
  check(
    (await ownedEditions(c.id, true)).length === 1,
    'public opted-in Edition ownership',
  );
  await db().collector.update({
    where: { id: c.id },
    data: { collectionVisibility: 'FEATURED_ONLY' },
  });
  check(
    (await ownedEditions(c.id, true)).length === 0,
    'featured-only privacy hides full Edition holdings',
  );
  await db().collector.update({
    where: { id: c.id },
    data: { collectionVisibility: 'FULL' },
  });
  await db().editionOwnership.updateMany({ data: { verifiedAt: new Date(0) } });
  check(
    (await ownedEditions(c.id)).length === 0,
    'stale Edition evidence cannot claim current ownership',
  );
  check(
    !JSON.stringify(await exportCollectibles('CUSTOM')).includes(
      'PRIVATE_ADMIN_ID',
    ),
    'catalog export excludes actor IDs',
  );
  await seedCosmetics();
  const achievement = await db().achievementDefinition.findFirstOrThrow({
    where: { subjectType: 'COLLECTOR', ruleset: 'uglydex-progression-v1' },
  });
  await db().collectorAchievement.create({
    data: {
      collectorId: c.id,
      achievementId: achievement.id,
      awardedAt: new Date(),
      gateSatisfied: true,
      evidence: { test: true },
    },
  });
  await db().progressionJob.upsert({
    where: {
      subjectType_subjectId: { subjectType: 'COLLECTOR', subjectId: c.id },
    },
    create: { subjectType: 'COLLECTOR', subjectId: c.id },
    update: {},
  });
  check(
    !(await cosmeticAvailability(c.id)).includes('accent-amber'),
    'pending progression suppresses earned cosmetic',
  );
  // Fixture simulates settled evaluation; production uses the existing replay worker.
  await db().progressionJob.deleteMany({
    where: { subjectType: 'COLLECTOR', subjectId: c.id },
  });
  check(
    (await cosmeticAvailability(c.id)).includes('accent-amber'),
    'achievement entitlement',
  );
  await db().collectorAchievement.update({
    where: {
      collectorId_achievementId: {
        collectorId: c.id,
        achievementId: achievement.id,
      },
    },
    data: { revokedAt: new Date() },
  });
  check(
    !(await cosmeticAvailability(c.id)).includes('accent-amber'),
    'revoked achievement loses entitlement',
  );
  const set = await db().collectionSetDefinition.findFirstOrThrow({
    where: { ruleset: 'uglydex-collection-v1', enabled: true },
  });
  await db().collectorSetProgress.create({
    data: {
      collectorId: c.id,
      setId: set.id,
      currentlyComplete: true,
      progress: { test: true },
    },
  });
  await db().collectionJob.upsert({
    where: { collectorId: c.id },
    create: { collectorId: c.id },
    update: {},
  });
  check(
    !(await cosmeticAvailability(c.id)).includes('frame-set'),
    'pending collection evaluation suppresses earned cosmetic',
  );
  await db().collectionJob.deleteMany({ where: { collectorId: c.id } });
  check(
    (await cosmeticAvailability(c.id)).includes('frame-set'),
    'set entitlement',
  );
  await db().collectorSetProgress.update({
    where: { collectorId_setId: { collectorId: c.id, setId: set.id } },
    data: { currentlyComplete: false },
  });
  check(
    !(await cosmeticAvailability(c.id)).includes('frame-set'),
    'lost current set entitlement',
  );
  check((await appearance(c.id)).theme === 'classic', 'default appearance');
  const prefs = {
    PROFILE_THEME: 'theme-labs',
    PROFILE_ACCENT: 'accent-violet',
    CARD_FRAME: 'frame-classic',
    GALLERY_STYLE: 'gallery-labs',
    SHARE_STYLE: 'share-ugly',
  };
  await saveAppearance(c.id, prefs);
  check((await appearance(c.id)).theme === 'labs', 'free theme selection');
  await rejects(
    () => saveAppearance(c.id, { ...prefs, CARD_FRAME: 'frame-legendary' }),
    'locked frame rejected',
  );
  await db().squig.update({ where: { id: s.id }, data: { legendary: true } });
  check(
    (await cosmeticAvailability(c.id)).includes('frame-legendary'),
    'Legendary ownership entitlement',
  );
  await saveAppearance(c.id, { ...prefs, CARD_FRAME: 'frame-legendary' });
  await db().squigOwnership.update({
    where: { sourceKey: 'phase7-new-epoch' },
    data: { isCurrent: false },
  });
  check(
    (await appearance(c.id)).frame === 'classic',
    'lost entitlement safe fallback',
  );
  await db().squigOwnership.update({
    where: { sourceKey: 'phase7-new-epoch' },
    data: { isCurrent: true },
  });
  await db().cosmeticDefinition.update({
    where: { id: 'theme-labs' },
    data: { enabled: false },
  });
  check(
    (await appearance(c.id)).theme === 'classic',
    'removed cosmetic safe fallback',
  );
  await db().cosmeticDefinition.update({
    where: { id: 'theme-labs' },
    data: { enabled: true },
  });
  check(
    !JSON.stringify(await appearance(c.id)).includes('collectorId'),
    'public cosmetic configuration contains no evidence',
  );
}
