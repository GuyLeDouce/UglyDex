import { z } from 'zod';
import { adminActor } from '@/server/admin';
import { requireOrigin, rateLimit } from '@/server/auth';
import { jsonBody } from '@/server/http';
import { appEnvironment } from '@/domain/deployment';
import { assertDeploymentBinding } from '@/server/deployment';
import { backfillHolders } from '@/server/collector-discovery';
import { db } from '@/server/db';

const input = z
  .object({
    after: z
      .string()
      .regex(/^(0x[0-9a-f]{40})?$/)
      .default(''),
    apply: z.boolean().default(false),
    confirmation: z.literal('POPULATE_STAGING_HOLDERS').optional(),
  })
  .strict();
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const actor = await adminActor();
    if (!actor)
      return Response.json(
        { error: 'Admin access required.' },
        { status: 403 },
      );
    const body = input.parse(await jsonBody(request, 1024));
    // UI confirmation replaces CLI OPS_CONFIRM, never the database binding.
    if (appEnvironment() !== 'staging')
      return Response.json(
        { error: 'This repair is available only in staging.' },
        { status: 403 },
      );
    await assertDeploymentBinding();
    if (body.apply && body.confirmation !== 'POPULATE_STAGING_HOLDERS')
      return Response.json(
        { error: 'Confirm the staging repair first.' },
        { status: 400 },
      );
    await rateLimit('holder-repair', actor, 300);
    if (body.apply)
      await db().operationalAudit.create({
        data: {
          actor,
          action: 'COLLECTOR_DISCOVERY_BATCH_REQUESTED',
          subject: 'staging',
          detail: { after: body.after, limit: 50 },
        },
      });
    const result = await backfillHolders({
      dryRun: !body.apply,
      after: body.after,
      limit: 50,
    });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      {
        error:
          'Repair stopped. Check admin access, staging database binding and request limits. The last completed cursor can be retried safely.',
      },
      { status: 400 },
    );
  }
}
