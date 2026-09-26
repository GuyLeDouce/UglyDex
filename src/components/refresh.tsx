'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
type Status = { status: string; updatedAt: string | null; processed: number };
export function Refresh({ initial }: { initial: Status }) {
  const [state, setState] = useState(initial),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (!['QUEUED', 'SYNCING'].includes(state.status)) return;
    const timer = setInterval(async () => {
      try {
        const r = await fetch('/api/collection/refresh');
        if (!r.ok) return;
        const s: Status = await r.json();
        setState(s);
        if (s.status === 'COMPLETE') router.refresh();
      } catch {}
    }, 5000);
    return () => clearInterval(timer);
  }, [state.status, router]);
  async function refresh() {
    setBusy(true);
    try {
      const r = await fetch('/api/collection/refresh', { method: 'POST' }),
        s = await r.json();
      if (!r.ok) {
        setMessage(s.error);
        return;
      }
      setMessage('');
      setState({ ...state, status: s.status });
      if (s.status === 'COMPLETE') router.refresh();
    } catch {
      setMessage('Refresh could not be queued.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="refresh-bar">
      <div>
        <span className="status-dot" />{' '}
        {state.status === 'QUEUED'
          ? 'Refresh queued'
          : state.status === 'SYNCING'
            ? `Syncing ${state.processed.toLocaleString()} / 4,444`
            : state.status === 'FAILED'
              ? 'Refresh failed. You can retry.'
              : state.updatedAt
                ? `Last updated ${new Date(state.updatedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC`
                : 'Ownership has not been synced yet.'}
        <p role="status">{message}</p>
      </div>
      <button
        className="button"
        disabled={busy || ['QUEUED', 'SYNCING'].includes(state.status)}
        onClick={refresh}
      >
        ↻ Refresh Collection
      </button>
    </div>
  );
}
