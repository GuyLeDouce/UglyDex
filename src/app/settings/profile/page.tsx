import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { db } from '@/server/db';
import { ProfileForm } from '@/components/profile-form';
export default async function Settings() {
  const id = await requireCollector(),
    c = await db().collector.findUniqueOrThrow({ where: { id } });
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">MAKE IT YOURS</p>
        <h1>Your public face.</h1>
        <div className="actions">
          <Link href="/settings/galleries">Galleries →</Link>
          <Link href="/settings/sharing">Share studio →</Link>
          <Link href="/settings/wallets">Wallet settings →</Link>
          {c.isPublic && (
            <Link href={`/collector/${c.slug}`}>View public profile ↗</Link>
          )}
        </div>
      </section>
      <ProfileForm
        initial={{
          slug: c.slug,
          displayName: c.displayName ?? '',
          bio: c.bio ?? '',
          avatar: c.avatar ?? '',
          collectionVisibility: c.collectionVisibility,
          isPublic: c.isPublic,
          showWallets: c.showWallets,
          showDiscord: c.showDiscord,
          showCharmBalance: c.showCharmBalance,
          featuredTokenIds: c.featuredTokenIds,
        }}
      />
    </>
  );
}
