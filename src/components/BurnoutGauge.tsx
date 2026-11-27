import React, { useState } from 'react';
import { Sparkles, Wind } from 'lucide-react';
import { TrendsAnalytics } from '../utils/analytics';
import { useAccessibility } from '../context/AccessibilityContext';

interface BurnoutGaugeProps {
  analytics: TrendsAnalytics;
  plainLanguage?: boolean;
  heartRatePaused?: boolean;
  onOpenWearableSettings?: () => void;
  onLaunchBreathingReset: () => void;
}

type PreviewMode = 'live' | 'balanced' | 'strained' | 'high';

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

const GAUGE_CX = 140;
const GAUGE_CY = 128;
const GAUGE_RADIUS = 86;
const ARC_BALANCED = describeArc(GAUGE_CX, GAUGE_CY, GAUGE_RADIUS, 2, 60);
const ARC_STRAINED = describeArc(GAUGE_CX, GAUGE_CY, GAUGE_RADIUS, 66, 116);
const ARC_RISK = describeArc(GAUGE_CX, GAUGE_CY, GAUGE_RADIUS, 122, 178);

const PREVIEW_OPTIONS: Array<{ id: PreviewMode; label: string }> = [
  { id: 'live', label: 'Live' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'strained', label: 'Strained' },
  { id: 'high', label: 'High' },
];

