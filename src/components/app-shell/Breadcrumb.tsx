import Link from "next/link";

/**
 * A minimal back-link breadcrumb: a link to the Weekly Overview ("/") followed
 * by the current screen's context (e.g. "Year 1 · Group A · Mon 15 Jun"). Sits
 * above the page body inside the app shell.
 */
export function Breadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-[13px] text-neutral-600">
      <Link
        href="/"
        className="font-medium text-teal transition-colors hover:text-[#1a6a5d] hover:underline"
      >
        Weekly Overview
      </Link>
      <span aria-hidden="true" className="text-neutral-300">›</span>
      <span className="text-neutral-700">{current}</span>
    </nav>
  );
}
