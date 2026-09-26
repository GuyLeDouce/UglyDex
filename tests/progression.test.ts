import { describe, it, expect } from 'vitest';
import {
  evaluate,
  levelInfo,
  threshold,
  gateSatisfied,
  achievements,
  xpRules,
  matching,
  type Fact,
  type Metric,
} from '../src/domain/progression';
const gates = {
  identity: true,
  provenance: true,
  sources: { duels: 'PARTIAL' },
};
const fact = (
  type: string,
  n = 0,
  metadata: Record<string, unknown> = {},
): Fact => ({
  key: `${type}:${n}`,
  at: new Date(Date.UTC(2026, 0, 1 + n)).toISOString(),
  type,
  category: type.startsWith('DUEL') ? 'DUELS' : 'SQUIGS',
  tokenId: n + 1,
  metadata,
});
describe('versioned evidence progression', () => {
  it('replays multiple level jumps with historical crossing dates', () => {
    const facts = Array.from({ length: 120 }, (_, i) =>
      fact('DUEL_COMPLETED', i, { outcome: 'WIN' }),
    );
    const result = evaluate('COLLECTOR', facts, gates);
    expect(result.milestones.map((m) => m.level)).toEqual([
      2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(result.milestones[0].at).toBe(facts[3].at);
    expect(result.level).toBe(8);
    expect(evaluate('COLLECTOR', facts.slice(0, 3), gates).level).toBe(1);
  });
  it('has 43 Collector and 22 Squig achievements with unique keys', () => {
    expect(achievements.filter((a) => a.subject === 'COLLECTOR')).toHaveLength(
      43,
    );
    expect(achievements.filter((a) => a.subject === 'SQUIG')).toHaveLength(22);
    expect(new Set(achievements.map((a) => a.key)).size).toBe(
      achievements.length,
    );
  });
  it('awards participation and win separately without money multipliers', () => {
    const a = evaluate(
      'COLLECTOR',
      [fact('DUEL_COMPLETED', 0, { outcome: 'WIN', amount: '100000000' })],
      gates,
    );
    expect(a.total).toBe(25n);
    expect(a.grants).toHaveLength(2);
  });
  it('allows explicit Squig activity without resolved Collector identity', () => {
    const g = { ...gates, identity: false };
    expect(evaluate('COLLECTOR', [fact('DUEL_COMPLETED')], g).total).toBe(0n);
    expect(evaluate('SQUIG', [fact('DUEL_COMPLETED')], g).total).toBe(15n);
  });
  it('does not give Squigs XP for Survival', () =>
    expect(
      evaluate('SQUIG', [fact('SURVIVAL_PLAYED', 0, { placement: 1 })], gates)
        .total,
    ).toBe(0n));
  it('caps purchase XP to one event', () =>
    expect(
      evaluate(
        'COLLECTOR',
        Array.from({ length: 20 }, (_, i) =>
          fact('MARKETPLACE_PURCHASE', i, { confirmed: true }),
        ),
        gates,
      ).total,
    ).toBe(20n));
  it('does not reward cancelled/operational/rejected activity', () =>
    expect(
      evaluate(
        'COLLECTOR',
        [
          'DUEL_CANCELLED',
          'BOUNTY_REJECTED',
          'IMAGE_SUBMISSION',
          'CHARM_CLAIM_RECORDED',
          'MAW_DIGESTED',
          'WALLET_MOVE',
        ].map((t) => fact(t)),
        gates,
      ).total,
    ).toBe(0n));
  it('replay order and duplicate evidence are deterministic', () => {
    const f = [fact('DUEL_COMPLETED', 1), fact('DUEL_COMPLETED', 0)];
    expect(evaluate('SQUIG', f, gates)).toEqual(
      evaluate('SQUIG', [...f].reverse(), gates),
    );
    expect(evaluate('SQUIG', [...f, ...f], gates).total).toBe(30n);
  });
  it('reverses win bonus and aggregate award when corrected', () => {
    const facts = Array.from({ length: 10 }, (_, i) =>
      fact('DUEL_COMPLETED', i, { outcome: 'WIN' }),
    );
    const before = evaluate('COLLECTOR', facts, gates);
    facts[9].metadata.outcome = 'LOSS';
    const after = evaluate('COLLECTOR', facts, gates);
    expect(before.total - after.total).toBe(10n);
    expect(
      before.awards.find((a) => a.definition.key === 'collector-wins-10')
        ?.unlocked,
    ).toBe(true);
    expect(
      after.awards.find((a) => a.definition.key === 'collector-wins-10')
        ?.unlocked,
    ).toBe(false);
  });
  it('discovery dedupes token identity and grants canonical OG/Legendary', () => {
    const f = [
      fact('DISCOVERY', 0, { og: true, legendary: true }),
      { ...fact('DISCOVERY', 0), key: 'reacquired' },
    ];
    expect(evaluate('COLLECTOR', f, gates).total).toBe(100n);
  });
  it('requires clean provenance for mint XP and origin badges', () => {
    const f = [fact('MINT', 0, { og: true, legendary: true })];
    expect(evaluate('SQUIG', f, { ...gates, provenance: false }).total).toBe(
      0n,
    );
    expect(
      evaluate('SQUIG', f, gates).awards.filter((a) => a.unlocked),
    ).toHaveLength(3);
  });
  it('gates COMPLETE separately from known lower-bound milestones', () => {
    expect(gateSatisfied('COMPLETE:duels', gates)).toBe(false);
    expect(gateSatisfied('READY:duels', gates)).toBe(true);
    expect(gateSatisfied('READY:absent', gates)).toBe(false);
    expect(
      gateSatisfied('COMPLETE:duels', {
        ...gates,
        sources: { duels: 'COMPLETE' },
      }),
    ).toBe(true);
  });
  it('uses threshold-crossing historical dates', () => {
    const f = Array.from({ length: 10 }, (_, i) =>
      fact('DUEL_COMPLETED', i, { outcome: 'WIN' }),
    );
    const r = evaluate('COLLECTOR', f, gates);
    expect(r.milestones).toEqual([{ level: 2, at: f[3].at }]);
    expect(
      r.awards.find((a) => a.definition.key === 'collector-wins-10')?.at,
    ).toBe(f[9].at);
  });
  it.each(['COLLECTOR', 'SQUIG'] as const)(
    '%s levels support boundaries and reductions',
    (s) => {
      for (let l = 2; l < 200; l++) {
        expect(levelInfo(s, threshold(s, l)).level).toBe(l);
        expect(levelInfo(s, threshold(s, l) - 1n).level).toBe(l - 1);
      }
      expect(levelInfo(s, 0n).level).toBe(1);
    },
  );
  it('distinct milestones and systems avoid repeated category inflation', () => {
    const f = [
      fact('IMAGE_APPROVED', 0, { milestone: '14' }),
      fact('IMAGE_APPROVED', 1, { milestone: '14' }),
    ];
    expect(matching(f, 'milestones')).toHaveLength(1);
    expect(matching(f, 'systems')).toHaveLength(1);
  });
  it.each([
    ['SURVIVAL_PLAYED', { placement: 1 }, 'survivalWins'],
    ['IMAGE_APPROVED', {}, 'creator'],
    ['BOUNTY_ACCEPTED', {}, 'bounty'],
    ['BOUNTY_WON', {}, 'bountyWins'],
    ['MAW_REGURGITATED', {}, 'maw'],
    ['MADLIB_PUBLISHED', {}, 'madlibs'],
    ['GAUNTLET_COMPLETED', {}, 'gauntlet'],
  ] as [string, Record<string, unknown>, Metric][])(
    'evaluates %s using reusable conditions',
    (type, metadata, metric) => {
      expect(matching([fact(type, 0, metadata)], metric)).toHaveLength(1);
    },
  );
  it('contains no monetary XP rule or anonymous rule key', () => {
    expect(xpRules.every((r) => r.xp > 0 && r.key)).toBe(true);
    expect(xpRules.some((r) => /amount|spend|wager/.test(r.metric))).toBe(
      false,
    );
  });
  it('hidden achievements have threshold criteria', () =>
    expect(
      achievements.filter((a) => a.hidden).map((a) => a.threshold),
    ).toEqual([7]));
});
