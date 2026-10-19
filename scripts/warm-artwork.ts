import 'dotenv/config';
import { warmArtwork } from '../src/server/artwork-store';
try {
  const result = await warmArtwork();
  console.log(JSON.stringify({ event: 'artwork.import.finished', ...result }));
  if (!result.complete) process.exitCode = 1;
} catch (error) {
  // Do not print endpoints, credentials, or complete SDK error objects.
  console.error(
    JSON.stringify({
      event: 'artwork.import.failed',
      reason: error instanceof Error ? error.name : 'Error',
    }),
  );
  process.exitCode = 1;
}
