'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function WalletActions({
  id,
  isPrimary,
}: {
  id: string;
  isPrimary: boolean;
}) {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function change(action: string) {
    if (
      action === 'revoke' &&
      !window.confirm(
        'Revoke this wallet? Your history stays. All sessions will sign out; use a remaining wallet or Discord to return.',
      )
    )
      return;
    setBusy(true);
    try {
      const r = await fetch('/api/settings/wallets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletId: id, action }),
        }),
        body = await r.json();
      if (!r.ok) setMessage(body.error);
      else if (body.signedOut) {
        router.push('/connect');
        router.refresh();
      } else router.refresh();
    } catch {
      setMessage('Wallet change failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="actions">
        {!isPrimary && (
          <button
            className="button"
            disabled={busy}
            onClick={() => change('primary')}
          >
            Make primary
          </button>
        )}
        <button
          className="button danger"
          disabled={busy}
          onClick={() => change('revoke')}
        >
          Revoke wallet
        </button>
      </div>
      <p role="status">{message}</p>
    </>
  );
}
