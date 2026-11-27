import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BellOff,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Play,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AppSettings,
  ContextTag,
  EmotionDef,
  MoodEntry,
  NudgeWindow,
  ResetProtocol,
} from '../types/wellbe';
import {
  ALL_EMOTIONS_MAP,
  CONTEXT_TAGS,
  RESET_PROTOCOLS,
  STEADY_EMOTION,
} from '../data/wellbeData';
import { AffectiveGlyph, getQuadrantStyle } from './AffectiveGlyphs';
import { CompactEmotionMatrix, getEmotionPersonalGlow } from './CompactEmotionMatrix';
import { cancelActiveDragScroll, useDragToScroll } from '../hooks/useDragToScroll';

export interface QuickLogResult {
  entry: MoodEntry | null;
  committedAndReverted?: boolean;
  ignoredDuplicate?: boolean;
}

interface TodayTabProps {
  activeStreak?: number;
  latestEntry: MoodEntry | null;
  selectedEmotionIds: string[];
  nudges: NudgeWindow[];
  settings: AppSettings;
  onQuickLog: (emotion: EmotionDef) => QuickLogResult;
  onClearSelection: () => void;
  onUpdateEntry: (id: string, tags: ContextTag[], note: string) => void;
  isActive?: boolean;
  onToggleDnd: () => void;
  onOpenManageNudges: () => void;
  onNavigateRoutines: () => void;
  onLaunchProtocol: (protocol: ResetProtocol) => void;
}

// Keep Voice Panic Anchor and Gratitude Capture strictly integrated inside Routines (no standalone cards on Today)
const TODAY_RESET_DECK = RESET_PROTOCOLS.filter(
  (p) => p.type !== 'panic' && p.type !== 'gratitude'
);

const LONG_PRESS_DURATION_MS = 480;
const LONG_PRESS_MOVE_LIMIT_PX = 8;
const AUTO_REVERT_MS = 5000;

const LIVE_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});
const LIVE_TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

/** Isolated clock so 30s time ticks never re-render the 16-emotion grid or reset deck */
const LiveDateTimeLine: React.FC<{ isActive: boolean }> = React.memo(({ isActive }) => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!isActive) return;
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, [isActive]);

  const formattedDate = LIVE_DATE_FMT.format(now);
  const formattedTime = LIVE_TIME_FMT.format(now);

  return (
    <span className="tabular-nums">
      {formattedDate} <span aria-hidden="true">·</span> {formattedTime}
    </span>
  );
});
LiveDateTimeLine.displayName = 'LiveDateTimeLine';

interface PredictiveNudgesCardProps {
  nextNudge: NudgeWindow | undefined;
  dndEnabled: boolean;
  plainLanguage: boolean;
  onToggleDnd: () => void;
  onOpenManageNudges: () => void;
}

const PredictiveNudgesCard: React.FC<PredictiveNudgesCardProps> = React.memo(
  ({ nextNudge, dndEnabled, plainLanguage, onToggleDnd, onOpenManageNudges }) => (
    <section
      aria-labelledby="predictive-nudges-heading"
      data-edge-recede=""
      className="wb-surface rounded-2xl p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-muted)]">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--bio-mint)]" />
            <span>Pattern Insight</span>
          </div>
          <h2
            id="predictive-nudges-heading"
            className="mt-1 text-base font-semibold text-[var(--ink-primary)]"
          >
            {plainLanguage
              ? 'Helpful Check-In Reminders'
              : 'Predictive Check-In Nudges'}
          </h2>
        </div>

        {/* Do Not Disturb Toggle (≥44px hit target) */}
        <button
          type="button"
          role="switch"
          aria-checked={dndEnabled}
          onClick={onToggleDnd}
          className="flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          {dndEnabled ? (
            <BellOff className="h-3.5 w-3.5 text-[var(--q-red-fg)]" />
          ) : (
            <Bell className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          )}
          <span>{dndEnabled ? 'DND On' : 'Do Not Disturb'}</span>
        </button>
      </div>

      {nextNudge && (
        <div className="mt-4 rounded-xl bg-[var(--surface-subtle)] p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-primary)] tabular-nums">
            <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" />
            <span>
              {dndEnabled
                ? `Paused (DND) · ${nextNudge.timeLabel} · ${nextNudge.title}`
                : `Next: ${nextNudge.timeLabel} · ${nextNudge.title}`}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {nextNudge.historicalBasis}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3">
        <span className="text-xs text-[var(--ink-muted)]">
          Computed from local check-in history
        </span>
        <button
          type="button"
          onClick={onOpenManageNudges}
          className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-soft)]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Manage &amp; Test</span>
        </button>
      </div>
    </section>
  )
);
PredictiveNudgesCard.displayName = 'PredictiveNudgesCard';

interface QuickResetDeckCarouselProps {
  plainLanguage: boolean;
  onLaunchProtocol: (protocol: ResetProtocol) => void;
}

