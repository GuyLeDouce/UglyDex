import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';

// Deliberately supports only the headings, paragraphs and bold text used by
// our checked-in policies. React escapes all policy text; no raw HTML executes.
function inline(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      part.startsWith('**') ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}

export async function LegalPolicy({
  file,
}: {
  file: 'PRIVACY.md' | 'TERMS.md';
}) {
  const source = await readFile(path.join(process.cwd(), file), 'utf8');
  return (
    <article className="legal-policy">
      <aside className="legal-draft" role="note">
        Draft for review — not yet effective. Operator details and publication
        checks remain outstanding. These drafts do not establish legal
        compliance or Discord verification.
      </aside>
      {source
        .trim()
        .split(/\r?\n\s*\r?\n/)
        .map((block, index) => {
          if (block.startsWith('# '))
            return <h1 key={index}>{block.slice(2)}</h1>;
          if (block.startsWith('## ')) {
            const [heading, ...body] = block.split(/\r?\n/);
            return (
              <section key={index}>
                <h2>{heading.slice(3)}</h2>
                {body.length > 0 && <p>{inline(body.join('\n'))}</p>}
              </section>
            );
          }
          return <p key={index}>{inline(block)}</p>;
        })}
      <nav aria-label="Legal policies">
        <Link href="/privacy">Privacy Policy</Link>
        {' · '}
        <Link href="/terms">Terms of Service</Link>
      </nav>
    </article>
  );
}
