import { factory, money } from '../activity';
import { squigToken } from '@/domain/validation';
import type { ExternalRow } from '../table';
export function duelEvents(row: ExternalRow) {
  const add = factory('uglybot', 'duels', row, 'DUELS');
  return ['challenger', 'opponent'].flatMap((role) => {
    const who = row[`${role}_id`],
      other = role === 'challenger' ? 'opponent' : 'challenger';
    const tid = row[`${role}_squig_token_id`];
    // The upstream bot is an opponent, never a Collector. Match only its
    // explicitly configured application identity, never names or token absence.
    const botId = process.env.UGLYBOT_BOT_DISCORD_ID;
    if (botId && /^\d{17,20}$/.test(botId) && String(who) === botId) return [];
    if (!who && !tid) return [];
    const completed = row.status === 'completed' && !!row.completed_at;
    const outcome =
      completed &&
      [row.challenger_id, row.opponent_id].includes(row.winner_id) &&
      row.winner_id
        ? String(row.winner_id) === String(who)
          ? 'WIN'
          : 'LOSS'
        : null;
    return [
      add(
        role,
        completed
          ? 'DUEL_COMPLETED'
          : row.status === 'cancelled'
            ? 'DUEL_CANCELLED'
            : 'DUEL_ENTERED',
        row.completed_at ?? row.created_at,
        /^\d{17,20}$/.test(String(who)) ? who : null,
        {
          status: row.status,
          outcome,
          opponentToken: row[`${other}_squig_token_id`]
            ? squigToken(row[`${other}_squig_token_id`])
            : null,
          rounds: row.rounds ?? null,
          timeBasis: row.completed_at ? 'completed_at' : 'created_at',
        },
        {
          squigTokenId: tid ? squigToken(tid) : undefined,
          visibility: completed ? 'PUBLIC' : 'PRIVATE',
          ...(completed && money(row.wager_amount)
            ? {
                amount: money(row.wager_amount),
                currency: 'CHARM',
                direction: 'WAGER',
              }
            : {}),
        },
      ),
    ];
  });
}
