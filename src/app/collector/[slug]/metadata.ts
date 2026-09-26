import { shareMetadata } from '@/server/sharing';
export async function publicCollectorMetadata(slug: string) {
  return shareMetadata({ kind: 'collector', entity: slug });
}
