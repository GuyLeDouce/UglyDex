import 'server-only';
import { currentSession, authHash } from './auth';
import { configuredAdminOwner } from '@/domain/admin-profiles';
import { db } from './db';
import { readEnv } from './env';
export async function adminActor() {
  const env = readEnv();
  const owner = configuredAdminOwner(
    env.ADMIN_OWNER_DISCORD_ID,
    env.ADMIN_DISCORD_IDS,
  );
  if (!owner) return null;
  const s = await currentSession();
  if (
    !s ||
    s.authMethod !== 'DISCORD_OAUTH' ||
    s.credentialFingerprint !== authHash(`DISCORD_OAUTH:${owner}`)
  )
    return null;
  const identity = await db().externalIdentity.findFirst({
    where: {
      collectorId: s.collectorId,
      provider: 'DISCORD',
      externalId: owner,
      authenticatedAt: { not: null },
    },
  });
  return identity ? `collector:${s.collectorId}` : null;
}
