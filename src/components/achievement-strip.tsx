import type { AchievementBadgeSummary } from '@/domain/achievement-badges';
import type { Subject } from '@/domain/progression';
import { AchievementBadge } from './achievement-badge';

export function AchievementStrip({
  summary,
  subject,
}: {
  summary: AchievementBadgeSummary;
  subject: Subject;
}) {
  const earned = summary.badges.filter(
    (b) => b.subject === subject && b.status === 'earned',
  );
  if (summary.status === 'pending')
    return (
      <p className="achievement-empty">Achievements awaiting evaluation.</p>
    );
  if (!earned.length)
    return <p className="achievement-empty">No earned achievements yet.</p>;
  return (
    <span
      className="achievement-strip"
      aria-label={`${earned.length} earned ${subject === 'SQUIG' ? 'Squig' : 'Collector'} achievements`}
    >
      {earned.slice(0, 3).map((badge) => (
        <AchievementBadge key={badge.key} badge={badge} size="small" />
      ))}
      {earned.length > 3 && (
        <span
          className="achievement-overflow"
          aria-label={`${earned.length - 3} more earned achievements`}
        >
          +{earned.length - 3}
        </span>
      )}
    </span>
  );
}
