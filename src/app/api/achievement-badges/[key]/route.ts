import { readFile } from 'node:fs/promises';
import { currentSession } from '@/server/auth';
import { progressionView } from '@/server/progression';
import { achievementBadgeFile } from '@/server/achievement-badge-assets';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const collector = new URL(request.url).searchParams.get('collector');
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  if (
    key !== 'collector-systems-7' ||
    !collector ||
    !/^[0-9a-f-]{36}$/i.test(collector)
  )
    return new Response(null, { status: 404, headers });
  const session = await currentSession();
  const p = await progressionView(
    'COLLECTOR',
    collector,
    session?.collectorId !== collector,
  );
  if (
    p?.status !== 'ready' ||
    !p.cards.some((c) => c.key === key && c.unlocked)
  )
    return new Response(null, { status: 404, headers });
  const bytes = await readFile(achievementBadgeFile(key)!);
  return new Response(bytes, {
    headers: { ...headers, 'Content-Type': 'image/png' },
  });
}