const QuickResetDeckCarousel: React.FC<QuickResetDeckCarouselProps> = React.memo(
  ({ plainLanguage, onLaunchProtocol }) => {
    const [deckIndex, setDeckIndex] = useState(0);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const deckContainerRef = useRef<HTMLDivElement>(null);
    const deckCardRef = useRef<HTMLDivElement>(null);

    const safeDeckIndex = Math.max(0, Math.min(TODAY_RESET_DECK.length - 1, deckIndex));
    const activeDeckProtocol = TODAY_RESET_DECK[safeDeckIndex];

    const handlePrevDeck = useCallback(() => {
      setDeckIndex((i) => (i - 1 + TODAY_RESET_DECK.length) % TODAY_RESET_DECK.length);
    }, []);
    const handleNextDeck = useCallback(() => {
      setDeckIndex((i) => (i + 1) % TODAY_RESET_DECK.length);
    }, []);

    // Axis-locked mouse horizontal swipe on Quick Reset Deck; vertical drags bubble smoothly to Today page scroll
    useDragToScroll(deckContainerRef, {
      axis: 'carousel',
      hideScrollbar: false,
      onSwipeLeft: handleNextDeck,
      onSwipeRight: handlePrevDeck,
      previewRef: deckCardRef,
      swipeThreshold: 44,
    });

    return (
      <div
        ref={deckContainerRef}
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchStartRef.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          if (!touchStartRef.current) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - touchStartRef.current.x;
          const dy = t.clientY - touchStartRef.current.y;
          touchStartRef.current = null;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            if (dx > 0) handlePrevDeck();
            else handleNextDeck();
          }
        }}
        className="border-t border-[var(--border-hairline)] pt-4"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--ink-primary)]">
              Quick Reset Deck
            </h3>
            <p className="text-xs text-[var(--ink-muted)] tabular-nums">
              {plainLanguage ? 'Calming Exercise' : 'Protocol'}{' '}
              {safeDeckIndex + 1} of {TODAY_RESET_DECK.length}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevDeck}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
              aria-label="Previous quick reset protocol"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNextDeck}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
              aria-label="Next quick reset protocol"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Card stage uses overflow-x-clip with padding so focus-visible rings never clip */}
        <div className="-mx-1 overflow-x-clip px-1 py-1">
          <div
            ref={deckCardRef}
            aria-live="polite"
            className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-muted)]">
              <span className="font-semibold text-[var(--ink-primary)]">
                {activeDeckProtocol.targetState}
              </span>
              <span className="tabular-nums">{activeDeckProtocol.durationLabel}</span>
            </div>
            <h4 className="mt-1.5 text-sm font-semibold text-[var(--ink-primary)]">
              {activeDeckProtocol.title}
            </h4>
            <p className="wb-prose mt-1 text-xs leading-relaxed text-[var(--ink-secondary)]">
              {activeDeckProtocol.scienceNote}
            </p>
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onLaunchProtocol(activeDeckProtocol)}
                className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-3.5 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
              >
                <Play className="h-3.5 w-3.5 shrink-0" />
                <span>{activeDeckProtocol.ctaLabel}</span>
              </button>

              {/* Accessible step indicators with 44px vertical touch target */}
              <div
                className="flex items-center"
                role="tablist"
                aria-label="Quick reset deck slides"
              >
                {TODAY_RESET_DECK.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === safeDeckIndex}
                    aria-label={`Protocol ${idx + 1}: ${p.shortTitle}`}
                    onClick={() => setDeckIndex(idx)}
                    className="flex min-h-[44px] min-w-[28px] items-center justify-center rounded-lg"
                  >
                    <span
                      className="block h-2 rounded-full transition-transform duration-150"
                      style={{
                        width: idx === safeDeckIndex ? '16px' : '7px',
                        backgroundColor:
                          idx === safeDeckIndex
                            ? 'var(--accent-primary)'
                            : 'var(--border-strong)',
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
QuickResetDeckCarousel.displayName = 'QuickResetDeckCarousel';

interface TodayRoutineResetCardProps {
  currentMoodLabel: string;
  recommendedProtocol: ResetProtocol;
  activeStreak: number;
  breathingStreak: number;
  calmMode: boolean;
  plainLanguage: boolean;
  showDeck: boolean;
  onNavigateRoutines: () => void;
  onLaunchProtocol: (protocol: ResetProtocol) => void;
}

const TodayRoutineResetCard: React.FC<TodayRoutineResetCardProps> = React.memo(
  ({
    currentMoodLabel,
    recommendedProtocol,
    activeStreak,
    breathingStreak,
    calmMode,
    plainLanguage,
    showDeck,
    onNavigateRoutines,
    onLaunchProtocol,
  }) => (
    <section
      aria-labelledby="today-reset-heading"
      data-edge-recede=""
      className="wb-surface space-y-5 rounded-2xl p-5"
    >
      {/* Context Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="today-reset-heading"
            className="text-base font-semibold text-[var(--ink-primary)]"
          >
            Today&apos;s Routine &amp; Quick Reset
          </h2>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)] tabular-nums">
            Suggested for {currentMoodLabel}
            {!calmMode && activeStreak > 0 && (
              <>
                {' '}
                <span aria-hidden="true">·</span> {activeStreak}d check-in streak
              </>
            )}
            {!calmMode && breathingStreak > 0 && (
              <>
                {' '}
                <span aria-hidden="true">·</span> {breathingStreak}{' '}
                {breathingStreak === 1 ? 'reset' : 'resets'}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateRoutines}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-3 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-soft)]"
        >
          <span>Routines</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Recommended Reset Spotlight */}
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-[var(--ink-muted)]">
          <span className="font-semibold text-[var(--accent-primary)]">
            Recommended Reset
          </span>
          <span className="tabular-nums">{recommendedProtocol.durationLabel}</span>
        </div>
        <h3 className="mt-1.5 text-base font-semibold text-[var(--ink-primary)]">
          {recommendedProtocol.title}
        </h3>
        <p className="wb-prose mt-1.5 text-sm leading-relaxed text-[var(--ink-secondary)]">
          {recommendedProtocol.summary}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onLaunchProtocol(recommendedProtocol)}
            className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl px-4 text-xs font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-primary-ink)',
            }}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{recommendedProtocol.ctaLabel}</span>
          </button>
          <button
            type="button"
            onClick={onNavigateRoutines}
            className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3.5 text-xs font-semibold text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
          >
            <span>Open Routines</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          </button>
        </div>
      </div>

      {/* Quick Reset Deck (Isolated swipeable carousel so swipes never re-render TodayTab or Emotion Matrix) */}
      {showDeck && (
        <QuickResetDeckCarousel
          plainLanguage={plainLanguage}
          onLaunchProtocol={onLaunchProtocol}
        />
      )}
    </section>
  )
);
TodayRoutineResetCard.displayName = 'TodayRoutineResetCard';

interface AttachToEntryCardProps {
  cardRef?: React.RefObject<HTMLDivElement | null>;
  entryId: string;
  emotionLabel: string;
  draftTagsRef: React.MutableRefObject<ContextTag[]>;
  draftNoteRef: React.MutableRefObject<string>;
  onNoteFocusChange: (focused: boolean) => void;
  onCardActivity: () => void;
  onSaveStart: () => void;
  onSaveDetails: (tags: ContextTag[], note: string) => void;
  onDismiss: () => void;
}

/**
 * Isolated AttachToEntryCard: typing notes or toggling context tags never re-renders
 * TodayTab, the Latest Emotion card, or the 16 CompactEmotionButton tiles.
 */
