import { DexSummary } from '@/components/dex';
import Link from 'next/link';
import { Progression } from '@/components/progression';
import { EcosystemSummary } from '@/components/activity';
import { notFound } from 'next/navigation';
import { collectorProfile } from '@/server/profiles';
import { Stats } from '@/components/stats';
import { Catalog, type SearchParams } from '@/components/catalog';
import { CollectionGrid } from '@/components/collection';
import { Artwork } from '@/components/artwork';
import { publicCollectorMetadata } from './metadata';
import { Timeline } from '@/components/timeline';
import { collectorHistory } from '@/server/provenance';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return publicCollectorMetadata((await params).slug);
}
export default async function Collector({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params,
    r = await collectorProfile(slug);
  if (r.status === 'missing') notFound();
  if (r.status !== 'ready')
    return (
      <section className="empty-state">
        <h1>Profile temporarily unavailable.</h1>
        <p>Please try again shortly.</p>
      </section>
    );
  const p = r.profile;
  const history = p.wallets.length ? await collectorHistory(r.collectorId) : [];
  return (
    <>
      <section className="page-heading profile-heading">
        <Artwork
          src={p.avatar}
          alt={`${p.displayName || p.slug} avatar`}
          avatar
        />
        <div>
          <p className="eyebrow">COLLECTOR FIELD RECORD</p>
          <h1>{p.displayName || p.slug}</h1>
          <p>@{p.slug}</p>
          <p className="bio">{p.bio}</p>
          {p.wallets.map((w) => (
            <p className="wallet-line" key={w}>
              {w}
            </p>
          ))}
          {p.discord.map((d) => (
            <p key={d}>Discord · {d}</p>
          ))}
        </div>
        <span className="badge">UGLYDEX COLLECTOR</span>
      </section>
      <Stats summary={r.summary} />
      <DexSummary
        id={r.collectorId}
        public
        path={`/collector/${p.slug}/sets`}
      />
      <Progression
        subject="COLLECTOR"
        id={r.collectorId}
        path={`/collector/${p.slug}/achievements`}
        public
      />
      <EcosystemSummary
        collectorId={r.collectorId}
        public
        path={`/collector/${p.slug}/activity`}
      />
      <nav className="anchor-nav">
        <Link href={`/collector/${p.slug}/activity`}>Activity</Link>
        <Link href={`/collector/${p.slug}/creations`}>Creations</Link>
      </nav>
      {history.length > 0 && (
        <section className="passport">
          <h2>Collection history</h2>
          <Timeline entries={history} />
        </section>
      )}
      {r.featured.length > 0 && (
        <>
          <div className="section-heading">
            <p className="eyebrow">PERSONALLY SELECTED</p>
            <h2>The showcase.</h2>
          </div>
          <CollectionGrid items={r.featured} controls={false} />
        </>
      )}
      <div className="section-heading">
        <h2>Current collection</h2>
        <p>{r.summary.discovered} Squigs discovered along the way.</p>
      </div>
      <Catalog
        collectorId={r.collectorId}
        params={await searchParams}
        path={`/collector/${p.slug}`}
      />
    </>
  );
}
