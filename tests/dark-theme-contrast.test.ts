import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/app/design-tokens.css', 'utf8');
function token(name: string): string {
  const value = css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1];
  if (!value) throw new Error(`Missing theme token ${name}`);
  return value.startsWith('var(') ? token(value.slice(6, -1)) : value;
}
function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/../g)!
    .map((part) => {
      const c = parseInt(part, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(token(a)), luminance(token(b))].sort(
    (x, y) => y - x,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}
describe('Reloaded theme accessibility', () => {
  for (const surface of ['bg', 'surface', 'surface-raised']) {
    for (const text of ['ink', 'muted', 'acid']) {
      it(`${text} meets AA normal-text contrast on ${surface}`, () => {
        expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
      });
    }
    it(`control boundaries are visible on ${surface}`, () => {
      expect(contrast('control-border', surface)).toBeGreaterThanOrEqual(3);
    });
  }
  for (const accent of ['brand-blue', 'brand-yellow', 'brand-cyan']) {
    it(`button labels meet AA on ${accent}`, () => {
      expect(contrast('on-accent', accent)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
