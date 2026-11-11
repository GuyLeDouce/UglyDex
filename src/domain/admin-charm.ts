import { balanceView } from './charm';
import { charmRequestTime } from './admin-health';

export function adminCharmDiagnostic(
  input: {
    consent: boolean | null;
    authenticated: boolean;
    configured: boolean;
    currencyId: string;
    commit: string;
    staleAfter: number;
    balance:
      | (Parameters<typeof balanceView>[0] & {
          lastApiSuccessAt?: Date | null;
        })
      | null;
    request: {
      pending: boolean;
      requestedAt: Date;
      nextUserRequestAt: Date;
    } | null;
    sync: {
      currencyId: string;
      alignmentHash: string | null;
      alignmentCommit: string | null;
      errorCode: string | null;
      lastSuccessAt: Date | null;
      nextRequestAt: Date;
      month: string;
      monthRequests: number;
    } | null;
    worker: { mode: string; lastHeartbeat: Date | null };
  },
  now = new Date(),
) {
  const view = balanceView(input.balance, now, input.staleAfter);
  const queuedAt = input.request ? charmRequestTime(input.request) : null;
  const fulfilled =
    !!queuedAt &&
    view.status === 'CURRENT' &&
    view.balance !== null &&
    !!input.balance?.observedAt &&
    input.balance.observedAt >= queuedAt &&
    !!input.balance.lastApiSuccessAt &&
    input.balance.lastApiSuccessAt >= queuedAt;
  const pending = !!input.request?.pending && !fulfilled;
  const s = input.sync;
  let state = pending ? 'QUEUED' : 'IDLE';
  let reason = pending
    ? 'Refresh is queued. This queue does not record per-profile processing or attempt counts.'
    : fulfilled
      ? 'A successful balance read is newer than the queued request.'
      : 'No outstanding refresh request is recorded.';
  let action = pending
    ? 'Wait for the next worker pass; check the shared sync information below if this remains queued.'
    : 'No refresh action required.';
  const block = (why: string, next: string) => {
    state = 'BLOCKED';
    reason = why;
    action = next;
  };
  if (input.consent !== true)
    block(
      'Discord tracking is not enabled. The holder-facing balance is unavailable.',
      'The holder must enable Discord tracking before balance refreshes can run.',
    );
  else if (!input.configured)
    block(
      'DRIP configuration on the web service is missing or invalid.',
      'Check DRIP configuration on both the web service and ecosystem worker.',
    );
  else if (!input.authenticated)
    block(
      'No authenticated Discord identity is recorded.',
      'Have the holder authenticate their linked Discord account.',
    );
  else if (s && s.currencyId !== input.currencyId)
    block(
      'The configured currency differs from the validated currency.',
      'Correct and revalidate the DRIP Realm/currency configuration.',
    );
  else if (!s?.alignmentHash || s.alignmentCommit !== input.commit)
    block(
      'DRIP alignment has not been verified for this deployment.',
      'The worker will automatically revalidate unchanged, previously verified DRIP settings. If this persists, check shared DRIP errors; new or changed settings require operator verification.',
    );
  else if (s.errorCode) {
    state = 'FAILED';
    reason = `Shared DRIP sync reports ${s.errorCode}. This is not proof of a failed request for this individual profile.`;
    action =
      'Check ecosystem worker / DRIP permissions and configuration; the worker retries according to its recorded schedule.';
  } else if (
    input.worker.mode === 'DISABLED' ||
    !input.worker.lastHeartbeat ||
    +now - +input.worker.lastHeartbeat > 120000
  )
    block(
      'The ecosystem worker is disabled or has no recent heartbeat.',
      'Check the ecosystem worker service and its control mode.',
    );
  else if (
    s.month === now.toISOString().slice(0, 7) &&
    s.monthRequests >= 30000
  )
    block(
      'The shared monthly DRIP request budget is exhausted.',
      'Wait for the next monthly budget window.',
    );
  else if (pending && s.nextRequestAt > now) {
    reason =
      'Queued; the shared DRIP request schedule is delaying the next read.';
    action = 'Wait until the next eligible request time shown below.';
  }
  return {
    savedBalance: view.balance,
    balanceStatus: view.status,
    stale: view.stale,
    holderBalance:
      input.consent === true && input.configured ? view.balance : null,
    observedAt: view.updatedAt,
    lastApiSuccessAt: input.balance?.lastApiSuccessAt?.toISOString() ?? null,
    state,
    reason,
    action,
    queuedAt: queuedAt?.toISOString() ?? null,
    requestPending: !!input.request?.pending,
    sharedLastSuccessAt: s?.lastSuccessAt?.toISOString() ?? null,
    sharedNextRequestAt: s?.nextRequestAt.toISOString() ?? null,
    sharedError: s?.errorCode ?? null,
    workerMode: input.worker.mode,
    workerHeartbeat: input.worker.lastHeartbeat?.toISOString() ?? null,
    checkedAt: now.toISOString(),
  };
}
export type AdminCharmDiagnostic = ReturnType<typeof adminCharmDiagnostic>;
