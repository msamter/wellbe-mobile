import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  Check,
  Command,
  Copy,
  Download,
  FileText,
  Info,
  LifeBuoy,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  User,
  Watch,
  Wind,
  X,
} from 'lucide-react';
import {
  AppTab,
  ContextTag,
  EmotionDef,
  MoodEntry,
  NudgeWindow,
  ResetProtocol,
  RoutineStepItem,
  ScheduledRoutine,
} from '../types/wellbe';
import { EMOTIONS_16, RESET_PROTOCOLS, toLocalDateKey } from '../data/wellbeData';
import { AffectiveGlyph } from './AffectiveGlyphs';
import { CompactEmotionMatrix } from './CompactEmotionMatrix';
import {
  TrendsAnalytics,
  buildTherapistSummaryText,
  downloadFile,
} from '../utils/analytics';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { cancelActiveDragScroll, useDragToScroll } from '../hooks/useDragToScroll';
import { useAccessibility } from '../context/AccessibilityContext';
import type { SettingsTabId } from './SettingsModal';

/* ==========================================================================
   1. Instant Check-In Overlay (Capsule + Triggered — Portal Single-Layer Motion)
   ========================================================================== */
const INSTANT_SELECTION_RESET_MS = 5000;

interface QuickCheckInSheetProps {
  open: boolean;
  activeEmotionId?: string | null;
  selectedEmotionIds?: string[];
  onClearSelection?: () => void;
  onMountedChange?: (mounted: boolean) => void;
  onClose: () => void;
  onSubmit: (emotion: EmotionDef, tags: ContextTag[], note: string) => void;
}

type OverlayMotionPhase = 'entering' | 'open' | 'exiting';

