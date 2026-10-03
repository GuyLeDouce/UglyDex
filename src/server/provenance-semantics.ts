import 'server-only';
import { createHash } from 'node:crypto';
import { holdingEventTypes } from '@/domain/provenance';
import type {
  CollectorOwnershipPeriod,
  NftTransfer,
} from '@/generated/prisma/client';
const key = (parts: unknown[]) =>
  createHash('sha256').update(JSON.stringify(parts)).digest('hex');

/** Shared pure projection used by the writer and read-only convergence check. */
export function provenanceActivities(
  squigId: string,
  periods: CollectorOwnershipPeriod[],
  facts: NftTransfer[],
) {
  return periods.flatMap((p) => {
    const types = holdingEventTypes(
      p === periods.find((v) => v.collectorId === p.collectorId),
      p.acquiredAt,
      p.lostAt,
      facts.find((f) => f.id === p.acquisitionEvent)?.eventAt,
      facts.find((f) => f.id === p.lossEvent)?.eventAt,
    );
    const events = [
      { type: types.acquired, at: p.acquiredAt },
      ...(p.lostAt ? [{ type: types.lost, at: p.lostAt }] : []),
    ];
    const firstIndex = facts.findIndex((f) => f.id === p.acquisitionEvent),
      lastIndex = p.lossEvent
        ? facts.findIndex((f) => f.id === p.lossEvent)
        : -1;
    for (const [index, f] of facts.entries())
      if (
        f.fromAddress !== f.toAddress &&
        index > firstIndex &&
        (lastIndex < 0 || index < lastIndex) &&
        f.eventAt >= p.acquiredAt &&
        (!p.lostAt || f.eventAt <= p.lostAt) &&
        p.walletAddresses.includes(f.fromAddress) &&
        p.walletAddresses.includes(f.toAddress)
      )
        events.push({ type: 'WALLET_MOVE', at: f.eventAt });
    return events.map((event, index) => {
      const eventKey = key([p.id, event.type, event.at, index]);
      return {
        eventKey,
        collectorId: p.collectorId,
        squigId,
        sourceSystem: 'provenance',
        category: 'SQUIGS',
        visibility: 'PUBLIC',
        sourceType: 'ownership',
        sourceId: eventKey,
        subjectKey: p.collectorId,
        eventType: event.type,
        eventAt: event.at,
        metadata: { tokenId: facts[0]?.tokenId },
        payloadHash: eventKey,
      };
    });
  });
}
