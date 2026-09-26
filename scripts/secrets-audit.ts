import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const git = (args: string[]) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 100_000_000,
    windowsHide: true,
  });
const findings: { path: string; code: string }[] = [];
function inspect(path: string, text: string) {
  if (
    /(^|\/)(\.env($|\.)|[^/]+\.(dump|backup|pem|p12|pfx)$)/i.test(path) &&
    !path.endsWith('.env.example')
  )
    findings.push({ path, code: 'SENSITIVE_FILE' });
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))
    findings.push({ path, code: 'PRIVATE_KEY' });
  if (/\b(?:ghp_|github_pat_|sk_live_)[A-Za-z0-9_]{20,}/.test(text))
    findings.push({ path, code: 'TOKEN_PATTERN' });
  const urls = text.match(/(?:postgres(?:ql)?|mysql):\/\/[^\s'"`<>]+/g) ?? [];
  for (const raw of urls)
    try {
      const u = new URL(raw);
      if (
        u.password &&
        !['localhost', '127.0.0.1', 'db', 'host'].includes(u.hostname) &&
        !raw.includes('${') &&
        !['test', 'password', 'pass', 'p'].includes(u.password)
      )
        findings.push({ path, code: 'CREDENTIAL_URL_REVIEW' });
    } catch {
      /* template, not a URL */
    }
}
const files = git(['ls-files', '--cached', '--others', '--exclude-standard'])
  .trim()
  .split('\n');
for (const file of files)
  if (existsSync(file)) inspect(file, readFileSync(file, 'utf8'));
let blobs = 0;
for (const line of git(['rev-list', '--all', '--objects']).trim().split('\n')) {
  const space = line.indexOf(' ');
  if (space < 0) continue;
  const id = line.slice(0, space),
    path = line.slice(space + 1);
  if (git(['cat-file', '-t', id]).trim() !== 'blob') continue;
  blobs++;
  inspect('history/' + path, git(['cat-file', 'blob', id]));
}
const unique = [...new Map(findings.map((f) => [f.path + f.code, f])).values()];
console.log(
  JSON.stringify(
    { files: files.length, historicalBlobs: blobs, findings: unique },
    null,
    2,
  ),
);
if (unique.length) process.exitCode = 1;
