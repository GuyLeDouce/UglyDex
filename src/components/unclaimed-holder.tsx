import Link from 'next/link';
export function UnclaimedHolderNotice() {
  return (
    <section className="panel" aria-label="Unclaimed wallet status">
      <p className="eyebrow">UNVERIFIED SQUIG HOLDER</p>
      <h2>Wallet not claimed</h2>
      <p>
        The owner has not logged in and claimed this wallet. Public holdings,
        wallet history and set progress are tracked automatically.
      </p>
      <p>
        These are wallet-derived statistics, not a verified personal record.
        Linked wallets and Discord activity may be incomplete or unaligned.
        Historical ownership does not prove who controlled the wallet.
      </p>
      <p>
        Visible by default. The owner can claim this profile and turn public
        visibility off in settings.
      </p>
      <Link className="text-link" href="/connect">
        Claim this wallet →
      </Link>
    </section>
  );
}
