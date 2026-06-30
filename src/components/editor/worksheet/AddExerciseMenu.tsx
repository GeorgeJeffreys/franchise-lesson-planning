'use client';

import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

// The "+ Add exercise" affordance and its dropdown. Three visual variants share
// the same menu:
//   • `empty`   — the large teal button shown when the worksheet has no exercises;
//   • `another` — the smaller dashed "add another" button below the last block;
//   • `divider` — a thin teal line + "+ Add block" pill revealed on hover BETWEEN
//                 two blocks, so a block can be inserted at any index, not only
//                 appended.
// The menu's two items — Choose from resource bank / Create new — match the
// mockup copy exactly. Open state is owned by the parent (keyed by insertion
// index) so only one menu is open at a time and an outside click can close it.
//
// The dropdown is collision-aware: it opens downward by default but flips upward
// when it would clip past the bottom of the scrollable worksheet canvas, so it is
// always fully visible even when added near the bottom of the page.

function BankIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1F7A6C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B62A5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.5 7.5" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  );
}

const Menu = forwardRef<
  HTMLDivElement,
  { onChooseBank: () => void; onCreateNew: () => void; placement: 'down' | 'up' }
>(function Menu({ onChooseBank, onCreateNew, placement }, ref) {
  const t = useTranslations('worksheet');
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        // Collision-aware: open up or down so the menu is never clipped.
        ...(placement === 'up'
          ? { bottom: 'calc(100% + 8px)' }
          : { top: 'calc(100% + 8px)' }),
        left: '50%',
        transform: 'translateX(-50%)',
        width: 260,
        background: '#fff',
        border: '1px solid #E7DECF',
        borderRadius: 10,
        boxShadow: '0 16px 40px -16px rgba(40,30,20,0.55)',
        padding: 6,
        zIndex: 20,
      }}
    >
      <button
        type="button"
        onClick={onChooseBank}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 10,
          borderRadius: 8,
          cursor: 'pointer',
          width: '100%',
          textAlign: 'start',
          background: 'none',
          border: 'none',
          font: 'inherit',
        }}
        className="hover:bg-surface-subtle"
      >
        <span style={{ width: 30, height: 30, borderRadius: 8, background: '#E4F0ED', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BankIcon />
        </span>
        <span>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600 }}>{t('addExercise.chooseBank')}</span>
          <span style={{ display: 'block', fontSize: 10.5, color: '#8A8178', marginTop: 1 }}>{t('addExercise.chooseBankHint')}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onCreateNew}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 10,
          borderRadius: 8,
          cursor: 'pointer',
          width: '100%',
          textAlign: 'start',
          background: 'none',
          border: 'none',
          font: 'inherit',
        }}
        className="hover:bg-surface-subtle"
      >
        <span style={{ width: 30, height: 30, borderRadius: 8, background: '#FBF2F5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <PenIcon />
        </span>
        <span>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600 }}>{t('addExercise.createNew')}</span>
          <span style={{ display: 'block', fontSize: 10.5, color: '#8A8178', marginTop: 1 }}>{t('addExercise.createNewHint')}</span>
        </span>
      </button>
    </div>
  );
});

/**
 * Decide whether the open dropdown should hang below the trigger or flip above
 * it. Measured against the scrollable worksheet canvas (the element that would
 * actually clip it); falls back to the window. Runs in a layout effect so the
 * flip is applied before paint — no downward flash.
 */
function useMenuPlacement(
  open: boolean,
  triggerRef: React.RefObject<HTMLElement | null>,
  menuRef: React.RefObject<HTMLElement | null>,
): 'down' | 'up' {
  // Default to 'down'; a stale value while the menu is CLOSED is invisible, and on
  // the next open the layout effect re-measures before paint (no flash).
  const [placement, setPlacement] = useState<'down' | 'up'>('down');
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const tRect = trigger.getBoundingClientRect();
      const mRect = menu.getBoundingClientRect(); // on-screen (zoom-scaled) height
      const scroller = trigger.closest('.ws-canvas') as HTMLElement | null;
      const top = scroller ? scroller.getBoundingClientRect().top : 0;
      const bottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;
      const spaceBelow = bottom - tRect.bottom;
      const spaceAbove = tRect.top - top;
      const needed = mRect.height + 16; // menu height + the 8px gap + a little slack
      setPlacement(needed <= spaceBelow || spaceAbove <= spaceBelow ? 'down' : 'up');
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, triggerRef, menuRef]);
  return placement;
}

export function AddExerciseMenu({
  variant,
  open,
  onToggle,
  onChooseBank,
  onCreateNew,
}: {
  variant: 'empty' | 'another' | 'divider';
  open: boolean;
  onToggle: () => void;
  onChooseBank: () => void;
  onCreateNew: () => void;
}) {
  const t = useTranslations('worksheet');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const placement = useMenuPlacement(open, triggerRef, menuRef);
  const [hover, setHover] = useState(false);

  // ── Between-blocks divider ───────────────────────────────────────────────
  if (variant === 'divider') {
    const show = hover || open;
    return (
      <div
        // Stop the canvas-level "close menu" / deselect handler from firing.
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ position: 'relative', height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            insetInline: 0,
            height: 2,
            borderRadius: 2,
            background: show ? '#1F7A6C' : 'transparent',
            transition: 'background 120ms',
          }}
        />
        {show ? (
          <button
            ref={triggerRef}
            type="button"
            onClick={onToggle}
            title={t('addExercise.addBlock')}
            style={{
              position: 'relative',
              zIndex: 1,
              fontFamily: 'inherit',
              fontSize: 11.5,
              fontWeight: 600,
              color: '#fff',
              background: '#1F7A6C',
              border: 'none',
              padding: '4px 11px',
              borderRadius: 999,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: '0 4px 10px -4px rgba(31,122,108,0.6)',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t('addExercise.addBlock')}
          </button>
        ) : null}
        {open ? (
          <Menu ref={menuRef} onChooseBank={onChooseBank} onCreateNew={onCreateNew} placement={placement} />
        ) : null}
      </div>
    );
  }

  // ── Empty-state / append-at-end button ───────────────────────────────────
  const empty = variant === 'empty';
  return (
    <div
      style={{ position: 'relative', display: empty ? 'inline-block' : 'flex', justifyContent: 'center', marginTop: empty ? 0 : 4 }}
      // Stop the canvas-level "close menu" handler from immediately re-closing.
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        style={
          empty
            ? {
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                background: '#1F7A6C',
                border: 'none',
                padding: '10px 18px',
                borderRadius: 9,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: '0 6px 14px -6px rgba(31,122,108,0.5)',
              }
            : {
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                color: '#1F7A6C',
                background: '#E4F0ED',
                border: '1px dashed #9FCEC4',
                padding: '8px 14px',
                borderRadius: 9,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }
        }
      >
        <svg width={empty ? 14 : 12} height={empty ? 14 : 12} viewBox="0 0 24 24" fill="none" stroke={empty ? '#fff' : '#1F7A6C'} strokeWidth={empty ? 2.2 : 2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {t('addExercise.button')}
      </button>
      {open ? (
        <Menu ref={menuRef} onChooseBank={onChooseBank} onCreateNew={onCreateNew} placement={placement} />
      ) : null}
    </div>
  );
}
