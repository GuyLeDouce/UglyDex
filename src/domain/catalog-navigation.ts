import { SQUIGS_CONTRACT } from './validation';

// Parse recognized Squig references only. A malformed query must never silently
// expand into the whole catalog, and foreign-collection links are not token IDs.
export function tokenSearch(input: unknown): {
  token: number | null;
  invalid: boolean;
} {
  if (typeof input !== 'string' || !input.trim())
    return { token: null, invalid: false };
  const value = input.trim();
  let id = value.match(/^(?:Squig\s*)?#?\s*(\d{1,4})$/i)?.[1];
  if (!id) {
    try {
      const url = new URL(value, 'https://uglydex-production.up.railway.app');
      if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error();
      if (url.hostname === 'uglydex-production.up.railway.app')
        id = url.pathname.match(/^\/squig\/(\d{1,4})\/?$/)?.[1];
      else if (['opensea.io', 'www.opensea.io'].includes(url.hostname)) {
        const match = url.pathname.match(
          /^\/(?:assets|item)\/ethereum\/(0x[a-fA-F0-9]{40})\/(\d{1,4})\/?$/,
        );
        if (match?.[1].toLowerCase() === SQUIGS_CONTRACT) id = match[2];
      }
    } catch {
      /* Render a helpful validation message; never fetch the URL. */
    }
  }
  const token = Number(id);
  return Number.isInteger(token) && token >= 1 && token <= 4444
    ? { token, invalid: false }
    : { token: null, invalid: true };
}
export function catalogLink(
  path: string,
  params: Record<string, string | string[] | undefined>,
  changes: Record<string, string | null>,
) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (typeof value === 'string' && value && key !== 'inspect')
      q.set(key, value);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) q.delete(key);
    else q.set(key, value);
  }
  return path + (q.size ? '?' + q.toString() : '');
}
export type CatalogContext = {
  preferenceKey: 'uglydex-personal-view' | 'uglydex-catalog-view';
  path: string;
  params: Record<string, string | string[] | undefined>;
  view: 'album' | 'grid' | 'compact';
  page: number;
  pages: number;
  pageSize: number;
  total: number;
  inspect?: string;
};
