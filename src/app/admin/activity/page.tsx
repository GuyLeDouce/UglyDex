import { notFound } from 'next/navigation';
import { adminActor } from '@/server/admin';
import { db } from '@/server/db';
import { Prisma } from '@/generated/prisma/client';
export const dynamic = 'force-dynamic';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await adminActor())) notFound();
  const p = await searchParams;
  const value = (key: string) =>
    typeof p[key] === 'string' ? p[key].slice(0, 300) : undefined;
  const where: Prisma.CollectorActivityWhereInput = {};
  const collector = value('collector');
  if (collector && /^[0-9a-f-]{36}$/.test(collector))
    where.collectorId = collector;
  if (value('discord')) where.discordId = value('discord');
  if (value('wallet')) where.walletAddress = value('wallet')?.toLowerCase();
  if (value('source')) where.sourceType = value('source');
  if (value('record')) where.sourceId = value('record');
  if (value('event')) where.eventType = value('event');
  const token = Number(value('token'));
  if (Number.isInteger(token) && token >= 1 && token <= 4444)
    where.squig = { tokenId: token };
  const after = value('after');
  if (after && /^[0-9a-f-]{36}$/.test(after)) where.id = { gt: after };
  const [rows, runs, rejections] = await Promise.all([
    db().collectorActivity.findMany({
      where,
      orderBy: { id: 'asc' },
      take: 51,
      include: {
        corrections: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { reason: true, createdAt: true },
        },
      },
    }),
    db().syncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }),
    db().importRejection.findMany({
      where: { resolvedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
  ]);
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(p))
    if (typeof v === 'string') query.set(k, v);
  query.set('after', rows[49]?.id ?? '');
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">INTERNAL / SOURCE EVIDENCE</p>
        <h1>Activity inspection</h1>
      </section>
      <form className="panel" method="get">
        {[
          'collector',
          'discord',
          'wallet',
          'token',
          'source',
          'record',
          'event',
        ].map((k) => (
          <label key={k}>
            {k}
            <input name={k} defaultValue={value(k)} />
          </label>
        ))}
        <button className="button">Search</button>
      </form>
      <div className="ecosystem-cards">
        {rows.slice(0, 50).map((r) => (
          <article className="panel" key={r.id}>
            <h3>{r.eventType}</h3>
            <p>
              {r.sourceSystem} / {r.sourceType} / {r.sourceId}
            </p>
            <p>
              {r.attributionStatus} · {r.recordStatus} · {r.visibility}
            </p>
            <p>Source time {r.eventAt.toISOString()}</p>
            <p>Imported {r.importedAt.toISOString()}</p>
            {r.correctedAt && <p>Corrected {r.correctedAt.toISOString()}</p>}
            {r.corrections.map((c, i) => (
              <small key={i}>
                {c.reason} {c.createdAt.toISOString()}
                <br />
              </small>
            ))}
          </article>
        ))}
      </div>
      {rows.length > 50 && (
        <a className="button" href={`?${query}`}>
          Next records →
        </a>
      )}
      <section className="panel">
        <h2>Recent import runs</h2>
        {runs.map((r) => (
          <p key={r.id}>
            {r.source} · {r.status} · {r.startedAt.toISOString()} ·{' '}
            {JSON.stringify(r.counts)}
          </p>
        ))}
      </section>
      <section className="panel">
        <h2>Rejected records</h2>
        {rejections.map((r) => (
          <p key={r.id}>
            {r.source}/{r.sourceRecordId} · {r.code} · {r.attempts} attempts
          </p>
        ))}
      </section>
    </>
  );
}