export const QuickCheckInSheet: React.FC<QuickCheckInSheetProps> = React.memo(
  ({
    open,
    activeEmotionId = null,
    selectedEmotionIds,
    onClearSelection,
    onMountedChange,
    onClose,
    onSubmit,
  }) => {
  const a11y = useAccessibility();
  const cardRef = useRef<HTMLDivElement>(null);
  const phaseTimerRef = useRef<number | null>(null);
  const selectionResetTimerRef = useRef<number | null>(null);
  const loggedThisOpenRef = useRef(false);
  const onMountedChangeRef = useRef(onMountedChange);
  onMountedChangeRef.current = onMountedChange;
  const onClearSelectionRef = useRef(onClearSelection);
  onClearSelectionRef.current = onClearSelection;

  const [mounted, setMounted] = useState(open);
  const mountedRef = useRef(mounted);
  mountedRef.current = mounted;
  const [justTappedEmotionId, setJustTappedEmotionId] = useState<string | null>(null);
  const [sheetGlowBurstId, setSheetGlowBurstId] = useState(0);

  const [phase, setPhase] = useState<OverlayMotionPhase>(() =>
    open ? (a11y.reduceMotion ? 'open' : 'entering') : 'open'
  );
  const phaseRef = useRef<OverlayMotionPhase>(phase);
  phaseRef.current = phase;

  // Notify parent synchronously across mount/unmount so fixed top navbar never drops beneath exiting scrim
  useEffect(() => {
    onMountedChangeRef.current?.(mounted);
  }, [mounted]);

  useEffect(() => {
    return () => {
      onMountedChangeRef.current?.(false);
    };
  }, []);

  // Focus trap stays active only while open (immediately releases on close so + can be re-tapped)
  useFocusTrap(cardRef, onClose, mounted && open);

  // Safe mount / unmount staging with rapid-toggle interruption & fallback cleanup timer
  useEffect(() => {
    if (phaseTimerRef.current !== null) {
      window.clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }

    cancelActiveDragScroll();
    const reduced = a11y.reduceMotion;

    if (open) {
      loggedThisOpenRef.current = false;
      setJustTappedEmotionId(null);
      mountedRef.current = true;
      setMounted(true);
      if (reduced) {
        setPhase('open');
      } else {
        setPhase('entering');
        phaseTimerRef.current = window.setTimeout(() => {
          setPhase('open');
          phaseTimerRef.current = null;
        }, 220);
      }
    } else if (mountedRef.current) {
      if (reduced) {
        mountedRef.current = false;
        setMounted(false);
        setJustTappedEmotionId(null);
        setPhase('open');
      } else {
        setPhase('exiting');
        phaseTimerRef.current = window.setTimeout(() => {
          mountedRef.current = false;
          setMounted(false);
          setJustTappedEmotionId(null);
          setPhase('open');
          phaseTimerRef.current = null;
        }, 180);
      }
    }

    return () => {
      if (phaseTimerRef.current !== null) {
        window.clearTimeout(phaseTimerRef.current);
        phaseTimerRef.current = null;
      }
    };
  }, [open, a11y.reduceMotion]);

  const handleCardAnimationEnd = useCallback(
    (e: React.AnimationEvent<HTMLDivElement>) => {
      if (e.target !== cardRef.current) return;
      if (phaseTimerRef.current !== null) {
        window.clearTimeout(phaseTimerRef.current);
        phaseTimerRef.current = null;
      }
      if (phaseRef.current === 'entering') {
        setPhase('open');
      } else if (phaseRef.current === 'exiting') {
        mountedRef.current = false;
        setMounted(false);
        setJustTappedEmotionId(null);
        setPhase('open');
      }
    },
    []
  );

  const clearSelectionResetTimer = useCallback(() => {
    if (selectionResetTimerRef.current !== null) {
      window.clearTimeout(selectionResetTimerRef.current);
      selectionResetTimerRef.current = null;
    }
  }, []);

  const handleSelectEmotion = useCallback(
    (emotion: EmotionDef) => {
      if (phaseRef.current === 'exiting' || loggedThisOpenRef.current) return;
      clearSelectionResetTimer();
      loggedThisOpenRef.current = true;
      setJustTappedEmotionId(emotion.id);
      setSheetGlowBurstId((n) => n + 1);
      // Immediate 1-tap logging with safe empty defaults for optional drivers & note
      onSubmit(emotion, [], '');
      onClose();
    },
    [clearSelectionResetTimer, onSubmit, onClose]
  );

  const effectiveSelectedIds = useMemo(
    () => (justTappedEmotionId ? [justTappedEmotionId] : selectedEmotionIds),
    [justTappedEmotionId, selectedEmotionIds]
  );

  const effectiveSelectedKey = (effectiveSelectedIds ?? []).join(',');

  // Reset any active selected emotion highlight inside Instant Check-In after 5000ms
  // and cancel cleanly on new selection, sheet close, or unmount.
  useEffect(() => {
    clearSelectionResetTimer();
    if (!open || !effectiveSelectedKey) return;
    selectionResetTimerRef.current = window.setTimeout(() => {
      selectionResetTimerRef.current = null;
      setJustTappedEmotionId(null);
      onClearSelectionRef.current?.();
    }, INSTANT_SELECTION_RESET_MS);
    return clearSelectionResetTimer;
  }, [open, effectiveSelectedKey, clearSelectionResetTimer]);

  if (!mounted || typeof document === 'undefined') return null;

  const isExiting = phase === 'exiting';

  return createPortal(
    <div
      data-phase={phase}
      style={{
        zIndex: 'var(--z-sheet)',
        paddingTop: 'calc(var(--top-bar-height, 56px) + env(safe-area-inset-top, 0px))',
      }}
      className={`wb-quick-checkin-scrim fixed inset-0 flex h-[100dvh] items-stretch justify-center overflow-hidden p-0 ${
        isExiting ? 'pointer-events-none' : ''
      }`}
      onClick={() => {
        if (!isExiting) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-checkin-title"
        tabIndex={-1}
        data-phase={phase}
        onAnimationEnd={handleCardAnimationEnd}
        onClick={(e) => e.stopPropagation()}
        className={`wb-quick-checkin-card flex h-full min-h-0 w-full flex-col overflow-hidden border-t border-[var(--border-hairline)] focus:outline-none ${
          isExiting ? 'pointer-events-none' : ''
        }`}
      >
        <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden px-3.5 sm:px-6 lg:px-8">
          {/* Header anchored directly beneath Fixed Top Navbar with Settings-matched X close control */}
          <div className="shrink-0 border-b border-[var(--border-hairline)] py-2.5 sm:py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <h2
                  id="quick-checkin-title"
                  className="text-lg font-semibold leading-tight tracking-tight text-[var(--ink-primary)] sm:text-2xl"
                >
                  Instant Check-In
                </h2>
                <p className="mt-0.5 text-xs font-normal leading-snug text-[var(--ink-muted)] sm:text-sm">
                  {a11y.plainLanguage
                    ? 'Tap how you feel right now to save it immediately.'
                    : 'Tap any emotion to log immediately.'}
                </p>
              </div>
              <button
                type="button"
                data-no-drag-scroll="true"
                onClick={() => {
                  if (!isExiting) onClose();
                }}
                aria-label="Close Instant Check-In"
                className="wb-overlay-close-btn flex h-[44px] w-[44px] min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl p-0 text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Full-Viewport Equal-Height 2x8 Emotion Grid (100% height, zero dead space, zero scroll) */}
          <div
            className="flex min-h-0 flex-1 flex-col overflow-visible pt-2.5 sm:pt-3"
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
            }}
          >
            <CompactEmotionMatrix
              selectedEmotions={effectiveSelectedIds}
              activeEmotion={activeEmotionId}
              onSelectEmotion={handleSelectEmotion}
              fitViewport
              layoutMode="sheet"
              glowActive={Boolean(effectiveSelectedIds && effectiveSelectedIds.length > 0)}
              glowBurstId={sheetGlowBurstId}
              syncFocusKey={open}
              ariaLabel="Instant check-in 16 emotions"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});
QuickCheckInSheet.displayName = 'QuickCheckInSheet';

/* ==========================================================================
   2. Routine Builder Modal (+ New Routine / Edit Routine)
   ========================================================================== */
interface RoutineBuilderModalProps {
  initial?: ScheduledRoutine | null;
  onClose: () => void;
  onSave: (routine: ScheduledRoutine) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTime12(hhmm: string): string {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return '3:00 PM';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr || '00'} ${period}`;
}

function summarizeWeekdays(days: string[]): string {
  if (days.length === 7) return 'Daily';
  if (
    days.length === 5 &&
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every((d) => days.includes(d))
  ) {
    return 'Mon–Fri';
  }
  if (days.length === 2 && days.includes('Sat') && days.includes('Sun')) {
    return 'Weekends';
  }
  return days.join(', ') || 'Unscheduled';
}

export const RoutineBuilderModal: React.FC<RoutineBuilderModalProps> = ({
  initial,
  onClose,
  onSave,
}) => {
  const modalRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, onClose, true);
  useDragToScroll(bodyRef, { axis: 'y' });

  const [name, setName] = useState(initial?.name ?? '');
  const [time, setTime] = useState(initial?.time ?? '15:00');
  const [weekdays, setWeekdays] = useState<string[]>(
    initial?.weekdays ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  );
  const [steps, setSteps] = useState<RoutineStepItem[]>(
    initial?.steps ?? [{ protocolId: 'breathing', durationMin: 2 }]
  );
  const [validationError, setValidationError] = useState('');

  const toggleDay = (d: string) => {
    setWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
    if (validationError) setValidationError('');
  };

  const addBlock = (proto: ResetProtocol) => {
    setSteps((prev) => [...prev, { protocolId: proto.id, durationMin: proto.durationMin }]);
    if (validationError) setValidationError('');
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const adjustStepDuration = (idx: number, delta: number) => {
    setSteps((prev) =>
      prev.map((st, i) =>
        i === idx
          ? { ...st, durationMin: Math.max(1, Math.min(15, st.durationMin + delta)) }
          : st
      )
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setValidationError('Please enter a name for this routine.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setValidationError('Please select a valid scheduled time.');
      return;
    }
    if (weekdays.length === 0) {
      setValidationError('Select at least one active weekday.');
      return;
    }
    if (steps.length === 0) {
      setValidationError('Add at least one somatic building block to the sequence.');
      return;
    }

    onSave({
      id: initial?.id ?? `routine-${Date.now()}`,
      name: name.trim(),
      time,
      timeLabel: formatTime12(time),
      weekdays,
      weekdayLabel: summarizeWeekdays(weekdays),
      steps,
      enabled: initial?.enabled ?? true,
    });
    onClose();
  };

  const totalMin = steps.reduce((s, st) => s + st.durationMin, 0);

  return (
    <div
      style={{ zIndex: 'var(--z-modal)', backgroundColor: 'var(--scrim-bg)' }}
      className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="routine-builder-title"
        tabIndex={-1}
        noValidate
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="wb-surface flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
      >
        {/* Pinned Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-hairline)] px-5 py-4 sm:px-6">
          <h2
            id="routine-builder-title"
            className="text-lg font-semibold text-[var(--ink-primary)]"
          >
            {initial ? 'Edit Routine' : 'New Somatic Routine'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close routine builder"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Internally Scrollable Form Body */}
        <div ref={bodyRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          {validationError && (
            <div
              role="alert"
              className="rounded-xl border border-[var(--q-red-border)] bg-[var(--q-red-bg)] px-3.5 py-2.5 text-xs font-semibold text-[var(--q-red-fg)]"
            >
              {validationError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="routine-name"
                className="block text-xs font-medium text-[var(--ink-muted)]"
              >
                Routine name
              </label>
              <input
                id="routine-name"
                data-autofocus="true"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (validationError) setValidationError('');
                }}
                placeholder="e.g., Post-Work Transition"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)]"
              />
            </div>
            <div>
              <label
                htmlFor="routine-time"
                className="block text-xs font-medium text-[var(--ink-muted)]"
              >
                Time
              </label>
              <input
                id="routine-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)] tabular-nums"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-[var(--ink-muted)]">Active weekdays</p>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d) => {
                const active = weekdays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    aria-pressed={active}
                    className="min-h-[44px] min-w-0 rounded-lg px-1 text-xs font-semibold"
                    style={{
                      backgroundColor: active
                        ? 'var(--accent-primary)'
                        : 'var(--surface-subtle)',
                      color: active ? 'var(--accent-primary-ink)' : 'var(--ink-secondary)',
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--ink-muted)]">
                Sequence steps ({steps.length})
              </span>
              <span className="font-mono-tabular font-semibold text-[var(--ink-primary)]">
                {totalMin} min total
              </span>
            </div>
            {steps.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border-strong)] p-3 text-xs text-[var(--ink-muted)]">
                Add at least one routine module below.
              </p>
            ) : (
              <div className="space-y-1.5">
                {steps.map((st, idx) => {
                  const proto = RESET_PROTOCOLS.find((p) => p.id === st.protocolId);
                  return (
                    <div
                      key={`${st.protocolId}-${idx}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] py-1.5 pl-3 pr-1.5 text-xs"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-[var(--ink-primary)]">
                        {String(idx + 1).padStart(2, '0')}. {proto?.shortTitle ?? st.protocolId}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="sr-only">Reset Duration</span>
                        <button
                          type="button"
                          onClick={() => adjustStepDuration(idx, -1)}
                          aria-label={`Decrease duration for step ${idx + 1}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                        >
                          −
                        </button>
                        <span className="font-mono-tabular min-w-[36px] text-center text-xs font-semibold text-[var(--ink-primary)]">
                          {st.durationMin}m
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustStepDuration(idx, 1)}
                          aria-label={`Increase duration for step ${idx + 1}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStep(idx)}
                          aria-label={`Remove step ${idx + 1}`}
                          className="flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-lg text-[var(--q-red-fg)] hover:bg-[var(--q-red-bg)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-[var(--ink-muted)]">
              Add routine module
            </p>
            <div className="flex flex-wrap gap-1.5">
              {RESET_PROTOCOLS.map((proto) => (
                <button
                  key={proto.id}
                  type="button"
                  onClick={() => addBlock(proto)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 text-xs font-medium text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                >
                  <Plus className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                  <span>{proto.shortTitle}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pinned Footer */}
        <div
          className="flex shrink-0 justify-end gap-2 border-t border-[var(--border-hairline)] px-5 py-3.5 sm:px-6"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.875rem)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-[var(--border-hairline)] px-4 text-xs font-semibold text-[var(--ink-secondary)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-[44px] rounded-xl px-5 text-xs font-semibold"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-primary-ink)',
            }}
          >
            Save Routine
          </button>
        </div>
      </form>
    </div>
  );
};

