import { notFound, redirect } from 'next/navigation';
import { currentSession } from '@/server/auth';
import { collectorCardTokenIds } from '@/server/collector-card';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Your Collector Card | UglyDex',
  robots: { index: false },
};

export default async function CollectorCard({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;
  if (!/^[1-9][0-9]{0,3}$/.test(tokenId) || Number(tokenId) > 4444) notFound();
  const session = await currentSession();
  if (!session) redirect('/connect');
  // Recheck on click: a card left open before a transfer must not retain access.
  const owned = await collectorCardTokenIds(session.collectorId, [
    Number(tokenId),
  ]);
  if (!owned.length) notFound();
  redirect(`/share?kind=passport&entity=${tokenId}&format=trading-card`);
}
