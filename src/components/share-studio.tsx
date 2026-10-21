'use client';
import { useState } from 'react';
import { ShareControls } from './share-controls';
import { shareQuery, type ShareSpec } from '@/domain/sharing';
const COLLECTOR_BADGE_LIMIT = 12;
export function ShareStudio({
  slug,
  isPublic,
  base,
  achievements,
  defaultAchievements,
  sets,
  template,
}: {
  slug: string;
  isPublic: boolean;
  base: string;
  defaultAchievements: string[];
  achievements: { key: string; name: string }[];
  sets: { key: string; name: string }[];
  galleries: { slug: string; name: string; visibility: string }[];
  milestones: string[];
  template: ShareSpec['template'];
}) {
  const [kind, setKind] = useState<ShareSpec['kind']>('collector'),
    [privatePreview, setPrivatePreview] = useState(false),
    [key, setKey] = useState(''),
    [selected, setSelected] = useState<string[]>(defaultAchievements),
    [tokens, setTokens] = useState(''),
    [preset, setPreset] = useState<ShareSpec['preset']>('featured'),
    [count, setCount] = useState<4 | 9 | 16>(4),
    [seed, setSeed] = useState('ugly');
  const [selectedSets, setSelectedSets] = useState<string[]>(
    sets.slice(0, 6).map((s) => s.key),
  );
  const spec = {
    template,
    entity: slug,
    kind,
    ...(kind === 'collector'
      ? { achievements: selected.join(','), sets: selectedSets.join(',') }
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
          {['collector', 'collage'].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      {kind === 'collector' && (
        <fieldset>
          <legend>
            Earned achievements · {selected.length}/{COLLECTOR_BADGE_LIMIT}{' '}
            selected
          </legend>
          <p>Choose up to {COLLECTOR_BADGE_LIMIT} achievements per card.</p>
          <button
            type="button"
            onClick={() => setSelected(defaultAchievements)}
          >
            Use highest badge from each family
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
                  selected.length >= COLLECTOR_BADGE_LIMIT
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
      {kind === 'collector' && (
        <fieldset>
          <legend>Completed sets · {selectedSets.length}/6 selected</legend>
          <p>
            Choose up to six completed-set icons. Favourite Squigs come from
            your profile (up to six).
          </p>
          {sets.map((s) => (
            <label className="check" key={s.key}>
              <input
                type="checkbox"
                checked={selectedSets.includes(s.key)}
                disabled={
                  !selectedSets.includes(s.key) && selectedSets.length >= 6
                }
                onChange={(e) =>
                  setSelectedSets(
                    e.target.checked
                      ? [...selectedSets, s.key]
                      : selectedSets.filter((k) => k !== s.key),
                  )
                }
              />
              {s.name}
            </label>
          ))}
        </fieldset>
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
          owner={privatePreview || !isPublic}
        />
      )}
    </section>
  );
}
