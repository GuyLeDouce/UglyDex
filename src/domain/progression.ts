// Rules are immutable within a version. Changing any value requires a new version.
export const RULESET = 'uglydex-progression-v1';
export type Subject = 'COLLECTOR' | 'SQUIG';
export type Fact = {
  key: string;
  activityId?: string;
  at: string;
  type: string;
  tokenId?: number;
  category: string;
  metadata: Record<string, unknown>;
};
export type Gates = {
  identity: boolean;
  provenance: boolean;
  sources: Record<string, string>;
};
export type Gate =
  'NONE' | 'IDENTITY' | 'PROVENANCE' | `READY:${string}` | `COMPLETE:${string}`;
export type Metric =
  | 'discoveries'
  | 'og'
  | 'legendary'
  | 'duels'
  | 'wins'
  | 'survival'
  | 'podiums'
  | 'survivalWins'
  | 'creator'
  | 'milestones'
  | 'bounty'
  | 'bountyWins'
  | 'bountyEntries'
  | 'maw'
  | 'regurgitated'
  | 'swallowed'
  | 'digested'
  | 'marketplace'
  | 'madlibs'
  | 'systems'
  | 'mint'
  | 'collectors'
  | 'gauntlet';
export function qualifies(f: Fact, m: Metric): boolean {
  const t = f.type,
    d = f.metadata;
  switch (m) {
    case 'discoveries':
      return t === 'DISCOVERY';
    case 'og':
      return (t === 'DISCOVERY' || t === 'MINT') && d.og === true;
    case 'legendary':
      return (t === 'DISCOVERY' || t === 'MINT') && d.legendary === true;
    case 'duels':
      return t === 'DUEL_COMPLETED';
    case 'wins':
      return t === 'DUEL_COMPLETED' && d.outcome === 'WIN';
    case 'survival':
      return t === 'SURVIVAL_PLAYED' && Number(d.placement) >= 1;
    case 'podiums':
      return t === 'SURVIVAL_PLAYED' && [1, 2, 3].includes(Number(d.placement));
    case 'survivalWins':
      return t === 'SURVIVAL_PLAYED' && d.placement === 1;
    case 'creator':
      return t === 'IMAGE_APPROVED';
    case 'milestones':
      return t === 'IMAGE_APPROVED' && d.milestone != null;
    case 'bounty':
      return t === 'BOUNTY_ACCEPTED';
    case 'bountyWins':
      return t === 'BOUNTY_WON';
    case 'bountyEntries':
      return t === 'BOUNTY_ENTRY';
    case 'maw':
      return ['MAW_FED', 'MAW_REGURGITATED', 'MAW_SWALLOWED'].includes(t);
    case 'regurgitated':
      return t === 'MAW_REGURGITATED';
    case 'swallowed':
      return t === 'MAW_SWALLOWED';
    case 'digested':
      return t === 'MAW_DIGESTED' && d.confirmation === 'source_verified_burn';
    case 'marketplace':
      return t === 'MARKETPLACE_PURCHASE' && d.confirmed === true;
    case 'madlibs':
      return t === 'MADLIB_PUBLISHED';
    case 'mint':
      return t === 'MINT';
    case 'collectors':
      return t === 'COLLECTOR_HOLD';
    case 'gauntlet':
      return t === 'GAUNTLET_COMPLETED';
    case 'systems':
      return [
        'discoveries',
        'duels',
        'survival',
        'creator',
        'bounty',
        'bountyWins',
        'maw',
        'marketplace',
        'madlibs',
        'gauntlet',
      ].some((m) => qualifies(f, m as Metric));
  }
}
export function gateSatisfied(gate: Gate, gates: Gates) {
  if (gate === 'NONE') return true;
  if (gate === 'IDENTITY') return gates.identity;
  if (gate === 'PROVENANCE') return gates.provenance;
  const [state, source] = gate.split(':');
  return state === 'COMPLETE'
    ? gates.sources[source] === 'COMPLETE'
    : ['READY', 'PARTIAL', 'COMPLETE'].includes(gates.sources[source]);
}
export function matching(facts: Fact[], metric: Metric) {
  const found = facts
    .filter((f) => qualifies(f, metric))
    .sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key));
  const seen = new Set<string>();
  return found.filter((f) => {
    const key =
      metric === 'systems'
        ? f.category
        : metric === 'milestones'
          ? String(f.metadata.milestone)
          : metric === 'collectors'
            ? String(f.metadata.collectorId)
            : metric === 'discoveries' ||
                metric === 'og' ||
                metric === 'legendary'
              ? String(f.tokenId)
              : f.key;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export const xpRules: {
  key: string;
  subject: Subject;
  metric: Metric;
  xp: number;
  cap?: number;
  gate: Gate;
}[] = [
  ...(
    [
      ['discoveries', 40],
      ['og', 20],
      ['legendary', 40],
      ['duels', 15],
      ['wins', 10],
      ['survival', 15],
      ['podiums', 10],
      ['survivalWins', 15],
      ['creator', 40],
      ['milestones', 15],
      ['bounty', 30],
      ['bountyWins', 30],
      ['maw', 20],
      ['madlibs', 20],
      ['gauntlet', 10],
    ] as [Metric, number][]
  ).map(([metric, xp]) => ({
    key: `collector-${metric}`,
    subject: 'COLLECTOR' as const,
    metric,
    xp,
    gate: 'IDENTITY' as const,
  })),
  {
    key: 'collector-marketplace',
    subject: 'COLLECTOR',
    metric: 'marketplace',
    xp: 20,
    cap: 1,
    gate: 'IDENTITY',
  },
  ...(
    [
      ['mint', 20],
      ['duels', 15],
      ['wins', 10],
      ['bountyEntries', 10],
      ['bountyWins', 30],
      ['maw', 10],
    ] as [Metric, number][]
  ).map(([metric, xp]) => ({
    key: `squig-${metric}`,
    subject: 'SQUIG' as const,
    metric,
    xp,
    gate: metric === 'mint' ? ('PROVENANCE' as const) : ('NONE' as const),
  })),
];
export type Achievement = {
  key: string;
  name: string;
  description: string;
  subject: Subject;
  category: string;
  metric: Metric;
  threshold: number;
  gate: Gate;
  tier: string;
  hidden: boolean;
  enabled: boolean;
  repeatable: false;
  title?: string;
};
export const achievements: Achievement[] = [];
function series(
  subject: Subject,
  metric: Metric,
  category: string,
  rows: [number, string][],
  gate: Gate = subject === 'COLLECTOR' ? 'IDENTITY' : 'NONE',
) {
  for (const [threshold, name] of rows)
    achievements.push({
      key: `${subject.toLowerCase()}-${metric}-${threshold}`,
      name,
      description: `Record at least ${threshold} ${metricLabel[metric]}.`,
      subject,
      category,
      metric,
      threshold,
      gate,
      tier:
        threshold >= 100
          ? 'Legendary'
          : threshold >= 25
            ? 'Epic'
            : threshold >= 10
              ? 'Rare'
              : threshold >= 5
                ? 'Uncommon'
                : 'Common',
      hidden: false,
      enabled: true,
      repeatable: false,
    });
}
export const metricLabel: Record<Metric, string> = {
  discoveries: 'unique confirmed Squig discoveries',
  og: 'OG discoveries',
  legendary: 'Legendary discoveries',
  duels: 'completed Duels',
  wins: 'Duel wins',
  survival: 'completed Survival games',
  podiums: 'Survival podium finishes',
  survivalWins: 'Survival wins',
  creator: 'approved image contributions',
  milestones: 'distinct illustrated milestones',
  bounty: 'accepted Bounty contributions',
  bountyWins: 'Bounty wins',
  bountyEntries: 'Bounty pool entries',
  maw: 'confirmed Maw feeds',
  regurgitated: 'regurgitations',
  swallowed: 'swallowed dispositions',
  digested: 'verified digestions',
  marketplace: 'confirmed Marketplace purchases',
  madlibs: 'public Mad Lib publications',
  systems: 'distinct ecosystem categories',
  mint: 'verified mint records',
  collectors:
    'distinct attributed collectors with completed holds of at least seven days',
  gauntlet: 'completed Gauntlet runs',
};
series('COLLECTOR', 'discoveries', 'Collecting', [
  [1, 'First Ugly'],
  [5, 'Getting Ugly'],
  [10, 'Certified Hoarder'],
  [20, 'Deep in the Dex'],
  [25, 'Field Researcher'],
  [50, 'Ugly Archivist'],
  [100, 'Creature Curator'],
  [250, 'Walking Encyclopedia'],
  [500, 'The Living Dex'],
]);
series('COLLECTOR', 'og', 'Collecting', [
  [1, 'Original Encounter'],
  [5, 'Old Guard'],
  [10, 'OG Obsession'],
]);
series('COLLECTOR', 'legendary', 'Collecting', [[1, 'An Unlikely Legend']]);
series('COLLECTOR', 'duels', 'Duels', [
  [1, 'Step into the Ring'],
  [10, 'Battle Regular'],
  [50, 'Ring Resident'],
]);
series('COLLECTOR', 'wins', 'Duels', [
  [1, 'First Victory'],
  [10, 'Duel Freak'],
  [25, 'Certified Menace'],
  [50, 'Arena Apparition'],
]);
series('COLLECTOR', 'survival', 'Survival', [
  [1, 'Into the Gauntlet'],
  [10, 'Still Here'],
  [50, 'Hard to Kill'],
]);
series('COLLECTOR', 'podiums', 'Survival', [[1, 'On the Podium']]);
series('COLLECTOR', 'survivalWins', 'Survival', [
  [1, 'Survivor'],
  [5, 'Last Ugly Standing'],
  [25, 'Survival Instinct'],
]);
series('COLLECTOR', 'creator', 'Creator', [
  [1, 'Make it Ugly'],
  [5, 'Ugly City Builder'],
  [10, 'Prolific Freak'],
]);
series('COLLECTOR', 'milestones', 'Creator', [
  [1, 'Milestone Maker'],
  [5, 'City Cartographer'],
]);
series('COLLECTOR', 'bounty', 'Bounty', [
  [1, 'Vault Contributor'],
  [5, 'Vault Regular'],
]);
series('COLLECTOR', 'bountyWins', 'Bounty', [[1, 'Bounty Claimed']]);
series('COLLECTOR', 'maw', 'Maw', [
  [1, 'Dinner is Served'],
  [5, 'Maw Regular'],
  [10, 'The Maw Remembers'],
]);
series('COLLECTOR', 'marketplace', 'Marketplace', [[1, 'Malformed Taste']]);
series('COLLECTOR', 'madlibs', 'Creator', [[1, 'Published Weirdness']]);
series('COLLECTOR', 'systems', 'Ecosystem', [
  [3, 'Ugly Around Town'],
  [5, 'Ugly Everywhere'],
  [7, 'Part of the Furniture'],
]);
series('SQUIG', 'mint', 'Provenance', [[1, 'Born Ugly']], 'PROVENANCE');
series('SQUIG', 'duels', 'Duels', [
  [1, 'Into the Ring'],
  [10, 'Battle Tested'],
  [25, 'Arena Veteran'],
  [50, 'Scar Tissue'],
  [100, 'Living Weapon'],
]);
series('SQUIG', 'wins', 'Duels', [
  [1, 'First Blood'],
  [5, 'Troublemaker'],
  [10, 'Dangerous Company'],
  [25, 'Certified Menace'],
  [50, 'Arena Legend'],
]);
series('SQUIG', 'bountyEntries', 'Bounty', [
  [1, 'Bounty Hunter'],
  [5, 'Vault Familiar'],
]);
series('SQUIG', 'bountyWins', 'Bounty', [[1, 'Prize Fighter']]);
series('SQUIG', 'maw', 'Maw', [[1, 'Fed to the Maw']]);
series('SQUIG', 'regurgitated', 'Maw', [[1, 'Regurgitated']]);
series('SQUIG', 'swallowed', 'Maw', [[1, 'Swallowed']]);
series('SQUIG', 'digested', 'Maw', [[1, 'Remembered Forever']]);
series('SQUIG', 'og', 'Origins', [[1, 'Original Ugly']], 'PROVENANCE');
series(
  'SQUIG',
  'legendary',
  'Origins',
  [[1, 'Legendary Specimen']],
  'PROVENANCE',
);
series(
  'SQUIG',
  'collectors',
  'Provenance',
  [
    [3, 'Well Travelled'],
    [5, 'Many Homes'],
  ],
  'PROVENANCE',
);
for (const a of achievements) {
  if (a.subject === 'SQUIG' && a.metric === 'og')
    a.description = 'Canonical OG metadata with verified mint provenance.';
  if (a.subject === 'SQUIG' && a.metric === 'legendary')
    a.description =
      'Canonical Legendary metadata with verified mint provenance.';
  if (
    ['First Ugly', 'Duel Freak', 'Survivor', 'Ugly City Builder'].includes(
      a.name,
    )
  )
    a.title = a.name === 'First Ugly' ? 'Certified Ugly' : a.name;
  if (a.name === 'Part of the Furniture') a.hidden = true;
}
export function threshold(subject: Subject, level: number) {
  return (
    BigInt(subject === 'COLLECTOR' ? 50 : 25) *
    BigInt(level) *
    BigInt(level - 1)
  );
}
export function levelInfo(subject: Subject, xp: bigint) {
  let lo = 1,
    hi = 2;
  while (threshold(subject, hi) <= xp) hi *= 2;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (threshold(subject, mid) <= xp) lo = mid;
    else hi = mid;
  }
  const base = threshold(subject, lo),
    next = threshold(subject, lo + 1);
  return {
    level: lo,
    xp: xp.toString(),
    nextXp: next.toString(),
    remaining: (next - xp).toString(),
    percent: Number(((xp - base) * 10000n) / (next - base)) / 100,
  };
}
export function evaluate(subject: Subject, facts: Fact[], gates: Gates) {
  const grants = xpRules
    .filter((r) => r.subject === subject && gateSatisfied(r.gate, gates))
    .flatMap((r) =>
      matching(facts, r.metric)
        .slice(0, r.cap)
        .map((f) => ({
          rule: r.key,
          key: `${r.key}:${f.key}`,
          xp: r.xp,
          fact: f,
        })),
    );
  const awards = achievements
    .filter((a) => a.subject === subject && a.enabled)
    .map((a) => {
      const evidence = matching(facts, a.metric),
        gate = gateSatisfied(a.gate, gates);
      return {
        definition: a,
        progress: evidence.length,
        gate,
        unlocked: gate && evidence.length >= a.threshold,
        at: evidence[a.threshold - 1]?.at ?? null,
        evidence: evidence.map((f) => f.key),
      };
    });
  const milestones: { level: number; at: string }[] = [];
  let total = 0n,
    level = 1;
  for (const grant of [...grants].sort(
    (a, b) => a.fact.at.localeCompare(b.fact.at) || a.key.localeCompare(b.key),
  )) {
    total += BigInt(grant.xp);
    while (threshold(subject, level + 1) <= total)
      milestones.push({ level: ++level, at: grant.fact.at });
  }
  return { grants, awards, milestones, total, ...levelInfo(subject, total) };
}
