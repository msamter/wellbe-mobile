import { useEffect, useRef } from 'react';

/* ==========================================================================
   WELLBE+ 60fps Dual-Edge Scroll-Linked Atmospheric Depth Engine
   - Drives GPU-composited directional push-back (--edge-recede + data-edge-dir)
     as cards/blocks approach or pass behind the Top Utility Header or Bottom
     Expanding Active-Tab Capsule.
   - Zero React re-renders on scroll: writes directly to DOM inline CSS vars.
   - Resting-state guardrails:
     * scrollTop === 0 -> pTop === 0 (greeting & top card stay crisp at 100%)
     * scrollTop >= maxScroll -> pBottom === 0 (final card stays crisp at 100%)
   - Tall-card center protection: tall cards whose center occupies the active
     middle reading band never shrink prematurely while being read.
   - Idle cleanup: clears --edge-recede and data-edge-dir when resting so cards
     have transform: none (zero stacking-context traps or subpixel blur).
   - Full Reduce Motion & High-Contrast live synchronization.
   ========================================================================== */

export interface UseViewportEdgeRecessionOptions {
  /** Disables all 3D perspective / scale push-back while keeping static veils */
  reduceMotion: boolean;
  /** Re-scans [data-edge-recede] nodes when tabs, drawers, or modals change */
  recalculateKey?: string | number;
  /** Temporarily pauses recession when full-screen overlays are open */
  disabled?: boolean;
}

