import type { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { createBridgeHandler } from '../../src/integrations/bridge-server';
import { readPage } from '../../src/integrations/table';
import { tables } from '../../src/integrations/registry';
import { runActivityFeed } from '../../src/sync/activity';
import { db } from '../../src/server/db';
import { inspectIntegrations } from '../../src/integrations/inspect';
import {
  sourcePermissions,
  safeSourceRole,
} from '../../src/integrations/permissions';
import { bridgeRequest } from '../../src/integrations/bridge-client';
import { validateIntegrations } from '../../src/integrations/validate';
import { sourceSchema } from '../../src/integrations/source-schema';
export async function sourceBridgeDatabaseTests(
  check: (value: unknown, message: string) => void,
  external: Client,
) {
  const direct = await readPage(tables.duels, undefined, {}, 2);
  const secret = randomBytes(32).toString('hex'),
    handle = createBridgeHandler('uglybot', secret);
  const originalFetch = globalThis.fetch;
  const gauntletHandle = createBridgeHandler('gauntlet', secret);
  process.env.UGLYBOT_BRIDGE_URL = 'https://bridge.fixture';
  process.env.UGLYBOT_BRIDGE_SECRET = secret;
  globalThis.fetch = async (input, init) =>
    String(input).startsWith('https://bridge.fixture/')
      ? handle(new Request(String(input), init))
      : String(input).startsWith('https://gauntlet.fixture/')
        ? gauntletHandle(new Request(String(input), init))
        : originalFetch(input, init);
  try {
    const bridged = await readPage(tables.duels, undefined, {}, 2);
    check(
      JSON.stringify(bridged) === JSON.stringify(direct),
      'bridge preserves direct PG row/date/null projection',
    );
    const schema = (await inspectIntegrations(false, ['uglybot']))[0];
    check(
      schema.transport === 'bridge' &&
        schema.authenticated &&
        schema.tables.some(
          (t) =>
            t.table === 'squig_duels' && t.present && !t.missingRequired.length,
        ),
      'authenticated bridge schema inspection',
    );
    const role = await sourcePermissions('uglybot');
    check(
      role.ok && safeSourceRole(role.data[0]),
      'bridge exposes effective read-only role evidence',
    );
    const forbidden = await bridgeRequest('uglybot', '/v1/feeds/duels/page', {
      table: 'session',
    });
    check(
      !forbidden.ok,
      'bridge rejects arbitrary table inputs before row reads',
    );
    const updated = {
      ...tables.duels,
      keys: ['updated_at', 'id'],
      required: [...tables.duels.required, 'updated_at'],
      optional: tables.duels.optional.filter((c) => c !== 'updated_at'),
    };
    await external.query(
      "INSERT INTO squig_duels(id,challenger_id,status,created_at,updated_at) VALUES ('bridge-a','888888888888888888','completed','2026-01-01','2099-01-01 00:00:00.123456+00'),('bridge-b','888888888888888888','completed','2026-01-01','2099-01-01 00:00:00.123457+00')",
    );
    const first = await readPage(updated, undefined, {}, 1, {
      column: 'updated_at',
      value: new Date('2099-01-01'),
    });
    check(
      first.ok && String(first.data[0].updated_at).includes('123456'),
      'bridge retains PostgreSQL microseconds',
    );
    if (!first.ok) throw Error('BRIDGE_PAGE_FAILED');
    const next = await readPage(
      updated,
      [first.data[0].updated_at, first.data[0].id],
      {},
      1,
      { column: 'updated_at', value: new Date('2099-01-01') },
    );
    check(
      next.ok && next.data[0].id === 'bridge-b',
      'bridge composite cursor does not repeat or skip microsecond boundaries',
    );
    await validateIntegrations();
    const pilotBefore = await db().integrationSource.findUniqueOrThrow({
      where: { id: 'duels' },
    });
    const imported = await runActivityFeed('duels', {
      since: new Date('2099-01-01'),
      maxPages: 1,
    });
    check(
      imported.inserted === 2,
      'bridge adapter uses existing canonical import pipeline',
    );
    const pilotAfter = await db().integrationSource.findUniqueOrThrow({
      where: { id: 'duels' },
    });
    check(
      pilotBefore.schemaFingerprint === pilotAfter.schemaFingerprint,
      'pilot retains the validated schema fingerprint for approval',
    );
    check(
      JSON.stringify([
        pilotBefore.cursor,
        pilotBefore.reconcileCursor,
        pilotBefore.backfillFinishedAt,
      ]) ===
        JSON.stringify([
          pilotAfter.cursor,
          pilotAfter.reconcileCursor,
          pilotAfter.backfillFinishedAt,
        ]),
      'bounded pilot cannot advance historical or reconciliation cursors or completion',
    );
    const replay = await runActivityFeed('duels', {
      since: new Date('2099-01-01'),
      maxPages: 1,
    });
    check(
      replay.inserted === 0 && replay.updated === 0 && replay.skipped === 2,
      'bridge replay is idempotent',
    );
    await external.query(
      "UPDATE squig_duels SET status='cancelled',updated_at='2099-01-01 00:00:01.123456+00' WHERE id='bridge-a'",
    );
    const corrected = await runActivityFeed('duels', {
      since: new Date('2099-01-01'),
      maxPages: 1,
    });
    check(
      corrected.updated === 1 && corrected.inserted === 0,
      'bridge correction updates canonical event rather than duplicates',
    );
    check(
      (await db().collectorActivity.count({
        where: {
          sourceType: 'duels',
          sourceId: { in: ['bridge-a', 'bridge-b'] },
        },
      })) === 2,
      'bridge corrections preserve canonical record identity',
    );
    // Fixture-only historical bot attribution is corrected by the importer.
    await external.query(
      "INSERT INTO squig_duels(id,challenger_id,opponent_id,winner_id,status,created_at,completed_at,updated_at) VALUES ('bridge-bot','888888888888888888','777777777777777777','777777777777777777','completed','2102-01-01','2102-01-01','2102-01-01')",
    );
    const botOptions = { since: new Date('2102-01-01'), maxPages: 1 };
    await runActivityFeed('duels', botOptions);
    process.env.UGLYBOT_BOT_DISCORD_ID = '777777777777777777';
    const botCorrection = await runActivityFeed('duels', botOptions);
    const botRecords = await db().collectorActivity.findMany({
      where: { sourceType: 'duels', sourceId: 'bridge-bot' },
    });
    check(
      botCorrection.inserted === 0 &&
        botCorrection.updated === 1 &&
        botRecords.filter((r) => r.recordStatus === 'ACTIVE').length === 1 &&
        botRecords.filter((r) => r.recordStatus === 'RETRACTED').length === 1,
      'bot identity correction retracts obsolete slot without deleting source evidence',
    );
    const botReplay = await runActivityFeed('duels', botOptions);
    check(
      botReplay.updated === 0 && botReplay.inserted === 0,
      'bot correction remains idempotent on bounded replay',
    );
    process.env.UGLYBOT_BOT_DISCORD_ID = '';
    // Fixture-only schema absence: no upstream Gauntlet table is created here.
    const missing = await bridgeRequest('uglybot', '/v1/feeds/maw/page', {});
    check(!missing.ok, 'absent configured source stays unavailable');
    await external.query(
      'CREATE TABLE gauntlet_runs(id bigint PRIMARY KEY,user_id text,score int,finished_at timestamptz)',
    );
    await external.query('GRANT SELECT ON gauntlet_runs TO uglydex_readonly');
    process.env.GAUNTLET_DATABASE_URL = process.env.UGLYBOT_DATABASE_URL;
    process.env.GAUNTLET_BRIDGE_URL = 'https://gauntlet.fixture';
    process.env.GAUNTLET_BRIDGE_SECRET = secret;
    const partial = (await inspectIntegrations(false, ['gauntlet']))[0];
    check(
      sourceSchema(partial).compatible && sourceSchema(partial).partial,
      'missing optional rewards does not disable Gauntlet runs',
    );
    check(
      (await readPage(tables.runs)).ok,
      'runs page remains readable when rewards table is absent',
    );
    const rewards = await readPage(tables.onlineRewards);
    check(
      !rewards.ok && rewards.reason === 'schema_mismatch',
      'online rewards explicitly unavailable without fabricated rows',
    );
    await validateIntegrations();
    check(
      (
        await db().integrationSource.findUniqueOrThrow({
          where: { id: 'runs' },
        })
      ).state === 'READY',
      'runs feed independently validated through bridge',
    );
    check(
      (
        await db().integrationSource.findUniqueOrThrow({
          where: { id: 'onlineRewards' },
        })
      ).state === 'UNAVAILABLE',
      'absent reward feed records UNAVAILABLE',
    );
    await external.query(
      'CREATE TABLE squig_survival_games(id bigint PRIMARY KEY,started_at timestamptz)',
    );
    await external.query(
      'CREATE TABLE squig_survival_game_players(game_id bigint,user_id text,eliminations int,deaths int,images_used int,placement int,PRIMARY KEY(game_id,user_id))',
    );
    await external.query(
      'GRANT SELECT ON squig_survival_games,squig_survival_game_players TO uglydex_readonly',
    );
    await external.query(
      "INSERT INTO squig_survival_games VALUES (990001,'2099-01-01T00:00:00Z'),(990002,'2100-01-01T00:00:00Z')",
    );
    await external.query(
      "INSERT INTO squig_survival_game_players VALUES (990001,'888888888888888888',0,1,1,2),(990002,'888888888888888888',1,0,1,1)",
    );
    process.env.GAUNTLET_SURVIVAL_DATABASE_URL =
      process.env.UGLYBOT_DATABASE_URL;
    const survival = await runActivityFeed('survival', {
      since: new Date('2099-06-01'),
      maxPages: 1,
    });
    check(
      survival.scanned === 2 &&
        survival.inserted === 1 &&
        survival.skipped === 1 &&
        survival.failed === 0,
      'parent-dated Survival pilot bounds reads and filters by game start',
    );
    const kept = await db().collectorActivity.findFirstOrThrow({
      where: { sourceType: 'survival', sourceId: '990002:888888888888888888' },
    });
    check(
      kept.eventAt.toISOString() === '2100-01-01T00:00:00.000Z' &&
        kept.squigId === null,
      'Survival pilot retains game-start date and no inferred Squig',
    );
    await runActivityFeed('survival', {
      since: new Date('2101-01-01'),
      maxPages: 1,
    });
    check(
      (
        await db().collectorActivity.findUniqueOrThrow({
          where: { id: kept.id },
        })
      ).recordStatus === 'ACTIVE',
      'out-of-range pilot rows cannot retract earlier activity',
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env.UGLYBOT_BRIDGE_URL = '';
    process.env.UGLYBOT_BRIDGE_SECRET = '';
    process.env.UGLYBOT_BOT_DISCORD_ID = '';
    process.env.GAUNTLET_DATABASE_URL = '';
    process.env.GAUNTLET_SURVIVAL_DATABASE_URL = '';
    process.env.GAUNTLET_BRIDGE_URL = '';
    process.env.GAUNTLET_BRIDGE_SECRET = '';
    await external.query(
      "DELETE FROM squig_duels WHERE id IN ('bridge-a','bridge-b','bridge-bot')",
    );
  }
}
