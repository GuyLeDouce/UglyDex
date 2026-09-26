import { db } from '../../src/server/db';
import {
  saveGallery,
  galleryView,
  galleryList,
  deleteGallery,
} from '../../src/server/galleries';
import { shareCard, shareMetadata } from '../../src/server/sharing';
import { shareLimit } from '../../src/server/share-cache';
import { renderShare, renderShareSafe } from '../../src/server/share-render';
import { rebuildCollection } from '../../src/server/dex-engine';
import { rebuildSubject } from '../../src/server/progression-engine';
import { SQUIGS_CONTRACT } from '../../src/domain/validation';
import { gallerySchema, shareSchema } from '../../src/domain/sharing';
import { writeFile } from 'node:fs/promises';
export async function phase6DatabaseTests(
  check: (v: unknown, m: string) => void,
) {
  const c = await db().collector.create({
      data: {
        slug: 'sharing-test',
        displayName: 'The Ugly Exhibition',
        isPublic: true,
        featuredTokenIds: [4201, 4202, 4203, 4204],
      },
    }),
    other = await db().collector.create({ data: { slug: 'sharing-private' } });
  const wallet = '0x0000000000000000000000000000000000066666';
  await db().collectorWallet.create({
    data: {
      collectorId: c.id,
      walletAddress: wallet,
      chainId: 1,
      verifiedAt: new Date('2026-01-01'),
      source: 'SIGNATURE',
    },
  });
  for (const tokenId of [4201, 4202, 4203, 4204]) {
    const s = await db().squig.upsert({
      where: {
        chainId_contractAddress_tokenId: {
          chainId: 1,
          contractAddress: SQUIGS_CONTRACT,
          tokenId,
        },
      },
      create: { chainId: 1, contractAddress: SQUIGS_CONTRACT, tokenId },
      update: {},
    });
    await db().squigProvenance.upsert({
      where: { squigId: s.id },
      create: {
        squigId: s.id,
        dirty: false,
        complete: true,
        mintAt: new Date('2026-01-01'),
      },
      update: { dirty: false, complete: true },
    });
    await db().collectorOwnershipPeriod.create({
      data: {
        id: 'sharing-period-' + tokenId,
        collectorId: c.id,
        squigId: s.id,
        acquiredAt: new Date('2026-02-01'),
        acquisitionEvent: 'sharing-mint-' + tokenId,
        evidenceIds: ['PRIVATE_EVIDENCE'],
        walletAddresses: [wallet],
      },
    });
    await db().squigDiscovery.create({
      data: {
        collectorId: c.id,
        squigId: s.id,
        everOwned: true,
        attributionStatus: 'CONFIRMED',
        firstOwnershipPeriod: 'sharing-period-' + tokenId,
        discoveredAt: new Date('2026-02-01'),
        sourceKey: 'sharing-' + tokenId,
      },
    });
    await db().squigOwnership.create({
      data: {
        squigId: s.id,
        walletAddress: wallet,
        isCurrent: true,
        sourceKey: 'sharing-own-' + tokenId,
        source: 'chain',
        blockNumber: 1n,
        blockHash: 'fixture',
        acquiredAt: new Date('2026-02-01'),
      },
    });
  }
  await rebuildCollection(c.id);
  await rebuildSubject('COLLECTOR', c.id);
  const input = gallerySchema.parse({
    slug: 'my-freaks',
    name: 'The Favourite Freaks',
    visibility: 'PUBLIC',
    featured: true,
    items: [4201, 4202, 4203, 4204].map((tokenId) => ({
      tokenId,
      caption:
        tokenId === 4201
          ? '<script>PRIVATE_JS()</script>'
          : 'A beautiful disaster.',
      section: 'The originals',
    })),
  });
  const g = await saveGallery(c.id, input);
  check(!!g.id, 'gallery create');
  let view = await galleryView(c.slug, g.slug);
  check(view?.items.length === 4, 'public gallery canonical items');
  check(view?.items[0].currentlyOwned, 'current ownership label');
  check(
    !JSON.stringify(view).includes(wallet) &&
      !JSON.stringify(view).includes('PRIVATE_EVIDENCE'),
    'gallery DTO excludes attribution and wallet',
  );
  let denied = false;
  try {
    await saveGallery(other.id, { ...input, id: g.id, revision: 1 });
  } catch {
    denied = true;
  }
  check(denied, 'gallery update owner check');
  denied = false;
  try {
    await saveGallery(c.id, {
      ...input,
      slug: 'bad-ownership',
      items: [{ tokenId: 1 }],
    });
  } catch {
    denied = true;
  }
  check(denied, 'gallery cannot contain arbitrary token');
  await saveGallery(c.id, {
    ...input,
    id: g.id,
    revision: 1,
    items: [...input.items].reverse(),
    coverTokenId: 4204,
  });
  view = await galleryView(c.slug, g.slug);
  check(
    view?.items[0].tokenId === 4204 && view.coverTokenId === 4204,
    'order and cover saved',
  );
  denied = false;
  try {
    await saveGallery(c.id, { ...input, id: g.id, revision: 1 });
  } catch {
    denied = true;
  }
  check(denied, 'stale edit rejected');
  const unlisted = await saveGallery(c.id, {
    ...input,
    slug: 'secret-freaks',
    visibility: 'UNLISTED',
    featured: false,
  });
  check(!!(await galleryView(c.slug, unlisted.slug)), 'unlisted direct link');
  check(
    !(await galleryList(c.id)).some((g) => g.slug === unlisted.slug),
    'unlisted absent from listing',
  );
  const unlistedMeta = await shareMetadata({
    kind: 'gallery',
    entity: c.slug,
    key: unlisted.slug,
  });
  check(
    typeof unlistedMeta.robots === 'object' &&
      unlistedMeta.robots?.index === false,
    'unlisted metadata explicitly disables indexing',
  );
  const priv = await saveGallery(c.id, {
    ...input,
    slug: 'private-freaks',
    visibility: 'PRIVATE',
    featured: false,
  });
  check(!(await galleryView(c.slug, priv.slug)), 'private gallery blocked');
  check(
    !!(await galleryView(c.slug, priv.slug, c.id)),
    'private gallery owner',
  );
  check(
    !(await galleryView(c.slug, priv.slug, other.id)),
    'private gallery nonowner',
  );
  denied = false;
  try {
    await saveGallery(c.id, { ...input, slug: 'MY-FREAKS' });
  } catch {
    denied = true;
  }
  check(denied, 'case insensitive slug uniqueness');
  const get = (kind: string, key?: string) =>
    shareCard({ kind, entity: c.slug, ...(key ? { key } : {}) });
  for (const kind of ['collector', 'completion', 'trophy', 'collage'])
    check(!!(await get(kind)), 'share projection ' + kind);
  check(!!(await get('gallery', g.slug)), 'gallery card');
  check(!!(await get('set', 'first-specimen')), 'completed set card');
  check(!(await get('set', 'living-library')), 'unearned set rejected');
  check(
    !(await get('achievement', 'does-not-exist')),
    'unearned achievement rejected',
  );
  check(
    !(await get('discovery', '4201')),
    'hidden wallet discovery association withheld',
  );
  await db().collector.update({
    where: { id: c.id },
    data: { showWallets: true },
  });
  check(!!(await get('discovery', '4201')), 'confirmed discovery card');
  await db().collector.update({
    where: { id: c.id },
    data: { collectionVisibility: 'FEATURED_ONLY', featuredTokenIds: [4202] },
  });
  check(
    !(await get('discovery', '4201')),
    'featured-only discovery cannot expose unfeatured Squig',
  );
  check(
    !!(await get('discovery', '4202')),
    'featured discovery remains shareable',
  );
  check(
    (await get('set', 'first-specimen'))?.tokens.length === 0,
    'featured-only set hides qualifying token evidence',
  );
  check(
    (
      await shareCard({ kind: 'collage', entity: c.slug, preset: 'points' })
    )?.tokens.join(',') === '4202',
    'featured-only collage limits every preset',
  );
  check(
    !!(await shareCard(
      { kind: 'discovery', entity: c.slug, key: '4201' },
      c.id,
    )),
    'explicit owner preview can include unfeatured discovery',
  );
  await db().collector.update({
    where: { id: c.id },
    data: {
      collectionVisibility: 'FULL',
      featuredTokenIds: [4201, 4202, 4203, 4204],
    },
  });
  check(
    !!(await get('milestone', 'completion:1')) ===
      process.argv.includes('--catalog'),
    'completion milestone requires enough indexed discovery evidence',
  );
  check(
    !(await get('milestone', 'completion:100')),
    'unearned completion milestone rejected',
  );
  check(!!(await get('milestone', 'level:2')), 'durable level milestone card');
  check(
    !(await get('milestone', 'level:99999')),
    'unearned level milestone rejected',
  );
  const squareMeta = await shareMetadata({ entity: c.slug, ratio: 'square' });
  check(
    JSON.stringify(squareMeta.openGraph).includes('"height":1080'),
    'square metadata matches rendered dimensions',
  );
  check(
    (await get('trophy'))?.path.startsWith('/share?kind=trophy'),
    'trophy link retains its own social preview',
  );
  check(
    !(await shareCard({ kind: 'squig', entity: '4445' })),
    'invalid Squig card',
  );
  check(
    !!(await shareCard({ kind: 'squig', entity: '4201' })),
    'indexed Squig card',
  );
  check(
    !!(await shareCard({ kind: 'passport', entity: '4201' })),
    'passport card',
  );
  const manual = await shareCard({
    kind: 'collage',
    entity: c.slug,
    tokens: '4204,4203,4202,4201',
  });
  check(
    manual?.tokens.join(',') === '4204,4203,4202,4201',
    'manual collage order',
  );
  check(
    !(await shareCard({ kind: 'collage', entity: c.slug, tokens: '1,2,3,4' })),
    'collage ownership enforced',
  );
  for (const preset of ['points', 'recent', 'random', 'featured'])
    check(
      (await shareCard({ kind: 'collage', entity: c.slug, preset }))?.tokens
        .length === 4,
      'collage preset ' + preset,
    );
  await db().collector.update({
    where: { id: c.id },
    data: { collectionVisibility: 'HIDDEN', showWallets: false },
  });
  check(
    (await get('collector'))?.tokens.length === 0,
    'hidden collection suppresses share artwork',
  );
  check(!(await get('collage')), 'hidden collection blocks public collage');
  check(
    !!(await shareCard({ kind: 'collage', entity: c.slug }, c.id)),
    'owner collage preview',
  );
  check(
    (
      await shareCard(
        { kind: 'set', entity: c.slug, key: 'first-specimen' },
        c.id,
      )
    )?.tokens.length,
    'owner preview uses permitted private set projection',
  );
  check(
    !!(await shareCard(
      { kind: 'discovery', entity: c.slug, key: '4201' },
      c.id,
    )),
    'owner discovery preview works without public attribution consent',
  );
  check(
    !!(await galleryView(c.slug, g.slug)),
    'explicit public gallery independent of hidden collection',
  );
  await db().collector.update({
    where: { id: c.id },
    data: { isPublic: false },
  });
  check(!(await get('collector')), 'private profile card unavailable');
  check(
    !(await galleryView(c.slug, g.slug)) &&
      !(await galleryView(c.slug, unlisted.slug)),
    'private profile hides public and unlisted',
  );
  check(
    !!(await shareCard({ entity: c.slug }, c.id)),
    'private owner safe projection',
  );
  check(
    !(await shareCard({ entity: c.slug }, other.id)),
    'private other viewer denied',
  );
  await db().collector.update({
    where: { id: c.id },
    data: { isPublic: true, collectionVisibility: 'FULL' },
  });
  const historic = await saveGallery(c.id, {
    ...input,
    slug: 'history-freaks',
    mode: 'DISCOVERED_HISTORY',
    featured: false,
  });
  await db().squigOwnership.updateMany({
    where: { sourceKey: 'sharing-own-4201' },
    data: { isCurrent: false },
  });
  await rebuildCollection(c.id);
  check(
    (await galleryView(c.slug, g.slug))?.items.length === 3,
    'sold item hidden in current gallery',
  );
  check(
    (await galleryView(c.slug, historic.slug))?.items.find(
      (i) => i.tokenId === 4201,
    )?.currentlyOwned === false,
    'historical gallery preserves previously owned',
  );
  await db().squigDiscovery.updateMany({
    where: { collectorId: c.id, squig: { tokenId: 4201 } },
    data: { everOwned: false, attributionStatus: 'INVALIDATED' },
  });
  await rebuildCollection(c.id);
  check(
    (await galleryView(c.slug, historic.slug))?.items.length === 3,
    'invalidated discovery removed',
  );
  await deleteGallery(other.id, priv.id);
  check(
    !!(await galleryView(c.slug, priv.slug, c.id)),
    'cannot delete another gallery',
  );
  await deleteGallery(c.id, priv.id);
  check(!(await galleryView(c.slug, priv.slug, c.id)), 'gallery deletion');
  check(
    (await db().squig.count({ where: { tokenId: 4201 } })) > 0,
    'delete preserves Squig',
  );
  await shareLimit('test-budget', 1);
  denied = false;
  try {
    await shareLimit('test-budget', 1);
  } catch {
    denied = true;
  }
  check(denied, 'shared rate limit');
  const card = (await get('collector'))!;
  const broken = await renderShareSafe(
    { ...card, tokens: [4202] },
    shareSchema.parse({ entity: c.slug }),
    { 4202: 'data:image/png;base64,iVBORw0KGgo=' },
  );
  check(broken.bytes.length > 100, 'corrupt artwork cannot crash card');
  for (const ratio of ['landscape', 'square'] as const) {
    const response = renderShare(
        card,
        shareSchema.parse({ entity: c.slug, ratio }),
        {},
      ),
      bytes = Buffer.from(await response.arrayBuffer());
    check(
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'real PNG ' + ratio,
    );
    check(
      bytes.readUInt32BE(16) === (ratio === 'square' ? 1080 : 1200),
      'PNG width ' + ratio,
    );
    check(
      bytes.readUInt32BE(20) === (ratio === 'square' ? 1080 : 630),
      'PNG height ' + ratio,
    );
    await writeFile('.data/phase6-' + ratio + '.png', bytes);
  }
  for (const count of [4, 9, 16])
    for (const template of ['clean', 'ugly', 'stats'] as const) {
      const rendered = renderShare(
        {
          ...card,
          title: 'A beautifully strange collection 🎨',
          tokens: Array.from({ length: count }, (_, i) => i + 1),
        },
        shareSchema.parse({ entity: c.slug, ratio: 'square', template }),
        {},
      );
      const bytes = Buffer.from(await rendered.arrayBuffer());
      check(
        bytes.readUInt32BE(16) === 1080,
        'square collage ' + count + ' ' + template,
      );
      if (count === 16 && template === 'clean')
        await writeFile('.data/phase6-collage16.png', bytes);
    }
  await db().collector.update({
    where: { id: c.id },
    data: { collectionVisibility: 'FULL', isPublic: true },
  });
}
