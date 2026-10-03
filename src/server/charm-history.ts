import 'server-only';
import { db } from './db';
import { Prisma } from '@/generated/prisma/client';
import { charmFilter } from '@/domain/charm';
import { activityLabels } from '@/domain/activity';
export async function charmHistory(
  collectorId: string,
  params: Record<string, string | string[] | undefined> = {},
) {
  const f = charmFilter.parse(params);
  const eligible = Prisma.sql`a."collectorId"=${collectorId}::uuid AND a."recordStatus"='ACTIVE' AND a."attributionStatus" IN ('RESOLVED','DISCORD','WALLET') AND NOT EXISTS(SELECT 1 FROM "ActivityAttributionJob" j WHERE j."walletAddress"=a."walletAddress" AND a."discordId" IS NULL)`;
  const economic = Prisma.sql`a.currency='CHARM' AND a.amount IS NOT NULL AND a.direction IN ('EARN','SPEND','PAYOUT','REFUND','WAGER') AND a."sourceType"<>'claimEvents'`;
  const scope = Prisma.sql`${eligible} AND (${economic} OR a."sourceType"='claimEvents') AND ${f.source ? Prisma.sql`a."sourceType"=${f.source}` : Prisma.sql`TRUE`} AND ${f.direction ? (f.direction === 'OBSERVATION' ? Prisma.sql`a."sourceType"='claimEvents'` : Prisma.sql`a.direction=${f.direction} AND a."sourceType"<>'claimEvents'`) : Prisma.sql`TRUE`} AND ${f.from ? Prisma.sql`a."eventAt">=${new Date(f.from)}` : Prisma.sql`TRUE`} AND ${f.to ? Prisma.sql`a."eventAt"<${new Date(Date.parse(f.to) + 86400000)}` : Prisma.sql`TRUE`}`;
  const [totals, rows, sources] = await Promise.all([
    db().$queryRaw<{ direction: string; amount: string; count: number }[]>(
      Prisma.sql`SELECT a.direction,sum(a.amount)::text amount,count(*)::int count FROM "CollectorActivity" a WHERE ${scope} AND ${economic} GROUP BY a.direction`,
    ),
    db().$queryRaw<
      {
        id: string;
        source: string;
        direction: string;
        amount: string | null;
        eventType: string;
        eventAt: Date;
      }[]
    >(
      Prisma.sql`SELECT a.id,a."sourceType" source,CASE WHEN a."sourceType"='claimEvents' THEN 'OBSERVATION' ELSE a.direction END direction,CASE WHEN a."sourceType"='claimEvents' THEN NULL ELSE a.amount::text END amount,a."eventType",a."eventAt" FROM "CollectorActivity" a WHERE ${scope} ORDER BY a."eventAt" DESC,a.id LIMIT 26 OFFSET ${(f.page - 1) * 25}`,
    ),
    db().$queryRaw<{ source: string }[]>(
      Prisma.sql`SELECT DISTINCT a."sourceType" source FROM "CollectorActivity" a WHERE ${eligible} AND (${economic} OR a."sourceType"='claimEvents') ORDER BY source`,
    ),
  ]);
  return {
    filters: f,
    totals,
    more: rows.length > 25,
    sources: sources.map((s) => s.source),
    entries: rows.slice(0, 25).map((r) => ({
      id: r.id,
      source: r.source,
      direction: r.direction,
      amount: r.amount,
      at: r.eventAt.toISOString(),
      label:
        activityLabels[r.eventType] ??
        (r.direction === 'OBSERVATION'
          ? 'Recorded claim'
          : 'Tracked $CHARM activity'),
    })),
  };
}
