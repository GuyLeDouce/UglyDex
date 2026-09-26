import Link from 'next/link';
import { notFound } from 'next/navigation';
import { editionDetail, ownedEditions } from '@/server/editions';
import { currentSession } from '@/server/auth';
import { absoluteUrl } from '@/server/sharing';
import { Artwork } from '@/components/artwork';
import { EditionCheck } from '@/components/edition-check';
import { editionHistory } from '@/server/edition-history';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const e = await editionDetail((await params).slug);
  if (!e) return { title: 'UglyDex', robots: { index: false, follow: false } };
  return {
    title: e.name + ' | UglyDex Editions',
    description: e.description || 'Official Squigs Edition',
    alternates: { canonical: absoluteUrl('/editions/' + e.slug) },
  };
}
export default async function Page({ params }: Props) {
  const e = await editionDetail((await params).slug);
  if (!e) notFound();
  const history = await editionHistory(e.slug);
  const session = await currentSession(),
    owned = session
      ? (await ownedEditions(session.collectorId)).find(
          (o) => o.slug === e.slug,
        )
      : null;
  return (
    <>
      <Link href="/editions">← Official Editions</Link>
      <section className="specimen">
        <Artwork src={e.image} alt={e.name} priority />
        <div className="specimen-info">
          <p className="eyebrow">OFFICIAL EDITION</p>
          <h1>{e.name}</h1>
          <p>{e.description}</p>
          <p>{e.artist && 'Art by ' + e.artist}</p>
          <dl>
            <dt>Issued</dt>
            <dd>{e.issuedAt?.slice(0, 10) ?? 'Not documented'}</dd>
            <dt>Supply</dt>
            <dd>{e.supply ?? 'Not documented'}</dd>
            <dt>Catalog verification</dt>
            <dd>{e.verifiedAt?.slice(0, 10)}</dd>
          </dl>
          {e.standard !== 'NONE' && (
            <p className="wallet-line">
              {e.standard} · Chain {e.chainId} · {e.contractAddress} · Token{' '}
              {e.tokenId}
            </p>
          )}
          <p>
            This Edition is separate from Reloaded traits, sets and UglyDex
            completion.
          </p>
          {owned && (
            <p className="badge">
              {owned.amount} owned · verified{' '}
              {owned.checkedAt.slice(0, 16).replace('T', ' ')} UTC
            </p>
          )}
          {e.chainId === 1 && e.standard !== 'NONE' ? (
            <>
              <EditionCheck slug={e.slug} />
              <small>
                Read-only check at a finalized block. Ownership observations
                expire after 15 minutes.
              </small>
            </>
          ) : (
            <p>
              Ownership verification is unavailable for this catalog entry.
              Catalog inclusion is not an ownership claim.
            </p>
          )}
        </div>
      </section>
      {e.relatedTokens.length > 0 && (
        <section>
          <h2>Associated Reloaded Squigs</h2>
          <div className="tags">
            {e.relatedTokens.map((t) => (
              <Link key={t} href={'/squig/' + t}>
                Squig #{t}
              </Link>
            ))}
          </div>
        </section>
      )}
      {history && (
        <section>
          <h2>Edition history</h2>
          <p>
            {history.complete
              ? 'Indexed through the observed finalized block'
              : 'Incomplete indexed history'}{' '}
            · {history.total} transfer records · through block{' '}
            {history.through ?? 'not started'}. Latest 50 events; wallet
            identities are not published.
          </p>
          <ol>
            {history.events.map((event) => (
              <li key={event.id}>
                {event.kind} · quantity {event.quantity} ·{' '}
                {event.at.slice(0, 10)} · block {event.block}
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
