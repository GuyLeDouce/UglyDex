'use client';
import { useState } from 'react';
export function CharmRefresh() {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch('/api/charm/refresh', { method: 'POST' });
            setMessage(
              r.ok
                ? 'Refresh queued. Your cached balance stays available while DRIP is checked.'
                : r.status === 429
                  ? 'Please wait two minutes between refresh requests.'
                  : 'Refresh is temporarily unavailable.',
            );
          } catch {
            setMessage('Refresh is temporarily unavailable.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Queuing…' : 'Refresh balance'}
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
