import { Connect } from '@/components/connect';
export default function ConnectPage() {
  return (
    <section className="page-heading">
      <p className="eyebrow">YOUR COLLECTION STARTS HERE</p>
      <h1>Enter the UglyDex.</h1>
      <p>
        Sign a message to prove your wallet belongs to you. No transaction. No
        gas.
      </p>
      <Connect />
    </section>
  );
}
