import type { collectionSummary } from '@/server/collections';
export function Stats({
  summary: s,
}: {
  summary: Awaited<ReturnType<typeof collectionSummary>>;
}) {
  return (
    <div className="stats-strip">
      {[
        [s.owned, 'Squigs owned'],
        [s.uglyPoints, 'UglyPoints'],
        [s.discovered, 'Discovered'],
        [s.og, 'OG Squigs'],
        [s.legendary, 'Legendary'],
      ].map(([v, label]) => (
        <div key={label}>
          <strong>{typeof v === 'number' ? v.toLocaleString() : '—'}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
