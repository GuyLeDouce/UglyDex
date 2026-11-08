import { ShareControls } from '@/components/share-controls';
import { absoluteUrl } from '@/server/sharing';
import { GALLERIES_ENABLED } from '@/domain/features';
import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { db } from '@/server/db';
import { cosmeticAvailability } from '@/server/cosmetics';
import { AppearanceEditor } from '@/components/appearance-editor';
export default async function Page() {
  const id = await requireCollector();
  const [preferences, unlocked, collector] = await Promise.all([
    db().collectorCosmeticPreference.findMany({
      where: { collectorId: id },
      select: { kind: true, cosmeticId: true },
    }),
    cosmeticAvailability(id),
    db().collector.findUniqueOrThrow({
      where: { id },
      select: { slug: true, isPublic: true },
    }),
  ]);
  return (
    <>
      <p className="eyebrow">YOUR COLLECTION. YOUR HISTORY. YOUR LEGACY.</p>
      <h1>My Collector Card.</h1>
      <p>
        Your Avatar Squig, discoveries and earned progress, in one UglyDex
        holographic card.
      </p>
      <p>
        <Link className="text-link" href="/settings/profile">
          Edit display name & Avatar Squig →
        </Link>
      </p>
      <ShareControls
        spec={{
          kind: 'collector',
          entity: collector.slug,
          format: 'collector-card',
        }}
        url={absoluteUrl(
          '/share?' +
            new URLSearchParams({
              kind: 'collector',
              entity: collector.slug,
              format: 'collector-card',
            }),
        )}
        copy="Your collection. Your history. Your legacy."
        owner={!collector.isPublic}
        label="My Collector Card"
      />
      <details className="collection-extras">
        <summary>Profile appearance & existing share styles</summary>
        <p>
          Free themes and accents, with frames earned from verified
          achievements, completed sets or current OG/Legendary ownership.
        </p>
        {GALLERIES_ENABLED && (
          <Link href="/settings/galleries">Customize your galleries ↗</Link>
        )}
        <AppearanceEditor preferences={preferences} unlocked={unlocked} />
      </details>
    </>
  );
}
