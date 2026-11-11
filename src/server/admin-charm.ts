import 'server-only';
import { db } from './db';
import { dripConfig } from './drip-sync';
import { launchContext } from './launch';
import { adminCharmDiagnostic } from '@/domain/admin-charm';

/** Read-only snapshot, called after owner authorization. Never enqueue on admin views. */
export async function adminCharmDiagnostics(ids: string[]) {
  let config: ReturnType<typeof dripConfig> | null = null;
  try {
    config = dripConfig();
  } catch {
    /* Report configuration failure without exposing secrets. */
  }
  const realmId = process.env.DRIP_REALM_ID ?? '__unconfigured__';
  const currencyId = process.env.DRIP_REALM_POINT_ID ?? '__unconfigured__';
  const [collectors, balances, requests, sync, control, heartbeat] =
    await Promise.all([
      db().collector.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          discordTrackingConsent: true,
          identities: {
            where: { provider: 'DISCORD', authenticatedAt: { not: null } },
            select: { id: true },
          },
        },
      }),
      db().charmBalance.findMany({
        where: { collectorId: { in: ids }, realmId, currencyId },
      }),
      db().charmRefreshRequest.findMany({
        where: { collectorId: { in: ids }, realmId },
      }),
      db().dripSyncState.findUnique({ where: { realmId } }),
      db().workerControl.findUnique({ where: { service: 'ecosystem' } }),
      db().workerHeartbeat.findFirst({
        where: { service: 'ecosystem', lockHeld: true },
        orderBy: { lastHeartbeat: 'desc' },
      }),
    ]);
  const now = new Date();
  return new Map(
    collectors.map((c) => [
      c.id,
      adminCharmDiagnostic(
        {
          consent: c.discordTrackingConsent,
          authenticated: c.identities.length > 0,
          configured: !!config,
          currencyId,
          commit: launchContext().commit,
          staleAfter: config?.DRIP_STALE_AFTER_MS ?? 300000,
          balance: balances.find((b) => b.collectorId === c.id) ?? null,
          request: requests.find((r) => r.collectorId === c.id) ?? null,
          sync,
          worker: {
            mode: control?.mode ?? 'DISABLED',
            lastHeartbeat: heartbeat?.lastHeartbeat ?? null,
          },
        },
        now,
      ),
    ]),
  );
}
