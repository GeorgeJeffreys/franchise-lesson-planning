// GET /api/pdf/plan/[id] — one lesson plan as an inline PDF.
//
// The plan is loaded through the auth'd server client (RLS), so a user can only
// export a plan they may see; anything else 404s. Needs the Node runtime for
// react-pdf's `renderToBuffer`, and per-request rendering (no caching).

import { createElement } from 'react';
import { LessonPlanDocument } from '@/lib/pdf/LessonPlanDocument';
import { loadPlanPdfModel } from '@/lib/pdf/load';
import { pdfResponse } from '@/lib/pdf/render';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const model = await loadPlanPdfModel(id);
  if (!model) {
    return new Response('Lesson plan not found.', { status: 404 });
  }

  return pdfResponse(
    createElement(LessonPlanDocument, { model }),
    `lesson-plan-${id}.pdf`,
  );
}
