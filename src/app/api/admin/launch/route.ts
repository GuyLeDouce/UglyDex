import { adminActor } from '@/server/admin';
import { launchReport, launchText } from '@/server/launch';
export async function GET(request: Request) {
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex',
  };
  if (!(await adminActor()))
    return Response.json({ error: 'Not found' }, { status: 404, headers });
  const report = await launchReport();
  if (new URL(request.url).searchParams.get('format') === 'text')
    return new Response(launchText(report), {
      headers: {
        ...headers,
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="uglydex-launch.txt"',
      },
    });
  return Response.json(report, {
    headers: {
      ...headers,
      'Content-Disposition': 'attachment; filename="uglydex-launch.json"',
    },
  });
}
