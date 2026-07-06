'use client';

// The Search tab is owned by a separate in-flight slice. This is a deliberately inert
// SLOT — it holds the tab's place and shows a disabled search field + "coming soon"
// empty state, so the tab bar is complete without duplicating that work here.

import { useTranslations } from 'next-intl';

export function SearchSlot({ subjectName }: { subjectName: string }) {
  const t = useTranslations('curriculum');
  return (
    <div>
      <div className="flex flex-wrap items-start gap-[12px] px-[26px] pt-[20px]">
        <div
          aria-disabled="true"
          className="flex flex-1 cursor-not-allowed items-center gap-[9px] rounded-[11px] border-[1.5px] border-[#DDD4C8] bg-surface px-[14px] py-[11px] opacity-70"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#A79E94" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <span className="text-[15px] text-[#A79E94]">{t('search.placeholder')}</span>
          <span className="ms-auto text-[12px] text-[#C7BFB5]">{subjectName}</span>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-[14px] px-[26px] pb-[90px] pt-[60px]">
        <span className="inline-flex size-[60px] items-center justify-center rounded-[17px] bg-[#F3EEE6]">
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#C7BFB5" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </span>
        <span className="text-[14px] text-[#A79E94]">{t('search.comingSoon')}</span>
      </div>
    </div>
  );
}
