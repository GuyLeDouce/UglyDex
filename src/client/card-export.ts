import { loopPose, recordingType, type CardFinish } from '@/domain/card-finish';
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
  const mime =
    typeof MediaRecorder === 'undefined'
      ? null
      : recordingType((type) => MediaRecorder.isTypeSupported(type));
  if (!mime || !HTMLCanvasElement.prototype.captureStream)
    throw new Error(
      'Animated export is unavailable in this browser. Try a current Chrome or Safari, or download PNG.',
    );
  const face = canvas(900, 1260),
    scene = canvas(900, 1260);
  const render = (time: number) => {
    const pose = loopPose(time);
    paintCard(face.ctx, base, finish, pose);
    paintScene(scene.ctx, face.element, pose);
  };
  render(0);
  const stream = scene.element.captureStream(30);
  const chunks: Blob[] = [];
  let renderedFrames = 0;
  let recorder: MediaRecorder | undefined;
  let raf = 0,
    watchdog: ReturnType<typeof setTimeout> | undefined;
  try {
    signal.throwIfAborted();
    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 6_000_000,
    });
    const recording = recorder;
    await new Promise<void>((resolve, reject) => {
      const fail = (error: Error) => reject(error);
      recording.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recording.onerror = () =>
        fail(new Error('Video encoding failed. Try PNG or another browser.'));
      recording.onstop = () => resolve();
      const abort = () =>
        fail(new DOMException('Export cancelled.', 'AbortError'));
      signal.addEventListener('abort', abort, { once: true });
      recording.addEventListener(
        'stop',
        () => signal.removeEventListener('abort', abort),
        { once: true },
      );
      watchdog = setTimeout(
        () =>
          fail(
            new Error('Export timed out. Keep this tab visible and try again.'),
          ),
        20000,
      );
      recording.start();
      const start = performance.now();
      let last = -100;
      const tick = (now: number) => {
        if (signal.aborted) return;
        if (document.hidden) {
          fail(
            new Error(
              'Export paused because the tab was hidden. Keep it visible and try again.',
            ),
          );
          return;
        }
        const elapsed = now - start;
        if (elapsed >= 6000) {
          recording.stop();
          return;
        }
        if (elapsed - last >= 1000 / 30) {
          render(elapsed / 6000);
          last = elapsed - (elapsed % (1000 / 30));
          renderedFrames++;
          progress(Math.min(95, Math.floor((elapsed / 6000) * 95)));
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    signal.throwIfAborted();
    if (renderedFrames < 90)
      throw new Error(
        'This device could not render a smooth video. Close other apps and retry, or download PNG.',
      );
    const type = recording.mimeType.split(';')[0];
    const blob = new Blob(chunks, { type });
    if (blob.size < 1024)
      throw new Error('No usable video was generated. Please retry.');
    // Decode the generated file before offering it: a successful recorder alone
    // does not prove the browser produced a playable video.
    await validateVideo(blob, signal);
    progress(100);
    return new File(
      [blob],
      name.replace(/\.png$/, type === 'video/mp4' ? '.mp4' : '.webm'),
      { type },
    );
  } finally {
    cancelAnimationFrame(raf);
    clearTimeout(watchdog);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
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
