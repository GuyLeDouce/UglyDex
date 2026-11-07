import {
  SQUIGS_CUSTOMS_CONTRACT,
  SQUIGS_CUSTOMS_CONTRACT_URL,
} from '@/domain/customs-collection';
import Link from 'next/link';
import { editionCatalog } from '@/server/editions';
import { EditionGrid } from '@/components/editions';
import { absoluteUrl } from '@/server/sharing';
export async function generateMetadata() {
  return {
    title: 'Squigs Customs | UglyDex',
    description:
      'Explore verified Squigs Customs, a separate collectible catalog.',
    alternates: { canonical: absoluteUrl('/editions') },
  };
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const n = Number((await searchParams).page ?? 1),
    catalog = await editionCatalog(Number.isSafeInteger(n) ? n : 1);
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">ANOTHER KIND OF UGLY</p>
        <h1>Squigs Customs.</h1>
        <p>
          Each Squigs Custom is created specifically for the collector who
          purchases it. Commission yours in the Malformed Marketplace on Discord
          for 1,000,000 $CHARM.
        </p>
        <a
          className="button"
          href="https://squigs.io/discord"
          target="_blank"
          rel="noopener noreferrer"
        >
          Visit the Malformed Marketplace ↗
        </a>
        <p className="wallet-line">
          Contract:{' '}
          <a
            href={SQUIGS_CUSTOMS_CONTRACT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {SQUIGS_CUSTOMS_CONTRACT}
          </a>
        </p>
        <Link href="/collection/editions">Your verified Customs ↗</Link>
      </section>
      {catalog.items.length ? (
        <EditionGrid items={catalog.items} />
      ) : (
        <section className="empty-state">
          <h2>The next shelf is waiting.</h2>
          <p>
            No Squigs Customs have been verified in this UglyDex catalog yet.
          </p>
        </section>
      )}
      <nav className="pagination" aria-label="Custom pages">
        {catalog.page > 1 && (
          <Link href={'?page=' + (catalog.page - 1)}>Previous</Link>
        )}
        <span>
          {catalog.page} / {catalog.pages}
        </span>
        {catalog.page < catalog.pages && (
          <Link href={'?page=' + (catalog.page + 1)}>Next</Link>
        )}
      </nav>
    </>
  );
}
