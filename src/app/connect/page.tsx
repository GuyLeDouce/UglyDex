import { Connect } from '@/components/connect';
export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <section className="connect-layout">
      <div className="connect-panel">
        <p className="eyebrow">YOUR COLLECTION STARTS HERE</p>
        <h1>Enter the UglyDex.</h1>
        <p>
          Sign a message to prove your wallet belongs to you. No transaction. No
          gas.
        </p>
        <Connect
          initialMessage={
            error === 'IDENTITY_REVIEW_REQUIRED'
              ? 'This credential belongs to another Collector. Sign in again to the Collector you want to keep, then reconnect the other identity within five minutes.'
              : ''
          }
        />
        <small>One identity at a time. Your collection stays yours.</small>
      </div>
      <div className="connect-art" aria-hidden="true">
        <span className="connect-orbit orbit-one" />
        <span className="connect-orbit orbit-two" />
        <span className="connect-burst">✳</span>
        <span className="connect-lightning">ϟ</span>
        <span className="connect-art-label">FIELD GUIDE Nº 001</span>
      </div>
    </section>
  );
}
