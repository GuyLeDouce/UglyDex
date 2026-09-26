'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="page-heading">
      <h1>A strange interruption.</h1>
      <p>This record could not be opened.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
