import { db } from '../../src/server/db';
import { deriveToken } from '../../src/sync/provenance';
import {
  seedProgression,
  rebuildSubject,
} from '../../src/server/progression-engine';
import { SQUIGS_CONTRACT } from '../../src/domain/validation';
import { RULESET } from '../../src/domain/progression';
export async function squigMintRecoveryTests(
  check: (value: unknown, message: string) => void,
) {
  await seedProgression();
  const s = await db().squig.create({
    data: { chainId: 1, contractAddress: SQUIGS_CONTRACT, tokenId: 4400 },
  });
  const wallet = '0x' + 'de'.repeat(20);
  const mint = {
    id: 'mint-recovery',
    chainId: 1,
    contractAddress: SQUIGS_CONTRACT,
    tokenId: 4400,
    squigId: s.id,
    fromAddress: '0x' + '00'.repeat(20),
    toAddress: wallet,
    transactionHash: '0x' + 'ef'.repeat(32),
    logIndex: 0,
    transactionIndex: 0,
    blockNumber: 100n,
    blockHash: '0x' + 'ab'.repeat(32),
    eventAt: new Date('2026-06-19T06:03:00Z'),
  };
  await db().nftTransfer.create({ data: mint });
  await db().squigProvenance.create({ data: { squigId: s.id, dirty: true } });
  await rebuildSubject('SQUIG', s.id);
  const awarded = () =>
    db().squigAchievement.count({
      where: {
        squigId: s.id,
        achievementId: `${RULESET}:squig-mint-1`,
        revokedAt: null,
      },
    });
  check(
    (await awarded()) === 0,
    'dirty mint projection does not grant an unverified origin',
  );
  await deriveToken(s.id);
  check(
    !!(await db().progressionJob.findUnique({
      where: {
        subjectType_subjectId: { subjectType: 'SQUIG', subjectId: s.id },
      },
    })),
    'provenance rebuild queues Squig achievement recalculation',
  );
  await rebuildSubject('SQUIG', s.id);
  check(
    (await awarded()) === 1,
    'stored mint recovers Born Ugly after projection rebuild',
  );
  await deriveToken(s.id);
  await rebuildSubject('SQUIG', s.id);
  check((await awarded()) === 1, 'repeat rebuild cannot duplicate Born Ugly');
  await db().nftTransfer.delete({ where: { id: mint.id } });
  await db().squigProvenance.update({
    where: { squigId: s.id },
    data: { dirty: true },
  });
  await deriveToken(s.id);
  await rebuildSubject('SQUIG', s.id);
  check(
    (await awarded()) === 0,
    'removed mint retracts the award rather than fabricating evidence',
  );
}
