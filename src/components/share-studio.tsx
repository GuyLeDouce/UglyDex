'use client';
import { useState } from 'react';
import { ShareControls } from './share-controls';
import {
  MAX_SHARE_ACHIEVEMENTS,
  shareQuery,
  type ShareSpec,
} from '@/domain/sharing';
export function ShareStudio({
  slug,
  isPublic,
  base,
  achievements,
  sets,
  galleries,
  milestones,
  template,
}: {
  slug: string;
  isPublic: boolean;
  base: string;
  achievements: { key: string; name: string }[];
  sets: { key: string; name: string }[];
  galleries: { slug: string; name: string; visibility: string }[];
  milestones: string[];
  template: ShareSpec['template'];
}) {
  const [kind, setKind] = useState<ShareSpec['kind']>('collector'),
    [privatePreview, setPrivatePreview] = useState(false),
    [key, setKey] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [tokens, setTokens] = useState(''),
    [preset, setPreset] = useState<ShareSpec['preset']>('featured'),
    [count, setCount] = useState<4 | 9 | 16>(4),
    [seed, setSeed] = useState('ugly');
  const choices =
    kind === 'achievement'
      ? achievements
      : kind === 'set'
        ? sets
        : kind === 'gallery'
          ? galleries.map((g) => ({ key: g.slug, name: g.name }))
          : kind === 'milestone'
            ? milestones.map((m) => ({ key: m, name: m }))
            : [];
  const spec = {
    template,
    entity: slug,
    kind,
    ...(kind === 'achievement'
      ? selected.length
        ? { achievements: selected.join(',') }
        : {}
      : key
        ? { key }
        : {}),
    ...(kind === 'collage'
      ? { preset, count, seed, ...(tokens ? { tokens } : {}) }
      : {}),
  };
  return (
    <section className="settings-form">
      <label>
        Card
        <select
          aria-label="Card"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as typeof kind);
            setKey('');
          }}
        >
          {[
            'collector',
            'completion',
            'trophy',
            'collage',
            'achievement',
            'set',
            'gallery',
            'discovery',
            'milestone',
          ].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      {kind !== 'achievement' && choices.length > 0 && (
        <label>
          Choose an earned item
          <select value={key} onChange={(e) => setKey(e.target.value)}>
            <option value="">Select…</option>
            {choices.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === 'achievement' && (
        <fieldset>
          <legend>
            Earned achievements · {selected.length}/{MAX_SHARE_ACHIEVEMENTS}{' '}
            selected
          </legend>
          <p>Choose up to {MAX_SHARE_ACHIEVEMENTS} achievements per card.</p>
          <button
            type="button"
            onClick={() =>
              setSelected(
                achievements.slice(0, MAX_SHARE_ACHIEVEMENTS).map((a) => a.key),
              )
            }
          >
            {achievements.length <= MAX_SHARE_ACHIEVEMENTS
              ? 'Select all'
              : 'Select first 12'}
          </button>
          <button type="button" onClick={() => setSelected([])}>
            Clear selection
          </button>
          {achievements.map((a) => (
            <label className="check" key={a.key}>
              <input
                type="checkbox"
                checked={selected.includes(a.key)}
                disabled={
                  !selected.includes(a.key) &&
                  selected.length >= MAX_SHARE_ACHIEVEMENTS
                }
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, a.key]
                      : selected.filter((k) => k !== a.key),
                  )
                }
              />
              {a.name}
            </label>
          ))}
          {!achievements.length && <p>No earned achievements available yet.</p>}
        </fieldset>
      )}
      {kind === 'discovery' && (
        <label>
          Discovered Squig token
          <input
            type="number"
            min={1}
            max={4444}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <small>
            Requires confirmed discovery and public wallet-attribution consent.
          </small>
        </label>
      )}
      {kind === 'collage' && (
        <>
          <label>
            Selection
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as typeof preset)}
            >
              <option value="featured">Featured / favourites</option>
              <option value="points">Top UglyPoints</option>
              <option value="recent">Recently observed acquisition</option>
              <option value="random">Deterministic shuffle</option>
            </select>
          </label>
          <label>
            Size
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value) as typeof count)}
            >
              <option>4</option>
              <option>9</option>
              <option>16</option>
            </select>
          </label>
          <label>
            Or choose exactly 4, 9 or 16 owned token IDs
            <input
              value={tokens}
              onChange={(e) => setTokens(e.target.value.replaceAll(' ', ''))}
              placeholder="12,75,821,3157"
            />
          </label>
          {preset === 'random' && (
            <button
              className="button"
              onClick={() => setSeed(String(Date.now()))}
            >
              Reshuffle
            </button>
          )}
        </>
      )}
      <p>
        Cards use confirmed indexed values. Pending evaluations and private
        evidence are omitted. Set and achievement cards require an active
        completion or unlock.
      </p>
      {isPublic && (
        <label className="check">
          <input
            type="checkbox"
            checked={privatePreview}
            onChange={(e) => setPrivatePreview(e.target.checked)}
          />
          Owner preview — include my collection even when hidden publicly
        </label>
      )}
      {(kind !== 'achievement' || selected.length > 0) && (
        <ShareControls
          key={JSON.stringify(spec) + privatePreview}
          spec={spec}
          url={base + '/share?' + shareQuery(spec)}
          copy="Still ugly. Still hunting."
          owner={
            privatePreview ||
            !isPublic ||
            (kind === 'gallery' &&
              galleries.find((g) => g.slug === key)?.visibility === 'PRIVATE')
          }
        />
      )}
    </section>
  );
}
