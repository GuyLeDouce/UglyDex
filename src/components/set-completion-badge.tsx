import Image from 'next/image';

// Reuse the saved Squig collection artwork from the supplied card reference.
export function SetCompletionBadge({ name }: { name: string }) {
  return (
    <Image
      className="set-completion-badge"
      src="/achievements/collector/deep-in-the-dex.png"
      width={190}
      height={190}
      alt={`${name} · Squig collection badge`}
      style={{ objectFit: 'contain' }}
    />
  );
}
