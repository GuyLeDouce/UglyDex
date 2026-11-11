'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supportStatuses } from '@/domain/admin-profiles';
export type AdminProfile = {
  id: string;
  revision: string;
  updatedAt: string;
  slug: string;
  displayName: string;
  wallets: string[];
  discordIds: string[];
  dripId: string;
  status: 'ACTIVE' | 'ERROR' | 'UPDATING';
  notes: string;
  statusUpdatedAt: string | null;
};
export function AdminProfileEditor({ profile }: { profile: AdminProfile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lines = (key: string) =>
      String(form.get(key) ?? '')
        .split(/[\s,]+/)
        .filter(Boolean);
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          slug: form.get('slug'),
          displayName: form.get('displayName'),
          wallets: lines('wallets'),
          discordIds: lines('discordIds'),
          dripId: String(form.get('dripId') ?? '').trim(),
          status: form.get('status'),
          notes: form.get('notes'),
          reason: form.get('reason'),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save.');
      setMessage(
        `Saved.${result.sessionsRevoked ? ' Existing sessions signed out; new Discord IDs require wallet sign-in followed by Discord authentication.' : ''}${result.dripNeedsVerification ? ' DRIP balance is hidden pending verification through the existing linking/sync flow.' : ''}`,
      );
      setEditing(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="panel" style={{ padding: '1.2rem', minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h2>
          {profile.displayName || profile.slug} <small>@{profile.slug}</small>
        </h2>
        {profile.status === 'ACTIVE' ? (
          <strong style={{ color: '#78dfad' }}>● ACTIVE</strong>
        ) : (
          <details>
            <summary
              style={{
                color: profile.status === 'ERROR' ? '#ff9999' : '#ffdc78',
                cursor: 'pointer',
              }}
            >
              <strong>● {profile.status}</strong> — details
            </summary>
            <p style={{ whiteSpace: 'pre-wrap', maxWidth: 600 }}>
              {profile.notes || 'No support note recorded.'}
            </p>
            {profile.statusUpdatedAt && (
              <small>
                Updated {new Date(profile.statusUpdatedAt).toISOString()}
              </small>
            )}
          </details>
        )}
      </div>
      <dl style={{ overflowWrap: 'anywhere' }}>
        <dt>Wallet addresses (Ethereum)</dt>
        <dd>
          {profile.wallets.length
            ? profile.wallets.map((w) => <div key={w}>{w}</div>)
            : 'None linked'}
        </dd>
        <dt>Discord ID(s)</dt>
        <dd>{profile.discordIds.join(', ') || 'Not linked'}</dd>
        <dt>DRIP ID</dt>
        <dd>{profile.dripId || 'Not linked'}</dd>
      </dl>
      <button
        type="button"
        className="button"
        onClick={() => setEditing(!editing)}
        disabled={busy}
      >
        {editing ? 'Cancel' : 'Edit profile'}
      </button>
      {editing && (
        <form
          className="review-form"
          onSubmit={save}
          style={{ display: 'grid', gap: 12, marginTop: 16 }}
        >
          <label>
            Username
            <input name="slug" required defaultValue={profile.slug} />
          </label>
          <label>
            Display name
            <input
              name="displayName"
              maxLength={60}
              defaultValue={profile.displayName}
            />
          </label>
          <label>
            Wallet addresses — one per line
            <textarea
              name="wallets"
              rows={Math.min(8, Math.max(3, profile.wallets.length))}
              defaultValue={profile.wallets.join('\n')}
            />
          </label>
          <small>
            Adding an address grants access to this profile to its wallet
            holder. Removing an address revokes its login link and retains
            history. Addresses already linked to other profiles are rejected.
          </small>
          <label>
            Discord IDs — one per line
            <textarea
              name="discordIds"
              rows={2}
              defaultValue={profile.discordIds.join('\n')}
            />
          </label>
          <small>
            New Discord IDs require the holder to sign in with their wallet and
            authenticate Discord. The owner ID is protected.
          </small>
          <label>
            DRIP ID
            <input
              name="dripId"
              defaultValue={profile.dripId}
              pattern="[a-fA-F0-9]{24}"
            />
          </label>
          <small>
            Changing identity details clears the cached $CHARM balance until
            verified again.
          </small>
          <label>
            Support status
            <select name="status" defaultValue={profile.status}>
              {supportStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Status details
            <textarea
              name="notes"
              maxLength={2000}
              defaultValue={profile.notes}
              rows={3}
              placeholder="Required for ERROR or UPDATING"
            />
          </label>
          <label>
            Reason for this edit
            <input name="reason" required minLength={3} maxLength={500} />
          </label>
          <button type="submit" className="button" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </article>
  );
}
