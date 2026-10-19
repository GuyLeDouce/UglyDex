'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AchievementBadgePresentation } from '@/domain/achievement-badges';

const sizes = {
  xs: 24,
  small: 32,
  medium: 48,
  large: 64,
  xl: 96,
  showcase: 128,
} as const;
export function AchievementBadge({
  badge,
  size = 'medium',
  showTooltip = true,
}: {
  badge: AchievementBadgePresentation;
  size?: keyof typeof sizes;
  showTooltip?: boolean;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    above: boolean;
  } | null>(null);
  const open = () => {
    if (!showTooltip || !anchor.current) return;
    const rect = anchor.current.getBoundingClientRect();
    setPosition({
      left: Math.max(
        108,
        Math.min(window.innerWidth - 108, rect.left + rect.width / 2),
      ),
      top: rect.top >= 90 ? rect.top - 8 : rect.bottom + 8,
      above: rect.top >= 90,
    });
  };
  const visible = !!position;
  useEffect(() => {
    if (!visible) return;
    const close = () => setPosition(null);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', escape);
    };
  }, [visible]);
  const pixels = sizes[size];
  const label =
    badge.status === 'hidden'
      ? 'Hidden achievement · Locked'
      : `${badge.name} · ${badge.status === 'earned' ? 'Earned' : badge.status === 'pending' ? 'Awaiting qualifying evidence' : 'Locked'}`;
  return (
    <span
      ref={anchor}
      className={`achievement-badge achievement-badge--${badge.status}`}
      style={{ width: pixels, height: pixels }}
      tabIndex={showTooltip ? 0 : undefined}
      role="img"
      aria-label={label}
      onMouseEnter={open}
      onMouseLeave={() => setPosition(null)}
      onFocus={open}
      onBlur={() => setPosition(null)}
    >
      {badge.status === 'hidden' ? (
        <span className="achievement-mystery" aria-hidden="true">
          ?
        </span>
      ) : (
        <Image
          src={badge.url}
          width={pixels}
          height={pixels}
          sizes={`${pixels}px`}
          alt=""
          loading="lazy"
          unoptimized={badge.url.startsWith('/api/')}
        />
      )}
      {showTooltip &&
        position &&
        createPortal(
          <span
            className="achievement-tooltip"
            role="tooltip"
            style={{
              left: position.left,
              top: position.top,
              transform: `translate(-50%, ${position.above ? '-100%' : '0'})`,
            }}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
