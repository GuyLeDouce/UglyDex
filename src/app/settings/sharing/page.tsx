import { requireCollector } from '@/server/session';
import { db } from '@/server/db';
import { progressionView } from '@/server/progression';
import { dexView } from '@/server/dex';
import { galleryList } from '@/server/galleries';
import { absoluteUrl } from '@/server/sharing';
import { ShareStudio } from '@/components/share-studio';
import { COLLECTION_RULESET } from '@/domain/dex';
export default async function Page() {
  const id = await requireCollector(),
    c = await db().collector.findUniqueOrThrow({
      where: { id },
      select: { slug: true, isPublic: true },
    });
  const [p, d, g, m] = await Promise.all([
    progressionView('COLLECTOR', id),
    dexView(id),
    galleryList(id, true),
    db().collectionMilestone.findMany({
      where: {
        collectorId: id,
        ruleset: COLLECTION_RULESET,
        key: { startsWith: 'completion:' },
        revokedAt: null,
      },
      select: { key: true },
    }),
  ]);
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">FROM THE LAB TO YOUR FEED</p>
        <h1>Share something ugly.</h1>
        <p>
          A curated card. A favourite freak. Your whole strange field guide.
        </p>
      </section>
      <ShareStudio
        slug={c.slug}
        isPublic={c.isPublic}
        base={absoluteUrl('/').slice(0, -1)}
        achievements={
          p?.status === 'ready'
            ? p.cards
                .filter((a) => a.unlocked)
                .map((a) => ({ key: a.key, name: a.name }))
            : []
        }
        sets={
          d?.status === 'ready'
            ? d.cards
                .filter((s) => s.complete)
                .map((s) => ({ key: s.key, name: s.name }))
            : []
        }
        galleries={g}
        milestones={[
          ...m.map((v) => v.key),
          ...(p?.status === 'ready'
            ? p.milestones.map((m) => 'level:' + m.level)
            : []),
        ]}
      />
    </>
  );
}
