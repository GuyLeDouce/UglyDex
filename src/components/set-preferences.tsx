'use client';
import { useActionState } from 'react';
import { saveSets } from '@/app/collection/sets/save';
export function SetPreferences({
  cards,
}: {
  cards: { key: string; name: string; featured: boolean }[];
}) {
  const [state, action, pending] = useActionState(saveSets, { message: '' });
  return (
    <form action={action} className="panel">
      <h2>Your trophy case.</h2>
      <p>
        Feature up to three completed sets. A current set leaves your showcase
        if its holdings are lost.
      </p>
      <div className="set-choices">
        {cards.map((c) => (
          <label key={c.key}>
            <input
              type="checkbox"
              name="sets"
              value={c.key}
              defaultChecked={c.featured}
            />
            {c.name}
          </label>
        ))}
      </div>
      <button className="button primary" disabled={pending}>
        {pending ? 'Saving…' : 'Save featured sets'}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
