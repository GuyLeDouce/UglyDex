import 'server-only';
import { currentSession } from './auth';
import { db } from './db';
import { readEnv } from './env';
export async function adminActor() {
  if (process.env.NODE_ENV === 'development') return 'local-development';
  const ids = readEnv().ADMIN_DISCORD_IDS.split(',').filter(Boolean);
  if (!ids.length) return null;
  const s = await currentSession();
  if (!s) return null;
  const identity = await db().externalIdentity.findFirst({
    where: {
      collectorId: s.collectorId,
      provider: 'DISCORD',
      externalId: { in: ids },
      authenticatedAt: { not: null },
    },
  });
  return identity ? `collector:${s.collectorId}` : null;
}
