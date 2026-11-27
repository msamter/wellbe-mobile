import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clock,
  Edit3,
  Heart,
  Play,
  Plus,
  ShieldAlert,
  Timer,
  Trash2,
  Volume2,
} from 'lucide-react';
import { MoodEntry, ResetProtocol, ScheduledRoutine } from '../types/wellbe';
import { RESET_PROTOCOLS, toLocalDateKey } from '../data/wellbeData';
import { useAccessibility } from '../context/AccessibilityContext';
import { AffectiveGlyph, getQuadrantStyle } from './AffectiveGlyphs';

interface RoutinesTabProps {
  routines: ScheduledRoutine[];
  entries?: MoodEntry[];
  latestEntry: MoodEntry | null;
  resetDurationMin?: number;
  hasCustomResetDuration?: boolean;
  onChangeResetDuration?: (mins: number, isManual?: boolean) => void;
  onOpenNewRoutine: () => void;
  onEditRoutine: (routine: ScheduledRoutine) => void;
  onDeleteRoutine: (id: string) => void;
  onToggleRoutine: (id: string) => void;
  onRunSequence: (routine: ScheduledRoutine) => void;
  onLaunchProtocol: (protocol: ResetProtocol) => void;
  onLaunchPanicAnchor: () => void;
  onSaveGratitude: (note: string) => void;
}

type ContextualMode = 'high-unpleasant' | 'low-unpleasant' | 'standard';

const RESET_DURATION_OPTIONS = [1, 2, 3, 5, 8] as const;

const RED_PRIORITY_IDS = new Set(['panic', 'breathing', 'grounding']);
const BLUE_PRIORITY_IDS = new Set(['stretch', 'gratitude', 'grounding', 'savoring']);

function resolveContextualMode(entry: MoodEntry | null): ContextualMode {
  if (!entry) return 'standard';
  if (entry.quadrant === 'red' || entry.secondaryQuadrant === 'red') {
    return 'high-unpleasant';
  }
  if (entry.quadrant === 'blue' || entry.secondaryQuadrant === 'blue') {
    return 'low-unpleasant';
  }
  return 'standard';
}

