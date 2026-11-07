import Link from 'next/link';

export function CollectorCardLink({ tokenId }: { tokenId: number }) {
  return (
    <Link
      className="button collector-card-link"
      href={`/squig/${tokenId}/collector-card`}
      prefetch={false}
      aria-label={`Download Collector Card for Squig #${tokenId}`}
      title="Open your ready-to-download Squigs Reloaded Collector Card"
    >
      <span aria-hidden="true">↓</span>
      <span className="collector-card-label">Download Collector Card</span>
    </Link>
  );
}
