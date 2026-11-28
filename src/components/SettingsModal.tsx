import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  Info,
  LifeBuoy,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  User,
  Watch,
  Wind,
  X,
} from 'lucide-react';
import { AppSettings, AppTab, DailyBiometrics } from '../types/wellbe';
import { AffectiveGlyph } from './AffectiveGlyphs';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { cancelActiveDragScroll, useDragToScroll } from '../hooks/useDragToScroll';
import { AccessibilityKey, useAccessibility } from '../context/AccessibilityContext';
import { AccountIdentityBillingTab } from './AccountIdentityBillingTab';
import { WearablesTab } from './WearablesTab';
import { HelpSupportTab } from './HelpSupportTab';
import { HelpLegalAboutTab } from './HelpLegalAboutTab';
import { WearableSettingsState } from '../utils/wearablesStorage';
import { BentoSummaryPill, SettingsBentoAccordion } from './SettingsBentoAccordion';

export type SettingsTabId = 'account' | 'wearables' | 'accessibility' | 'support' | 'about';

/* ============================================================================
   Unified Settings Section Header (Shared identically across all 3 tabs)
   ============================================================================ */
export interface SettingsTabHeaderProps {
  title: string;
  subtitle: string;
}

export const SettingsTabHeader: React.FC<SettingsTabHeaderProps> = ({
  title,
  subtitle,
}) => (
  <div className="border-b border-[var(--border-hairline)] pb-3.5">
    <h2 className="text-base font-semibold tracking-tight text-[var(--ink-primary)]">{title}</h2>
    <p className="wb-prose mt-0.5 text-xs text-[var(--ink-muted)]">{subtitle}</p>
  </div>
);

const SETTINGS_DOCK_ITEMS: Array<{
  id: SettingsTabId;
  label: string;
  ariaLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'account',
    label: 'Account',
    ariaLabel: 'Account, Identity & Billing',
    icon: User,
  },
  {
    id: 'wearables',
    label: 'Devices',
    ariaLabel: 'Devices',
    icon: Watch,
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    ariaLabel: 'Appearance & Sensory Accessibility',
    icon: SlidersHorizontal,
  },
  {
    id: 'support',
    label: 'Support',
    ariaLabel: 'Help & Support',
    icon: LifeBuoy,
  },
  {
    id: 'about',
    label: 'About',
    ariaLabel: 'Legal & About',
    icon: Info,
  },
];

function isSettingsReduceMotion(pref: boolean): boolean {
  if (pref) return true;
  if (typeof window === 'undefined') return false;
  const attr = document.documentElement.getAttribute('data-reduce-motion');
  if (attr === 'true') return true;
  if (attr === 'false') return false;
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function getCurrentTranslateY(el: HTMLElement | null): number {
  if (!el || typeof window === 'undefined') return 0;
  const transform = window.getComputedStyle(el).transform;
  if (!transform || transform === 'none') return 0;
  try {
    if (typeof DOMMatrixReadOnly !== 'undefined') {
      const matrix = new DOMMatrixReadOnly(transform);
      return Number.isFinite(matrix.m42) ? Math.max(0, matrix.m42) : 0;
    }
  } catch {
    // Fall through to regex parsing
  }
  const match = transform.match(/matrix\(([^)]+)\)/);
  if (!match) return 0;
  const parts = match[1].split(',');
  const ty = Number.parseFloat(parts[5] ?? '0');
  return Number.isFinite(ty) ? Math.max(0, ty) : 0;
}

const SETTINGS_INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, option, [role="switch"], [role="slider"], [role="tab"], [contenteditable="true"], [data-no-settings-grab="true"]';

// Keep Settings drawer solid across early downward travel (fading past ~65%),
// while the deep dark-black scrim gradually transitions from 1 -> 0 across the full
// downward travel so the underlying active app view smoothly fades back into view.
const SETTINGS_DRAWER_FADE_START = 0.65;

function computeSettingsScrimOpacity(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return Math.max(0, Math.min(1, Math.pow(1 - clamped, 1.15)));
}

function computeSettingsDrawerOpacity(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped <= SETTINGS_DRAWER_FADE_START) return 1;
  const t = (clamped - SETTINGS_DRAWER_FADE_START) / (1 - SETTINGS_DRAWER_FADE_START);
  return Math.max(0, Math.min(1, 1 - t));
}

export interface SettingsModalProps {
  open?: boolean;
  initialTab?: SettingsTabId;
  activeView: AppTab;
  settings: AppSettings;
  todayBio: DailyBiometrics | undefined;
  wearables: WearableSettingsState;
  onUpdateWearables: (
    updater:
      | Partial<WearableSettingsState>
      | ((prev: WearableSettingsState) => WearableSettingsState)
  ) => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onSyncWatch: () => void;
  onSimulateWatchCheckIn: (emotionId: string, note: string) => void;
  onSimulateStressSpike: () => void;
  onOpenPhoneHandoff?: () => void;
  onOpenCoach: () => void;
  onLaunchBreathingReset: () => void;
  onResetAppDefaults: () => void;
  onResetDemoData: () => void;
  onNotify?: (title: string, subtitle?: string) => void;
  onMountedChange?: (mounted: boolean) => void;
  onClose: () => void;
}

interface SettingsDrawerInnerProps extends Omit<SettingsModalProps, 'open' | 'onMountedChange'> {
  open: boolean;
  onExitComplete: () => void;
}

