import 'server-only';
import { db } from './db';
import { canonicalTokens } from '@/domain/dex-catalog';
import { COLLECTION_RULESET } from '@/domain/dex';
import {
  personalStatusIcons,
  type StatusIconData,
} from '@/domain/status-icons';
import type { Candidates } from './dex-engine';

// Batch once per page. Suppress personalized claims while collection data is pending.
export async function personalIconSummaries(
  collectorId: string | undefined,
  tokenIds: number[],
) {
  const result = new Map<number, StatusIconData[]>();
  if (!collectorId || !tokenIds.length) return result;
  return db().$transaction(
    async (tx) => {
      if (await tx.collectionJob.findUnique({ where: { collectorId } }))
        return result;
      const snapshot = await tx.collectionSnapshot.findUnique({
        where: {
          ruleset_collectorId: { ruleset: COLLECTION_RULESET, collectorId },
        },
      });
      if (!snapshot) return result;
      const collector = await tx.collector.findUnique({
        where: { id: collectorId },
        select: { featuredSetIds: true },
      });
      const known = new Set(snapshot.discoveredTokenIds),
        held = new Set(snapshot.currentTokenIds),
        wanted = new Set(tokenIds);
      const historical = canonicalTokens.filter((t) => known.has(t.tokenId)),
        current = canonicalTokens.filter((t) => held.has(t.tokenId));
      const candidates = snapshot.candidates as Candidates;
      const featured = (collector?.featuredSetIds ?? []).map((k) =>
        k.replace(`${COLLECTION_RULESET}:`, ''),
      );
      for (const token of canonicalTokens.filter((t) =>
        wanted.has(t.tokenId),
      )) {
        const candidate = candidates[token.tokenId];
        if (candidate)
          result.set(
            token.tokenId,
            personalStatusIcons(
              token,
              candidate,
              historical,
              current,
              featured,
            ),
          );
      }
      return result;
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
