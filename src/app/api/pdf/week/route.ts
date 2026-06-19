// GET /api/pdf/week?classId=...&week=YYYY-MM-DD
//
// Every plan for one class in a week (Mon–Fri), one per page, as a single inline
// PDF for batch printing. `week` may be any date in the target week; it is
// normalised to that week's Monday. Plans are loaded through the auth'd server
// client (RLS). Needs the Node runtime for react-pdf and per-request rendering.

import { createElement } from 'react';
import { WeekLessonPlansDocument } from '@/lib/pdf/LessonPlanDocument';
import { loadWeekPdfModels } from '@/lib/pdf/load';
import { pdfResponse } from '@/lib/pdf/render';
import { formatWeekRange, isValidISODate, mondayOf } from '@/lib/week';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get('classId');
  const week = searchParams.get('week');

  if (!classId) {
    return new Response('Missing required query param: classId', { status: 400 });
  }
  if (!week || !isValidISODate(week)) {
    return new Response('Missing or invalid query param: week (YYYY-MM-DD)', {
      status: 400,
    });
  }

  const monday = mondayOf(week);
  const weekLabel = formatWeekRange(monday);
  const models = await loadWeekPdfModels(classId, monday);

  return pdfResponse(
    createElement(WeekLessonPlansDocument, { models, weekLabel }),
    `lesson-plans-${classId}-${monday}.pdf`,
  );
}
