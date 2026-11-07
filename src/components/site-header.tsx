'use client';
import { GALLERIES_ENABLED } from '@/domain/features';
import Image from 'next/image';
import Link from 'next/link';

const accountLinks = [
  ['/me', 'Profile & progress'],
  ['/thread', 'Community'],
  ['/charm', '$CHARM'],
  ['/settings/sharing', 'Share studio'],
  ['/settings/wallets', 'Linked wallets'],
  ['/settings/profile', 'Profile settings'],
  ['/settings/appearance', 'Appearance'],
  ['/settings/galleries', 'My galleries'],
] as const;

function AccountLinks({ slug, isPublic }: { slug: string; isPublic: boolean }) {
  return (
    <>
      <Link href={isPublic ? `/collector/${slug}` : '/settings/profile'}>
        {isPublic ? 'View public profile' : 'Profile settings'}
      </Link>
      {accountLinks
        .filter(([href]) => GALLERIES_ENABLED || href !== '/settings/galleries')
        .map(([href, label]) => (
          <Link href={href} key={href}>
            {label}
          </Link>
        ))}
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
  const homeHref = slug ? '/collection' : '/';
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
        <Link href={homeHref}>{slug ? 'My Collection' : 'Home'}</Link>
        <Link href="/squigs">Explore</Link>
        {slug && <Link href="/me">Profile</Link>}
      </nav>
      {slug && (
        <form
          className="header-signout"
          action="/api/auth/logout"
          method="post"
        >
          <button type="submit">Sign out</button>
        </form>
      )}
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
          <Link className="button header-connect" href="/connect">
            Sign in <span aria-hidden>↗</span>
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
            {slug ? 'My Collection' : 'Home'}
          </Link>
          <Link className="mobile-primary-link" href="/squigs">
            Explore Squigs
          </Link>
          <Link className="mobile-primary-link" href="/editions">
            Customs
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
            <Link className="button" href="/connect">
              Sign in
            </Link>
          )}
        </nav>
      </details>
    </header>
  );
}
