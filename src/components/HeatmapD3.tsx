import React, { useMemo, useRef, useState } from 'react';
import { Activity, Footprints, HeartPulse, Moon, Watch, X } from 'lucide-react';
import { DAY_WINDOWS } from '../data/wellbeData';
import { HeatmapCellData, TrendsAnalytics } from '../utils/analytics';
import { AffectiveGlyph, getQuadrantStyle } from './AffectiveGlyphs';
import { useDragToScroll } from '../hooks/useDragToScroll';

interface HeatmapD3Props {
  analytics: TrendsAnalytics;
  selectedDateKey: string;
  selectedCellKey: string | null;
  patternAssist?: boolean;
  plainLanguage?: boolean;
  heartRatePaused?: boolean;
  onOpenWearableSettings?: () => void;
  onSelectCell: (cell: HeatmapCellData) => void;
  onCloseDrawer?: () => void;
}

const VALENCE_FILLS: Record<
  HeatmapCellData['valenceCategory'],
  { bg: string; fg: string; label: string; code: string; patternClass: string }
> = {
  joyful: {
    bg: 'var(--q-yellow-bg)',
    fg: 'var(--q-yellow-fg)',
    label: 'Joyful',
    code: 'High+',
    patternClass: 'wb-pattern-yellow',
  },
  calm: {
    bg: 'var(--q-green-bg)',
    fg: 'var(--q-green-fg)',
    label: 'Calm',
    code: 'Calm+',
    patternClass: 'wb-pattern-green',
  },
  steady: {
    bg: 'var(--q-balanced-bg)',
    fg: 'var(--q-balanced-fg)',
    label: 'Steady',
    code: 'Steady',
    patternClass: 'wb-pattern-balanced',
  },
  stressed: {
    bg: 'var(--q-red-bg)',
    fg: 'var(--q-red-fg)',
    label: 'Stressed',
    code: 'High−',
    patternClass: 'wb-pattern-red',
  },
  empty: {
    bg: 'var(--surface-subtle)',
    fg: 'var(--ink-muted)',
    label: 'No log',
    code: '',
    patternClass: '',
  },
};

