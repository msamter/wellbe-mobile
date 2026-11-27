import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown, ChevronUp, FileText, Sparkles } from 'lucide-react';
import { AppSettings } from '../types/wellbe';
import { CorrelationStats, DaySummaryPoint, TrendsAnalytics } from '../utils/analytics';
import { WearableSensors } from '../utils/wearablesStorage';
import { BurnoutGauge } from './BurnoutGauge';
import { getQuadrantStyle } from './AffectiveGlyphs';
import { useDragToScroll } from '../hooks/useDragToScroll';

const QUADRANT_PATTERN_MAP: Record<string, string> = {
  yellow: 'wb-pattern-yellow',
  green: 'wb-pattern-green',
  blue: 'wb-pattern-blue',
  red: 'wb-pattern-red',
};

const TRENDS_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--surface-card)',
  border: '1px solid var(--border-strong)',
  borderRadius: '12px',
  fontSize: '12px',
  color: 'var(--ink-primary)',
  fontVariantNumeric: 'tabular-nums',
};

const MOOD_AREA_DOT = {
  r: 4,
  fill: 'var(--surface-card)',
  stroke: 'var(--accent-primary)',
  strokeWidth: 2,
};

const MOOD_AREA_ACTIVE_DOT = {
  r: 6,
  fill: 'var(--bio-mint)',
  stroke: 'var(--surface-card)',
  strokeWidth: 2,
};

const MOOD_LINE_DOT = {
  r: 3.5,
  fill: 'var(--accent-primary)',
};

const TRENDS_TOOLTIP_WRAPPER_STYLE: React.CSSProperties = {
  zIndex: 45,
  pointerEvents: 'none',
};

interface FriendlyPatternCopy {
  headline: string;
  body: string;
}

function buildFriendlyPatternCopy(
  stats: CorrelationStats,
  metric: 'sleep' | 'steps',
  rangeDays: 7 | 30,
  fallbackAvgMood: number | null
): FriendlyPatternCopy {
  const periodWord = rangeDays === 7 ? 'week' : 'month';

  if (stats.sampleCount < 3) {
    return metric === 'sleep'
      ? {
          headline: 'Still getting to know your rhythm',
          body: 'Check in on a few more days to gently notice how sleep and mood tend to move together—no rush, log whenever it feels helpful.',
        }
      : {
          headline: 'Still getting to know your rhythm',
          body: 'Check in on a few more days to gently notice how daily movement and mood tend to move together—no rush, log whenever it feels helpful.',
        };
  }

  if (metric === 'sleep') {
    if (
      stats.liftDelta !== null &&
      stats.liftDelta > 0.15 &&
      stats.aboveAvg !== null &&
      stats.belowAvg !== null
    ) {
      return {
        headline: 'More restful nights often lined up with steadier days',
        body: `On days following 7+ hours of sleep, your mood averaged ${stats.aboveAvg.toFixed(1)}/5 compared with ${stats.belowAvg.toFixed(1)}/5 after shorter nights. Rest looks like a supportive anchor—not a strict rule.`,
      };
    }
    if (
      stats.liftDelta !== null &&
      stats.liftDelta < -0.15 &&
      stats.aboveAvg !== null &&
      stats.belowAvg !== null
    ) {
      return {
        headline: 'Your mood held steady even on shorter nights',
        body: `Check-ins averaged ${stats.belowAvg.toFixed(1)}/5 on shorter-sleep days compared with ${stats.aboveAvg.toFixed(1)}/5 after 7+ hours, suggesting daytime pacing and support mattered more this ${periodWord}.`,
      };
    }
    const steadyAvg = stats.aboveAvg ?? fallbackAvgMood;
    return {
      headline: 'Mood stayed fairly steady across different sleep lengths',
      body: `Over the past ${rangeDays} days, your mood stayed around ${steadyAvg !== null ? `${steadyAvg.toFixed(1)}/5` : 'a steady baseline'} across longer and shorter nights—everyday moments and recovery breaks likely played just as big a role.`,
    };
  }

  if (
    stats.liftDelta !== null &&
    stats.liftDelta > 0.15 &&
    stats.aboveAvg !== null &&
    stats.belowAvg !== null
  ) {
    return {
      headline: 'More active days often paired with brighter check-ins',
      body: `Days with 7,500+ steps averaged ${stats.aboveAvg.toFixed(1)}/5 compared with ${stats.belowAvg.toFixed(1)}/5 on quieter days. Light movement can be a gentle boost whenever you have the energy.`,
    };
  }
  if (stats.liftDelta !== null && stats.liftDelta < -0.15) {
    return {
      headline: 'Quieter days aligned with calmer check-ins',
      body: `Lower-step days lined up with steadier moods this ${periodWord}—a gentle reminder that slower pacing and rest can be just as supportive as staying active.`,
    };
  }
  return {
    headline: 'Mood stayed balanced across busier and quieter days',
    body: `Over the past ${rangeDays} days, your mood looked similar on higher- and lower-step days, pointing to comfortable pacing rather than any step target.`,
  };
}

