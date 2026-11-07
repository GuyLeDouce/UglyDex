import {
  cardFinishes,
  type CardFinish,
  type CardPose,
} from '@/domain/card-finish';

// Original procedural material. No third-party shaders, textures, or card assets.
// Coordinates use the existing 1500 × 2100 Share card. Ink and original art are
// excluded from the foil mask, keeping every printed trait and pixel faithful.
export function paintCard(
  ctx: CanvasRenderingContext2D,
  base: CanvasImageSource,
  finish: CardFinish,
  pose: CardPose,
) {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.scale(width / 1500, height / 2100);
  ctx.beginPath();
  ctx.roundRect(12, 12, 1476, 2076, 80);
  ctx.clip();
  ctx.drawImage(base, 0, 0, 1500, 2100);
  const material = cardFinishes[finish.rarity];
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(14, 14, 1472, 2072, 78);
  ctx.roundRect(47, 47, 1406, 2006, 54);
  ctx.roundRect(145, 280, 1210, 1210, 25);
  ctx.rect(160, 295, 1180, 1180);
  ctx.clip('evenodd');
  if (material.foil) {
    const shift = pose.x * 500 + pose.y * 220;
    const spectrum = ctx.createLinearGradient(
      -800 + shift,
      2100,
      2100 + shift,
      0,
    );
    for (let i = 0; i <= 18; i++)
      spectrum.addColorStop(i / 18, `hsl(${(i * 65 + 190) % 360} 90% 72%)`);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = material.foil;
    ctx.fillStyle = spectrum;
    ctx.fillRect(0, 0, 1500, 2100);
    // Engraved diamond lattice: finer and crossed for the premium finishes.
    ctx.globalCompositeOperation = 'soft-light';
    for (let layer = 0; layer < material.facets; layer++) {
      ctx.strokeStyle = layer % 2 ? '#162033' : '#ffffff';
      ctx.lineWidth = layer === 2 ? 6 : 2;
      ctx.globalAlpha = 0.32;
      const step = 90 - layer * 18;
      for (let at = -2100; at < 3600; at += step) {
        ctx.beginPath();
        ctx.moveTo(at + shift * 0.08, 0);
        ctx.lineTo(at + (layer % 2 ? -1500 : 1500) + shift * 0.08, 2100);
        ctx.stroke();
      }
    }
  }
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = material.sheen;
  const light = ctx.createLinearGradient(
    -1100 + pose.x * 700,
    0,
    2300 + pose.x * 700,
    1400 + pose.y * 500,
  );
  light.addColorStop(0, 'transparent');
  light.addColorStop(0.42, 'transparent');
  light.addColorStop(0.5, '#ffffff');
  light.addColorStop(0.58, 'transparent');
  light.addColorStop(1, 'transparent');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, 1500, 2100);
  ctx.restore();
  // Print grain confined to the outer edge, never the NFT or metadata.
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#fff';
  for (let y = 110; y < 1990; y += 12) {
    ctx.fillRect(24 + (y % 5), y, 2, 2);
    ctx.fillRect(1473 - (y % 5), y, 2, 2);
  }
  ctx.globalAlpha = 1;
  if (finish.og) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(270, 48, 960, 88, 44);
    ctx.roundRect(275, 53, 950, 78, 39);
    ctx.clip('evenodd');
    const gold = ctx.createLinearGradient(
      pose.x * 300,
      0,
      1500 + pose.y * 300,
      0,
    );
    gold.addColorStop(0, '#b08528');
    gold.addColorStop(0.45, '#fff4bd');
    gold.addColorStop(0.65, '#edc449');
    gold.addColorStop(1, '#b08528');
    ctx.fillStyle = gold;
    ctx.fillRect(270, 48, 960, 88);
    ctx.restore();
  }
  ctx.restore();
}

// Perspective-project the existing card as a physical plane. Small triangle
// patches keep the text sharp without requiring a WebGL context or dependency.
type Point = { x: number; y: number };
export function paintScene(
  ctx: CanvasRenderingContext2D,
  face: HTMLCanvasElement,
  pose: CardPose,
) {
  const w = ctx.canvas.width,
    h = ctx.canvas.height;
  ctx.fillStyle = '#101318';
  ctx.fillRect(0, 0, w, h);
  const size = Math.min(w * 0.87, (h * 0.87 * 5) / 7),
    height = (size * 7) / 5;
  const rx = pose.y * 0.1,
    ry = pose.x * 0.14;
  function project(u: number, v: number): Point {
    const x = (u - 0.5) * size,
      y = (v - 0.5) * height;
    const z = -x * Math.sin(ry) + y * Math.sin(rx);
    const p = (size * 4) / (size * 4 - z);
    return { x: w / 2 + x * Math.cos(ry) * p, y: h / 2 + y * Math.cos(rx) * p };
  }
  ctx.save();
  ctx.fillStyle = '#06080c';
  ctx.shadowColor = '#0009';
  ctx.shadowBlur = w * 0.035;
  ctx.shadowOffsetY = h * 0.012;
  ctx.beginPath();
  ctx.roundRect((w - size) / 2, (h - height) / 2, size, height, size * 0.055);
  ctx.fill();
  ctx.restore();
  if (Math.abs(pose.x) + Math.abs(pose.y) < 0.001) {
    ctx.drawImage(face, (w - size) / 2, (h - height) / 2, size, height);
    return;
  }
  const cols = 6,
    rows = 8;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const u = col / cols,
        v = row / rows,
        du = 1 / cols,
        dv = 1 / rows;
      const a = project(u, v),
        b = project(u + du, v),
        c = project(u, v + dv),
        d = project(u + du, v + dv);
      triangle(
        ctx,
        face,
        [
          u * face.width,
          v * face.height,
          face.width / cols,
          face.height / rows,
        ],
        a,
        b,
        c,
        false,
      );
      triangle(
        ctx,
        face,
        [
          u * face.width,
          v * face.height,
          face.width / cols,
          face.height / rows,
        ],
        d,
        c,
        b,
        true,
      );
    }
}
function triangle(
  ctx: CanvasRenderingContext2D,
  face: HTMLCanvasElement,
  source: number[],
  a: Point,
  b: Point,
  c: Point,
  reverse: boolean,
) {
  const [x, y, w, h] = source;
  ctx.save();
  ctx.beginPath();
  const center = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
  const expand = (p: Point) => ({
    x: p.x + (p.x - center.x) * 0.006,
    y: p.y + (p.y - center.y) * 0.006,
  });
  const aa = expand(a),
    bb = expand(b),
    cc = expand(c);
  ctx.moveTo(aa.x, aa.y);
  ctx.lineTo(bb.x, bb.y);
  ctx.lineTo(cc.x, cc.y);
  ctx.closePath();
  ctx.clip();
  if (reverse)
    ctx.transform(
      (a.x - b.x) / w,
      (a.y - b.y) / w,
      (a.x - c.x) / h,
      (a.y - c.y) / h,
      b.x + c.x - a.x,
      b.y + c.y - a.y,
    );
  else
    ctx.transform(
      (b.x - a.x) / w,
      (b.y - a.y) / w,
      (c.x - a.x) / h,
      (c.y - a.y) / h,
      a.x,
      a.y,
    );
  ctx.drawImage(face, -x, -y);
  ctx.restore();
}
