'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function EditionCheck({ slug }: { slug: string }) {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch('/api/editions/ownership', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slug }),
            });
            setMessage(
              r.ok
                ? 'Finalized ownership checked for your verified wallets.'
                : 'Ownership verification unavailable. Sign in with a verified wallet and try again.',
            );
            if (r.ok) router.refresh();
          } catch {
            setMessage('Ownership verification unavailable.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Checking…' : 'Check my Edition ownership'}
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