interface TrendsTabProps {
  isActive?: boolean;
  analytics: TrendsAnalytics;
  rangeDays: 7 | 30;
  settings: AppSettings;
  wearableSensors: WearableSensors;
  onChangeRange: (days: 7 | 30) => void;
  onOpenTherapistSummary: () => void;
  onOpenWearableSettings: () => void;
  onLaunchBreathingReset: () => void;
}

export const TrendsTab: React.FC<TrendsTabProps> = React.memo(
  ({
    isActive = true,
    analytics,
    rangeDays,
    settings,
    wearableSensors,
    onChangeRange,
    onOpenTherapistSummary,
    onOpenWearableSettings,
    onLaunchBreathingReset,
  }) => {
    const defaultDateKey =
      analytics.last7Series[analytics.last7Series.length - 1]?.dateKey ?? '';
    const [selectedDateKey, setSelectedDateKey] = useState<string>(defaultDateKey);

    const [corrMetric, setCorrMetric] = useState<'sleep' | 'steps'>('sleep');
    const [showPatternCard, setShowPatternCard] = useState(false);
    const [staggerActive, setStaggerActive] = useState(true);
    const trendsRootRef = useRef<HTMLDivElement>(null);
    const tooltipsDismissedRef = useRef(false);
    const dayStripRef = useRef<HTMLDivElement>(null);
    useDragToScroll(dayStripRef, { axis: 'x' });

    useEffect(() => {
      const t = window.setTimeout(() => setStaggerActive(false), 280);
      return () => window.clearTimeout(t);
    }, []);

    // Dismiss stuck Recharts hover tooltips via DOM attribute on scroll/tap-outside (active only while Trends is visible)
    useEffect(() => {
      const setHidden = (hidden: boolean) => {
        if (tooltipsDismissedRef.current === hidden) return;
        tooltipsDismissedRef.current = hidden;
        const root = trendsRootRef.current;
        if (!root) return;
        if (hidden) {
          root.setAttribute('data-tooltips-hidden', 'true');
        } else {
          root.removeAttribute('data-tooltips-hidden');
        }
      };

      if (!isActive) {
        setHidden(true);
        return;
      }

      const handleScroll = () => setHidden(true);
      const handlePointerDown = (e: PointerEvent) => {
        if (tooltipsDismissedRef.current) return;
        const target = e.target as HTMLElement | null;
        if (!target?.closest('.wb-chart-surface')) {
          setHidden(true);
        }
      };
      window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
      window.addEventListener('pointerdown', handlePointerDown, { passive: true });
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('pointerdown', handlePointerDown);
      };
    }, [isActive]);

    const tooltipWrapperStyle = TRENDS_TOOLTIP_WRAPPER_STYLE;

    const revealTooltips = useCallback(() => {
      if (tooltipsDismissedRef.current) {
        tooltipsDismissedRef.current = false;
        trendsRootRef.current?.removeAttribute('data-tooltips-hidden');
      }
    }, []);

    // Keep selectedDateKey valid whenever rangeDays or underlying series updates
    useEffect(() => {
      const exists = analytics.dailySeries.some((d) => d.dateKey === selectedDateKey);
      if (!exists && defaultDateKey) {
        setSelectedDateKey(defaultDateKey);
      }
    }, [analytics.dailySeries, selectedDateKey, defaultDateKey]);

    const selectedDay: DaySummaryPoint | undefined = useMemo(() => {
      return (
        analytics.dailySeries.find((d) => d.dateKey === selectedDateKey) ??
        analytics.last7Series[analytics.last7Series.length - 1]
      );
    }, [analytics.dailySeries, analytics.last7Series, selectedDateKey]);

    const handleSelectDay = useCallback((dateKey: string) => {
      setSelectedDateKey(dateKey);
    }, []);

    const chartSeries = useMemo(
      () =>
        analytics.dailySeries.map((d) => ({
          dateKey: d.dateKey,
          label: rangeDays === 7 ? d.shortDay : d.fullDateLabel,
          fullDate: d.fullDateLabel,
          mood: d.avgMood,
          minMood: d.minMood,
          maxMood: d.maxMood,
          sleepQuality: d.biometric.sleepQuality,
          sleepHours: d.biometric.sleepHours,
          steps: d.biometric.steps,
          hrv: d.biometric.hrvMs,
          restingHr: d.biometric.restingHr,
          count: d.count,
        })),
      [analytics.dailySeries, rangeDays]
    );

    const activeCorrStats =
      corrMetric === 'sleep' ? analytics.sleepCorrelation : analytics.stepsCorrelation;

    const friendlyPattern = useMemo(
      () => buildFriendlyPatternCopy(activeCorrStats, corrMetric, rangeDays, analytics.avgScore),
      [activeCorrStats, corrMetric, rangeDays, analytics.avgScore]
    );

    const avgDailySteps = useMemo(() => {
      if (analytics.dailySeries.length === 0) return 0;
      const sum = analytics.dailySeries.reduce((acc, d) => acc + d.biometric.steps, 0);
      return Math.round(sum / analytics.dailySeries.length);
    }, [analytics.dailySeries]);

    const chartDomains = useMemo(() => {
      const sleepVals = analytics.dailySeries.map((d) => d.biometric.sleepHours);
      const stepVals = analytics.dailySeries.map((d) => d.biometric.steps);
      const minSleep = sleepVals.length > 0 ? Math.min(...sleepVals) : 5;
      const maxSleep = sleepVals.length > 0 ? Math.max(...sleepVals) : 9;
      const maxSteps = stepVals.length > 0 ? Math.max(...stepVals) : 10000;

      const sleepOverlay: [number, number] = [
        Math.max(0, Math.floor(Math.min(4, minSleep - 0.5))),
        Math.ceil(Math.max(10, maxSleep + 0.5)),
      ];
      const stepsOverlay: [number, number] = [
        0,
        Math.max(12000, Math.ceil((maxSteps + 1000) / 2000) * 2000),
      ];
      return { sleepOverlay, stepsOverlay };
    }, [analytics.dailySeries]);

    const xAxisInterval = rangeDays === 30 ? 4 : 0;

    return (
      <div
        ref={trendsRootRef}
        className="wb-trends-root wb-calm-stack space-y-6 pb-[104px] sm:pb-[112px] lg:space-y-7"
      >
        {/* Header & Controls: Therapist Summary + 7D/30D Toggle + Date Range */}
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-semibold tracking-tight text-[var(--ink-primary)] sm:text-[28px]"
              style={{ textWrap: 'balance' }}
            >
              Trends
            </h1>
            <p className="mt-0.5 text-sm font-normal text-[var(--ink-muted)] tabular-nums">
              {settings.plainLanguage
                ? 'Mood & Watch Overview'
                : 'Live Biometrics'}{' '}
              · {analytics.rangeLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 7D / 30D Range Toggle (≥44px hit height) */}
            <div
              className="flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-1"
              role="group"
              aria-label="Analytics time range"
            >
              {([7, 30] as const).map((days) => {
                const active = rangeDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => onChangeRange(days)}
                    aria-pressed={active}
                    className="min-h-[44px] min-w-[44px] whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors tabular-nums"
                    style={{
                      backgroundColor: active ? 'var(--surface-card)' : 'transparent',
                      color: active ? 'var(--ink-primary)' : 'var(--ink-muted)',
                    }}
                  >
                    {days}D
                  </button>
                );
              })}
            </div>

            {/* Therapist Summary Generator */}
            <button
              type="button"
              onClick={onOpenTherapistSummary}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl px-4 text-xs font-semibold transition-colors"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-primary-ink)',
              }}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{settings.plainLanguage ? 'Care Team Summary' : 'Therapist Summary'}</span>
            </button>
          </div>
        </section>

        {/* Emotional Distribution (Top Spotlight — GPU-safe transform: scaleX) */}
        <section
          aria-labelledby="emotional-dist-heading"
          data-edge-recede=""
          data-stagger={staggerActive ? '0' : undefined}
          className={`wb-surface ${staggerActive ? 'wb-stagger-card ' : ''}min-w-0 rounded-2xl p-4 sm:p-5`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2
                id="emotional-dist-heading"
                className="text-base font-semibold text-[var(--ink-primary)]"
              >
                {settings.plainLanguage ? 'Mood Breakdown' : 'Emotional Distribution'}
              </h2>
              <p className="text-xs text-[var(--ink-muted)]">
                {settings.plainLanguage
                  ? 'Share of check-ins across your 5 mood groups'
                  : 'Proportion of check-ins across all 5 affective buckets'}
              </p>
            </div>
            {analytics.totalLoggedInRange > 0 && (
              <span className="font-mono-tabular text-xs text-[var(--ink-muted)]">
                {analytics.totalLoggedInRange}{' '}
                {analytics.totalLoggedInRange === 1 ? 'log' : 'logs'} · {rangeDays}D
              </span>
            )}
          </div>

          {analytics.totalLoggedInRange === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] p-5 text-center text-xs text-[var(--ink-muted)]">
              Log a check-in to see your {rangeDays}-day emotional distribution.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {analytics.distribution
                .filter((bucket) => bucket.count > 0)
                .map((bucket) => {
                  const qStyle = getQuadrantStyle(bucket.quadrant);
                  const scale = Math.max(0.04, bucket.percentage / 100);
                  const patternClass = settings.patternAssist
                    ? QUADRANT_PATTERN_MAP[bucket.quadrant] ?? ''
                    : '';
                  return (
                    <div key={bucket.id} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate font-medium text-[var(--ink-primary)]">
                          {bucket.label}
                        </span>
                        <span className="shrink-0 font-mono-tabular text-[var(--ink-muted)]">
                          {bucket.count} · {bucket.percentage}%
                        </span>
                      </div>
                      <div
                        className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]"
                        role="progressbar"
                        aria-label={bucket.label}
                        aria-valuenow={bucket.percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className={`h-full w-full origin-left rounded-full transition-transform duration-300 ${patternClass}`}
                          style={{
                            transform: `scaleX(${scale})`,
                            backgroundColor: qStyle.solid,
                            color: 'var(--surface-card)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* Row 2: Interactive Mood Curve (Left 7 cols) | Burnout Resilience Gauge (Right 5 cols) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
          <div className="flex min-w-0 flex-col lg:col-span-7">
            {/* Interactive 7-Day / 30-Day Mood Curve + Synchronized 7-Day Selector Strip */}
            <section
              aria-labelledby="mood-curve-heading"
              data-edge-recede=""
              data-stagger={staggerActive ? '1' : undefined}
              className={`wb-surface ${staggerActive ? 'wb-stagger-card ' : ''}flex flex-1 flex-col justify-between rounded-2xl p-4 sm:p-5`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2
                    id="mood-curve-heading"
                    className="text-base font-semibold text-[var(--ink-primary)]"
                  >
                    Interactive {rangeDays}-Day Mood Curve
                  </h2>
                  <p className="text-xs text-[var(--ink-muted)]">
                    Tap a day below or click a node to inspect mood, sleep, and daily context
                  </p>
                </div>
                {selectedDay && (
                  <span className="font-mono-tabular text-xs font-semibold text-[var(--accent-primary)]">
                    {selectedDay.fullDateLabel} ·{' '}
                    {selectedDay.avgMood !== null
                      ? `${selectedDay.avgMood.toFixed(1)}/5.0`
                      : 'No log'}
                  </span>
                )}
              </div>

              {analytics.hasMoodData ? (
                <div
                  className="wb-chart-surface mt-4 h-52 w-full"
                  onMouseMove={revealTooltips}
                  onPointerDown={revealTooltips}
                >
                  {isActive && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={120}>
                    <ComposedChart
                      data={chartSeries}
                      margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                      onClick={(state) => {
                        const idx =
                          typeof state?.activeTooltipIndex === 'number'
                            ? state.activeTooltipIndex
                            : -1;
                        const item = idx >= 0 ? chartSeries[idx] : undefined;
                        if (item?.dateKey) handleSelectDay(item.dateKey);
                      }}
                    >
                      <defs>
                        <linearGradient id="moodAreaFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        interval={xAxisInterval}
                        tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        width={28}
                        domain={[1, 5]}
                        ticks={[1, 2, 3, 4, 5]}
                        tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        trigger="hover"
                        isAnimationActive={false}
                        allowEscapeViewBox={{ x: false, y: false }}
                        wrapperStyle={tooltipWrapperStyle}
                        contentStyle={TRENDS_TOOLTIP_STYLE}
                        formatter={(value: unknown) => [
                          typeof value === 'number' && Number.isFinite(value)
                            ? `${value.toFixed(2)} / 5.0`
                            : 'No log',
                          'Mood avg',
                        ]}
                      />
                      {analytics.avgScore !== null && (
                        <ReferenceLine
                          y={analytics.avgScore}
                          stroke="var(--border-strong)"
                          strokeDasharray="4 4"
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="mood"
                        stroke="var(--accent-primary)"
                        strokeWidth={2.5}
                        fill="url(#moodAreaFill)"
                        connectNulls
                        isAnimationActive={!settings.reduceMotion}
                        dot={MOOD_AREA_DOT}
                        activeDot={MOOD_AREA_ACTIVE_DOT}
                      />
                    </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              ) : (
                <div className="mt-4 flex h-44 items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] p-6 text-center text-xs text-[var(--ink-muted)]">
                  Log at least one emotional check-in to plot your {rangeDays}-day mood curve.
                </div>
              )}

              {/* Screen-reader accessible summary table for Mood Curve */}
              <table className="sr-only">
                <caption>Daily mood curve summary</caption>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Average Mood</th>
                    <th>Check-ins</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.dailySeries.map((d) => (
                    <tr key={d.dateKey}>
                      <td>{d.fullDateLabel}</td>
                      <td>{d.avgMood !== null ? `${d.avgMood.toFixed(1)} of 5` : 'None'}</td>
                      <td>{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Synchronized 7-Day Selector Strip (Su – Now, axis-locked horizontal drag on narrow screens) */}
              <div className="mt-4 space-y-3">
                <div ref={dayStripRef} className="scroll-fade-x overflow-x-auto pb-1 pt-0.5">
                  <div
                    className="grid min-w-[332px] grid-cols-7 gap-1 px-0.5 sm:min-w-0 sm:gap-1.5"
                    role="tablist"
                    aria-label="Select day to inspect across Trends charts"
                  >
                    {analytics.last7Series.map((day) => {
                      const active = selectedDay?.dateKey === day.dateKey;
                      return (
                        <button
                          key={day.dateKey}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => handleSelectDay(day.dateKey)}
                          className="flex min-h-[48px] min-w-[44px] flex-col items-center justify-center rounded-xl border text-xs transition-colors tabular-nums"
                          style={{
                            backgroundColor: active
                              ? 'var(--accent-primary)'
                              : 'var(--surface-subtle)',
                            color: active
                              ? 'var(--accent-primary-ink)'
                              : 'var(--ink-secondary)',
                            borderColor: active
                              ? 'var(--accent-primary)'
                              : 'var(--border-hairline)',
                          }}
                        >
                          <span className="font-semibold">{day.shortDay}</span>
                          <span className="font-mono-tabular text-[11px] opacity-90">
                            {day.avgMood !== null ? day.avgMood.toFixed(1) : '—'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Synchronized Selected-Day Context Bar */}
                {selectedDay && (() => {
                  const selectedDayTags = selectedDay.entries
                    .flatMap((e) => e.tags)
                    .filter((tag) => tag.trim().length > 0)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .slice(0, 3);
                  return (
                    <div
                      aria-live="polite"
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-subtle)] px-3.5 py-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--ink-secondary)] tabular-nums">
                        <strong className="font-semibold text-[var(--ink-primary)]">
                          {selectedDay.fullDateLabel}
                        </strong>
                        {selectedDay.count > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {selectedDay.count} {selectedDay.count === 1 ? 'check-in' : 'check-ins'}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>
                          Sleep{' '}
                          {wearableSensors.sleep
                            ? `${selectedDay.biometric.sleepHours.toFixed(1)}h`
                            : 'paused'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          HRV{' '}
                          {wearableSensors.heartRateHrv
                            ? `${selectedDay.biometric.hrvMs} ms`
                            : 'paused'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {wearableSensors.steps
                            ? `${selectedDay.biometric.steps.toLocaleString()} steps`
                            : 'Steps paused'}
                        </span>
                      </div>
                      {selectedDayTags.length > 0 && (
                        <span className="text-xs text-[var(--ink-muted)]">
                          {selectedDayTags.join(' · ')}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </section>
          </div>

          {/* Burnout Resilience Gauge */}
          <div
            data-stagger={staggerActive ? '2' : undefined}
            className={`${staggerActive ? 'wb-stagger-card ' : ''}flex min-w-0 flex-col lg:col-span-5`}
          >
            <BurnoutGauge
              analytics={analytics}
              plainLanguage={settings.plainLanguage}
              heartRatePaused={!wearableSensors.heartRateHrv}
              onOpenWearableSettings={onOpenWearableSettings}
              onLaunchBreathingReset={onLaunchBreathingReset}
            />
          </div>
        </div>

        {/* Focus Mode Disclosure for Mind-Body Pattern */}
        {settings.focusMode && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--ink-primary)]">
                Focus Mode · Mind-Body Pattern
              </p>
              <p className="text-xs text-[var(--ink-muted)]">
                Open your everyday sleep and movement reflection whenever you want a closer look.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPatternCard((v) => !v)}
              aria-expanded={showPatternCard}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3.5 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
            >
              <span>{showPatternCard ? 'Hide Pattern' : 'Show Pattern'}</span>
              {showPatternCard ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        )}

        {(!settings.focusMode || showPatternCard) && (
          /* Row 3: Mind-Body Pattern Card (Leads with Plain-English Takeaway, Calm Visual Overlay) */
          <section
            aria-labelledby="mind-body-pattern-heading"
            data-edge-recede=""
            data-stagger={staggerActive ? '3' : undefined}
            className={`wb-surface ${staggerActive ? 'wb-stagger-card ' : ''}min-w-0 rounded-2xl p-4 sm:p-5`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-[var(--ink-muted)]">Mind-Body Pattern</p>
                <h2
                  id="mind-body-pattern-heading"
                  className="mt-1 text-base font-semibold text-[var(--ink-primary)]"
                >
                  {corrMetric === 'sleep' ? 'Sleep & Mood Pattern' : 'Movement & Mood Pattern'}
                </h2>
              </div>

              <div
                className="flex items-center gap-1 rounded-xl bg-[var(--surface-subtle)] p-1"
                role="group"
                aria-label="Mind-body pattern view"
              >
                {(['sleep', 'steps'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCorrMetric(m)}
                    aria-pressed={corrMetric === m}
                    className="min-h-[44px] min-w-[44px] whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor:
                        corrMetric === m ? 'var(--surface-card)' : 'transparent',
                      color:
                        corrMetric === m ? 'var(--ink-primary)' : 'var(--ink-muted)',
                    }}
                  >
                    {m === 'sleep' ? 'Sleep' : 'Steps'}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Plain-English Takeaway (Gentle, Non-Judgmental Reflection) */}
            <div className="mt-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4">
              <div className="flex items-start gap-2.5">
                <Sparkles
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bio-mint)]"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--ink-primary)]">
                    {friendlyPattern.headline}
                  </p>
                  <p className="wb-prose mt-1 text-xs leading-relaxed text-[var(--ink-secondary)] tabular-nums">
                    {friendlyPattern.body}
                  </p>
                </div>
              </div>
            </div>

            {((corrMetric === 'sleep' && !wearableSensors.sleep) ||
              (corrMetric === 'steps' && !wearableSensors.steps)) && (
              <div
                role="status"
                className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--ink-secondary)]"
              >
                <span>
                  {corrMetric === 'sleep' ? 'Sleep' : 'Daily Steps'} sensor paused in Devices
                  Settings · Showing saved history
                </span>
                <button
                  type="button"
                  onClick={onOpenWearableSettings}
                  className="shrink-0 font-semibold text-[var(--accent-primary)] underline underline-offset-2"
                >
                  Devices Settings
                </button>
              </div>
            )}

            <div
              className="wb-chart-surface mt-4 h-52 w-full"
              onMouseMove={revealTooltips}
              onPointerDown={revealTooltips}
            >
              {isActive && (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={120}>
                <ComposedChart
                  data={chartSeries}
                  margin={{ top: 10, right: 4, left: 0, bottom: 0 }}
                  onClick={(state) => {
                    const idx =
                      typeof state?.activeTooltipIndex === 'number'
                        ? state.activeTooltipIndex
                        : -1;
                    const item = idx >= 0 ? chartSeries[idx] : undefined;
                    if (item?.dateKey) handleSelectDay(item.dateKey);
                  }}
                >
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    interval={xAxisInterval}
                    tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    width={38}
                    domain={
                      corrMetric === 'sleep'
                        ? chartDomains.sleepOverlay
                        : chartDomains.stepsOverlay
                    }
                    tickFormatter={(v: number) =>
                      corrMetric === 'steps'
                        ? v >= 1000
                          ? `${Math.round(v / 1000)}k`
                          : String(v)
                        : `${v}h`
                    }
                    tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    width={24}
                    domain={[1, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    trigger="hover"
                    isAnimationActive={false}
                    allowEscapeViewBox={{ x: false, y: false }}
                    wrapperStyle={tooltipWrapperStyle}
                    contentStyle={TRENDS_TOOLTIP_STYLE}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey={corrMetric === 'sleep' ? 'sleepHours' : 'steps'}
                    name={corrMetric === 'sleep' ? 'Sleep (hrs)' : 'Steps'}
                    fill="var(--q-blue-bg)"
                    stroke="var(--q-blue-solid)"
                    radius={[6, 6, 0, 0]}
                    barSize={rangeDays === 7 ? 24 : 8}
                    isAnimationActive={!settings.reduceMotion}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="mood"
                    name="Mood"
                    stroke="var(--accent-primary)"
                    strokeWidth={2.5}
                    connectNulls
                    isAnimationActive={!settings.reduceMotion}
                    dot={MOOD_LINE_DOT}
                  />
                </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Quiet Everyday Context Footer (No Pearson r, No Cluttering Sub-Metrics) */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3 text-xs text-[var(--ink-muted)] tabular-nums">
              <span>
                {corrMetric === 'sleep'
                  ? `Average sleep ${analytics.avgSleepHours.toFixed(1)}h per night`
                  : `Average ${avgDailySteps.toLocaleString()} steps per day`}
              </span>
              <span>Observed over {rangeDays} days · For gentle reflection</span>
            </div>
          </section>
        )}
      </div>
    );
  }
);
TrendsTab.displayName = 'TrendsTab';
