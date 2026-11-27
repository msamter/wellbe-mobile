import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileJson,
  FileSpreadsheet,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  Undo2,
  Watch,
} from 'lucide-react';
import { AppSettings, MoodBucket, MoodEntry } from '../types/wellbe';
import { MOOD_BUCKETS, toLocalDateKey } from '../data/wellbeData';
import { AffectiveGlyph, getQuadrantStyle } from './AffectiveGlyphs';
import { downloadFile, entriesToCsv } from '../utils/analytics';

interface LogTabProps {
  isActive?: boolean;
  entries: MoodEntry[];
  settings: AppSettings;
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
  onResetDemoData: () => void;
  onOpenQuickCheckIn: () => void;
  onNotify: (title: string, subtitle?: string) => void;
}

const FILTER_OPTIONS: Array<{ id: 'all' | MoodBucket; label: string; shortLabel: string }> = [
  { id: 'all', label: 'All', shortLabel: 'All' },
  ...MOOD_BUCKETS.map((b) => ({ id: b.id, label: b.label, shortLabel: b.shortLabel })),
];

const LONG_NOTE_THRESHOLD = 78;
const INLINE_UNDO_DURATION_MS = 3000;

const LOG_TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});
const LOG_TODAY_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});
const LOG_DAY_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

interface MoodLogRowProps {
  entry: MoodEntry;
  showQuadrantLabel: boolean;
  isNoteExpanded: boolean;
  isPendingDelete: boolean;
  readingComfort: boolean;
  plainLanguage: boolean;
  onToggleExpandNote: (id: string) => void;
  onStartPendingDelete: (entry: MoodEntry) => void;
  onUndoPendingDelete: (entry: MoodEntry) => void;
}