const SettingsDrawerInner: React.FC<SettingsDrawerInnerProps> = ({
  open,
  initialTab = 'account',
  activeView,
  settings,
  todayBio,
  wearables,
  onUpdateWearables,
  onUpdateSettings,
  onSyncWatch,
  onSimulateWatchCheckIn,
  onSimulateStressSpike,
  onOpenPhoneHandoff,
  onLaunchBreathingReset,
  onResetAppDefaults,
  onResetDemoData,
  onNotify,
  onClose,
  onExitComplete,
}) => {
  const a11y = useAccessibility();
  const portalRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [isExiting, setIsExiting] = useState(false);
  const isExitingRef = useRef(false);
  isExitingRef.current = isExiting;

  const isDraggingRef = useRef(false);
  const closeInitiatedByDragRef = useRef(false);
  const transitionTimerRef = useRef<number | null>(null);
  const openRaf1Ref = useRef<number | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const scrollResetRafRef = useRef<number | null>(null);
  const grabCleanupRef = useRef<(() => void) | null>(null);
  const reduceMotionRef = useRef(a11y.reduceMotion);
  reduceMotionRef.current = a11y.reduceMotion;
  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const clearPendingMotion = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (openRaf1Ref.current !== null) {
      window.cancelAnimationFrame(openRaf1Ref.current);
      openRaf1Ref.current = null;
    }
    if (dragRafRef.current !== null) {
      window.cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
  }, []);

  const animateDrawerOpen = useCallback(
    (fromOffsetPx?: number) => {
      clearPendingMotion();
      const portal = portalRef.current;
      const drawer = drawerRef.current;
      const scrim = scrimRef.current;
      if (!drawer || !scrim) return;

      const reduced = isSettingsReduceMotion(reduceMotionRef.current);
      setIsExiting(false);
      isExitingRef.current = false;

      if (portal) portal.style.pointerEvents = '';
      drawer.style.pointerEvents = '';
      scrim.style.pointerEvents = '';

      if (reduced || (typeof fromOffsetPx === 'number' && fromOffsetPx <= 0.5)) {
        drawer.style.transition = '';
        drawer.style.transform = 'none';
        drawer.style.opacity = '1';
        drawer.style.willChange = 'auto';
        scrim.style.transition = '';
        scrim.style.opacity = '1';
        scrim.style.willChange = 'auto';
        return;
      }

      const drawerHeight = drawer.getBoundingClientRect().height || window.innerHeight;
      const startY =
        typeof fromOffsetPx === 'number'
          ? Math.max(0, Math.min(drawerHeight, fromOffsetPx))
          : drawerHeight;
      const progress = drawerHeight > 0 ? startY / drawerHeight : 1;
      const durationMs =
        typeof fromOffsetPx === 'number'
          ? Math.round(Math.max(130, Math.min(240, progress * 240)))
          : 240;

      // Commit starting frame off-screen at bottom (or exact drag release offset)
      drawer.style.willChange = 'transform, opacity';
      drawer.style.transition = 'none';
      drawer.style.transform =
        typeof fromOffsetPx === 'number'
          ? `translate3d(0, ${startY}px, 0)`
          : 'translate3d(0, 100%, 0)';
      drawer.style.opacity =
        typeof fromOffsetPx === 'number'
          ? String(computeSettingsDrawerOpacity(progress))
          : '1';

      scrim.style.willChange = 'opacity';
      scrim.style.transition = 'none';
      scrim.style.opacity = String(
        typeof fromOffsetPx === 'number' ? computeSettingsScrimOpacity(progress) : 0
      );

      // Force layout commit before starting the smooth upward glide
      void drawer.offsetHeight;

      openRaf1Ref.current = window.requestAnimationFrame(() => {
        openRaf1Ref.current = null;
        if (isDraggingRef.current || !drawerRef.current || !scrimRef.current) return;
        const opacityReturnMs = Math.max(100, Math.round(durationMs * 0.52));
        drawerRef.current.style.transition = `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${opacityReturnMs}ms ease-out`;
        drawerRef.current.style.transform = 'translate3d(0, 0px, 0)';
        drawerRef.current.style.opacity = '1';
        scrimRef.current.style.transition = `opacity ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        scrimRef.current.style.opacity = '1';

        transitionTimerRef.current = window.setTimeout(() => {
          transitionTimerRef.current = null;
          if (!isDraggingRef.current && !isExitingRef.current && drawerRef.current && scrimRef.current) {
            drawerRef.current.style.transition = '';
            drawerRef.current.style.transform = 'none';
            drawerRef.current.style.opacity = '1';
            drawerRef.current.style.willChange = 'auto';
            scrimRef.current.style.transition = '';
            scrimRef.current.style.opacity = '1';
            scrimRef.current.style.willChange = 'auto';
          }
        }, durationMs + 30);
      });
    },
    [clearPendingMotion]
  );

  const animateDrawerClose = useCallback(
    (fromOffsetPx?: number) => {
      clearPendingMotion();
      const portal = portalRef.current;
      const drawer = drawerRef.current;
      const scrim = scrimRef.current;
      setIsExiting(true);
      isExitingRef.current = true;

      // Immediately release pointer hit-testing on close start so underlying controls are never blocked
      if (portal) portal.style.pointerEvents = 'none';
      if (drawer) drawer.style.pointerEvents = 'none';
      if (scrim) scrim.style.pointerEvents = 'none';

      const reduced = isSettingsReduceMotion(reduceMotionRef.current);
      if (reduced || !drawer || !scrim) {
        onExitCompleteRef.current();
        return;
      }

      const drawerHeight = drawer.getBoundingClientRect().height || window.innerHeight;
      const currentY =
        typeof fromOffsetPx === 'number'
          ? Math.max(0, Math.min(drawerHeight, fromOffsetPx))
          : getCurrentTranslateY(drawer);
      const startProgress =
        drawerHeight > 0 ? Math.max(0, Math.min(1, currentY / drawerHeight)) : 0;
      const remainingRatio = Math.max(0, 1 - startProgress);
      const durationMs = Math.round(Math.max(130, Math.min(250, remainingRatio * 250)));

      // Anchor starting transform & opacity to exact current progress (opaque across early travel)
      drawer.style.willChange = 'transform, opacity';
      drawer.style.transition = 'none';
      drawer.style.transform = `translate3d(0, ${currentY}px, 0)`;
      drawer.style.opacity = String(computeSettingsDrawerOpacity(startProgress));

      scrim.style.willChange = 'opacity';
      scrim.style.transition = 'none';
      scrim.style.opacity = String(computeSettingsScrimOpacity(startProgress));

      void drawer.offsetHeight;

      // Coordinate delayed drawer fade (~65%) with immediate gradual dark-black scrim reveal (1 -> 0)
      const drawerWaitFrac =
        startProgress < SETTINGS_DRAWER_FADE_START && remainingRatio > 0.01
          ? (SETTINGS_DRAWER_FADE_START - startProgress) / remainingRatio
          : 0;
      const drawerFadeDelayMs =
        drawerWaitFrac > 0
          ? Math.min(
              Math.max(0, durationMs - 65),
              Math.round(durationMs * Math.pow(drawerWaitFrac, 0.62) * 0.86)
            )
          : 0;
      const drawerFadeDurationMs = Math.max(60, durationMs - drawerFadeDelayMs);

      openRaf1Ref.current = window.requestAnimationFrame(() => {
        openRaf1Ref.current = null;
        if (!drawerRef.current || !scrimRef.current) {
          onExitCompleteRef.current();
          return;
        }
        drawerRef.current.style.transition = `transform ${durationMs}ms cubic-bezier(0.4, 0, 1, 1), opacity ${drawerFadeDurationMs}ms ease-in ${drawerFadeDelayMs}ms`;
        drawerRef.current.style.transform = 'translate3d(0, 100%, 0)';
        drawerRef.current.style.opacity = '0';

        scrimRef.current.style.transition = `opacity ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        scrimRef.current.style.opacity = '0';

        transitionTimerRef.current = window.setTimeout(() => {
          transitionTimerRef.current = null;
          if (drawerRef.current) drawerRef.current.style.willChange = 'auto';
          if (scrimRef.current) scrimRef.current.style.willChange = 'auto';
          onExitCompleteRef.current();
        }, durationMs + 25);
      });
    },
    [clearPendingMotion]
  );

  // Sync programmatic open / close transitions before first paint (never cancels drag-initiated close)
  useLayoutEffect(() => {
    if (open) {
      closeInitiatedByDragRef.current = false;
      animateDrawerOpen();
    } else if (!closeInitiatedByDragRef.current) {
      animateDrawerClose();
    }
  }, [open, animateDrawerOpen, animateDrawerClose]);

  // Ensure grabbing body class, listeners & timers always clean up on unmount
  useEffect(() => {
    return () => {
      grabCleanupRef.current?.();
      grabCleanupRef.current = null;
      if (scrollResetRafRef.current !== null) {
        window.cancelAnimationFrame(scrollResetRafRef.current);
        scrollResetRafRef.current = null;
      }
      document.body.classList.remove('wb-settings-grabbing');
      clearPendingMotion();
    };
  }, [clearPendingMotion]);

  const handleRequestClose = useCallback(() => {
    if (!isExitingRef.current) onCloseRef.current();
  }, []);

  // Interactive 1:1 Mouse & Touch Grab Controller (slowly scrub Settings up or down to open/close)
  const beginDrawerGrab = useCallback(
    (startClientY: number, initialDragActive: boolean, startOffsetOverride?: number) => {
      const drawer = drawerRef.current;
      const scrim = scrimRef.current;
      if (!drawer || !scrim || isExitingRef.current) return;

      clearPendingMotion();

      const drawerHeight = drawer.getBoundingClientRect().height || window.innerHeight;
      const baseOffsetY =
        typeof startOffsetOverride === 'number'
          ? startOffsetOverride
          : getCurrentTranslateY(drawer);

      let active = initialDragActive;
      let anchorY = startClientY;
      let currentOffsetY = baseOffsetY;
      let samples: Array<{ y: number; t: number }> = [
        { y: startClientY, t: performance.now() },
      ];

      const applyGrabFrame = (offsetY: number) => {
        if (!drawerRef.current || !scrimRef.current) return;
        const clamped = Math.max(0, Math.min(drawerHeight, offsetY));
        const ratio = drawerHeight > 0 ? clamped / drawerHeight : 0;
        drawerRef.current.style.willChange = 'transform, opacity';
        drawerRef.current.style.transition = 'none';
        drawerRef.current.style.transform = `translate3d(0, ${clamped}px, 0)`;
        drawerRef.current.style.opacity = String(computeSettingsDrawerOpacity(ratio));
        scrimRef.current.style.willChange = 'opacity';
        scrimRef.current.style.transition = 'none';
        scrimRef.current.style.opacity = String(computeSettingsScrimOpacity(ratio));
      };

      const activateGrab = (clientY: number) => {
        active = true;
        isDraggingRef.current = true;
        anchorY = clientY;
        cancelActiveDragScroll();
        document.body.classList.add('wb-settings-grabbing');
        try {
          window.getSelection()?.removeAllRanges();
        } catch {
          // Ignore selection errors
        }
        applyGrabFrame(currentOffsetY);
      };

      if (active) {
        activateGrab(startClientY);
      }

      const onPointerMove = (e: PointerEvent) => {
        const deltaFromStart = e.clientY - startClientY;

        if (!active) {
          // For pane pull-down handoff: if user drags upward, cancel grab and let normal pane scroll handle it
          if (deltaFromStart < -6) {
            cleanup();
            return;
          }
          if (deltaFromStart > 8) {
            activateGrab(e.clientY);
          } else {
            return;
          }
        }

        const nextOffset = Math.max(
          0,
          Math.min(drawerHeight, baseOffsetY + (e.clientY - anchorY))
        );
        currentOffsetY = nextOffset;

        const now = performance.now();
        samples.push({ y: e.clientY, t: now });
        if (samples.length > 12) {
          samples = samples.slice(-8);
        }

        if (dragRafRef.current === null) {
          dragRafRef.current = window.requestAnimationFrame(() => {
            dragRafRef.current = null;
            applyGrabFrame(currentOffsetY);
          });
        }
      };

      const finishGrab = (cancelled: boolean) => {
        cleanup();
        if (!active) return;

        isDraggingRef.current = false;
        if (dragRafRef.current !== null) {
          window.cancelAnimationFrame(dragRafRef.current);
          dragRafRef.current = null;
        }

        if (cancelled) {
          animateDrawerOpen(currentOffsetY);
          return;
        }

        // Compute release velocity over the last ~90ms (px/ms; positive = downward)
        const now = performance.now();
        const recent = samples.filter((s) => now - s.t <= 95);
        let velocityY = 0;
        if (recent.length >= 2) {
          const first = recent[0];
          const last = recent[recent.length - 1];
          const dt = last.t - first.t;
          if (dt > 4) {
            velocityY = (last.y - first.y) / dt;
          }
        }

        const progress = drawerHeight > 0 ? currentOffsetY / drawerHeight : 0;
        const shouldClose =
          velocityY > 0.45 || (progress > 0.28 && velocityY > -0.25);

        if (shouldClose) {
          closeInitiatedByDragRef.current = true;
          animateDrawerClose(currentOffsetY);
          onCloseRef.current();
        } else {
          animateDrawerOpen(currentOffsetY);
        }
      };

      const onPointerUp = () => finishGrab(false);
      const onPointerCancel = () => finishGrab(true);
      const onWindowBlur = () => finishGrab(true);

      const cleanup = () => {
        document.body.classList.remove('wb-settings-grabbing');
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
        window.removeEventListener('blur', onWindowBlur);
        if (grabCleanupRef.current === cleanup) {
          grabCleanupRef.current = null;
        }
      };

      grabCleanupRef.current?.();
      grabCleanupRef.current = cleanup;
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp, { passive: true });
      window.addEventListener('pointercancel', onPointerCancel, { passive: true });
      window.addEventListener('blur', onWindowBlur);
    },
    [animateDrawerClose, animateDrawerOpen, clearPendingMotion]
  );

  // Grab directly on the Settings top header / drag handle (mouse or touch)
  const handleHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target instanceof Element && e.target.closest('button, a, [data-no-settings-grab="true"]')) {
        return;
      }
      e.stopPropagation();
      beginDrawerGrab(e.clientY, true);
    },
    [beginDrawerGrab]
  );

  // Seamless pull-down handoff from the top of the Settings body pane when scrollTop === 0
  const handleBodyPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.shiftKey || e.detail >= 2) return;
      const body = bodyRef.current;
      if (!body || body.scrollTop > 1) return;
      if (e.target instanceof Element && e.target.closest(SETTINGS_INTERACTIVE_SELECTOR)) {
        return;
      }
      beginDrawerGrab(e.clientY, false, 0);
    },
    [beginDrawerGrab]
  );

  useFocusTrap(drawerRef, handleRequestClose, open && !isExiting);
  useDragToScroll(bodyRef, { axis: 'y' });

  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [liveStatus, setLiveStatus] = useState('');

  // Exclusive single-open sub-accordion ID scoped to the active Settings view
  const getDefaultSubAccordionId = useCallback((tab: SettingsTabId): string | null => {
    if (tab === 'wearables') return 'sync';
    if (tab === 'support') return 'nami';
    return null;
  }, []);

  const [openSubAccordionId, setOpenSubAccordionId] = useState<string | null>(() =>
    getDefaultSubAccordionId(initialTab)
  );

  const toggleSubAccordion = useCallback((id: string) => {
    setOpenSubAccordionId((prev) => (prev === id ? null : id));
  }, []);

  const openSubAccordion = useCallback((id: string) => {
    setOpenSubAccordionId(id);
  }, []);

  // Sync if opened directly to a specific tab via Cmd+K
  useEffect(() => {
    setActiveTab(initialTab);
    setOpenSubAccordionId(getDefaultSubAccordionId(initialTab));
  }, [initialTab, getDefaultSubAccordionId]);

  const resetPaneScrollTop = useCallback(() => {
    cancelActiveDragScroll();
    if (scrollResetRafRef.current !== null) {
      window.cancelAnimationFrame(scrollResetRafRef.current);
      scrollResetRafRef.current = null;
    }
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
    scrollResetRafRef.current = window.requestAnimationFrame(() => {
      scrollResetRafRef.current = null;
      if (bodyRef.current) {
        bodyRef.current.scrollTop = 0;
      }
    });
  }, []);

  const selectSettingsTab = useCallback(
    (nextTab: SettingsTabId) => {
      resetPaneScrollTop();
      setActiveTab(nextTab);
      setOpenSubAccordionId(getDefaultSubAccordionId(nextTab));
    },
    [resetPaneScrollTop, getDefaultSubAccordionId]
  );

  const handleAccountSubTabChange = useCallback(() => {
    setOpenSubAccordionId(null);
    resetPaneScrollTop();
  }, [resetPaneScrollTop]);

  const handleResetAccessibilityDefaults = useCallback(() => {
    onUpdateSettings({ theme: 'system' });
    a11y.resetToDefaults();
  }, [a11y, onUpdateSettings]);

  // Synchronously reset right pane scrollTop = 0 when switching Settings tabs (with rAF guard)
  useLayoutEffect(() => {
    resetPaneScrollTop();
  }, [activeTab, resetPaneScrollTop]);

  /* ========================================================================
     Tab 3: Accessibility Toggle Renderer (Container-Query Hardened)
     ======================================================================== */
  const renderToggleRow = (
    prefKey: AccessibilityKey,
    title: string,
    description: string
  ) => {
    const checked = a11y[prefKey];
    const labelId = `setting-${prefKey}`;
    const descId = `setting-${prefKey}-desc`;
    return (
      <div key={prefKey} className="wb-pane-toggle-row py-3">
        <div className="min-w-0 flex-1">
          <p id={labelId} className="text-sm font-semibold text-[var(--ink-primary)]">
            {title}
          </p>
          <p id={descId} className="wb-prose mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]">
            {description}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          data-no-drag-scroll="true"
          aria-labelledby={labelId}
          aria-describedby={descId}
          aria-checked={checked}
          onClick={() => a11y.togglePreference(prefKey)}
          className="wb-pane-toggle-switch"
        >
          <span
            className="min-w-[1.75rem] text-right font-mono-tabular text-xs font-semibold"
            style={{
              color: checked ? 'var(--brand-accent-text)' : 'var(--ink-muted)',
            }}
          >
            {checked ? 'On' : 'Off'}
          </span>
          <span
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
            style={{
              backgroundColor: checked ? 'var(--brand-action-bg)' : 'var(--border-strong)',
            }}
          >
            <span
              className="inline-block h-4 w-4 rounded-full transition-transform duration-150"
              style={{
                backgroundColor: checked ? 'var(--brand-action-fg)' : 'var(--switch-thumb)',
                transform: checked ? 'translateX(24px)' : 'translateX(4px)',
              }}
            />
          </span>
        </button>
      </div>
    );
  };

  /* ========================================================================
     Vertical ARIA Tablist Keyboard Navigation (ArrowUp / ArrowDown / Home / End)
     ======================================================================== */
  const handleDockKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx = idx;
    if (e.key === 'ArrowDown') nextIdx = (idx + 1) % SETTINGS_DOCK_ITEMS.length;
    else if (e.key === 'ArrowUp')
      nextIdx = (idx - 1 + SETTINGS_DOCK_ITEMS.length) % SETTINGS_DOCK_ITEMS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = SETTINGS_DOCK_ITEMS.length - 1;
    else return;

    e.preventDefault();
    const target = SETTINGS_DOCK_ITEMS[nextIdx];
    selectSettingsTab(target.id);
    tabRefs.current[nextIdx]?.focus();
  };

  return createPortal(
    <div
      ref={portalRef}
      style={{
        zIndex: 'var(--z-modal)',
        paddingTop: 'calc(var(--top-bar-height, 56px) + env(safe-area-inset-top, 0px))',
      }}
      className={`fixed inset-0 flex items-end justify-center overflow-hidden p-0 sm:px-4 ${
        isExiting ? 'pointer-events-none' : ''
      }`}
    >
      {/* Independent opaque backdrop scrim so its late-stage fade never makes the Settings drawer see-through early */}
      <div
        ref={scrimRef}
        aria-hidden="true"
        onClick={handleRequestClose}
        className="wb-settings-scrim absolute inset-0"
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        tabIndex={-1}
        className="wb-settings-drawer relative z-10 flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border-t border-[var(--border-hairline)] focus:outline-none sm:max-h-[840px] sm:rounded-t-3xl sm:border-x"
      >
        {/* Interactive Grab Top Bar: Drag Up/Down with Mouse or Touch to Slowly Open or Close */}
        <div
          data-no-drag-scroll="true"
          onPointerDown={handleHeaderPointerDown}
          title="Grab and drag down to close Settings"
          className="wb-settings-grab-header shrink-0 border-b border-[var(--border-hairline)] bg-[var(--surface-card)] px-4 pt-2.5 pb-3 sm:px-6 sm:pt-3 sm:pb-3.5"
        >
          <div
            aria-hidden="true"
            className="mx-auto mb-2 h-1.5 w-11 rounded-full bg-[var(--border-strong)] transition-opacity hover:opacity-90"
          />
          <div className="flex items-center justify-between gap-3">
            <h1
              id="settings-modal-title"
              className="text-lg font-semibold tracking-tight text-[var(--ink-primary)]"
            >
              Settings
            </h1>
            <button
              type="button"
              data-no-drag-scroll="true"
              data-no-settings-grab="true"
              onClick={handleRequestClose}
              aria-label="Close Settings"
              className="wb-overlay-close-btn flex h-[44px] w-[44px] min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl p-0 text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Polite Screen-Reader Status Live Region */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {liveStatus}
        </div>

        {/* Pattern 2: Compact Side-Dock (Left Rail + Independently Scrollable Right Content Pane) */}
        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          {/* Permanent Vertical Left Navigation Rail */}
          <aside
            aria-label="Settings categories"
            className="wb-settings-rail hide-scrollbar overflow-y-auto"
          >
            <div
              role="tablist"
              aria-orientation="vertical"
              aria-label="Settings sections"
              className="flex flex-col gap-2"
            >
              {SETTINGS_DOCK_ITEMS.map((item, idx) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      tabRefs.current[idx] = el;
                    }}
                    id={`settings-tab-${item.id}`}
                    type="button"
                    role="tab"
                    data-no-drag-scroll="true"
                    aria-label={item.ariaLabel}
                    aria-selected={active}
                    aria-controls={`settings-panel-${item.id}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => selectSettingsTab(item.id)}
                    onKeyDown={(e) => handleDockKeyDown(e, idx)}
                    className={`relative box-border flex min-h-[64px] w-full flex-col items-center justify-center gap-1.5 rounded-[14px] px-[3px] py-2.5 text-center transition-colors focus-visible:outline-offset-1 lg:min-h-[48px] lg:flex-row lg:justify-start lg:gap-2.5 lg:px-3 lg:text-left ${
                      active ? 'wb-dock-tile-active' : 'wb-dock-tile hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    {/* Left-Edge Active Indicator Pill */}
                    {active && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-0.5 top-1/2 h-6 w-[2.5px] -translate-y-1/2 rounded-full lg:left-1 lg:w-[3px]"
                        style={{ backgroundColor: 'var(--dock-active-indicator)' }}
                      />
                    )}
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="wb-dock-label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Independently Scrollable Right Content Pane (Container Query Enabled + Drag-to-Scroll + Top Pull-Down Handoff) */}
          <div
            ref={bodyRef}
            onPointerDown={handleBodyPointerDown}
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 44px)',
            }}
            className="wb-settings-pane min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3.5 pt-4 sm:px-6 sm:pt-5"
          >
            {/* ================================================================
                TAB 1: ACCOUNT, IDENTITY & BILLING
                ================================================================ */}
            {activeTab === 'account' && (
              <AccountIdentityBillingTab
                openSubAccordionId={openSubAccordionId}
                onToggleSubAccordion={toggleSubAccordion}
                onAnnounce={setLiveStatus}
                onNotify={onNotify}
                onSubTabChange={handleAccountSubTabChange}
              />
            )}

            {/* ================================================================
                TAB 2: WEARABLES (Telemetry + Streamlined Single-Open Sections)
                ================================================================ */}
            {activeTab === 'wearables' && (
              <WearablesTab
                openSectionId={openSubAccordionId}
                onToggleSection={toggleSubAccordion}
                onOpenSection={openSubAccordion}
                settings={settings}
                todayBio={todayBio}
                wearables={wearables}
                onUpdateWearables={onUpdateWearables}
                onUpdateSettings={onUpdateSettings}
                onSyncWatch={onSyncWatch}
                onSimulateWatchCheckIn={onSimulateWatchCheckIn}
                onSimulateStressSpike={onSimulateStressSpike}
                onOpenPhoneHandoff={onOpenPhoneHandoff}
                onAnnounce={setLiveStatus}
                onNotify={onNotify}
              />
            )}

            {/* ================================================================
                TAB 3: APPEARANCE & SENSORY ACCESSIBILITY (100% Preserved + Narrow-Pane Hardened)
                ================================================================ */}
            {activeTab === 'accessibility' && (
              <div
                id="settings-panel-accessibility"
                role="tabpanel"
                aria-labelledby="settings-tab-accessibility"
                className="wb-calm-stack space-y-5"
              >
                <SettingsTabHeader
                  title="Appearance & Sensory Accessibility"
                  subtitle="Tokenized themes and neuro-inclusive regulation controls"
                />

                {/* Live Mini Preview Strip */}
                <div
                  aria-label="Live theme and accessibility preview"
                  className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3.5 sm:p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-semibold text-[var(--ink-muted)]">
                    <span>Live Mini Preview</span>
                    <span className="font-mono-tabular">
                      {a11y.highContrast ? 'AAA Contrast' : 'AA+ Contrast'}
                      {a11y.calmMode ? ' · Calm' : ''}
                      {a11y.reduceTransparency ? ' · Solid' : ''}
                      {a11y.quietCues ? ' · Quiet' : ''}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Sample Emotion Tile */}
                    <div
                      className="relative inline-flex min-h-[38px] items-center gap-1.5 overflow-hidden rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--q-green-bg)',
                        color: 'var(--q-green-fg)',
                        border: '1px solid var(--q-green-border)',
                      }}
                    >
                      {a11y.patternAssist && (
                        <span
                          aria-hidden="true"
                          className="wb-pattern-green pointer-events-none absolute inset-0 opacity-[0.14]"
                        />
                      )}
                      <span className="relative z-10 inline-flex items-center gap-1.5">
                        <AffectiveGlyph emotionId="calm" quadrant="green" size={14} />
                        <span>Calm</span>
                        {a11y.patternAssist && (
                          <span className="font-mono-tabular text-[10px] opacity-90">Calm+</span>
                        )}
                      </span>
                    </div>

                    {/* Primary Button + Highlight Badge */}
                    <span
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--brand-action-bg)',
                        color: 'var(--brand-action-fg)',
                      }}
                    >
                      <Wind className="h-3.5 w-3.5 shrink-0" />
                      <span>{a11y.plainLanguage ? 'Start Breathing' : '4-7-8 Reset'}</span>
                      <span
                        className="ml-0.5 rounded-md px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold"
                        style={{
                          backgroundColor: 'var(--accent-highlight)',
                          color: 'var(--accent-highlight-ink)',
                          border: '1px solid var(--accent-highlight-border)',
                        }}
                      >
                        2m
                      </span>
                    </span>

                    {/* Liquid Glass Chip */}
                    <span className="liquid-glass inline-flex min-h-[38px] max-w-full items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-primary)]">
                      <Activity className="h-3.5 w-3.5 shrink-0 text-[var(--bio-mint)]" />
                      <span className="min-w-0 break-words font-mono-tabular">
                        {a11y.plainLanguage ? 'Heart Rate Variability 64ms' : 'HRV 64ms'}
                      </span>
                    </span>
                  </div>

                  <p className="wb-prose rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-2 text-xs text-[var(--ink-secondary)]">
                    Take one slow breath and let your shoulders drop. Every sensory setting applies
                    across all tabs with zero page reload.
                  </p>
                </div>

                {/* Quick One-Tap Presets + Undo Pill */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[var(--ink-muted)]">
                      Quick One-Tap Presets
                    </p>
                    {a11y.canRestorePrevious && (
                      <button
                        type="button"
                        data-no-drag-scroll="true"
                        onClick={a11y.restorePreviousSettings}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--brand-accent-border)] bg-[var(--brand-accent-soft)] px-3 text-xs font-semibold text-[var(--brand-accent-text)] hover:opacity-90"
                      >
                        <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                        <span>Restore Previous</span>
                      </button>
                    )}
                  </div>

                  <div className="wb-pane-grid-3">
                    <button
                      type="button"
                      data-no-drag-scroll="true"
                      aria-pressed={a11y.activePreset === 'overwhelmed'}
                      onClick={() => a11y.applyPreset('overwhelmed')}
                      className="flex min-h-[52px] flex-col items-start justify-center rounded-xl border px-3 py-2.5 text-left transition-colors"
                      style={{
                        backgroundColor:
                          a11y.activePreset === 'overwhelmed'
                            ? 'var(--brand-action-bg)'
                            : 'var(--surface-subtle)',
                        color:
                          a11y.activePreset === 'overwhelmed'
                            ? 'var(--brand-action-fg)'
                            : 'var(--ink-primary)',
                        borderColor:
                          a11y.activePreset === 'overwhelmed'
                            ? 'var(--brand-action-bg)'
                            : 'var(--border-hairline)',
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                        <Sparkles className="h-3.5 w-3.5 shrink-0" />
                        <span>Overwhelmed Right Now</span>
                      </span>
                      <span className="mt-0.5 text-[11px] opacity-85">
                        Calm · Still · Focus · Plain · Quiet
                      </span>
                    </button>

                    <button
                      type="button"
                      data-no-drag-scroll="true"
                      aria-pressed={a11y.activePreset === 'max-clarity'}
                      onClick={() => a11y.applyPreset('max-clarity')}
                      className="flex min-h-[52px] flex-col items-start justify-center rounded-xl border px-3 py-2.5 text-left transition-colors"
                      style={{
                        backgroundColor:
                          a11y.activePreset === 'max-clarity'
                            ? 'var(--brand-action-bg)'
                            : 'var(--surface-subtle)',
                        color:
                          a11y.activePreset === 'max-clarity'
                            ? 'var(--brand-action-fg)'
                            : 'var(--ink-primary)',
                        borderColor:
                          a11y.activePreset === 'max-clarity'
                            ? 'var(--brand-action-bg)'
                            : 'var(--border-hairline)',
                      }}
                    >
                      <span className="text-xs font-semibold">Max Clarity</span>
                      <span className="mt-0.5 text-[11px] opacity-85">
                        AAA · Solid · Reading · Patterns
                      </span>
                    </button>

                    <button
                      type="button"
                      data-no-drag-scroll="true"
                      onClick={handleResetAccessibilityDefaults}
                      className="flex min-h-[52px] flex-col items-start justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-2.5 text-left text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <span className="text-xs font-semibold">Reset to Defaults</span>
                      <span className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                        Restore OS &amp; app defaults
                      </span>
                    </button>
                  </div>

                  {a11y.announcement && (
                    <p
                      role="status"
                      aria-live="polite"
                      className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--ink-secondary)]"
                    >
                      {a11y.announcement}
                    </p>
                  )}
                </div>

                {/* ============================================================
                    SINGLE COLLAPSIBLE CUSTOM ADJUSTMENTS + SAMPLE DATA & RESET
                    ============================================================ */}
                {(() => {
                  const themeLabel =
                    settings.theme.charAt(0).toUpperCase() + settings.theme.slice(1);
                  const activeCustomCount = [
                    a11y.highContrast,
                    a11y.reduceTransparency,
                    a11y.calmMode,
                    a11y.patternAssist,
                    a11y.reduceMotion,
                    a11y.quietCues,
                    a11y.readingComfort,
                    a11y.focusMode,
                    a11y.plainLanguage,
                  ].filter(Boolean).length;

                  const customPills: BentoSummaryPill[] = [
                    { label: `Theme: ${themeLabel}`, tone: 'accent' },
                    {
                      label:
                        activeCustomCount > 0
                          ? `${activeCustomCount} ${activeCustomCount === 1 ? 'Adjustment' : 'Adjustments'} On`
                          : 'Standard Defaults',
                      tone: activeCustomCount > 0 ? 'positive' : 'neutral',
                    },
                  ];

                  const dataPills: BentoSummaryPill[] = [
                    { label: 'Local Data', tone: 'neutral' },
                  ];

                  return (
                    <div className="wb-calm-stack space-y-3.5">
                      {/* Single Collapsible Custom Adjustments Section (Collapsed by Default) */}
                      <SettingsBentoAccordion
                        id="a11y-custom"
                        title="Custom Adjustments"
                        subtitle="Fine-grained theme, contrast, motion, sound, and reading toggles"
                        icon={<SlidersHorizontal className="h-4 w-4" />}
                        pills={customPills}
                        isOpen={openSubAccordionId === 'custom'}
                        onToggle={() => toggleSubAccordion('custom')}
                      >
                        <div className="space-y-5">
                          {/* Color Theme Selector */}
                          <div>
                            <p className="mb-2 text-xs font-semibold text-[var(--ink-muted)]">
                              Color Theme
                            </p>
                            <div
                              className="grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-1"
                              role="group"
                              aria-label="Color theme"
                            >
                              {(['system', 'light', 'dark'] as const).map((t) => {
                                const active = settings.theme === t;
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    data-no-drag-scroll="true"
                                    onClick={() => onUpdateSettings({ theme: t })}
                                    aria-pressed={active}
                                    className="min-h-[44px] min-w-0 rounded-lg px-1.5 text-xs font-semibold capitalize"
                                    style={{
                                      backgroundColor: active
                                        ? 'var(--brand-action-bg)'
                                        : 'transparent',
                                      color: active
                                        ? 'var(--brand-action-fg)'
                                        : 'var(--ink-primary)',
                                    }}
                                  >
                                    {t}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Group 1: Visual & Contrast */}
                          <div>
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                              {a11y.plainLanguage ? 'Colors & Visual Comfort' : 'Visual & Contrast'}
                            </p>
                            <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)]">
                              {renderToggleRow(
                                'highContrast',
                                'High-Contrast Mode',
                                'Raises borders, quadrant luminance, and chart contrast to WCAG AAA targets.'
                              )}
                              {renderToggleRow(
                                'reduceTransparency',
                                'Reduce Transparency',
                                'Replaces Liquid Glass navigation and sheets with solid opaque surfaces.'
                              )}
                              {renderToggleRow(
                                'calmMode',
                                'Low-Stimulus / Calm Mode',
                                'Mutes streaks, variance labels, and nudges so only essential check-in & grounding controls remain.'
                              )}
                              {renderToggleRow(
                                'patternAssist',
                                'Pattern Assist',
                                'Adds subtle micro-patterns and quadrant text codes alongside color encodings.'
                              )}
                            </div>
                          </div>

                          {/* Group 2: Motion & Sensory */}
                          <div>
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                              {a11y.plainLanguage ? 'Motion & Sound' : 'Motion & Sensory'}
                            </p>
                            <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)]">
                              {renderToggleRow(
                                'reduceMotion',
                                'Reduce Motion',
                                'Converts breathing animations and transitions to static numeric pacing.'
                              )}
                              {renderToggleRow(
                                'quietCues',
                                'Quiet / Visual-Only Cues',
                                'Keeps voice narration, chimes, and vibration silenced unless you unmute inside a session.'
                              )}
                            </div>
                          </div>

                          {/* Group 3: Reading & Focus */}
                          <div>
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                              {a11y.plainLanguage ? 'Reading & Focus' : 'Reading & Cognitive Load'}
                            </p>
                            <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)]">
                              {renderToggleRow(
                                'readingComfort',
                                'Reading Comfort',
                                'Increases base text scale, line spacing, and letter tracking across every screen.'
                              )}
                              {renderToggleRow(
                                'focusMode',
                                'Focus Mode',
                                'Collapses secondary widgets and keeps only one Settings section open at a time.'
                              )}
                              {renderToggleRow(
                                'plainLanguage',
                                'Plain Language',
                                'Reveals explicit text labels on icon buttons and expands clinical abbreviations.'
                              )}
                            </div>
                          </div>
                        </div>
                      </SettingsBentoAccordion>

                      {/* Sample Data & Reset (Preserved Unchanged) */}
                      <SettingsBentoAccordion
                        id="a11y-data"
                        title="Sample Data & Reset"
                        subtitle="Restore 30-day sample mood history or reset accessibility defaults"
                        pills={dataPills}
                        isOpen={openSubAccordionId === 'data'}
                        onToggle={() => toggleSubAccordion('data')}
                      >
                        <div className="space-y-3">
                          <div className="wb-pane-item-card rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[var(--ink-primary)]">
                                Local Sample Dataset
                              </p>
                              <p className="wb-prose mt-0.5 text-xs text-[var(--ink-muted)]">
                                Restore 30 days of sample mood logs and Pixel Watch metrics.
                              </p>
                            </div>
                            <div className="wb-pane-item-actions">
                              <button
                                type="button"
                                data-no-drag-scroll="true"
                                onClick={() => {
                                  onResetDemoData();
                                  a11y.announce(
                                    'Sample 30-day mood journal and Pixel Watch data restored.'
                                  );
                                  setLiveStatus('Sample 30-day data restored.');
                                }}
                                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3.5 py-2 text-center text-xs font-semibold leading-snug text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                              >
                                Restore Sample 30-Day Data
                              </button>
                            </div>
                          </div>

                          <div className="wb-pane-item-card rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[var(--ink-primary)]">
                                Accessibility Preferences
                              </p>
                              <p className="wb-prose mt-0.5 text-xs text-[var(--ink-muted)]">
                                Reset all theme, contrast, motion, and reading controls to OS defaults.
                              </p>
                            </div>
                            <div className="wb-pane-item-actions">
                              {a11y.canRestorePrevious && (
                                <button
                                  type="button"
                                  data-no-drag-scroll="true"
                                  onClick={a11y.restorePreviousSettings}
                                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--brand-accent-border)] bg-[var(--brand-accent-soft)] px-3 py-2 text-center text-xs font-semibold leading-snug text-[var(--brand-accent-text)] hover:opacity-90"
                                >
                                  <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                                  <span>Restore Previous</span>
                                </button>
                              )}
                              <button
                                type="button"
                                data-no-drag-scroll="true"
                                onClick={handleResetAccessibilityDefaults}
                                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3.5 py-2 text-center text-xs font-semibold leading-snug text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                              >
                                Reset Accessibility Defaults
                              </button>
                            </div>
                          </div>
                        </div>
                      </SettingsBentoAccordion>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ================================================================
                TAB 4: HELP & SUPPORT (Compassionate Grounding, 988/NAMI & Feedback)
                ================================================================ */}
            {activeTab === 'support' && (
              <HelpSupportTab
                openSectionId={openSubAccordionId}
                onToggleSection={toggleSubAccordion}
                onOpenSection={openSubAccordion}
                activeView={activeView}
                themeLabel={settings.theme.charAt(0).toUpperCase() + settings.theme.slice(1)}
                onLaunchBreathingReset={onLaunchBreathingReset}
                onAnnounce={setLiveStatus}
                onNotify={onNotify}
              />
            )}

            {/* ================================================================
                TAB 5: HELP, LEGAL & ABOUT (Version, Single-Open Legal & Defaults)
                ================================================================ */}
            {activeTab === 'about' && (
              <HelpLegalAboutTab
                openSectionId={openSubAccordionId}
                onToggleSection={toggleSubAccordion}
                onResetAppDefaults={onResetAppDefaults}
                onAnnounce={setLiveStatus}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open = true,
  initialTab = 'account',
  onMountedChange,
  ...rest
}) => {
  const [mounted, setMounted] = useState(open);
  const [resolvedTab, setResolvedTab] = useState<SettingsTabId>(initialTab);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setResolvedTab(initialTab);
    }
  }, [open, initialTab]);

  const onMountedChangeRef = useRef(onMountedChange);
  onMountedChangeRef.current = onMountedChange;

  useEffect(() => {
    onMountedChangeRef.current?.(mounted);
  }, [mounted]);

  useEffect(() => {
    return () => {
      onMountedChangeRef.current?.(false);
    };
  }, []);

  const handleExitComplete = useCallback(() => {
    setMounted(false);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  return (
    <SettingsDrawerInner
      {...rest}
      open={open}
      initialTab={resolvedTab}
      onExitComplete={handleExitComplete}
    />
  );
};


