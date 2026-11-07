import Link from 'next/link';
import { Artwork } from './artwork';
import type { editionCatalog } from '@/server/editions';
export function EditionGrid({
  items,
}: {
  items: Awaited<ReturnType<typeof editionCatalog>>['items'];
}) {
  return (
    <div className="exhibition exhibition-grid">
      {items.map((e) => (
        <figure key={e.slug}>
          <Link href={'/editions/' + e.slug}>
            <Artwork src={e.image} alt={e.name + ' · Official Custom'} />
          </Link>
          <figcaption>
            <p className="eyebrow">OFFICIAL CUSTOM</p>
            <h2>
              <Link href={'/editions/' + e.slug}>{e.name}</Link>
            </h2>
            {e.description && <p>{e.description}</p>}
            <p>{e.artist && 'Art by ' + e.artist}</p>
            <p>
              {e.supply !== null
                ? 'Custom supply: ' + e.supply
                : 'Supply not documented'}
              {e.issuedAt ? ' · ' + e.issuedAt.slice(0, 10) : ''}
            </p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
