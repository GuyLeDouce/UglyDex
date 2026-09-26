export type ServiceStatus = 'HEALTHY' | 'DEGRADED' | 'DISABLED' | 'FAILED';
export function subsystemStatus(input: {
  enabled: boolean;
  failed?: boolean;
  observed?: boolean;
  ageMs?: number;
  maxAgeMs?: number;
  lag?: bigint;
  maxLag?: bigint;
}): ServiceStatus {
  if (input.failed) return 'FAILED';
  if (!input.enabled) return 'DISABLED';
  if (
    !input.observed ||
    (input.ageMs !== undefined && input.ageMs > (input.maxAgeMs ?? 90000)) ||
    (input.lag !== undefined && input.lag > (input.maxLag ?? 64n))
  )
    return 'DEGRADED';
  return 'HEALTHY';
}
