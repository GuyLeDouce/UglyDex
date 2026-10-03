import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeRow } from '@/sync/normalize';
import { fixtures } from './fixtures/activity';
import { activityLabels } from '@/domain/activity';
import { effectivePage, pageInput } from '@/integrations/bridge-protocol';
import { sourceSchemaFingerprint } from '@/integrations/source-schema';
import { tables, sourceTimestamp } from '@/integrations/registry';

describe('real staging pilot regressions', () => {
  afterEach(() => vi.unstubAllEnvs());
  it.each(['WIN', 'LOSS'] as const)(
    'excludes the configured bot while preserving a human %s',
    (outcome) => {
      vi.stubEnv('UGLYBOT_BOT_DISCORD_ID', String(fixtures.duels.opponent_id));
      const events = normalizeRow('duels', {
        ...fixtures.duels,
        challenger_squig_token_id: null,
        winner_id:
          outcome === 'WIN'
            ? fixtures.duels.challenger_id
            : fixtures.duels.opponent_id,
      });
      expect(events).toHaveLength(1);
      expect(events[0].discordId).toBe(fixtures.duels.challenger_id);
      expect(events[0].metadata.outcome).toBe(outcome);
      expect(events[0].squigTokenId).toBeUndefined();
      expect(events[0].direction).toBe('WAGER');
    },
  );
  it('retains the persisted raffle purchase type', () => {
    expect(
      normalizeRow('purchases', {
        ...fixtures.purchases,
        purchase_type: 'raffle',
      })[0].metadata.purchaseType,
    ).toBe('raffle');
    expect(activityLabels.MARKETPLACE_PURCHASE).toBe('Marketplace purchase');
  });
  it('retains recorded claim NFT count without fabricating money', () => {
    const event = normalizeRow('claimEvents', {
      ...fixtures.claimEvents,
      nft_count: 3,
    })[0];
    expect(event.metadata.nftCount).toBe(3);
    expect(event.amount).toBeUndefined();
  });
  it.each([
    ['runs', 'finished_at'],
    ['imageUses', 'used_at'],
  ] as const)('uses the real %s date column', (feed, column) => {
    expect(
      effectivePage(feed, pageInput.parse({ since: '1970-01-01T00:00:00Z' }))
        .since?.column,
    ).toBe(column);
  });
  it('accepts the required Maw prize update timestamp as a composite cursor', () => {
    expect(
      effectivePage(
        'mawPrizes',
        pageInput.parse({ order: 'updated', since: '1970-01-01T00:00:00Z' }),
      ).spec.keys,
    ).toEqual(['updated_at', 'id']);
  });
  it('does not invent a Survival player timestamp column', () => {
    expect(sourceTimestamp(tables.survival)).toBeUndefined();
    expect(
      effectivePage(
        'survival',
        pageInput.parse({ since: '1970-01-01T00:00:00Z' }),
      ).since,
    ).toBeUndefined();
  });
  it('fingerprints the same visible schema independently of catalog ordering and unrelated columns', () => {
    const names = [...tables.duels.required, ...tables.duels.optional];
    expect(sourceSchemaFingerprint(tables.duels, names)).toBe(
      sourceSchemaFingerprint(
        tables.duels,
        [...names].reverse().concat('moderator_notes'),
      ),
    );
    expect(
      sourceSchemaFingerprint(
        tables.duels,
        names.filter((n) => n !== 'winner_id'),
      ),
    ).not.toBe(sourceSchemaFingerprint(tables.duels, names));
  });
});
