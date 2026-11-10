// Only explicit schema inspection of an absent optional feed creates this state.
// Connectivity, permission and import failures must never be treated as absence.
export function unavailableSource(
  source:
    | { state: string; warning: string | null; schemaValid: boolean | null }
    | null
    | undefined,
) {
  return (
    source?.state === 'UNAVAILABLE' &&
    source.warning === 'FEED_UNAVAILABLE' &&
    source.schemaValid === false
  );
}

export function activityFeedReadiness(
  source: {
    state: string;
    warning: string | null;
    schemaValid: boolean | null;
    backfillFinishedAt: Date | null;
  } | null,
  mode: 'HISTORICAL' | 'LIVE',
) {
  if (unavailableSource(source)) return 'UNAVAILABLE';
  if (
    !source?.schemaValid ||
    source.state === 'ERROR' ||
    source.warning === 'ROLE_HAS_WRITE_PRIVILEGES' ||
    source.warning === 'PERMISSIONS_UNAVAILABLE'
  )
    return 'WAITING_SOURCE_VALIDATION';
  if (mode === 'LIVE' && !source.backfillFinishedAt) return 'WAITING_BACKFILL';
  return 'READY';
}
