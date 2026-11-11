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
  job: { errorCode: string | null; queuedAt: Date; attempts: number },
  now: Date,
): HealthSignal {
  const stalled = +now - +job.queuedAt > 60 * 60 * 1000;
  return {
    error: !!job.errorCode || stalled,
    message: `${label}: ${job.errorCode ? `failed (${job.errorCode})` : stalled ? 'still pending after more than one hour; check the worker' : 'queued or processing'}. Queued ${job.queuedAt.toISOString()}; attempts: ${job.attempts}.`,
  };
}
