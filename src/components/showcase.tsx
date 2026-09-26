import Link from 'next/link';
import { galleryList, galleryView } from '@/server/galleries';
import { Artwork } from './artwork';
import { dexView } from '@/server/dex';
import { progressionView } from '@/server/progression';
import { activityPage, ecosystemSummary } from '@/server/activity';
import { Timeline } from './timeline';
export async function CollectorHighlights({
  id,
  slug,
}: {
  id: string;
  slug: string;
}) {
  const [p, d] = await Promise.all([
    progressionView('COLLECTOR', id, true),
    dexView(id, true),
  ]);
  return (
    <section className="showcase-highlights" aria-label="Collector highlights">
      {p?.status === 'ready' && (
        <div className="showcase-level">
          <Link href={'/collector/' + slug + '/achievements'}>
            Level {p.level}
          </Link>
          {p.title && <span>{p.title}</span>}
        </div>
      )}
      {d?.status === 'ready' && (
        <div className="showcase-completion">
          <div>
            <p className="eyebrow">THE FIELD GUIDE</p>
            <h2>
              {d.score.overall.toFixed(1)}
              <span>% complete</span>
            </h2>
            <progress
              value={d.score.overall}
              max={100}
              aria-label="Overall UglyDex completion"
            />
            <Link href={'/share?kind=completion&entity=' + slug}>
              Share this UglyDex ↗
            </Link>
          </div>
          <dl>
            <div>
              <dt>Squigs discovered</dt>
              <dd>{d.discovered} / 4,444</dd>
            </div>
            <div>
              <dt>Traits discovered</dt>
              <dd>
                {d.traits} / {d.traitTotal}
              </dd>
            </div>
            <div>
              <dt>Historical sets</dt>
              <dd>
                {d.historicalSets} / {d.historicalTotal}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
export async function CollectorActivityPreview({
  id,
  slug,
}: {
  id: string;
  slug: string;
}) {
  const scope = { collectorId: id, public: true };
  const [summary, recent] = await Promise.all([
    ecosystemSummary(scope),
    activityPage(scope),
  ]);
  if (!summary.categories.length && !recent.entries.length) return null;
  return (
    <section className="featured-exhibition">
      <div className="section-heading inline">
        <div>
          <p className="eyebrow">TRACKED ECOSYSTEM HISTORY</p>
          <h2>A little life outside the gallery.</h2>
        </div>
        <Link href={'/collector/' + slug + '/activity'}>
          Explore activity →
        </Link>
      </div>
      <div className="showcase-activity-stats">
        {summary.categories.slice(0, 4).map((c) => (
          <span key={c.category}>
            <strong>{c.events}</strong>{' '}
            {c.category.toLowerCase().replaceAll('_', ' ')} records
          </span>
        ))}
      </div>
      <small>Confirmed public records tracked by UglyDex.</small>
      {recent.entries.length > 0 && (
        <Timeline entries={recent.entries.slice(0, 3)} />
      )}
    </section>
  );
}
export async function GalleryShowcase({
  id,
  slug,
}: {
  id: string;
  slug: string;
}) {
  const rows = await galleryList(id);
  if (!rows.length) return null;
  const featured = rows.find((g) => g.featured) ?? rows[0],
    gallery = await galleryView(slug, featured.slug);
  return (
    <section className="featured-exhibition">
      <p className="eyebrow">CURATED CHAOS</p>
      <h2>Into the gallery.</h2>
      {gallery && (
        <Link
          className="gallery-cover"
          href={'/collector/' + slug + '/gallery/' + gallery.slug}
        >
          <div className="share-art-grid">
            {gallery.items
              .filter(
                (i) =>
                  !gallery.coverTokenId || i.tokenId === gallery.coverTokenId,
              )
              .slice(0, 4)
              .map((i) => (
                <Artwork
                  key={i.tokenId}
                  src={i.image}
                  alt={'Squig #' + i.tokenId}
                />
              ))}
          </div>
          <h3>{gallery.name} ↗</h3>
          <p>{gallery.description}</p>
        </Link>
      )}
      <nav className="anchor-nav">
        {rows.map((g) => (
          <Link key={g.slug} href={'/collector/' + slug + '/gallery/' + g.slug}>
            {g.name}
          </Link>
        ))}
      </nav>
    </section>
  );
}
export async function TrophyCase({ id, slug }: { id: string; slug: string }) {
  const [p, d] = await Promise.all([
    progressionView('COLLECTOR', id, true),
    dexView(id, true),
  ]);
  const badges =
      p?.status === 'ready'
        ? p.cards.filter((c) => c.unlocked && p.featured.includes(c.name))
        : [],
    sets = d?.status === 'ready' ? d.cards.filter((c) => c.featured) : [];
  if (!badges.length && !sets.length) return null;
  return (
    <section className="trophy-case">
      <p className="eyebrow">EARNED. DISCOVERED. DISPLAYED.</p>
      <h2>The trophy case.</h2>
      <div className="trophy-grid">
        {badges.map((b) => (
          <Link
            key={b.key}
            href={'/share?kind=achievement&entity=' + slug + '&key=' + b.key}
          >
            <small>ACHIEVEMENT · {b.tier}</small>
            <h3>✳ {b.name}</h3>
            <p>{b.description}</p>
          </Link>
        ))}
        {sets.map((s) => (
          <Link
            key={s.key}
            href={'/share?kind=set&entity=' + slug + '&key=' + s.key}
          >
            <small>COLLECTION SET</small>
            <h3>✓ {s.name}</h3>
            <p>
              {s.mode === 'CURRENT_HOLDING'
                ? 'Currently complete'
                : 'Historically discovered'}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
