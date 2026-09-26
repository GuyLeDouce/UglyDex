import 'server-only';
import { db } from '@/server/db';
import { log } from '@/server/log';
import { readPage } from '@/integrations/table';
import { tables } from '@/integrations/registry';
import { readExternal } from '@/integrations/read-only';
import { normalizeRow, type Feed } from './normalize';
import { importEvent, resolveDiscord } from './import-event';
import { linkSchema } from '@/integrations/wallet-links';
import { hash } from '@/domain/events';
export type Counts = {
  scanned: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
};
export const emptyCounts = (): Counts => ({
  scanned: 0,
  inserted: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
});
export async function runFeed(feed: Feed) {
  const counts = emptyCounts();
  const run = await db().syncRun.create({ data: { source: feed, counts } });
  let after: unknown[] | undefined;
  let status = 'COMPLETED';
  try {
    while (true) {
      const spec = tables[feed];
      const page = await readPage(spec, after);
      if (!page.ok) {
        status = page.reason.toUpperCase();
        if (page.reason !== 'unconfigured') counts.failed++;
        break;
      }
      if (!page.data.length) break;
      for (const row of page.data) {
        counts.scanned++;
        try {
          if (feed === 'survival') {
            const game = await readExternal<{ started_at: Date }>(
              'survival',
              'SELECT started_at FROM public.squig_survival_games WHERE id = $1',
              [row.game_id],
            );
            if (!game.ok || !game.data[0]) throw new Error('MISSING_PARENT');
            row.started_at = game.data[0].started_at;
          }
          const events = normalizeRow(feed, row);
          if (!events.length) counts.skipped++;
          for (const event of events) counts[await importEvent(event)]++;
        } catch {
          counts.failed++;
        }
      }
      after = spec.keys.map((k) => page.data.at(-1)![k]);
      await db().syncRun.update({ where: { id: run.id }, data: { counts } });
      log('sync.page', { source: feed, ...counts });
    }
  } catch {
    status = 'FAILED';
    counts.failed++;
  }
  if (counts.failed && status === 'COMPLETED') status = 'PARTIAL';
  await db().syncRun.update({
    where: { id: run.id },
    data: { counts, status, finishedAt: new Date() },
  });
  log('sync.finished', { source: feed, status, ...counts });
  return counts;
}
export async function syncIdentities() {
  const counts = emptyCounts();
  const guild = process.env.ECOSYSTEM_GUILD_ID;
  if (!guild) {
    log('sync.unconfigured', { source: 'identities' });
    return counts;
  }
  const run = await db().syncRun.create({
    data: { source: 'identities', counts },
  });
  let after: unknown[] | undefined;
  let status = 'COMPLETED';
  try {
    while (true) {
      const page = await readPage(tables.links, after, { guild_id: guild });
      if (!page.ok) {
        status = page.reason.toUpperCase();
        if (page.reason !== 'unconfigured') counts.failed++;
        break;
      }
      if (!page.data.length) break;
      for (const row of page.data) {
        counts.scanned++;
        try {
          const link = linkSchema.parse(row),
            sourceKey = hash([
              'uglybot',
              link.guild_id,
              link.discord_id,
              link.wallet_address,
            ]);
          const result = await db().$transaction(async (tx) => {
            await resolveDiscord(tx, link.discord_id);
            const existing = await tx.walletLinkEvidence.findUnique({
              where: { sourceKey },
            });
            const data = {
              discordId: link.discord_id,
              guildId: link.guild_id,
              walletAddress: link.wallet_address,
              legacyVerified: link.verified,
              sourceCreatedAt: link.created_at,
              sourceUpdatedAt: link.updated_at,
              observedAt: new Date(),
            };
            await tx.walletLinkEvidence.upsert({
              where: { sourceKey },
              create: { sourceKey, ...data },
              update: data,
            });
            const conflicts = await tx.walletLinkEvidence.findMany({
              where: {
                walletAddress: link.wallet_address,
                legacyVerified: true,
                discordId: { not: link.discord_id },
              },
              select: { discordId: true },
            });
            if (conflicts.length)
              await tx.identityReconciliation.upsert({
                where: { dedupeKey: `wallet:${link.wallet_address}` },
                create: {
                  dedupeKey: `wallet:${link.wallet_address}`,
                  reason: 'CONFLICTING_LEGACY_DISCORD',
                  evidence: {
                    wallet: link.wallet_address,
                    discordIds: [
                      link.discord_id,
                      ...conflicts.map((c) => c.discordId),
                    ],
                  },
                },
                update: {},
              });
            return !existing
              ? 'inserted'
              : existing.sourceUpdatedAt?.getTime() ===
                    link.updated_at?.getTime() &&
                  existing.legacyVerified === link.verified
                ? 'skipped'
                : 'updated';
          });
          counts[result]++;
        } catch {
          counts.failed++;
        }
      }
      after = tables.links.keys.map((k) => page.data.at(-1)![k]);
    }
  } catch {
    counts.failed++;
    status = 'FAILED';
  }
  if (counts.failed && status === 'COMPLETED') status = 'PARTIAL';
  await db().syncRun.update({
    where: { id: run.id },
    data: { counts, status, finishedAt: new Date() },
  });
  log('sync.finished', { source: 'identities', status, ...counts });
  const { seedAttributions } = await import('./provenance');
  await seedAttributions();
  return counts;
}
