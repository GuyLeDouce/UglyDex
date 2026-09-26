import { assertOperation } from '../src/server/deployment';
import 'dotenv/config';
import { db } from '../src/server/db';
import { feeds } from '../src/sync/normalize';
import { runActivityFeed } from '../src/sync/activity';
import { reattributeActivity } from '../src/sync/import-event';
import { closeExternalPools } from '../src/integrations/read-only';
import { log } from '../src/server/log';
import { z } from 'zod';
const args = process.argv.slice(2),
  arg = (key: string) => {
    const i = args.indexOf(key);
    return i < 0 ? undefined : args[i + 1];
  };
try {
  if (true) await assertOperation('replay');
  if (args[0] === 'reattribute') {
    const collectorId = arg('--collector'),
      discordId = arg('--discord'),
      walletAddress = arg('--wallet');
    if (!collectorId && !discordId && !walletAddress)
      throw new Error('TARGET_REQUIRED');
    if (collectorId) z.uuid().parse(collectorId);
    if (discordId)
      z.string()
        .regex(/^\d{17,20}$/)
        .parse(discordId);
    if (walletAddress)
      z.string()
        .regex(/^0x[a-f0-9]{40}$/)
        .parse(walletAddress);
    const result = await reattributeActivity({
      collectorId,
      discordId,
      walletAddress,
    });
    log('activity.reattributed', { updated: result.updated });
  } else {
    const since = arg('--since')
      ? z.coerce.date().parse(arg('--since'))
      : undefined;
    const maxPages = arg('--pages')
      ? z.coerce.number().int().min(1).max(10000).parse(arg('--pages'))
      : 25;
    const selected =
      args[0] === 'uglybot'
        ? feeds.filter(
            (f) =>
              ![
                'runs',
                'survival',
                'onlineRewards',
                'imageUses',
                'submissions',
                'liveImages',
              ].includes(f),
          )
        : args[0] === 'gauntlet'
          ? (['runs', 'survival', 'onlineRewards', 'imageUses'] as const)
          : args[0] === 'images'
            ? (['submissions', 'liveImages'] as const)
            : feeds;
    for (const f of selected)
      if (
        (
          await runActivityFeed(f, {
            since,
            maxPages,
            replay: args.includes('--replay'),
          })
        ).failed
      )
        process.exitCode = 1;
  }
} catch {
  log('activity.command_failed');
  process.exitCode = 1;
} finally {
  await closeExternalPools();
  await db().$disconnect();
}
