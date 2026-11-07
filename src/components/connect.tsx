'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
type Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};
export function Connect({
  initialMessage = '',
  showDiscord = true,
}: {
  initialMessage?: string;
  showDiscord?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage),
    [busy, setBusy] = useState(false),
    [walletUrl, setWalletUrl] = useState(''),
    [mergeRequestId, setMergeRequestId] = useState<string | null>(null);
  async function connect() {
    setBusy(true);
    setMessage('');
    try {
      const provider = (window as unknown as { ethereum?: Provider }).ethereum;
      if (!provider) {
        setWalletUrl(`${window.location.origin}/connect`);
        setMessage(
          'No wallet detected in this browser. Open UglyDex in your wallet app to continue.',
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
      router.push(result.next || '/onboarding');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === 'USERNAME_REQUIRED'
          ? 'Choose a username in Profile & privacy settings before linking a second wallet.'
          : error instanceof Error &&
              error.message === 'IDENTITY_REVIEW_REQUIRED'
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
        {showDiscord && (
          <form method="post" action="/api/auth/discord">
            <button className="button" type="submit">
              Sign in with linked Discord
            </button>
          </form>
        )}
      </div>
      {walletUrl && (
        <div className="wallet-handoff">
          <p>Choose your wallet app, then tap Connect Wallet there.</p>
          <div className="actions">
            <a
              className="button primary"
              href={`https://link.metamask.io/dapp/${walletUrl.replace(/^https?:\/\//, '')}`}
            >
              Open in MetaMask
            </a>
            <a
              className="button"
              href={`https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(walletUrl)}`}
            >
              Open in Trust Wallet
            </a>
          </div>
          <p className="hint">
            Continue wallet verification and Discord setup inside the wallet
            browser. Signing in there does not sign you into this browser. To
            add another wallet, first sign in to your existing Collector there.
          </p>
          <p className="hint">
            App not opening? Open this address in your wallet’s built-in
            browser: <a href={walletUrl}>{walletUrl}</a>. If you opened UglyDex
            inside Discord, try opening it in Safari or Chrome first. On
            desktop, enable your Ethereum wallet extension and try Connect
            Wallet again.
          </p>
        </div>
      )}
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
