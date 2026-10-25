import Link from 'next/link';
import { uglyUsers, collectorDirectory } from '@/server/community';
import { Artwork } from './artwork';

export async function UglyUsers({
  page = 1,
  path = '/',
  includeDiscovered = false,
}: {
  page?: number;
  path?: string;
  includeDiscovered?: boolean;
}) {
  const title = includeDiscovered ? 'Collectors' : 'UglyUsers';
  let result;
  try {
    result = await (includeDiscovered
      ? collectorDirectory(page)
      : uglyUsers(page));
  } catch {
    return (
      <section id="uglyusers" className="panel">
        <h2>{title}</h2>
        <p>Users are temporarily unavailable.</p>
      </section>
    );
  }
  return (
    <section
      id="uglyusers"
      className="ugly-users"
      aria-labelledby="ugly-users-title"
    >
      <div className="section-heading">
        <h2 id="ugly-users-title">{title}</h2>
      </div>
      <ul className="ugly-users-grid">
        {result.users.map((user) => (
          <li key={user.slug}>
            <Link href={'/collector/' + user.slug}>
              <Artwork src={user.avatar} alt="" avatar />
              <span>{user.displayName || user.slug}</span>
              {user.unclaimed && <small>Unverified Squig Holder</small>}
            </Link>
          </li>
        ))}
      </ul>
      {!result.users.length && (
        <p>Make your profile public to join the UglyUsers.</p>
      )}
      {result.pages > 1 && (
        <nav className="pagination" aria-label={`${title} pages`}>
          {result.page > 1 ? (
            <Link href={`${path}?usersPage=${result.page - 1}#uglyusers`}>
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span>
            Page {result.page} of {result.pages}
          </span>
          {result.page < result.pages ? (
            <Link href={`${path}?usersPage=${result.page + 1}#uglyusers`}>
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}