export const BurnoutGauge: React.FC<BurnoutGaugeProps> = React.memo(
  ({
    analytics,
    plainLanguage = false,
    heartRatePaused = false,
    onOpenWearableSettings,
    onLaunchBreathingReset,
  }) => {
    const a11y = useAccessibility();
    const isPlain = plainLanguage || a11y.plainLanguage;
    const [preview, setPreview] = useState<PreviewMode>('live');

    const safeSleepHours = Number.isFinite(analytics.avgSleepHours) ? analytics.avgSleepHours : 0;
    const safeRestingHr = Number.isFinite(analytics.avgRestingHr) ? analytics.avgRestingHr : 0;
    const safeLowEnergyDays = Number.isFinite(analytics.lowEnergyDays) ? analytics.lowEnergyDays : 0;

    const biometricSummary =
      preview === 'live'
        ? {
            sleep: `${safeSleepHours.toFixed(1)}h`,
            rhr: heartRatePaused
              ? `${safeRestingHr} bpm (Saved)`
              : `${safeRestingHr} bpm`,
            rhrShort: `${safeRestingHr} bpm`,
            lowEnergy: `${safeLowEnergyDays}d`,
            ariaSuffix: `Average sleep ${safeSleepHours.toFixed(1)} hours, resting heart rate ${safeRestingHr} beats per minute, ${safeLowEnergyDays} low-energy days.`,
          }
        : preview === 'balanced'
          ? {
              sleep: '≥ 7.5h',
              rhr: '≤ 62 bpm',
              rhrShort: '≤ 62 bpm',
              lowEnergy: '0–1d',
              ariaSuffix: 'Zone benchmark: 7.5 or more hours sleep, 62 bpm or lower resting heart rate.',
            }
          : preview === 'strained'
            ? {
                sleep: '6.6–7.1h',
                rhr: '64–68 bpm',
                rhrShort: '64–68 bpm',
                lowEnergy: '2–3d',
                ariaSuffix: 'Zone benchmark: 6.6 to 7.1 hours sleep, 64 to 68 bpm resting heart rate.',
              }
            : {
                sleep: '≤ 6.2h',
                rhr: '≥ 70 bpm',
                rhrShort: '≥ 70 bpm',
                lowEnergy: '4+d',
                ariaSuffix: 'Zone benchmark: 6.2 hours or less sleep, 70 bpm or higher resting heart rate.',
              };

    const safeLiveScore = Number.isFinite(analytics.burnoutScore)
      ? Math.max(0, Math.min(100, Math.round(analytics.burnoutScore)))
      : 0;
    const displayScore =
      preview === 'live'
        ? safeLiveScore
        : preview === 'balanced'
          ? 24
          : preview === 'strained'
            ? 52
            : 81;

    const displayZone: 'Balanced' | 'Strained' | 'Burnout Risk' =
      displayScore <= 35 ? 'Balanced' : displayScore <= 65 ? 'Strained' : 'Burnout Risk';

    const displayGuidance =
      preview === 'live'
        ? analytics.burnoutGuidance
        : preview === 'balanced'
          ? 'Previewing Balanced zone (0–35): Sleep recovery and heart-rate variability are replenishing faster than daytime stress load.'
          : preview === 'strained'
            ? 'Previewing Strained zone (36–65): Cumulative mid-week tension or shorter sleep windows are reducing emotional buffer. Schedule a calming 4-7-8 reset inside Routines.'
            : 'Previewing Burnout Risk zone (66–100): Sustained sympathetic load across multiple days. Reduce non-essential commitments and use 4-7-8 Breathing or Voice Panic Anchor inside Routines.';

    const zoneColor =
      displayZone === 'Balanced'
        ? 'var(--q-green-fg)'
        : displayZone === 'Strained'
          ? 'var(--q-yellow-fg)'
          : 'var(--q-red-fg)';

    const needleAngle = (Math.max(0, Math.min(100, displayScore)) / 100) * 180;
    const needleTip = polarToCartesian(GAUGE_CX, GAUGE_CY, GAUGE_RADIUS - 14, needleAngle);

    return (
      <section
        aria-labelledby="burnout-gauge-heading"
        data-edge-recede=""
        className="wb-surface flex h-full min-w-0 flex-col justify-between rounded-2xl p-4 sm:p-5"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-muted)]">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--bio-mint)]" />
                <span>Pattern Insight</span>
                <span aria-hidden="true">·</span>
                <span>
                  {isPlain ? 'Daily Energy & Stress Balance' : 'Autonomic Load Model'}
                </span>
              </div>
              <h2
                id="burnout-gauge-heading"
                className="mt-1 text-base font-semibold text-[var(--ink-primary)]"
              >
                {isPlain ? 'Energy Reserve Gauge' : 'Burnout Resilience Gauge'}
              </h2>
            </div>

            {/* Interactive State-Preview Segmented Selector (320px safe) */}
            <div
              className="grid w-full grid-cols-4 items-center gap-1 rounded-xl bg-[var(--surface-subtle)] p-1 sm:flex sm:w-auto sm:flex-wrap"
              role="group"
              aria-label="Preview resilience zones"
            >
              {PREVIEW_OPTIONS.map((opt) => {
                const active = preview === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPreview(opt.id)}
                    aria-pressed={active}
                    className="min-h-[38px] min-w-0 truncate rounded-lg px-2 text-xs font-semibold transition-colors sm:min-h-[36px] sm:px-2.5"
                    style={{
                      backgroundColor: active ? 'var(--surface-card)' : 'transparent',
                      color: active ? 'var(--ink-primary)' : 'var(--ink-muted)',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {heartRatePaused && (
            <div
              role="status"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--ink-secondary)]"
            >
              <span>
                {isPlain ? 'Heart Rate & Heart Rhythm' : 'Heart Rate & HRV'} sensor paused in
                Devices Settings · Showing saved history
              </span>
              {onOpenWearableSettings && (
                <button
                  type="button"
                  onClick={onOpenWearableSettings}
                  className="shrink-0 font-semibold text-[var(--accent-primary)] underline underline-offset-2"
                >
                  Settings
                </button>
              )}
            </div>
          )}

          {/* Radial 0-100 Segmented Gauge (expanded viewBox prevents top/edge clipping) */}
          <div className="mt-4 flex flex-col items-center">
            <svg
              viewBox="0 0 280 158"
              className="w-full max-w-[280px] overflow-visible"
              role="img"
              aria-label={`Burnout resilience score ${displayScore} out of 100 in the ${displayZone} zone${preview !== 'live' ? ' preview' : ''}. ${biometricSummary.ariaSuffix}`}
            >
              <path
                d={ARC_BALANCED}
                fill="none"
                stroke="var(--q-green-solid)"
                strokeWidth="12"
                strokeLinecap="round"
                opacity={displayZone === 'Balanced' ? 1 : 0.32}
              />
              <path
                d={ARC_STRAINED}
                fill="none"
                stroke="var(--q-yellow-solid)"
                strokeWidth="12"
                strokeLinecap={a11y.patternAssist ? 'butt' : 'round'}
                strokeDasharray={a11y.patternAssist ? '10 5' : undefined}
                opacity={displayZone === 'Strained' ? 1 : 0.32}
              />
              <path
                d={ARC_RISK}
                fill="none"
                stroke="var(--q-red-solid)"
                strokeWidth="12"
                strokeLinecap={a11y.patternAssist ? 'butt' : 'round'}
                strokeDasharray={a11y.patternAssist ? '4 4' : undefined}
                opacity={displayZone === 'Burnout Risk' ? 1 : 0.32}
              />

              <line
                x1={GAUGE_CX}
                y1={GAUGE_CY}
                x2={needleTip.x}
                y2={needleTip.y}
                stroke="var(--ink-primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx={GAUGE_CX} cy={GAUGE_CY} r="5" fill="var(--ink-primary)" />

              <text
                x="14"
                y="148"
                fontSize="10"
                fill="var(--chart-axis)"
                className="tabular-nums"
              >
                0 · Balanced
              </text>
              <text
                x="140"
                y="18"
                textAnchor="middle"
                fontSize="10"
                fill="var(--chart-axis)"
              >
                Strained
              </text>
              <text
                x="266"
                y="148"
                textAnchor="end"
                fontSize="10"
                fill="var(--chart-axis)"
                className="tabular-nums"
              >
                100 · Risk
              </text>
            </svg>

            <div className="-mt-1 text-center" aria-live="polite">
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="font-mono-tabular text-3xl font-semibold text-[var(--ink-primary)]">
                  {displayScore}
                </span>
                <span className="font-mono-tabular text-sm text-[var(--ink-muted)]">/100</span>
              </div>
              <p className="mt-0.5 text-xs font-semibold" style={{ color: zoneColor }}>
                {displayZone}
                {a11y.patternAssist &&
                  (displayZone === 'Balanced'
                    ? ' · Low Load'
                    : displayZone === 'Strained'
                      ? ' · Moderate'
                      : ' · High Load')}
                {preview !== 'live' && ' (Preview)'}
              </p>
            </div>
          </div>

          {/* Biometric Summary Strip (Live telemetry in Live mode; zone benchmarks in Preview mode) */}
          <dl className="mt-4 grid grid-cols-3 divide-x divide-[var(--border-hairline)] rounded-xl bg-[var(--surface-subtle)] py-2.5 text-center">
            <div className="min-w-0 px-1.5 sm:px-2">
              <dt className="truncate text-[11px] text-[var(--ink-muted)]">
                {preview === 'live' ? 'Avg Sleep' : 'Target Sleep'}
              </dt>
              <dd className="mt-0.5 font-mono-tabular text-sm font-semibold text-[var(--ink-primary)]">
                {biometricSummary.sleep}
              </dd>
            </div>
            <div className="min-w-0 px-1.5 sm:px-2">
              <dt className="truncate text-[11px] text-[var(--ink-muted)]">
                {isPlain ? 'Resting Heart Rate' : 'Resting HR'}
                {preview === 'live' && heartRatePaused ? ' · Saved' : ''}
              </dt>
              <dd className="mt-0.5 font-mono-tabular text-sm font-semibold text-[var(--ink-primary)]">
                {biometricSummary.rhrShort}
              </dd>
            </div>
            <div className="min-w-0 px-1.5 sm:px-2">
              <dt className="truncate text-[11px] text-[var(--ink-muted)]">Low-energy</dt>
              <dd className="mt-0.5 font-mono-tabular text-sm font-semibold text-[var(--ink-primary)]">
                {biometricSummary.lowEnergy}
              </dd>
            </div>
          </dl>

          <p className="wb-prose mt-3.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
            {displayGuidance}
          </p>
        </div>

        {/* Routine Action: Navigate to Routines */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3.5">
          <span className="text-xs text-[var(--ink-muted)]">
            {isPlain ? 'Guided calming exercises' : 'Vagal recovery modules'}
          </span>
          <button
            type="button"
            onClick={onLaunchBreathingReset}
            className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-xs font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-primary-ink)',
            }}
          >
            <Wind className="h-3.5 w-3.5" />
            <span>{isPlain ? 'Open Routines' : 'Start Reset in Routines'}</span>
          </button>
        </div>
      </section>
    );
  }
);
BurnoutGauge.displayName = 'BurnoutGauge';
