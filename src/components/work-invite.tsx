'use client';
import { useState } from 'react';
export function WorkInvite({ issue }: { issue: () => Promise<string> }) {
  const [code, setCode] = useState('');
  return (
    <section>
      <h2>ChatGPT Work access</h2>
      <p>
        Give Work this single-use code at /work-login. It expires in ten minutes
        and grants one hour of admin access under a separate identity.
      </p>
      <button className="button" onClick={async () => setCode(await issue())}>
        Create Work code
      </button>
      {code && <output> {code}</output>}
    </section>
  );
}
