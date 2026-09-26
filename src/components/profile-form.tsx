'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
type Values = {
  slug: string;
  displayName: string;
  bio: string;
  avatar: string;
  isPublic: boolean;
  showWallets: boolean;
  showDiscord: boolean;
  featuredTokenIds: number[];
};
export function ProfileForm({ initial }: { initial: Values }) {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const f = new FormData(event.currentTarget);
    try {
      const data = {
        slug: f.get('slug'),
        displayName: f.get('displayName'),
        bio: f.get('bio'),
        avatar: f.get('avatar'),
        isPublic: f.has('isPublic'),
        showWallets: f.has('showWallets'),
        showDiscord: f.has('showDiscord'),
        featuredTokenIds: String(f.get('featured') || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map(Number),
      };
      const r = await fetch('/api/settings/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }),
        body = await r.json();
      setMessage(r.ok ? 'Profile saved.' : body.error);
      if (r.ok) router.refresh();
    } catch {
      setMessage('Profile could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="settings-form" onSubmit={submit}>
      <label>
        Username
        <input
          name="slug"
          required
          minLength={3}
          maxLength={48}
          pattern="[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*"
          defaultValue={initial.slug}
        />
        <small>
          3–48 letters, numbers, or hyphens. Your history stays with you when
          this changes.
        </small>
      </label>
      <label>
        Display name
        <input
          name="displayName"
          maxLength={60}
          defaultValue={initial.displayName}
        />
      </label>
      <label>
        Bio
        <textarea
          name="bio"
          maxLength={500}
          rows={4}
          defaultValue={initial.bio}
        />
      </label>
      <label>
        Avatar URL
        <input
          name="avatar"
          type="url"
          placeholder="https://…"
          defaultValue={initial.avatar}
        />
      </label>
      <label>
        Featured Squigs
        <input
          name="featured"
          defaultValue={initial.featuredTokenIds.join(', ')}
          placeholder="12, 75, 821"
        />
        <small>Up to six currently owned token IDs, separated by commas.</small>
      </label>
      <fieldset>
        <legend>Public profile privacy</legend>
        <label className="check">
          <input
            name="isPublic"
            type="checkbox"
            defaultChecked={initial.isPublic}
          />{' '}
          Make my profile public
        </label>
        <label className="check">
          <input
            name="showWallets"
            type="checkbox"
            defaultChecked={initial.showWallets}
          />{' '}
          Show linked wallet addresses publicly
        </label>
        <label className="check">
          <input
            name="showDiscord"
            type="checkbox"
            defaultChecked={initial.showDiscord}
          />{' '}
          Show my authenticated Discord username
        </label>
        <p className="hint">
          A public collection can be correlated with public blockchain records,
          even when addresses are hidden here.
        </p>
      </fieldset>
      <button className="button primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save profile'}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
