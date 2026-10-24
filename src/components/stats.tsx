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
      {s.unresolvedDiscoveries > 0 && (
        <p role="status">
          {s.unresolvedDiscoveries} additional ownership records need
          verification before they count toward completion.
        </p>
      )}
      <p className="muted">
        Discoveries count verified possession observations and confirmed
        ownership history. Earlier unverified wallet activity is not attributed
        to your identity.
      </p>
    </>
  );
}
