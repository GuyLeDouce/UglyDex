import { spawn } from 'node:child_process';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
async function run(name: string, args: string[] = []) {
  console.log(`Release check: ${name}`);
  const exit = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(
      npm,
      ['run', name, ...(args.length ? ['--', ...args] : [])],
      {
        stdio: 'inherit',
        shell: process.platform === 'win32',
        windowsHide: true,
      },
    );
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (exit !== 0) throw new Error('RELEASE_CHECK_FAILED');
}
try {
  for (const command of [
    'test',
    'lint',
    'format:check',
    'typecheck',
    'collections:verify',
    'build',
  ])
    await run(command);
  await run('test:db', ['--web', '--browser', '--catalog']);
  console.log(
    'PASS local release suite, fresh migrations and fixture privacy/collectible verification. Deployed preflight, smoke, restore and device evidence remain separate gates.',
  );
  if (process.argv.includes('--deployed')) {
    await run('production:preflight');
    await run('collectibles:verify');
    await run('production:smoke');
  }
} catch {
  console.error('RELEASE_CHECK_FAILED');
  process.exitCode = 1;
}
