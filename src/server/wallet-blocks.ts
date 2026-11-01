import 'server-only';
import { db } from './db';
import { walletBlockInput } from '@/domain/wallet-blocks';

/** Caller must authenticate an admin. Mutation and audit commit together. */
export async function changeWalletBlock(actor: string, raw: unknown) {
  const input = walletBlockInput.parse(raw);
  return db().$transaction(async (tx) => {
    // Same lock as association and visibility triggers; take it before row locks.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(194731, 671)`;
    const key = { chainId: 1, walletAddress: input.walletAddress };
    const existing = await tx.blockedWallet.findUnique({
      where: { chainId_walletAddress: key },
    });
    if (input.action === 'block') {
      if (existing)
        return { changed: false, message: 'Wallet is already blocked.' };
      await tx.blockedWallet.create({
        data: { ...key, reason: input.reason, blockedBy: actor },
      });
    } else {
      if (!existing)
        return { changed: false, message: 'Wallet is already unblocked.' };
      if (existing.createdAt.toISOString() !== input.blockedAt)
        throw new Error('BLOCK_CHANGED');
      await tx.blockedWallet.delete({ where: { chainId_walletAddress: key } });
    }
    await tx.operationalAudit.create({
      data: {
        actor,
        action:
          input.action === 'block' ? 'WALLET_BLOCKED' : 'WALLET_UNBLOCKED',
        subject: input.walletAddress,
        detail: {
          chainId: 1,
          reason: input.action === 'block' ? input.reason : existing!.reason,
        },
      },
    });
    return {
      changed: true,
      message:
        input.action === 'block'
          ? 'Wallet blocked. Associated profiles are hidden; tracking history is preserved.'
          : 'Wallet unblocked. Previous visibility is restored unless another block or a private preference applies.',
    };
  });
}
