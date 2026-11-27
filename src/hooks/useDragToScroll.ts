import { useEffect, useRef } from 'react';

/* ==========================================================================
   WELLBE+ Native-Feeling Mouse Click-and-Drag Swipe-to-Scroll Engine
   - Mouse-only activation (pointerType === 'mouse' && button === 0)
   - 7px drag deadzone + capture-phase accidental click suppression
   - 1:1 rAF-batched scroll tracking + 90ms velocity momentum coasting (0.935 decay)
   - Axis-locked horizontal panning & discrete carousel swipe coordination
   - Nested scroll resolution respecting modal/dialog boundaries
   - Full Reduce Motion compliance & safe teardown on blur / outside release
   ========================================================================== */

export interface CarouselRegistration {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  previewEl?: HTMLElement | null;
  swipeThreshold?: number;
}

export interface UseDragToScrollOptions {
  /** Scroll axis for this container (default 'y') */
  axis?: 'y' | 'x' | 'both' | 'carousel';
  /** Hide default scrollbars visually while preserving wheel/trackpad/keyboard scroll */
  hideScrollbar?: boolean;
  /** Apply neutral grab cursor on desktop hover */
  grabCursor?: boolean;
  /** Carousel swipe handlers (used when axis === 'carousel') */
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Optional inner card element to visually translate during horizontal carousel drag */
  previewRef?: React.RefObject<HTMLElement | null>;
  /** Horizontal distance in px to trigger a discrete carousel slide (default 44) */
  swipeThreshold?: number;
}

export interface GlobalDragToScrollOptions {
  /** When true (or OS prefers-reduced-motion), keeps 1:1 drag active but disables momentum coasting & elastic overscroll */
  reduceMotion: boolean;
  /** Whenever this key changes (e.g., tab switch or modal toggle), any active momentum coasting cancels immediately */
  cancelKey?: string | number;
  /** Optional outer content stage for subtle damped bottom elastic overscroll ('whiplash back-pull'), separate from per-card transforms */
  overscrollTargetRef?: React.RefObject<HTMLElement | null>;
}

// Registry linking discrete horizontal carousel elements (e.g., Quick Reset Deck) to their swipe callbacks
const carouselRegistry = new WeakMap<HTMLElement, CarouselRegistration>();

const DRAG_THRESHOLD_PX = 7;
const VELOCITY_WINDOW_MS = 90;
const FRICTION_PER_FRAME = 0.935;
const MIN_VELOCITY_PX = 0.5;
const MAX_VELOCITY_PX = 54;
const IDLE_RELEASE_MS = 75;

const EXCLUDED_SELECTOR =
  'input, textarea, select, option, [contenteditable="true"], [contenteditable=""], [data-no-drag-scroll="true"], [role="slider"], .select-text, .recharts-wrapper';

const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

function isExcludedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(EXCLUDED_SELECTOR));
}

