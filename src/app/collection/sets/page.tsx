import { requireCollector } from '@/server/session';
import { dexView } from '@/server/dex';
import { DexNav, DexScore, SetGrid } from '@/components/dex';
import { collectionSets } from '@/domain/dex-catalog';
import { SetPreferences } from '@/components/set-preferences';
import type { SearchParams } from '@/components/catalog';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const view = await dexView(await requireCollector()),
    p = await searchParams;
  const cards = view?.status === 'ready' ? view.cards : [];
  const filtered = cards.filter(
    (c) =>
      (!p.mode || p.mode === c.mode) &&
      (!p.category || p.category === c.category) &&
      (!p.difficulty || p.difficulty === c.difficulty) &&
      (!p.visibility ||
        (p.visibility === 'hidden' ? !c.revealed : c.revealed)) &&
      (!p.state ||
        (p.state === 'complete'
          ? c.complete
          : p.state === 'progress'
            ? !c.complete && c.progress > 0
            : !c.progress)),
  );
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">CURATED COLLECTION GOALS</p>
        <h1>Find your kind of obsessive.</h1>
        <p>
          Historical discoveries endure. Current collections live in the moment.
        </p>
      </section>
      <DexNav />
      {view?.status !== 'ready' && <DexScore view={view} />}
      <form className="filters">
        <div className="filter-top">
          {[
            ['state', 'State', ['complete', 'progress', 'not-started']],
            ['mode', 'Mode', ['HISTORICAL_DISCOVERY', 'CURRENT_HOLDING']],
            [
              'category',
              'Category',
              [...new Set(collectionSets.map((s) => s.category))],
            ],
            ['difficulty', 'Difficulty', ['Easy', 'Medium', 'Hard', 'Insane']],
            ['visibility', 'Secrets', ['hidden', 'revealed']],
          ].map(([key, label, values]) => (
            <label key={String(key)}>
              {label}
              <select
                name={String(key)}
                defaultValue={
                  typeof p[String(key)] === 'string' ? p[String(key)] : ''
                }
              >
                <option value="">All</option>
                {(values as string[]).map((v) => (
                  <option key={v} value={v}>
                    {v.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button className="button" type="submit">
            Filter sets
          </button>
        </div>
      </form>
      <SetGrid cards={filtered} />
      {view?.status === 'ready' && (
        <SetPreferences
          cards={cards
            .filter((c) => c.complete)
            .map((c) => ({ key: c.key, name: c.name, featured: c.featured }))}
        />
      )}
    </>
  );
}
