'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function WalletBlockControls({
  walletAddress,
  blockedAt,
}: {
  walletAddress?: string;
  blockedAt?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  async function submit(form: FormData) {
    setBusy(true);
    setMessage('');
    try {
      const result = await fetch('/api/admin/blockwallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          walletAddress
            ? { action: 'unblock', walletAddress, blockedAt }
            : {
                action: 'block',
                walletAddress: form.get('walletAddress'),
                reason: form.get('reason'),
              },
        ),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error);
      setMessage(data.message);
      setConfirmed(false);
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Request failed. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form action={submit}>
      {!walletAddress && (
        <>
          <label>
            Ethereum wallet address
            <input
              name="walletAddress"
              required
              pattern="0x[0-9a-fA-F]{40}"
              maxLength={42}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              disabled={busy || refreshing}
            />
          </label>
          <label>
            Admin-only reason
            <textarea
              name="reason"
              required
              maxLength={500}
              rows={2}
              disabled={busy || refreshing}
            />
          </label>
        </>
      )}
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          disabled={busy || refreshing}
        />{' '}
        {walletAddress
          ? 'Restore visibility where permitted by the owner’s preferences and other blocks.'
          : 'Hide profiles associated with this wallet from public collector views.'}
      </label>
      <button
        className="button"
        disabled={!confirmed || busy || refreshing}
        type="submit"
      >
        {busy || refreshing
          ? 'Updating…'
          : walletAddress
            ? 'Unblock wallet'
            : 'Block wallet'}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
