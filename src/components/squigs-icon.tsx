import Image from 'next/image';

// Decorative artwork accompanies a visible label; achievement state remains
// the responsibility of AchievementBadge and the existing progression data.
export function SquigsIcon({
  name,
  size = 24,
}: {
  name: 'new-discovery' | 'recorded-victory' | 'provenance' | 'currently-owned';
  size?: number;
}) {
  return (
    <Image
      className="squigs-icon"
      src={`/icons/status/${name}.png`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      unoptimized
    />
  );
}
