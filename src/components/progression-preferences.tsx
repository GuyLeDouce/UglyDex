'use client';
import { useActionState, useState } from 'react';
import { savePresentation } from '@/app/me/achievements/save';
export function ProgressionPreferences({
  choices,
  title,
  featured,
}: {
  choices: { key: string; name: string; title: string | null }[];
  title: string;
  featured: string[];
}) {
  const [state, action, pending] = useActionState(savePresentation, {
    message: '',
  });
  const [selected, setSelected] = useState(featured);
  return (
    <form action={action} className="panel">
      <h2>Your signature</h2>
      <p>Choose up to four earned badges and one title.</p>
      <label htmlFor="progression-title">Profile title</label>
      <select id="progression-title" name="title" defaultValue={title}>
        <option value="">No title</option>
        {choices
          .filter((c) => c.title)
          .map((c) => (
            <option key={c.key} value={c.key}>
              {c.title}
            </option>
          ))}
      </select>
      <div className="badge-options">
        {choices.map((c) => (
          <label key={c.key}>
            <input
              type="checkbox"
              name="badges"
              value={c.key}
              checked={selected.includes(c.key)}
              disabled={
                pending || (!selected.includes(c.key) && selected.length >= 4)
              }
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, c.key]
                    : selected.filter((k) => k !== c.key),
                )
              }
            />
            {c.name}
          </label>
        ))}
      </div>
      <button className="button" disabled={pending} type="submit">
        {pending ? 'Saving…' : 'Save title and badges'}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
