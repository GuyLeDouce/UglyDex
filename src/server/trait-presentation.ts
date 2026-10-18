import 'server-only';
import { traitCatalog } from '@/domain/dex-catalog';
import { traitKey } from '@/domain/dex';

const counts = new Map(traitCatalog.map((t) => [t.key, t.count]));
export function rarestTraitsFirst<
  T extends { traitType: string; value: string },
>(traits: readonly T[]): T[] {
  return [...traits].sort(
    (a, b) =>
      (counts.get(traitKey(a.traitType, a.value)) ?? Infinity) -
        (counts.get(traitKey(b.traitType, b.value)) ?? Infinity) ||
      a.traitType.localeCompare(b.traitType) ||
      a.value.localeCompare(b.value),
  );
}
