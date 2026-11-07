import { loopPose, type CardFinish } from '@/domain/card-finish';
import { disposeScene, paintCard, paintScene } from './card-material';

export function canvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const ctx = element.getContext('2d');
  if (!ctx)
    throw new Error(
      'Card rendering is unavailable in this browser. You can still download the original PNG.',
    );
  return { element, ctx };
}
export function saveFile(file: File) {
  const url = URL.createObjectURL(file),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function staticCard(
  base: HTMLImageElement,
  finish: CardFinish,
  name: string,
) {
  const surface = canvas(1500, 2100);
  paintCard(surface.ctx, base, finish, { x: 0.35, y: -0.2 });
  const blob = await new Promise<Blob>((resolve, reject) =>
    surface.element.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error('PNG could not be generated.')),
      'image/png',
    ),
  );
  return new File([blob], name, { type: 'image/png' });
}
export async function animatedCard(
  base: HTMLImageElement,
  finish: CardFinish,
  name: string,
  signal: AbortSignal,
  progress: (value: number) => void,
): Promise<File> {
  signal.throwIfAborted();
  const {
    Output,
    Mp4OutputFormat,
    WebMOutputFormat,
    BufferTarget,
    CanvasSource,
    canEncodeVideo,
  } = await import('mediabunny');
  const options = {
    width: 900,
    height: 1260,
    bitrate: 6_000_000,
    frameRate: 30,
  };
  const codec = (await canEncodeVideo('avc', options))
    ? 'avc'
    : (await canEncodeVideo('vp9', options))
      ? 'vp9'
      : (await canEncodeVideo('vp8', options))
        ? 'vp8'
        : null;
  if (!codec)
    throw new Error(
      'Animated export is unavailable in this browser. Try a current Chrome or Safari, or download PNG.',
    );
  signal.throwIfAborted();
  const face = canvas(900, 1260),
    scene = canvas(900, 1260);
  const target = new BufferTarget();
  const output = new Output({
    target,
    format: codec === 'avc' ? new Mp4OutputFormat() : new WebMOutputFormat(),
  });
  const source = new CanvasSource(scene.element, { codec, bitrate: 6_000_000 });
  output.addVideoTrack(source, { frameRate: 30 });
  let stopped = false;
  const abort = () => {
    stopped = true;
    void output.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 120000);
  try {
    await output.start();
    // Explicit timestamps preserve every frame even when rendering takes longer
    // than real time. Backpressure bounds encoder memory on mobile devices.
    for (let frame = 0; frame < 180; frame++) {
      signal.throwIfAborted();
      if (stopped)
        throw new Error('Export timed out. Please retry or download PNG.');
      const pose = loopPose(frame / 180);
      paintCard(face.ctx, base, finish, pose);
      paintScene(scene.ctx, face.element, pose);
      await source.add(frame / 30, 1 / 30);
      progress(Math.floor(((frame + 1) / 180) * 95));
      if (frame % 3 === 0)
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    source.close();
    await output.finalize();
    signal.throwIfAborted();
    if (!target.buffer || target.buffer.byteLength < 1024)
      throw new Error('No usable video was generated. Please retry.');
    const type = codec === 'avc' ? 'video/mp4' : 'video/webm';
    const blob = new Blob([target.buffer], { type });
    await validateVideo(blob, signal);
    progress(100);
    return new File(
      [blob],
      name.replace(/\.png$/, codec === 'avc' ? '.mp4' : '.webm'),
      { type },
    );
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
    if (output.state !== 'finalized' && output.state !== 'canceled')
      await output.cancel();
    disposeScene(scene.element);
    face.element.width = scene.element.width = 1;
  }
}

async function validateVideo(blob: Blob, signal: AbortSignal) {
  const video = document.createElement('video'),
    url = URL.createObjectURL(blob);
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          finish(
            new Error(
              'The video could not be verified. Please try another browser.',
            ),
          ),
        10000,
      );
      const abort = () =>
        finish(new DOMException('Export cancelled.', 'AbortError'));
      const finish = (error?: Error) => {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
        if (error) reject(error);
        else resolve();
      };
      signal.addEventListener('abort', abort, { once: true });
      video.onloadeddata = () =>
        finish(
          video.videoWidth === 900 && video.videoHeight === 1260
            ? undefined
            : new Error('The video dimensions were invalid.'),
        );
      video.onerror = () =>
        finish(
          new Error(
            'The generated video could not be played. Please try another browser.',
          ),
        );
      video.src = url;
    });
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
