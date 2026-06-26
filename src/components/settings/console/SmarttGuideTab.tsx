'use client';

import { useTranslations } from 'next-intl';
import type { SmarttGuideVersion } from '@/lib/console';
import { GuideUploadCard } from './GuideUploadCard';

/**
 * Admin "SMARTT objective guide" sub-section. The admin uploads Kadria's
 * objective-checker steering; each upload POSTs a new immutable version to
 * `/api/smartt-objective-guide` (.md / .txt verbatim, or .docx converted to
 * markdown), then refreshes. Upload-only — no inline editing.
 *
 * Presentation is the shared {@link GuideUploadCard}, consistent with the AI
 * resource guide and the curriculum upload. It shows the active version's filename
 * + upload date (no text preview); when none exists the checker uses a built-in
 * default.
 */
export function SmarttGuideTab({ active }: { active: SmarttGuideVersion | null }) {
  const t = useTranslations('settings');
  return (
    <GuideUploadCard
      title={t('smarttGuide.title')}
      endpoint="/api/smartt-objective-guide"
      active={active}
      successMessage={t('smarttGuide.successMessage')}
      uploadingLabel={t('smarttGuide.uploadingLabel')}
    />
  );
}
