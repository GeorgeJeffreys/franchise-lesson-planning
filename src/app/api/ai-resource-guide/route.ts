import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';

/**
 * POST /api/ai-resource-guide
 *
 * Admin-only. Uploads a new version of the AI resource guide — the
 * admin-authored best-practice text that steers the resource generator (Aya).
 * Accepts a plain-text `.md` or `.txt` file as multipart/form-data (`file`
 * field), reads it server-side, and INSERTS a new `ai_resource_guide` row
 * (`uploaded_by` = the caller). Each upload is a new immutable version; the
 * latest is active. No .docx parsing in the MVP (follow-up).
 *
 * Auth: a signed-in admin only. Non-admins get 403; the table's RLS
 * (`ai_resource_guide_insert_admin`) is the backstop.
 */

/** Max accepted guide size. The guide is composed into every generate call, so a
 *  runaway upload would bloat the prompt; 256 KB is generous for prose. */
const MAX_BYTES = 256 * 1024;

/** Accepted plain-text extensions (no .docx parsing in the MVP). */
const ALLOWED_EXTENSIONS = ['.md', '.txt'] as const;

export async function POST(request: NextRequest) {
  // ── Authorise: signed-in admin only ──
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  if (profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only administrators can update the AI resource guide.' },
      { status: 403 },
    );
  }

  // ── Read the uploaded file (multipart/form-data, `file` field) ──
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Send the guide as multipart/form-data with a "file" field.' },
      { status: 400 },
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const candidate = form.get('file');
    if (candidate instanceof File) file = candidate;
  } catch {
    return NextResponse.json({ error: 'Could not read the uploaded file.' }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return NextResponse.json(
      { error: `Unsupported file type. Upload a ${ALLOWED_EXTENSIONS.join(' or ')} file.` },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File is too large (max ${Math.round(MAX_BYTES / 1024)} KB).` },
      { status: 400 },
    );
  }

  const content = (await file.text()).trim();
  if (content.length === 0) {
    return NextResponse.json({ error: 'The guide file is empty.' }, { status: 400 });
  }

  // ── Insert a new version (RLS enforces admin + uploaded_by = caller) ──
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ai_resource_guide')
    .insert({ content, uploaded_by: profile.id })
    .select('id, created_at')
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Could not save the guide. Please try again.' },
      { status: 500 },
    );
  }

  const row = data as { id: string; created_at: string };
  return NextResponse.json({ id: row.id, created_at: row.created_at }, { status: 201 });
}
