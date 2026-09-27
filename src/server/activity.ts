import { integrationConfigured } from '@/integrations/bridge-config';
import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { db } from './db';
import {
  activityDTO,
  activityFilters,
  type ActivityInput,
} from '@/domain/activity';
import { feeds } from '@/sync/normalize';
import { tables } from '@/integrations/registry';
type Scope = { collectorId?: string; squigId?: string; public?: boolean };
async function predicate(scope: Scope) {
  let privacy = Prisma.sql`TRUE`;
  if (scope.public && scope.collectorId) {
    const c = await db().collector.findUnique({
      where: { id: scope.collectorId },
      select: { isPublic: true, showDiscord: true, showWallets: true },
    });
    if (!c?.isPublic) return Prisma.sql`FALSE`;
    privacy = Prisma.sql`(a."visibility"='PUBLIC' OR a."sourceSystem"='provenance') AND ((a."discordId" IS NOT NULL AND ${c.showDiscord}) OR (a."discordId" IS NULL AND a."walletAddress" IS NOT NULL AND ${c.showWallets}) OR (a."sourceSystem"='provenance' AND ${c.showWallets}))`;
  } else if (scope.public) privacy = Prisma.sql`a."visibility"='PUBLIC'`;
  return Prisma.sql`a."recordStatus"='ACTIVE' AND ${privacy}
 AND ${scope.collectorId ? Prisma.sql`a."collectorId"=${scope.collectorId}::uuid` : Prisma.sql`TRUE`}
 AND ${scope.squigId ? Prisma.sql`a."squigId"=${scope.squigId}::uuid` : Prisma.sql`TRUE`}
 AND (a."sourceSystem"<>'provenance' OR EXISTS(SELECT 1 FROM "SquigProvenance" p WHERE p."squigId"=a."squigId" AND NOT p.dirty))
 AND NOT EXISTS(SELECT 1 FROM "ActivityAttributionJob" j WHERE j."walletAddress"=a."walletAddress" AND a."discordId" IS NULL)
 AND NOT (a."sourceType"='liveImages' AND EXISTS(SELECT 1 FROM "CollectorActivity" sub WHERE sub."sourceType"='submissions' AND (sub.metadata->>'liveImageId'=a."sourceId" OR (sub.metadata->>'imageKey' IS NOT NULL AND sub.metadata->>'imageKey'=a.metadata->>'imageKey'))))`;
}
export async function activityPage(
  scope: Scope,
  params: Record<string, string | string[] | undefined> = {},
) {
  const f = activityFilters.parse(params),
    base = await predicate(scope),
    asc = f.order === 'oldest';
  let cursor = Prisma.sql`TRUE`;
  if (f.after) {
    const [time, id] = f.after.split('~');
    if (
      !/^\d{4}-/.test(time) ||
      !Number.isFinite(Date.parse(time)) ||
      !/^[0-9a-f-]{36}$/.test(id ?? '')
    )
      throw new Error('INVALID_CURSOR');
    cursor = asc
      ? Prisma.sql`(a."eventAt",a.id)>(${new Date(time)},${id}::uuid)`
      : Prisma.sql`(a."eventAt",a.id)<(${new Date(time)},${id}::uuid)`;
  }
  const category =
    f.category === 'ALL'
      ? Prisma.sql`a.importance<>'DETAIL'`
      : f.category === 'CHARM'
        ? Prisma.sql`a.currency='CHARM' AND a.amount IS NOT NULL`
        : f.category === 'SQUIGS'
          ? Prisma.sql`a."sourceSystem"='provenance'`
          : Prisma.sql`a.category=${f.category}`;
  const rows = await db().$queryRaw<
    (Omit<ActivityInput, 'squig'> & { tokenId: number | null })[]
  >(
    Prisma.sql`SELECT a.id,a."eventType",a."eventAt",a.category,a.importance,a.metadata,a.amount,a.currency,a.direction,s."tokenId" FROM "CollectorActivity" a LEFT JOIN "Squig" s ON s.id=a."squigId" WHERE ${base} AND ${category} AND ${cursor} ORDER BY a."eventAt" ${asc ? Prisma.sql`ASC` : Prisma.sql`DESC`},a.id ${asc ? Prisma.sql`ASC` : Prisma.sql`DESC`} LIMIT 25`,
  );
  const records = rows
    .slice(0, 24)
    .map((r) => ({ ...r, squig: r.tokenId ? { tokenId: r.tokenId } : null }));
  const last = records.at(-1);
  return {
    entries: records.map(activityDTO),
    filters: f,
    next:
      rows.length > 24 && last
        ? `${last.eventAt.toISOString()}~${last.id}`
        : null,
  };
}
export async function ecosystemSummary(scope: Scope) {
  const base = await predicate(scope);
  const rows = await db().$queryRaw<
    { category: string; events: number; first: Date; latest: Date }[]
  >(
    Prisma.sql`SELECT a.category,count(*)::int events,min(a."eventAt") first,max(a."eventAt") latest FROM "CollectorActivity" a WHERE ${base} AND a.category<>'OTHER' AND a.importance<>'DETAIL' AND a."visibility"='PUBLIC' GROUP BY a.category ORDER BY a.category`,
  );
  const charm = await db().$queryRaw<{ direction: string; amount: string }[]>(
    Prisma.sql`SELECT a.direction,sum(a.amount)::text amount FROM "CollectorActivity" a WHERE ${base} AND a.currency='CHARM' AND a.amount IS NOT NULL GROUP BY a.direction`,
  );
  const duels = await db().$queryRaw<
    {
      played: number;
      wins: number;
      losses: number;
      uniqueSquigs: number;
      largest: string | null;
      first: Date | null;
      latest: Date | null;
    }[]
  >(
    Prisma.sql`SELECT count(*)::int played,count(*) FILTER(WHERE metadata->>'outcome'='WIN')::int wins,count(*) FILTER(WHERE metadata->>'outcome'='LOSS')::int losses,count(DISTINCT "squigId")::int "uniqueSquigs",max(amount)::text largest,min("eventAt") first,max("eventAt") latest FROM "CollectorActivity" a WHERE ${base} AND "eventType"='DUEL_COMPLETED'`,
  );
  const survival = await db().$queryRaw<
    {
      games: number;
      firsts: number;
      seconds: number;
      thirds: number;
      eliminations: string;
      deaths: string;
      images: string;
    }[]
  >(
    Prisma.sql`SELECT count(*)::int games,count(*) FILTER(WHERE metadata->>'placement'='1')::int firsts,count(*) FILTER(WHERE metadata->>'placement'='2')::int seconds,count(*) FILTER(WHERE metadata->>'placement'='3')::int thirds,COALESCE(sum((metadata->>'eliminations')::numeric),0)::text eliminations,COALESCE(sum((metadata->>'deaths')::numeric),0)::text deaths,COALESCE(sum((metadata->>'imagesUsed')::numeric),0)::text images FROM "CollectorActivity" a WHERE ${base} AND "eventType"='SURVIVAL_PLAYED'`,
  );
  const marketplace = await db().$queryRaw<
    { purchases: number; items: number; spent: string }[]
  >(
    Prisma.sql`SELECT count(*)::int purchases,count(DISTINCT metadata->>'itemIdentity')::int items,COALESCE(sum(amount),0)::text spent FROM "CollectorActivity" a WHERE ${base} AND "eventType"='MARKETPLACE_PURCHASE' AND metadata->>'confirmed'='true'`,
  );
  const mostUsed = await db().$queryRaw<{ tokenId: number; played: number }[]>(
    Prisma.sql`SELECT s."tokenId",count(*)::int played FROM "CollectorActivity" a JOIN "Squig" s ON s.id=a."squigId" WHERE ${base} AND a."eventType"='DUEL_COMPLETED' GROUP BY s."tokenId" ORDER BY count(*) DESC,s."tokenId" LIMIT 1`,
  );
  const creator = await db().$queryRaw<
    {
      submitted: number;
      approved: number;
      declined: number;
      rewardPoints: string;
      milestones: number;
      first: Date | null;
      latest: Date | null;
    }[]
  >(
    Prisma.sql`SELECT count(*)::int submitted,count(*) FILTER(WHERE a."eventType"='IMAGE_APPROVED')::int approved,count(*) FILTER(WHERE a.metadata->>'status'='declined')::int declined,COALESCE(sum(CASE WHEN a."eventType"='IMAGE_APPROVED' AND a.metadata->>'rewardPoints' ~ '^[0-9]+$' THEN (a.metadata->>'rewardPoints')::numeric ELSE 0 END),0)::text "rewardPoints",count(DISTINCT a.metadata->>'milestone') FILTER(WHERE a."eventType"='IMAGE_APPROVED')::int milestones,min(a."eventAt") FILTER(WHERE a."eventType"='IMAGE_APPROVED') first,max(a."eventAt") latest FROM "CollectorActivity" a WHERE ${base} AND a.category='CREATOR'`,
  );
  return {
    categories: rows,
    creator: creator[0],
    mostUsed: mostUsed[0] ?? null,
    duelWinRate: duels[0].played ? duels[0].wins / duels[0].played : null,
    charm,
    duels: duels[0],
    survival: survival[0],
    marketplace: marketplace[0],
  };
}
export async function historyFreshness() {
  const rows = await db().integrationSource.findMany({
    select: {
      id: true,
      state: true,
      lastSuccessAt: true,
      firstAvailableAt: true,
      warning: true,
    },
  });
  return feeds.map((id) => {
    const row = rows.find((r) => r.id === id);
    return {
      source: id,
      state:
        row?.state ??
        (integrationConfigured(tables[id].integration)
          ? 'UNVALIDATED'
          : 'NOT_CONFIGURED'),
      updatedAt: row?.lastSuccessAt?.toISOString() ?? null,
      availableFrom: row?.firstAvailableAt?.toISOString() ?? null,
    };
  });
}
export async function creationPage(
  scope: Scope,
  params: Record<string, string | string[] | undefined>,
) {
  const page = await activityPage(scope, { ...params, category: 'CREATOR' });
  const urls = page.entries.flatMap((e) => (e.image ? [e.image] : []));
  const uses = urls.length
    ? await db().$queryRaw<{ url: string; uses: number }[]>(
        Prisma.sql`SELECT metadata->>'imageUrl' url,count(*)::int uses FROM "CollectorActivity" WHERE "sourceType"='imageUses' AND "recordStatus"='ACTIVE' AND metadata->>'imageUrl' IN (${Prisma.join(urls)}) GROUP BY metadata->>'imageUrl'`,
      )
    : [];
  return {
    ...page,
    entries: page.entries
      .filter((e) => e.eventType === 'IMAGE_APPROVED')
      .map((e) => ({
        ...e,
        details: [
          ...e.details,
          {
            label: 'Tracked Survival uses',
            value: String(uses.find((u) => u.url === e.image)?.uses ?? 0),
          },
        ],
      })),
  };
}
