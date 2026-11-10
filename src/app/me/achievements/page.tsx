import { requireCollector } from '@/server/session';
import { TrophyAlbum } from '@/components/trophy-album';
import { trophyAlbum } from '@/server/trophy-album';
import { progressionView } from '@/server/progression';
import { ProgressionPreferences } from '@/components/progression-preferences';
export default async function Page() {
  const id = await requireCollector(),
    [p, album] = await Promise.all([
      progressionView('COLLECTOR', id),
      trophyAlbum(id),
    ]);
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">THE EVIDENCE OF UGLY</p>
        <h1>Your achievement cards.</h1>
        <p>
          Achievement Cards preserve your history. Set Cards reflect your
          current collection.
        </p>
      </section>
      {album && (
        <>
          <p className="trophy-album-stats">
            {album.level !== null
              ? `Level ${album.level} · ${album.xp} XP · `
              : ''}
            {album.cards.length} available collector cards
          </p>
          {p?.status === 'ready' && (
            <details>
              <summary>How this XP was earned</summary>
              <ul>
                {p.breakdown.map((b) => (
                  <li key={b.label}>
                    {b.count} {b.label} · {b.xp} XP
                  </li>
                ))}
              </ul>
            </details>
          )}
          <TrophyAlbum {...album} owner />
        </>
      )}
      <details>
        <summary>Featured badges & collector title</summary>
        {p?.status === 'ready' && (
          <ProgressionPreferences
            choices={p.cards
              .filter((c) => c.unlocked)
              .map((c) => ({
                key: c.key,
                name: c.name,
                title: c.title,
                badge: c.badge,
              }))}
            title={
              p.cards.find((c) => c.title === p.title && c.title)?.key ?? ''
            }
            featured={p.cards
              .filter((c) => p.featured.includes(c.name))
              .map((c) => c.key)}
          />
        )}
      </details>
    </>
  );
}
