'use client';
import { useId, useState } from 'react';
import Link from 'next/link';
import type { SetIconData } from '@/domain/set-icons';

export function SetIconStrip({
  sets,
  limit = 4,
  advances = false,
}: {
  sets: SetIconData[];
  limit?: number;
  advances?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const id = useId();
  if (!sets.length) return null;
  const visible = expanded ? sets : sets.slice(0, limit);
  return (
    <div
      className="set-mini-strip"
      aria-label="Matching collector sets"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setActive(null);
      }}
    >
      <div className="set-mini-icons" id={id}>
        {visible.map((set) => (
          <span
            className="set-mini-item"
            key={set.key}
            onMouseEnter={() => setActive(set.key)}
            onMouseLeave={() => setActive(null)}
          >
            <button
              type="button"
              className="set-mini-button"
              aria-label={`${set.name}: matching set`}
              aria-expanded={active === set.key}
              aria-controls={`${id}-${set.key}`}
              onFocus={() => setActive(set.key)}
              onBlur={(e) => {
                if (!e.currentTarget.parentElement?.contains(e.relatedTarget))
                  setActive(null);
              }}
              onClick={() => setActive(set.key)}
            >
              <span aria-hidden="true">{set.icon}</span>
            </button>
            {active === set.key && (
              <span
                className="set-mini-tip"
                id={`${id}-${set.key}`}
                onBlur={(e) => {
                  if (!e.currentTarget.parentElement?.contains(e.relatedTarget))
                    setActive(null);
                }}
              >
                <strong>{set.name}</strong>
                <span>
                  {advances
                    ? 'This Squig advances your progress in this set.'
                    : 'This Squig can contribute to this set.'}
                </span>
                <span>{set.description}</span>
                <Link href={`/sets/${set.key}`}>View set →</Link>
                <button
                  type="button"
                  className="set-mini-close"
                  aria-label="Close set details"
                  onClick={() => setActive(null)}
                >
                  ×
                </button>
              </span>
            )}
          </span>
        ))}
        {sets.length > limit && (
          <button
            type="button"
            className="set-mini-more"
            aria-expanded={expanded}
            aria-controls={id}
            aria-label={
              expanded
                ? 'Show fewer set icons'
                : `Show ${sets.length - limit} more matching sets`
            }
            onClick={() => {
              setExpanded(!expanded);
              setActive(null);
            }}
          >
            {expanded ? '−' : `+${sets.length - limit}`}
          </button>
        )}
      </div>
    </div>
  );
}
