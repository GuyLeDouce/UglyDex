import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="page-heading">
      <p className="eyebrow">RECORD NOT FOUND</p>
      <h1>Lost in the Maw.</h1>
      <Link className="text-link" href="/">
        Find your way home →
      </Link>
    </section>
  );
}
