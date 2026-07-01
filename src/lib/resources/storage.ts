// Client-safe storage constants + helpers for the private 'resources' bucket.
// This module has NO server imports, so both the browser UploadModal (which now
// uploads file bytes DIRECTLY to Supabase Storage) and the server-side data
// layer can share the bucket name, the size cap and the object-path convention.
//
// Direct browser→Storage upload keeps large files off the Next server: only the
// resulting object path (metadata) travels through the Server Action, so uploads
// are no longer bounded by Next's ~1 MB Server Action body limit (nor Vercel's
// ~4.5 MB platform request cap).

/** The private storage bucket that backs file-based resources. */
export const RESOURCE_BUCKET = 'resources';

/**
 * Client-side upload size cap. Uploading a file larger than this surfaces an
 * inline error in the modal BEFORE any network round-trip, so an oversized file
 * can never strand a tester on a dead page. Matches Supabase's default per-file
 * limit; keep it in sync with any `file_size_limit` set on the bucket.
 */
export const MAX_RESOURCE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_RESOURCE_MB = MAX_RESOURCE_BYTES / (1024 * 1024);

/**
 * A unique object path for an upload, keyed by the uploader. The `${userId}/`
 * prefix keeps a user's objects grouped; the random UUID guarantees uniqueness
 * so `upsert:false` never collides. The storage RLS INSERT policy authorises on
 * `owner = auth.uid()` (set automatically by Storage), not on this path.
 */
export function buildResourceStoragePath(userId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${userId}/${crypto.randomUUID()}-${safe}`;
}