/* ==========================================================================
   3. Predictive Nudges Manage & Test Modal
   ========================================================================== */
interface NudgesModalProps {
  nudges: NudgeWindow[];
  dndEnabled: boolean;
  onToggleDnd: () => void;
  onToggleWindow: (id: string) => void;
  onTriggerTestNudge: (nudge: NudgeWindow) => void;
  onClose: () => void;
}

export const NudgesModal: React.FC<NudgesModalProps> = ({
  nudges,
  dndEnabled,
  onToggleDnd,
  onToggleWindow,
  onTriggerTestNudge,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, onClose, true);
  useDragToScroll(bodyRef, { axis: 'y' });

  return (
    <div
      style={{ zIndex: 'var(--z-modal)', backgroundColor: 'var(--scrim-bg)' }}
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nudges-modal-title"
        tabIndex={-1}
        className="wb-surface flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-hairline)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="nudges-modal-title"
              className="text-lg font-semibold text-[var(--ink-primary)]"
            >
              Predictive Check-In Nudges
            </h2>
            <p className="text-xs text-[var(--ink-muted)]">
              Low-energy windows detected from your local history
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close nudges modal"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={bodyRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-subtle)] p-3.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--ink-primary)]">Do Not Disturb</p>
              <p className="text-xs text-[var(--ink-muted)]">
                Pause all predictive check-in prompts
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={dndEnabled}
              onClick={onToggleDnd}
              className="min-h-[44px] shrink-0 rounded-xl px-3.5 text-xs font-semibold"
              style={{
                backgroundColor: dndEnabled ? 'var(--q-red-bg)' : 'var(--surface-card)',
                color: dndEnabled ? 'var(--q-red-fg)' : 'var(--ink-primary)',
                border: '1px solid var(--border-hairline)',
              }}
            >
              {dndEnabled ? 'Paused' : 'Active'}
            </button>
          </div>

          <div className="space-y-2.5">
            {nudges.map((n) => (
              <div
                key={n.id}
                className="space-y-2.5 rounded-xl border border-[var(--border-hairline)] p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--ink-primary)] tabular-nums">
                      {n.timeLabel} · {n.title}
                    </p>
                    <p className="text-xs text-[var(--ink-muted)]">{n.historicalBasis}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={n.enabled}
                    onClick={() => onToggleWindow(n.id)}
                    className="min-h-[44px] shrink-0 rounded-xl border border-[var(--border-hairline)] px-3 text-xs font-semibold"
                    style={{
                      backgroundColor: n.enabled
                        ? 'var(--accent-soft)'
                        : 'var(--surface-subtle)',
                      color: n.enabled ? 'var(--accent-primary)' : 'var(--ink-muted)',
                    }}
                  >
                    {n.enabled ? 'Enabled' : 'Muted'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onTriggerTestNudge(n);
                    onClose();
                  }}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--surface-subtle)] px-3.5 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--surface-hover)]"
                >
                  <Bell className="h-3.5 w-3.5" />
                  <span>Send Test Nudge Preview</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   4. Therapist Summary Modal (Printable & Copyable Clinical Overview)
   ========================================================================== */
