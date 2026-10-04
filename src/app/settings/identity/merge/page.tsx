import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { pendingMergeRequest } from '@/server/collector-merge';
import { CollectorMergeConfirm } from '@/components/collector-merge-confirm';

export default async function MergeIdentity({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const collectorId = await requireCollector();
  const { request: requestId } = await searchParams;
  const request =
    requestId && /^[0-9a-f-]{36}$/i.test(requestId)
      ? await pendingMergeRequest(requestId, collectorId)
      : null;
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">ACCOUNT IDENTITY REVIEW</p>
        <h1>Review account merge.</h1>
      </section>
      {!request ? (
        <section className="panel">
          <p>
            This merge request expired or is not linked to your signed-in
            account.
          </p>
          <Link className="button" href="/connect">
            Return to connection settings
          </Link>
        </section>
      ) : (
        <section className="panel">
          <h2>Move both accounts into @{request.survivor.slug}</h2>
          <p>
            You proved a credential on each account moments ago. Confirming
            moves the other account’s verified wallets, Discord identities,
            activity, discoveries, ownership history, galleries, and preferences
            into this account. Derived XP and collection summaries will be
            recalculated.
          </p>
          <p>
            Galleries from the other account will become private. Both profiles
            will be made private and wallet, Discord, and $CHARM disclosures
            will be turned off. The other account’s sessions will be revoked,
            and its Collector record will remain as a private merge tombstone.
            You can change visibility again after the merge.
          </p>
          <p>
            This action cannot be undone from the app. Confirm only if both
            credentials belong to you.
          </p>
          <CollectorMergeConfirm requestId={request.id} />
        </section>
      )}
    </>
  );
}
