import Link from 'next/link';
import type { ReactNode } from 'react';

/** A section of the field guide, deliberately without an enclosing panel. */
export function EditorialSection({
  number,
  eyebrow,
  title,
  href,
  link,
  children,
}: {
  number: string;
  eyebrow: string;
  title: string;
  href?: string;
  link?: string;
  children: ReactNode;
}) {
  return (
    <section className="editorial-section">
      <div className="editorial-heading">
        <span className="section-index" aria-hidden>
          {number}
        </span>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {href && (
          <Link className="text-link" href={href}>
            {link} <span aria-hidden>↗</span>
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
