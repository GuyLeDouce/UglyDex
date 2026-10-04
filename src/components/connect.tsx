'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
type Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};
export function Connect({ initialMessage = '' }: { initialMessage?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage),
    [busy, setBusy] = useState(false),
    [mergeRequestId, setMergeRequestId] = useState<string | null>(null);
  async function connect() {
    setBusy(true);
    setMessage('');
    try {
      const provider = (window as unknown as { ethereum?: Provider }).ethereum;
      if (!provider) {
        setMessage(
          'Open UglyDex in a browser with an Ethereum wallet installed.',
        );
        return;
      }
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      });
      if (!Array.isArray(accounts) || typeof accounts[0] !== 'string')
        throw new Error('No wallet account available.');
      const nonce = await fetch('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: accounts[0] }),
      });
      const challenge = await nonce.json();
      if (!nonce.ok) throw new Error(challenge.error);
      const encoded = `0x${Array.from(
        new TextEncoder().encode(challenge.message as string),
      )
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`;
      const signature = await provider.request({
        method: 'personal_sign',
        params: [encoded, accounts[0]],
      });
      const verified = await fetch('/api/auth/wallet/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature }),
      });
      const result = await verified.json();
      if (!verified.ok && typeof result.mergeRequestId === 'string') {
        setMergeRequestId(result.mergeRequestId);
        setMessage(
          'Both accounts were proved. Review the account merge to continue.',
        );
        return;
      }
      if (!verified.ok) throw new Error(result.error);
      router.push('/me');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === 'IDENTITY_REVIEW_REQUIRED'
          ? 'This credential belongs to a different Collector. Sign in again to the Collector you want to keep, then reconnect the other identity within five minutes.'
          : 'Wallet connection could not be completed. Check your wallet and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="actions">
        <button className="button primary" onClick={connect} disabled={busy}>
          {busy ? 'Waiting for wallet…' : 'Connect Wallet'}{' '}
          <span aria-hidden>↗</span>
        </button>
        <form method="post" action="/api/auth/discord">
          <button className="button" type="submit">
            Connect Discord
          </button>
        </form>
      </div>
      <p role="status" className="hint">
        {message || 'Your identity. Your collection. No transaction required.'}
      </p>
      {mergeRequestId && (
        <p>
          <a
            href={`/settings/identity/merge?request=${encodeURIComponent(mergeRequestId)}`}
          >
            Review and confirm account merge
          </a>
        </p>
      )}
    </div>
  );
}
