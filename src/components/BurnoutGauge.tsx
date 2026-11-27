import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Sparkles, Wind } from 'lucide-react';
import { TrendsAnalytics } from '../utils/analytics';
import { useAccessibility } from '../context/AccessibilityContext';
import { getM3Spring, m3Shapes } from '../design/m3ExpressiveTokens';
import { ExpressiveButton } from './ExpressiveControls';

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
    const osReduced = useReducedMotion();
    const reduceMotion = Boolean(osReduced || a11y.reduceMotion);
    const isPlain = plainLanguage || a11y.plainLanguage;
    const [preview, setPreview] = useState<PreviewMode>('live');

    const fastSpring = getM3Spring('fastSpatial', {
      reduceMotion,
      calmMode: a11y.calmMode,
    });
    const spatialSpring = getM3Spring('defaultSpatial', {
      reduceMotion,
      calmMode: a11y.calmMode,
    });
    const effectsSpring = getM3Spring('defaultEffects', {
      reduceMotion,
      calmMode: a11y.calmMode,
    });

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

    const zonePalette =
      displayZone === 'Balanced'
        ? {
            fg: 'var(--q-green-fg)',
            bg: 'var(--q-green-bg)',
            border: 'var(--q-green-border)',
          }
        : displayZone === 'Strained'
          ? {
              fg: 'var(--q-yellow-fg)',
              bg: 'var(--q-yellow-bg)',
              border: 'var(--q-yellow-border)',
            }
          : {
              fg: 'var(--q-red-fg)',
              bg: 'var(--q-red-bg)',
              border: 'var(--q-red-border)',
            };

    const needleAngle = (Math.max(0, Math.min(100, displayScore)) / 100) * 180;
    const needleTip = polarToCartesian(GAUGE_CX, GAUGE_CY, GAUGE_RADIUS - 14, needleAngle);

    return (
      <section
        aria-labelledby="burnout-gauge-heading"
        data-edge-recede=""
        className="wb-surface flex h-full min-w-0 flex-col justify-between rounded-[24px] p-4 sm:p-5"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="wb-m3-eyebrow flex flex-wrap items-center gap-1.5 text-[var(--ink-muted)]">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--bio-mint)]" aria-hidden="true" />
                <span>Pattern Insight</span>
                <span aria-hidden="true">·</span>
                <span>
                  {isPlain ? 'Energy & Stress' : 'Autonomic Load'}
                </span>
              </div>
              <h2
                id="burnout-gauge-heading"
                className="wb-m3-headline mt-1 text-[18px] text-[var(--ink-primary)] sm:text-[19px]"
              >
                {isPlain ? 'Energy Reserve Gauge' : 'Burnout Resilience Gauge'}
              </h2>
            </div>

            {/* Interactive M3 Expressive Segmented Selector (Pill <-> Squircle morph, 320px safe) */}
            <div
              className="grid w-full grid-cols-4 items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-1 sm:flex sm:w-auto sm:flex-wrap"
              role="group"
              aria-label="Preview resilience zones"
            >
              {PREVIEW_OPTIONS.map((opt) => {
                const active = preview === opt.id;
                return (
                  <motion.button
                    key={opt.id}
                    type="button"
                    onClick={() => setPreview(opt.id)}
                    aria-pressed={active}
                    whileHover={reduceMotion ? undefined : { scale: 1.03 }}
                    whileTap={
                      reduceMotion
                        ? undefined
                        : { scale: 0.92, borderRadius: m3Shapes.selectedChip }
                    }
                    animate={{
                      borderRadius: active ? '12px' : m3Shapes.pill,
                    }}
                    transition={fastSpring}
                    className="wb-m3-label-strong min-h-[38px] min-w-0 select-none truncate px-2 text-xs transition-colors sm:min-h-[36px] sm:px-3"
                    style={{
                      backgroundColor: active ? 'var(--accent-primary)' : 'transparent',
                      color: active ? 'var(--accent-primary-ink)' : 'var(--ink-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {heartRatePaused && (
            <div
              role="status"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 py-2 text-xs text-[var(--ink-secondary)]"
            >
              <span>
                {isPlain ? 'Heart Rate & Heart Rhythm' : 'Heart Rate & HRV'} sensor paused in
                Devices Settings · Showing saved history
              </span>
              {onOpenWearableSettings && (
                <ExpressiveButton
                  variant="tonal"
                  size="sm"
                  onClick={onOpenWearableSettings}
                  className="wb-m3-label-strong"
                >
                  Settings
                </ExpressiveButton>
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

              <motion.line
                x1={GAUGE_CX}
                y1={GAUGE_CY}
                initial={false}
                animate={{ x2: needleTip.x, y2: needleTip.y }}
                transition={spatialSpring}
                stroke="var(--ink-primary)"
                strokeWidth="2.75"
                strokeLinecap="round"
              />
              <circle cx={GAUGE_CX} cy={GAUGE_CY} r="5.5" fill="var(--ink-primary)" />

              <text
                x="14"
                y="148"
                fontSize="10"
                fontWeight="600"
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
                fontWeight="600"
                fill="var(--chart-axis)"
              >
                Strained
              </text>
              <text
                x="266"
                y="148"
                textAnchor="end"
                fontSize="10"
                fontWeight="600"
                fill="var(--chart-axis)"
                className="tabular-nums"
              >
                100 · Risk
              </text>
            </svg>

            <div className="-mt-1 flex flex-col items-center text-center" aria-live="polite">
              <div className="flex items-baseline justify-center gap-1">
                <motion.span
                  key={`${preview}-${displayScore}`}
                  initial={reduceMotion ? false : { opacity: 0.45, y: 6, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={spatialSpring}
                  className="wb-m3-metric inline-block text-[40px] text-[var(--ink-primary)] sm:text-[42px]"
                >
                  {displayScore}
                </motion.span>
                <span className="wb-m3-label-strong text-sm text-[var(--ink-muted)] tabular-nums">
                  /100
                </span>
              </div>

              <motion.span
                key={`${preview}-${displayZone}`}
                initial={reduceMotion ? false : { opacity: 0.5, scale: 0.94 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  borderRadius: preview !== 'live' ? '11px' : m3Shapes.pill,
                }}
                transition={fastSpring}
                className="wb-m3-label-strong mt-2 inline-flex items-center px-3 py-1 text-xs"
                style={{
                  backgroundColor: zonePalette.bg,
                  color: zonePalette.fg,
                  border: `1px solid ${zonePalette.border}`,
                }}
              >
                {displayZone}
                {a11y.patternAssist &&
                  (displayZone === 'Balanced'
                    ? ' · Low Load'
                    : displayZone === 'Strained'
                      ? ' · Moderate'
                      : ' · High Load')}
                {preview !== 'live' && ' · Preview'}
              </motion.span>
            </div>
          </div>

          {/* Biometric Summary Strip (Live telemetry in Live mode; zone benchmarks in Preview mode) */}
          <dl className="mt-4 grid grid-cols-3 divide-x divide-[var(--border-hairline)] rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] py-3 text-center">
            <div className="min-w-0 px-1.5 sm:px-2">
              <dt className="wb-m3-eyebrow truncate text-[10px] text-[var(--ink-muted)]">
                {preview === 'live' ? 'Avg Sleep' : 'Target Sleep'}
              </dt>
              <motion.dd
                key={`sleep-${preview}-${biometricSummary.sleep}`}
                initial={reduceMotion ? false : { opacity: 0.4, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={effectsSpring}
                className="wb-m3-metric mt-1.5 text-[15px] text-[var(--ink-primary)]"
              >
                {biometricSummary.sleep}
              </motion.dd>
            </div>
            <div className="min-w-0 px-1.5 sm:px-2">
              <dt className="wb-m3-eyebrow truncate text-[10px] text-[var(--ink-muted)]">
                {isPlain ? 'Resting HR' : 'Resting HR'}
                {preview === 'live' && heartRatePaused ? ' · Saved' : ''}
              </dt>
              <motion.dd
                key={`rhr-${preview}-${biometricSummary.rhrShort}`}
                initial={reduceMotion ? false : { opacity: 0.4, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={effectsSpring}
                className="wb-m3-metric mt-1.5 text-[15px] text-[var(--ink-primary)]"
              >
                {biometricSummary.rhrShort}
              </motion.dd>
            </div>
            <div className="min-w-0 px-1.5 sm:px-2">
              <dt className="wb-m3-eyebrow truncate text-[10px] text-[var(--ink-muted)]">
                Low-energy
              </dt>
              <motion.dd
                key={`low-${preview}-${biometricSummary.lowEnergy}`}
                initial={reduceMotion ? false : { opacity: 0.4, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={effectsSpring}
                className="wb-m3-metric mt-1.5 text-[15px] text-[var(--ink-primary)]"
              >
                {biometricSummary.lowEnergy}
              </motion.dd>
            </div>
          </dl>

          <motion.p
            key={`guidance-${preview}-${displayZone}`}
            initial={reduceMotion ? false : { opacity: 0.45, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={effectsSpring}
            className="wb-prose mt-3.5 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]"
          >
            {displayGuidance}
          </motion.p>
        </div>

        {/* Routine Action: Navigate to Routines (M3 Expressive Filled Pill -> Squircle) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--border-hairline)] pt-3.5">
          <span className="wb-m3-eyebrow text-[10px] text-[var(--ink-muted)]">
            {isPlain ? 'Guided calming exercises' : 'Vagal recovery modules'}
          </span>
          <ExpressiveButton
            variant="filled"
            size="md"
            onClick={onLaunchBreathingReset}
            leadingIcon={<Wind className="h-3.5 w-3.5" />}
            className="wb-m3-label-strong"
          >
            {isPlain ? 'Open Routines' : 'Start Reset in Routines'}
          </ExpressiveButton>
        </div>
      </section>
    );
  }
);
BurnoutGauge.displayName = 'BurnoutGauge';

