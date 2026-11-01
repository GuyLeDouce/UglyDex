'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CollectorMergeConfirm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function confirm() {
    setBusy(true);
    setMessage('Combining your accounts. Please keep this page open.');
    try {
      const response = await fetch('/api/auth/merge/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'MERGE_FAILED');
      setMessage(
        'Accounts merged. Opening your profile; collection progress may take a little longer to refresh.',
      );
      router.replace('/me');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === 'USERNAME_REQUIRED'
          ? 'Choose a username in Profile & privacy settings before merging multiple wallets, then return to confirm this request.'
          : error instanceof Error &&
              error.message === 'MERGE_CHARM_IDENTITY_CONFLICT'
            ? 'These accounts have separate DRIP identities that need review before they can be merged.'
            : error instanceof Error &&
                error.message === 'MERGE_REQUEST_EXPIRED'
              ? 'This request has expired. Reconnect both accounts to create a fresh request.'
              : error instanceof Error && error.message === 'MERGE_BUSY'
                ? 'Your collection is being updated. Wait a moment, then try confirming again.'
                : 'We could not confirm the result. Check My UglyDex first; if your accounts are still separate, try confirming again. You do not need to repeat verification unless the request has expired.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="actions">
      <button className="button primary" disabled={busy} onClick={confirm}>
        {busy ? 'Merging accounts…' : 'Confirm account merge'}
      </button>
      <a href="/settings/profile">Profile & privacy settings</a>
      <p role="status" className="hint">
        {message}
      </p>
    </div>
  );
}