const AttachToEntryCard: React.FC<AttachToEntryCardProps> = React.memo(
  ({
    cardRef,
    entryId,
    emotionLabel,
    draftTagsRef,
    draftNoteRef,
    onNoteFocusChange,
    onCardActivity,
    onSaveStart,
    onSaveDetails,
    onDismiss,
  }) => {
    const [draftTags, setDraftTags] = useState<ContextTag[]>([]);
    const [draftNote, setDraftNote] = useState('');
    const [savedFeedback, setSavedFeedback] = useState(false);

    // Reset draft inputs cleanly whenever a brand-new check-in entry is logged
    useEffect(() => {
      setDraftTags([]);
      setDraftNote('');
      setSavedFeedback(false);
      draftTagsRef.current = [];
      draftNoteRef.current = '';
    }, [entryId, draftTagsRef, draftNoteRef]);

    const handleToggleTag = (tag: ContextTag) => {
      setDraftTags((prev) => {
        const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
        draftTagsRef.current = next;
        return next;
      });
      // Reset the 10-second countdown on every tag tap (stays paused if note input is focused)
      onCardActivity();
    };

    const handleSave = () => {
      setSavedFeedback(true);
      onSaveDetails(draftTagsRef.current, draftNoteRef.current.trim());
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
      }
    };

    return (
      <div
        ref={cardRef}
        role="status"
        aria-live="polite"
        data-edge-recede=""
        data-no-drag-scroll="true"
        onKeyDown={handleKeyDown}
        onBlurCapture={(e) => {
          // Resume a fresh 5-second countdown once focus exits the Attach card completely
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            onNoteFocusChange(false);
          }
        }}
        className="mt-5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-subtle)] p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-primary-ink)',
              }}
            >
              <Check className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--ink-primary)]">
                Logged {emotionLabel}
              </p>
              <p className="text-xs text-[var(--ink-muted)]">
                Saved locally · Add optional context drivers or a quick note
              </p>
            </div>
          </div>
          <button
            type="button"
            onPointerDown={onSaveStart}
            onClick={onDismiss}
            className="flex min-h-[44px] min-w-[44px] -mr-2 -mt-2 items-center justify-center rounded-xl text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
            aria-label="Dismiss check-in details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Context tags">
          {CONTEXT_TAGS.map((tag) => {
            const active = draftTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleToggleTag(tag)}
                aria-pressed={active}
                className="min-h-[44px] rounded-xl px-3.5 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: active ? 'var(--accent-primary)' : 'var(--surface-card)',
                  color: active ? 'var(--accent-primary-ink)' : 'var(--ink-secondary)',
                  border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-hairline)'}`,
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="inline-checkin-note" className="sr-only">
            Optional journal note
          </label>
          <input
            id="inline-checkin-note"
            type="text"
            value={draftNote}
            onFocus={() => onNoteFocusChange(true)}
            onChange={(e) => {
              const val = e.target.value;
              draftNoteRef.current = val;
              setDraftNote(val);
              onNoteFocusChange(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
            placeholder="Optional one-line note (e.g., After morning walk or deep focus block)"
            className="min-h-[44px] flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)]"
          />
          <button
            type="button"
            onPointerDown={onSaveStart}
            onClick={handleSave}
            className="min-h-[44px] shrink-0 whitespace-nowrap rounded-xl px-4 text-xs font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-primary-ink)',
            }}
          >
            {savedFeedback ? 'Details Saved' : 'Attach to Entry'}
          </button>
        </div>
      </div>
    );
  }
);
AttachToEntryCard.displayName = 'AttachToEntryCard';

