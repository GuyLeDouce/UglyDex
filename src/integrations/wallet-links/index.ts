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
  const { readSourceQuery } = await import('../queries');
  const guild = process.env.ECOSYSTEM_GUILD_ID;
  if (!guild) return { ok: false, reason: 'unconfigured' } as const;
  return readSourceQuery<{ discord_id: string; guild_id: string }>(
    'walletIdentity',
    [wallet, discordId.parse(guild)],
  );
}

// Resolve only a verified source mapping for the exact Discord + authenticated
// wallet pair already attached to one UglyDex Collector. The DRIP member ID is
// private server-side data and is never returned to a client.
export async function getDripMemberMappings(
  pairs: { discordId: string; walletAddress: string }[],
) {
  const requested = pairs.map((pair) => ({
    discord_id: discordId.parse(pair.discordId),
    wallet_address: normalizeWallet(pair.walletAddress),
  }));
  if (!requested.length) return { ok: true, data: [] } as const;
  if (requested.length > 25) throw new Error('DRIP_IDENTITY_BATCH_LIMIT');
  const { readSourceQuery } = await import('../queries');
  const result = await readSourceQuery<{
    discord_id: string;
    wallet_address: string;
    drip_member_id: string;
  }>('dripIdentity', [JSON.stringify(requested)]);
  if (!result.ok) return result;
  try {
    return {
      ok: true,
      data: result.data.map((row) => ({
        discordId: discordId.parse(row.discord_id),
        walletAddress: normalizeWallet(row.wallet_address),
        dripMemberId: z
          .string()
          .regex(/^[a-f0-9]{24}$/i)
          .parse(row.drip_member_id),
      })),
    } as const;
  } catch {
    return { ok: false, reason: 'invalid_data' } as const;
  }
}
