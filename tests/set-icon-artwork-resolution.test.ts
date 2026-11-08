import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('approved collection set card artwork', () => {
  it('ships all 52 approved icons as full-size 1500x1500 PNGs', () => {
    const folder = join(process.cwd(), 'public/icons/sets');
    const filenames = readdirSync(folder).filter((name) =>
      name.endsWith('.png'),
    );
    expect(filenames).toHaveLength(52);
    for (const filename of filenames) {
      const png = readFileSync(join(folder, filename));
      expect(
        png
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      ).toBe(true);
      expect(png.readUInt32BE(16), filename).toBe(1500);
      expect(png.readUInt32BE(20), filename).toBe(1500);
      const preview = readFileSync(
        join(process.cwd(), 'public/icons/sets-preview', filename),
      );
      expect(preview.readUInt32BE(16), filename).toBe(128);
      expect(preview.readUInt32BE(20), filename).toBe(128);
    }
  });
});