export const RoutinesTab: React.FC<RoutinesTabProps> = React.memo(
  ({
    routines,
    entries = [],
    latestEntry,
    resetDurationMin: controlledResetDuration,
    hasCustomResetDuration = false,
    onChangeResetDuration,
    onOpenNewRoutine,
    onEditRoutine,
    onDeleteRoutine,
    onToggleRoutine,
    onRunSequence,
    onLaunchProtocol,
    onLaunchPanicAnchor,
    onSaveGratitude,
  }) => {
    const a11y = useAccessibility();
    const protocolMap = useMemo(
      () => new Map(RESET_PROTOCOLS.map((p) => [p.id, p])),
      []
    );

    const contextualMode = resolveContextualMode(latestEntry);
    const activeQuadrantStyle = latestEntry ? getQuadrantStyle(latestEntry.quadrant) : null;

    // Native Reset Duration control inside Routines (synced to App when controlled)
    const [internalResetDuration, setInternalResetDuration] = useState<number>(() =>
      contextualMode === 'low-unpleasant' ? 3 : 2
    );
    const resetDurationMin = controlledResetDuration ?? internalResetDuration;
    const setResetDurationMin = (mins: number, isManual = true) => {
      setInternalResetDuration(mins);
      onChangeResetDuration?.(mins, isManual);
    };
    const userAdjustedDurationRef = useRef(hasCustomResetDuration);
    if (hasCustomResetDuration) {
      userAdjustedDurationRef.current = true;
    }

    const enabledRoutinesCount = useMemo(
      () => routines.filter((r) => r.enabled).length,
      [routines]
    );

    const gratitudeStats = useMemo(() => {
      const todayKey = toLocalDateKey(new Date());
      let total = 0;
      let today = 0;
      entries.forEach((entry) => {
        if (entry.emotionId === 'grateful' || entry.secondaryEmotionId === 'grateful') {
          total += 1;
          if (entry.dateKey === todayKey) today += 1;
        }
      });
      return { total, today };
    }, [entries]);

    // Inline Gratitude Capture state directly inside Routines
    const [gratitudeDraft, setGratitudeDraft] = useState('');
    const [gratitudeSaved, setGratitudeSaved] = useState(false);
    const [gratitudeError, setGratitudeError] = useState('');
    const [staggerActive, setStaggerActive] = useState(true);
    const savedTimerRef = useRef<number | null>(null);

    useEffect(() => {
      const t = window.setTimeout(() => setStaggerActive(false), 280);
      return () => {
        window.clearTimeout(t);
        if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      };
    }, []);

    // Gently pre-tune Reset Duration when contextual state switches unless user manually picked one
    useEffect(() => {
      if (hasCustomResetDuration || userAdjustedDurationRef.current) return;
      const suggested = contextualMode === 'low-unpleasant' ? 3 : 2;
      setInternalResetDuration(suggested);
      onChangeResetDuration?.(suggested, false);
    }, [contextualMode, hasCustomResetDuration, onChangeResetDuration]);

    const handleSelectDuration = (mins: number) => {
      userAdjustedDurationRef.current = true;
      setResetDurationMin(mins, true);
    };

    const launchWithResetDuration = (protocol: ResetProtocol) => {
      if (protocol.type === 'panic') {
        onLaunchPanicAnchor();
        return;
      }
      onLaunchProtocol({
        ...protocol,
        durationMin: resetDurationMin,
        durationLabel: `${resetDurationMin} min`,
      });
    };

    const handleInlineGratitudeSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = gratitudeDraft.trim();
      if (!trimmed) {
        setGratitudeError('Add a short anchor or quiet win before saving.');
        return;
      }
      setGratitudeError('');
      onSaveGratitude(trimmed);
      setGratitudeDraft('');
      setGratitudeSaved(true);
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => {
        setGratitudeSaved(false);
      }, 2400);
    };

    // Prioritize relevant scheduled routines when an unpleasant state is active; keep standard order otherwise
    const orderedRoutines = useMemo(() => {
      if (contextualMode === 'standard') {
        return routines.map((r) => ({ routine: r, isPrioritized: false }));
      }

      const targetIds =
        contextualMode === 'high-unpleasant' ? RED_PRIORITY_IDS : BLUE_PRIORITY_IDS;

      const scored = routines.map((routine, idx) => {
        const matchCount = routine.steps.filter((st) => targetIds.has(st.protocolId)).length;
        return {
          routine,
          idx,
          matchCount,
          isPrioritized: matchCount > 0,
        };
      });

      scored.sort((a, b) => {
        if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
        return a.idx - b.idx;
      });

      return scored.map(({ routine, isPrioritized }) => ({ routine, isPrioritized }));
    }, [routines, contextualMode]);

    // Order native routine modules (including Voice Panic Anchor & Gratitude Capture) contextually
    const orderedModules = useMemo(() => {
      const base = [...RESET_PROTOCOLS];
      if (contextualMode === 'high-unpleasant') {
        const order = ['panic', 'breathing', 'grounding', 'stretch', 'savoring', 'gratitude'];
        base.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        return base.map((protocol) => ({
          protocol,
          isPrioritized: RED_PRIORITY_IDS.has(protocol.id),
        }));
      }
      if (contextualMode === 'low-unpleasant') {
        const order = ['stretch', 'gratitude', 'grounding', 'savoring', 'breathing', 'panic'];
        base.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        return base.map((protocol) => ({
          protocol,
          isPrioritized: BLUE_PRIORITY_IDS.has(protocol.id),
        }));
      }
      return base.map((protocol) => ({ protocol, isPrioritized: false }));
    }, [contextualMode]);

    const panicProtocol = protocolMap.get('panic') ?? RESET_PROTOCOLS[RESET_PROTOCOLS.length - 1];
    const gratitudeProtocol = protocolMap.get('gratitude') ?? RESET_PROTOCOLS[4];

    const lowEnergyGratitudePlaceholder =
      contextualMode === 'low-unpleasant'
        ? 'One tiny comfort or quiet pause today...'
        : 'One person, small win, or steady moment...';

    const hasContextBanner = Boolean(
      latestEntry && contextualMode !== 'standard' && activeQuadrantStyle
    );
    const controlsStaggerIdx = hasContextBanner ? 1 : 0;
    const routineStartStaggerIdx = controlsStaggerIdx + 1;

    return (
      <div className="wb-routines-root wb-calm-stack space-y-6 pb-[104px] sm:pb-[112px] lg:space-y-8">
        {/* Header + New Routine CTA */}
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-semibold tracking-tight text-[var(--ink-primary)] sm:text-[28px]"
              style={{ textWrap: 'balance' }}
            >
              Routines
            </h1>
            <p className="mt-0.5 text-sm font-normal text-[var(--ink-muted)] tabular-nums">
              {a11y.plainLanguage
                ? 'Somatic Sequences · Daily Routines & Guided Steps'
                : 'Somatic Sequences · Reset Duration & Integrated Routine Modules'}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenNewRoutine}
            className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-primary-ink)',
            }}
          >
            <Plus className="h-4 w-4" />
            <span>New Routine</span>
          </button>
        </section>

        {/* Contextual Routine Guidance Banner (Shown ONLY when an unpleasant Red/Blue state is active) */}
        {latestEntry && contextualMode !== 'standard' && activeQuadrantStyle && (
          <section
            aria-label="Contextual routine priority"
            data-edge-recede=""
            data-stagger="0"
            className="wb-routine-context-banner wb-stagger-card rounded-2xl p-4 sm:p-5"
            style={{
              backgroundColor:
                contextualMode === 'high-unpleasant'
                  ? 'var(--q-red-bg)'
                  : 'var(--q-blue-bg)',
              borderColor:
                contextualMode === 'high-unpleasant'
                  ? 'var(--q-red-border)'
                  : 'var(--q-blue-border)',
              color:
                contextualMode === 'high-unpleasant'
                  ? 'var(--q-red-fg)'
                  : 'var(--q-blue-fg)',
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <AffectiveGlyph
                    emotionId={latestEntry.emotionId}
                    quadrant={latestEntry.quadrant}
                    size={15}
                  />
                  <span>Active check-in: {latestEntry.emotionLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {contextualMode === 'high-unpleasant'
                      ? 'Calming & down-regulating routines prioritized'
                      : 'Restorative & low-friction routines prioritized'}
                  </span>
                </div>
                <p className="wb-prose mt-1 text-xs leading-relaxed text-[var(--ink-primary)] opacity-90">
                  {contextualMode === 'high-unpleasant'
                    ? 'Voice Panic Anchor, extended-exhale breathing, and short Reset Duration pacing are brought to the top for fast nervous-system settling.'
                    : 'Gentle pacing, Reset Duration controls, and a low-friction Gratitude Capture prompt are highlighted to support low energy without pressure.'}
                </p>
              </div>
              {contextualMode === 'high-unpleasant' && (
                <button
                  type="button"
                  onClick={onLaunchPanicAnchor}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-xs font-semibold transition-opacity hover:opacity-95"
                  style={{
                    backgroundColor: 'var(--q-red-solid)',
                    color: 'var(--q-red-ink)',
                  }}
                >
                  <Volume2 className="h-4 w-4 shrink-0" />
                  <span>
                    {a11y.plainLanguage ? 'Start Panic Calm Guide' : 'Start Voice Panic Anchor'}
                  </span>
                </button>
              )}
            </div>
          </section>
        )}

        {/* Native Routine Controls Bar: Reset Duration + Quick Native Triggers (Voice Panic Anchor & Gratitude Capture) */}
        <section
          aria-labelledby="routine-controls-heading"
          data-edge-recede=""
          data-stagger={controlsStaggerIdx}
          className="wb-surface wb-stagger-card rounded-2xl p-4 sm:p-5"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Reset Duration Pacing Control (Native Routine Setting) */}
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Timer className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                <h2
                  id="routine-controls-heading"
                  className="text-sm font-semibold text-[var(--ink-primary)]"
                >
                  Reset Duration
                </h2>
                <span className="text-xs text-[var(--ink-muted)]">
                  · Applies to routine modules launched below
                </span>
              </div>
              <div
                role="group"
                aria-label="Reset Duration pacing in minutes"
                className="flex flex-wrap items-center gap-1.5"
              >
                {RESET_DURATION_OPTIONS.map((mins) => {
                  const selected = resetDurationMin === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleSelectDuration(mins)}
                      className="min-h-[40px] min-w-[54px] rounded-xl border px-3 text-xs font-semibold tabular-nums transition-colors"
                      style={{
                        backgroundColor: selected
                          ? 'var(--accent-primary)'
                          : 'var(--surface-subtle)',
                        color: selected
                          ? 'var(--accent-primary-ink)'
                          : 'var(--ink-secondary)',
                        borderColor: selected
                          ? 'var(--accent-primary)'
                          : 'var(--border-hairline)',
                      }}
                    >
                      {mins} min
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Integrated Native Routine Quick Modules (Voice Panic Anchor & Gratitude Capture) */}
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-hairline)] pt-3 lg:border-t-0 lg:pt-0">
              <button
                type="button"
                onClick={onLaunchPanicAnchor}
                className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 text-xs font-semibold transition-colors"
                style={
                  contextualMode === 'high-unpleasant'
                    ? {
                        backgroundColor: 'var(--q-red-bg)',
                        borderColor: 'var(--q-red-solid)',
                        color: 'var(--q-red-fg)',
                      }
                    : {
                        backgroundColor: 'var(--surface-subtle)',
                        borderColor: 'var(--border-hairline)',
                        color: 'var(--ink-primary)',
                      }
                }
              >
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span>{a11y.plainLanguage ? 'Panic Calm Guide' : 'Voice Panic Anchor'}</span>
              </button>

              <button
                type="button"
                onClick={() => launchWithResetDuration(gratitudeProtocol)}
                className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 text-xs font-semibold transition-colors"
                style={
                  contextualMode === 'low-unpleasant'
                    ? {
                        backgroundColor: 'var(--q-blue-bg)',
                        borderColor: 'var(--q-blue-solid)',
                        color: 'var(--q-blue-fg)',
                      }
                    : {
                        backgroundColor: 'var(--surface-subtle)',
                        borderColor: 'var(--border-hairline)',
                        color: 'var(--ink-primary)',
                      }
                }
              >
                <Heart className="h-3.5 w-3.5 shrink-0" />
                <span>Gratitude Capture</span>
              </button>
            </div>
          </div>
        </section>

        {/* Desktop 2-column layout: Scheduled Routines + Native Routine Modules */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Scheduled Routine Cards */}
          <section
            aria-labelledby="scheduled-routines-heading"
            className="min-w-0 space-y-4 lg:col-span-7"
          >
            <div className="flex items-baseline justify-between">
              <h2
                id="scheduled-routines-heading"
                className="text-base font-semibold text-[var(--ink-primary)]"
              >
                Scheduled Routines
              </h2>
              {routines.length > 0 && (
                <span className="text-xs text-[var(--ink-muted)] tabular-nums">
                  {enabledRoutinesCount > 0
                    ? `${enabledRoutinesCount} active · ${routines.length} total`
                    : `${routines.length} paused`}
                </span>
              )}
            </div>

            {orderedRoutines.length === 0 ? (
              <div
                data-edge-recede=""
                data-stagger={routineStartStaggerIdx}
                className="wb-surface wb-stagger-card rounded-2xl p-8 text-center"
              >
                <p className="text-sm font-semibold text-[var(--ink-primary)]">
                  No scheduled routines yet
                </p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  Combine any routine modules—including Gratitude Capture, Voice Panic Anchor, and custom Reset Duration—into a daily sequence.
                </p>
                <button
                  type="button"
                  onClick={onOpenNewRoutine}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-primary-ink)',
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create First Routine</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {orderedRoutines.map(({ routine, isPrioritized }, rIdx) => {
                  const totalMin = routine.steps.reduce((s, st) => s + st.durationMin, 0);
                  const staggerSlot = routineStartStaggerIdx + rIdx;
                  const highlightColor =
                    contextualMode === 'high-unpleasant'
                      ? {
                          border: 'var(--q-red-solid)',
                          bg: 'var(--q-red-bg)',
                          fg: 'var(--q-red-fg)',
                        }
                      : {
                          border: 'var(--q-blue-solid)',
                          bg: 'var(--q-blue-bg)',
                          fg: 'var(--q-blue-fg)',
                        };

                  return (
                    <article
                      key={routine.id}
                      data-edge-recede=""
                      data-prioritized={isPrioritized ? 'true' : 'false'}
                      data-stagger={staggerActive && staggerSlot < 4 ? staggerSlot : undefined}
                      className={`wb-surface wb-routine-card rounded-2xl p-5 ${
                        staggerActive && staggerSlot < 4 ? 'wb-stagger-card' : ''
                      }`}
                      style={
                        isPrioritized
                          ? {
                              borderWidth: '1.5px',
                              borderColor: highlightColor.border,
                            }
                          : undefined
                      }
                    >
                      {isPrioritized && latestEntry && (
                        <div
                          className="mb-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            backgroundColor: highlightColor.bg,
                            color: highlightColor.fg,
                          }}
                        >
                          <span>
                            {contextualMode === 'high-unpleasant'
                              ? `Prioritized for ${latestEntry.emotionLabel} · Down-regulating`
                              : `Prioritized for ${latestEntry.emotionLabel} · Restorative`}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-[var(--ink-primary)]">
                            {routine.name}
                          </h3>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-muted)] tabular-nums">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>{routine.timeLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span>{routine.weekdayLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span>{totalMin} min total</span>
                          </p>
                        </div>

                        {/* Scheduled Toggle (≥44px hit height) */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={routine.enabled}
                          aria-label={`${routine.name} schedule ${routine.enabled ? 'enabled' : 'paused'}`}
                          onClick={() => onToggleRoutine(routine.id)}
                          className="inline-flex min-h-[44px] shrink-0 items-center gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 text-xs font-semibold transition-colors"
                          style={{
                            color: routine.enabled
                              ? 'var(--accent-primary)'
                              : 'var(--ink-muted)',
                          }}
                        >
                          <span>{routine.enabled ? 'Scheduled' : 'Paused'}</span>
                          <span
                            className="relative inline-flex h-4 w-7 items-center rounded-full"
                            style={{
                              backgroundColor: routine.enabled
                                ? 'var(--accent-primary)'
                                : 'var(--border-strong)',
                            }}
                          >
                            <span
                              className="inline-block h-3 w-3 rounded-full transition-transform duration-150"
                              style={{
                                backgroundColor: 'var(--switch-thumb)',
                                transform: routine.enabled
                                  ? 'translateX(14px)'
                                  : 'translateX(2px)',
                              }}
                            />
                          </span>
                        </button>
                      </div>

                      {/* Numbered Step Breakdown */}
                      <ol className="mt-4 divide-y divide-[var(--border-hairline)] border-y border-[var(--border-hairline)]">
                        {routine.steps.map((step, idx) => {
                          const proto = protocolMap.get(step.protocolId);
                          if (!proto) return null;
                          return (
                            <li
                              key={`${routine.id}-${idx}-${step.protocolId}`}
                              className="flex items-center justify-between gap-3 py-2.5 text-sm"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="font-mono-tabular text-xs font-semibold text-[var(--ink-muted)]">
                                  {String(idx + 1).padStart(2, '0')}
                                </span>
                                <span className="truncate font-medium text-[var(--ink-primary)]">
                                  {proto.shortTitle}
                                </span>
                              </div>
                              <span className="shrink-0 text-xs text-[var(--ink-muted)] tabular-nums">
                                {step.durationMin} min
                              </span>
                            </li>
                          );
                        })}
                      </ol>

                      {/* Routine Actions (All ≥44px touch height) */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onRunSequence(routine)}
                          className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl px-4 text-xs font-semibold transition-colors"
                          style={{
                            backgroundColor: 'var(--accent-primary)',
                            color: 'var(--accent-primary-ink)',
                          }}
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Run Sequence</span>
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onEditRoutine(routine)}
                            className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 text-xs font-semibold text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
                          >
                            <Edit3 className="h-3.5 w-3.5 shrink-0" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRoutine(routine.id)}
                            className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 text-xs font-semibold text-[var(--q-red-fg)] hover:bg-[var(--q-red-bg)]"
                            aria-label={`Delete ${routine.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 shrink-0" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Native Gratitude Capture Inline Routine Module (Tailored for Low-Energy Unpleasant & always manually accessible) */}
            <article
              aria-labelledby="inline-gratitude-heading"
              data-edge-recede=""
              className="wb-surface wb-routine-card rounded-2xl p-5"
              style={
                contextualMode === 'low-unpleasant'
                  ? {
                      borderWidth: '1.5px',
                      borderColor: 'var(--q-blue-solid)',
                    }
                  : undefined
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Heart
                    className="h-4 w-4 shrink-0"
                    style={{
                      color:
                        contextualMode === 'low-unpleasant'
                          ? 'var(--q-blue-fg)'
                          : 'var(--accent-primary)',
                    }}
                  />
                  <h3
                    id="inline-gratitude-heading"
                    className="text-sm font-semibold text-[var(--ink-primary)]"
                  >
                    Gratitude Capture
                  </h3>
                </div>
                {gratitudeStats.total > 0 && (
                  <span className="text-xs text-[var(--ink-muted)] tabular-nums">
                    {gratitudeStats.total} saved locally
                    {gratitudeStats.today > 0 ? ` · ${gratitudeStats.today} today` : ''}
                  </span>
                )}
              </div>

              <p className="wb-prose mt-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
                {contextualMode === 'low-unpleasant'
                  ? 'Keep it effortless: name one tiny comfort, soft moment, or quiet relief that supported you today—even a warm drink or sitting down.'
                  : 'Capture one concrete person, anchor, or small win in a single sentence directly inside Routines.'}
              </p>

              <form onSubmit={handleInlineGratitudeSubmit} className="mt-3 space-y-2" noValidate>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label htmlFor="routine-gratitude-input" className="sr-only">
                    Gratitude Capture note
                  </label>
                  <input
                    id="routine-gratitude-input"
                    type="text"
                    value={gratitudeDraft}
                    onChange={(e) => {
                      setGratitudeDraft(e.target.value);
                      if (gratitudeError) setGratitudeError('');
                    }}
                    placeholder={lowEnergyGratitudePlaceholder}
                    className="min-h-[44px] flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)]"
                  />
                  <button
                    type="submit"
                    className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: 'var(--accent-primary-ink)',
                    }}
                  >
                    {gratitudeSaved ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Saved</span>
                      </>
                    ) : (
                      <span>Save Entry</span>
                    )}
                  </button>
                </div>
                {gratitudeError && (
                  <p role="alert" className="text-xs font-medium text-[var(--q-red-fg)]">
                    {gratitudeError}
                  </p>
                )}
              </form>
            </article>
          </section>

          {/* Native Routine Modules Library (All 6 integrated modules including Voice Panic Anchor & Gratitude Capture) */}
          <section
            aria-labelledby="routine-modules-heading"
            className="min-w-0 space-y-4 lg:col-span-5"
          >
            <div className="flex items-baseline justify-between">
              <h2
                id="routine-modules-heading"
                className="text-base font-semibold text-[var(--ink-primary)]"
              >
                {a11y.plainLanguage ? 'Routine Exercises' : 'Routine Modules'}
              </h2>
              <span className="text-xs text-[var(--ink-muted)] tabular-nums">
                {orderedModules.length} modules · {resetDurationMin} min pace
              </span>
            </div>

            <div className="wb-surface divide-y divide-[var(--border-hairline)] rounded-2xl overflow-x-clip">
              {orderedModules.map(({ protocol, isPrioritized }, index) => {
                const isPanic = protocol.id === panicProtocol.id;
                const isGratitude = protocol.id === gratitudeProtocol.id;
                const moduleDurationLabel = isGratitude
                  ? '1–2 min'
                  : `${resetDurationMin} min`;
                const rowAccentBg =
                  isPrioritized && contextualMode === 'high-unpleasant'
                    ? 'var(--q-red-bg)'
                    : isPrioritized && contextualMode === 'low-unpleasant'
                      ? 'var(--q-blue-bg)'
                      : undefined;
                const rowAccentFg =
                  isPrioritized && contextualMode === 'high-unpleasant'
                    ? 'var(--q-red-fg)'
                    : isPrioritized && contextualMode === 'low-unpleasant'
                      ? 'var(--q-blue-fg)'
                      : 'var(--ink-muted)';

                return (
                  <div
                    key={protocol.id}
                    data-edge-recede=""
                    className="p-4 sm:p-5 first:rounded-t-2xl last:rounded-b-2xl transition-colors"
                    style={rowAccentBg ? { backgroundColor: rowAccentBg } : undefined}
                  >
                    <div
                      className="flex flex-wrap items-baseline justify-between gap-2 text-xs"
                      style={{ color: rowAccentFg }}
                    >
                      <span className={isPrioritized ? 'font-semibold' : ''}>
                        {String(index + 1).padStart(2, '0')}. {protocol.targetState}
                        {isPrioritized && latestEntry
                          ? ` · Suggested for ${latestEntry.emotionLabel}`
                          : ''}
                      </span>
                      <span className="tabular-nums">{moduleDurationLabel}</span>
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-[var(--ink-primary)]">
                      {isPanic && a11y.plainLanguage ? 'Panic Calm Guide' : protocol.title}
                    </h3>
                    <p className="wb-prose mt-1 text-xs leading-relaxed text-[var(--ink-secondary)]">
                      {isGratitude && contextualMode === 'low-unpleasant'
                        ? 'Low-friction prompt: notice one small comfort or steady anchor from today without needing high energy.'
                        : protocol.summary}
                    </p>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => launchWithResetDuration(protocol)}
                        className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 text-xs font-semibold transition-colors"
                        style={
                          isPanic && contextualMode === 'high-unpleasant'
                            ? {
                                backgroundColor: 'var(--q-red-solid)',
                                borderColor: 'var(--q-red-solid)',
                                color: 'var(--q-red-ink)',
                              }
                            : {
                                backgroundColor: 'var(--surface-card)',
                                borderColor: 'var(--border-hairline)',
                                color: 'var(--ink-primary)',
                              }
                        }
                      >
                        {isPanic ? (
                          <Volume2 className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        <span className="tabular-nums">
                          {isPanic
                            ? a11y.plainLanguage
                              ? 'Start Panic Calm Guide'
                              : 'Start Voice Panic Anchor'
                            : isGratitude
                              ? 'Open Gratitude Capture'
                              : `Start ${resetDurationMin}-min module`}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    );
  }
);
RoutinesTab.displayName = 'RoutinesTab';