interface TherapistSummaryModalProps {
  analytics: TrendsAnalytics;
  entries: MoodEntry[];
  onClose: () => void;
}

export const TherapistSummaryModal: React.FC<TherapistSummaryModalProps> = ({
  analytics,
  entries,
  onClose,
}) => {
  const a11y = useAccessibility();
  const modalRef = useRef<HTMLDivElement>(null);
  const summaryPreRef = useRef<HTMLPreElement>(null);
  useFocusTrap(modalRef, onClose, true);
  useDragToScroll(summaryPreRef, { axis: 'y' });

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimerRef = useRef<number | null>(null);
  const summaryText = useMemo(
    () => buildTherapistSummaryText(analytics, entries),
    [analytics, entries]
  );

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(summaryText);
        setCopyStatus('copied');
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = summaryText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopyStatus('copied');
      } catch {
        setCopyStatus('failed');
      }
    }
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => {
      copyTimerRef.current = null;
      setCopyStatus('idle');
    }, 2200);
  };

  return (
    <div
      style={{ zIndex: 'var(--z-modal)', backgroundColor: 'var(--scrim-bg)' }}
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="therapist-summary-title"
        tabIndex={-1}
        className="wb-surface flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--bio-mint)]">
              {a11y.plainLanguage
                ? 'Ready to Share With Your Doctor or Therapist'
                : 'Structured Clinical Overview · Pattern Insight'}
            </p>
            <h2
              id="therapist-summary-title"
              className="mt-1 text-lg font-semibold text-[var(--ink-primary)]"
            >
              {a11y.plainLanguage
                ? `Care Team Summary (${analytics.rangeDays} Days)`
                : `Therapist Summary (${analytics.rangeDays}D)`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Therapist Summary"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <pre
          ref={summaryPreRef}
          className="wb-prose mt-4 flex-1 select-text overflow-y-auto whitespace-pre-wrap rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4 font-mono-tabular text-xs leading-relaxed text-[var(--ink-primary)]"
        >
          {summaryText}
        </pre>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-4">
          <span aria-live="polite" className="text-xs font-medium text-[var(--ink-muted)]">
            {copyStatus === 'copied'
              ? 'Copied clinical summary to clipboard.'
              : copyStatus === 'failed'
                ? 'Clipboard blocked — use Download TXT instead.'
                : ''}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 text-xs font-semibold text-[var(--ink-primary)]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() =>
                downloadFile(
                  `wellbe-therapist-summary-${toLocalDateKey(new Date())}.txt`,
                  summaryText,
                  'text/plain;charset=utf-8'
                )
              }
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 text-xs font-semibold text-[var(--ink-primary)]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download TXT</span>
            </button>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-primary-ink)',
              }}
            >
              {copyStatus === 'copied' ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copyStatus === 'copied' ? 'Copied' : 'Copy Summary'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   5. Intent-First Command Palette (Cmd/Ctrl + K — Liquid Glass + Keyboard Arrows)
   ========================================================================== */
interface CommandPaletteProps {
  onClose: () => void;
  onNavigateTab: (tab: AppTab) => void;
  onQuickLogEmotion: (emotion: EmotionDef) => void;
  onLaunchProtocol: (protocol: ResetProtocol) => void;
  onLaunchPanicAnchor: () => void;
  onOpenTherapistSummary: () => void;
  onOpenSettingsTab: (tab: SettingsTabId) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  onClose,
  onNavigateTab,
  onQuickLogEmotion,
  onLaunchProtocol,
  onLaunchPanicAnchor,
  onOpenTherapistSummary,
  onOpenSettingsTab,
}) => {
  const paletteRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useFocusTrap(paletteRef, onClose, true);
  useDragToScroll(listRef, { axis: 'y' });

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const q = query.trim().toLowerCase();

  const actions = useMemo(() => {
    const items: Array<{
      id: string;
      group: string;
      label: string;
      detail: string;
      icon: React.ReactNode;
      run: () => void;
    }> = [
      {
        id: 'panic',
        group: 'Routines',
        label: 'Voice Panic Anchor (Routines)',
        detail: 'Immediate voice-guided breathing sanctuary inside Routines',
        icon: <ShieldAlert className="h-4 w-4 text-[var(--q-red-fg)]" />,
        run: () => onLaunchPanicAnchor(),
      },
      ...RESET_PROTOCOLS.filter((p) => p.type !== 'panic').map((p) => ({
        id: `proto-${p.id}`,
        group: 'Routines',
        label: p.type === 'gratitude' ? `${p.title} (Routines)` : p.title,
        detail: `${p.targetState} · ${p.durationLabel}`,
        icon: <Wind className="h-4 w-4 text-[var(--accent-primary)]" />,
        run: () => onLaunchProtocol(p),
      })),
      {
        id: 'therapist',
        group: 'Analytics & Watch',
        label: 'Generate Therapist Summary',
        detail: 'Structured clinical overview from local data',
        icon: <FileText className="h-4 w-4 text-[var(--ink-secondary)]" />,
        run: () => onOpenTherapistSummary(),
      },
      {
        id: 'settings-wearables',
        group: 'Settings',
        label: 'Open Settings → Devices (Pixel Watch)',
        detail: 'Sync biometrics or simulate watch check-in',
        icon: <Watch className="h-4 w-4 text-[var(--bio-mint)]" />,
        run: () => onOpenSettingsTab('wearables'),
      },
      {
        id: 'settings-account',
        group: 'Settings',
        label: 'Open Settings → Account, Identity & Billing',
        detail: 'Profile, password, biometrics, subscription & receipts',
        icon: <User className="h-4 w-4 text-[var(--accent-primary)]" />,
        run: () => onOpenSettingsTab('account'),
      },
      {
        id: 'settings-accessibility',
        group: 'Settings',
        label: 'Open Settings → Accessibility',
        detail: 'Themes, Calm Mode, High Contrast & sensory controls',
        icon: <SlidersHorizontal className="h-4 w-4 text-[var(--ink-secondary)]" />,
        run: () => onOpenSettingsTab('accessibility'),
      },
      {
        id: 'settings-support',
        group: 'Settings',
        label: 'Open Settings → Help & Support',
        detail: 'WELLBE+ Coach, NAMI resources & 988 lifeline',
        icon: <LifeBuoy className="h-4 w-4 text-[var(--brand-accent-text)]" />,
        run: () => onOpenSettingsTab('support'),
      },
      {
        id: 'settings-about',
        group: 'Settings',
        label: 'Open Settings → Legal & About',
        detail: 'App version, release notes, privacy policy, terms & defaults',
        icon: <Info className="h-4 w-4 text-[var(--ink-secondary)]" />,
        run: () => onOpenSettingsTab('about'),
      },
      ...(['today', 'routines', 'log', 'trends', 'coach'] as AppTab[]).map((t) => ({
        id: `tab-${t}`,
        group: 'Navigation',
        label: `Go to ${t.charAt(0).toUpperCase() + t.slice(1)}`,
        detail: 'Switch workspace view',
        icon: <Command className="h-4 w-4 text-[var(--ink-muted)]" />,
        run: () => onNavigateTab(t),
      })),
      ...EMOTIONS_16.map((em) => ({
        id: `log-${em.id}`,
        group: 'Instant Log Emotion',
        label: `Log feeling ${em.label}`,
        detail: `${em.quadrantLabel} quadrant`,
        icon: <AffectiveGlyph emotionId={em.id} quadrant={em.quadrant} size={16} />,
        run: () => onQuickLogEmotion(em),
      })),
    ];

    if (!q) return items.slice(0, 12);
    return items
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.detail.toLowerCase().includes(q) ||
          item.group.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [
    q,
    onLaunchPanicAnchor,
    onLaunchProtocol,
    onOpenTherapistSummary,
    onOpenSettingsTab,
    onNavigateTab,
    onQuickLogEmotion,
  ]);

  const safeActiveIdx = Math.min(activeIndex, Math.max(0, actions.length - 1));

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (actions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % actions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + actions.length) % actions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = actions[safeActiveIdx];
      if (target) {
        target.run();
        onClose();
      }
    }
  };

  return (
    <div
      style={{ zIndex: 'var(--z-command)', backgroundColor: 'var(--scrim-bg)' }}
      className="fixed inset-0 flex items-start justify-center p-3 pt-[10vh] sm:p-4"
      onClick={onClose}
    >
      <div
        ref={paletteRef}
        role="dialog"
        aria-modal="true"
        aria-label="WELLBE+ Command Bar"
        tabIndex={-1}
        className="liquid-glass-strong flex max-h-[78dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--border-hairline)] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
          <label htmlFor="command-bar-input" className="sr-only">
            Search commands, emotions, and somatic protocols
          </label>
          <input
            id="command-bar-input"
            data-autofocus="true"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Log an emotion, start 4-7-8 breathing, open Therapist Summary…"
            className="min-h-[36px] min-w-0 flex-1 bg-transparent text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command bar"
            className="min-h-[36px] shrink-0 rounded-lg px-2.5 font-mono-tabular text-xs text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]"
          >
            Esc
          </button>
        </div>

        <div
          ref={listRef}
          role="listbox"
          aria-label="Command results"
          className="flex-1 overflow-y-auto p-2.5"
        >
          {actions.length === 0 ? (
            <p className="p-6 text-center text-xs text-[var(--ink-muted)]">
              No matching actions for &ldquo;{query}&rdquo;
            </p>
          ) : (
            actions.map((item, idx) => {
              const highlighted = idx === safeActiveIdx;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={highlighted}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    item.run();
                    onClose();
                  }}
                  className="flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors"
                  style={{
                    backgroundColor: highlighted ? 'var(--surface-hover)' : 'transparent',
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--ink-primary)]">
                        {item.label}
                      </p>
                      <p className="truncate text-xs text-[var(--ink-muted)]">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-[var(--ink-muted)]">
                    {item.group}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
