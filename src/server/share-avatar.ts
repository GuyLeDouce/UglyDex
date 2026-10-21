import 'server-only';
import { resolve4 } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import sharp from 'sharp';
// Resolve once and pin the public address for the connection. No redirects or
// user-controlled destination ports; private network profile URLs cannot be fetched.
export function publicAvatarAddress(ip: string) {
  if (isIP(ip) !== 4) return false;
  const [a, b] = ip.split('.').map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0)
  );
}
export async function shareAvatar(source: string | null) {
  if (!source) return null;
  try {
    const url = new URL(source);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443')
    )
      return null;
    const addresses = await Promise.race([
      resolve4(url.hostname),
      new Promise<string[]>((_, reject) => {
        const timer = setTimeout(() => reject(new Error('DNS_TIMEOUT')), 3000);
        timer.unref();
      }),
    ]);
    if (!addresses.length || !addresses.every(publicAvatarAddress)) return null;
    const bytes = await new Promise<Buffer>((resolve, reject) => {
      const req = request(
        url,
        {
          family: 4,
          lookup: (_host, _options, callback) =>
            callback(null, addresses[0], 4),
          signal: AbortSignal.timeout(8000),
        },
        (response) => {
          if (
            response.statusCode !== 200 ||
            !/^image\/(png|jpeg|webp)(;|$)/i.test(
              String(response.headers['content-type']),
            )
          ) {
            response.destroy();
            reject(new Error('BAD_AVATAR'));
            return;
          }
          const parts: Buffer[] = [];
          let size = 0;
          response.on('data', (part: Buffer) => {
            size += part.length;
            if (size > 3_000_000)
              response.destroy(new Error('AVATAR_TOO_LARGE'));
            else parts.push(part);
          });
          response.on('end', () => resolve(Buffer.concat(parts)));
          response.on('error', reject);
        },
      );
      req.on('error', reject);
      req.end();
    });
    const png = await sharp(bytes, { limitInputPixels: 16777216 })
      .resize(256, 256, { fit: 'cover' })
      .png()
      .toBuffer();
    return 'data:image/png;base64,' + png.toString('base64');
  } catch {
    return null;
  }
}