const MoodLogRow: React.FC<MoodLogRowProps> = React.memo(
  ({
    entry,
    showQuadrantLabel,
    isNoteExpanded,
    isPendingDelete,
    readingComfort,
    plainLanguage,
    onToggleExpandNote,
    onStartPendingDelete,
    onUndoPendingDelete,
  }) => {
    const qStyle = getQuadrantStyle(entry.quadrant);
    const secondaryQStyle =
      entry.isBlended && entry.secondaryQuadrant
        ? getQuadrantStyle(entry.secondaryQuadrant)
        : null;
    const parsedTs = new Date(entry.timestamp);
    const timeStr = Number.isNaN(parsedTs.getTime()) ? '' : LOG_TIME_FMT.format(parsedTs);
    const trimmedNote = entry.note.trim();
    const hasNote = trimmedNote.length > 0;
    const isLongNote = trimmedNote.length > LONG_NOTE_THRESHOLD;
    const cleanTags = entry.tags.filter((t) => t.trim().length > 0);

    return (
      <article
        data-pending-delete={isPendingDelete ? 'true' : 'false'}
        className="wb-log-row flex items-center justify-between gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-[var(--surface-hover)]/45 sm:px-4 sm:py-3"
      >
        <div
          className={`flex min-w-0 flex-1 items-start gap-2.5 transition-opacity duration-150 sm:gap-3 ${
            isPendingDelete ? 'opacity-50' : 'opacity-100'
          }`}
        >
          {/* RULER Quadrant Icon Box */}
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl"
            style={{
              backgroundColor: qStyle.bg,
              color: qStyle.fg,
              border: `1px solid ${qStyle.border}`,
            }}
          >
            <AffectiveGlyph
              emotionId={entry.emotionId}
              quadrant={entry.quadrant}
              size={16}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            {/* Single-Line Inline Header: Emotion · Quadrant · Time */}
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-snug">
              <h3
                className={`text-sm font-semibold text-[var(--ink-primary)] sm:text-[15px] ${
                  isPendingDelete ? 'line-through decoration-[var(--ink-muted)]' : ''
                }`}
              >
                {entry.emotionLabel}
              </h3>
              {showQuadrantLabel && (
                <>
                  <span aria-hidden="true" className="text-xs text-[var(--ink-muted)]">
                    ·
                  </span>
                  <span className="text-xs font-medium" style={{ color: qStyle.fg }}>
                    {entry.quadrantLabel}
                  </span>
                  {secondaryQStyle &&
                    entry.secondaryQuadrantLabel &&
                    entry.secondaryQuadrantLabel !== entry.quadrantLabel && (
                      <>
                        <span aria-hidden="true" className="text-xs text-[var(--ink-muted)]">
                          +
                        </span>
                        <span
                          className="text-xs font-medium"
                          style={{ color: secondaryQStyle.fg }}
                        >
                          {entry.secondaryQuadrantLabel}
                        </span>
                      </>
                    )}
                </>
              )}
              {timeStr && (
                <>
                  <span aria-hidden="true" className="text-xs text-[var(--ink-muted)]">
                    ·
                  </span>
                  <time
                    dateTime={entry.timestamp}
                    className="text-xs font-normal text-[var(--ink-muted)] tabular-nums"
                  >
                    {timeStr}
                  </time>
                </>
              )}
              {entry.source === 'watch' && (
                <span
                  className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium text-[var(--bio-mint)]"
                  title="Logged via Watch"
                >
                  <Watch className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Watch</span>
                </span>
              )}
            </div>

            {/* Optional Context Tags */}
            {cleanTags.length > 0 && (
              <p className="text-xs font-normal text-[var(--ink-muted)]">
                {cleanTags.join(' · ')}
              </p>
            )}

            {/* Optional Note Line (Expandable for Long Notes) */}
            {hasNote && (
              <div className="flex items-start gap-1.5">
                <p
                  className={`wb-prose min-w-0 flex-1 select-text text-xs leading-relaxed text-[var(--ink-secondary)] ${
                    isNoteExpanded || !isLongNote || readingComfort
                      ? 'break-words [overflow-wrap:anywhere]'
                      : 'truncate'
                  }`}
                >
                  {entry.note}
                </p>
                {isLongNote && !readingComfort && (
                  <button
                    type="button"
                    onClick={() => onToggleExpandNote(entry.id)}
                    aria-expanded={isNoteExpanded}
                    aria-label={
                      isNoteExpanded
                        ? `Collapse note for ${entry.emotionLabel}`
                        : `Expand note for ${entry.emotionLabel}`
                    }
                    className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-soft)]"
                  >
                    <span>{isNoteExpanded ? 'Less' : 'More'}</span>
                    {isNoteExpanded ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {isPendingDelete ? (
          <button
            type="button"
            data-no-drag-scroll="true"
            onClick={() => onUndoPendingDelete(entry)}
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--brand-accent-border)] bg-[var(--brand-accent-soft)] px-2.5 text-xs font-semibold text-[var(--brand-accent-text)] transition-colors hover:opacity-90"
            aria-label={`Undo delete for ${entry.emotionLabel} entry at ${timeStr}`}
            title="Undo delete"
          >
            <Undo2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            {plainLanguage && <span>Undo</span>}
          </button>
        ) : (
          <button
            type="button"
            data-no-drag-scroll="true"
            onClick={() => onStartPendingDelete(entry)}
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--q-red-bg)] hover:text-[var(--q-red-fg)]"
            aria-label={`Delete ${entry.emotionLabel} entry at ${timeStr}`}
            title="Delete entry"
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            {plainLanguage && <span>Delete</span>}
          </button>
        )}
      </article>
    );
  }
);
MoodLogRow.displayName = 'MoodLogRow';

