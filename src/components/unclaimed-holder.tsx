import Link from 'next/link';

export function UnclaimedHolderNotice() {
  return (
    <section className="panel" aria-label="Unclaimed wallet status">
      <p className="eyebrow">UNVERIFIED SQUIG HOLDER</p>
      <h2>Wallet not claimed</h2>
      <p>
        This profile was created from public blockchain ownership. No owner has
        verified and claimed it on UglyDex.
      </p>
      <p>
        Indexed holdings describe this wallet only. Personal discoveries, sets,
        achievements and linked Discord activity are not a verified or complete
        collector record. These statistics may not align until the owner
        verifies their wallets and the Field Guide finishes updating.
      </p>
      <p>
        Historical wallet activity does not prove who controlled the wallet at
        the time. Claiming does not automatically attribute its entire past.
      </p>
      <Link className="button" href="/connect">
        Verify your wallet to claim this profile
      </Link>
    </section>
  );
}
