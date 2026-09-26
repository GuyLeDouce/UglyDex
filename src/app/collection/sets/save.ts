'use server';
import { requireCollector } from '@/server/session';
import { saveFeaturedSets } from '@/server/dex';
import { revalidatePath } from 'next/cache';
export async function saveSets(_state: { message: string }, form: FormData) {
  const id = await requireCollector();
  try {
    await saveFeaturedSets(id, form.getAll('sets'));
    revalidatePath('/', 'layout');
    return { message: 'Featured sets saved.' };
  } catch {
    return {
      message:
        'Choose up to three currently completed sets. Wait for pending collection updates, then try again.',
    };
  }
}
