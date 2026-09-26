import { z } from 'zod';
import { resolveAsset } from './assets';
import { explorerTransaction } from './provenance';
export function formatAmount(value: string) {
  const [whole, fraction = ''] = value.split('.');
  const tail = fraction.replace(/0+$/, '');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (tail ? `.${tail}` : '');
}
export const categories = [
  'ALL',
  'SQUIGS',
  'DUELS',
  'SURVIVAL',
  'BOUNTY',
  'MAW',
  'MARKETPLACE',
  'CREATOR',
  'MADLIBS',
  'CHARM',
] as const;
export const activityFilters = z.object({
  category: z.enum(categories).catch('ALL'),
  after: z.string().max(150).optional(),
  order: z.enum(['newest', 'oldest']).catch('newest'),
});
export const activityLabels: Record<string, string> = {
  MAW_PRIZE_DELIVERED: 'A Squig from the Maw',
  DUEL_COMPLETED: 'Duel complete',
  DUEL_CANCELLED: 'Duel cancelled',
  DUEL_ENTERED: 'Entered the arena',
  SURVIVAL_PLAYED: 'Survival field record',
  GAUNTLET_COMPLETED: 'The Gauntlet',
  GAUNTLET_REWARD: 'Gauntlet payout',
  BOUNTY_SUBMITTED: 'A gift for the vault',
  BOUNTY_ACCEPTED: 'Into the vault',
  BOUNTY_REJECTED: 'Bounty declined',
  BOUNTY_ENTRY: 'Entered the Bounty pool',
  BOUNTY_WON: 'Bounty winner',
  MAW_FED: 'Fed the Maw',
  MAW_REGURGITATED: 'Regurgitated',
  MAW_SWALLOWED: 'Swallowed',
  MAW_DIGESTED: 'Digested',
  MARKETPLACE_PURCHASE: 'Malformed purchase',
  MARKETPLACE_REFUND: 'Marketplace refund',
  IMAGE_APPROVED: 'Ugly contribution',
  IMAGE_SUBMISSION: 'Image submission',
  SURVIVAL_IMAGE_USED: 'Illustrating Survival',
  MADLIB_PUBLISHED: 'A story shared',
  MADLIB_PAYMENT: 'Mad Lib payment',
};
export type ActivityInput = {
  id: string;
  eventType: string;
  eventAt: Date;
  category: string;
  importance: string;
  metadata: unknown;
  amount: { toString(): string } | null;
  currency: string | null;
  direction: string | null;
  squig: { tokenId: number } | null;
};
export function activityDTO(row: ActivityInput) {
  const m = (
    row.metadata &&
    typeof row.metadata === 'object' &&
    !Array.isArray(row.metadata)
      ? row.metadata
      : {}
  ) as Record<string, unknown>;
  const details: { label: string; value: string }[] = [];
  const safe = (key: string, label: string) => {
    const v = m[key];
    if (typeof v === 'number' || typeof v === 'string')
      details.push({ label, value: String(v).slice(0, 180) });
  };
  // Explicit allowlist: no IDs, addresses, raw metadata, evidence or moderation notes escape.
  for (const [k, label] of [
    ['outcome', 'Outcome'],
    ['rounds', 'Rounds'],
    ['placement', 'Placement'],
    ['eliminations', 'Eliminations'],
    ['deaths', 'Deaths'],
    ['imagesUsed', 'Images used'],
    ['item', 'Item'],
    ['quantity', 'Quantity'],
    ['milestone', 'Milestone'],
    ['rewardPoints', 'Recorded reward points'],
    ['rarityTier', 'Rarity'],
    ['tickets', 'Tickets'],
    ['deliveryStatus', 'Delivery'],
    ['prizeProject', 'Prize collection'],
    ['prizeToken', 'Prize token'],
    ['opponentToken', 'Opponent Squig'],
  ] as const)
    safe(k, label);
  if (row.amount && row.currency)
    details.push({
      label: `Tracked ${row.direction?.toLowerCase() ?? 'amount'}`,
      value: `${row.amount.toString()} ${row.currency === 'CHARM' ? '$CHARM' : row.currency}`,
    });
  const tx =
    typeof m.transactionHash === 'string' &&
    /^0x[a-f0-9]{64}$/i.test(m.transactionHash)
      ? explorerTransaction(1, m.transactionHash)
      : null;
  return {
    id: row.id,
    eventType: row.eventType,
    eventAt: row.eventAt.toISOString(),
    tokenId: row.squig?.tokenId ?? null,
    category: row.category,
    importance: row.importance,
    description:
      row.eventType === 'DUEL_COMPLETED' && m.outcome === 'WIN'
        ? 'Won a Squig Duel.'
        : undefined,
    details,
    transaction: tx,
    image:
      row.eventType === 'IMAGE_APPROVED' && typeof m.imageUrl === 'string'
        ? resolveAsset(m.imageUrl)
        : null,
  };
}
