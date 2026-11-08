'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { TrophyCardFace } from './trophy-card-face';
import { ShareControls } from './share-controls';
import { achievementTiers, type TrophyCardData } from '@/domain/trophy-card';
import { shareQuery } from '@/domain/sharing';

type Locked = {
  key: string;
  name: string;
  description: string;
  tier: string;
  progress: number;
  threshold: number;
  blocked: boolean;
};
export function TrophyAlbum({
  cards,
  locked,
  slug,
  owner = false,
  pendingAchievements,
  pendingSets,
}: {
  cards: TrophyCardData[];
  locked: Locked[];
  slug: string;
  owner?: boolean;
  pendingAchievements: boolean;
  pendingSets: boolean;
}) {
  const [kind, setKind] = useState(''),
    [tier, setTier] = useState(''),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState<TrophyCardData | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const filtered = cards.filter(
    (c) =>
      (!kind || c.kind === kind) &&
      (!tier || c.classification === tier) &&
      (!search ||
        `${c.name} ${c.description}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  function open(card: TrophyCardData) {
    setSelected(card);
    dialog.current?.showModal();
  }
  return (
    <>
      <form
        className="trophy-filters"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Filter achievement cards"
      >
        <label>
          Find a card
          <input
            type="search"
            placeholder="Search achievements or sets"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Collection
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setTier('');
            }}
          >
            <option value="">All unlocked cards</option>
            <option value="achievement">Achievements</option>
            <option value="set">Completed sets</option>
          </select>
        </label>
        <label>
          {kind === 'set' ? 'Difficulty' : 'Rarity / difficulty'}
          <select value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">All tiers</option>
            {(kind === 'set'
              ? ['Easy', 'Medium', 'Hard', 'Insane']
              : kind === 'achievement'
                ? achievementTiers
                : [...achievementTiers, 'Easy', 'Medium', 'Hard', 'Insane']
            ).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </form>
      <p className="muted" role="status">
        {filtered.length} of {cards.length} unlocked cards
      </p>
      {pendingAchievements && (
        <p>
          Achievement evaluation is pending. Confirmed cards will appear when
          processing finishes.
        </p>
      )}
      {pendingSets && (
        <p>
          Set evaluation is pending. Confirmed completions will appear when
          processing finishes.
        </p>
      )}
      <section
        className="trophy-album-grid"
        aria-label="Unlocked collector cards"
      >
        {filtered.map((card) => (
          <button
            type="button"
            className="trophy-album-card"
            key={card.kind + card.key}
            onClick={() => open(card)}
            aria-label={`Inspect ${card.name} collector card`}
          >
            <TrophyCardFace card={card} />
            <span className="trophy-card-action">
              Inspect · Download · Share ↗
            </span>
          </button>
        ))}
      </section>
      {!filtered.length && (
        <p>
          {cards.length
            ? 'No cards match these filters.'
            : 'Your trophy collection starts with your first confirmed achievement or completed set.'}
        </p>
      )}
      {!!locked.length && (
        <details className="trophy-locked">
          <summary>Not yet unlocked · {locked.length} achievements</summary>
          <div className="trophy-locked-grid">
            {locked.map((a) => (
              <article key={a.key}>
                <p className="eyebrow">{a.tier} · LOCKED</p>
                <h3>{a.name}</h3>
                <p>{a.description}</p>
                {a.threshold > 0 && (
                  <>
                    <progress
                      value={Math.min(a.progress, a.threshold)}
                      max={a.threshold}
                      aria-label={`${a.name} progress`}
                    />
                    <p>
                      {a.progress} / {a.threshold} qualifying records
                    </p>
                  </>
                )}
                {a.blocked && a.tier !== 'Secret' && (
                  <small>Awaiting qualifying evidence.</small>
                )}
              </article>
            ))}
          </div>
        </details>
      )}
      {owner && (
        <nav className="anchor-nav" aria-label="Find your next trophy">
          <Link href="/collection/sets?state=incomplete">
            Find unfinished sets →
          </Link>
          <Link href="/collection/traits?state=missing">
            Find missing traits →
          </Link>
        </nav>
      )}
      <dialog
        ref={dialog}
        className="trophy-dialog"
        aria-labelledby="trophy-dialog-title"
        onClose={() => setSelected(null)}
      >
        <button
          type="button"
          className="button trophy-close"
          onClick={() => dialog.current?.close()}
        >
          Close card ×
        </button>
        {selected && (
          <>
            <h2 id="trophy-dialog-title">{selected.name}</h2>
            <ShareControls
              key={selected.kind + selected.key}
              spec={{
                kind: selected.kind,
                entity: slug,
                key: selected.key,
                format: 'trophy-card',
              }}
              owner={owner}
              url={
                typeof window === 'undefined'
                  ? ''
                  : new URL(
                      '/share?' +
                        shareQuery({
                          kind: selected.kind,
                          entity: slug,
                          key: selected.key,
                          format: 'trophy-card',
                        }),
                      window.location.origin,
                    ).href
              }
              copy={`${selected.collector} · ${selected.name}. ${selected.description}`}
              label="Card download & sharing"
            />
          </>
        )}
      </dialog>
    </>
  );
}
