'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CollectorMergeConfirm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function confirm() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/merge/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'MERGE_FAILED');
      router.replace('/me');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error &&
          error.message === 'MERGE_CHARM_IDENTITY_CONFLICT'
          ? 'These accounts have separate DRIP identities that need review before they can be merged.'
          : 'This merge request expired or could not be completed. Prove both accounts again to create a new request.',
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
      <p role="status" className="hint">
        {message}
      </p>
    </div>
  );
}
