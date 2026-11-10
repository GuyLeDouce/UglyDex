import { isCurrentSetCard } from '@/domain/trophy-card';
import Link from 'next/link';
import { galleryList, galleryView } from '@/server/galleries';
import { Artwork } from './artwork';
import { dexView } from '@/server/dex';
import { progressionView } from '@/server/progression';
import { activityPage, ecosystemSummary } from '@/server/activity';
import { EcosystemSummary } from './activity';
import { Timeline } from './timeline';
import { AchievementBadge } from './achievement-badge';
import { AchievementStrip } from './achievement-strip';
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
            Level {p.level} · {p.count} achievements
          </Link>
          {p.title && <span>{p.title}</span>}
          <Link
            href={'/collector/' + slug + '/achievements'}
            aria-label="View all Collector achievements"
          >
            <AchievementStrip summary={p.badgeSummary} subject="COLLECTOR" />
          </Link>
        </div>
      )}
      {d?.status === 'ready' && (
        <div className="showcase-completion">
          <div>
            <p className="eyebrow">
              {d.basis === 'wallet'
                ? 'WALLET FIELD GUIDE · UNCLAIMED'
                : 'FIELD GUIDE MASTERY'}
            </p>
            <h2>
              {d.score.overall.toFixed(1)}
              <span>% mastery</span>
            </h2>
            <progress
              value={d.score.overall}
              max={100}
              aria-label="Field Guide Mastery"
            />
            <Link href={'/share?kind=completion&entity=' + slug}>
              Share this UglyDex ↗
            </Link>
          </div>
          <dl>
            <div>
              <dt>Squigs currently held</dt>
              <dd>{d.owned}</dd>
            </div>
            <div>
              <dt>
                {d.basis === 'wallet'
                  ? 'Squigs tracked in wallet history'
                  : 'Squigs discovered'}
              </dt>
              <dd>{d.discovered} / 4,444</dd>
            </div>
            <div>
              <dt>Traits discovered</dt>
              <dd>
                {d.traits} / {d.traitTotal}
              </dd>
            </div>
            <div>
              <dt>Current Sets</dt>
              <dd>
                {d.currentSets} / {d.currentTotal}
              </dd>
            </div>
            <div>
              <dt>Sets Achieved</dt>
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
          <h2>Survival, Duels & ecosystem history.</h2>
        </div>
        <Link href={'/collector/' + slug + '/activity'}>
          Explore activity →
        </Link>
      </div>
      <EcosystemSummary
        summary={summary}
        collectorId={id}
        public
        path={'/collector/' + slug + '/activity'}
      />
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
        ? p.cards
            .filter((c) => c.unlocked)
            .sort(
              (a, b) =>
                Number(p.featured.includes(b.name)) -
                Number(p.featured.includes(a.name)),
            )
            .slice(0, 8)
        : [],
    sets =
      d?.status === 'ready'
        ? d.holdingCards
            .filter(isCurrentSetCard)
            .sort((a, b) => Number(b.featured) - Number(a.featured))
            .slice(0, 4)
        : [];
  if (!badges.length && !sets.length) return null;
  return (
    <section className="trophy-case">
      <p className="eyebrow">EARNED. DISCOVERED. DISPLAYED.</p>
      <h2>Achievements & current Set Cards.</h2>
      <nav className="anchor-nav" aria-label="Collector accomplishments">
        <Link href={'/collector/' + slug + '/achievements'}>
          View Achievement Cards →
        </Link>
        <Link href={'/collector/' + slug + '/sets'}>
          Completed sets & progress →
        </Link>
      </nav>
      <div className="trophy-grid">
        {badges.map((b) => (
          <Link
            key={b.key}
            href={
              '/share?kind=achievement&entity=' +
              slug +
              '&key=' +
              b.key +
              '&format=trophy-card'
            }
          >
            <small>ACHIEVEMENT · {b.tier}</small>
            <AchievementBadge badge={b.badge} size="xl" />
            <h3>{b.name}</h3>
            <p>{b.description}</p>
          </Link>
        ))}
        {sets.map((s) => (
          <Link
            key={s.key}
            href={
              '/share?kind=set&entity=' +
              slug +
              '&key=' +
              s.key +
              '&format=trophy-card'
            }
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
