import 'server-only';
import { db } from './db';
import { launchContext, recordGate } from './launch';
import { dripConfig } from './drip-sync';
export async function verifyCharmGate() {
  try {
    const c = dripConfig(),
      context = launchContext();
    const s = await db().dripSyncState.findUnique({
      where: { realmId: c.DRIP_REALM_ID },
    });
    if (
      s &&
      (s.currencyId !== c.DRIP_REALM_POINT_ID ||
        s.errorCode === 'CHARM_ECONOMY_MISMATCH')
    ) {
      await recordGate(
        'CHARM_DRIP',
        'FAILED',
        'Configured economy differs from validated currency',
        {},
      );
      return false;
    }
    const resolved = await db().dripIdentity.count({
      where: { realmId: c.DRIP_REALM_ID, status: 'RESOLVED' },
    });
    const balances = await db().charmBalance.count({
      where: {
        realmId: c.DRIP_REALM_ID,
        currencyId: c.DRIP_REALM_POINT_ID,
        status: 'CURRENT',
        balance: { not: null },
        lastApiSuccessAt: { gte: new Date(Date.now() - 86400000) },
      },
    });
    const valid =
      !!s?.alignmentHash &&
      s.alignmentCommit === context.commit &&
      !!s.alignmentAt &&
      Date.now() - +s.alignmentAt < 86400000 &&
      !!s.lastFullSweep &&
      !!s.lastSuccessAt &&
      Date.now() - +s.lastSuccessAt < 3600000 &&
      s.monthRequests <= 30000 &&
      !s.errorCode &&
      resolved > 0 &&
      balances > 0;
    await recordGate(
      'CHARM_DRIP',
      valid ? 'VERIFIED' : 'PENDING',
      'Exact economy, credential resolution and budgeted GET-only balance synchronization required',
      {
        alignmentHash: s?.alignmentHash,
        resolved,
        balances,
        lastFullSweep: s?.lastFullSweep,
        lastSuccessAt: s?.lastSuccessAt,
        monthRequests: s?.monthRequests,
        errorCode: s?.errorCode,
        writeCalls: 0,
      },
    );
    return valid;
  } catch {
    await recordGate(
      'CHARM_DRIP',
      'PENDING',
      'DRIP read integration requires configuration or verification',
      {},
    );
    return false;
  }
}
