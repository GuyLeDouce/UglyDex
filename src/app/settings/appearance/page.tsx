import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { db } from '@/server/db';
import { cosmeticAvailability } from '@/server/cosmetics';
import { AppearanceEditor } from '@/components/appearance-editor';
export default async function Page() {
  const id = await requireCollector();
  const [preferences, unlocked] = await Promise.all([
    db().collectorCosmeticPreference.findMany({
      where: { collectorId: id },
      select: { kind: true, cosmeticId: true },
    }),
    cosmeticAvailability(id),
  ]);
  return (
    <>
      <p className="eyebrow">PERSONAL. NEVER PAYWALLED.</p>
      <h1>Your kind of ugly.</h1>
      <p>
        Free themes and accents, with frames earned from verified achievements,
        completed sets or current OG/Legendary ownership. If eligibility
        changes, your display safely returns to its default.
      </p>
      <Link href="/settings/galleries">Customize your galleries ↗</Link>
      <AppearanceEditor preferences={preferences} unlocked={unlocked} />
    </>
  );
}
