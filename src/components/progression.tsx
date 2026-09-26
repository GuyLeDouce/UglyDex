import Link from 'next/link';
import { progressionView } from '@/server/progression';
import type { Subject } from '@/domain/progression';
export async function Progression({
  subject,
  id,
  path,
  public: isPublic = false,
  full = false,
}: {
  subject: Subject;
  id: string;
  path: string;
  public?: boolean;
  full?: boolean;
}) {
  const p = await progressionView(subject, id, isPublic);
  if (!p) return null;
  if (p.status === 'pending')
    return (
      <section className="panel progression">
        <p className="eyebrow">PROGRESSION</p>
        <h2>History becomes character.</h2>
        <p>
          Progression is awaiting evaluation. Confirmed history will appear here
          once processed.
        </p>
      </section>
    );
  return (
    <section className="progression" aria-label="Progression">
      <div className="panel progression-summary">
        <div>
          <p className="eyebrow">
            {subject === 'SQUIG'
              ? 'CHARACTER HISTORY'
              : 'TRACKED ECOSYSTEM HISTORY'}
          </p>
          <h2>Level {p.level}</h2>
          {p.title && <p className="badge">{p.title}</p>}
          <p>
            {BigInt(p.xp).toLocaleString()} XP ·{' '}
            {BigInt(p.remaining).toLocaleString()} to Level {p.level + 1}
          </p>
          <progress
            value={p.percent}
            max={100}
            aria-label="Progress to next level"
          />
          <p>
            {p.count} achievements ·{' '}
            <Link href={path}>View achievements →</Link>
          </p>
          {p.featured.map((name) => (
            <span className="badge" key={name}>
              {name}
            </span>
          ))}
          <details>
            <summary>How this XP was earned</summary>
            {p.breakdown.length ? (
              <ul>
                {p.breakdown.map((b) => (
                  <li key={b.label}>
                    {b.count} {b.label} · {b.xp} XP
                  </li>
                ))}
              </ul>
            ) : (
              <p>No qualifying XP evidence yet.</p>
            )}
          </details>
        </div>
        <div>
          <h3>Recently earned</h3>
          {p.recent.length ? (
            p.recent.map((a) => (
              <p key={a.name}>
                {a.name}
                <small>
                  {new Date(a.at!).toLocaleDateString('en-US', {
                    timeZone: 'UTC',
                  })}
                </small>
              </p>
            ))
          ) : (
            <p>Your story is still unfolding.</p>
          )}
          {p.milestones.slice(0, 2).map((m) => (
            <small key={m.level}>
              Level {m.level} reached{' '}
              {new Date(m.at).toLocaleDateString('en-US', { timeZone: 'UTC' })}
              <br />
            </small>
          ))}
        </div>
      </div>
      {full &&
        [...new Set(p.cards.map((c) => c.category))].map((category) => (
          <section key={category}>
            <div className="section-heading">
              <h2>{category}</h2>
            </div>
            <div className="achievement-grid">
              {p.cards
                .filter((c) => c.category === category)
                .map((c) => (
                  <article
                    className={`panel achievement ${c.unlocked ? 'unlocked' : 'locked'}`}
                    key={c.key}
                  >
                    <p className="eyebrow">
                      {c.tier} · {c.unlocked ? 'EARNED' : 'LOCKED'}
                    </p>
                    <h3>{c.name}</h3>
                    <p>{c.description}</p>
                    {c.threshold > 0 && (
                      <>
                        <progress
                          value={Math.min(c.progress, c.threshold)}
                          max={c.threshold}
                          aria-label={`${c.name} progress`}
                        />
                        <small>
                          {c.progress} / {c.threshold} confirmed records
                        </small>
                      </>
                    )}
                    {c.blocked && <p>Awaiting qualifying evidence.</p>}
                    {c.at && (
                      <p>
                        Qualified{' '}
                        {new Date(c.at).toLocaleDateString('en-US', {
                          timeZone: 'UTC',
                        })}
                      </p>
                    )}
                    {c.title && <small>Title: {c.title}</small>}
                  </article>
                ))}
            </div>
          </section>
        ))}
      {full && (
        <p className="muted">
          Awards reflect confirmed, tracked history. Missing imports may leave
          progress incomplete. Display tiers carry no financial value.
        </p>
      )}
    </section>
  );
}
