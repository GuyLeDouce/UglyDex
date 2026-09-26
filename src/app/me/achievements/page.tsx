import { requireCollector } from '@/server/session';
import { Progression } from '@/components/progression';
import { progressionView } from '@/server/progression';
import { ProgressionPreferences } from '@/components/progression-preferences';
export default async function Page() {
  const id = await requireCollector(),
    p = await progressionView('COLLECTOR', id);
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">THE EVIDENCE OF UGLY</p>
        <h1>Your achievements.</h1>
        <p>Earned through participation. Kept through history.</p>
      </section>
      {p?.status === 'ready' && (
        <ProgressionPreferences
          choices={p.cards
            .filter((c) => c.unlocked)
            .map((c) => ({ key: c.key, name: c.name, title: c.title }))}
          title={p.cards.find((c) => c.title === p.title && c.title)?.key ?? ''}
          featured={p.cards
            .filter((c) => p.featured.includes(c.name))
            .map((c) => c.key)}
        />
      )}
      <Progression subject="COLLECTOR" id={id} path="/me/achievements" full />
    </>
  );
}
