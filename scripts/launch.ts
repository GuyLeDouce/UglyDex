import 'dotenv/config';
import { readFile, stat } from 'node:fs/promises';
import { launchReport, launchText, attestGate } from '../src/server/launch';
import { safeOperationalCode } from '../src/domain/operations';
const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'attest') {
    const i = args.indexOf('--file'),
      file = i >= 0 ? args[i + 1] : undefined;
    if (!file || (await stat(file)).size > 10000)
      throw new Error('INVALID_EVIDENCE_FILE');
    await attestGate(
      JSON.parse(await readFile(file, 'utf8')),
      args.includes('--reviewed'),
    );
  } else if (command === 'verify') {
    const { verifyLaunch } = await import('../src/server/launch-verify');
    await verifyLaunch();
    const { verifyCharmGate } = await import('../src/server/charm-gate');
    await verifyCharmGate();
  } else if (command === 'rpc') {
    const { verifyLaunchRpc } = await import('../src/server/launch-rpc');
    await verifyLaunchRpc();
  } else if (command === 'provenance') {
    const { assertDeploymentBinding } =
      await import('../src/server/deployment');
    await assertDeploymentBinding();
    const { verifyProvenance } = await import('../src/sync/verify-provenance');
    const { recordGate } = await import('../src/server/launch');
    await recordGate(
      'OWNER_OF',
      'PENDING',
      'Pinned verification in progress',
      {},
    );
    const result = await verifyProvenance();
    if (!result) throw new Error('CHAIN_BUSY');
    const good =
      result.checked === 4444 &&
      result.mints === 4444 &&
      result.ownersMatched === 4444 &&
      !result.anomalies.length &&
      result.coverage === 'CAUGHT_UP';
    await recordGate(
      'OWNER_OF',
      good ? 'VERIFIED' : 'FAILED',
      `${result.ownersMatched}/4444 ownerOf matched; ${result.anomalies.length} anomalous tokens at indexed block ${result.block}`,
      result,
    );
    console.log(JSON.stringify(result, null, 2));
    if (!good) process.exitCode = 1;
  } else if (command === 'sources') {
    const { validateSources } = await import('../src/server/launch-verify');
    console.log(JSON.stringify(await validateSources(), null, 2));
  } else if (command === 'spot') {
    const { chainSpotAudit } = await import('../src/server/chain-spot-audit');
    console.log(JSON.stringify(await chainSpotAudit(), null, 2));
  } else if (command === 'handoff') {
    const { feeds } = await import('../src/sync/normalize');
    const { z } = await import('zod');
    const { handoffProof } = await import('../src/server/handoff-proof');
    const i = args.indexOf('--feed');
    console.log(
      JSON.stringify(
        await handoffProof(
          z.enum(feeds).parse(i >= 0 ? args[i + 1] : undefined),
        ),
        null,
        2,
      ),
    );
  } else if (command === 'explain') {
    const { z } = await import('zod');
    const { explainActivity } = await import('../src/server/evidence-audit');
    const i = args.indexOf('--activity');
    console.log(
      JSON.stringify(
        await explainActivity(z.uuid().parse(i >= 0 ? args[i + 1] : undefined)),
        null,
        2,
      ),
    );
  } else if (command === 'replay') {
    const { replayProof } = await import('../src/server/replay-proof');
    console.log(JSON.stringify(await replayProof(), null, 2));
  } else if (command === 'audit') {
    const { evidenceAudit } = await import('../src/server/evidence-audit');
    console.log(JSON.stringify(await evidenceAudit(), null, 2));
  } else if (!['status', 'report', 'check'].includes(command))
    throw new Error('INVALID_COMMAND');
  if (command === 'check' && process.env.DATABASE_URL) {
    const { verifyReplayProof } = await import('../src/server/replay-proof');
    await verifyReplayProof();
    const { verifyCharmGate } = await import('../src/server/charm-gate');
    await verifyCharmGate();
  }
  const report = await launchReport();
  console.log(
    command === 'report' ? JSON.stringify(report, null, 2) : launchText(report),
  );
  if (
    command === 'check' &&
    !['READY', 'READY_WITH_WARNINGS'].includes(report.overall)
  )
    process.exitCode = 1;
} catch (e) {
  console.error(safeOperationalCode(e));
  process.exitCode = 1;
} finally {
  if (process.env.DATABASE_URL) {
    const { db } = await import('../src/server/db');
    await db().$disconnect();
  }
  const { closeExternalPools } = await import('../src/integrations/read-only');
  await closeExternalPools();
}