function isReduceMotionActive(settingReduceMotion: boolean): boolean {
  if (settingReduceMotion) return true;
  if (typeof window === 'undefined') return false;
  const html = document.documentElement;
  const attr = html.getAttribute('data-reduce-motion');
  if (attr === 'true') return true;
  if (attr === 'false') return false;
  if (html.classList.contains('reduce-motion')) return true;
  if (html.classList.contains('allow-motion')) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getDocumentScroller(): HTMLElement {
  return (document.scrollingElement as HTMLElement) || document.documentElement;
}

function isModalBoundary(el: HTMLElement): boolean {
  return (
    el.getAttribute('role') === 'dialog' ||
    el.getAttribute('aria-modal') === 'true'
  );
}

interface ResolvedTargets {
  vertical: HTMLElement | null;
  horizontal: HTMLElement | null;
  carousel: HTMLElement | null;
}

/**
 * Walks up from the pointer target to resolve:
 * 1. Nearest vertically scrollable ancestor (never escaping an open dialog onto a locked background page)
 * 2. Nearest horizontally scrollable ancestor
 * 3. Nearest registered discrete carousel (e.g., Quick Reset Deck)
 */
function resolveScrollTargets(startEl: Element | null): ResolvedTargets {
  let vertical: HTMLElement | null = null;
  let horizontal: HTMLElement | null = null;
  let carousel: HTMLElement | null = null;
  let insideModal = false;

  let cur: HTMLElement | null =
    startEl instanceof HTMLElement
      ? startEl
      : startEl?.parentElement ?? null;

  while (cur && cur !== document.body && cur !== document.documentElement) {
    if (!carousel && carouselRegistry.has(cur)) {
      carousel = cur;
    }
    if (!horizontal || !vertical) {
      const style = window.getComputedStyle(cur);
      if (!horizontal) {
        const ox = style.overflowX;
        if (
          (ox === 'auto' || ox === 'scroll' || ox === 'overlay') &&
          cur.scrollWidth > cur.clientWidth + 1
        ) {
          horizontal = cur;
        }
      }
      if (!vertical) {
        const oy = style.overflowY;
        if (
          (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
          cur.scrollHeight > cur.clientHeight + 1
        ) {
          vertical = cur;
        }
      }
    }
    if (isModalBoundary(cur)) {
      insideModal = true;
      break;
    }
    cur = cur.parentElement;
  }

  // Only fall back to the document scroller when NOT inside a modal overlay
  if (!vertical && !insideModal) {
    const bodyOverflow = window.getComputedStyle(document.body).overflowY;
    if (bodyOverflow !== 'hidden') {
      const docScroller = getDocumentScroller();
      if (docScroller.scrollHeight > docScroller.clientHeight + 1) {
        vertical = docScroller;
      }
    }
  }

  return { vertical, horizontal, carousel };
}

/**
 * Reusable container hook to opt any scrollable view, modal, feed, horizontal strip,
 * or swipe carousel into WELLBE+'s drag-to-scroll styling and gesture coordination.
 */
export function useDragToScroll<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  options: UseDragToScrollOptions = {}
) {
  const {
    axis = 'y',
    hideScrollbar = true,
    grabCursor = true,
    onSwipeLeft,
    onSwipeRight,
    previewRef,
    swipeThreshold = 44,
  } = options;

  const callbacksRef = useRef({ onSwipeLeft, onSwipeRight, swipeThreshold });
  callbacksRef.current = { onSwipeLeft, onSwipeRight, swipeThreshold };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.setAttribute('data-drag-scroll-axis', axis);
    if (grabCursor) el.classList.add('drag-scroll-surface');
    if (hideScrollbar) el.classList.add('hide-scrollbar');

    if (axis === 'carousel') {
      el.setAttribute('data-drag-carousel', 'true');
      carouselRegistry.set(el, {
        onSwipeLeft: () => callbacksRef.current.onSwipeLeft?.(),
        onSwipeRight: () => callbacksRef.current.onSwipeRight?.(),
        get previewEl() {
          return previewRef?.current ?? el;
        },
        get swipeThreshold() {
          return callbacksRef.current.swipeThreshold;
        },
      });
    }

    return () => {
      el.removeAttribute('data-drag-scroll-axis');
      if (grabCursor) el.classList.remove('drag-scroll-surface');
      if (hideScrollbar) el.classList.remove('hide-scrollbar');
      if (axis === 'carousel') {
        el.removeAttribute('data-drag-carousel');
        carouselRegistry.delete(el);
      }
    };
  }, [ref, axis, hideScrollbar, grabCursor, previewRef]);
}

interface VelocitySample {
  pos: number;
  time: number;
}

/**
 * Global coordinated click-and-drag swipe-to-scroll controller.
 * Mount once at the application root so every page, feed, horizontal chip row,
 * carousel, and modal shares a single zero-thrashing 60fps pointer & momentum engine.
 */