interface ElementState {
  dir: 'top' | 'bottom' | '';
  val: number;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
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
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function parsePx(value: string, fallback: number): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function clearElementRecession(el: HTMLElement, cache: WeakMap<HTMLElement, ElementState>) {
  const prev = cache.get(el);
  if (prev && prev.dir === '' && prev.val === 0) return;
  el.style.removeProperty('--edge-recede');
  el.removeAttribute('data-edge-dir');
  cache.set(el, { dir: '', val: 0 });
}

export function useViewportEdgeRecession(
  containerRef: React.RefObject<HTMLElement | null>,
  { reduceMotion, recalculateKey, disabled = false }: UseViewportEdgeRecessionOptions
) {
  const optionsRef = useRef({ reduceMotion, disabled });
  optionsRef.current = { reduceMotion, disabled };

  const triggerRecalcRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const container = containerRef.current;
    if (!container) return;

    const stateCache = new WeakMap<HTMLElement, ElementState>();
    let trackedNodes: HTMLElement[] = [];
    let rafId: number | null = null;
    let needsNodeRefresh = true;
    let needsMetricsRefresh = true;

    // Cached viewport / taskbar geometry (refreshed on resize or mode toggle)
    let viewportHeight = window.innerHeight;
    let topRim = 56;
    let bottomRim = Math.max(200, viewportHeight - 84);
    let highContrast = false;
    let cachedReduceMotion = isReduceMotionActive(optionsRef.current.reduceMotion);
    let cachedMaxScroll = 0;

    // Quiet scroll-active edge veil references & cached visibility state (zero redundant DOM writes)
    let topVeilEl: HTMLElement | null = null;
    let bottomVeilEl: HTMLElement | null = null;
    let lastTopVeilActive: boolean | null = null;
    let lastBottomVeilActive: boolean | null = null;

    const syncEdgeVeils = (topActive: boolean, bottomActive: boolean) => {
      if (!topVeilEl || !topVeilEl.isConnected) {
        topVeilEl = document.querySelector<HTMLElement>('.wb-edge-veil-top');
        lastTopVeilActive = null;
      }
      if (!bottomVeilEl || !bottomVeilEl.isConnected) {
        bottomVeilEl = document.querySelector<HTMLElement>('.wb-edge-veil-bottom');
        lastBottomVeilActive = null;
      }
      if (topVeilEl && lastTopVeilActive !== topActive) {
        topVeilEl.setAttribute('data-scroll-active', topActive ? 'true' : 'false');
        lastTopVeilActive = topActive;
      }
      if (bottomVeilEl && lastBottomVeilActive !== bottomActive) {
        bottomVeilEl.setAttribute('data-scroll-active', bottomActive ? 'true' : 'false');
        lastBottomVeilActive = bottomActive;
      }
    };

    // Pre-allocated mutation batch buffer (zero per-frame GC allocations)
    const pendingWrites: Array<{
      el: HTMLElement;
      dir: 'top' | 'bottom' | '';
      val: number;
      dirChanged: boolean;
    }> = [];

    const refreshMetrics = () => {
      needsMetricsRefresh = false;
      viewportHeight = window.innerHeight;
      highContrast = document.documentElement.getAttribute('data-high-contrast') === 'true';
      cachedReduceMotion = isReduceMotionActive(optionsRef.current.reduceMotion);

      const scroller = (document.scrollingElement as HTMLElement) || document.documentElement;
      cachedMaxScroll = Math.max(0, scroller.scrollHeight - viewportHeight);

      const rootStyle = window.getComputedStyle(document.documentElement);
      const headerEl = document.querySelector<HTMLElement>('header[data-top-utility-bar="true"]');
      const dockEl = document.querySelector<HTMLElement>('.wb-capsule-dock-wrap');

      if (headerEl) {
        const hRect = headerEl.getBoundingClientRect();
        topRim = hRect.height > 0 ? Math.max(44, hRect.bottom) : parsePx(rootStyle.getPropertyValue('--top-bar-height'), 56);
      } else {
        topRim = parsePx(rootStyle.getPropertyValue('--top-bar-height'), 56);
      }

      if (dockEl) {
        const dRect = dockEl.getBoundingClientRect();
        bottomRim =
          dRect.height > 0 && dRect.top > topRim + 120
            ? dRect.top
            : viewportHeight -
              (parsePx(rootStyle.getPropertyValue('--capsule-dock-height'), 60) +
                parsePx(rootStyle.getPropertyValue('--capsule-dock-lift'), 16));
      } else {
        bottomRim =
          viewportHeight -
          (parsePx(rootStyle.getPropertyValue('--capsule-dock-height'), 60) +
            parsePx(rootStyle.getPropertyValue('--capsule-dock-lift'), 16));
      }
    };

    const refreshNodes = () => {
      needsNodeRefresh = false;
      const found = Array.from(container.querySelectorAll<HTMLElement>('[data-edge-recede]'));
      // Guarantee non-nested safety & ignore kept-mounted hidden tabs for zero idle scroll overhead
      const nextNodes = found.filter(
        (el) => !el.closest('[hidden]') && !el.parentElement?.closest('[data-edge-recede]')
      );
      if (trackedNodes.length > 0) {
        const nextSet = new Set(nextNodes);
        for (let i = 0; i < trackedNodes.length; i += 1) {
          const prevEl = trackedNodes[i];
          if (!nextSet.has(prevEl)) {
            clearElementRecession(prevEl, stateCache);
          }
        }
      }
      trackedNodes = nextNodes;
    };

    const clearAllNodes = () => {
      for (let i = 0; i < trackedNodes.length; i += 1) {
        clearElementRecession(trackedNodes[i], stateCache);
      }
    };

    let lastEvalScrollTop = -1;
    let lastEvalMaxScroll = -1;

    const evaluateFrame = () => {
      rafId = null;

      let forced = false;
      if (needsNodeRefresh) {
        refreshNodes();
        forced = true;
      }
      if (needsMetricsRefresh) {
        refreshMetrics();
        forced = true;
      }

      if (optionsRef.current.disabled) {
        lastEvalScrollTop = -1;
        syncEdgeVeils(false, false);
        clearAllNodes();
        return;
      }

      const scroller = (document.scrollingElement as HTMLElement) || document.documentElement;
      const scrollTop = Math.max(0, window.scrollY || scroller.scrollTop || 0);
      const maxScroll = cachedMaxScroll;

      if (
        !forced &&
        Math.abs(scrollTop - lastEvalScrollTop) < 0.5 &&
        maxScroll === lastEvalMaxScroll
      ) {
        return;
      }
      lastEvalScrollTop = scrollTop;
      lastEvalMaxScroll = maxScroll;

      // Dynamically show top/bottom scroll fades strictly when overflow exists in that direction
      const hasOverflow = maxScroll > 4;
      const distFromBottom = Math.max(0, maxScroll - scrollTop);
      syncEdgeVeils(hasOverflow && scrollTop > 4, hasOverflow && distFromBottom > 4);

      if (cachedReduceMotion || trackedNodes.length === 0 || !hasOverflow) {
        clearAllNodes();
        return;
      }

      // Smooth resting-state guardrails:
      // - Top guardrail: 0 at scrollTop === 0, smoothly ramps 0 -> 1 over first 28px
      // - Bottom guardrail: 0 at maxScroll (including elastic overscroll), ramps over last 40px
      const topGuard = clamp01(scrollTop / 28);
      const bottomGuard = clamp01(distFromBottom / 40);

      // Edge engagement zones (subtle proximity trigger right near each taskbar rim)
      const topBuffer = highContrast ? 14 : 36;
      const topSpan = highContrast ? 72 : 116;
      const bottomBuffer = highContrast ? 14 : 32;
      const bottomSpan = highContrast ? 74 : 120;

      const topStart = topRim + topBuffer;
      const bottomStart = bottomRim - bottomBuffer;
      const activeBandHeight = Math.max(120, bottomRim - topRim);
      const midBandTop = topRim + activeBandHeight * 0.24;
      const midBandBottom = bottomRim - activeBandHeight * 0.24;

      // Batch all layout reads first, then DOM writes (zero layout thrashing or GC churn)
      pendingWrites.length = 0;

      for (let i = 0; i < trackedNodes.length; i += 1) {
        const el = trackedNodes[i];
        const rect = el.getBoundingClientRect();

        // Skip zero-height hidden nodes or far off-screen elements
        if (rect.height < 1 || rect.bottom < -180 || rect.top > viewportHeight + 180) {
          const prev = stateCache.get(el);
          if (prev && prev.dir !== '') {
            pendingWrites.push({ el, dir: '', val: 0, dirChanged: true });
          }
          continue;
        }

        let pTop = 0;
        let pBottom = 0;

        if (topGuard > 0 && rect.top < topStart) {
          const rawTop = rect.bottom <= topRim ? 1 : clamp01((topStart - rect.top) / topSpan);
          pTop = smoothstep(rawTop) * topGuard;
        }

        if (bottomGuard > 0 && rect.bottom > bottomStart) {
          const rawBottom = rect.top >= bottomRim ? 1 : clamp01((rect.bottom - bottomStart) / bottomSpan);
          pBottom = smoothstep(rawBottom) * bottomGuard;
        }

        // Tall-card protection: never shrink a tall card while its vertical center sits in the
        // middle reading band or while it spans across both top and bottom engagement zones.
        const isTall = rect.height > activeBandHeight * 0.52;
        if (isTall && (pTop > 0 || pBottom > 0)) {
          if (rect.top < topStart && rect.bottom > bottomStart) {
            pTop = 0;
            pBottom = 0;
          } else {
            const centerY = rect.top + rect.height * 0.5;
            if (centerY >= midBandTop && centerY <= midBandBottom) {
              pTop = 0;
              pBottom = 0;
            } else if (centerY < midBandTop && pTop > 0) {
              const exitProgress = clamp01((midBandTop - centerY) / Math.max(72, activeBandHeight * 0.28));
              pTop *= smoothstep(exitProgress);
            } else if (centerY > midBandBottom && pBottom > 0) {
              const exitProgress = clamp01((centerY - midBandBottom) / Math.max(72, activeBandHeight * 0.28));
              pBottom *= smoothstep(exitProgress);
            }
          }
        }

        const dominant = Math.max(pTop, pBottom);
        if (dominant < 0.004) {
          const prev = stateCache.get(el);
          if (prev && prev.dir !== '') {
            pendingWrites.push({ el, dir: '', val: 0, dirChanged: true });
          }
        } else {
          const dir: 'top' | 'bottom' = pTop >= pBottom ? 'top' : 'bottom';
          const quantized = Math.round(dominant * 250) / 250;
          const prev = stateCache.get(el);
          if (!prev || prev.dir !== dir || prev.val !== quantized) {
            pendingWrites.push({ el, dir, val: quantized, dirChanged: !prev || prev.dir !== dir });
          }
        }
      }

      // Apply minimal batched DOM mutations (skip redundant setAttribute when dir is unchanged)
      for (let i = 0; i < pendingWrites.length; i += 1) {
        const { el, dir, val, dirChanged } = pendingWrites[i];
        if (dir === '' || val === 0) {
          el.style.removeProperty('--edge-recede');
          el.removeAttribute('data-edge-dir');
          stateCache.set(el, { dir: '', val: 0 });
        } else {
          el.style.setProperty('--edge-recede', val.toFixed(3));
          if (dirChanged) {
            el.setAttribute('data-edge-dir', dir);
          }
          stateCache.set(el, { dir, val });
        }
      }
    };

    const scheduleFrame = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(evaluateFrame);
    };

