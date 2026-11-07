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
  // Broad rarity bars use a separate multiply-only foil pass. Dark printed
  // lettering remains dark while reflections travel across the colored stock.
  // The NFT and cream trait area are outside this mask.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(275, 53, 950, 78, 39);
  ctx.roundRect(124, 1605, 1252, 82, 18);
  ctx.roundRect(95, 1986, 1310, 50, 15);
  ctx.clip();
  const travel = pose.x * 1050 + pose.y * 500;
  const barFoil = ctx.createLinearGradient(
    -600 + travel,
    2100,
    1900 + travel,
    0,
  );
  for (let i = 0; i <= 12; i++) {
    barFoil.addColorStop(
      i / 12,
      material.foil
        ? `hsl(${(i * 60 + 185) % 360} 90% 88%)`
        : i % 2
          ? '#f0f0f0'
          : '#ffffff',
    );
  }
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = material.foil
    ? Math.min(1, material.foil + 0.3)
    : material.sheen;
  ctx.fillStyle = barFoil;
  ctx.fillRect(0, 0, 1500, 2100);
  if (material.foil) {
    const sweep = ctx.createLinearGradient(-1400 + travel, 0, 2300 + travel, 0);
    sweep.addColorStop(0, '#e6e6e6');
    sweep.addColorStop(0.4, '#e6e6e6');
    sweep.addColorStop(0.5, '#ffffff');
    sweep.addColorStop(0.6, '#e6e6e6');
    sweep.addColorStop(1, '#e6e6e6');
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, 1500, 2100);
  }
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

// A single GPU-projected plane avoids seams across the original artwork.
// The shared 2D scene remains the video capture source. No external renderer.
type Projector = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  texture: WebGLTexture;
  buffer: WebGLBuffer;
};
const projectors = new WeakMap<HTMLCanvasElement, Projector | null>();
function projector(target: HTMLCanvasElement): Projector | null {
  if (projectors.has(target)) return projectors.get(target)!;
  const surface = document.createElement('canvas');
  surface.width = target.width;
  surface.height = target.height;
  const gl = surface.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  });
  if (!gl) {
    projectors.set(target, null);
    return null;
  }
  const vertex = gl.createShader(gl.VERTEX_SHADER)!,
    fragment = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(
    vertex,
    `attribute vec2 point; varying vec2 uv; uniform vec2 angle; uniform vec2 size; uniform vec2 viewport;
  void main(){vec2 p=point*size;float z=-p.x*sin(angle.x)+p.y*sin(angle.y);float depth=1.0-z/(size.x*4.0);gl_Position=vec4(2.0*p.x*cos(angle.x)/viewport.x,-2.0*p.y*cos(angle.y)/viewport.y,0.0,depth);uv=point+0.5;}`,
  );
  gl.shaderSource(
    fragment,
    `precision highp float; varying vec2 uv; uniform sampler2D face; void main(){gl_FragColor=texture2D(face,uv);}`,
  );
  gl.compileShader(vertex);
  gl.compileShader(fragment);
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    projectors.set(target, null);
    return null;
  }
  gl.useProgram(program);
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]),
    gl.STATIC_DRAW,
  );
  const point = gl.getAttribLocation(program, 'point');
  gl.enableVertexAttribArray(point);
  gl.vertexAttribPointer(point, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.uniform1i(gl.getUniformLocation(program, 'face'), 0);
  const result = { gl, program, texture, buffer };
  projectors.set(target, result);
  return result;
}
export function disposeScene(target: HTMLCanvasElement) {
  const renderer = projectors.get(target);
  projectors.delete(target);
  if (renderer) {
    const { gl, texture, program, buffer } = renderer;
    gl.deleteTexture(texture);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
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
  const renderer = projector(ctx.canvas);
  if (!renderer || renderer.gl.isContextLost()) {
    // Static plane fallback retains all information and moving material.
    ctx.drawImage(face, (w - size) / 2, (h - height) / 2, size, height);
    return;
  }
  const { gl, program } = renderer;
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(
    gl.getUniformLocation(program, 'angle'),
    pose.x * 0.3,
    pose.y * 0.23,
  );
  gl.uniform2f(gl.getUniformLocation(program, 'size'), size, height);
  gl.uniform2f(gl.getUniformLocation(program, 'viewport'), w, h);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, face);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  ctx.drawImage(gl.canvas, 0, 0);
}
