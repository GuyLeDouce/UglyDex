// Completed sets are distinct from XP achievements and use their own emblem.
export function SetCompletionBadge({ name }: { name: string }) {
  return (
    <svg
      className="set-completion-badge"
      viewBox="0 0 200 200"
      role="img"
      aria-label={`${name} · Set complete`}
    >
      <circle cx="100" cy="100" r="94" fill="#111318" />
      <circle
        cx="100"
        cy="98"
        r="89"
        fill="#ffd84d"
        stroke="#111318"
        strokeWidth="3"
      />
      <circle
        cx="100"
        cy="98"
        r="78"
        fill="#5be87f"
        stroke="#111318"
        strokeWidth="3"
      />
      <path
        d="M40 70 49 52 58 70 49 65ZM142 70 151 52 160 70 151 65Z"
        fill="#ffd84d"
        stroke="#111318"
        strokeWidth="2"
      />
      <text
        x="100"
        y="53"
        textAnchor="middle"
        fill="#111318"
        fontSize="17"
        fontWeight="900"
        letterSpacing="3"
      >
        SET
      </text>
      <g stroke="#111318" strokeWidth="4" strokeLinejoin="round">
        <rect
          x="49"
          y="73"
          width="53"
          height="65"
          rx="8"
          fill="#efe9ff"
          transform="rotate(-14 75 105)"
        />
        <rect
          x="98"
          y="73"
          width="53"
          height="65"
          rx="8"
          fill="#ffd9e8"
          transform="rotate(14 125 105)"
        />
        <rect x="73" y="67" width="54" height="73" rx="8" fill="#f7f7f3" />
        <circle cx="100" cy="102" r="20" fill="#ffd84d" />
        <path
          d="m89 102 8 8 15-18"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </g>
      <text
        x="100"
        y="164"
        textAnchor="middle"
        fill="#111318"
        fontSize="16"
        fontWeight="900"
        letterSpacing="1"
      >
        COMPLETE
      </text>
    </svg>
  );
}
