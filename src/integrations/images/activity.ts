import { factory } from '../activity';
import type { ExternalRow } from '../table';
import { hash } from '@/domain/events';
export function imageEvents(feed: string, row: ExternalRow) {
  const add = factory('images', feed, row, 'CREATOR'),
    live = feed === 'liveImages',
    approved = live || row.status === 'approved';
  return [
    add(
      'contribution',
      approved ? 'IMAGE_APPROVED' : 'IMAGE_SUBMISSION',
      approved
        ? (row.reviewed_at ?? row.created_at ?? row.submitted_at)
        : row.submitted_at,
      live ? row.user_id : row.discord_user_id,
      {
        status: live ? 'approved' : row.status,
        imageKey:
          typeof row.image_url === 'string' ? hash(row.image_url) : null,
        timeBasis: live
          ? 'live_image_created_at'
          : approved && row.reviewed_at
            ? 'reviewed_at'
            : 'submitted_at',
        imageUrl: approved ? (row.image_url ?? null) : null,
        rewardPoints: row.reward_points ?? null,
        milestone: row.milestone_label ?? row.milestone_key ?? null,
        milestoneNumber: row.milestone_number ?? null,
        liveImageId:
          row.live_image_id == null ? null : String(row.live_image_id),
      },
      { visibility: approved ? 'PUBLIC' : 'PRIVATE' },
    ),
  ];
}
