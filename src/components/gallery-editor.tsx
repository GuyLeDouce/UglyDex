'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { z } from 'zod';
import type { gallerySchema } from '@/domain/sharing';
type Gallery = z.infer<typeof gallerySchema>;
export function GalleryEditor({
  initial,
  customs = [],
}: {
  initial?: Gallery;
  customs?: { tokenId: number; key: string; name: string }[];
}) {
  const [items, setItems] = useState(initial?.items ?? []),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [token, setToken] = useState('');
  const router = useRouter();
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/settings/galleries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...initial,
          slug: f.get('slug'),
          name: f.get('name'),
          description: f.get('description'),
          visibility: f.get('visibility'),
          mode: f.get('mode'),
          layout: f.get('layout'),
          featured: f.has('featured'),
          coverTokenId: f.get('cover') ? Number(f.get('cover')) : null,
          items,
        }),
      });
      const b = await r.json();
      if (r.ok) {
        router.push('/settings/galleries?edit=' + b.id);
        router.refresh();
        setMessage('Gallery saved.');
      } else setMessage(b.error);
    } catch {
      setMessage('Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, delta: number) {
    const next = [...items];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setItems(next);
  }
  return (
    <form className="settings-form" onSubmit={save}>
      <label>
        Gallery name
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={initial?.name}
        />
      </label>
      <label>
        Gallery slug
        <input
          name="slug"
          required
          minLength={3}
          maxLength={48}
          pattern="[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*"
          defaultValue={initial?.slug}
        />
      </label>
      <label>
        Description
        <textarea
          name="description"
          maxLength={500}
          defaultValue={initial?.description}
        />
      </label>
      <div className="share-options">
        <label>
          Visibility
          <select
            name="visibility"
            defaultValue={initial?.visibility ?? 'PRIVATE'}
          >
            <option>PRIVATE</option>
            <option>UNLISTED</option>
            <option>PUBLIC</option>
          </select>
        </label>
        <label>
          Evidence
          <select name="mode" defaultValue={initial?.mode}>
            <option value="CURRENT_COLLECTION">Currently owned</option>
            <option value="DISCOVERED_HISTORY">Discovered history</option>
          </select>
        </label>
        <label>
          Layout
          <select name="layout" defaultValue={initial?.layout}>
            <option>GRID</option>
            <option>EXHIBITION</option>
            <option>COMPACT</option>
          </select>
        </label>
      </div>
      <p>
        Current galleries hide sold Squigs. Historical galleries require
        confirmed discovery. Captions and section names are public when you
        publish. Up to 100 Squigs.
      </p>
      <label>
        Cover
        <select name="cover" defaultValue={initial?.coverTokenId ?? ''}>
          <option value="">Automatic collage</option>
          {items.map((i) => (
            <option key={i.tokenId}>{i.tokenId}</option>
          ))}
        </select>
      </label>
      <label className="check">
        <input
          name="featured"
          type="checkbox"
          defaultChecked={initial?.featured}
        />
        Feature this gallery
      </label>
      <div className="actions">
        <label>
          Add Squig
          <input
            type="number"
            min={1}
            max={4444}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="button"
          onClick={() => {
            const n = Number(token);
            if (
              Number.isInteger(n) &&
              n >= 1 &&
              n <= 4444 &&
              !items.some((i) => i.tokenId === n) &&
              items.length < 100
            ) {
              setItems([...items, { tokenId: n, caption: '', section: '' }]);
              setToken('');
            }
          }}
        >
          Add Squig
        </button>
      </div>
      <ol className="gallery-edit-list">
        {items.map((item, index) => (
          <li key={item.tokenId}>
            <strong>Squig #{item.tokenId}</strong>
            <label>
              Display artwork
              <select
                value={item.customKey ?? ''}
                onChange={(e) =>
                  setItems(
                    items.map((i, n) =>
                      n === index
                        ? { ...i, customKey: e.target.value || null }
                        : i,
                    ),
                  )
                }
              >
                <option value="">Original</option>
                {customs
                  .filter((c) => c.tokenId === item.tokenId)
                  .map((c) => (
                    <option key={c.key} value={c.key}>
                      Official Custom · {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Caption
              <input
                maxLength={180}
                value={item.caption}
                onChange={(e) =>
                  setItems(
                    items.map((i, n) =>
                      n === index ? { ...i, caption: e.target.value } : i,
                    ),
                  )
                }
              />
            </label>
            <label>
              Section
              <input
                maxLength={40}
                value={item.section}
                onChange={(e) =>
                  setItems(
                    items.map((i, n) =>
                      n === index ? { ...i, section: e.target.value } : i,
                    ),
                  )
                }
              />
            </label>
            <div className="actions">
              <button
                type="button"
                disabled={!index}
                onClick={() => move(index, -1)}
                aria-label={'Move Squig ' + item.tokenId + ' up'}
              >
                ↑ Up
              </button>
              <button
                type="button"
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
                aria-label={'Move Squig ' + item.tokenId + ' down'}
              >
                ↓ Down
              </button>
              <button
                type="button"
                onClick={() => setItems(items.filter((_, n) => n !== index))}
              >
                Remove #{item.tokenId}
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button className="button primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save gallery'}
      </button>
      {initial?.id && (
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={async () => {
            if (
              !confirm('Delete this gallery? Squigs and history are preserved.')
            )
              return;
            setBusy(true);
            try {
              const r = await fetch('/api/settings/galleries', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: initial.id }),
              });
              if (r.ok) {
                router.push('/settings/galleries');
                router.refresh();
              } else setMessage('Unable to delete.');
            } catch {
              setMessage('Unable to delete. Please try again.');
            } finally {
              setBusy(false);
            }
          }}
        >
          Delete gallery
        </button>
      )}
      <p role="status">{message}</p>
    </form>
  );
}
