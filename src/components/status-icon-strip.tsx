'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useId, useState } from 'react';
import type { StatusIconData } from '@/domain/status-icons';
export function StatusIconStrip({
  icons,
  limit = 4,
}: {
  icons: StatusIconData[];
  limit?: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  if (!icons.length) return null;
  return (
    <div
      className="set-mini-strip status-mini-strip"
      aria-label="Squig status and history"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setActive(null);
      }}
    >
      <div className="set-mini-icons">
        {(expanded ? icons : icons.slice(0, limit)).map((icon) => (
          <span
            key={icon.key}
            onMouseEnter={() => setActive(icon.key)}
            onMouseLeave={() => setActive(null)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setActive(null);
            }}
          >
            <button
              className="set-mini-button"
              type="button"
              aria-label={icon.name}
              aria-expanded={active === icon.key}
              aria-controls={`${id}-${icon.key}`}
              onFocus={() => setActive(icon.key)}
              onClick={() => setActive(icon.key)}
            >
              <Image
                src={`/icons/status/${icon.key}.png`}
                alt=""
                width={20}
                height={20}
                unoptimized
              />
            </button>
            {active === icon.key && (
              <span className="set-mini-tip" id={`${id}-${icon.key}`}>
                <strong>{icon.name}</strong>
                <span>{icon.description}</span>
                {icon.href && <Link href={icon.href}>View details →</Link>}
                <button
                  type="button"
                  className="set-mini-close"
                  aria-label="Close status details"
                  onClick={() => setActive(null)}
                >
                  ×
                </button>
              </span>
            )}
          </span>
        ))}
        {icons.length > limit && (
          <button
            type="button"
            className="set-mini-more"
            aria-expanded={expanded}
            aria-label={
              expanded
                ? 'Show fewer status icons'
                : `Show ${icons.length - limit} more status icons`
            }
            onClick={() => {
              setExpanded(!expanded);
              setActive(null);
            }}
          >
            {expanded ? '−' : `+${icons.length - limit}`}
          </button>
        )}
      </div>
    </div>
  );
}
