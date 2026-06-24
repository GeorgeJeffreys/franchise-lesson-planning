'use server';

// Server Action for inserting an image into a worksheet Free block. The file is
// uploaded to the same private 'resources' storage bucket the resource bank uses
// (migration 0008), under the signed-in user's own prefix, and a long-lived
// signed URL is returned for the tiptap image node's `src`.
//
// Runs as the signed-in user, so Storage RLS — not this wrapper — governs who may
// upload. The service-role key is never used here.

import { createClient } from '@/lib/supabase/server';

const STORAGE_BUCKET = 'resources';
// Worksheet images render inline for students and in the PDF, so the URL must
// outlive a normal session. Ten years is effectively permanent for this use.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;

export interface UploadWorksheetImageResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/** Build a per-user, collision-resistant object path for a worksheet image. */
function buildImagePath(userId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${userId}/worksheet/${crypto.randomUUID()}-${safe}`;
}

/**
 * Upload a worksheet image from the editor's FormData (`file`) and return a
 * signed URL to embed. Validates that the upload is an image and within a sane
 * size budget before touching storage.
 */
export async function uploadWorksheetImageAction(
  formData: FormData,
): Promise<UploadWorksheetImageResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose an image to insert.' };
  }
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'That file is not an image.' };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: 'Images must be 10 MB or smaller.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated.' };

  const path = buildImagePath(user.id, file.name);
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { data, error: signError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signError || !data) {
    // Roll back the orphaned object so we don't leak storage.
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    return { ok: false, error: signError?.message ?? 'Could not sign the image URL.' };
  }

  return { ok: true, url: data.signedUrl };
}
