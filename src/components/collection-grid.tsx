import { currentSession } from '@/server/auth';
import { collectorCardTokenIds } from '@/server/collector-card';
import { CollectionGrid as ClientCollectionGrid } from './collection';

export async function CollectionGrid(
  props: Omit<
    Parameters<typeof ClientCollectionGrid>[0],
    'collectorCardTokens' | 'viewerSignedIn'
  >,
) {
  const session = await currentSession();
  const collectorCardTokens = await collectorCardTokenIds(
    session?.collectorId,
    props.items.map((item) => item.tokenId),
  );
  return (
    <ClientCollectionGrid
      {...props}
      collectorCardTokens={collectorCardTokens}
      viewerSignedIn={!!session?.collectorId}
    />
  );
}
