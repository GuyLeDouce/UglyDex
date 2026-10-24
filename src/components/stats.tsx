import type { collectionSummary } from '@/server/collections';
export function Stats({
  summary: s,
}: {
  summary: Awaited<ReturnType<typeof collectionSummary>>;
}) {
  return (
    <>
      <div className="stats-strip">
        {[
          [s.owned, 'Squigs owned'],
          [s.uglyPoints, 'UglyPoints'],
          [s.discovered, 'Recorded ownership history'],
          [s.og, 'OG Squigs'],
          [s.legendary, 'Legendary'],
        ].map(([v, label]) => (
          <div key={label}>
            <strong>{typeof v === 'number' ? v.toLocaleString() : '—'}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="muted">
        Recorded ownership history includes observations that may not qualify
        for Field Guide discoveries. Field Guide completion requires confirmed
        ownership periods and complete blockchain provenance.
      </p>
    </>
  );
}
