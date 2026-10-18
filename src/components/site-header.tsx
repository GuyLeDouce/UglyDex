'use client';
import Image from 'next/image';
import Link from 'next/link';

const accountLinks = [
  ['/thread', 'Collector thread'],
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
    <header
      className="site-header"
      onClick={(event) => {
        if (
          !(event.target instanceof Element) ||
          !event.target.closest('a, button')
        )
          return;
        event.currentTarget
          .querySelectorAll<HTMLDetailsElement>('details[open]')
          .forEach((menu) => {
            menu.open = false;
          });
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        const menu = (event.target as Element).closest('details');
        if (menu) {
          menu.open = false;
          menu.querySelector('summary')?.focus();
        }
      }}
    >
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
        <Link href="/collectors">Top Collectors</Link>
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
          <Link className="mobile-primary-link" href={homeHref}>
            My UglyDex
          </Link>
          <Link className="mobile-primary-link" href="/squigs">
            Explore Squigs
          </Link>
          <Link className="mobile-primary-link" href="/editions">
            Editions
          </Link>
          <Link className="mobile-primary-link" href="/collectors">
            Top Collectors
          </Link>
          {!slug && (
            <Link className="mobile-primary-link" href="/thread">
              Collector thread
            </Link>
          )}
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
