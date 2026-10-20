import Link from 'next/link';
import { uglyUsers } from '@/server/community';
import { Artwork } from './artwork';

export async function UglyUsers({ page = 1 }: { page?: number }) {
  let result;
  try {
    result = await uglyUsers(page);
  } catch {
    return (
      <section id="uglyusers" className="panel">
        <h2>UglyUsers</h2>
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
        <h2 id="ugly-users-title">UglyUsers</h2>
      </div>
      <ul className="ugly-users-grid">
        {result.users.map((user) => (
          <li key={user.slug}>
            <Link href={'/collector/' + user.slug}>
              <Artwork src={user.avatar} alt="" avatar />
              <span>{user.displayName || user.slug}</span>
            </Link>
          </li>
        ))}
      </ul>
      {!result.users.length && (
        <p>Make your profile public to join the UglyUsers.</p>
      )}
      {result.pages > 1 && (
        <nav className="pagination" aria-label="UglyUsers pages">
          {result.page > 1 ? (
            <Link href={`/?usersPage=${result.page - 1}#uglyusers`}>
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span>
            Page {result.page} of {result.pages}
          </span>
          {result.page < result.pages ? (
            <Link href={`/?usersPage=${result.page + 1}#uglyusers`}>
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
