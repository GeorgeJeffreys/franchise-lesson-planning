import { useLayoutEffect, useRef, useState } from 'react';

const MAX_FONT_SIZE = 19;
const MIN_FONT_SIZE = 12;
/** Step (px) by which we reduce font-size each iteration. */
const STEP = 0.5;
/** Maximum number of lines we allow before we keep shrinking. */
const MAX_LINES = 2;

/**
 * Returns a [containerRef, textRef, fontSize] tuple.
 *
 * - Attach `containerRef` to the element whose width should be measured
 *   (the title column `<div>`).
 * - Attach `textRef` to the element that renders the text.
 * - `fontSize` starts at MAX and is shrunk until the text fits in at most
 *   MAX_LINES lines with no horizontal overflow, or until MIN is reached.
 *
 * SSR / no-window: defaults to MAX so the first server render is sane.
 * A ResizeObserver on the CONTAINER (not the text) avoids feedback loops.
 */
export function useFitText(text: string): [
  React.RefObject<HTMLDivElement | null>,
  React.RefObject<HTMLDivElement | null>,
  number,
] {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(MAX_FONT_SIZE);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (!containerRef.current || !textRef.current) return;

    function measure() {
      const container = containerRef.current;
      const textEl = textRef.current;
      if (!container || !textEl) return;

      const containerWidth = container.offsetWidth;
      if (containerWidth === 0) return;

      let size = MAX_FONT_SIZE;

      while (size > MIN_FONT_SIZE) {
        textEl.style.fontSize = `${size}px`;

        // scrollWidth > clientWidth → horizontal overflow on the element itself.
        // We also check line count via scrollHeight / lineHeight.
        const lineHeight = size * 1.2; // matches lineHeight: 1.2 in JSX
        const lines = Math.round(textEl.scrollHeight / lineHeight);

        const hasHorizontalOverflow = textEl.scrollWidth > containerWidth;
        const tooManyLines = lines > MAX_LINES;

        if (!hasHorizontalOverflow && !tooManyLines) break;

        size = Math.max(MIN_FONT_SIZE, size - STEP);
      }

      setFontSize(size);
    }

    // Initial measurement
    measure();

    // Re-measure when the container resizes (e.g. zoom or layout shift).
    const ro = new ResizeObserver(measure);
    ro.observe(containerRef.current);

    return () => ro.disconnect();
    // Re-run when text changes too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return [containerRef, textRef, fontSize];
}
