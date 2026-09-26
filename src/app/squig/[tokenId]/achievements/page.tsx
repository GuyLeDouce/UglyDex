import { db } from '@/server/db';
import { notFound } from 'next/navigation';
import { Progression } from '@/components/progression';
import { SQUIGS_CONTRACT } from '@/domain/validation';
export default async function Page({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;
  if (!/^[1-9]\d{0,3}$/.test(tokenId) || Number(tokenId) > 4444) notFound();
  const s = await db().squig.findUnique({
    where: {
      chainId_contractAddress_tokenId: {
        chainId: 1,
        contractAddress: SQUIGS_CONTRACT,
        tokenId: Number(tokenId),
      },
    },
  });
  if (!s) notFound();
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">HISTORY BECOMES CHARACTER</p>
        <h1>Squig #{tokenId}</h1>
      </section>
      <Progression
        subject="SQUIG"
        id={s.id}
        path={`/squig/${tokenId}/achievements`}
        public
        full
      />
    </>
  );
}
