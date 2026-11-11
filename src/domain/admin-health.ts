export type ProfileHealth = {
  status: 'ACTIVE' | 'ERROR' | 'UPDATING';
  details: string[];
};
export type HealthSignal = { error?: boolean; message: string };
export function profileHealth(signals: HealthSignal[]): ProfileHealth {
  return {
    status: signals.some((s) => s.error)
      ? 'ERROR'
      : signals.length
        ? 'UPDATING'
        : 'ACTIVE',
    details: signals.map((s) => s.message),
  };
}
export function jobHealth(
  label: string,
  job: { errorCode: string | null; queuedAt: Date; attempts?: number },
  now: Date,
): HealthSignal {
  const stalled = +now - +job.queuedAt > 60 * 60 * 1000;
  return {
    error: !!job.errorCode || stalled,
    message: `${label}: ${job.errorCode ? `failed (${job.errorCode})` : stalled ? 'still pending after more than one hour; check the worker' : 'queued or processing'}. Queued ${job.queuedAt.toISOString()}.${job.attempts === undefined ? '' : ` attempts: ${job.attempts}.`}`,
  };
}

/** Older requests retained their first-ever date when requeued. */
export function charmRequestTime(request: {
  requestedAt: Date;
  nextUserRequestAt: Date;
}) {
  return new Date(
    Math.max(+request.requestedAt, +request.nextUserRequestAt - 120000),
  );
}
export function pendingCharmHealth(
  request: { requestedAt: Date; nextUserRequestAt: Date },
  balances: {
    status: string;
    balance: unknown;
    observedAt: Date | null;
    lastApiSuccessAt: Date | null;
  }[],
  trackingEnabled: boolean,
  now: Date,
): HealthSignal | null {
  if (!trackingEnabled) return null;
  const queuedAt = charmRequestTime(request);
  const fulfilled = balances.some(
    (balance) =>
      balance.status === 'CURRENT' &&
      balance.balance !== null &&
      balance.observedAt !== null &&
      balance.lastApiSuccessAt !== null &&
      balance.observedAt >= queuedAt &&
      balance.lastApiSuccessAt >= queuedAt,
  );
  if (fulfilled) return null;
  return jobHealth('$CHARM refresh', { queuedAt, errorCode: null }, now);
}
export function discordProofSatisfied(
  evidence: unknown,
  identities: { externalId: string; authenticatedAt: Date | null }[],
) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence))
    return false;
  const ids = (evidence as { discordIds?: unknown }).discordIds;
  if (!Array.isArray(ids)) return false;
  return identities.some(
    (identity) =>
      identity.authenticatedAt !== null && ids.includes(identity.externalId),
  );
}
