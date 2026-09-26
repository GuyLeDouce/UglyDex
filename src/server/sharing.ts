import 'server-only';
import type { Metadata } from 'next';
import { db } from './db';
import { readEnv } from './env';
import {
  shareSchema,
  shareQuery,
  stableShuffle,
  type ShareSpec,
  type ShareCard,
} from '@/domain/sharing';
import { catalogScope } from './collections';
import { eligibleGalleryTokens, galleryView } from './galleries';
import { progressionView } from './progression';
import { dexView } from './dex';
import { RULESET } from '@/domain/progression';
import { COLLECTION_RULESET } from '@/domain/dex';
import { ecosystemSummary } from './activity';
import { appearance } from './cosmetics';
import { displayCustom } from './collectibles';
export function absoluteUrl(path: string) {
  return new URL(path, readEnv().PUBLIC_BASE_URL).href;
}
// Explicit allowlisted presentation DTO. No identity credentials, evidence JSON or raw source IDs.
export async function shareCard(
  input: unknown,
  viewerId?: string,
): Promise<ShareCard | null> {
  const q = shareSchema.parse(input);
  const generic = {
    stats: [] as string[],
    badges: [] as string[],
    tokens: [] as number[],
    indexable: true,
  };
  if (q.kind === 'custom') {
    const n = Number(q.entity);
    if (!Number.isInteger(n) || n < 1 || n > 4444 || !q.key) return null;
    const custom = await db().squigCustom.findFirst({
      where: {
        key: q.key,
        status: 'VERIFIED',
        squig: { ...catalogScope, tokenId: n },
      },
      select: {
        key: true,
        name: true,
        artist: true,
        description: true,
        issuedAt: true,
        artwork: { select: { uri: true, sha256: true } },
      },
    });
    if (!custom) return null;
    return {
      ...generic,
      title: 'Squig #' + n,
      eyebrow: 'OFFICIAL CUSTOM',
      description: custom.name,
      stats: custom.artist ? ['Art by ' + custom.artist] : [],
      badges: ['UglyDex presentation · original NFT unchanged'],
      tokens: [n],
      variants: { [n]: custom.artwork },
      path:
        '/share?' +
        shareQuery({ kind: 'custom', entity: String(n), key: custom.key }),
      ...(custom.issuedAt ? { date: custom.issuedAt.toISOString() } : {}),
    };
  }
  if (q.kind === 'squig' || q.kind === 'passport') {
    const n = Number(q.entity);
    if (!Number.isInteger(n) || n < 1 || n > 4444) return null;
    const s = await db().squig.findFirst({
      where: { ...catalogScope, tokenId: n },
      select: {
        id: true,
        tokenId: true,
        uglyPoints: true,
        mawRank: true,
        provenance: true,
      },
    });
    if (!s) return null;
    const p = await progressionView('SQUIG', s.id, true);
    const stats = [
      ...(p?.status === 'ready' ? ['Level ' + p.level] : []),
      ...(s.uglyPoints !== null
        ? [s.uglyPoints.toString() + ' UglyPoints']
        : []),
      ...(s.mawRank !== null ? ['Maw Rank #' + s.mawRank] : []),
    ];
    if (q.kind === 'passport') {
      const e = await ecosystemSummary({ squigId: s.id, public: true });
      if (e.duels.played)
        stats.push(e.duels.played + ' tracked Duels', e.duels.wins + ' wins');
      if (s.provenance?.complete && !s.provenance.dirty)
        stats.push(s.provenance.transferCount + ' transfers');
    }
    return {
      ...generic,
      title: 'Squig #' + n,
      eyebrow:
        q.kind === 'passport' ? 'EVERY SQUIG HAS A STORY' : 'SQUIGS RELOADED',
      description: 'Traits, provenance and a beautifully strange history.',
      stats: stats.slice(0, 6),
      badges:
        p?.status === 'ready'
          ? p.cards
              .filter((a) => a.unlocked)
              .slice(0, 3)
              .map((a) => a.name)
          : [],
      tokens: [n],
      path:
        q.kind === 'passport'
          ? '/share?' + shareQuery({ kind: q.kind, entity: String(n) })
          : '/squig/' + n,
    };
  }
  const c = await db().collector.findUnique({
    where: { slug: q.entity },
    select: {
      id: true,
      slug: true,
      displayName: true,
      isPublic: true,
      collectionVisibility: true,
      featuredTokenIds: true,
      showWallets: true,
    },
  });
  if (!c || (!c.isPublic && c.id !== viewerId)) return null;
  const name = c.displayName || c.slug,
    base = '/collector/' + c.slug;
  if (q.kind === 'gallery') {
    if (!q.key) return null;
    const g = await galleryView(c.slug, q.key, viewerId);
    if (!g) return null;
    return {
      ...generic,
      title: g.name,
      eyebrow: 'A GALLERY BY ' + name,
      description:
        g.description || 'A personally curated Squigs Reloaded exhibition.',
      tokens: g.coverTokenId
        ? [g.coverTokenId]
        : g.items.slice(0, 9).map((i) => i.tokenId),
      stats: [
        g.mode === 'CURRENT_COLLECTION'
          ? 'Current collection'
          : 'Discovered history',
      ],
      path: base + '/gallery/' + g.slug,
      indexable: g.indexable,
      variants: Object.fromEntries(
        g.items.filter((i) => i.variant).map((i) => [i.tokenId, i.variant!]),
      ),
      appearance: { accent: g.appearance.accent, share: g.appearance.share },
      badges: g.items.some((i) => i.variant)
        ? ['Includes Official Custom artwork']
        : [],
    };
  }
  // Only an explicit authenticated owner preview may use private projections.
  const publicView = c.id !== viewerId;
  const [p, d] = await Promise.all([
    progressionView('COLLECTOR', c.id, publicView),
    dexView(c.id, publicView),
  ]);
  const owned = await eligibleGalleryTokens(c.id, 'CURRENT_COLLECTION');
  const permitTokens = c.id === viewerId || c.collectionVisibility !== 'HIDDEN';
  const featured = permitTokens
    ? c.featuredTokenIds.filter((n) => owned.current.includes(n))
    : [];
  let card: ShareCard = {
    ...generic,
    title: name,
    eyebrow: 'UGLYDEX COLLECTOR',
    description: 'Still ugly. Still hunting.',
    path: base,
    indexable: c.isPublic,
    tokens: featured.slice(0, 4),
    stats: [
      ...(p?.status === 'ready' ? ['Level ' + p.level] : []),
      ...(d?.status === 'ready'
        ? [
            d.score.overall.toFixed(1) + '% UglyDex complete',
            d.discovered + ' Squigs discovered',
          ]
        : []),
    ],
    badges:
      p?.status === 'ready'
        ? [...(p.title ? [p.title] : []), ...p.featured].slice(0, 4)
        : [],
  };
  if (q.kind === 'completion') {
    if (d?.status !== 'ready') return null;
    card = {
      ...card,
      eyebrow: 'THE FIELD GUIDE',
      title: name + '’s UglyDex',
      stats: [
        d.score.overall.toFixed(1) + '% COMPLETE',
        d.discovered + ' / 4,444 Squigs',
        d.traits + ' / ' + d.traitTotal + ' traits',
        d.historicalSets + ' / ' + d.historicalTotal + ' historical sets',
      ],
      badges: [],
      path: '/share?' + shareQuery({ kind: q.kind, entity: c.slug }),
    };
  } else if (q.kind === 'trophy') {
    card = {
      ...card,
      eyebrow: 'TROPHY CASE',
      badges: [
        ...card.badges,
        ...(d?.status === 'ready'
          ? d.cards.filter((s) => s.featured).map((s) => s.name)
          : []),
      ].slice(0, 7),
      path: '/share?' + shareQuery({ kind: q.kind, entity: c.slug }),
    };
  } else if (q.kind === 'achievement') {
    const a =
      p?.status === 'ready'
        ? p.cards.find((a) => a.key === q.key && a.unlocked)
        : null;
    if (!a) return null;
    card = {
      ...card,
      title: a.name,
      eyebrow: 'UNLOCKED BY ' + name,
      description: a.description,
      date: a.at ?? undefined,
      stats: [a.tier + ' achievement'],
      badges: [],
      path:
        '/share?' + shareQuery({ kind: q.kind, entity: c.slug, key: q.key }),
    };
  } else if (q.kind === 'set') {
    const s =
      d?.status === 'ready'
        ? d.cards.find((s) => s.key === q.key && s.complete && s.revealed)
        : null;
    if (!s) return null;
    card = {
      ...card,
      title: s.name,
      eyebrow: 'COMPLETED BY ' + name,
      description: s.description,
      date: s.completedAt ?? undefined,
      stats: [
        s.mode === 'CURRENT_HOLDING'
          ? 'Currently complete'
          : 'Historical discovery complete',
      ],
      badges: [],
      tokens:
        c.collectionVisibility === 'HIDDEN' && c.id !== viewerId
          ? []
          : [...new Set(s.requirements.flatMap((r) => r.tokens))]
              .sort((a, b) => a - b)
              .slice(0, 16),
      path:
        '/share?' + shareQuery({ kind: q.kind, entity: c.slug, key: q.key }),
    };
  } else if (q.kind === 'collage') {
    if (!permitTokens) return null;
    const allowed =
      c.id === viewerId || c.collectionVisibility === 'FULL'
        ? owned.current
        : featured;
    let tokens: number[];
    if (q.tokens) {
      tokens = q.tokens.split(',').map(Number);
      if (
        ![4, 9, 16].includes(tokens.length) ||
        new Set(tokens).size !== tokens.length ||
        tokens.some((t) => !allowed.includes(t))
      )
        return null;
    } else if (q.preset === 'featured') tokens = featured.slice(0, q.count);
    else if (q.preset === 'random')
      tokens = stableShuffle(allowed, q.seed).slice(0, q.count);
    else {
      const rows = await db().squig.findMany({
        where: { ...catalogScope, tokenId: { in: allowed } },
        orderBy:
          q.preset === 'points'
            ? [
                { uglyPoints: { sort: 'desc', nulls: 'last' } },
                { tokenId: 'asc' },
              ]
            : [{ tokenId: 'asc' }],
        select: {
          tokenId: true,
          ownerships: {
            where: { isCurrent: true },
            select: { observedAt: true, acquiredAt: true },
            take: 1,
          },
        },
      });
      if (q.preset === 'recent')
        rows.sort(
          (a, b) =>
            ((
              b.ownerships[0]?.acquiredAt ?? b.ownerships[0]?.observedAt
            )?.getTime() ?? 0) -
              ((
                a.ownerships[0]?.acquiredAt ?? a.ownerships[0]?.observedAt
              )?.getTime() ?? 0) || a.tokenId - b.tokenId,
        );
      tokens = rows.slice(0, q.count).map((s) => s.tokenId);
    }
    if (!tokens.length) return null;
    card = {
      ...card,
      eyebrow: 'COLLECTION COLLAGE',
      description: 'A few of my favourite freaks.',
      stats: [tokens.length + ' currently owned Squigs'],
      tokens,
      badges: [],
      path:
        '/share?' +
        shareQuery({
          kind: q.kind,
          entity: c.slug,
          preset: q.preset,
          count: q.count,
          tokens: q.tokens,
          seed: q.seed,
        }),
    };
  } else if (q.kind === 'discovery') {
    const n = Number(q.key);
    if (
      d?.status !== 'ready' ||
      (publicView &&
        (!c.showWallets ||
          !permitTokens ||
          (c.collectionVisibility === 'FEATURED_ONLY' &&
            !featured.includes(n))))
    )
      return null;
    const privateDex = await dexView(c.id);
    if (privateDex?.status !== 'ready' || !privateDex.discoveredIds.includes(n))
      return null;
    const discovery = await db().squigDiscovery.findFirst({
      where: {
        collectorId: c.id,
        squig: { ...catalogScope, tokenId: n },
        everOwned: true,
        attributionStatus: 'CONFIRMED',
      },
      select: { discoveredAt: true },
    });
    if (!discovery) return null;
    card = {
      ...card,
      title: 'Squig #' + n,
      eyebrow: 'NEW UGLY DISCOVERED BY ' + name,
      description: 'Another strange story in the field guide.',
      date: discovery.discoveredAt.toISOString(),
      tokens: [n],
      stats: [],
      badges: [],
      path:
        '/share?' + shareQuery({ kind: q.kind, entity: c.slug, key: q.key }),
    };
  } else if (
    q.kind === 'milestone' &&
    /^level:[1-9][0-9]{0,4}$/.test(q.key ?? '')
  ) {
    if (p?.status !== 'ready') return null;
    const level = Number(q.key!.split(':')[1]);
    const m = await db().progressionMilestone.findUnique({
      where: {
        ruleset_subjectType_subjectId_level: {
          ruleset: RULESET,
          subjectType: 'COLLECTOR',
          subjectId: c.id,
          level,
        },
      },
    });
    if (!m) return null;
    card = {
      ...card,
      title: 'Level ' + level,
      eyebrow: 'MILESTONE BY ' + name,
      description: 'Real history. Lasting character.',
      date: m.reachedAt.toISOString(),
      stats: [],
      badges: [],
      path:
        '/share?' + shareQuery({ kind: q.kind, entity: c.slug, key: q.key }),
    };
  } else if (q.kind === 'milestone') {
    if (
      d?.status !== 'ready' ||
      !/^completion:(1|5|10|25|50|75|90|100)$/.test(q.key ?? '')
    )
      return null;
    const m = await db().collectionMilestone.findUnique({
      where: {
        ruleset_collectorId_key: {
          ruleset: COLLECTION_RULESET,
          collectorId: c.id,
          key: q.key!,
        },
      },
    });
    if (!m || m.revokedAt) return null;
    card = {
      ...card,
      title: q.key!.split(':')[1] + '% UglyDex',
      eyebrow: 'MILESTONE BY ' + name,
      description: 'A field guide built from real discoveries.',
      date: m.reachedAt.toISOString(),
      stats: [],
      badges: [],
      path:
        '/share?' + shareQuery({ kind: q.kind, entity: c.slug, key: q.key }),
    };
  }
  const style = await appearance(c.id);
  card.appearance = { accent: style.accent, share: style.share };
  // Selected artwork is a current-owner preference, never historical evidence.
  const variants = await Promise.all(
    card.tokens.map(async (n) => ({
      token: n,
      art: await displayCustom(c.id, n),
    })),
  );
  card.variants = Object.fromEntries(
    variants
      .filter((v) => v.art)
      .map((v) => [v.token, { uri: v.art!.uri, sha256: v.art!.sha256 }]),
  );
  if (variants.some((v) => v.art))
    card.badges = [...card.badges.slice(0, 3), 'Official Custom artwork'];
  return card;
}
export async function shareMetadata(
  spec: Partial<ShareSpec> & { entity: string },
): Promise<Metadata> {
  try {
    const q = shareSchema.parse(spec),
      c = await shareCard(q);
    if (!c)
      return { title: 'UglyDex', robots: { index: false, follow: false } };
    const url = absoluteUrl(c.path),
      image = absoluteUrl('/api/share?' + shareQuery(q));
    return {
      title: c.title + ' | UglyDex',
      description: c.description,
      alternates: { canonical: url },
      robots: { index: c.indexable, follow: c.indexable },
      openGraph: {
        title: c.title,
        description: c.description,
        url,
        images: [
          {
            url: image,
            width: q.ratio === 'square' ? 1080 : 1200,
            height: q.ratio === 'square' ? 1080 : 630,
          },
        ],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: c.title,
        description: c.description,
        images: [image],
      },
    };
  } catch {
    return { title: 'UglyDex', robots: { index: false, follow: false } };
  }
}
