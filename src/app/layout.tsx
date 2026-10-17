import type { Metadata } from 'next';
import { Lilita_One, Montserrat } from 'next/font/google';
import './globals.css';
import './collections.css';
import './sharing.css';
import './appearance.css';
import './visual.css';
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
export const metadata: Metadata = {
  title: 'UglyDex — Every Squig has a story',
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
        <SiteHeader slug={slug} isPublic={isPublic} />
        <main id="main">{children}</main>
        <footer>
          <span>UGLY LABS · BEAUTIFULLY MALFORMED</span>
          <span>One ecosystem. Every strange little story.</span>
        </footer>
      </body>
    </html>
  );
}