export function useGlobalDragToScroll({
  reduceMotion,
  cancelKey,
  overscrollTargetRef,
}: GlobalDragToScrollOptions) {
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;
  const overscrollRef = useRef(overscrollTargetRef);
  overscrollRef.current = overscrollTargetRef;

  const cancelMomentumFnRef = useRef<() => void>(() => {});

  // Cancel any active coasting immediately on tab switches or overlay transitions
  useEffect(() => {
    cancelMomentumFnRef.current();
  }, [cancelKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isDown = false;
    let isDragging = false;
    let lockedAxis: 'y' | 'x' | 'carousel-x' | null = null;

    let startX = 0;
    let startY = 0;
    let lastClientX = 0;
    let lastClientY = 0;
    let lastMoveTime = 0;

    let startScrollTop = 0;
    let startScrollLeft = 0;
    let cachedMaxScrollY = 0;
    let cachedCanRubberBand = false;

    let targets: ResolvedTargets = { vertical: null, horizontal: null, carousel: null };
    let activeCarousel: CarouselRegistration | null = null;

    let samples: VelocitySample[] = [];
    let moveRafId: number | null = null;
    let momentumRafId: number | null = null;

    let suppressNextClick = false;
    let suppressClearTimer: number | null = null;
    let activeOverscrollPx = 0;
    let overscrollClearTimer: number | null = null;
    let carouselResetTimer: number | null = null;

    const clearSuppressFlag = () => {
      suppressNextClick = false;
      if (suppressClearTimer !== null) {
        window.clearTimeout(suppressClearTimer);
        suppressClearTimer = null;
      }
    };

    const armClickSuppression = () => {
      suppressNextClick = true;
      if (suppressClearTimer !== null) window.clearTimeout(suppressClearTimer);
      // Trailing browser click after pointerup dispatches synchronously in the same task/frame;
      // 45ms catches it cleanly without ever swallowing a fast subsequent tap.
      suppressClearTimer = window.setTimeout(() => {
        suppressNextClick = false;
        suppressClearTimer = null;
      }, 45);
    };

    const resetBottomOverscroll = (animate: boolean) => {
      const stage = overscrollRef.current?.current;
      if (overscrollClearTimer !== null) {
        window.clearTimeout(overscrollClearTimer);
        overscrollClearTimer = null;
      }
      if (!stage) {
        activeOverscrollPx = 0;
        return;
      }
      if (activeOverscrollPx <= 0.1 && !stage.style.transform) {
        activeOverscrollPx = 0;
        return;
      }
      activeOverscrollPx = 0;
      if (!animate || isReduceMotionActive(reduceMotionRef.current)) {
        stage.style.willChange = '';
        stage.style.transition = '';
        stage.style.transform = '';
        return;
      }
      stage.style.transition = 'transform 340ms cubic-bezier(0.22, 1.18, 0.36, 1)';
      stage.style.transform = 'translate3d(0, 0, 0)';
      overscrollClearTimer = window.setTimeout(() => {
        if (stage) {
          stage.style.willChange = '';
          stage.style.transition = '';
          stage.style.transform = '';
        }
        overscrollClearTimer = null;
      }, 360);
    };

    const stopMomentum = () => {
      if (momentumRafId !== null) {
        window.cancelAnimationFrame(momentumRafId);
        momentumRafId = null;
      }
      resetBottomOverscroll(false);
    };

    const stopMoveRaf = () => {
      if (moveRafId !== null) {
        window.cancelAnimationFrame(moveRafId);
        moveRafId = null;
      }
    };

    const resetCarouselTransform = (reg: CarouselRegistration | null) => {
      const preview = reg?.previewEl;
      if (!preview) return;
      if (carouselResetTimer !== null) {
        window.clearTimeout(carouselResetTimer);
        carouselResetTimer = null;
      }
      preview.style.transition = isReduceMotionActive(reduceMotionRef.current)
        ? ''
        : 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)';
      preview.style.transform = '';
      carouselResetTimer = window.setTimeout(() => {
        if (preview) preview.style.transition = '';
        carouselResetTimer = null;
      }, 200);
    };

    const setDraggingVisuals = (active: boolean) => {
      document.body.classList.toggle('is-drag-scrolling', active);
    };

    const applyMoveFrame = () => {
      moveRafId = null;
      if (!isDown || !isDragging) return;

      const dx = lastClientX - startX;
      const dy = lastClientY - startY;

      if (lockedAxis === 'y' && targets.vertical) {
        const scroller = targets.vertical;
        const desiredScrollTop = startScrollTop - dy;
        const maxScroll = cachedMaxScrollY;
        const stage = cachedCanRubberBand ? overscrollRef.current?.current ?? null : null;

        if (stage && desiredScrollTop > maxScroll) {
          scroller.scrollTop = maxScroll;
          const over = desiredScrollTop - maxScroll;
          const damped = Math.min(38, (over * 0.34) / (1 + over / 240));
          activeOverscrollPx = damped;
          if (overscrollClearTimer !== null) {
            window.clearTimeout(overscrollClearTimer);
            overscrollClearTimer = null;
          }
          stage.style.willChange = 'transform';
          stage.style.transition = 'none';
          stage.style.transform = `translate3d(0, ${(-damped).toFixed(1)}px, 0)`;
        } else {
          if (activeOverscrollPx > 0) {
            resetBottomOverscroll(false);
          }
          scroller.scrollTop = desiredScrollTop;
        }
      } else if (lockedAxis === 'x' && targets.horizontal) {
        targets.horizontal.scrollLeft = startScrollLeft - dx;
      } else if (lockedAxis === 'carousel-x' && activeCarousel?.previewEl) {
        // Gentle damped visual shift while dragging the Quick Reset Deck horizontally
        const clamped = Math.max(-72, Math.min(72, dx * 0.55));
        activeCarousel.previewEl.style.transition = 'none';
        activeCarousel.previewEl.style.transform = `translate3d(${clamped.toFixed(1)}px, 0, 0)`;
      }
    };

    const startMomentumCoast = (
      scroller: HTMLElement,
      axis: 'x' | 'y',
      initialVelocityPxPerFrame: number
    ) => {
      if (isReduceMotionActive(reduceMotionRef.current)) return;
      let velocity = Math.max(
        -MAX_VELOCITY_PX,
        Math.min(MAX_VELOCITY_PX, initialVelocityPxPerFrame)
      );
      if (Math.abs(velocity) < 0.8) return;

      // Read scroll geometry once before coasting to avoid 60fps read-after-write layout thrashing
      const maxScroll =
        axis === 'y'
          ? Math.max(0, scroller.scrollHeight - scroller.clientHeight)
          : Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      let currentPos = axis === 'y' ? scroller.scrollTop : scroller.scrollLeft;
      let prevTime = performance.now();

      const step = (now: number) => {
        const dt = Math.min(40, Math.max(1, now - prevTime));
        prevTime = now;
        const frameScale = dt / 16.6667;

        const delta = velocity * frameScale;
        const nextPos = Math.max(0, Math.min(maxScroll, currentPos + delta));
        const moved = Math.abs(nextPos - currentPos);
        currentPos = nextPos;

        if (axis === 'y') {
          scroller.scrollTop = currentPos;
        } else {
          scroller.scrollLeft = currentPos;
        }

        if (moved < 0.1 && Math.abs(delta) >= 0.5) {
          momentumRafId = null;
          return;
        }

        velocity *= Math.pow(FRICTION_PER_FRAME, frameScale);
        if (Math.abs(velocity) < MIN_VELOCITY_PX) {
          momentumRafId = null;
          return;
        }
        momentumRafId = window.requestAnimationFrame(step);
      };

      momentumRafId = window.requestAnimationFrame(step);
    };

    const detachActiveListeners = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onCancel);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };

    const finishGesture = (allowMomentum: boolean) => {
      if (!isDown) return;

      const wasDragging = isDragging;
      const axis = lockedAxis;
      const vTarget = targets.vertical;
      const hTarget = targets.horizontal;
      const carouselReg = activeCarousel;
      const finalDx = lastClientX - startX;

      isDown = false;
      isDragging = false;
      lockedAxis = null;
      activeCarousel = null;

      stopMoveRaf();
      detachActiveListeners();
      setDraggingVisuals(false);

      if (!wasDragging) {
        samples = [];
        return;
      }

      // Prevent the trailing click from accidentally firing interactive controls
      armClickSuppression();

      // Compute instantaneous velocity over the final ~90ms window
      const now = performance.now();
      let velocityPxPerFrame = 0;
      if (allowMomentum && now - lastMoveTime <= IDLE_RELEASE_MS && samples.length >= 2) {
        const recent = samples.filter((s) => now - s.time <= VELOCITY_WINDOW_MS);
        const first = recent[0] ?? samples[samples.length - 2];
        const last = recent[recent.length - 1] ?? samples[samples.length - 1];
        const dt = last.time - first.time;
        if (dt > 4) {
          const pxPerMs = (last.pos - first.pos) / dt;
          // Negate because dragging pointer upward/leftward scrolls content forward
          velocityPxPerFrame = -pxPerMs * 16.6667;
        }
      }
      samples = [];

      if (axis === 'carousel-x' && carouselReg) {
        const threshold = carouselReg.swipeThreshold ?? 44;
        resetCarouselTransform(carouselReg);
        if (finalDx <= -threshold || (finalDx <= -16 && velocityPxPerFrame > 7)) {
          carouselReg.onSwipeLeft();
        } else if (finalDx >= threshold || (finalDx >= 16 && velocityPxPerFrame < -7)) {
          carouselReg.onSwipeRight();
        }
        return;
      }

      const hadBottomOverscroll = activeOverscrollPx > 0.1;
      if (hadBottomOverscroll) {
        resetBottomOverscroll(allowMomentum);
      }

      if (allowMomentum && !hadBottomOverscroll) {
        if (axis === 'y' && vTarget) {
          startMomentumCoast(vTarget, 'y', velocityPxPerFrame);
        } else if (axis === 'x' && hTarget) {
          startMomentumCoast(hTarget, 'x', velocityPxPerFrame);
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDown || e.pointerType !== 'mouse') return;

      // Safety guard: if primary button was released outside the window without pointerup firing
      if ((e.buttons & 1) === 0) {
        finishGesture(false);
        return;
      }

      lastClientX = e.clientX;
      lastClientY = e.clientY;
      const dx = lastClientX - startX;
      const dy = lastClientY - startY;

      if (!isDragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

        // Determine dominant drag axis once threshold is exceeded
        const horizontalDominant = Math.abs(dx) > Math.abs(dy);

        if (horizontalDominant && targets.horizontal) {
          lockedAxis = 'x';
          startScrollLeft = targets.horizontal.scrollLeft;
        } else if (horizontalDominant && targets.carousel) {
          lockedAxis = 'carousel-x';
          activeCarousel = carouselRegistry.get(targets.carousel) ?? null;
        } else if (targets.vertical) {
          lockedAxis = 'y';
          startScrollTop = targets.vertical.scrollTop;
          cachedMaxScrollY = Math.max(
            0,
            targets.vertical.scrollHeight - targets.vertical.clientHeight
          );
          cachedCanRubberBand =
            Boolean(overscrollRef.current?.current) &&
            targets.vertical === getDocumentScroller() &&
            cachedMaxScrollY > 8 &&
            !isReduceMotionActive(reduceMotionRef.current);
        } else if (targets.horizontal) {
          lockedAxis = 'x';
          startScrollLeft = targets.horizontal.scrollLeft;
        } else if (targets.carousel) {
          lockedAxis = 'carousel-x';
          activeCarousel = carouselRegistry.get(targets.carousel) ?? null;
        } else {
          // Nothing scrollable under this gesture; abort cleanly
          finishGesture(false);
          return;
        }

        // Re-anchor origin to threshold crossing so there is no sudden 7px jump
        startX = lastClientX;
        startY = lastClientY;
        isDragging = true;
        setDraggingVisuals(true);

        // Clear any stray 7px text selection started during the deadzone
        try {
          window.getSelection()?.removeAllRanges();
        } catch {
          // Ignore selection errors in restricted frames
        }
      }

      const now = performance.now();
      lastMoveTime = now;
      const axisPos = lockedAxis === 'y' ? lastClientY : lastClientX;
      samples.push({ pos: axisPos, time: now });
      if (samples.length > 14) {
        samples = samples.slice(-10);
      }

      if (moveRafId === null) {
        moveRafId = window.requestAnimationFrame(applyMoveFrame);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      finishGesture(true);
    };

    const onCancel = () => {
      finishGesture(false);
    };

    const onVisibilityChange = () => {
      if (document.hidden) finishGesture(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      // Cancel any ongoing coasting on every press (mouse or touch) and immediately clear
      // any leftover post-drag click suppression BEFORE excluded-target early returns so
      // tapping an emotion tile or control right after a drag is never swallowed.
      stopMomentum();
      clearSuppressFlag();

      // Mouse-only primary button activation so touch/pen physics remain 100% native
      if (e.pointerType !== 'mouse' || e.button !== 0) return;

      // Preserve native text highlighting when holding Shift or double/triple-clicking
      if (e.shiftKey || e.detail >= 2) return;

      // Never hijack text inputs, selects, contenteditable blocks, or opted-out controls
      if (isExcludedTarget(e.target)) return;

      const resolved = resolveScrollTargets(e.target instanceof Element ? e.target : null);
      if (!resolved.vertical && !resolved.horizontal && !resolved.carousel) return;

      isDown = true;
      isDragging = false;
      lockedAxis = null;
      targets = resolved;
      startX = e.clientX;
      startY = e.clientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      lastMoveTime = performance.now();
      samples = [];

      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp, { passive: true });
      window.addEventListener('pointercancel', onCancel, { passive: true });
      window.addEventListener('blur', onCancel);
      document.addEventListener('visibilitychange', onVisibilityChange);
    };

    const onCaptureClick = (e: MouseEvent) => {
      if (!suppressNextClick) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      clearSuppressFlag();
    };

    const onDragStart = (e: DragEvent) => {
      if (isDown || isDragging) {
        e.preventDefault();
      }
    };

    const onWheel = () => stopMomentum();
    const onTouchStart = () => stopMomentum();
    const onKeyDown = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.key)) stopMomentum();
    };

    const onExternalCancel = () => {
      finishGesture(false);
    };

    cancelMomentumFnRef.current = () => {
      finishGesture(false);
      stopMomentum();
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('click', onCaptureClick, { capture: true });
    window.addEventListener('dragstart', onDragStart);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('keydown', onKeyDown, { passive: true });
    window.addEventListener('wb-drag-scroll-cancel', onExternalCancel);

    return () => {
      finishGesture(false);
      stopMomentum();
      clearSuppressFlag();
      if (carouselResetTimer !== null) {
        window.clearTimeout(carouselResetTimer);
        carouselResetTimer = null;
      }
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('click', onCaptureClick, { capture: true });
      window.removeEventListener('dragstart', onDragStart);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('wb-drag-scroll-cancel', onExternalCancel);
    };
  }, []);
}

/**
 * Cancels any pending or active mouse drag-to-scroll capture without affecting
 * subsequent gestures. Used by long-press inspect interactions so holding
 * never drags the viewport.
 */
export function cancelActiveDragScroll(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wb-drag-scroll-cancel'));
  }
}
