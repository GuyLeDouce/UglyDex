import 'server-only';
import { z } from 'zod';
import { discordId, normalizeWallet } from '@/domain/validation';
import { readPage } from '../table';
import { tables } from '../registry';
const linkSchema = z.object({
  guild_id: discordId,
  discord_id: discordId,
  wallet_address: z.string().transform(normalizeWallet),
  verified: z.boolean(),
  created_at: z.coerce.date().nullable(),
  updated_at: z.coerce.date().nullable(),
});
export { linkSchema };
export async function getLinkedWalletsForDiscordUser(id: string) {
  discordId.parse(id);
  const guild = process.env.ECOSYSTEM_GUILD_ID;
  if (!guild) return { ok: false, reason: 'unconfigured' } as const;
  const result = await readPage(tables.links, undefined, {
    guild_id: discordId.parse(guild),
    discord_id: id,
    verified: true,
  });
  if (!result.ok) return result;
  try {
    return {
      ok: true,
      data: result.data.map((r) => linkSchema.parse(r)),
    } as const;
  } catch {
    return { ok: false, reason: 'invalid_data' } as const;
  }
}
// Return all matches. Never choose one conflicting Discord identity arbitrarily.
export async function getDiscordIdentitiesForWallet(address: string) {
  const wallet = normalizeWallet(address);
  const { readExternal } = await import('../read-only');
  const guild = process.env.ECOSYSTEM_GUILD_ID;
  if (!guild) return { ok: false, reason: 'unconfigured' } as const;
  return readExternal<{ discord_id: string; guild_id: string }>(
    'links',
    'SELECT discord_id, guild_id FROM public.wallet_links WHERE lower(wallet_address) = $1 AND guild_id = $2 AND verified = true ORDER BY discord_id LIMIT 200',
    [wallet, discordId.parse(guild)],
  );
}
