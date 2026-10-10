import Image from 'next/image';
import Link from 'next/link';

const accountLinks = [
  ['/collection', 'Collection'],
  ['/collection/dex', 'Dex'],
  ['/collection/discovered', 'Discovered'],
  ['/me/activity', 'Activity'],
  ['/me/achievements', 'Achievements'],
  ['/charm', '$CHARM'],
  ['/me/creations', 'Creations'],
  ['/settings/galleries', 'My galleries'],
  ['/settings/sharing', 'Share studio'],
  ['/settings/wallets', 'Wallets'],
  ['/settings/profile', 'Profile settings'],
  ['/settings/appearance', 'Appearance'],
  ['/settings/identity/merge', 'Identity review'],
] as const;

function AccountLinks({ slug, isPublic }: { slug: string; isPublic: boolean }) {
  return (
    <>
      <Link href={isPublic ? `/collector/${slug}` : '/settings/profile'}>
        {isPublic ? 'View public profile' : 'Profile settings'}
      </Link>
      {accountLinks.map(([href, label]) => (
        <Link href={href} key={href}>
          {label}
        </Link>
      ))}
      <form action="/api/auth/logout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </>
  );
}

export function SiteHeader({
  slug,
  isPublic,
}: {
  slug: string | null;
  isPublic: boolean;
}) {
  const homeHref = slug ? '/me' : '/connect';
  return (
    <header className="site-header">
      <Link className="brand-mark" href="/" aria-label="UglyDex home">
        <Image
          src="https://i.imgur.com/cFeByAf.png"
          alt="UglyDex"
          width={270}
          height={158}
          priority
        />
      </Link>
      <nav className="primary-nav" aria-label="Primary navigation">
        <Link href={homeHref}>My UglyDex</Link>
        <Link href="/squigs">Explore</Link>
        <Link href="/editions">Editions</Link>
      </nav>
      <div className="header-account">
        {slug ? (
          <details className="account-menu">
            <summary>
              <span className="account-orbit" aria-hidden>
                ✳
              </span>
              <span>My account</span>
              <span className="menu-chevron" aria-hidden>
                ⌄
              </span>
            </summary>
            <nav aria-label="Account navigation">
              <AccountLinks slug={slug} isPublic={isPublic} />
            </nav>
          </details>
        ) : (
          <Link className="button primary header-connect" href="/connect">
            Connect wallet <span aria-hidden>↗</span>
          </Link>
        )}
      </div>
      <details className="mobile-menu">
        <summary aria-label="Toggle site navigation">
          <span>Menu</span>
          <span className="menu-chevron" aria-hidden>
            ⌄
          </span>
        </summary>
        <nav aria-label="Mobile navigation">
          <Link href={homeHref}>My UglyDex</Link>
          <Link href="/squigs">Explore Squigs</Link>
          <Link href="/editions">Editions</Link>
          {slug && <AccountLinks slug={slug} isPublic={isPublic} />}
          {!slug && (
            <Link className="button primary" href="/connect">
              Connect wallet ↗
            </Link>
          )}
        </nav>
      </details>
    </header>
  );
}
