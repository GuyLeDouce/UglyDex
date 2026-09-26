'use client';
import { useState } from 'react';
import {
  cosmeticKinds,
  cosmeticCatalog,
  resolveAppearance,
  appearanceClass,
} from '@/domain/cosmetics';
export function AppearanceEditor({
  preferences,
  unlocked,
}: {
  preferences: { kind: string; cosmeticId: string }[];
  unlocked: string[];
}) {
  const [selected, setSelected] = useState(
    Object.fromEntries(
      cosmeticKinds.map((kind) => [
        kind,
        preferences.find(
          (p) => p.kind === kind && unlocked.includes(p.cosmeticId),
        )?.cosmeticId ??
          cosmeticCatalog.find((c) => c.kind === kind && c.source === 'FREE')!
            .id,
      ]),
    ),
  );
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const preview = resolveAppearance(
    Object.entries(selected).map(([kind, cosmeticId]) => ({
      kind,
      cosmeticId,
    })),
    unlocked,
  );
  return (
    <>
      <form
        className="settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch('/api/settings/appearance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(selected),
            });
            setMessage(
              r.ok
                ? 'Appearance saved.'
                : 'Unable to save; an entitlement may have changed.',
            );
          } catch {
            setMessage('Unable to save.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {cosmeticKinds.map((kind) => (
          <label key={kind}>
            {kind.toLowerCase().replaceAll('_', ' ')}
            <select
              aria-label={kind.toLowerCase().replaceAll('_', ' ')}
              value={selected[kind]}
              onChange={(e) =>
                setSelected({ ...selected, [kind]: e.target.value })
              }
            >
              {cosmeticCatalog
                .filter((c) => c.kind === kind)
                .map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    disabled={!unlocked.includes(c.id)}
                  >
                    {c.name}
                    {unlocked.includes(c.id)
                      ? ''
                      : ' — requires ' + c.source.toLowerCase()}
                  </option>
                ))}
            </select>
          </label>
        ))}
        <button className="button" disabled={busy}>
          Save appearance
        </button>
        <p role="status">{message}</p>
      </form>
      <section
        className={appearanceClass(preview)}
        aria-label="Appearance preview"
      >
        <p className="eyebrow">PREVIEW / YOUR OWN KIND OF UGLY</p>
        <h2>A little personality. All yours.</h2>
        <div className="panel">
          <h3>Your collection takes centre stage.</h3>
          <p>
            Artwork, captions and earned trophies remain readable in every
            style.
          </p>
        </div>
      </section>
    </>
  );
}