export const TodayTab: React.FC<TodayTabProps> = React.memo(
  ({
    isActive = true,
    latestEntry,
    activeStreak = 0,
    selectedEmotionIds,
    nudges,
    settings,
    onQuickLog,
    onClearSelection,
    onUpdateEntry,
    onToggleDnd,
    onOpenManageNudges,
    onNavigateRoutines,
    onLaunchProtocol,
  }) => {
    const [justLogged, setJustLogged] = useState<MoodEntry | null>(null);
    const justLoggedIdRef = useRef<string | null>(null);
    justLoggedIdRef.current = justLogged?.id ?? null;
    const draftTagsRef = useRef<ContextTag[]>([]);
    const draftNoteRef = useRef<string>('');

    const quickCheckInCardRef = useRef<HTMLElement | null>(null);
    const attachCardRef = useRef<HTMLDivElement | null>(null);
    const checkInHeadingRef = useRef<HTMLHeadingElement | null>(null);

    // Inside-the-box inspect panel state
    const inspectPanelId = useId();
    const emotionTitleId = useId();
    const [isInspectExpanded, setIsInspectExpanded] = useState(false);
    const [isInspectSettled, setIsInspectSettled] = useState(false);

    const saveTimerRef = useRef<number | null>(null);
    const autoRevertTimerRef = useRef<number | null>(null);
    const focusRafRef = useRef<number | null>(null);
    const isInteractingAttachRef = useRef(false);
    const selectedCountRef = useRef(selectedEmotionIds.length);
    selectedCountRef.current = selectedEmotionIds.length;
    const prevSelectedSigRef = useRef(selectedEmotionIds.join(','));
    const glowTimerRef = useRef<number | null>(null);
    const settleTimerRef = useRef<number | null>(null);

    // Long-press secondary inspect gesture refs (480ms hold, < 8px travel)
    const longPressTimerRef = useRef<number | null>(null);
    const longPressOriginRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
    const suppressNextClickRef = useRef(false);
    const suppressResetTimerRef = useRef<number | null>(null);
    const suppressContextMenuRef = useRef(false);
    const infoToggleBtnRef = useRef<HTMLButtonElement | null>(null);

    const latestSurfaceRef = useRef<HTMLDivElement | null>(null);
    const latestTitleBoxRef = useRef<HTMLDivElement | null>(null);
    const latestTitleRef = useRef<HTMLParagraphElement | null>(null);

    const activeEmotionSignature = latestEntry
      ? `${latestEntry.id}:${latestEntry.emotionId}`
      : null;
    const prevSignatureRef = useRef<string | null>(activeEmotionSignature);
    const prevBounceSigRef = useRef<string | null>(activeEmotionSignature);
    const [glowBurstId, setGlowBurstId] = useState(0);
    const [glowPhase, setGlowPhase] = useState<'idle' | 'a' | 'b'>('idle');
    const isGlowActive = glowPhase !== 'idle';
    const [labelBouncePhase, setLabelBouncePhase] = useState<'idle' | 'a' | 'b'>('idle');
    const [labelPeakScale, setLabelPeakScale] = useState(1.28);
    const labelBounceTimerRef = useRef<number | null>(null);

    const [focusExpanded, setFocusExpanded] = useState(false);

    const clearLongPressTimer = useCallback(() => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      longPressOriginRef.current = null;
    }, []);

    const clearAutoRevertTimer = useCallback(() => {
      if (autoRevertTimerRef.current !== null) {
        window.clearTimeout(autoRevertTimerRef.current);
        autoRevertTimerRef.current = null;
      }
    }, []);

    useEffect(() => {
      if (!isActive) {
        clearLongPressTimer();
        clearAutoRevertTimer();
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        if (glowTimerRef.current !== null) {
          window.clearTimeout(glowTimerRef.current);
          glowTimerRef.current = null;
          setGlowPhase('idle');
        }
      }
    }, [isActive, clearLongPressTimer, clearAutoRevertTimer]);

    const handleRevertSelectionAndCard = useCallback(
      (restoreFocus = false) => {
        clearAutoRevertTimer();
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        const wasFocusedInside = Boolean(
          attachCardRef.current &&
            document.activeElement &&
            attachCardRef.current.contains(document.activeElement)
        );
        isInteractingAttachRef.current = false;
        draftTagsRef.current = [];
        draftNoteRef.current = '';
        setJustLogged(null);
        onClearSelection();
        if (restoreFocus || wasFocusedInside) {
          if (focusRafRef.current !== null) {
            window.cancelAnimationFrame(focusRafRef.current);
          }
          focusRafRef.current = window.requestAnimationFrame(() => {
            focusRafRef.current = null;
            if (!checkInHeadingRef.current?.closest('[hidden], [inert]')) {
              checkInHeadingRef.current?.focus({ preventScroll: true });
            }
          });
        }
      },
      [clearAutoRevertTimer, onClearSelection]
    );

    const scheduleAutoRevert = useCallback(() => {
      clearAutoRevertTimer();
      if (isInteractingAttachRef.current) return;
      autoRevertTimerRef.current = window.setTimeout(() => {
        autoRevertTimerRef.current = null;
        if (isInteractingAttachRef.current) return;
        handleRevertSelectionAndCard(false);
      }, AUTO_REVERT_MS);
    }, [clearAutoRevertTimer, handleRevertSelectionAndCard]);

    useEffect(() => {
      return () => {
        if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
        if (autoRevertTimerRef.current !== null) window.clearTimeout(autoRevertTimerRef.current);
        if (focusRafRef.current !== null) window.cancelAnimationFrame(focusRafRef.current);
        if (glowTimerRef.current !== null) window.clearTimeout(glowTimerRef.current);
        if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
        if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
        if (suppressResetTimerRef.current !== null) window.clearTimeout(suppressResetTimerRef.current);
        if (labelBounceTimerRef.current !== null) window.clearTimeout(labelBounceTimerRef.current);
      };
    }, []);

    // Tap-away dismissal when a tile is selected and user taps outside Quick Check-In
    // (ignores taps on floating Toast banner and preserves active note entry if user has typed text)
    useEffect(() => {
      if (selectedEmotionIds.length === 0) return;
      const handleOutsidePointerDown = (e: PointerEvent) => {
        const target = e.target as Element | null;
        if (!target) return;
        if (quickCheckInCardRef.current?.contains(target)) return;
        if (typeof target.closest === 'function' && target.closest('[data-toast-host="true"]')) {
          return;
        }
        if (isInteractingAttachRef.current && draftNoteRef.current.trim().length > 0) return;
        handleRevertSelectionAndCard(false);
      };
      document.addEventListener('pointerdown', handleOutsidePointerDown, true);
      return () => {
        document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
      };
    }, [selectedEmotionIds.length, handleRevertSelectionAndCard]);

    // Keep Attach to Entry card & 5-second selection auto-reset aligned on every selection change
    useEffect(() => {
      const nextSig = selectedEmotionIds.join(',');
      const prevSig = prevSelectedSigRef.current;
      prevSelectedSigRef.current = nextSig;

      if (selectedEmotionIds.length === 0) {
        clearAutoRevertTimer();
        if (justLoggedIdRef.current !== null && saveTimerRef.current === null) {
          isInteractingAttachRef.current = false;
          draftTagsRef.current = [];
          draftNoteRef.current = '';
          setJustLogged(null);
        }
        return;
      }
      if (
        saveTimerRef.current === null &&
        !isInteractingAttachRef.current &&
        (autoRevertTimerRef.current === null || prevSig !== nextSig)
      ) {
        scheduleAutoRevert();
      }
    }, [selectedEmotionIds, clearAutoRevertTimer, scheduleAutoRevert]);

    // Collapse inspect view automatically if all entries are cleared (0-log empty state)
    useEffect(() => {
      if (!latestEntry && isInspectExpanded) {
        setIsInspectExpanded(false);
      }
    }, [latestEntry, isInspectExpanded]);

    // Unclip :focus-visible rings inside the reveal container once grid animation finishes
    useEffect(() => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      if (!isInspectExpanded) {
        setIsInspectSettled(false);
        return;
      }
      if (settings.reduceMotion) {
        setIsInspectSettled(true);
        return;
      }
      settleTimerRef.current = window.setTimeout(() => {
        setIsInspectSettled(true);
        settleTimerRef.current = null;
      }, 250);
    }, [isInspectExpanded, settings.reduceMotion]);

    // Trigger single finite 8-second ambient pulse ONLY upon visible emotion change (never while tab is hidden or on inspect toggle)
    useEffect(() => {
      if (activeEmotionSignature === prevSignatureRef.current) return;
      prevSignatureRef.current = activeEmotionSignature;

      if (glowTimerRef.current !== null) {
        window.clearTimeout(glowTimerRef.current);
        glowTimerRef.current = null;
      }

      if (!activeEmotionSignature || settings.reduceMotion || !isActive) {
        setGlowPhase('idle');
        return;
      }

      setGlowBurstId((n) => n + 1);
      setGlowPhase((prev) => (prev === 'a' ? 'b' : 'a'));
      glowTimerRef.current = window.setTimeout(() => {
        setGlowPhase('idle');
        glowTimerRef.current = null;
      }, 8000);
    }, [activeEmotionSignature, settings.reduceMotion, isActive]);

    // Immediately halt active glow & bounce if Reduce Motion is toggled on mid-animation
    useEffect(() => {
      if (settings.reduceMotion) {
        if (glowPhase !== 'idle') {
          if (glowTimerRef.current !== null) {
            window.clearTimeout(glowTimerRef.current);
            glowTimerRef.current = null;
          }
          setGlowPhase('idle');
        }
        if (labelBouncePhase !== 'idle') {
          if (labelBounceTimerRef.current !== null) {
            window.clearTimeout(labelBounceTimerRef.current);
            labelBounceTimerRef.current = null;
          }
          setLabelBouncePhase('idle');
        }
      }
    }, [settings.reduceMotion, glowPhase, labelBouncePhase]);

    // Trigger clamped bounce-and-settle typography on Latest card whenever an emotion is logged
    useLayoutEffect(() => {
      if (activeEmotionSignature === prevBounceSigRef.current) return;
      prevBounceSigRef.current = activeEmotionSignature;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const surfaceEl = latestSurfaceRef.current;
      const titleBoxEl = latestTitleBoxRef.current;
      const titleEl = latestTitleRef.current;

      if (labelBounceTimerRef.current !== null) {
        window.clearTimeout(labelBounceTimerRef.current);
        labelBounceTimerRef.current = null;
      }

      // Guard against hidden tab (display: none -> 0x0 layout metrics) so Instant Check-In from other tabs never computes a stale scale
      if (
        !isActive ||
        !activeEmotionSignature ||
        settings.reduceMotion ||
        prefersReducedMotion ||
        !surfaceEl ||
        surfaceEl.clientWidth === 0 ||
        !titleEl ||
        titleEl.offsetWidth === 0
      ) {
        setLabelBouncePhase('idle');
        return;
      }

      // Measure unscaled layout metrics of the combined icon + emotion label group so peak scale
      // stays strictly clear of the border outline, top-left "Latest" label, and top-right [i] icon
      const surfaceW = surfaceEl.clientWidth;
      const boxH = titleBoxEl && titleBoxEl.clientHeight > 0 ? titleBoxEl.clientHeight : 72;
      const safeW = Math.max(84, surfaceW - 84);
      const safeH = Math.max(36, boxH - 12);
      const textW = Math.max(1, titleEl.offsetWidth);
      const textH = Math.max(1, titleEl.offsetHeight);

      // Account for small vertical lift/settle clearance on GPU-composited transforms
      const maxScaleX = safeW / (textW * 1.06);
      const maxScaleY = safeH / (textH * 1.08);
      const rawSafeScale = Math.min(maxScaleX, maxScaleY);

      const clampedScale =
        rawSafeScale < 1.06
          ? Math.max(1.02, Math.min(1.06, rawSafeScale))
          : Math.min(1.22, Math.max(1.08, rawSafeScale));

      setLabelPeakScale(Number(clampedScale.toFixed(3)));
      setLabelBouncePhase((prev) => (prev === 'a' ? 'b' : 'a'));

      // Safety fallback so backgrounded tabs always hand off cleanly to the idle breathing loop
      labelBounceTimerRef.current = window.setTimeout(() => {
        labelBounceTimerRef.current = null;
        setLabelBouncePhase('idle');
      }, 720);
    }, [activeEmotionSignature, latestEntry?.emotionLabel, settings.reduceMotion, isActive]);

    const handleToggleInspect = useCallback(() => {
      if (!latestEntry) return;
      setIsInspectExpanded((prev) => !prev);
    }, [latestEntry]);

    const handleCardPointerDown = useCallback(
      (e: React.PointerEvent<HTMLElement>) => {
        if (!latestEntry) return;
        // Mouse primary button only; allow touch/pen
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        // Let the explicit [i] button handle its own click/tap without arming long-press
        if (e.target instanceof Element && e.target.closest('button, a, input, textarea')) {
          return;
        }

        clearLongPressTimer();
        suppressContextMenuRef.current = false;
        longPressOriginRef.current = {
          x: e.clientX,
          y: e.clientY,
          pointerId: e.pointerId,
        };

        longPressTimerRef.current = window.setTimeout(() => {
          longPressTimerRef.current = null;
          longPressOriginRef.current = null;
          // Suppress useDragToScroll capture for this hold gesture so holding never drags the viewport
          cancelActiveDragScroll();
          // One-shot click suppression so releasing after 480ms never fires a stray click
          suppressNextClickRef.current = true;
          suppressContextMenuRef.current = true;
          if (suppressResetTimerRef.current !== null) {
            window.clearTimeout(suppressResetTimerRef.current);
          }
          suppressResetTimerRef.current = window.setTimeout(() => {
            suppressNextClickRef.current = false;
            suppressContextMenuRef.current = false;
            suppressResetTimerRef.current = null;
          }, 500);

          setIsInspectExpanded((prev) => !prev);
        }, LONG_PRESS_DURATION_MS);
      },
      [latestEntry, clearLongPressTimer]
    );

    const handleCardPointerMove = useCallback(
      (e: React.PointerEvent<HTMLElement>) => {
        const origin = longPressOriginRef.current;
        if (!origin || origin.pointerId !== e.pointerId) return;
        const dist = Math.hypot(e.clientX - origin.x, e.clientY - origin.y);
        if (dist >= LONG_PRESS_MOVE_LIMIT_PX) {
          clearLongPressTimer();
        }
      },
      [clearLongPressTimer]
    );

    const handleCardPointerEnd = useCallback(
      (e: React.PointerEvent<HTMLElement>) => {
        if (longPressOriginRef.current?.pointerId === e.pointerId) {
          clearLongPressTimer();
        }
      },
      [clearLongPressTimer]
    );

    const handleCardClickCapture = useCallback((e: React.MouseEvent<HTMLElement>) => {
      if (!suppressNextClickRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      suppressNextClickRef.current = false;
      if (suppressResetTimerRef.current !== null) {
        window.clearTimeout(suppressResetTimerRef.current);
        suppressResetTimerRef.current = null;
      }
    }, []);

    const handleCardContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
      if (suppressContextMenuRef.current || longPressTimerRef.current !== null) {
        e.preventDefault();
      }
    }, []);

    const handleCardKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLElement>) => {
        if (!latestEntry) return;
        if (e.shiftKey && e.key === 'Enter') {
          e.preventDefault();
          setIsInspectExpanded((prev) => !prev);
          return;
        }
        if (e.altKey && (e.key.toLowerCase() === 'i' || e.code === 'KeyI')) {
          e.preventDefault();
          setIsInspectExpanded((prev) => !prev);
          return;
        }
        if (e.key === 'Escape' && isInspectExpanded) {
          e.preventDefault();
          setIsInspectExpanded(false);
        }
      },
      [latestEntry, isInspectExpanded]
    );

    const handleTileTap = useCallback(
      (emotion: EmotionDef) => {
        const result = onQuickLog(emotion);
        if (result.ignoredDuplicate) {
          return;
        }

        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        clearAutoRevertTimer();
        isInteractingAttachRef.current = false;

        if (result.committedAndReverted) {
          const currentTags = draftTagsRef.current;
          const currentNote = draftNoteRef.current.trim();
          if (result.entry && (currentTags.length > 0 || currentNote.length > 0)) {
            onUpdateEntry(result.entry.id, currentTags, currentNote);
          }
          selectedCountRef.current = 0;
          draftTagsRef.current = [];
          draftNoteRef.current = '';
          setJustLogged(null);
          return;
        }

        const entry = result.entry;
        if (!entry) {
          selectedCountRef.current = 0;
          draftTagsRef.current = [];
          draftNoteRef.current = '';
          setJustLogged(null);
          return;
        }

        selectedCountRef.current = 1;

        if (justLoggedIdRef.current !== entry.id) {
          draftTagsRef.current = [];
          draftNoteRef.current = '';
        }
        setJustLogged(entry);
        scheduleAutoRevert();
      },
      [clearAutoRevertTimer, onQuickLog, onUpdateEntry, scheduleAutoRevert]
    );

    const handleAttachNoteFocusChange = useCallback(
      (focused: boolean) => {
        isInteractingAttachRef.current = focused;
        if (focused) {
          clearAutoRevertTimer();
        } else if (justLoggedIdRef.current !== null && saveTimerRef.current === null) {
          scheduleAutoRevert();
        }
      },
      [clearAutoRevertTimer, scheduleAutoRevert]
    );

    const handleAttachCardActivity = useCallback(() => {
      if (isInteractingAttachRef.current) {
        clearAutoRevertTimer();
      } else if (justLoggedIdRef.current !== null && saveTimerRef.current === null) {
        scheduleAutoRevert();
      }
    }, [clearAutoRevertTimer, scheduleAutoRevert]);

    const handleAttachSaveStart = useCallback(() => {
      // Prevent auto-revert from firing between pointerdown and click on Attach/Dismiss
      clearAutoRevertTimer();
    }, [clearAutoRevertTimer]);

    const handleAttachDismiss = useCallback(() => {
      handleRevertSelectionAndCard(true);
    }, [handleRevertSelectionAndCard]);

    const handleSaveDetails = useCallback(
      (tags: ContextTag[], note: string) => {
        const entryId = justLoggedIdRef.current;
        if (!entryId) return;
        clearAutoRevertTimer();
        isInteractingAttachRef.current = false;
        onUpdateEntry(entryId, tags, note);
        if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
          saveTimerRef.current = null;
          const wasFocusedInside = Boolean(
            attachCardRef.current &&
              document.activeElement &&
              attachCardRef.current.contains(document.activeElement)
          );
          draftTagsRef.current = [];
          draftNoteRef.current = '';
          setJustLogged(null);
          onClearSelection();
          if (wasFocusedInside) {
            if (focusRafRef.current !== null) {
              window.cancelAnimationFrame(focusRafRef.current);
            }
            focusRafRef.current = window.requestAnimationFrame(() => {
              focusRafRef.current = null;
              if (!checkInHeadingRef.current?.closest('[hidden], [inert]')) {
                checkInHeadingRef.current?.focus({ preventScroll: true });
              }
            });
          }
        }, 900);
      },
      [clearAutoRevertTimer, onClearSelection, onUpdateEntry]
    );

    const nextNudge = useMemo(() => {
      const enabled = nudges.find((n) => n.enabled);
      return enabled ?? nudges[0];
    }, [nudges]);

    const primaryEmotionDef = latestEntry
      ? ALL_EMOTIONS_MAP[latestEntry.emotionId] ?? STEADY_EMOTION
      : null;
    const latestDisplayLabel = latestEntry
      ? primaryEmotionDef?.label ?? latestEntry.emotionLabel
      : 'No check-in yet';
    const currentMoodLabel = latestEntry ? latestDisplayLabel : 'Steady';

    const latestQuadrantStyle = latestEntry ? getQuadrantStyle(latestEntry.quadrant) : null;
    const primaryGlowColor = latestEntry
      ? getEmotionPersonalGlow(latestEntry.emotionId, latestEntry.quadrant)
      : 'var(--q-balanced-solid)';

    const surfaceInkColor =
      latestEntry && latestQuadrantStyle ? latestQuadrantStyle.fg : 'var(--ink-primary)';

    const surfaceBackgroundStyle: React.CSSProperties =
      latestEntry && latestQuadrantStyle
        ? {
            backgroundColor: 'var(--surface-card)',
            backgroundImage: `linear-gradient(${latestQuadrantStyle.bg}, ${latestQuadrantStyle.bg})`,
            color: surfaceInkColor,
          }
        : {
            backgroundColor: 'var(--surface-card)',
            color: 'var(--ink-primary)',
          };

    const cardTokenStyle: React.CSSProperties | undefined =
      latestEntry && latestQuadrantStyle
        ? ({
            '--latest-emotion-border': latestQuadrantStyle.solid,
            '--latest-emotion-border-bg': latestQuadrantStyle.solid,
            '--latest-emotion-glow': primaryGlowColor,
            '--latest-emotion-glow-bg': primaryGlowColor,
          } as React.CSSProperties)
        : undefined;

    const recommendedProtocol = useMemo(() => {
      const quadrant = latestEntry?.quadrant;
      if (quadrant === 'red') {
        return TODAY_RESET_DECK.find((p) => p.id === 'breathing') ?? TODAY_RESET_DECK[0];
      }
      if (quadrant === 'blue') {
        return TODAY_RESET_DECK.find((p) => p.id === 'stretch') ?? TODAY_RESET_DECK[1];
      }
      if (quadrant === 'yellow') {
        return TODAY_RESET_DECK.find((p) => p.id === 'savoring') ?? TODAY_RESET_DECK[3] ?? TODAY_RESET_DECK[0];
      }
      return TODAY_RESET_DECK.find((p) => p.id === 'grounding') ?? TODAY_RESET_DECK[2] ?? TODAY_RESET_DECK[0];
    }, [latestEntry?.quadrant]);

    const getEmotionDefinitionText = (def: EmotionDef) =>
      settings.plainLanguage ? def.plainDefinition : def.definition;

    return (
      <div className="wb-calm-stack wb-today-bottom-clearance -mt-1 space-y-2 sm:-mt-1.5 sm:space-y-3 lg:space-y-4">
        {/* Today Page Header */}
        <section>
          <h1
            className="text-[20px] font-semibold leading-tight tracking-tight text-[var(--ink-primary)] sm:text-[26px]"
            style={{ textWrap: 'balance' }}
          >
            How are you feeling?
          </h1>
          <p className="mt-0.5 text-[11.5px] font-normal leading-tight text-[var(--ink-muted)] tabular-nums sm:text-[13px]">
            <LiveDateTimeLine isActive={isActive} />
          </p>
        </section>

        {/* Main Responsive Desktop Bento: Left = Latest Emotion Card + 16-Emotion Check-In Matrix, Right = Nudges & Somatic Resets */}
        <div className="grid grid-cols-1 gap-2.5 sm:gap-3.5 lg:grid-cols-12 lg:items-start lg:gap-5">
          {/* Left Primary Column */}
          <div className="min-w-0 space-y-2 sm:space-y-3 lg:col-span-7">
            {/* Latest Emotion Card (2px Active Outline + Finite 8s Ambient Glow + Inside-Box Definition & Physical Cues) */}
            <section
              aria-label="Latest logged emotion"
              tabIndex={latestEntry ? 0 : undefined}
              data-edge-recede=""
              data-has-emotion={latestEntry ? 'true' : 'false'}
              data-blended="false"
              data-glow-phase={settings.reduceMotion ? 'idle' : glowPhase}
              onPointerDown={handleCardPointerDown}
              onPointerMove={handleCardPointerMove}
              onPointerUp={handleCardPointerEnd}
              onPointerCancel={handleCardPointerEnd}
              onPointerLeave={handleCardPointerEnd}
              onClickCapture={handleCardClickCapture}
              onContextMenu={handleCardContextMenu}
              onKeyDown={handleCardKeyDown}
              className="wb-latest-emotion-card select-none"
              style={cardTokenStyle}
            >
              {/* Dedicated polite screen-reader announcement for emotion updates */}
              <span className="sr-only" aria-live="polite" aria-atomic="true">
                {latestEntry
                  ? `Latest emotion: ${latestDisplayLabel}`
                  : 'No check-in logged yet'}
              </span>

              {/* Large Emotion Box — Tinted surface holding title + expandable inside-box definition & physical cues */}
              <div
                ref={latestSurfaceRef}
                className="wb-latest-emotion-surface wb-latest-emotion-surface-today flex flex-col p-2.5 sm:p-4"
                style={surfaceBackgroundStyle}
              >
                {settings.patternAssist && latestEntry && (
                  <span
                    aria-hidden="true"
                    className={`wb-pattern-${latestEntry.quadrant} pointer-events-none absolute inset-0 rounded-[14px] opacity-[0.12]`}
                  />
                )}

                {/* Card Header Row: Pinned top-left "Latest" label & top-right [i] info toggle so emotion title centers geometrically */}
                <div className="pointer-events-none absolute inset-x-3 top-2 z-20 flex items-center justify-between gap-2 sm:inset-x-4 sm:top-3">
                  <p className="text-[11.5px] font-semibold tracking-tight opacity-85 sm:text-xs">
                    Latest
                  </p>

                  <button
                    ref={infoToggleBtnRef}
                    type="button"
                    data-no-drag-scroll="true"
                    data-expanded={latestEntry && isInspectExpanded ? 'true' : 'false'}
                    disabled={!latestEntry}
                    aria-disabled={!latestEntry ? 'true' : undefined}
                    aria-expanded={latestEntry ? isInspectExpanded : false}
                    aria-controls={inspectPanelId}
                    aria-label="Inspect emotion definition and physical cues"
                    title={
                      latestEntry
                        ? 'Inspect emotion definition and physical cues (Shift+Enter or Alt+I)'
                        : 'Log an emotion first to inspect its definition and physical cues'
                    }
                    tabIndex={latestEntry ? 0 : -1}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleInspect();
                    }}
                    className="wb-latest-emotion-info-btn pointer-events-auto -mr-1 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  >
                    <span className="wb-latest-emotion-info-circle flex h-7 w-7 items-center justify-center rounded-full">
                      <Info className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden="true" />
                    </span>
                  </button>
                </div>

                {/* Geometrically Centered Prominent Emotion Icon + Title */}
                <div
                  ref={latestTitleBoxRef}
                  className="wb-latest-emotion-titlebox-today relative z-10 flex flex-1 items-center justify-center px-8 py-1.5 sm:px-10 sm:py-2"
                >
                  <p
                    ref={latestTitleRef}
                    id={emotionTitleId}
                    data-quadrant={latestEntry?.quadrant ?? 'neutral'}
                    data-bounce-phase={settings.reduceMotion ? 'idle' : labelBouncePhase}
                    onAnimationEnd={(e) => {
                      if (e.target === e.currentTarget) {
                        if (labelBounceTimerRef.current !== null) {
                          window.clearTimeout(labelBounceTimerRef.current);
                          labelBounceTimerRef.current = null;
                        }
                        setLabelBouncePhase('idle');
                      }
                    }}
                    className="wb-latest-emotion-label max-w-full gap-2 text-center font-semibold leading-tight tracking-tight sm:gap-2.5"
                    style={
                      {
                        fontSize: 'clamp(1.6rem, 4.4vw, 2.25rem)',
                        '--wb-latest-peak-scale': String(labelPeakScale),
                      } as React.CSSProperties
                    }
                  >
                    {latestEntry && (
                      <span
                        aria-hidden="true"
                        className="wb-latest-emotion-glyph flex shrink-0 items-center justify-center"
                      >
                        <AffectiveGlyph
                          emotionId={latestEntry.emotionId}
                          quadrant={latestEntry.quadrant}
                          size={28}
                          className="wb-latest-emotion-glyph-svg shrink-0"
                        />
                      </span>
                    )}
                    <span
                      data-breathing={
                        latestEntry &&
                        isActive &&
                        !settings.reduceMotion &&
                        labelBouncePhase === 'idle'
                          ? 'active'
                          : 'paused'
                      }
                      className="wb-latest-emotion-text min-w-0 break-words"
                      style={{ textWrap: 'balance' }}
                    >
                      {latestDisplayLabel}
                    </span>
                  </p>
                </div>

                {/* Inside-the-Large-Emotion-Box Compositor-Safe Reveal Slot */}
                <div
                  id={inspectPanelId}
                  role="region"
                  aria-labelledby={emotionTitleId}
                  aria-hidden={!latestEntry || !isInspectExpanded}
                  inert={!latestEntry || !isInspectExpanded}
                  data-open={latestEntry && isInspectExpanded ? 'true' : 'false'}
                  data-settled={isInspectSettled ? 'true' : 'false'}
                  className="wb-emotion-inspect-grid relative z-10"
                >
                  <div className="wb-emotion-inspect-inner">
                    {latestEntry && primaryEmotionDef && (
                      <div className="wb-emotion-inspect-body">
                        {/* Single Emotion Definition & Physical Cues */}
                        <div className="min-w-0 space-y-2.5">
                          <p
                            title={getEmotionDefinitionText(primaryEmotionDef)}
                            className="wb-emotion-definition text-sm font-medium leading-snug"
                          >
                            {getEmotionDefinitionText(primaryEmotionDef)}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                            <span className="wb-emotion-cues-label text-xs font-semibold tracking-tight">
                              Physical cues
                            </span>
                            <div
                              className="flex flex-wrap items-center gap-1.5"
                              role="list"
                              aria-label={`Common physical cues for ${primaryEmotionDef.label}`}
                            >
                              {primaryEmotionDef.physicalCues.map((cue) => (
                                <span
                                  key={cue}
                                  role="listitem"
                                  className="wb-emotion-cue-chip"
                                >
                                  {cue}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* 16-Emotion Quick Check-In Grid (Shared Compact Inline Matrix sized to fit one window) */}
            <section
              ref={quickCheckInCardRef}
              aria-labelledby="checkin-matrix-heading"
              className="wb-surface wb-today-checkin-card min-w-0 rounded-2xl p-2 sm:p-3"
            >
              <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2 sm:mb-2">
                <div className="min-w-0 flex-1">
                  <h2
                    ref={checkInHeadingRef}
                    tabIndex={-1}
                    id="checkin-matrix-heading"
                    className="text-[13.5px] font-semibold leading-tight text-[var(--ink-primary)] focus:outline-none sm:text-base"
                  >
                    Quick Check-In
                  </h2>
                  <p className="mt-0.5 text-[11px] leading-tight text-[var(--ink-muted)] sm:text-xs">
                    {settings.plainLanguage
                      ? 'Tap how you feel right now to save it.'
                      : 'Tap any emotion to log immediately.'}
                  </p>
                </div>

                {/* Active Selection Clear */}
                {selectedEmotionIds.length > 0 && (
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      data-no-drag-scroll="true"
                      onClick={() => handleRevertSelectionAndCard(false)}
                      className="-my-2 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg px-2.5 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
                      aria-label="Clear selected emotion outline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <CompactEmotionMatrix
                selectedEmotions={selectedEmotionIds}
                onSelectEmotion={handleTileTap}
                fitViewport
                layoutMode="inline"
                patternAssist={settings.patternAssist}
                reduceMotion={settings.reduceMotion}
                glowActive={isGlowActive}
                glowBurstId={glowBurstId}
                recedeQuadrants
                ariaLabel="16-emotion quick check-in matrix"
              />

            {/* Inline Post-Tap Optional Context Tags & Journal Note Drawer (Isolated from TodayTab & matrix renders) */}
            {justLogged && (
              <AttachToEntryCard
                cardRef={attachCardRef}
                entryId={justLogged.id}
                emotionLabel={justLogged.emotionLabel}
                draftTagsRef={draftTagsRef}
                draftNoteRef={draftNoteRef}
                onNoteFocusChange={handleAttachNoteFocusChange}
                onCardActivity={handleAttachCardActivity}
                onSaveStart={handleAttachSaveStart}
                onSaveDetails={handleSaveDetails}
                onDismiss={handleAttachDismiss}
              />
            )}
          </section>
          </div>

          {/* Right Column: Predictive Check-In Nudges + Today's Routine & Quick Reset */}
          <div className="min-w-0 space-y-6 lg:col-span-5">
            {/* Focus Mode Compact Disclosure Toggle */}
            {settings.focusMode && (
              <button
                type="button"
                aria-expanded={focusExpanded}
                data-edge-recede=""
                onClick={() => setFocusExpanded((e) => !e)}
                className="wb-surface flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
              >
                <span>
                  {focusExpanded
                    ? 'Hide Nudges & Reset Deck (Focus Mode)'
                    : 'Show Predictive Nudges & Quick Reset Deck'}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform ${
                    focusExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>
            )}

            {/* Predictive Check-In Nudges Card (Memoized) */}
            {!settings.calmMode && (!settings.focusMode || focusExpanded) && (
              <PredictiveNudgesCard
                nextNudge={nextNudge}
                dndEnabled={settings.dndEnabled}
                plainLanguage={settings.plainLanguage}
                onToggleDnd={onToggleDnd}
                onOpenManageNudges={onOpenManageNudges}
              />
            )}

            {/* Today's Routine & Quick Reset Section (Memoized with isolated carousel state) */}
            <TodayRoutineResetCard
              currentMoodLabel={currentMoodLabel}
              recommendedProtocol={recommendedProtocol}
              activeStreak={activeStreak}
              breathingStreak={settings.breathingStreak}
              calmMode={settings.calmMode}
              plainLanguage={settings.plainLanguage}
              showDeck={!settings.focusMode || focusExpanded}
              onNavigateRoutines={onNavigateRoutines}
              onLaunchProtocol={onLaunchProtocol}
            />
          </div>
        </div>
      </div>
    );
  }
);
TodayTab.displayName = 'TodayTab';
