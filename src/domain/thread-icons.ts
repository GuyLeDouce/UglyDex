import { setIcons } from './set-icons';
import { achievements } from './progression';

// Reuse the approved mini artwork; achievements without specific artwork use
// the general milestone icon rather than inventing another badge.
export function threadIcon(
  kind:
    | 'set'
    | 'achievement'
    | 'transfer'
    | 'milestone'
    | 'welcome'
    | 'survival'
    | 'marketplace'
    | 'gauntlet',
  key: string,
) {
  if (kind === 'survival') return '/icons/status/recorded-victory.png';
  if (kind === 'marketplace') return '/icons/status/provenance.png';
  if (kind === 'gauntlet') return '/icons/status/duel-history.png';
  if (kind === 'welcome') return '/icons/status/new-discovery.png';
  if (kind === 'set') return setIcons[key] ?? '/icons/status/completes-set.png';
  if (kind === 'milestone') return '/icons/status/advances-set.png';
  if (kind === 'transfer') return '/icons/status/provenance.png';
  const metric = achievements.find((a) => a.key === key)?.metric;
  const icons: Record<string, string> = {
    discoveries: 'new-discovery',
    og: 'new-discovery',
    legendary: 'new-discovery',
    duels: 'duel-history',
    wins: 'recorded-victory',
    survivalWins: 'recorded-victory',
    podiums: 'recorded-victory',
    bountyWins: 'recorded-victory',
    bounty: 'bounty-history',
    bountyEntries: 'bounty-history',
    maw: 'maw-history',
    regurgitated: 'maw-history',
    swallowed: 'maw-history',
    digested: 'digested',
    creator: 'custom-artwork',
    milestones: 'custom-artwork',
    mint: 'provenance',
    marketplace: 'provenance',
    collectors: 'provenance',
  };
  return `/icons/status/${(metric && icons[metric]) || 'advances-set'}.png`;
}
