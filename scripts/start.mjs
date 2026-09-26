import 'dotenv/config';
import { spawn } from 'node:child_process';
if (!process.env.DATABASE_URL) {
  console.error(
    'UglyDex startup failed: DATABASE_URL is required (UglyDex-owned PostgreSQL).',
  );
  process.exit(1);
}
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('Invalid PORT');
const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'start',
    '-H',
    '0.0.0.0',
    '-p',
    String(port),
  ],
  { stdio: 'inherit', env: process.env },
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
