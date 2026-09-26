import { describe, it, expect } from 'vitest';
import { feeds, normalizeRow } from '@/sync/normalize';
import { fixtures, discord, other, at } from './fixtures/activity';
import { eventKey, hash } from '@/domain/events';
import { activityDTO, activityFilters, formatAmount } from '@/domain/activity';
import { SQUIGS_CONTRACT } from '@/domain/validation';
describe.each(feeds)('%s source mapping', (feed) => {
  it('has deterministic source slots and payloads', () => {
    const a = normalizeRow(feed, fixtures[feed]),
      b = normalizeRow(feed, { ...fixtures[feed] });
    expect(a.length).toBeGreaterThan(0);
    expect(a.map(eventKey)).toEqual(b.map(eventKey));
    expect(hash(a)).toBe(hash(b));
  });
  it('retains origin and explicit evidence only', () => {
    for (const e of normalizeRow(feed, fixtures[feed])) {
      expect(e.sourceType).toBe(feed);
      expect(e.eventAt).toBeInstanceOf(Date);
      expect(e.metadata).not.toHaveProperty('admin_note');
    }
  });
  it('never leaks raw identity through the public DTO', () => {
    const e = normalizeRow(feed, fixtures[feed])[0],
      dto = activityDTO({
        ...e,
        id: 'internal-uuid',
        amount: null,
        currency: null,
        direction: null,
        squig: null,
        metadata: {
          ...e.metadata,
          discordId: discord,
          wallet: 'hidden-wallet',
          admin_note: 'SECRET',
          sourceId: 'SECRET',
        },
      });
    const encoded = JSON.stringify(dto);
    expect(encoded).not.toContain(discord);
    expect(encoded).not.toContain('hidden-wallet');
    expect(encoded).not.toContain('SECRET');
  });
});
describe('confirmed semantics', () => {
  it('records both duel outcomes and explicit tokens', () => {
    const e = normalizeRow('duels', fixtures.duels);
    expect(e.map((r) => r.metadata.outcome)).toEqual(['WIN', 'LOSS']);
    expect(e.map((r) => r.squigTokenId)).toEqual([3157, 821]);
    expect(e[0].direction).toBe('WAGER');
  });
  it('cancelled duel has neither a win nor money', () => {
    const e = normalizeRow('duels', {
      ...fixtures.duels,
      status: 'cancelled',
    })[0];
    expect(e.amount).toBeUndefined();
    expect(e.metadata.outcome).toBeNull();
    expect(e.visibility).toBe('PRIVATE');
  });
  it('correction changes outcome without changing identity', () => {
    const a = normalizeRow('duels', fixtures.duels),
      b = normalizeRow('duels', { ...fixtures.duels, winner_id: other });
    expect(a.map(eventKey)).toEqual(b.map(eventKey));
    expect(b[0].metadata.outcome).toBe('LOSS');
  });
  it('does not attach Survival to an owned NFT', () =>
    expect(
      normalizeRow('survival', fixtures.survival)[0].squigTokenId,
    ).toBeUndefined());
  it('refuses malformed game metrics', () =>
    expect(() =>
      normalizeRow('survival', { ...fixtures.survival, eliminations: -1 }),
    ).toThrow());
  it('missing placement remains private ongoing participation', () =>
    expect(
      normalizeRow('survival', { ...fixtures.survival, placement: null })[0]
        .visibility,
    ).toBe('PRIVATE'));
  it('donated external token is not a Squig', () =>
    expect(
      normalizeRow('bounty', fixtures.bounty)[0].squigTokenId,
    ).toBeUndefined());
  it('even a donated Squig is not a draw entry', () =>
    expect(
      normalizeRow('bounty', {
        ...fixtures.bounty,
        contract_address: SQUIGS_CONTRACT,
      })[0].squigTokenId,
    ).toBeUndefined());
  it('pool operator is not assigned the Squig', () =>
    expect(
      normalizeRow('bountyEntries', fixtures.bountyEntries)[0].discordId,
    ).toBeUndefined());
  it('draw winner has contract-checked token', () =>
    expect(
      normalizeRow('bountyResults', fixtures.bountyResults)[0].squigTokenId,
    ).toBe(3157));
  it('other contract winner is never linked', () =>
    expect(
      normalizeRow('bountyResults', {
        ...fixtures.bountyResults,
        winning_entry_contract: '0x' + '1'.repeat(40),
      })[0].squigTokenId,
    ).toBeUndefined());
  it('no donor amount is invented from paid status', () =>
    expect(normalizeRow('bounty', fixtures.bounty)[0].amount).toBeUndefined());
  it('swallowed alone is not digested', () =>
    expect(
      normalizeRow('maw', {
        ...fixtures.maw,
        squig_disposition: 'swallowed',
      }).map((e) => e.eventType),
    ).toEqual(['MAW_SWALLOWED']));
  it('confirmed burn adds a separate major fact', () =>
    expect(
      normalizeRow('maw', {
        ...fixtures.maw,
        digestion_status: 'digested',
        burn_confirmed_at: at,
        burn_transaction_hash: '0x' + 'a'.repeat(64),
      })[1].eventType,
    ).toBe('MAW_DIGESTED'));
  it('pending Maw payout is not counted', () =>
    expect(
      normalizeRow('maw', { ...fixtures.maw, payout_status: 'processing' })[0]
        .amount,
    ).toBeUndefined());
  it('reserved purchase has no confirmed spend', () =>
    expect(
      normalizeRow('marketplace', {
        ...fixtures.marketplace,
        status: 'reserved',
      })[0].amount,
    ).toBeUndefined());
  it('refund is distinct from purchase', () =>
    expect(
      normalizeRow('purchases', {
        ...fixtures.purchases,
        refunded_at: at,
        refunded_amount: 100,
      })[1].direction,
    ).toBe('REFUND'));
  it.each(['pending', 'declined'])(
    '%s submission hides image and reward is not money',
    (status) => {
      const e = normalizeRow('submissions', {
        ...fixtures.submissions,
        status,
      })[0];
      expect(e.visibility).toBe('PRIVATE');
      expect(e.metadata.imageUrl).toBeNull();
      expect(e.amount).toBeUndefined();
    },
  );
  it('approval reward points do not imply payout', () =>
    expect(
      normalizeRow('submissions', fixtures.submissions)[0].amount,
    ).toBeUndefined());
  it('unpublished Mad Lib never becomes public', () =>
    expect(
      normalizeRow('madlibPublications', {
        ...fixtures.madlibPublications,
        status: 'prepared',
      })[0].visibility,
    ).toBe('PRIVATE'));
  it('confirmed Mad Lib operation is canonical CHARM', () =>
    expect(
      normalizeRow('madlibOperations', fixtures.madlibOperations)[0].currency,
    ).toBe('CHARM'));
  it('prepared Mad Lib operation is not money', () =>
    expect(
      normalizeRow('madlibOperations', {
        ...fixtures.madlibOperations,
        state: 'prepared',
      })[0].amount,
    ).toBeUndefined());
  it('claim observation does not prove payout', () =>
    expect(
      normalizeRow('claimEvents', fixtures.claimEvents)[0].amount,
    ).toBeUndefined());
  it('unknown category safely defaults', () =>
    expect(activityFilters.parse({ category: 'SQL' }).category).toBe('ALL'));
  it('invalid Squig token is rejected', () =>
    expect(() =>
      normalizeRow('duels', {
        ...fixtures.duels,
        challenger_squig_token_id: '4445',
      }),
    ).toThrow());
});

it('formats currency display without losing decimal precision', () => {
  expect(formatAmount('12345678901234567890.12000000')).toBe(
    '12,345,678,901,234,567,890.12',
  );
});
