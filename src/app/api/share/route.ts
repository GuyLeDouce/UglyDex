import { GALLERIES_ENABLED } from '@/domain/features';
import { shareFilename } from '@/domain/trading-card';
import { ZodError } from 'zod';
import { shareSchema } from '@/domain/sharing';
import { shareCard } from '@/server/sharing';
import { shareLimit, sharePng } from '@/server/share-cache';
import { currentSession } from '@/server/auth';
import { resolveShareStyle } from '@/domain/share-styles';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = {
    'Cache-Control': 'private, no-store, max-age=0',
    Vary: 'Cookie',
    'X-Robots-Tag': 'noindex',
    'X-Content-Type-Options': 'nosniff',
  };
  try {
    const url = new URL(request.url),
      download = url.searchParams.get('download') === '1',
      owner = url.searchParams.get('preview') === '1';
    url.searchParams.delete('download');
    url.searchParams.delete('preview');
    const spec = shareSchema.parse(Object.fromEntries(url.searchParams));
    if (spec.kind === 'gallery' && !GALLERIES_ENABLED)
      return new Response('Not available', { status: 404, headers });
    await shareLimit();
    const session = await currentSession();
    if (owner && !session)
      return new Response('Not available', { status: 404, headers });
    if (session) await shareLimit(session.collectorId, 20);
    const card = await shareCard(
      spec,
      owner ? session?.collectorId : undefined,
    );
    if (!card) return new Response('Not available', { status: 404, headers });
    const bytes = await sharePng(card, {
      ...spec,
      template: resolveShareStyle(
        url.searchParams.has('template') ? spec.template : undefined,
        card.appearance?.share,
      ),
    });
    const fresh = await shareCard(
      spec,
      owner ? session?.collectorId : undefined,
    );
    if (JSON.stringify(fresh) !== JSON.stringify(card))
      return new Response('Share state changed. Please reload.', {
        status: 409,
        headers,
      });
    return new Response(Buffer.from(bytes), {
      headers: {
        ...headers,
        'Content-Type': 'image/png',
        ...(card.trophyCard
          ? {
              'X-Card-Type': 'trophy',
              'X-Card-Rarity': card.trophyCard.rarity,
              'X-Card-Description': encodeURIComponent(
                `${card.trophyCard.name}. ${card.trophyCard.classification}. ${card.trophyCard.description} Collected by ${card.trophyCard.collector}.`,
              ),
            }
          : {}),
        ...(card.collectorCard
          ? {
              'X-Card-Type': 'collector',
              'X-Card-Description': encodeURIComponent(
                `${card.title}. UglyDex collector card. ${card.collectorCard.completion?.toFixed(1) ?? 'Pending'} percent Field Guide Mastery. Achievement level ${card.collectorCard.level ?? 'pending'}. ${card.collectorCard.discovered ?? 'Pending'} Squigs discovered. ${card.collectorCard.traits ?? 'Pending'} traits discovered. ${card.collectorCard.historicalSets ?? 'Pending'} historical sets. ${card.collectorCard.achievements ?? 'Pending'} achievements complete.`,
              ),
            }
          : {}),
        ...(card.tradingCard
          ? {
              'X-Card-Rarity': card.tradingCard.rarity,
              'X-Card-Description': encodeURIComponent(
                [
                  `Squig #${card.tradingCard.tokenId}`,
                  card.tradingCard.rarity,
                  card.tradingCard.og ? 'OG' : '',
                  `${card.tradingCard.uglyPoints ?? 'Unknown'} UglyPoints`,
                  `Maw rank ${card.tradingCard.mawRank ?? 'unknown'}`,
                  card.tradingCard.legend ?? card.tradingCard.type,
                  ...card.tradingCard.traits.map(
                    (t) => `${t.traitType}: ${t.value}`,
                  ),
                ]
                  .filter(Boolean)
                  .join('. '),
              ),
              'X-Card-OG': card.tradingCard.og ? '1' : '0',
            }
          : {}),
        ...(download
          ? {
              'Content-Disposition':
                'attachment; filename="' +
                (spec.format === 'trading-card' ||
                spec.format === 'collector-card' ||
                spec.format === 'trophy-card'
                  ? shareFilename(spec)
                  : 'uglydex-' + spec.kind + '.png') +
                '"',
            }
          : {}),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    const status =
      message === 'RATE_LIMITED' || message === 'RENDER_BUSY'
        ? 429
        : e instanceof ZodError
          ? 400
          : 503;
    return new Response(
      status === 429
        ? 'Please try again shortly.'
        : message === 'TRADING_CARD_ARTWORK_UNAVAILABLE'
          ? 'Original artwork unavailable. Please retry.'
          : 'Share image unavailable.',
      {
        status,
        headers: {
          ...headers,
          ...(status === 429
            ? { 'Retry-After': message === 'RENDER_BUSY' ? '2' : '60' }
            : {}),
        },
      },
    );
  }
}
