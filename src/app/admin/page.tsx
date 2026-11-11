import Link from 'next/link';
import { adminProfileHealth } from '@/server/admin-health';
import { notFound } from 'next/navigation';
import { adminActor } from '@/server/admin';
import { db } from '@/server/db';
import { readEnv } from '@/server/env';
import {
  adminProfileInclude,
  adminProfileRevision,
} from '@/server/admin-profiles';
import {
  AdminProfileEditor,
  AdminHealthRefresh,
} from '@/components/admin-profile-editor';
import { supportStatuses } from '@/domain/admin-profiles';
import type { Prisma } from '@/generated/prisma/client';
export const dynamic = 'force-dynamic';
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await adminActor())) notFound();
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const status =
    typeof params.status === 'string' &&
    supportStatuses.includes(params.status as (typeof supportStatuses)[number])
      ? params.status
      : '';
  const page = Math.min(10000, Math.max(1, Number(params.page) || 1)) | 0;
  const where: Prisma.CollectorWhereInput = {
    mergedIntoCollectorId: null,
    AND: [
      {
        OR: [
          { claimedAt: { not: null } },
          { wallets: { some: {} } },
          { identities: { some: {} } },
        ],
      },
      ...(q
        ? [
            {
              OR: [
                { slug: { contains: q, mode: 'insensitive' as const } },
                { displayName: { contains: q, mode: 'insensitive' as const } },
                {
                  wallets: {
                    some: {
                      walletAddress: {
                        contains: q,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                },
                { identities: { some: { externalId: { contains: q } } } },
                {
                  dripIdentities: {
                    some: {
                      dripMemberId: {
                        contains: q,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                },
              ],
            },
          ]
        : []),
    ],
  };
  const health = await adminProfileHealth();
  if (status)
    where.id = {
      in: [...health]
        .filter(([, value]) => value.status === status)
        .map(([id]) => id),
    };
  const [profiles, count] = await Promise.all([
    db().collector.findMany({
      where,
      include: adminProfileInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * 25,
      take: 25,
    }),
    db().collector.count({ where }),
  ]);
  const realmId = readEnv().DRIP_REALM_ID;
  const url = (p: number) =>
    `/admin?${new URLSearchParams({ q, status, page: String(p) })}`;
  return (
    <>
      <AdminHealthRefresh />
      <section className="page-heading">
        <h1>Collector support</h1>
        <p>
          Manage connected profiles and linked identities. Private to your
          Discord login.
        </p>
        <p>
          Status is detected automatically from update jobs, setup and identity
          checks. Click ERROR or UPDATING for details. ACTIVE means no issue
          detected in these checks.
        </p>
        <Link href="/admin/collectors">Collector diagnostics</Link> ·{' '}
        <Link href="/admin/blockwallet">Blocked wallets</Link> ·{' '}
        <Link href="/admin/integrations">Integrations</Link>
      </section>
      <form
        method="get"
        className="panel review-form"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 16 }}
      >
        <label style={{ flex: '1 1 260px' }}>
          Search profiles
          <input
            name="q"
            defaultValue={q}
            placeholder="Username, wallet, Discord ID, or DRIP ID"
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {supportStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button className="button">Search</button>
      </form>
      <p>
        {count} profiles · Page {page} of {Math.max(1, Math.ceil(count / 25))}
      </p>
      <div style={{ display: 'grid', gap: 16 }}>
        {profiles.map((p) => (
          <AdminProfileEditor
            key={p.id}
            profile={{
              id: p.id,
              revision: adminProfileRevision(p),
              updatedAt: p.updatedAt.toISOString(),
              slug: p.slug,
              displayName: p.displayName ?? '',
              wallets: p.wallets.map((w) => w.walletAddress),
              discordIds: p.identities.map((i) => i.externalId),
              dripId:
                p.dripIdentities.find((d) => d.realmId === realmId)
                  ?.dripMemberId ?? '',
              status: health.get(p.id)?.status ?? 'ACTIVE',
              details: health.get(p.id)?.details ?? [],
              notes: p.support?.notes ?? '',
            }}
          />
        ))}
      </div>
      {!profiles.length && <p>No matching connected profiles.</p>}
      <nav
        aria-label="Profile pages"
        style={{ display: 'flex', gap: 24, margin: '24px 0' }}
      >
        {page > 1 && <Link href={url(page - 1)}>← Previous</Link>}
        {page * 25 < count && <Link href={url(page + 1)}>Next →</Link>}
      </nav>
    </>
  );
}
