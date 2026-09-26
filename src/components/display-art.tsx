'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function DisplayArt({
  tokenId,
  customs,
  selected,
}: {
  tokenId: number;
  customs: { key: string; name: string }[];
  selected: string | null;
}) {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="settings-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const key = new FormData(e.currentTarget).get('custom');
        setBusy(true);
        try {
          const r = await fetch('/api/settings/display-art', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokenId, key: key || null }),
          });
          setMessage(
            r.ok
              ? 'Display artwork saved.'
              : 'Unable to save. Current ownership and verified artwork are required.',
          );
          if (r.ok) router.refresh();
        } catch {
          setMessage('Unable to save.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Your UglyDex display art
        <select name="custom" defaultValue={selected ?? ''}>
          <option value="">Original</option>
          {customs.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name} · Official Custom
            </option>
          ))}
        </select>
      </label>
      <p>
        Applies to your UglyDex showcase while you own this Squig. The NFT’s
        original artwork and traits stay unchanged.
      </p>
      <button className="button" disabled={busy}>
        Save display art
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
