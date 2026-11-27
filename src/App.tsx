import React, {
  Suspense,
  forwardRef,
  lazy,
  useCallback,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Settings,
  X,
} from 'lucide-react';
import {
  AppSettings,
  AppTab,
  CoachMessage,
  ContextTag,
  DailyBiometrics,
  EmotionDef,
  MoodEntry,
  NudgeWindow,
  ResetProtocol,
  ScheduledRoutine,
} from './types/wellbe';
import {
  ALL_EMOTIONS_MAP,
  DEFAULT_SETTINGS,
  INITIAL_NUDGES,
  INITIAL_ROUTINES,
  RESET_PROTOCOLS,
  buildSeedData,
  getDayWindowFromHour,
  toLocalDateKey,
} from './data/wellbeData';
import { computeActiveStreak, computeAnalytics } from './utils/analytics';
import {
  safeReadStorage,
  safeWriteStorage,
  sanitizeBiometrics,
  sanitizeCoachMessages,
  sanitizeEntries,
  sanitizeNudges,
  sanitizeRoutines,
  sanitizeSettings,
} from './utils/storage';
import { TodayTab, type QuickLogResult } from './components/TodayTab';
import type { SettingsTabId } from './components/SettingsModal';
import { ExpandingCapsuleDock } from './components/ExpandingCapsuleDock';

