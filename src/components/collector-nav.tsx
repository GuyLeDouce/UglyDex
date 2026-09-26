import Link from 'next/link';
export function CollectorNav({ slug }: { slug: string }) {
  return (
    <nav className="anchor-nav" aria-label="Collector navigation">
      {[
        ['', 'Showcase'],
        ['/collection', 'Collection'],
        ['/sets', 'Sets'],
        ['/achievements', 'Achievements'],
        ['/activity', 'Activity'],
        ['/creations', 'Creations'],
      ].map(([path, label]) => (
        <Link key={path} href={'/collector/' + slug + path}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
