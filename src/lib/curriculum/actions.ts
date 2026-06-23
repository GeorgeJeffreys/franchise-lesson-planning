'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getMyMemberships } from '@/lib/auth';
import { importCurriculumWorkbook } from '@/lib/curriculum/import';

// In-app "Refresh now" / manual upload. This is the UI path of the import — it
// re-checks authorisation server-side (admin, or a member of the subject) and then
// runs the same import as the n8n endpoint, with source 'upload'. The visible
// controls are a separate design slice; this action + the minimal admin control
// exist to exercise the path end-to-end.

export interface CurriculumImportState {
  ok: boolean;
  message: string;
}

export async function importCurriculumAction(
  _prev: CurriculumImportState | null,
  formData: FormData,
): Promise<CurriculumImportState> {
  const subjectCode = String(formData.get('subject_code') ?? '').trim();
  const file = formData.get('file');

  if (!subjectCode) return { ok: false, message: 'Choose a subject.' };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choose an .xlsx file to upload.' };
  }

  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, message: 'You must be signed in.' };

  if (profile.role !== 'admin') {
    const supabase = await createClient();
    const { data } = await supabase
      .from('subjects')
      .select('id')
      .eq('code', subjectCode)
      .maybeSingle();
    const subjectId = (data as { id: string } | null)?.id;
    const memberships = await getMyMemberships();
    if (!subjectId || !memberships.some((m) => m.subjectId === subjectId)) {
      return { ok: false, message: `You can't refresh curriculum for "${subjectCode}".` };
    }
  }

  const buffer = await file.arrayBuffer();
  const result = await importCurriculumWorkbook({ buffer, subjectCode, source: 'upload' });
  if (result.status === 'error') {
    return { ok: false, message: result.error ?? 'Import failed.' };
  }
  return {
    ok: true,
    message:
      `Synced ${result.rowsUpserted} lessons for "${subjectCode}" · ` +
      `${result.unresolved} without a daily outcome · ${result.rowsDeactivated} deactivated.`,
  };
}
