'use client';

import { useActionState } from 'react';
import { importCurriculumAction, type CurriculumImportState } from '@/lib/curriculum/actions';

/**
 * Minimal admin control to upload a subject's curriculum workbook and sync it into
 * Supabase (the in-app "Refresh now"/upload path). This is a bare trigger to test
 * the import end-to-end; the designed Curriculum console tab is a separate slice.
 */
export function CurriculumImport({ defaultSubjectCode = 'english' }: { defaultSubjectCode?: string }) {
  const [state, formAction, pending] = useActionState<CurriculumImportState | null, FormData>(
    importCurriculumAction,
    null,
  );

  return (
    <form action={formAction} className="mt-6 rounded-[11px] border border-neutral-200 p-4">
      <h2 className="text-[15px] font-semibold text-neutral-900">Curriculum import</h2>
      <p className="mt-1 text-[13px] text-neutral-600">
        Upload the curriculum Excel for a subject to refresh it. Changes appear without a redeploy.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[13px] text-neutral-700">
          Subject code
          <input
            name="subject_code"
            defaultValue={defaultSubjectCode}
            className="rounded-md border border-neutral-300 px-2 py-1 text-[14px]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-neutral-700">
          Workbook (.xlsx)
          <input
            name="file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="text-[13px]"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Syncing…' : 'Refresh now'}
        </button>
      </div>

      {state ? (
        <p
          className={`mt-3 text-[13px] ${state.ok ? 'text-green-700' : 'text-red-700'}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
