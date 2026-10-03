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
