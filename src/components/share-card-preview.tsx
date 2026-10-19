import type { ShareCard } from '@/domain/sharing';
import { AchievementBadge } from './achievement-badge';
import { Artwork } from './artwork';
import { squigArtwork } from '@/domain/assets';

// Accessible HTML for the existing sharing DTO. The thread never generates a PNG
// per card view; opening a card retains the existing image download renderer.
export function ShareCardPreview({ card }: { card: ShareCard }) {
  return (
    <div
      className={`share-card-preview share-card-preview--${card.appearance?.share ?? 'clean'}`}
    >
      <p className="eyebrow">{card.eyebrow}</p>
      <div className="share-preview-badges">
        {card.achievementBadges?.map((badge) => (
          <AchievementBadge key={badge.key} badge={badge} size="xl" />
        ))}
      </div>
      <h3>{card.title}</h3>
      <p>{card.description}</p>
      <div className="tags">
        {card.stats.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      {card.tokens.length > 0 && (
        <div className="share-preview-art">
          {card.tokens.slice(0, 4).map((id) => (
            <Artwork key={id} src={squigArtwork(id)} alt={`Squig #${id}`} />
          ))}
        </div>
      )}
      <small>UGLYDEX · SQUIGS RELOADED</small>
    </div>
  );
}
