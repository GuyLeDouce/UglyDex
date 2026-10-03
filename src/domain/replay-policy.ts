/** A frozen replay proves determinism; a live boundary separately proves convergence. */
export type ReplayBoundary = {
  frozenStatus: string;
  compatible: boolean;
  exactInput: boolean;
  exactDerived: boolean;
  attribution: number;
  progression: number;
  collections: number;
  dirty: number;
  failed: number;
  ingestionHealthy: boolean;
  convergence: 'ABSENT' | 'MATCH' | 'MISMATCH';
};
export function replayPolicy(
  b: ReplayBoundary,
): 'VERIFIED' | 'PENDING' | 'FAILED' {
  if (b.frozenStatus === 'FAILED') return 'FAILED';
  if (b.frozenStatus !== 'VERIFIED' || !b.compatible) return 'PENDING';
  if (b.convergence === 'MISMATCH') return 'FAILED';
  if (b.failed) return 'FAILED';
  if (
    b.attribution ||
    b.progression ||
    b.collections ||
    b.dirty ||
    !b.ingestionHealthy
  )
    return 'PENDING';
  if (b.exactInput && b.exactDerived) return 'VERIFIED';
  return b.convergence === 'MATCH' ? 'VERIFIED' : 'PENDING';
}