    const scheduleFullRecalc = () => {
      needsNodeRefresh = true;
      needsMetricsRefresh = true;
      scheduleFrame();
    };

    triggerRecalcRef.current = scheduleFullRecalc;

    const onScroll = () => scheduleFrame();
    const onResize = () => {
      needsMetricsRefresh = true;
      scheduleFrame();
    };

    const motionMq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    const onMotionPrefChange = () => scheduleFullRecalc();
    motionMq?.addEventListener('change', onMotionPrefChange);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      needsMetricsRefresh = true;
      scheduleFrame();
    });
    resizeObserver.observe(container);

    const hasRecedeNodeInList = (nodes: NodeList): boolean => {
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (node.nodeType === 1) {
          const el = node as Element;
          if (el.hasAttribute('data-edge-recede') || el.querySelector('[data-edge-recede]') !== null) {
            return true;
          }
        }
      }
      return false;
    };

    const mutationObserver = new MutationObserver((mutations) => {
      if (optionsRef.current.disabled || needsNodeRefresh) return;
      for (let i = 0; i < mutations.length; i += 1) {
        const m = mutations[i];
        if (hasRecedeNodeInList(m.addedNodes) || hasRecedeNodeInList(m.removedNodes)) {
          needsNodeRefresh = true;
          scheduleFrame();
          return;
        }
      }
    });
    mutationObserver.observe(container, { childList: true, subtree: true });

    const rootAttrObserver = new MutationObserver(() => {
      scheduleFullRecalc();
    });
    rootAttrObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-high-contrast', 'data-reduce-motion', 'data-reading-comfort'],
    });

    // Initial evaluation
    scheduleFullRecalc();

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      motionMq?.removeEventListener('change', onMotionPrefChange);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      rootAttrObserver.disconnect();
      syncEdgeVeils(false, false);
      clearAllNodes();
      trackedNodes = [];
    };
  }, [containerRef]);

  // Recalculate cleanly on tab switches, modal open/close, and AnimatePresence swaps
  useEffect(() => {
    triggerRecalcRef.current();
    const postTransitionTimer = window.setTimeout(() => {
      triggerRecalcRef.current();
    }, 210);
    return () => window.clearTimeout(postTransitionTimer);
  }, [reduceMotion, recalculateKey, disabled]);
}
