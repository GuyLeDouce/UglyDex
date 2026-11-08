import { ShareControls } from '@/components/share-controls';
import { absoluteUrl } from '@/server/sharing';
import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { db } from '@/server/db';
export default async function Page() {
  const id = await requireCollector();
  const collector = await db().collector.findUniqueOrThrow({
    where: { id },
    select: { slug: true, isPublic: true },
  });
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
    </>
  );
}
