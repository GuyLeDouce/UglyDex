import Link from 'next/link';
import type { SquigCardData } from '@/server/collections';
import { StatusIconStrip } from './status-icon-strip';
import { SetIconStrip } from './set-icon-strip';

export function CardDiscovery({ item }: { item: SquigCardData }) {
  const p = item.personalization;
  const owned = p?.owned ?? item.currentlyOwned;
  const label = owned
    ? 'Owned'
    : p?.discovered
      ? 'Previously discovered'
      : p
        ? 'New to your Dex'
        : owned === false
          ? 'Previously owned'
          : null;
  return (
    <div className="album-progress">
      {label && (
        <p
          className="ownership-label"
          data-discovery={
            owned ? 'owned' : p?.discovered ? 'discovered' : 'new'
          }
        >
          {label}
          {!!p?.missingTraits && (
            <small>
              Adds {p.missingTraits} missing{' '}
              {p.missingTraits === 1 ? 'trait' : 'traits'}
            </small>
          )}
          {!!p?.advances && (
            <small>
              Advances {p.advances} {p.advances === 1 ? 'set' : 'sets'}
            </small>
          )}
        </p>
      )}
      {!!item.statusIcons?.length && (
        <StatusIconStrip icons={item.statusIcons} limit={4} />
      )}
      {!!p?.sets?.length && <SetIconStrip sets={p.sets} limit={4} advances />}
      {!!p && (p.missingTraits > 0 || p.advances > 0) && (
        <details className="discovery-explanation">
          <summary>Why this helps your Dex</summary>
          {p.missingTraits > 0 && (
            <p>
              {p.missingTraits} of this Squig’s traits are missing from your
              evaluated discoveries.{' '}
              <Link href="/collection/traits">Inspect your Trait Dex →</Link>
            </p>
          )}
          {!!p.sets?.length && (
            <ul>
              {p.sets.map((set) => (
                <li key={set.key}>
                  <Link href={`/sets/${set.key}`}>{set.name} →</Link>
                  <span>{set.description}</span>
                </li>
              ))}
            </ul>
          )}
          <small>
            Based on your latest evaluated Field Guide. Advancing a set does not
            necessarily complete it.
          </small>
        </details>
      )}
    </div>
  );
}
