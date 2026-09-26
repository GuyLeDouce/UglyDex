import Link from 'next/link';
import { collectionPage } from '@/server/collections';
import { CollectionGrid } from './collection';
export type SearchParams = Record<string, string | string[] | undefined>;
export async function Catalog({
  params = {},
  collectorId,
  discovered = false,
  path = '/squigs',
}: {
  params?: SearchParams;
  collectorId?: string;
  discovered?: boolean;
  path?: string;
}) {
  const data = await collectionPage(params, collectorId, discovered),
    f = data.filters;
  const link = (page: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params))
      if (typeof v === 'string' && k !== 'page') q.set(k, v);
    q.set('page', String(page));
    return `${path}?${q}`;
  };
  return (
    <>
      <form className="filters" action={path}>
        <div className="filter-top">
          <label>
            Token ID
            <input
              name="q"
              inputMode="numeric"
              placeholder="Find a Squig…"
              defaultValue={f.q}
              maxLength={4}
            />
          </label>
          <label>
            Sort
            <select name="sort" defaultValue={f.sort}>
              <option value="token">Token ID</option>
              <option value="points-desc">UglyPoints ↓</option>
              <option value="points-asc">UglyPoints ↑</option>
              <option value="rank">Maw Rank</option>
              {collectorId && !discovered && (
                <option value="recent">Recently acquired</option>
              )}
              <option value="og">OG first</option>
              <option value="legendary">Legendary first</option>
            </select>
          </label>
          <label>
            Class
            <select name="rarity" defaultValue={f.rarity}>
              <option value="">All classes</option>
              {['common', 'uncommon', 'rare', 'epic', 'legendary'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="og"
              value="1"
              defaultChecked={!!f.og}
            />{' '}
            OG
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="legendary"
              value="1"
              defaultChecked={!!f.legendary}
            />{' '}
            Legendary
          </label>
        </div>
        <details className="more-filters">
          <summary>Traits & UglyPoints</summary>
          <div className="filter-top">
            <label>
              Trait type
              <select name="trait" defaultValue={f.trait}>
                <option value="">All types</option>
                {[...new Set(data.traits.map((t) => t.traitType))].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Trait value
              <input
                name="value"
                list="trait-values"
                defaultValue={f.value}
                placeholder="Exact trait value"
              />
              <datalist id="trait-values">
                {[...new Set(data.traits.map((t) => t.value))].map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </label>
            <label>
              Minimum UP
              <input name="min" type="number" min="0" defaultValue={f.min} />
            </label>
            <label>
              Maximum UP
              <input name="max" type="number" min="0" defaultValue={f.max} />
            </label>
          </div>
        </details>
        <div className="filter-actions">
          <button className="button primary" type="submit">
            Apply filters
          </button>
          <Link href={path}>Clear</Link>
          <span>{data.total.toLocaleString()} Squigs</span>
        </div>
      </form>
      <CollectionGrid items={data.items} />
      <nav className="pagination" aria-label="Pagination">
        {data.page > 1 ? (
          <Link className="button" href={link(data.page - 1)}>
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        <span>
          Page {data.page} of {data.pages}
        </span>
        {data.page < data.pages ? (
          <Link className="button" href={link(data.page + 1)}>
            Next →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
