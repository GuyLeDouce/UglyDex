import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminActor } from '@/server/admin';
import { db } from '@/server/db';
import { exportCollectibles } from '@/server/collectibles';
import { CollectibleEditor } from './collectible-editor';
import { Artwork } from './artwork';
import { collectibleImageUrl } from '@/domain/collectibles';
export async function AdminCollectibleCatalog({
  kind,
  query,
}: {
  kind: 'CUSTOM' | 'EDITION';
  query: { edit?: string; token?: string };
}) {
  if (!(await adminActor())) notFound();
  const manifest = await exportCollectibles(kind),
    path = kind === 'CUSTOM' ? '/admin/customs' : '/admin/editions';
  const records = manifest.records.filter(
    (r) =>
      !query.token ||
      ('key' in r
        ? r.tokenId === Number(query.token)
        : r.relatedTokens.includes(Number(query.token))),
  );
  const selected = manifest.records.find(
    (r) => ('key' in r ? r.key : r.slug) === query.edit,
  );
  const entity = selected
    ? kind === 'CUSTOM'
      ? await db().squigCustom.findUnique({
          where: { key: query.edit! },
          select: { id: true },
        })
      : await db().squigEdition.findUnique({
          where: { slug: query.edit! },
          select: { id: true },
        })
    : null;
  const audits = entity
    ? await db().collectibleAudit.findMany({
        where: { entityId: entity.id, kind },
        orderBy: { createdAt: 'desc' },
        take: 30,
      })
    : [];
  return (
    <>
      <Link href="/admin/collectibles">← Collectible diagnostics</Link>
      <h1>{kind === 'CUSTOM' ? 'Official Customs' : 'Official Editions'}</h1>
      <p>
        Drafts remain private. Verification publishes approved artwork. Retiring
        preserves audit history and removes public presentation.
      </p>
      <form className="settings-form" method="get">
        <label>
          Search associated Reloaded token
          <input
            type="number"
            name="token"
            min={1}
            max={4444}
            defaultValue={query.token}
          />
        </label>
        <button className="button">Search</button>
      </form>
      <nav className="anchor-nav">
        <Link href={path}>New record</Link>
        <a href={'/api/admin/collectibles?kind=' + kind}>Export catalog JSON</a>
      </nav>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Status</th>
              <th>Revision</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const key = 'key' in r ? r.key : r.slug;
              return (
                <tr key={key}>
                  <td>
                    <Link href={path + '?edit=' + key}>{key}</Link>
                  </td>
                  <td>{r.name}</td>
                  <td>{r.status}</td>
                  <td>{r.revision}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected && (
        <div style={{ maxWidth: 320 }}>
          <Artwork
            src={collectibleImageUrl(selected.imageUri)}
            alt={selected.name}
          />
          <p>Admin preview · {selected.status}</p>
        </div>
      )}
      <h2>{selected ? 'Review / edit' : 'Add to catalog'}</h2>
      <CollectibleEditor
        key={query.edit ?? 'new'}
        kind={kind}
        initial={selected}
      />
      {audits.length > 0 && (
        <section>
          <h2>Audit history</h2>
          {audits.map((a) => (
            <details key={a.id}>
              <summary>
                {a.createdAt.toISOString()} · {a.action} · {a.actor}
              </summary>
              <pre className="table-scroll">
                {JSON.stringify(a.snapshot, null, 2)}
              </pre>
            </details>
          ))}
        </section>
      )}
    </>
  );
}