export const HeatmapD3: React.FC<HeatmapD3Props> = React.memo(
  ({
    analytics,
    selectedDateKey,
    selectedCellKey,
    patternAssist = false,
    plainLanguage = false,
    heartRatePaused = false,
    onOpenWearableSettings,
    onSelectCell,
    onCloseDrawer,
  }) => {
    const days = analytics.last7Series;
    const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const heatmapScrollRef = useRef<HTMLDivElement>(null);
    useDragToScroll(heatmapScrollRef, { axis: 'x' });

    const activeCell: HeatmapCellData | null = useMemo(() => {
      if (!selectedCellKey) return null;
      return (
        analytics.heatmapCells.find(
          (c) => `${c.dateKey}-${c.window}` === selectedCellKey
        ) ?? null
      );
    }, [analytics.heatmapCells, selectedCellKey]);

    const [focusedCoords, setFocusedCoords] = useState<{ row: number; col: number }>({
      row: 0,
      col: Math.max(0, days.length - 1),
    });

    const cellMap = useMemo(() => {
      const map = new Map<string, HeatmapCellData>();
      analytics.heatmapCells.forEach((c) => map.set(`${c.dateKey}-${c.window}`, c));
      return map;
    }, [analytics.heatmapCells]);

    const maxColIdx = Math.max(0, days.length - 1);
    const clampedFocusedCol = Math.min(focusedCoords.col, maxColIdx);

    // Full 2D Arrow-Key Navigation across 4 rows × 7 columns + Escape to close on-demand cell drawer
    const handleCellKeyDown = (
      e: React.KeyboardEvent,
      rowIdx: number,
      colIdx: number
    ) => {
      if (e.key === 'Escape' && activeCell && onCloseDrawer) {
        e.preventDefault();
        onCloseDrawer();
        return;
      }

      let nextRow = rowIdx;
      let nextCol = colIdx;
      const maxRow = DAY_WINDOWS.length - 1;
      const maxCol = Math.max(0, days.length - 1);

      if (e.key === 'ArrowRight') nextCol = Math.min(maxCol, colIdx + 1);
      else if (e.key === 'ArrowLeft') nextCol = Math.max(0, colIdx - 1);
      else if (e.key === 'ArrowDown') nextRow = Math.min(maxRow, rowIdx + 1);
      else if (e.key === 'ArrowUp') nextRow = Math.max(0, rowIdx - 1);
      else if (e.key === 'Home') nextCol = 0;
      else if (e.key === 'End') nextCol = maxCol;
      else return;

      e.preventDefault();
      setFocusedCoords({ row: nextRow, col: nextCol });
      const targetDay = days[nextCol];
      const targetWin = DAY_WINDOWS[nextRow];
      if (!targetDay || !targetWin) return;
      const key = `${targetDay.dateKey}-${targetWin.id}`;
      cellRefs.current[key]?.focus();
      if (activeCell) {
        const targetCell = cellMap.get(key);
        if (targetCell) onSelectCell(targetCell);
      }
    };

    return (
      <section
        aria-labelledby="d3-heatmap-heading"
        data-edge-recede=""
        className="wb-surface rounded-2xl p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--ink-muted)]">
              Wearable &amp; Self-Report Matrix · 7 Days × 4 Windows
            </p>
            <h2
              id="d3-heatmap-heading"
              className="mt-1 text-base font-semibold text-[var(--ink-primary)]"
            >
              {plainLanguage
                ? 'Mood Balance & Recovery Grid'
                : 'Mood Valence & Recovery Heatmap'}
            </h2>
          </div>

          {/* Non-color accessible Legend */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--ink-muted)]">
            {(['stressed', 'steady', 'calm', 'joyful'] as const).map((cat) => (
              <span key={cat} className="inline-flex items-center gap-1.5">
                <span
                  className={`h-3.5 w-3.5 rounded-[4px] border border-[var(--border-strong)] ${
                    patternAssist ? VALENCE_FILLS[cat].patternClass : ''
                  }`}
                  style={{
                    backgroundColor: VALENCE_FILLS[cat].bg,
                    color: VALENCE_FILLS[cat].fg,
                  }}
                />
                <span>
                  {VALENCE_FILLS[cat].label}
                  {patternAssist && (
                    <span className="ml-1 font-mono-tabular text-[10px] opacity-85">
                      ({VALENCE_FILLS[cat].code})
                    </span>
                  )}
                </span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--bio-mint)]">
              <span
                className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] text-[9px] font-bold"
                style={{
                  border: '2px solid var(--bio-mint)',
                  backgroundColor: 'var(--bio-mint-soft)',
                }}
              >
                +
              </span>
              <span>{plainLanguage ? 'Great Heart Recovery' : 'Optimal HRV'}</span>
            </span>
          </div>
        </div>

        {heartRatePaused && (
          <div
            role="status"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--ink-secondary)]"
          >
            <span>
              {plainLanguage ? 'Heart Rhythm Recovery' : 'HRV'} recovery borders paused in
              Devices Settings · Historical cells preserved
            </span>
            {onOpenWearableSettings && (
              <button
                type="button"
                onClick={onOpenWearableSettings}
                className="shrink-0 font-semibold text-[var(--accent-primary)] underline underline-offset-2"
              >
                Devices Settings
              </button>
            )}
          </div>
        )}

        {/* Desktop Split: Left = D3 7x4 Matrix, Right = On-Demand Cell Drawer (collapsed by default) */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          {/* D3-Scaled Matrix with 320px safe horizontal scroll container */}
          <div
            ref={heatmapScrollRef}
            className={`min-w-0 overflow-x-auto px-1 pb-2 pt-1 ${
              activeCell ? 'lg:col-span-7' : 'lg:col-span-12'
            }`}
          >
            <div className={`min-w-[328px] ${activeCell ? '' : 'mx-auto max-w-2xl'}`}>
              {/* Column headers (Days) */}
              <div className="grid grid-cols-[40px_1fr] gap-2">
                <div />
                <div className="grid grid-cols-7 gap-1.5 text-center">
                  {days.map((day) => {
                    const isSelectedDay = day.dateKey === selectedDateKey;
                    return (
                      <div
                        key={day.dateKey}
                        className="text-xs font-medium tabular-nums"
                        style={{
                          color: isSelectedDay
                            ? 'var(--accent-primary)'
                            : 'var(--ink-muted)',
                          fontWeight: isSelectedDay ? 700 : 500,
                        }}
                      >
                        {day.shortDay}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4 Window Rows */}
              <div
                className="mt-2 space-y-2"
                role="grid"
                aria-label="7 by 4 Mood Valence and Recovery Heatmap. Use arrow keys to move across days and windows."
              >
                {DAY_WINDOWS.map((win, rowIdx) => (
                  <div
                    key={win.id}
                    role="row"
                    className="grid grid-cols-[40px_1fr] items-center gap-2"
                  >
                    <div
                      role="rowheader"
                      className="pr-1 text-right text-xs font-medium text-[var(--ink-muted)]"
                    >
                      {win.shortLabel}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {days.map((day, colIdx) => {
                        const key = `${day.dateKey}-${win.id}`;
                        const cell = cellMap.get(key);
                        if (!cell) return null;
                        const style = VALENCE_FILLS[cell.valenceCategory];
                        const isSelected =
                          activeCell &&
                          activeCell.dateKey === cell.dateKey &&
                          activeCell.window === cell.window;
                        const isRovingFocus =
                          focusedCoords.row === rowIdx && clampedFocusedCol === colIdx;
                        const ariaText = `${cell.fullDateLabel}, ${cell.windowLabel}: ${
                          cell.avgScore !== null && Number.isFinite(cell.avgScore)
                            ? `${cell.avgScore.toFixed(1)} out of 5, ${style.label}, ${cell.entries.length} ${cell.entries.length === 1 ? 'entry' : 'entries'}`
                            : 'No check-in logged'
                        }. ${cell.optimalHrv ? 'Optimal HRV recovery.' : `${cell.windowBiometric.recoveryStatus} recovery.`}`;

                        return (
                          <button
                            key={key}
                            ref={(el) => {
                              cellRefs.current[key] = el;
                            }}
                            type="button"
                            role="gridcell"
                            tabIndex={isRovingFocus ? 0 : -1}
                            aria-selected={Boolean(isSelected)}
                            aria-label={ariaText}
                            onClick={() => {
                              setFocusedCoords({ row: rowIdx, col: colIdx });
                              onSelectCell(cell);
                            }}
                            onFocus={() => setFocusedCoords({ row: rowIdx, col: colIdx })}
                            onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                            className="relative flex aspect-square min-h-[46px] w-full flex-col items-center justify-center rounded-xl transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]"
                            style={{
                              backgroundColor: style.bg,
                              color: style.fg,
                              border: cell.optimalHrv
                                ? '2px solid var(--bio-mint)'
                                : '1px solid var(--border-hairline)',
                              outline: isSelected
                                ? '2px solid var(--accent-primary)'
                                : undefined,
                              outlineOffset: isSelected ? '2px' : undefined,
                            }}
                          >
                            {/* Non-colliding Pattern Assist micro-pattern layer */}
                            {patternAssist && style.patternClass && (
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none absolute inset-0 rounded-[10px] opacity-[0.16] ${style.patternClass}`}
                              />
                            )}
                            {/* Non-color Optimal HRV corner glyph */}
                            {cell.optimalHrv && (
                              <span
                                aria-hidden="true"
                                className="absolute right-1 top-0.5 z-10 text-[9px] font-bold leading-none"
                                style={{ color: 'var(--bio-mint)' }}
                              >
                                +
                              </span>
                            )}
                            <span className="relative z-10 pt-0.5 font-mono-tabular text-xs font-semibold leading-none">
                              {cell.avgScore !== null ? cell.avgScore.toFixed(1) : '—'}
                            </span>
                            {patternAssist && style.code ? (
                              <span className="relative z-10 mt-0.5 font-mono-tabular text-[9px] font-semibold leading-none opacity-90">
                                {style.code}
                              </span>
                            ) : (
                              cell.entries.length > 1 && (
                                <span className="relative z-10 mt-0.5 text-[10px] leading-none opacity-85 tabular-nums">
                                  {cell.entries.length}×
                                </span>
                              )
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-3 text-xs text-[var(--ink-muted)]">
              Select or arrow-key any cell to inspect journal snippets and Pixel Watch
              biometric context. A <strong className="text-[var(--bio-mint)]">+</strong>{' '}
              border marks Optimal HRV recovery.
            </p>
          </div>

          {/* On-Demand Cell Detail Drawer */}
          {activeCell && (
            <div
              aria-live="polite"
              onKeyDown={(e) => {
                if (e.key === 'Escape' && onCloseDrawer) {
                  e.preventDefault();
                  const key = `${activeCell.dateKey}-${activeCell.window}`;
                  onCloseDrawer();
                  window.requestAnimationFrame(() => {
                    cellRefs.current[key]?.focus({ preventScroll: true });
                  });
                }
              }}
              className="min-w-0 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4 lg:col-span-5"
            >
              <div className="flex items-start justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-[var(--ink-primary)]">
                    {activeCell.fullDateLabel} · {activeCell.windowLabel}
                  </h3>
                  <p className="text-xs text-[var(--ink-muted)] tabular-nums">
                    {activeCell.windowRange}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="text-right">
                    <p className="font-mono-tabular text-base font-bold text-[var(--ink-primary)]">
                      {activeCell.avgScore !== null
                        ? `${activeCell.avgScore.toFixed(1)}/5.0`
                        : 'No log'}
                    </p>
                    <p
                      className="text-xs font-semibold"
                      style={{ color: VALENCE_FILLS[activeCell.valenceCategory].fg }}
                    >
                      {VALENCE_FILLS[activeCell.valenceCategory].label}
                    </p>
                  </div>
                  {onCloseDrawer && (
                    <button
                      type="button"
                      onClick={() => {
                        const key = `${activeCell.dateKey}-${activeCell.window}`;
                        onCloseDrawer();
                        window.requestAnimationFrame(() => {
                          cellRefs.current[key]?.focus({ preventScroll: true });
                        });
                      }}
                      aria-label="Close cell details drawer"
                      className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Journal Snippet Cards */}
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-[var(--ink-muted)]">
                  Journal Snippets ({activeCell.entries.length})
                </p>
                {activeCell.entries.length === 0 ? (
                  <p className="rounded-lg bg-[var(--surface-card)] px-3 py-2.5 text-xs text-[var(--ink-muted)]">
                    No check-ins recorded during this window. Biometric telemetry below was
                    passively captured by Pixel Watch.
                  </p>
                ) : (
                  activeCell.entries.map((entry) => {
                    const qStyle = getQuadrantStyle(entry.quadrant);
                    return (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span style={{ color: qStyle.fg }}>
                              <AffectiveGlyph
                                emotionId={entry.emotionId}
                                quadrant={entry.quadrant}
                                size={15}
                              />
                            </span>
                            <span className="text-xs font-semibold text-[var(--ink-primary)]">
                              {entry.emotionLabel}
                            </span>
                            <span className="font-mono-tabular text-xs text-[var(--ink-muted)]">
                              {Number.isFinite(entry.score) ? entry.score.toFixed(1) : '—'}
                            </span>
                          </div>
                          <span className="text-xs text-[var(--ink-muted)] tabular-nums">
                            {(() => {
                              const parsed = new Date(entry.timestamp);
                              return Number.isNaN(parsed.getTime())
                                ? '—'
                                : parsed.toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  });
                            })()}
                          </span>
                        </div>
                        {entry.note && (
                          <p className="wb-prose mt-1.5 select-text break-words text-xs leading-relaxed text-[var(--ink-secondary)] [overflow-wrap:anywhere]">
                            &ldquo;{entry.note}&rdquo;
                          </p>
                        )}
                        {entry.tags.length > 0 && (
                          <p className="mt-1 break-words text-xs text-[var(--ink-muted)]">
                            {entry.tags.join(' · ')}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pixel Watch Biometric Context */}
              <div className="mt-4 border-t border-[var(--border-hairline)] pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-primary)]">
                    <Watch className="h-3.5 w-3.5 text-[var(--bio-mint)]" />
                    <span>Pixel Watch Biometric Context</span>
                  </div>
                  <span
                    className="text-xs font-semibold"
                    style={{
                      color:
                        activeCell.windowBiometric.recoveryStatus === 'Optimal HRV'
                          ? 'var(--bio-mint)'
                          : activeCell.windowBiometric.recoveryStatus === 'Balanced'
                            ? 'var(--ink-secondary)'
                            : 'var(--q-red-fg)',
                    }}
                  >
                    {activeCell.windowBiometric.recoveryStatus}
                  </span>
                </div>

                <dl className="mt-2.5 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-[var(--surface-card)] px-2.5 py-2">
                    <dt className="flex items-center gap-1 text-xs text-[var(--ink-muted)]">
                      <Moon className="h-3 w-3" />
                      <span>Sleep</span>
                    </dt>
                    <dd className="mt-0.5 font-mono-tabular text-xs font-semibold text-[var(--ink-primary)]">
                      {activeCell.biometric.sleepHours.toFixed(1)}h · Q
                      {activeCell.biometric.sleepQuality}
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-lg bg-[var(--surface-card)] px-2.5 py-2">
                    <dt className="flex items-center gap-1 text-xs text-[var(--ink-muted)]">
                      <Activity className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {plainLanguage ? 'Heart Rate Variability' : 'Est. HRV'}
                        {heartRatePaused ? ' (Saved)' : ''}
                      </span>
                    </dt>
                    <dd className="mt-0.5 font-mono-tabular text-xs font-semibold text-[var(--ink-primary)]">
                      {activeCell.windowBiometric.hrvMs} ms
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-lg bg-[var(--surface-card)] px-2.5 py-2">
                    <dt className="flex items-center gap-1 text-xs text-[var(--ink-muted)]">
                      <HeartPulse className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {plainLanguage ? 'Resting Heart Rate' : 'Resting HR'}
                        {heartRatePaused ? ' (Saved)' : ''}
                      </span>
                    </dt>
                    <dd className="mt-0.5 font-mono-tabular text-xs font-semibold text-[var(--ink-primary)]">
                      {activeCell.windowBiometric.restingHr} bpm
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-lg bg-[var(--surface-card)] px-2.5 py-2">
                    <dt className="flex items-center gap-1 text-xs text-[var(--ink-muted)]">
                      <Footprints className="h-3 w-3 shrink-0" />
                      <span>Steps</span>
                    </dt>
                    <dd className="mt-0.5 font-mono-tabular text-xs font-semibold text-[var(--ink-primary)]">
                      {activeCell.biometric.steps.toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }
);
HeatmapD3.displayName = 'HeatmapD3';