export const LogTab: React.FC<LogTabProps> = React.memo(
  ({
    isActive = true,
    entries,
    settings,
    onDeleteEntry,
    onClearAll,
    onResetDemoData,
    onOpenQuickCheckIn,
    onNotify,
  }) => {
    const [activeBucket, setActiveBucket] = useState<'all' | MoodBucket>('all');
    const [focusedFilterIdx, setFocusedFilterIdx] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);
    const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(() => new Set());
    const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(() => new Set());
    const [liveAnnouncement, setLiveAnnouncement] = useState('');
    const [staggerActive, setStaggerActive] = useState(true);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuTriggerRef = useRef<HTMLButtonElement>(null);
    const filterBtnRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const pendingTimersRef = useRef<Map<string, number>>(new Map());
    const pendingDeleteIdsRef = useRef<Set<string>>(pendingDeleteIds);
    pendingDeleteIdsRef.current = pendingDeleteIds;
    const onDeleteEntryRef = useRef(onDeleteEntry);
    onDeleteEntryRef.current = onDeleteEntry;
    const announceSeqRef = useRef(0);

    const announcePolite = useCallback((message: string) => {
      announceSeqRef.current += 1;
      const suffix = announceSeqRef.current % 2 === 0 ? '\u200B' : '';
      setLiveAnnouncement(`${message}${suffix}`);
    }, []);

    const cancelAllPendingTimers = useCallback(() => {
      pendingTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      pendingTimersRef.current.clear();
    }, []);

    const handleStartPendingDelete = useCallback(
      (entry: MoodEntry) => {
        const id = entry.id;
        const existingTimer = pendingTimersRef.current.get(id);
        if (existingTimer !== undefined) {
          window.clearTimeout(existingTimer);
          pendingTimersRef.current.delete(id);
        }

        setPendingDeleteIds((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });

        announcePolite(
          `Deleting ${entry.emotionLabel} in 3 seconds. Press Undo to keep this entry.`
        );

        const timerId = window.setTimeout(() => {
          pendingTimersRef.current.delete(id);
          setPendingDeleteIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          onDeleteEntryRef.current(id);
          announcePolite(`Deleted ${entry.emotionLabel} entry.`);
        }, INLINE_UNDO_DURATION_MS);

        pendingTimersRef.current.set(id, timerId);
      },
      [announcePolite]
    );

    const handleUndoPendingDelete = useCallback(
      (entry: MoodEntry) => {
        const id = entry.id;
        const timerId = pendingTimersRef.current.get(id);
        if (timerId !== undefined) {
          window.clearTimeout(timerId);
          pendingTimersRef.current.delete(id);
        }
        setPendingDeleteIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        announcePolite(`Restored ${entry.emotionLabel} entry.`);
      },
      [announcePolite]
    );

    useEffect(() => {
      const t = window.setTimeout(() => setStaggerActive(false), 280);
      return () => {
        window.clearTimeout(t);
        cancelAllPendingTimers();
      };
    }, [cancelAllPendingTimers]);

    // Close open Export & Data dropdown and flush/cancel any active per-row delete timers
    // when leaving the kept-mounted Mood Log tab so timers never fire off-tab
    useEffect(() => {
      if (!isActive) {
        setMenuOpen(false);
        setConfirmClear(false);
        const idsToCommit = Array.from(pendingDeleteIdsRef.current);
        cancelAllPendingTimers();
        if (idsToCommit.length > 0) {
          setPendingDeleteIds(new Set());
          idsToCommit.forEach((id) => onDeleteEntryRef.current(id));
        }
      }
    }, [isActive, cancelAllPendingTimers]);

    // Pointer-outside & Escape handler with clean focus return for Export & Data menu
    useEffect(() => {
      if (!menuOpen || !isActive) return;
      const handlePointerDown = (e: PointerEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setMenuOpen(false);
          setConfirmClear(false);
        }
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          setMenuOpen(false);
          setConfirmClear(false);
          menuTriggerRef.current?.focus();
        }
      };
      document.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('pointerdown', handlePointerDown);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [menuOpen, isActive]);

    // Prune stale expanded note & pending delete IDs whenever entries are externally removed or cleared
    useEffect(() => {
      const validIds = new Set(entries.map((entry) => entry.id));

      setExpandedNoteIds((prev) => {
        if (prev.size === 0) return prev;
        let changed = false;
        const next = new Set<string>();
        prev.forEach((id) => {
          if (validIds.has(id)) {
            next.add(id);
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });

      pendingTimersRef.current.forEach((timerId, id) => {
        if (!validIds.has(id)) {
          window.clearTimeout(timerId);
          pendingTimersRef.current.delete(id);
        }
      });

      setPendingDeleteIds((prev) => {
        if (prev.size === 0) return prev;
        let changed = false;
        const next = new Set<string>();
        prev.forEach((id) => {
          if (validIds.has(id)) {
            next.add(id);
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, [entries]);

    const bucketCounts = useMemo(() => {
      const counts: Record<string, number> = { all: entries.length };
      MOOD_BUCKETS.forEach((b) => {
        counts[b.id] = 0;
      });
      entries.forEach((e) => {
        if (e.bucket in counts) counts[e.bucket] += 1;
      });
      return counts;
    }, [entries]);

    const filteredEntries = useMemo(() => {
      if (activeBucket === 'all') return entries;
      return entries.filter((e) => e.bucket === activeBucket);
    }, [entries, activeBucket]);

    const groupedByDay = useMemo(() => {
      const map = new Map<string, MoodEntry[]>();
      filteredEntries.forEach((entry) => {
        const list = map.get(entry.dateKey) ?? [];
        list.push(entry);
        map.set(entry.dateKey, list);
      });
      const todayKey = toLocalDateKey(new Date());
      return Array.from(map.entries()).map(([dateKey, dayEntries]) => {
        const parts = dateKey.split('-').map(Number);
        const validParts = parts.length === 3 && parts.every(Number.isFinite);
        const dt = validParts ? new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0) : null;
        const isValidDate = Boolean(dt && !Number.isNaN(dt.getTime()));
        const label = !isValidDate || !dt
          ? dateKey
          : dateKey === todayKey
            ? `Today · ${LOG_TODAY_FMT.format(dt)}`
            : LOG_DAY_FMT.format(dt);
        return { dateKey, label, entries: dayEntries };
      });
    }, [filteredEntries]);

    const toggleExpandNote = useCallback((id: string) => {
      setExpandedNoteIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }, []);

    const handleFilterKeyDown = (e: React.KeyboardEvent, idx: number) => {
      let nextIdx = idx;
      if (e.key === 'ArrowRight') nextIdx = (idx + 1) % FILTER_OPTIONS.length;
      else if (e.key === 'ArrowLeft')
        nextIdx = (idx - 1 + FILTER_OPTIONS.length) % FILTER_OPTIONS.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = FILTER_OPTIONS.length - 1;
      else return;

      e.preventDefault();
      setFocusedFilterIdx(nextIdx);
      setActiveBucket(FILTER_OPTIONS[nextIdx].id);
      filterBtnRefs.current[nextIdx]?.focus();
    };

    const handleExportJson = () => {
      if (entries.length === 0) {
        onNotify('Nothing to export', 'Log at least one check-in before exporting JSON');
        setMenuOpen(false);
        return;
      }
      downloadFile(
        `wellbe-mood-log-${toLocalDateKey(new Date())}.json`,
        JSON.stringify(entries, null, 2),
        'application/json'
      );
      onNotify('Exported JSON journal', `${entries.length} check-ins downloaded`);
      setMenuOpen(false);
    };

    const handleExportCsv = () => {
      if (entries.length === 0) {
        onNotify('Nothing to export', 'Log at least one check-in before exporting CSV');
        setMenuOpen(false);
        return;
      }
      downloadFile(
        `wellbe-mood-log-${toLocalDateKey(new Date())}.csv`,
        entriesToCsv(entries),
        'text/csv;charset=utf-8'
      );
      onNotify('Exported CSV journal', `${entries.length} check-ins downloaded`);
      setMenuOpen(false);
    };

    return (
      <div className="space-y-3.5 pb-[104px] sm:pb-[112px]">
        {/* Polite Screen-Reader Status for Inline 3s Undo */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {liveAnnouncement}
        </div>

        {/* Header Row: Mood Log Title on top, Check-in Count Subheader underneath, Export & Data on right */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1
                className="text-xl font-semibold tracking-tight text-[var(--ink-primary)] sm:text-2xl"
                style={{ textWrap: 'balance' }}
              >
                Mood Log
              </h1>
              <p className="mt-0.5 text-xs font-normal text-[var(--ink-muted)] tabular-nums sm:text-sm">
                {activeBucket === 'all'
                  ? `${entries.length} Check-In${entries.length === 1 ? '' : 's'} Saved`
                  : `Showing ${filteredEntries.length} of ${entries.length} Saved`}
              </p>
            </div>

            <div className="relative shrink-0" ref={menuRef}>
              <button
                ref={menuTriggerRef}
                type="button"
                onClick={() => {
                  setMenuOpen((o) => !o);
                  setConfirmClear(false);
                }}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Export and manage local log data"
                className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-hover)] sm:px-3.5 sm:text-sm"
              >
                <Download className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)] sm:h-4 sm:w-4" />
                <span>Export &amp; Data</span>
                <MoreHorizontal className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)] sm:h-4 sm:w-4" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  style={{ zIndex: 'var(--z-popover)' }}
                  className="liquid-glass-strong absolute right-0 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-2xl p-2"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportJson}
                    className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-medium text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                  >
                    <FileJson className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                    <span>Export Journal as JSON</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportCsv}
                    className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-medium text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                  >
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                    <span>Export Journal as CSV</span>
                  </button>
                  <div className="my-1.5 border-t border-[var(--border-hairline)]" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      cancelAllPendingTimers();
                      setPendingDeleteIds(new Set());
                      onResetDemoData();
                      setMenuOpen(false);
                    }}
                    className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                  >
                    <RotateCcw className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                    <span>Restore 30-Day Sample Data</span>
                  </button>
                  {entries.length > 0 &&
                    (!confirmClear ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => setConfirmClear(true)}
                        className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-medium text-[var(--q-red-fg)] hover:bg-[var(--q-red-bg)]"
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                        <span>Clear All Local Entries</span>
                      </button>
                    ) : (
                      <div className="mt-1 rounded-xl bg-[var(--q-red-bg)] p-2.5">
                        <p className="text-[11px] font-medium text-[var(--q-red-fg)] tabular-nums">
                          Delete all {entries.length} local check-ins?
                        </p>
                        <div className="mt-2 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              cancelAllPendingTimers();
                              setPendingDeleteIds(new Set());
                              onClearAll();
                              setConfirmClear(false);
                              setMenuOpen(false);
                            }}
                            style={{
                              backgroundColor: 'var(--q-red-solid)',
                              color: 'var(--q-red-ink)',
                            }}
                            className="min-h-[36px] flex-1 rounded-lg text-[11px] font-semibold"
                          >
                            Confirm Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmClear(false)}
                            className="min-h-[36px] rounded-lg bg-[var(--surface-card)] px-3 text-[11px] font-medium text-[var(--ink-primary)]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Compact Mood Bucket Filter Strip (Roving tabIndex) */}
          <div
            role="toolbar"
            aria-label="Mood bucket filters"
            className="flex flex-wrap items-center gap-1.5"
          >
            {FILTER_OPTIONS.map((opt, idx) => {
              const active = activeBucket === opt.id;
              const bucketDef = MOOD_BUCKETS.find((b) => b.id === opt.id);
              const qStyle = bucketDef ? getQuadrantStyle(bucketDef.quadrant) : null;
              const count = bucketCounts[opt.id] ?? 0;
              return (
                <button
                  key={opt.id}
                  ref={(el) => {
                    filterBtnRefs.current[idx] = el;
                  }}
                  type="button"
                  tabIndex={focusedFilterIdx === idx ? 0 : -1}
                  onClick={() => {
                    setActiveBucket(opt.id);
                    setFocusedFilterIdx(idx);
                  }}
                  onKeyDown={(e) => handleFilterKeyDown(e, idx)}
                  aria-pressed={active}
                  aria-label={`${opt.label} (${count})`}
                  title={`${opt.label} (${count})`}
                  className="inline-flex min-h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors tabular-nums"
                  style={
                    opt.id === 'all'
                      ? {
                          backgroundColor: active
                            ? 'var(--accent-primary)'
                            : 'var(--surface-card)',
                          color: active
                            ? 'var(--accent-primary-ink)'
                            : 'var(--ink-primary)',
                          border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-hairline)'}`,
                        }
                      : {
                          backgroundColor: active && qStyle ? qStyle.bg : 'var(--surface-card)',
                          color: active && qStyle ? qStyle.fg : 'var(--ink-primary)',
                          border: `1px solid ${active && qStyle ? qStyle.solid : 'var(--border-hairline)'}`,
                        }
                  }
                >
                  {bucketDef && qStyle && (
                    <span style={{ color: qStyle.solid }}>
                      <AffectiveGlyph
                        bucket={bucketDef.id}
                        quadrant={bucketDef.quadrant}
                        size={12}
                      />
                    </span>
                  )}
                  <span>{opt.shortLabel}</span>
                  {count > 0 && <span className="opacity-70">{count}</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* Date-Grouped Chronological Feed */}
        {groupedByDay.length === 0 ? (
          <section
            data-edge-recede=""
            data-stagger="0"
            className="wb-surface wb-stagger-card rounded-2xl p-8 text-center"
          >
            <p className="text-sm font-semibold text-[var(--ink-primary)]">
              No matching check-ins
            </p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              {entries.length === 0
                ? 'Log your first emotional check-in to start building local trend insights.'
                : 'Try switching back to All to inspect your full timeline.'}
            </p>
            <button
              type="button"
              onClick={
                entries.length === 0
                  ? onOpenQuickCheckIn
                  : () => {
                      setActiveBucket('all');
                      setFocusedFilterIdx(0);
                    }
              }
              className="mt-3.5 inline-flex min-h-[40px] items-center rounded-xl px-4 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-primary-ink)',
              }}
            >
              {entries.length === 0 ? 'Log First Check-In' : 'Show All Check-Ins'}
            </button>
          </section>
        ) : (
          <div className="space-y-3">
            {groupedByDay.map((group, groupIdx) => (
              <section
                key={group.dateKey}
                data-edge-recede=""
                data-stagger={staggerActive && groupIdx < 4 ? groupIdx : undefined}
                aria-label={`Logs for ${group.label}`}
                className={staggerActive && groupIdx < 4 ? 'wb-stagger-card' : undefined}
              >
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <h2 className="text-xs font-semibold tracking-tight text-[var(--ink-primary)] sm:text-sm">
                    {group.label}
                  </h2>
                  <span className="text-[11px] font-normal text-[var(--ink-muted)] tabular-nums sm:text-xs">
                    {group.entries.length}{' '}
                    {group.entries.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>

                <div className="wb-surface divide-y divide-[var(--border-hairline)] rounded-2xl">
                  {group.entries.map((entry) => (
                    <MoodLogRow
                      key={entry.id}
                      entry={entry}
                      showQuadrantLabel={
                        activeBucket === 'all' || Boolean(entry.isBlended) || settings.patternAssist
                      }
                      isNoteExpanded={expandedNoteIds.has(entry.id)}
                      isPendingDelete={pendingDeleteIds.has(entry.id)}
                      readingComfort={settings.readingComfort}
                      plainLanguage={settings.plainLanguage}
                      onToggleExpandNote={toggleExpandNote}
                      onStartPendingDelete={handleStartPendingDelete}
                      onUndoPendingDelete={handleUndoPendingDelete}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    );
  }
);
LogTab.displayName = 'LogTab';
