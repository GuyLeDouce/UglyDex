import EmbeddedPostgres from 'embedded-postgres';
import { cp, mkdir, symlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Windows PostgreSQL backends reopen DLLs/shared files from the binary tree.
 * Keeping only cluster data off a removable worktree is therefore insufficient.
 * Copy the installed, pinned runtime into this run's owned disposable directory.
 * Never patch node_modules or change application connection deadlines.
 */
export async function fixturePostgres(
  directory: string,
): Promise<typeof EmbeddedPostgres> {
  if (process.platform !== 'win32') return EmbeddedPostgres;
  const modules = resolve(directory, 'runtime/node_modules');
  await mkdir(resolve(modules, '@embedded-postgres'), { recursive: true });
  const library = dirname(
    dirname(fileURLToPath(import.meta.resolve('embedded-postgres'))),
  );
  const native = dirname(
    dirname(
      fileURLToPath(import.meta.resolve('@embedded-postgres/windows-x64')),
    ),
  );
  await cp(library, resolve(modules, 'embedded-postgres'), { recursive: true });
  await cp(native, resolve(modules, '@embedded-postgres/windows-x64'), {
    recursive: true,
    dereference: true,
  });
  for (const dependency of ['pg', 'async-exit-hook']) {
    const entry = fileURLToPath(import.meta.resolve(dependency));
    // These package entrypoints live in lib/ or the package root respectively.
    const source =
      dependency === 'pg' ? dirname(dirname(entry)) : dirname(entry);
    await symlink(source, resolve(modules, dependency), 'junction');
  }
  const copied = await import(
    pathToFileURL(resolve(modules, 'embedded-postgres/dist/index.js')).href
  );
  return copied.default;
}
