import type { ShareCard } from '@/domain/sharing';
import { AchievementBadge } from './achievement-badge';
import { Artwork } from './artwork';
import { SetCompletionBadge } from './set-completion-badge';

// Accessible HTML for the existing sharing DTO. The thread never generates a PNG
// per card view; opening a card retains the existing image download renderer.
export function ShareCardPreview({
  card,
  avatar,
  name,
  kind,
}: {
  card: ShareCard;
  avatar: string | null;
  name: string;
  kind: 'achievement' | 'set';
}) {
  const rarity = card.stats
    .find((stat) =>
      /^(Common|Uncommon|Rare|Epic|Legendary) achievement$/.test(stat),
    )
    ?.split(' ')[0]
    .toLowerCase();
  return (
    <div
      className={`share-card-preview share-card-preview--${card.appearance?.share ?? 'clean'}`}
    >
      <p className="eyebrow">{card.eyebrow}</p>
      <div className="share-preview-identity">
        <Artwork src={avatar} alt={`${name}'s profile picture`} avatar />
        <div className="share-preview-badges">
          {kind === 'set' && <SetCompletionBadge name={card.title} />}
          {card.achievementBadges?.map((badge) => (
            <AchievementBadge
              key={badge.key}
              badge={badge}
              size="showcase"
              showTooltip={false}
            />
          ))}
        </div>
      </div>
      <h3>{card.title}</h3>
      <p>{card.description}</p>
      <div className="tags">
        {card.stats.map((s) => (
          <span
            key={s}
            className={
              s.endsWith(' achievement') && rarity
                ? `thread-rarity thread-rarity--${rarity}`
                : undefined
            }
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
