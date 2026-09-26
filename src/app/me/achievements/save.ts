'use server';
import { requireCollector } from '@/server/session';
import { updateProgressionPresentation } from '@/server/progression-preferences';
import { revalidatePath } from 'next/cache';
export async function savePresentation(
  _previous: { message: string },
  form: FormData,
) {
  const id = await requireCollector();
  try {
    await updateProgressionPresentation(id, {
      title: form.get('title') ?? '',
      badges: form.getAll('badges'),
    });
  } catch {
    return {
      message:
        'Choose up to four currently earned badges and one unlocked title. If history is updating, try again shortly.',
    };
  }
  revalidatePath('/me');
  revalidatePath('/me/achievements');
  revalidatePath('/collector', 'layout');
  return { message: 'Your title and badges are saved.' };
}
