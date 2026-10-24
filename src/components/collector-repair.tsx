'use client';
import { useState } from 'react';
export function CollectorRepair() {
  const [after, setAfter] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState(
    'Preview a batch before applying changes.',
  );
  async function run(apply: boolean) {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/collector-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          after,
          apply,
          ...(apply ? { confirmation: 'POPULATE_STAGING_HOLDERS' } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(
        `${apply ? 'Applied' : 'Preview'}: ${result.scanned} addresses; ${result.created} ${apply ? 'mappings created' : 'mappings to create'}, ${result.existing} already mapped, ${result.conflicts} conflicts. ${result.complete ? 'Pass complete. You can restart from the beginning to reconcile.' : 'More addresses remain.'}`,
      );
      if (apply) {
        setAfter(result.complete ? '' : result.next);
        setConfirmed(false);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Request failed. Retry this batch.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Populate staging holder profiles</h2>
      <p>
        Each batch checks up to 50 current blockchain holders. Existing private
        profiles stay private. No wallet credentials or personal historical
        claims are created.
      </p>
      <label>
        Resume after address (blank starts from the beginning)
        <input
          value={after}
          disabled={busy}
          onChange={(e) => setAfter(e.target.value.trim().toLowerCase())}
          placeholder="0x…"
        />
      </label>
      <p>
        Keep the returned cursor to resume later. Repeating a batch is safe.
      </p>
      <button className="button" disabled={busy} onClick={() => run(false)}>
        Preview batch
      </button>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />{' '}
        I confirm this batch may create public blockchain-only profiles in
        staging.
      </label>
      <button
        className="button"
        disabled={busy || !confirmed}
        onClick={() => run(true)}
      >
        Apply batch
      </button>
      <p role="status">{busy ? 'Checking current holders…' : message}</p>
      <a href="/collectors/directory">Check public directory →</a>
    </section>
  );
}
