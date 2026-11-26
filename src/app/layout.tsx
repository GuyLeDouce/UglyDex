import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import './legal.css';
import { Lilita_One, Montserrat } from 'next/font/google';
import './globals.css';
import './collections.css';
import './sharing.css';
import './appearance.css';
import './design-tokens.css';
import './visual.css';
import './field-guide.css';
import './achievement-badges.css';
import './community.css';
import './card-album.css';
import './collection-album.css';
import './interactive-card.css';
import './trophy-cards.css';
import { currentSession } from '@/server/auth';
import { db } from '@/server/db';
import { SiteHeader } from '@/components/site-header';
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-montserrat',
});
const lilitaOne = Lilita_One({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-lilita-one',
});
export const viewport: Viewport = {
  themeColor: '#101318',
  colorScheme: 'dark',
};
export const metadata: Metadata = {
  title: 'UglyDex — Squigs Holder Zone',
  description:
    'A living field guide to Squigs Reloaded. Every Squig has a story.',
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
    <html lang="en" className={`${montserrat.variable} ${lilitaOne.variable}`}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <nav className="holder-zone-bar" aria-label="Squigs ecosystem">
          <a href="https://squigs.io/" aria-label="Back to squigs.io">
            <Image
              src="/brand/squigs-reloaded.webp"
              width={55}
              height={32}
              alt=""
            />
          </a>
          <a href="https://squigs.io/collection.html">Collection</a>
          <a href="https://squigs.io/studio.html">Studio</a>
          <a href="https://squigs.io/uglyboard.html">UglyBoard</a>
          <a href="https://imagesubmit-production.up.railway.app/">
            Image Factory
          </a>
        </nav>
        <SiteHeader slug={slug} isPublic={isPublic} />
        <main id="main">{children}</main>
        <footer>
          <span>UGLY LABS · BEAUTIFULLY MALFORMED</span>
          <a href="mailto:UglyLabs@gmail.com?subject=UglyDex%20early%20access%20feedback">
            Send early access feedback
          </a>
          <nav aria-label="Legal">
            <Link href="/privacy">Privacy Policy</Link>
            {' · '}
            <Link href="/terms">Terms of Service</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
