'use client';
import { useState } from 'react';
export function ReviewForm({
  caseId,
  attributionIds,
}: {
  caseId: string;
  attributionIds: string[];
}) {
  const [message, setMessage] = useState('');
  return (
    <form
      className="review-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        setMessage('Recording decision…');
        try {
          const r = await fetch('/api/admin/reconciliation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              caseId,
              ...Object.fromEntries(
                Object.entries(data).filter(([, v]) => v !== ''),
              ),
            }),
          });
          setMessage(
            r.ok
              ? 'Decision recorded. History rebuild queued.'
              : 'Unable to record. Check the evidence and interval.',
          );
        } catch {
          setMessage('Service unavailable.');
        }
      }}
    >
      <label>
        Attribution
        <select name="attributionId" required>
          {attributionIds.map((id) => (
            <option key={id}>{id}</option>
          ))}
        </select>
      </label>
      <label>
        Decision
        <select name="action">
          <option value="UNRESOLVED">Leave unresolved</option>
          <option value="CONFIRM">Confirm this interval</option>
          <option value="REJECT">Reject attribution</option>
          <option value="SPLIT">Split at end date</option>
        </select>
      </label>
      <label>
        Effective from (UTC ISO timestamp)
        <input name="effectiveFrom" placeholder="2026-06-19T14:02:00Z" />
      </label>
      <label>
        Effective to / split boundary (UTC ISO timestamp)
        <input name="effectiveTo" placeholder="2026-07-04T18:11:00Z" />
      </label>
      <label>
        Second collector UUID (split only)
        <input name="secondCollectorId" />
      </label>
      <label>
        Evidence and reason
        <textarea name="reason" minLength={10} maxLength={2000} required />
      </label>
      <button disabled={!attributionIds.length}>Record audited decision</button>
      <p role="status">{message}</p>
    </form>
  );
}
export function RebuildButton({ tokenId }: { tokenId: number }) {
  const [message, setMessage] = useState('');
  return (
    <>
      <button
        onClick={async () => {
          setMessage('Queuing…');
          try {
            const r = await fetch('/api/admin/provenance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tokenId }),
            });
            setMessage(
              r.ok
                ? 'Rebuild queued. The worker will preserve the raw ledger.'
                : 'Unable to queue rebuild.',
            );
          } catch {
            setMessage('Service unavailable.');
          }
        }}
      >
        Queue safe re-derive
      </button>
      <p role="status">{message}</p>
    </>
  );
}
