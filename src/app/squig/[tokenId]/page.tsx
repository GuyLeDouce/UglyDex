import { ActivityView, EcosystemSummary } from '@/components/activity';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { squigProfile } from '@/server/profiles';
import { Artwork } from '@/components/artwork';
import { Passport } from '@/components/passport';
import { passport } from '@/server/provenance';
export default async function Squig({
  params,
  searchParams,
}: {
  params: Promise<{ tokenId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const r = await squigProfile((await params).tokenId);
  if (r.status === 'invalid') notFound();
  if (r.status !== 'ready')
    return (
      <section className="empty-state">
        <h1>Squig #{r.tokenId}</h1>
        <p>
          {r.status === 'empty'
            ? 'This Squig has not been indexed yet.'
            : 'The index is temporarily unavailable.'}
        </p>
        <Link href="/squigs">Back to the field guide →</Link>
      </section>
    );
  const s = r.squig;
  const history = await passport(r.squigId, await searchParams);
  return (
    <>
      <div className="breadcrumb">
        <Link href="/squigs">Field guide</Link>
        <span>/ Squig #{s.tokenId}</span>
      </div>
      <section className="specimen">
        <Artwork src={s.image} alt={`Squig #${s.tokenId}`} priority />
        <div className="specimen-info">
          <p className="eyebrow">SQUIGS RELOADED / ETHEREUM</p>
          <h1>
            Squig <span>#{s.tokenId}</span>
          </h1>
          <div className="tags">
            <span>{s.rarity ?? 'Unclassified'}</span>
            {s.og && <span>OG</span>}
            {s.legendary && <span className="legendary">Legendary</span>}
          </div>
          {r.relationship && <p className="relationship">● {r.relationship}</p>}
          <div className="specimen-stats">
            <div>
              <strong>{s.uglyPoints?.toLocaleString() ?? '—'}</strong>
              <span>UglyPoints</span>
            </div>
            <div>
              <strong>{s.mawRank ?? '—'}</strong>
              <span>Maw Rank</span>
            </div>
          </div>
          <p>
            One of 4,444 creatures from another world, come to observe and
            imitate humans.
          </p>
          <nav className="anchor-nav" aria-label="Squig sections">
            <a href="#traits">Traits</a>
            <a href="#points">UglyPoints</a>
            <a href="#ownership">Ownership</a>
            <a href="#passport">Passport</a>
          </nav>
        </div>
      </section>
      <section id="traits" className="section-heading">
        <p className="eyebrow">THE ANATOMY OF UGLY</p>
        <h2>Every little detail.</h2>
        <div className="trait-grid">
          {s.traits.map((t) => (
            <Link
              className="trait"
              key={t.traitType}
              href={`/squigs?trait=${encodeURIComponent(t.traitType)}&value=${encodeURIComponent(t.value)}`}
            >
              <small>{t.traitType}</small>
              <strong>{t.value || 'Not recorded'}</strong>
              <span aria-hidden>↗</span>
            </Link>
          ))}
        </div>
      </section>
      <div className="profile-grid">
        <section id="points" className="panel">
          <h2>UglyPoints</h2>
          <p className="big-number">
            {s.uglyPoints?.toLocaleString() ?? 'Unavailable'}
          </p>
          <p>
            Canonical collection power from the UglyBot dataset. Maw Rank
            follows the ecosystem’s shared rarity rules.
          </p>
          <small>
            Rarity class: {s.rarity ?? 'Not indexed'} · No financial valuation.
          </small>
        </section>
        <section id="ownership" className="panel">
          <h2>{r.digested ? 'Digested · preserved forever' : 'Ownership'}</h2>
          {r.digested && (
            <p>
              The Maw records a verified digestion. This Squig’s artwork and
              history remain part of UglyDex.
            </p>
          )}
          {r.owner ? (
            <>
              <Link className="text-link" href={`/collector/${r.owner.slug}`}>
                {r.owner.displayName || r.owner.slug} ↗
              </Link>
              {r.owner.wallet && (
                <p className="wallet-line">{r.owner.wallet}</p>
              )}
            </>
          ) : (
            <p>
              {r.ownershipUpdatedAt
                ? 'Owner identity is private or unlinked.'
                : 'Current ownership has not been indexed.'}
            </p>
          )}
          {r.ownershipUpdatedAt && (
            <small>
              Observed{' '}
              {r.ownershipUpdatedAt.toLocaleDateString('en-US', {
                timeZone: 'UTC',
              })}
            </small>
          )}
          {r.discoveredAt && (
            <p>
              You discovered this Squig on{' '}
              {r.discoveredAt.toLocaleDateString('en-US', { timeZone: 'UTC' })}.
            </p>
          )}
          <p>{r.transferCount} indexed transfers</p>
          <small>
            Indexed observations may cover only part of this Squig’s lifetime.
          </small>
        </section>
      </div>
      <Passport data={history} tokenId={s.tokenId} />
      <EcosystemSummary
        squigId={r.squigId}
        public
        path={`/squig/${s.tokenId}#ecosystem`}
      />
      <ActivityView
        squigId={r.squigId}
        public
        path={`/squig/${s.tokenId}`}
        params={await searchParams}
      />
    </>
  );
}
