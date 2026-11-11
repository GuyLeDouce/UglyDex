'use client';
import type { AdminCharmDiagnostic } from '@/domain/admin-charm';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
export type AdminProfile = {
  charm?: AdminCharmDiagnostic;
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
  details: string[];
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
            <ul>
              {profile.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      {profile.notes && (
        <details>
          <summary>Support notes</summary>
          <p style={{ whiteSpace: 'pre-wrap' }}>{profile.notes}</p>
        </details>
      )}
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
      {profile.charm && (
        <details style={{ margin: '16px 0' }}>
          <summary style={{ cursor: 'pointer' }}>
            $CHARM diagnostics — {profile.charm.holderBalance ?? 'Unavailable'}{' '}
            · {profile.charm.state}
          </summary>
          <p>{profile.charm.reason}</p>
          <p>
            <strong>Next action:</strong> {profile.charm.action}
          </p>
          <dl style={{ overflowWrap: 'anywhere' }}>
            {Object.entries({
              'Holder-facing balance':
                profile.charm.holderBalance ?? 'Unavailable',
              'Saved balance':
                profile.charm.savedBalance ??
                'Unavailable — no balance recorded',
              'Balance freshness': `${profile.charm.balanceStatus} · ${profile.charm.stale ? 'stale / unverified' : 'current'}`,
              'Balance observed (UTC)': profile.charm.observedAt ?? 'Never',
              'Successful balance read (UTC)':
                profile.charm.lastApiSuccessAt ?? 'Never',
              'Refresh requested (UTC)':
                profile.charm.queuedAt ?? 'No request recorded',
              'Queue record': profile.charm.requestPending
                ? 'Pending'
                : 'Not pending',
              'Shared DRIP last success (UTC)':
                profile.charm.sharedLastSuccessAt ?? 'Never recorded',
              'Shared DRIP next eligible read (UTC)':
                profile.charm.sharedNextRequestAt ?? 'Not recorded',
              'Shared DRIP error': profile.charm.sharedError ?? 'None recorded',
              'Ecosystem worker mode': profile.charm.workerMode,
              'Worker heartbeat (UTC)':
                profile.charm.workerHeartbeat ?? 'None recorded',
              'Snapshot checked (UTC)': profile.charm.checkedAt,
            }).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <small>
            Read-only snapshot of the same stored balance used by UglyDex.
            Shared worker activity does not confirm this profile is processing.
            Viewing this panel does not request a refresh.
          </small>
        </details>
      )}
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
          data-profile-editing="true"
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
            Private support notes
            <textarea
              name="notes"
              maxLength={2000}
              defaultValue={profile.notes}
              rows={3}
              placeholder="Optional notes; these do not control the automatic status"
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

export function AdminHealthRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        !document.querySelector('[data-profile-editing]')
      )
        router.refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
