import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { traitView } from '@/server/dex';
import { DexNav } from '@/components/dex';
import { TRAIT_TYPES, traitPath } from '@/domain/dex';
import type { SearchParams } from '@/components/catalog';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const data = await traitView(await requireCollector()),
    p = await searchParams;
  const traits = data.traits.filter(
    (t) =>
      (!p.category || t.type === p.category) &&
      (!p.state ||
        (p.state === 'discovered'
          ? !!t.first
          : p.state === 'missing'
            ? !t.first
            : p.state === 'owned'
              ? t.owned > 0
              : t.percentage <= 1)),
  );
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">345 DETAILS WORTH NOTICING</p>
        <h1>The Trait Dex.</h1>
        <p>
          Eight canonical categories. A growing record of everything you have
          encountered.
        </p>
      </section>
      <DexNav />
      {data.status === 'pending' && (
        <p className="panel">
          Your evidence is updating. Discovery states remain unavailable until
          evaluation completes.
        </p>
      )}
      <form className="filters">
        <div className="filter-top">
          <label>
            Category
            <select name="category" defaultValue={String(p.category ?? '')}>
              <option value="">All categories</option>
              {TRAIT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Show
            <select name="state" defaultValue={String(p.state ?? '')}>
              <option value="">All</option>
              <option value="discovered">Discovered</option>
              <option value="missing">Missing</option>
              <option value="owned">Currently owned</option>
              <option value="rare">Rare (≤ 1% of collection)</option>
            </select>
          </label>
          <button className="button">Apply filters</button>
        </div>
      </form>
      {TRAIT_TYPES.filter((type) => traits.some((t) => t.type === type)).map(
        (type) => (
          <section key={type}>
            <div className="section-heading inline">
              <h2>{type}</h2>
              <span>
                {data.status === 'ready'
                  ? `${data.traits.filter((t) => t.type === type && t.first).length} / ${data.traits.filter((t) => t.type === type).length} discovered`
                  : 'Discovery unavailable'}
              </span>
            </div>
            <div className="trait-dex-grid">
              {traits
                .filter((t) => t.type === type)
                .map((t) => (
                  <Link
                    className={`trait-tile ${t.first ? 'found' : ''}`}
                    href={traitPath(t.type, t.value)}
                    key={t.key}
                  >
                    <span className="eyebrow">
                      {data.status !== 'ready'
                        ? 'NOT EVALUATED'
                        : t.first
                          ? '✳ DISCOVERED'
                          : 'MISSING'}
                    </span>
                    <h3>{t.value}</h3>
                    <p>
                      {t.count} Squigs · {t.percentage.toFixed(2)}%
                    </p>
                    {data.status === 'ready' && (
                      <small>
                        {t.owned} owned · {t.discovered} discovered
                      </small>
                    )}
                    {t.first && <small>First seen on #{t.first.tokenId}</small>}
                  </Link>
                ))}
            </div>
          </section>
        ),
      )}
    </>
  );
}
