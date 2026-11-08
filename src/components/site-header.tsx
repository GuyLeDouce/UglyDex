'use client';
import Image from 'next/image';
import { SquigsIcon } from './squigs-icon';
import Link from 'next/link';

const uglyDexLinks = [
  ['/collection', 'Collection'],
  ['/me/achievements', 'Achievements'],
  ['/me', 'Progress'],
  ['/charm', '$CHARM'],
  ['/thread', 'Community'],
  ['/settings/appearance', 'My Collector Card'],
] as const;

function NavigationLinks({
  slug,
  isPublic,
}: {
  slug: string | null;
  isPublic: boolean;
}) {
  return (
    <>
      {slug ? (
        <details className="account-menu nav-group">
          <summary>
            <SquigsIcon name="currently-owned" size={20} />
            My UglyDex{' '}
            <span className="menu-chevron" aria-hidden>
              ⌄
            </span>
          </summary>
          <nav aria-label="My UglyDex">
            {uglyDexLinks.map(([href, label]) => (
              <Link href={href} key={href}>
                {label}
              </Link>
            ))}
            {isPublic && (
              <Link href={`/collector/${slug}`}>View Public Profile</Link>
            )}
          </nav>
        </details>
      ) : (
        <Link href="/">Home</Link>
      )}
      <Link href="/squigs">Explore Squigs</Link>
      <Link href="/editions">Customs</Link>
      <Link href="/collectors">Top Collectors</Link>
      {slug ? (
        <>
          <details className="account-menu nav-group">
            <summary>
              Share Studio{' '}
              <span className="menu-chevron" aria-hidden>
                ⌄
              </span>
            </summary>
            <nav aria-label="Share Studio">
              <Link href="/settings/sharing">Open Share Studio</Link>
              <Link href="/settings/appearance">My Collector Card</Link>
            </nav>
          </details>
          <Link href="/settings/profile">Settings</Link>
        </>
      ) : (
        <Link href="/thread">Community</Link>
      )}
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
        <NavigationLinks slug={slug} isPublic={isPublic} />
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
      {!slug && (
        <div className="header-account">
          <Link className="button primary header-connect" href="/connect">
            Sign in <span aria-hidden>↗</span>
          </Link>
        </div>
      )}
      <details className="mobile-menu">
        <summary aria-label="Toggle site navigation">
          <span>Menu</span>
          <span className="menu-chevron" aria-hidden>
            ⌄
          </span>
        </summary>
        <nav aria-label="Mobile navigation">
          <NavigationLinks slug={slug} isPublic={isPublic} />
          {!slug && (
            <Link className="button primary" href="/connect">
              Sign in
            </Link>
          )}
        </nav>
      </details>
    </header>
  );
}
