import { collectorHandle } from '@/domain/profile';
import { ShareControls } from '@/components/share-controls';
import { absoluteUrl } from '@/server/sharing';
import {
  GalleryShowcase,
  TrophyCase,
  CollectorHighlights,
  CollectorActivityPreview,
} from '@/components/showcase';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { collectorProfile } from '@/server/profiles';
import { type SearchParams } from '@/components/catalog';
import { CollectionGrid } from '@/components/collection';
import { Artwork } from '@/components/artwork';
import { publicCollectorMetadata } from './metadata';
import { appearance } from '@/server/cosmetics';
import { appearanceClass } from '@/domain/cosmetics';
import { ownedEditions } from '@/server/editions';
import { EditionGrid } from '@/components/editions';
import { formatAmount } from '@/domain/activity';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return publicCollectorMetadata((await params).slug);
}
export default async function Collector({
  params,
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
  const [style, editions] = await Promise.all([
    appearance(r.collectorId),
    ownedEditions(r.collectorId, true),
  ]);
  return (
    <div className={appearanceClass(style)}>
      <section className="page-heading profile-heading">
        <Artwork
          src={p.avatar}
          alt={`${p.displayName || p.slug} avatar`}
          avatar
        />
        <div>
          <p className="eyebrow">COLLECTOR FIELD RECORD</p>
          <h1>{p.displayName || p.slug}</h1>
          <p>{collectorHandle(p.slug, p.unclaimed)}</p>
          <p className="bio">{p.bio}</p>
          {r.charm?.balance !== null && r.charm?.balance !== undefined && (
            <p>
              {formatAmount(r.charm.balance)} $CHARM · updated{' '}
              {r.charm.updatedAt?.slice(0, 10)}
              {r.charm.stale ? ' · last known balance' : ''}
            </p>
          )}
          {p.wallets.map((w) => (
            <p className="wallet-line" key={w}>
              {w}
            </p>
          ))}
          {p.discord.map((d) => (
            <p key={d}>Discord · {d}</p>
          ))}
        </div>
        <span className="badge">
          {p.unclaimed ? 'UNCLAIMED HOLDER' : 'UGLYDEX COLLECTOR'}
        </span>
      </section>
      {p.unclaimed && (
        <section className="panel">
          <h2>Your wallet. Your history.</h2>
          <p>
            This public holder record comes from indexed blockchain ownership.
            No owner has claimed it. Wallet history is not proof of who
            controlled it in the past.
          </p>
          <Link className="button" href="/connect">
            Verify your wallet to claim this profile
          </Link>
          <p>{r.summary.owned} Squigs currently held.</p>
        </section>
      )}
      {r.chainHistory.length > 0 && (
        <section className="panel">
          <h2>Verified blockchain history</h2>
          <p>
            Latest indexed wallet holding periods. These describe the address,
            not the historical identity of its owner.
          </p>
          <ul>
            {r.chainHistory.map((h, i) => (
              <li key={i}>
                <Link href={`/squig/${h.tokenId}`}>Squig #{h.tokenId}</Link> ·{' '}
                {h.acquiredAt.slice(0, 10)} →{' '}
                {h.lostAt?.slice(0, 10) ?? 'Currently held'}
              </li>
            ))}
          </ul>
        </section>
      )}
      <ShareControls
        spec={{ kind: 'collector', entity: p.slug, template: style.share }}
        url={absoluteUrl('/collector/' + p.slug)}
        copy={(p.displayName || p.slug) + ' — still ugly. Still hunting.'}
      />
      <CollectorHighlights id={r.collectorId} slug={p.slug} />
      {r.featured.length > 0 && (
        <section className="featured-exhibition">
          <p className="eyebrow">PERSONALLY SELECTED</p>
          <h2>The favourite freaks.</h2>
          <CollectionGrid
            items={r.featured}
            controls={false}
            favorites={r.featured.map((s) => s.tokenId)}
          />
        </section>
      )}
      <TrophyCase id={r.collectorId} slug={p.slug} />
      {editions.length > 0 && (
        <section>
          <p className="eyebrow">A DIFFERENT KIND OF COLLECTIBLE</p>
          <h2>Editions · {editions.length} owned</h2>
          <EditionGrid items={editions} />
        </section>
      )}
      <GalleryShowcase id={r.collectorId} slug={p.slug} />
      <CollectorActivityPreview id={r.collectorId} slug={p.slug} />
      {r.collectionVisibility === 'FULL' && (
        <Link className="button" href={'/collector/' + p.slug + '/collection'}>
          Explore the full collection →
        </Link>
      )}
    </div>
  );
}