const RoutinesTab = lazy(() =>
  import('./components/RoutinesTab').then((m) => ({ default: m.RoutinesTab }))
);
const LogTab = lazy(() =>
  import('./components/LogTab').then((m) => ({ default: m.LogTab }))
);
const TrendsTab = lazy(() =>
  import('./components/TrendsTab').then((m) => ({ default: m.TrendsTab }))
);
const CoachTab = lazy(() =>
  import('./components/CoachTab').then((m) => ({ default: m.CoachTab }))
);
const loadSomaticPlayers = () => import('./components/SomaticPlayers');
const ProtocolPlayerModal = lazy(() =>
  loadSomaticPlayers().then((m) => ({ default: m.ProtocolPlayerModal }))
);
const VoicePanicAnchorOverlay = lazy(() =>
  loadSomaticPlayers().then((m) => ({ default: m.VoicePanicAnchorOverlay }))
);
const loadModalsAndCommandBar = () => import('./components/ModalsAndCommandBar');
const CommandPalette = lazy(() =>
  loadModalsAndCommandBar().then((m) => ({ default: m.CommandPalette }))
);
const NudgesModal = lazy(() =>
  loadModalsAndCommandBar().then((m) => ({ default: m.NudgesModal }))
);
const QuickCheckInSheet = lazy(() =>
  loadModalsAndCommandBar().then((m) => ({ default: m.QuickCheckInSheet }))
);
const RoutineBuilderModal = lazy(() =>
  loadModalsAndCommandBar().then((m) => ({ default: m.RoutineBuilderModal }))
);
const TherapistSummaryModal = lazy(() =>
  loadModalsAndCommandBar().then((m) => ({ default: m.TherapistSummaryModal }))
);
const SettingsModal = lazy(() =>
  import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
import { cancelActiveDragScroll, useGlobalDragToScroll } from './hooks/useDragToScroll';
import { useFocusTrap } from './hooks/useFocusTrap';
import { useViewportEdgeRecession } from './hooks/useViewportEdgeRecession';
import { useAccessibility } from './context/AccessibilityContext';
import {
  DEFAULT_WEARABLES_STATE,
  WearableSettingsState,
  getWearableDeviceInfo,
  readWearablesState,
  writeWearablesState,
} from './utils/wearablesStorage';

const STORAGE_KEYS = {
  entries: 'wellbe_v1_entries',
  biometrics: 'wellbe_v1_biometrics',
  routines: 'wellbe_v1_routines',
  nudges: 'wellbe_v1_nudges',
  settings: 'wellbe_v1_settings',
  coach: 'wellbe_v1_coach',
  resetDuration: 'wellbe_v1_reset_duration',
};

const TOAST_MAX_DURATION_MS = 5000;
const TOAST_DEFAULT_DURATION_MS = 3200;
const TOAST_CHECKIN_DURATION_MS = 2000;
const TOAST_EXIT_MS = 200;
const TOAST_REDUCED_EXIT_MS = 80;

function isToastReduceMotion(): boolean {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-reduce-motion');
    if (attr === 'true') return true;
    if (attr === 'false') return false;
  }
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

interface ToastPayload {
  id: number;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}

interface ToastHostHandle {
  show: (
    title: string,
    subtitle?: string,
    action?: { label: string; onClick: () => void },
    durationMs?: number
  ) => void;
  dismiss: (immediate?: boolean) => void;
}

/**
 * Isolated ToastHost: showing or auto-dismissing a toast renders ONLY this banner,
 * never re-rendering App, TodayTab, LogTab, TrendsTab, or ExpandingCapsuleDock.
 */
const ToastHost = React.memo(
  forwardRef<ToastHostHandle>((_, ref) => {
    const [toast, setToast] = useState<ToastPayload | null>(null);
    const [isExiting, setIsExiting] = useState(false);
    const toastRef = useRef<ToastPayload | null>(null);
    toastRef.current = toast;
    const seqRef = useRef(0);
    const timerRef = useRef<number | null>(null);
    const exitTimerRef = useRef<number | null>(null);
    const bannerRef = useRef<HTMLDivElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const clearTimers = useCallback(() => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    }, []);

    const restoreFocusIfInsideToast = useCallback(() => {
      const active = document.activeElement;
      if (!active || !bannerRef.current || !bannerRef.current.contains(active)) {
        return;
      }
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      if (
        prev &&
        prev.isConnected &&
        !prev.hasAttribute('disabled') &&
        !prev.closest('[hidden], [inert]')
      ) {
        prev.focus({ preventScroll: true });
        return;
      }
      const mainEl = document.getElementById('main-content');
      if (mainEl) {
        if (!mainEl.hasAttribute('tabindex')) {
          mainEl.setAttribute('tabindex', '-1');
        }
        mainEl.focus({ preventScroll: true });
      } else if (active instanceof HTMLElement) {
        active.blur();
      }
    }, []);

    const dismiss = useCallback(
      (immediate = false) => {
        clearTimers();
        restoreFocusIfInsideToast();
        if (!toastRef.current) {
          setIsExiting(false);
          return;
        }
        if (immediate) {
          setIsExiting(false);
          setToast(null);
          return;
        }
        setIsExiting(true);
        const exitMs = isToastReduceMotion() ? TOAST_REDUCED_EXIT_MS : TOAST_EXIT_MS;
        exitTimerRef.current = window.setTimeout(() => {
          exitTimerRef.current = null;
          setIsExiting(false);
          setToast(null);
        }, exitMs);
      },
      [clearTimers, restoreFocusIfInsideToast]
    );

    useImperativeHandle(
      ref,
      () => ({
        show: (title, subtitle, action, durationMs = TOAST_DEFAULT_DURATION_MS) => {
          clearTimers();
          const active = document.activeElement;
          if (
            active instanceof HTMLElement &&
            (!bannerRef.current || !bannerRef.current.contains(active))
          ) {
            previousFocusRef.current = active;
          }
          const safeDuration = Math.min(
            TOAST_MAX_DURATION_MS,
            Math.max(
              1200,
              Number.isFinite(durationMs)
                ? Math.round(durationMs)
                : TOAST_DEFAULT_DURATION_MS
            )
          );
          seqRef.current += 1;
          setIsExiting(false);
          setToast({ id: seqRef.current, title, subtitle, action });
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            dismiss(false);
          }, safeDuration);
        },
        dismiss,
      }),
      [clearTimers, dismiss]
    );

    useEffect(() => {
      return () => {
        clearTimers();
      };
    }, [clearTimers]);

    const handleActionClick = useCallback(() => {
      const current = toastRef.current;
      if (!current?.action || isExiting) return;
      clearTimers();
      const clickedId = current.id;
      current.action.onClick();
      if (seqRef.current === clickedId) {
        dismiss(false);
      }
    }, [clearTimers, dismiss, isExiting]);

    if (!toast) return null;

    return (
      <div
        style={{
          zIndex: 'var(--z-toast)',
          bottom:
            'calc(var(--capsule-dock-height, 60px) + var(--capsule-dock-lift, 16px) + env(safe-area-inset-bottom, 0px) + 12px)',
        }}
        className="pointer-events-none fixed inset-x-0 flex justify-center px-4"
      >
        <div
          key={toast.id}
          ref={bannerRef}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-toast-host="true"
          data-exiting={isExiting ? 'true' : 'false'}
          className="wb-toast-banner liquid-glass-strong pointer-events-none flex w-full max-w-sm items-center justify-between gap-2.5 rounded-2xl px-4 py-2.5"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[var(--ink-primary)]">
              {toast.title}
            </p>
            {toast.subtitle && (
              <p className="truncate text-xs text-[var(--ink-muted)]">{toast.subtitle}</p>
            )}
          </div>
          <div
            className={`flex shrink-0 items-center gap-1 ${
              isExiting ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          >
            {toast.action && (
              <button
                type="button"
                disabled={isExiting}
                tabIndex={isExiting ? -1 : 0}
                onClick={handleActionClick}
                className="min-h-[36px] rounded-xl px-3 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-primary-ink)',
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              disabled={isExiting}
              tabIndex={isExiting ? -1 : 0}
              onClick={() => dismiss(false)}
              aria-label="Dismiss notification"
              className="flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  })
);
ToastHost.displayName = 'ToastHost';

export default function App() {
  const a11y = useAccessibility();
  const seedRef = useRef<{ entries: MoodEntry[]; biometrics: DailyBiometrics[] } | null>(null);
  const getSeed = () => {
    if (!seedRef.current) seedRef.current = buildSeedData();
    return seedRef.current;
  };

  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const activeTabRef = useRef<AppTab>(activeTab);
  activeTabRef.current = activeTab;
  // Mount secondary tabs lazily on first visit so initial paint stays fast and
  // heavy analytics/charts only compute when needed, then keep visited tabs mounted for zero-flash switching.
  const [mountedTabs, setMountedTabs] = useState<Record<AppTab, boolean>>({
    today: true,
    routines: false,
    log: false,
    trends: false,
    coach: false,
  });
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);

  // Hardened localStorage hydration with schema validation & corruption fallbacks
  const [entries, setEntries] = useState<MoodEntry[]>(() =>
    safeReadStorage(STORAGE_KEYS.entries, sanitizeEntries, () => getSeed().entries)
  );
  const [biometrics, setBiometrics] = useState<DailyBiometrics[]>(() =>
    safeReadStorage(STORAGE_KEYS.biometrics, sanitizeBiometrics, () => getSeed().biometrics)
  );
  const [routines, setRoutines] = useState<ScheduledRoutine[]>(() =>
    safeReadStorage(STORAGE_KEYS.routines, sanitizeRoutines, () => INITIAL_ROUTINES)
  );
  const [nudges, setNudges] = useState<NudgeWindow[]>(() =>
    safeReadStorage(STORAGE_KEYS.nudges, sanitizeNudges, () => INITIAL_NUDGES)
  );
  const [settings, setSettings] = useState<AppSettings>(() =>
    safeReadStorage(STORAGE_KEYS.settings, sanitizeSettings, () => {
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return { ...DEFAULT_SETTINGS, reduceMotion: prefersReduced };
    })
  );
  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>(() =>
    safeReadStorage(STORAGE_KEYS.coach, sanitizeCoachMessages, () => [])
  );
  const [wearables, setWearables] = useState<WearableSettingsState>(() =>
    readWearablesState()
  );

  // Overlays & Modals
  const [quickSheetOpen, setQuickSheetOpen] = useState(false);
  const [quickSheetMounted, setQuickSheetMounted] = useState(false);
  const hasOpenedQuickSheetRef = useRef(false);
  if (quickSheetOpen) hasOpenedQuickSheetRef.current = true;
  const [settingsTab, setSettingsTab] = useState<SettingsTabId | null>(null);
  const [settingsDrawerMounted, setSettingsDrawerMounted] = useState(false);
  const hasOpenedSettingsRef = useRef(false);
  if (settingsTab !== null) hasOpenedSettingsRef.current = true;
  const [nudgesModalOpen, setNudgesModalOpen] = useState(false);
  const [therapistModalOpen, setTherapistModalOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [panicAnchorOpen, setPanicAnchorOpen] = useState(false);
  const [handoffEntry, setHandoffEntry] = useState<MoodEntry | null>(null);
  const [handoffNoteOpen, setHandoffNoteOpen] = useState(false);
  const [handoffNoteDraft, setHandoffNoteDraft] = useState('');
  const [routineBuilderTarget, setRoutineBuilderTarget] = useState<
    ScheduledRoutine | 'new' | null
  >(null);
  const [activePlayer, setActivePlayer] = useState<{
    protocols: ResetProtocol[];
    titleOverride?: string;
  } | null>(null);
  const [resetDurationState, setResetDurationState] = useState<{
    minutes: number;
    customized: boolean;
  }>(() =>
    safeReadStorage(
      STORAGE_KEYS.resetDuration,
      (raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const obj = raw as Record<string, unknown>;
        if (
          typeof obj.minutes === 'number' &&
          Number.isFinite(obj.minutes) &&
          obj.minutes >= 1 &&
          obj.minutes <= 30
        ) {
          return {
            minutes: Math.round(obj.minutes),
            customized: Boolean(obj.customized),
          };
        }
        return null;
      },
      () => ({ minutes: 2, customized: false })
    )
  );
  const resetDurationMin = resetDurationState.minutes;
  const hasCustomResetDuration = resetDurationState.customized;
  const handleChangeResetDuration = useCallback((mins: number, isManual = true) => {
    const safeMin = Number.isFinite(mins) ? Math.max(1, Math.min(30, Math.round(mins))) : 2;
    setResetDurationState((prev) => {
      const nextCustomized = isManual ? true : prev.customized;
      if (prev.minutes === safeMin && prev.customized === nextCustomized) return prev;
      return {
        minutes: safeMin,
        customized: nextCustomized,
      };
    });
  }, []);
  const handoffModalRef = useRef<HTMLDivElement>(null);

  // Isolated Toast controller (zero App re-renders on toast show/dismiss)
  const toastHostRef = useRef<ToastHostHandle | null>(null);
  const coachFocusTimerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (
      title: string,
      subtitle?: string,
      action?: { label: string; onClick: () => void },
      durationMs = TOAST_DEFAULT_DURATION_MS
    ) => {
      toastHostRef.current?.show(title, subtitle, action, durationMs);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (coachFocusTimerRef.current) window.clearTimeout(coachFocusTimerRef.current);
    };
  }, []);

  // Safe localStorage persistence — idle-scheduled for entries to keep emotion taps <16ms,
  // with synchronous pagehide/beforeunload flush so zero check-ins are ever lost.
  const pendingEntriesFlushRef = useRef<MoodEntry[] | null>(null);
  const entriesWriteHandleRef = useRef<number | null>(null);
  const isInitialEntriesMountRef = useRef(true);

  useEffect(() => {
    if (isInitialEntriesMountRef.current) {
      isInitialEntriesMountRef.current = false;
      return;
    }
    pendingEntriesFlushRef.current = entries;

    const flush = () => {
      entriesWriteHandleRef.current = null;
      const snapshot = pendingEntriesFlushRef.current;
      if (snapshot !== null) {
        pendingEntriesFlushRef.current = null;
        safeWriteStorage(STORAGE_KEYS.entries, snapshot);
      }
    };

    if (entriesWriteHandleRef.current !== null) {
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(entriesWriteHandleRef.current);
      } else {
        window.clearTimeout(entriesWriteHandleRef.current);
      }
    }

    if (typeof window.requestIdleCallback === 'function') {
      entriesWriteHandleRef.current = window.requestIdleCallback(flush, { timeout: 250 });
    } else {
      entriesWriteHandleRef.current = window.setTimeout(flush, 60);
    }
  }, [entries]);

  useEffect(() => {
    const flushNow = () => {
      if (pendingEntriesFlushRef.current !== null) {
        const snapshot = pendingEntriesFlushRef.current;
        pendingEntriesFlushRef.current = null;
        safeWriteStorage(STORAGE_KEYS.entries, snapshot);
      }
    };
    window.addEventListener('pagehide', flushNow);
    window.addEventListener('beforeunload', flushNow);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      window.removeEventListener('beforeunload', flushNow);
      flushNow();
    };
  }, []);

  const isInitialPersistRef = useRef({
    biometrics: true,
    routines: true,
    nudges: true,
    settings: true,
    coach: true,
    wearables: true,
    resetDuration: true,
  });

  useEffect(() => {
    if (isInitialPersistRef.current.biometrics) {
      isInitialPersistRef.current.biometrics = false;
      return;
    }
    safeWriteStorage(STORAGE_KEYS.biometrics, biometrics);
  }, [biometrics]);

  useEffect(() => {
    if (isInitialPersistRef.current.routines) {
      isInitialPersistRef.current.routines = false;
      return;
    }
    safeWriteStorage(STORAGE_KEYS.routines, routines);
  }, [routines]);

  useEffect(() => {
    if (isInitialPersistRef.current.nudges) {
      isInitialPersistRef.current.nudges = false;
      return;
    }
    safeWriteStorage(STORAGE_KEYS.nudges, nudges);
  }, [nudges]);

  useEffect(() => {
    if (isInitialPersistRef.current.settings) {
      isInitialPersistRef.current.settings = false;
      return;
    }
    safeWriteStorage(STORAGE_KEYS.settings, settings);
  }, [settings]);

  useEffect(() => {
    if (isInitialPersistRef.current.coach) {
      isInitialPersistRef.current.coach = false;
      return;
    }
    safeWriteStorage(STORAGE_KEYS.coach, coachMessages);
  }, [coachMessages]);

  useEffect(() => {
    if (isInitialPersistRef.current.wearables) {
      isInitialPersistRef.current.wearables = false;
      return;
    }
    writeWearablesState(wearables);
  }, [wearables]);

  useEffect(() => {
    if (isInitialPersistRef.current.resetDuration) {
      isInitialPersistRef.current.resetDuration = false;
      return;
    }
    safeWriteStorage(STORAGE_KEYS.resetDuration, resetDurationState);
  }, [resetDurationState]);

  const handleUpdateWearables = useCallback(
    (
      updater:
        | Partial<WearableSettingsState>
        | ((prev: WearableSettingsState) => WearableSettingsState)
    ) => {
      setWearables((prev) =>
        typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      );
    },
    []
  );

  // Apply Light/Dark Color Theme to <html> (AccessibilityProvider manages all 9 a11y data-* attributes)
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const shouldBeDark =
        settings.theme === 'dark' || (settings.theme === 'system' && mq.matches);
      root.classList.toggle('dark', shouldBeDark);
    };

    applyTheme();
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [settings.theme]);

  // Unified effective settings merging app state with centralized AccessibilityProvider
  const effectiveSettings = useMemo<AppSettings>(
    () => ({
      ...settings,
      calmMode: a11y.calmMode,
      reduceMotion: a11y.reduceMotion,
      reduceTransparency: a11y.reduceTransparency,
      highContrast: a11y.highContrast,
      readingComfort: a11y.readingComfort,
      focusMode: a11y.focusMode,
      patternAssist: a11y.patternAssist,
      plainLanguage: a11y.plainLanguage,
    }),
    [settings, a11y.calmMode, a11y.reduceMotion, a11y.reduceTransparency, a11y.highContrast, a11y.readingComfort, a11y.focusMode, a11y.patternAssist, a11y.plainLanguage]
  );

  // Global Cmd/Ctrl + K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Global mouse click-and-drag swipe-to-scroll (cancels momentum immediately on tab switch or overlay change)
  const isAnyOverlayOpen =
    quickSheetOpen ||
    quickSheetMounted ||
    Boolean(settingsTab) ||
    settingsDrawerMounted ||
    nudgesModalOpen ||
    therapistModalOpen ||
    commandOpen ||
    panicAnchorOpen ||
    handoffNoteOpen ||
    Boolean(routineBuilderTarget) ||
    Boolean(activePlayer);

  const mainContentRef = useRef<HTMLElement | null>(null);
  const overscrollStageRef = useRef<HTMLDivElement | null>(null);

  const dragCancelKey = `${activeTab}:${quickSheetOpen}:${settingsTab ?? 'closed'}:${nudgesModalOpen}:${therapistModalOpen}:${commandOpen}:${panicAnchorOpen}:${handoffNoteOpen}:${Boolean(routineBuilderTarget)}:${Boolean(activePlayer)}`;
  useGlobalDragToScroll({
    reduceMotion: a11y.reduceMotion,
    cancelKey: dragCancelKey,
    overscrollTargetRef: overscrollStageRef,
  });

  useViewportEdgeRecession(mainContentRef, {
    reduceMotion: a11y.reduceMotion,
    recalculateKey: `${dragCancelKey}:${rangeDays}:${a11y.focusMode}:${a11y.highContrast}`,
    disabled: isAnyOverlayOpen || activeTab === 'coach',
  });

  // Live memoized analytics: compute lightweight streak for Today, and compute heavy
  // 7D/30D correlation/heatmap analytics lazily only when Trends, Coach, or Therapist Summary is active.
  const deferredEntries = useDeferredValue(entries);
  const activeStreak = useMemo(
    () => computeActiveStreak(deferredEntries),
    [deferredEntries]
  );

  const needsAnalytics7D =
    mountedTabs.coach ||
    ((mountedTabs.trends || therapistModalOpen) && rangeDays === 7);
  const needsAnalytics30D =
    (mountedTabs.trends || therapistModalOpen) && rangeDays === 30;

  const analytics7D = useMemo(
    () => (needsAnalytics7D ? computeAnalytics(deferredEntries, biometrics, 7) : null),
    [needsAnalytics7D, deferredEntries, biometrics]
  );

  const analytics = useMemo(() => {
    if (rangeDays === 7) return analytics7D;
    if (!needsAnalytics30D) return null;
    return computeAnalytics(deferredEntries, biometrics, 30);
  }, [analytics7D, needsAnalytics30D, deferredEntries, biometrics, rangeDays]);

  const todayBio = useMemo(() => {
    const key = toLocalDateKey(new Date());
    return biometrics.find((b) => b.dateKey === key) ?? biometrics[biometrics.length - 1];
  }, [biometrics]);
  const latestEntry = entries[0] ?? null;

  // Derive live Predictive Nudge window averages directly from local entries (no static hardcoded strings)
  const liveNudges = useMemo<NudgeWindow[]>(() => {
    const windowStats = (targetWindows: Array<'morn' | 'mid' | 'aft' | 'eve'>) => {
      const matching = deferredEntries.filter((e) => targetWindows.includes(e.dayWindow));
      if (matching.length === 0) return { count: 0, avg: null as number | null };
      const sum = matching.reduce((acc, e) => acc + e.score, 0);
      return {
        count: matching.length,
        avg: Number((sum / matching.length).toFixed(1)),
      };
    };

    return nudges.map((nudge) => {
      const hour = Number(nudge.time.split(':')[0]);
      const isMorning = nudge.id === 'nudge-morning' || (Number.isFinite(hour) && hour < 12);
      const isAfternoon =
        nudge.id === 'nudge-afternoon' ||
        (Number.isFinite(hour) && hour >= 12 && hour < 20);
      const targetWindows: Array<'morn' | 'mid' | 'aft' | 'eve'> = isMorning
        ? ['morn']
        : isAfternoon
          ? ['mid', 'aft']
          : ['eve'];
      const windowLabel = isMorning
        ? 'morning'
        : isAfternoon
          ? 'afternoon'
          : 'evening';
      const stats = windowStats(targetWindows);

      if (stats.count === 0 || stats.avg === null) {
        return {
          ...nudge,
          avgScore: 0,
          historicalBasis: `No ${windowLabel} logs yet · Log check-ins to calibrate`,
        };
      }

      return {
        ...nudge,
        avgScore: stats.avg,
        historicalBasis: `Live ${stats.avg.toFixed(1)}/5.0 avg across ${stats.count} ${windowLabel} ${
          stats.count === 1 ? 'log' : 'logs'
        }`,
      };
    });
  }, [nudges, deferredEntries]);

  const handleCloseHandoff = useCallback(() => {
    setHandoffNoteOpen(false);
  }, []);

  useFocusTrap(handoffModalRef, handleCloseHandoff, handoffNoteOpen && Boolean(handoffEntry));

  const handleSelectTab = useCallback((nextTab: AppTab) => {
    setQuickSheetOpen(false);
    setHandoffNoteOpen(false);
    cancelActiveDragScroll();
    toastHostRef.current?.dismiss(true);
    setMountedTabs((prev) => (prev[nextTab] ? prev : { ...prev, [nextTab]: true }));
    setActiveTab(nextTab);
  }, []);

  // Ensure every primary tab initializes and opens cleanly at scrollTop = 0 (prevents Trends heading clipping)
  useLayoutEffect(() => {
    cancelActiveDragScroll();
    const resetTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if (mainContentRef.current) {
        mainContentRef.current.scrollTop = 0;
      }
    };
    resetTop();
    const raf = window.requestAnimationFrame(resetTop);
    return () => window.cancelAnimationFrame(raf);
  }, [activeTab]);

  const entriesRef = useRef<MoodEntry[]>(entries);
  entriesRef.current = entries;

  const latestEntryRef = useRef<MoodEntry | null>(latestEntry);
  latestEntryRef.current = latestEntry;

  // Deterministic active Quick Check-In selection (0 or 1 emotion ID) synchronized with 5s auto-reset
  const [selectedEmotionIds, setSelectedEmotionIds] = useState<string[]>([]);
  const selectedEmotionIdsRef = useRef<string[]>(selectedEmotionIds);
  selectedEmotionIdsRef.current = selectedEmotionIds;

  const SAME_EVENT_GUARD_MS = 35;

  const lastQuickLogRef = useRef<{
    entryId: string;
    emotion: EmotionDef;
    timestamp: number;
  } | null>(null);

  // Per-emotion micro-bounce guard (filters <35ms duplicate hardware/pointer events)
  const lastTapByEmotionRef = useRef<Map<string, number>>(new Map());

  const setSelectedSync = useCallback((ids: string[]) => {
    const single = ids.length > 0 && ids[0] ? [ids[0]] : [];
    selectedEmotionIdsRef.current = single;
    setSelectedEmotionIds(single);
  }, []);

  const handleClearSelectedEmotions = useCallback(() => {
    setSelectedSync([]);
    lastQuickLogRef.current = null;
  }, [setSelectedSync]);

  // Clear temporary Quick Check-In selection outline when navigating away from Today
  // or opening full-screen overlays (Settings, Protocol Player, Panic Anchor, Therapist Summary, etc.)
  const isModalOverlayBlockingToday = Boolean(
    settingsTab !== null ||
      activePlayer !== null ||
      panicAnchorOpen ||
      routineBuilderTarget !== null ||
      nudgesModalOpen ||
      therapistModalOpen
  );

  useEffect(() => {
    if (
      (activeTab !== 'today' || isModalOverlayBlockingToday) &&
      selectedEmotionIdsRef.current.length > 0
    ) {
      handleClearSelectedEmotions();
    }
  }, [activeTab, isModalOverlayBlockingToday, handleClearSelectedEmotions]);

  // Dismiss any stale toast cleanly when opening a full-screen overlay or Instant Check-In
  // (does not dismiss newly triggered toasts on close or toasts triggered from inside an open overlay)
  useEffect(() => {
    if (isModalOverlayBlockingToday || quickSheetOpen) {
      toastHostRef.current?.dismiss(true);
    }
  }, [isModalOverlayBlockingToday, quickSheetOpen]);

  // Entry Actions (stabilized via useCallback; update latestEntryRef synchronously to eliminate multi-tap race conditions)
  const createEntry = useCallback(
    (
      emotion: EmotionDef,
      tags: ContextTag[] = [],
      note = '',
      source: 'app' | 'watch' = 'app'
    ): MoodEntry => {
      const now = new Date();
      const entry: MoodEntry = {
        id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now.toISOString(),
        dateKey: toLocalDateKey(now),
        emotionId: emotion.id,
        emotionLabel: emotion.label,
        quadrant: emotion.quadrant,
        quadrantLabel: emotion.quadrantLabel,
        bucket: emotion.bucket,
        score: emotion.score,
        tags,
        note,
        source,
        dayWindow: getDayWindowFromHour(now.getHours()),
      };
      latestEntryRef.current = entry;
      setEntries((prev) => [entry, ...prev]);
      return entry;
    },
    []
  );

  const handleQuickLog = useCallback(
    (emotion: EmotionDef): QuickLogResult => {
      const nowMs = Date.now();
      const lastSameTap = lastTapByEmotionRef.current.get(emotion.id) ?? 0;
      if (nowMs - lastSameTap < SAME_EVENT_GUARD_MS) {
        return { entry: latestEntryRef.current, ignoredDuplicate: true };
      }
      lastTapByEmotionRef.current.set(emotion.id, nowMs);

      const currentSelected = selectedEmotionIdsRef.current;
      const head = latestEntryRef.current;

      // Tapping the already-highlighted single emotion clears the active highlight without duplicate logging
      if (currentSelected.includes(emotion.id)) {
        setSelectedSync([]);
        lastQuickLogRef.current = null;
        return { entry: head, committedAndReverted: true };
      }

      // Single-emotion check-in: immediately switch/log this single emotion cleanly
      // (Latest emotion card provides immediate icon + bounce confirmation with zero toast clutter)
      const created = createEntry(emotion);
      lastQuickLogRef.current = {
        entryId: created.id,
        emotion,
        timestamp: nowMs,
      };
      setSelectedSync([emotion.id]);
      return { entry: created };
    },
    [createEntry, setSelectedSync]
  );

  const handleFullLog = useCallback(
    (emotion: EmotionDef, tags: ContextTag[], note: string) => {
      setSelectedSync([]);
      lastQuickLogRef.current = null;
      createEntry(emotion, tags, note, 'app');
      showToast(
        `Logged ${emotion.label}`,
        tags.length > 0 ? tags.join(' · ') : 'Saved locally',
        undefined,
        TOAST_CHECKIN_DURATION_MS
      );
    },
    [createEntry, setSelectedSync, showToast]
  );

  const handleUpdateEntry = useCallback(
    (id: string, tags: ContextTag[], note: string) => {
      if (latestEntryRef.current?.id === id) {
        latestEntryRef.current = { ...latestEntryRef.current, tags, note };
      }
      setEntries((prev) =>
        prev.map((item) => (item.id === id ? { ...item, tags, note } : item))
      );
      showToast('Check-in updated', 'Context tags & note saved locally');
    },
    [showToast]
  );

  // Silent entry deletion finalized after Mood Log's inline 3-second Undo window (zero bottom toast)
  const handleDeleteEntry = useCallback(
    (id: string) => {
      if (lastQuickLogRef.current?.entryId === id) {
        lastQuickLogRef.current = null;
        setSelectedSync([]);
      }
      setEntries((prev) => {
        const next = prev.filter((item) => item.id !== id);
        latestEntryRef.current = next[0] ?? null;
        return next;
      });
    },
    [setSelectedSync]
  );

  const handleCommandQuickLog = useCallback(
    (emotion: EmotionDef) => {
      handleFullLog(emotion, [], '');
    },
    [handleFullLog]
  );

  const handleSaveGratitude = useCallback(
    (note: string) => {
      setSelectedSync([]);
      lastQuickLogRef.current = null;
      const grateful = ALL_EMOTIONS_MAP['grateful'];
      createEntry(grateful, ['Rest'], note, 'app');
      showToast('Gratitude saved to Mood Log', 'Logged as Grateful (Green quadrant)');
    },
    [createEntry, setSelectedSync, showToast]
  );

  // Watch Sync & Simulator Actions — Synchronizes BOTH day-level AND active window biometrics
  const handleSyncWatch = useCallback(() => {
    const now = new Date();
    const currentKey = toLocalDateKey(now);
    const currentWin = getDayWindowFromHour(now.getHours());
    const activeDeviceName =
      getWearableDeviceInfo(wearables.pairedDeviceId)?.name ?? 'Pixel Watch';
    setSettings((prev) => ({ ...prev, watchLastSync: now.toISOString() }));
    setBiometrics((prev) => {
      const targetKey = prev.some((b) => b.dateKey === currentKey)
        ? currentKey
        : prev[prev.length - 1]?.dateKey;
      if (!targetKey) return prev;
      return prev.map((b) => {
        if (b.dateKey !== targetKey) return b;
        const nextHrv = wearables.sensors.heartRateHrv ? Math.min(72, b.hrvMs + 1) : b.hrvMs;
        const nextWinHrv = wearables.sensors.heartRateHrv
          ? Math.min(74, b.windows[currentWin].hrvMs + 2)
          : b.windows[currentWin].hrvMs;
        const nextSteps = wearables.sensors.steps ? b.steps + 340 : b.steps;
        return {
          ...b,
          steps: nextSteps,
          hrvMs: nextHrv,
          optimalHrv: nextHrv >= 48 && b.sleepQuality >= 76,
          windows: {
            ...b.windows,
            [currentWin]: {
              ...b.windows[currentWin],
              hrvMs: nextWinHrv,
              steps: wearables.sensors.steps
                ? b.windows[currentWin].steps + 340
                : b.windows[currentWin].steps,
              recoveryStatus:
                nextWinHrv >= 49
                  ? 'Optimal HRV'
                  : nextWinHrv >= 41
                    ? 'Balanced'
                    : 'Strained',
            },
          },
        };
      });
    });
    showToast(`${activeDeviceName} synced`, 'Active wearable streams updated');
  }, [showToast, wearables.pairedDeviceId, wearables.sensors.heartRateHrv, wearables.sensors.steps]);

  const handleSimulateWatchCheckIn = useCallback(
    (emotionId: string, note: string) => {
      setSelectedSync([]);
      lastQuickLogRef.current = null;
      const def = ALL_EMOTIONS_MAP[emotionId] ?? ALL_EMOTIONS_MAP['calm'];
      const created = createEntry(def, ['Movement', 'Rest'], note, 'watch');
      setSettings((prev) => ({ ...prev, watchLastSync: new Date().toISOString() }));
      if (wearables.phoneHandoff) {
        setHandoffEntry(created);
        setHandoffNoteDraft(note);
        showToast(
          `Watch check-in synced: ${def.label}`,
          'Phone Handoff ready — add a quick follow-up note'
        );
      } else {
        showToast(`Watch check-in synced: ${def.label}`, 'Tagged as Logged via Watch');
      }
    },
    [createEntry, setSelectedSync, showToast, wearables.phoneHandoff]
  );

  const handleSimulateStressSpike = useCallback(() => {
    setSelectedSync([]);
    lastQuickLogRef.current = null;
    const now = new Date();
    const currentKey = toLocalDateKey(now);
    const currentWin = getDayWindowFromHour(now.getHours());
    const activeDeviceName =
      getWearableDeviceInfo(wearables.pairedDeviceId)?.name ?? 'Pixel Watch';
    const stressed = ALL_EMOTIONS_MAP['stressed'];
    const created = createEntry(
      stressed,
      ['Work', 'Focus'],
      `${activeDeviceName} detected elevated resting HR during back-to-back afternoon sessions.`,
      'watch'
    );
    setBiometrics((prev) => {
      const targetKey = prev.some((b) => b.dateKey === currentKey)
        ? currentKey
        : prev[prev.length - 1]?.dateKey;
      if (!targetKey) return prev;
      return prev.map((b) => {
        if (b.dateKey !== targetKey) return b;
        const nextRhr = Math.min(84, b.restingHr + 9);
        const nextHrv = Math.max(31, b.hrvMs - 12);
        const nextSleepH = Math.max(5.5, Number((b.sleepHours - 1.1).toFixed(1)));
        const nextSleepQ = Math.max(54, b.sleepQuality - 16);
        return {
          ...b,
          restingHr: nextRhr,
          hrvMs: nextHrv,
          sleepHours: nextSleepH,
          sleepQuality: nextSleepQ,
          optimalHrv: false,
          windows: {
            ...b.windows,
            [currentWin]: {
              ...b.windows[currentWin],
              hrvMs: Math.max(29, b.windows[currentWin].hrvMs - 13),
              restingHr: Math.min(88, b.windows[currentWin].restingHr + 10),
              recoveryStatus: 'Strained',
            },
          },
        };
      });
    });
    setSettings((prev) => ({ ...prev, watchLastSync: now.toISOString() }));
    if (wearables.phoneHandoff) {
      setHandoffEntry(created);
      setHandoffNoteDraft(created.note);
    }
    showToast('Stress & elevated HR simulated', 'Burnout Gauge & D3 Heatmap updated live');
  }, [createEntry, setSelectedSync, showToast, wearables.pairedDeviceId, wearables.phoneHandoff]);

  // Routine Actions
  const handleSaveRoutine = useCallback(
    (routine: ScheduledRoutine) => {
      setRoutines((prev) => {
        const exists = prev.some((r) => r.id === routine.id);
        if (exists) return prev.map((r) => (r.id === routine.id ? routine : r));
        return [routine, ...prev];
      });
      showToast(
        `Saved routine: ${routine.name}`,
        `${routine.timeLabel} · ${routine.weekdayLabel}`
      );
    },
    [showToast]
  );

  const handleDeleteRoutine = useCallback(
    (id: string) => {
      setRoutines((prev) => prev.filter((r) => r.id !== id));
      showToast('Routine removed');
    },
    [showToast]
  );

  const handleToggleRoutine = useCallback(
    (id: string) => {
      setRoutines((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
      );
    },
    []
  );

  const handleRunSequence = useCallback((routine: ScheduledRoutine) => {
    const seq = routine.steps
      .map((s) => {
        const base = RESET_PROTOCOLS.find((p) => p.id === s.protocolId);
        if (!base) return null;
        return { ...base, durationMin: s.durationMin, durationLabel: `${s.durationMin} min` };
      })
      .filter((x): x is ResetProtocol => x !== null);
    if (seq.length === 1 && seq[0].type === 'panic') {
      setPanicAnchorOpen(true);
      return;
    }
    if (seq.length > 0) {
      setActivePlayer({ protocols: seq, titleOverride: routine.name });
    }
  }, []);

  const handleCompleteProtocolSession = useCallback(() => {
    const nextStreak = settingsRef.current.breathingStreak + 1;
    setSettings((prev) => ({ ...prev, breathingStreak: prev.breathingStreak + 1 }));
    if (a11y.calmMode) {
      showToast(
        a11y.plainLanguage ? 'Calming exercise complete' : 'Reset complete',
        'Take a moment to notice how your body feels.'
      );
    } else {
      showToast(
        a11y.plainLanguage ? 'Calming exercise complete' : 'Somatic reset complete',
        `Breathing streak is now ${nextStreak}d`
      );
    }
  }, [showToast, a11y.calmMode, a11y.plainLanguage]);

  const handleResetDemoData = useCallback(() => {
    lastTapByEmotionRef.current.clear();
    const fresh = buildSeedData();
    latestEntryRef.current = fresh.entries[0] ?? null;
    lastQuickLogRef.current = null;
    setSelectedSync([]);
    setHandoffEntry(null);
    setHandoffNoteOpen(false);
    setEntries(fresh.entries);
    setBiometrics(fresh.biometrics);
    setRoutines(INITIAL_ROUTINES);
    setNudges(INITIAL_NUDGES);
    showToast(
      'Sample 30-day data restored',
      'Local mood journal & Pixel Watch telemetry refreshed'
    );
  }, [setSelectedSync, showToast]);

  const handleClearAllEntries = useCallback(() => {
    lastTapByEmotionRef.current.clear();
    latestEntryRef.current = null;
    lastQuickLogRef.current = null;
    setSelectedSync([]);
    setHandoffEntry(null);
    setHandoffNoteOpen(false);
    setEntries([]);
    showToast('Local mood journal cleared', 'Charts and KPIs updated to empty state');
  }, [setSelectedSync, showToast]);

  const handleToggleDnd = useCallback(() => {
    const next = !settingsRef.current.dndEnabled;
    setSettings((prev) => ({ ...prev, dndEnabled: !prev.dndEnabled }));
    showToast(next ? 'Do Not Disturb enabled' : 'Do Not Disturb disabled');
  }, [showToast]);

  const handleLaunchProtocol = useCallback((p: ResetProtocol) => {
    setActivePlayer({ protocols: [p] });
  }, []);

  const handleResetAppDefaults = useCallback(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setSettings((prev) => ({
      ...DEFAULT_SETTINGS,
      reduceMotion: prefersReduced,
      breathingStreak: prev.breathingStreak,
      watchLastSync: prev.watchLastSync,
    }));
    a11y.resetToDefaults();
    setWearables(DEFAULT_WEARABLES_STATE);
    setNudges(INITIAL_NUDGES);
    setResetDurationState({ minutes: 2, customized: false });
    setRangeDays(7);
    showToast(
      'App preferences reset to defaults',
      'Saved mood check-ins and journal history were preserved'
    );
  }, [a11y, showToast]);

  const handleLaunchBreathingReset = useCallback(() => {
    handleSelectTab('routines');
    showToast('Opened Routines', 'Calming breathing & grounding modules ready');
  }, [handleSelectTab, showToast]);

  const handleLaunchPanicAnchor = useCallback(() => {
    setQuickSheetOpen(false);
    setSettingsTab(null);
    setPanicAnchorOpen(true);
  }, []);

  const handleAddCoachMessage = useCallback((msg: CoachMessage) => {
    setCoachMessages((prev) => [...prev, msg]);
  }, []);

  const handleClearCoach = useCallback(() => {
    setCoachMessages([]);
  }, []);

  // Stable UI overlay/navigation callbacks so React.memo on TodayTab, RoutinesTab, LogTab,
  // TrendsTab, CoachTab, ExpandingCapsuleDock & QuickCheckInSheet never breaks on unrelated state updates
  const handleOpenManageNudges = useCallback(() => {
    setQuickSheetOpen(false);
    setNudgesModalOpen(true);
  }, []);
  const handleNavigateRoutines = useCallback(() => handleSelectTab('routines'), [handleSelectTab]);
  const handleOpenNewRoutine = useCallback(() => setRoutineBuilderTarget('new'), []);
  const handleEditRoutine = useCallback((r: ScheduledRoutine) => setRoutineBuilderTarget(r), []);
  const handleOpenQuickSheet = useCallback(() => {
    setSettingsTab(null);
    setHandoffNoteOpen(false);
    setQuickSheetOpen(true);
  }, []);
  const handleCloseQuickSheet = useCallback(() => setQuickSheetOpen(false), []);
  const handleToggleQuickSheet = useCallback(() => {
    setSettingsTab(null);
    setHandoffNoteOpen(false);
    setQuickSheetOpen((open) => !open);
  }, []);
  const handleOpenTherapistSummary = useCallback(() => {
    setQuickSheetOpen(false);
    setTherapistModalOpen(true);
  }, []);
  const handleOpenWearableSettings = useCallback(() => {
    setQuickSheetOpen(false);
    setSettingsTab('wearables');
  }, []);
  const handleUpdateSettings = useCallback(
    (patch: Partial<AppSettings>) => setSettings((prev) => ({ ...prev, ...patch })),
    []
  );
  const handleOpenPhoneHandoffFromSettings = useCallback(() => {
    setSettingsTab(null);
    setHandoffNoteOpen(true);
  }, []);
  const handleOpenCoachFromSettings = useCallback(() => {
    setSettingsTab(null);
    handleSelectTab('coach');
    if (coachFocusTimerRef.current) window.clearTimeout(coachFocusTimerRef.current);
    coachFocusTimerRef.current = window.setTimeout(() => {
      coachFocusTimerRef.current = null;
      if (activeTabRef.current === 'coach') {
        document.getElementById('coach-composer-input')?.focus();
      }
    }, 260);
  }, [handleSelectTab]);
  const handleLaunchBreathingFromSettings = useCallback(() => {
    setSettingsTab(null);
    handleLaunchBreathingReset();
  }, [handleLaunchBreathingReset]);
  const handleCloseSettings = useCallback(() => setSettingsTab(null), []);

  const isTopOverlayMounted =
    Boolean(settingsTab) || settingsDrawerMounted || quickSheetOpen || quickSheetMounted;

  return (
    <div
      className={`wb-app-root drag-scroll-surface bg-[var(--surface-canvas)] text-[var(--ink-primary)] ${
        activeTab === 'coach'
          ? 'wb-coach-shell'
          : 'min-h-dvh'
      }`}
    >
      {/* WCAG 2.2 Skip Link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Soft Top Scroll Edge Fade (Today, Routines, Mood Log, Trends — directly beneath fixed WELLBE+ navbar) */}
      <div
        aria-hidden="true"
        data-hidden={isAnyOverlayOpen || activeTab === 'coach' ? 'true' : 'false'}
        className="wb-edge-veil-top"
      />

      {/* Persistent Top Utility Bar (Strict Fixed Single-Row 56px + Safe-Area Top Inset — stays above Settings & Instant Check-In across full enter/exit lifecycle) */}
      <header
        data-top-utility-bar="true"
        data-overlay-open={isTopOverlayMounted ? 'true' : 'false'}
        style={{
          zIndex: isTopOverlayMounted
            ? 'calc(var(--z-modal) + 2)'
            : 'var(--z-sticky-header)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          height: 'calc(var(--top-bar-height, 56px) + env(safe-area-inset-top, 0px))',
        }}
        className="liquid-glass fixed inset-x-0 top-0 box-border shrink-0 border-x-0 border-t-0"
      >
        <div className="mx-auto flex h-full max-w-7xl flex-nowrap items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
          {/* Brand Wordmark */}
          <button
            type="button"
            onClick={() => {
              setSettingsTab(null);
              setQuickSheetOpen(false);
              handleSelectTab('today');
            }}
            className="flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-xl px-1.5 text-base font-semibold tracking-tight text-[var(--ink-primary)]"
          >
            WELLBE+
          </button>

          {/* Right Utility Control: Sleek Settings Trigger (Account, Wearables, Accessibility, Support & About) */}
          <div className="flex shrink-0 items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setQuickSheetOpen(false);
                setHandoffNoteOpen(false);
                setSettingsTab((curr) => (curr ? null : 'account'));
              }}
              aria-expanded={Boolean(settingsTab)}
              aria-label={
                settingsTab
                  ? 'Close Settings'
                  : 'Open Settings (Account, Devices, Accessibility, Support, Legal & About)'
              }
              title={settingsTab ? 'Close Settings' : 'Settings'}
              className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 text-xs font-semibold transition-colors ${
                settingsTab
                  ? 'border-[var(--border-strong)] bg-[var(--surface-hover)] text-[var(--ink-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]'
              }`}
            >
              <Settings className="h-4 w-4 shrink-0" />
              {a11y.plainLanguage && <span>Settings</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container (Safe-area header top clearance + bottom clearance prevents navbar/dock overlap) */}
      <main
        ref={mainContentRef}
        id="main-content"
        tabIndex={-1}
        className={`mx-auto w-full max-w-7xl px-3.5 focus:outline-none sm:px-6 ${
          activeTab === 'coach'
            ? 'pt-safe-header-coach pb-safe-coach flex min-h-0 flex-1 flex-col overflow-hidden'
            : 'pt-safe-header-main pb-safe-main'
        }`}
      >
        <div
          ref={overscrollStageRef}
          className={`wb-overscroll-stage ${
            activeTab === 'coach' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : ''
          }`}
        >
          {/* Kept-Mounted Tab Panels for Zero-Flash Switching (Hidden tabs are inert & non-interactive) */}
          <div
            role="tabpanel"
            aria-label="Today"
            hidden={activeTab !== 'today'}
            inert={activeTab !== 'today'}
            aria-hidden={activeTab !== 'today' || undefined}
            className={activeTab !== 'today' ? 'pointer-events-none' : undefined}
          >
            <TodayTab
              isActive={activeTab === 'today'}
              latestEntry={latestEntry}
              activeStreak={activeStreak}
              selectedEmotionIds={selectedEmotionIds}
              nudges={liveNudges}
              settings={effectiveSettings}
              onQuickLog={handleQuickLog}
              onClearSelection={handleClearSelectedEmotions}
              onUpdateEntry={handleUpdateEntry}
              onToggleDnd={handleToggleDnd}
              onOpenManageNudges={handleOpenManageNudges}
              onNavigateRoutines={handleNavigateRoutines}
              onLaunchProtocol={handleLaunchProtocol}
            />
          </div>

          {mountedTabs.routines && (
            <div
              role="tabpanel"
              aria-label="Routines"
              hidden={activeTab !== 'routines'}
              inert={activeTab !== 'routines'}
              aria-hidden={activeTab !== 'routines' || undefined}
              className={activeTab !== 'routines' ? 'pointer-events-none' : undefined}
            >
              <Suspense fallback={null}>
                <RoutinesTab
                  routines={routines}
                  entries={entries}
                  latestEntry={latestEntry}
                  resetDurationMin={resetDurationMin}
                  hasCustomResetDuration={hasCustomResetDuration}
                  onChangeResetDuration={handleChangeResetDuration}
                  onOpenNewRoutine={handleOpenNewRoutine}
                  onEditRoutine={handleEditRoutine}
                  onDeleteRoutine={handleDeleteRoutine}
                  onToggleRoutine={handleToggleRoutine}
                  onRunSequence={handleRunSequence}
                  onLaunchProtocol={handleLaunchProtocol}
                  onLaunchPanicAnchor={handleLaunchPanicAnchor}
                  onSaveGratitude={handleSaveGratitude}
                />
              </Suspense>
            </div>
          )}

          {mountedTabs.log && (
            <div
              role="tabpanel"
              aria-label="Mood Log"
              hidden={activeTab !== 'log'}
              inert={activeTab !== 'log'}
              aria-hidden={activeTab !== 'log' || undefined}
              className={activeTab !== 'log' ? 'pointer-events-none' : undefined}
            >
              <Suspense fallback={null}>
                <LogTab
                  isActive={activeTab === 'log'}
                  entries={entries}
                  settings={effectiveSettings}
                  onDeleteEntry={handleDeleteEntry}
                  onClearAll={handleClearAllEntries}
                  onResetDemoData={handleResetDemoData}
                  onOpenQuickCheckIn={handleOpenQuickSheet}
                  onNotify={showToast}
                />
              </Suspense>
            </div>
          )}

          {mountedTabs.trends && analytics && (
            <div
              role="tabpanel"
              aria-label="Trends"
              hidden={activeTab !== 'trends'}
              inert={activeTab !== 'trends'}
              aria-hidden={activeTab !== 'trends' || undefined}
              className={activeTab !== 'trends' ? 'pointer-events-none' : undefined}
            >
              <Suspense fallback={null}>
                <TrendsTab
                  isActive={activeTab === 'trends'}
                  analytics={analytics}
                  rangeDays={rangeDays}
                  settings={effectiveSettings}
                  wearableSensors={wearables.sensors}
                  onChangeRange={setRangeDays}
                  onOpenTherapistSummary={handleOpenTherapistSummary}
                  onOpenWearableSettings={handleOpenWearableSettings}
                  onLaunchBreathingReset={handleLaunchBreathingReset}
                />
              </Suspense>
            </div>
          )}

          {mountedTabs.coach && analytics7D && (
            <div
              role="tabpanel"
              aria-label="Coach"
              hidden={activeTab !== 'coach'}
              inert={activeTab !== 'coach'}
              aria-hidden={activeTab !== 'coach' || undefined}
              className={
                activeTab === 'coach'
                  ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                  : 'pointer-events-none'
              }
            >
              <Suspense fallback={null}>
                <CoachTab
                  isActive={activeTab === 'coach'}
                  messages={coachMessages}
                  analytics={analytics7D}
                  entries={entries}
                  settings={effectiveSettings}
                  onAddMessage={handleAddCoachMessage}
                  onClearChat={handleClearCoach}
                  onLaunchProtocol={handleLaunchProtocol}
                  onOpenTherapistSummary={handleOpenTherapistSummary}
                />
              </Suspense>
            </div>
          )}
        </div>
      </main>

      {/* Soft Bottom Scroll Edge Fade (Today, Routines, Mood Log, Trends — directly beneath floating bottom dock) */}
      <div
        aria-hidden="true"
        data-hidden={isAnyOverlayOpen || activeTab === 'coach' ? 'true' : 'false'}
        className="wb-edge-veil-bottom"
      />

      {/* Pattern 3: Expanding Active-Tab Capsule Dock with GPU Sliding Pill & Integrated (+) */}
      <ExpandingCapsuleDock
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onQuickCheckIn={handleToggleQuickSheet}
        locked={isAnyOverlayOpen}
        plainLanguage={a11y.plainLanguage}
        quickCheckInOpen={quickSheetOpen}
        reduceMotion={a11y.reduceMotion}
      />

      {/* Non-intrusive Live Toast / Quick Undo Banner (Isolated from App re-renders) */}
      <ToastHost ref={toastHostRef} />

      {/* Modals, Players & Overlays */}
      <Suspense fallback={null}>
        {hasOpenedQuickSheetRef.current && (
          <QuickCheckInSheet
            open={quickSheetOpen}
            activeEmotionId={latestEntry?.emotionId ?? null}
            selectedEmotionIds={selectedEmotionIds}
            onClearSelection={handleClearSelectedEmotions}
            onMountedChange={setQuickSheetMounted}
            onClose={handleCloseQuickSheet}
            onSubmit={handleFullLog}
          />
        )}

        {activePlayer && (
          <ProtocolPlayerModal
            protocols={activePlayer.protocols}
            titleOverride={activePlayer.titleOverride}
            settings={effectiveSettings}
            onClose={() => setActivePlayer(null)}
            onCompleteSession={handleCompleteProtocolSession}
            onSaveGratitude={handleSaveGratitude}
          />
        )}

        {panicAnchorOpen && (
          <VoicePanicAnchorOverlay
            settings={effectiveSettings}
            onClose={() => setPanicAnchorOpen(false)}
            onComplete={handleCompleteProtocolSession}
          />
        )}

        {routineBuilderTarget && (
          <RoutineBuilderModal
            initial={routineBuilderTarget === 'new' ? null : routineBuilderTarget}
            onClose={() => setRoutineBuilderTarget(null)}
            onSave={handleSaveRoutine}
          />
        )}

        {nudgesModalOpen && (
          <NudgesModal
            nudges={liveNudges}
            dndEnabled={settings.dndEnabled}
            onToggleDnd={handleToggleDnd}
            onToggleWindow={(id) =>
              setNudges((prev) =>
                prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n))
              )
            }
            onTriggerTestNudge={(n) =>
              showToast(
                `Nudge Preview · ${n.timeLabel} ${n.title}`,
                `${n.historicalBasis} — Tap Check In or open Routines for a quick reset.`
              )
            }
            onClose={() => setNudgesModalOpen(false)}
          />
        )}

        {therapistModalOpen && analytics && (
          <TherapistSummaryModal
            analytics={analytics}
            entries={entries}
            onClose={() => setTherapistModalOpen(false)}
          />
        )}

        {hasOpenedSettingsRef.current && (
          <SettingsModal
            open={Boolean(settingsTab)}
            initialTab={settingsTab ?? 'account'}
            activeView={activeTab}
            settings={effectiveSettings}
            todayBio={todayBio}
            wearables={wearables}
            onUpdateWearables={handleUpdateWearables}
            onUpdateSettings={handleUpdateSettings}
            onSyncWatch={handleSyncWatch}
            onSimulateWatchCheckIn={handleSimulateWatchCheckIn}
            onSimulateStressSpike={handleSimulateStressSpike}
            onOpenPhoneHandoff={handleOpenPhoneHandoffFromSettings}
            onOpenCoach={handleOpenCoachFromSettings}
            onLaunchBreathingReset={handleLaunchBreathingFromSettings}
            onResetAppDefaults={handleResetAppDefaults}
            onResetDemoData={handleResetDemoData}
            onNotify={showToast}
            onMountedChange={setSettingsDrawerMounted}
            onClose={handleCloseSettings}
          />
        )}
      </Suspense>

      {/* Non-Intrusive Phone Handoff Follow-Up Note Modal (Triggered from Watch Check-In) */}
      {handoffNoteOpen && handoffEntry && (
        <div
          style={{ zIndex: 'var(--z-modal)', backgroundColor: 'var(--scrim-bg)' }}
          className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4"
          onClick={handleCloseHandoff}
        >
          <div
            ref={handoffModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="phone-handoff-title"
            tabIndex={-1}
            className="wb-surface w-full max-w-md space-y-4 rounded-t-3xl p-5 focus:outline-none sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--brand-accent-text)]">
                  Phone Handoff · Logged via Watch
                </p>
                <h2
                  id="phone-handoff-title"
                  className="mt-0.5 text-base font-semibold text-[var(--ink-primary)]"
                >
                  Add a quick note for {handoffEntry.emotionLabel}?
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close handoff prompt"
                onClick={handleCloseHandoff}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateEntry(handoffEntry.id, handoffEntry.tags, handoffNoteDraft.trim());
                setHandoffNoteOpen(false);
                setHandoffEntry(null);
              }}
              className="space-y-3"
            >
              <label htmlFor="handoff-note-input" className="sr-only">
                Follow-up journal note
              </label>
              <textarea
                id="handoff-note-input"
                data-autofocus="true"
                rows={3}
                value={handoffNoteDraft}
                onChange={(e) => setHandoffNoteDraft(e.target.value)}
                placeholder="What sparked this moment or helped you reset?"
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)]"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseHandoff}
                  className="min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 text-xs font-semibold text-[var(--ink-secondary)]"
                >
                  Skip
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl px-4 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--brand-action-bg)',
                    color: 'var(--brand-action-fg)',
                  }}
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {commandOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            onClose={() => setCommandOpen(false)}
            onNavigateTab={handleSelectTab}
            onQuickLogEmotion={handleCommandQuickLog}
            onLaunchProtocol={handleLaunchProtocol}
            onLaunchPanicAnchor={handleLaunchPanicAnchor}
            onOpenTherapistSummary={() => setTherapistModalOpen(true)}
            onOpenSettingsTab={(tab) => setSettingsTab(tab)}
          />
        </Suspense>
      )}
    </div>
  );
}
