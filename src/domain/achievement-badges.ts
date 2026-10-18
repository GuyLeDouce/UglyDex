import type { Subject } from './progression';

// Only viewer-safe, server-projected data crosses into client components.
export type VisibleAchievementBadge = {
  key: string;
  name: string;
  subject: Subject;
  url: string;
  status: 'earned' | 'locked' | 'pending';
};
export type AchievementBadgePresentation =
  VisibleAchievementBadge | { status: 'hidden' };

export type AchievementBadgeSummary = {
  status: 'ready' | 'pending';
  badges: VisibleAchievementBadge[];
};
