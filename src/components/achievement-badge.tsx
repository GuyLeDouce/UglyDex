import Image from 'next/image';
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
  showTooltip = false,
}: {
  badge: AchievementBadgePresentation;
  size?: keyof typeof sizes;
  showTooltip?: boolean;
}) {
  const pixels = sizes[size];
  const label =
    badge.status === 'hidden'
      ? 'Hidden achievement · Locked'
      : `${badge.name} · ${badge.status === 'earned' ? 'Earned' : badge.status === 'pending' ? 'Awaiting qualifying evidence' : 'Locked'}`;
  return (
    <span
      className={`achievement-badge achievement-badge--${badge.status}`}
      style={{ width: pixels, height: pixels }}
      tabIndex={showTooltip ? 0 : undefined}
      role="img"
      aria-label={label}
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
      {showTooltip && (
        <span className="achievement-tooltip" aria-hidden="true">
          {label}
        </span>
      )}
    </span>
  );
}
