// Fixed slot budgets match the collector renderer's row sizes at each export size.
export function shareCapacity(ratio: 'landscape' | 'square') {
  return ratio === 'square'
    ? { achievements: 14, sets: 21, squigs: 12 }
    : { achievements: 8, sets: 9, squigs: 6 };
}
