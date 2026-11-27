import { RefObject, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Reference-counted background scroll lock & LIFO active dialog stack
let scrollLockCount = 0;
let savedBodyOverflow = '';
let savedHtmlOverflow = '';
const modalStack: symbol[] = [];

function acquireScrollLock(): void {
  if (scrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    savedHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
  scrollLockCount += 1;
}

function releaseScrollLock(): void {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
    document.documentElement.style.overflow = savedHtmlOverflow;
  }
}

/**
 * WCAG 2.2 Dialog Focus Trap:
 * - Reference-counted scroll lock (never leaves body/html permanently locked across stacked or rapid modal transitions)
 * - LIFO modal stack so Escape & Tab trapping apply only to the topmost dialog
 * - Saves previously focused trigger element and restores focus on close
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  active = true
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;

    const modalId = Symbol('wellbe-modal');
    modalStack.push(modalId);
    acquireScrollLock();

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Focus initial focusable element (or the dialog container itself) without scrolling background
    const raf = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const autoFocused = container.querySelector<HTMLElement>('[data-autofocus="true"]');
      if (autoFocused) {
        autoFocused.focus({ preventScroll: true });
        return;
      }
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length > 0) {
        focusables[0].focus({ preventScroll: true });
      } else {
        container.focus({ preventScroll: true });
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard trapping for the topmost modal on the stack
      if (modalStack[modalStack.length - 1] !== modalId) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);

      if (focusables.length === 0) {
        e.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        if (document.activeElement === last || !container.contains(document.activeElement)) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown, true);
      const idx = modalStack.lastIndexOf(modalId);
      if (idx !== -1) modalStack.splice(idx, 1);
      releaseScrollLock();
      if (
        previouslyFocused &&
        document.contains(previouslyFocused) &&
        !previouslyFocused.closest('[hidden], [inert]') &&
        previouslyFocused.offsetParent !== null
      ) {
        previouslyFocused.focus({ preventScroll: true });
      } else {
        const main = document.getElementById('main-content');
        main?.focus({ preventScroll: true });
      }
    };
  }, [containerRef, active]);
}
