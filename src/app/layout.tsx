import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import './collections.css';
import { currentSession } from '@/server/auth';
import { db } from '@/server/db';
export const metadata: Metadata = {
  title: 'UglyDex — Every Squig has a story',
  description: 'The identity layer for the Ugly ecosystem.',
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let slug: string | null = null;
  let isPublic = false;
  try {
    const s = await currentSession();
    if (s) {
      const profile = await db().collector.findUnique({
        where: { id: s.collectorId },
        select: { slug: true, isPublic: true },
      });
      slug = profile?.slug ?? null;
      isPublic = profile?.isPublic ?? false;
    }
  } catch {}
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header>
          <Link className="wordmark" href="/">
            UGLYDEX<span className="mark">✳</span>
          </Link>
          <nav aria-label="Main navigation">
            {slug && (
              <>
                <Link href="/me">My UglyDex</Link>
                <Link href="/collection">Collection</Link>
                <Link href="/collection/discovered">Discovered</Link>
              </>
            )}
            <Link href="/squigs">Explore</Link>
            {slug ? (
              <>
                <Link
                  href={isPublic ? `/collector/${slug}` : '/settings/profile'}
                >
                  Profile
                </Link>
                <Link href="/settings/profile">Settings</Link>
                <form action="/api/auth/logout" method="post">
                  <button className="nav-button">Sign out</button>
                </form>
              </>
            ) : (
              <Link className="nav-connect" href="/connect">
                Connect Wallet ↗
              </Link>
            )}
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer>
          <span>UGLY LABS · BEAUTIFULLY MALFORMED</span>
          <span>One ecosystem. Every strange little story.</span>
        </footer>
      </body>
    </html>
  );
}
