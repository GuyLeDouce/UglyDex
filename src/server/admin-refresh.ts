import 'server-only';
import { db } from './db';
import { requestRefresh } from './refresh';
import { queueCharmRefresh } from './drip-sync';
import { adminCharmDiagnostics } from './admin-charm';
import { readEnv } from './env';

export async function refreshAdminAccount(actor: string, id: string) {
  const profile = await db().collector.findUnique({
    where: { id },
    select: {
      mergedIntoCollectorId: true,
      wallets: {
        where: { status: 'ACTIVE', chainId: 1, revokedAt: null },
        select: { id: true },
      },
    },
  });
  if (!profile || profile.mergedIntoCollectorId)
    throw Error('PROFILE_UNAVAILABLE');
  await db().$transaction(async (tx) => {
    // This lock and timestamp make concurrent/repeated support clicks coalesce.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'admin-refresh:' + id},0))`;
    const recent = await tx.operationalAudit.findFirst({
      where: {
        action: 'ADMIN_ACCOUNT_REFRESH',
        subject: id,
        createdAt: { gt: new Date(Date.now() - 120000) },
      },
    });
    if (recent) throw Error('REFRESH_THROTTLED');
    await tx.collectionJob.upsert({
      where: { collectorId: id },
      create: { collectorId: id },
      update: {
        generation: { increment: 1 },
        attempts: 0,
        errorCode: null,
        queuedAt: new Date(),
      },
    });
    await tx.progressionJob.upsert({
      where: {
        subjectType_subjectId: { subjectType: 'COLLECTOR', subjectId: id },
      },
      create: { subjectType: 'COLLECTOR', subjectId: id },
      update: {
        generation: { increment: 1 },
        attempts: 0,
        errorCode: null,
        queuedAt: new Date(),
      },
    });
    await tx.operationalAudit.create({
      data: {
        actor,
        action: 'ADMIN_ACCOUNT_REFRESH',
        subject: id,
        detail: {
          requested: ['ownership', 'collections', 'achievements', 'charm'],
        },
      },
    });
  });
  const controls = await db().workerControl.findMany({
    where: { service: { in: ['collections', 'progression'] } },
  });
  const messages = ['collections', 'progression'].map((service) => {
    const label =
      service === 'collections' ? 'Sets and collection' : 'Achievements';
    return `${label}: queued${!controls.some((c) => c.service === service && c.mode !== 'DISABLED') ? '; worker is disabled, so processing is blocked' : ''}.`;
  });
  if (!profile.wallets.length)
    messages.push('Wallet ownership: skipped; no active Ethereum wallet.');
  else if (!readEnv().ETH_RPC_URL)
    messages.push('Wallet ownership: blocked; RPC is not configured.');
  else {
    try {
      const result = await requestRefresh(id);
      messages.push(
        result.status === 'COMPLETE'
          ? 'Wallet ownership: a recent shared scan already completed; cooldown applies.'
          : `Wallet ownership: ${result.status.toLowerCase()} (shared ownership scan).`,
      );
    } catch (error) {
      messages.push(
        error instanceof Error && error.message === 'REFRESH_THROTTLED'
          ? 'Wallet ownership: already requested recently; 10-minute cooldown applies.'
          : 'Wallet ownership: could not queue; retry later.',
      );
    }
  }
  try {
    const queued = await queueCharmRefresh(id, true);
    messages.push(
      queued
        ? '$CHARM: refresh queued.'
        : '$CHARM: not newly queued; tracking is disabled or the 2-minute cooldown applies.',
    );
    const diagnostic = (await adminCharmDiagnostics([id])).get(id);
    if (diagnostic && ['BLOCKED', 'FAILED'].includes(diagnostic.state))
      messages.push(
        `$CHARM ${diagnostic.state.toLowerCase()}: ${diagnostic.reason} ${diagnostic.action}`,
      );
  } catch {
    messages.push(
      '$CHARM: unable to queue or read diagnostics; check DRIP configuration and retry later.',
    );
  }
  return { messages };
}
