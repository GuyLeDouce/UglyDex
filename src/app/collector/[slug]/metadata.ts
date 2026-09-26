import 'server-only';
import type { Metadata } from 'next';
import { db } from '@/server/db';
export async function publicCollectorMetadata(slug: string): Promise<Metadata> {
  if (!/^[a-z0-9-]{1,80}$/i.test(slug))
    return { title: 'Collector not found — UglyDex', robots: { index: false } };
  try {
    const p = await db().collector.findFirst({
      where: { slug: { equals: slug, mode: 'insensitive' }, isPublic: true },
      select: { displayName: true, slug: true, bio: true },
    });
    if (!p)
      return { title: 'Private collector — UglyDex', robots: { index: false } };
    const title = `${p.displayName || p.slug} — UglyDex`,
      description =
        p.bio || 'A beautifully strange Squigs Reloaded collection.';
    return {
      title,
      description,
      openGraph: { title, description, type: 'profile' },
      twitter: { card: 'summary', title, description },
    };
  } catch {
    return { title: 'UglyDex collector', robots: { index: false } };
  }
}
