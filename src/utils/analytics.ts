import {
  ContextTag,
  DailyBiometrics,
  DayWindow,
  MoodBucket,
  MoodEntry,
} from '../types/wellbe';
import { CONTEXT_TAGS, DAY_WINDOWS, MOOD_BUCKETS, toLocalDateKey } from '../data/wellbeData';

export interface DaySummaryPoint {
  dateKey: string;
  shortDay: string; // 'Su', 'Mo', ..., 'Now'
  fullDateLabel: string;
  avgMood: number | null;
  minMood: number | null;
  maxMood: number | null;
  span: number;
  count: number;
  entries: MoodEntry[];
  biometric: DailyBiometrics;
  isToday: boolean;
}

export interface HeatmapCellData {
  dateKey: string;
  dayShort: string;
  fullDateLabel: string;
  window: DayWindow;
  windowLabel: string;
  windowRange: string;
  avgScore: number | null;
  entries: MoodEntry[];
  valenceCategory: 'stressed' | 'steady' | 'calm' | 'joyful' | 'empty';
  optimalHrv: boolean;
  biometric: DailyBiometrics;
  windowBiometric: DailyBiometrics['windows'][DayWindow];
}

export interface RankedDriver {
  rank: string;
  tag: ContextTag;
  count: number;
  avgScore: number | null;
  impactLabel: 'Uplifting' | 'Balanced' | 'Straining' | 'No data';
}

export interface BucketDistribution {
  id: MoodBucket;
  label: string;
  shortLabel: string;
  quadrant: 'yellow' | 'green' | 'balanced' | 'blue' | 'red';
  count: number;
  percentage: number;
}

export interface CorrelationStats {
  r: number | null;
  sampleCount: number;
  strengthLabel: string;
  thresholdLabel: string;
  aboveAvg: number | null;
  belowAvg: number | null;
  liftDelta: number | null;
  peakSyncDay: { dateLabel: string; mood: number; metricText: string } | null;
  patternNote: string;
}

export interface TrendsAnalytics {
  rangeDays: 7 | 30;
  rangeLabel: string;
  hasMoodData: boolean;
  activeStreak: number;
  avgScore: number | null;
  avgStateLabel: string;
  totalLoggedInRange: number;
  totalLoggedAllTime: number;
  topUpliftingDriver: RankedDriver | null;
  // Stability sparkline
  stabilityShiftLabel: 'Steady Baseline' | 'Moderate Shift' | 'Elevated Shift' | 'Insufficient Data';
  minRangeScore: number | null;
  maxRangeScore: number | null;
  stdDev: number | null;
  latestDeltaVsAvg: number | null;
  // Daily synchronized series
  dailySeries: DaySummaryPoint[];
  last7Series: DaySummaryPoint[];
  // Burnout Resilience
  burnoutScore: number;
  burnoutZone: 'Balanced' | 'Strained' | 'Burnout Risk';
  avgSleepHours: number;
  avgSleepQuality: number;
  avgRestingHr: number;
  avgHrvMs: number;
  lowEnergyDays: number;
  burnoutGuidance: string;
  // Daily Mood Range steadiness
  steadyDaysCount: number;
  highSwingDaysCount: number;
  // 7x4 Heatmap
  heatmapCells: HeatmapCellData[];
  // Correlations
  sleepCorrelation: CorrelationStats;
  stepsCorrelation: CorrelationStats;
  // Ranked Triggers
  rankedDrivers: RankedDriver[];
  // Distribution
  distribution: BucketDistribution[];
}

const SHORT_WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function normalizeZero(n: number): number {
  if (!Number.isFinite(n) || Object.is(n, -0) || Math.abs(n) < 0.0001) return 0;
  return n;
}

export function scoreToStateLabel(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return 'No Logs';
  if (score >= 4.25) return 'Joyful';
  if (score >= 3.65) return 'Calm';
  if (score >= 3.0) return 'Steady';
  if (score >= 2.25) return 'Low';
  return 'Strained';
}

export function scoreToValence(score: number | null): HeatmapCellData['valenceCategory'] {
  if (score === null || !Number.isFinite(score)) return 'empty';
  if (score >= 4.2) return 'joyful';
  if (score >= 3.55) return 'calm';
  if (score >= 2.75) return 'steady';
  return 'stressed';
}

export function computeActiveStreak(entries: MoodEntry[]): number {
  if (entries.length === 0) return 0;
  const uniqueDates = new Set(entries.map((e) => e.dateKey));
  let streak = 0;
  // Anchor at local noon so DST 23h/25h transitions never skip or duplicate a calendar day
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if (!uniqueDates.has(toLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (uniqueDates.has(toLocalDateKey(cursor)) && streak < 3650) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function pearsonR(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (!Number.isFinite(den) || den === 0) return 0;
  const raw = Math.max(-1, Math.min(1, num / den));
  return normalizeZero(Number(raw.toFixed(2)));
}

const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function safeFixed(value: number | null | undefined, digits: number, fallback = '0.0'): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : fallback;
}

function formatShortDate(dateKey: string): string {
  const parts = dateKey.split('-').map(Number);
  if (parts.length !== 3 || !parts.every(Number.isFinite)) return dateKey;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  if (Number.isNaN(dt.getTime())) return dateKey;
  return SHORT_DATE_FMT.format(dt);
}

export function computeAnalytics(
  entries: MoodEntry[],
  biometrics: DailyBiometrics[],
  rangeDays: 7 | 30
): TrendsAnalytics {
  const bioMap = new Map<string, DailyBiometrics>();
  biometrics.forEach((b) => bioMap.set(b.dateKey, b));

  const entriesByDate = new Map<string, MoodEntry[]>();
  entries.forEach((e) => {
    const list = entriesByDate.get(e.dateKey) ?? [];
    list.push(e);
    entriesByDate.set(e.dateKey, list);
  });

  // Anchor once at local noon to prevent DST shifts or midnight rollovers mid-computation
  const noonAnchor = new Date();
  noonAnchor.setHours(12, 0, 0, 0);

  const buildDailySeries = (days: number): DaySummaryPoint[] => {
    const list: DaySummaryPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(noonAnchor);
      d.setDate(noonAnchor.getDate() - i);
      const dateKey = toLocalDateKey(d);
      const isToday = i === 0;
      const dayEntries = [...(entriesByDate.get(dateKey) ?? [])].sort((a, b) => {
        const ta = Date.parse(a.timestamp);
        const tb = Date.parse(b.timestamp);
        return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
      });
      const scores = dayEntries.map((e) => e.score).filter(Number.isFinite);
      const avgMood =
        scores.length > 0
          ? Number((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2))
          : null;
      const minMood = scores.length > 0 ? Math.min(...scores) : null;
      const maxMood = scores.length > 0 ? Math.max(...scores) : null;
      const span =
        minMood !== null && maxMood !== null
          ? normalizeZero(Number((maxMood - minMood).toFixed(2)))
          : 0;

      const fallbackBio: DailyBiometrics = {
        dateKey,
        sleepHours: 7.0,
        sleepQuality: 74,
        hrvMs: 46,
        restingHr: 65,
        steps: 7200,
        optimalHrv: false,
        windows: {
          morn: { window: 'morn', hrvMs: 48, restingHr: 63, steps: 1800, recoveryStatus: 'Balanced' },
          mid: { window: 'mid', hrvMs: 45, restingHr: 66, steps: 2200, recoveryStatus: 'Balanced' },
          aft: { window: 'aft', hrvMs: 46, restingHr: 65, steps: 2200, recoveryStatus: 'Balanced' },
          eve: { window: 'eve', hrvMs: 48, restingHr: 64, steps: 1000, recoveryStatus: 'Balanced' },
        },
      };

      list.push({
        dateKey,
        shortDay: isToday ? 'Now' : SHORT_WEEKDAYS[d.getDay()],
        fullDateLabel: formatShortDate(dateKey),
        avgMood,
        minMood,
        maxMood,
        span,
        count: dayEntries.length,
        entries: dayEntries,
        biometric: bioMap.get(dateKey) ?? fallbackBio,
        isToday,
      });
    }
    return list;
  };

  const dailySeries = buildDailySeries(rangeDays);
  const last7Series = rangeDays === 7 ? dailySeries : dailySeries.slice(-7);

  const rangeDateKeys = new Set(dailySeries.map((d) => d.dateKey));
  const rangeEntries = entries.filter((e) => rangeDateKeys.has(e.dateKey));
  const hasMoodData = rangeEntries.length > 0;

  const rangeLabel =
    dailySeries.length > 0
      ? `${dailySeries[0].fullDateLabel} – ${dailySeries[dailySeries.length - 1].fullDateLabel}`
      : 'Last 7 days';

  const activeStreak = computeActiveStreak(entries);

  const validScores = rangeEntries.map((e) => e.score).filter(Number.isFinite);
  const avgScore =
    validScores.length > 0
      ? Number((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1))
      : null;
  const avgStateLabel = scoreToStateLabel(avgScore);

  // Stability sparkline (strictly guarded for 0 or 1 populated day)
  const dayAverages = dailySeries
    .map((d) => d.avgMood)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const minRangeScore = dayAverages.length > 0 ? Math.min(...dayAverages) : null;
  const maxRangeScore = dayAverages.length > 0 ? Math.max(...dayAverages) : null;
  const meanDayAvg =
    dayAverages.length > 0
      ? dayAverages.reduce((a, b) => a + b, 0) / dayAverages.length
      : null;
  const stdDev =
    dayAverages.length > 1 && meanDayAvg !== null
      ? normalizeZero(
          Number(
            Math.sqrt(
              dayAverages.reduce((acc, v) => acc + Math.pow(v - meanDayAvg, 2), 0) /
                dayAverages.length
            ).toFixed(2)
          )
        )
      : dayAverages.length === 1
        ? 0
        : null;
  const latestDeltaVsAvg =
    dayAverages.length > 0 && meanDayAvg !== null
      ? normalizeZero(Number((dayAverages[dayAverages.length - 1] - meanDayAvg).toFixed(2)))
      : null;

  const stabilityShiftLabel: TrendsAnalytics['stabilityShiftLabel'] =
    stdDev === null
      ? 'Insufficient Data'
      : stdDev < 0.45
        ? 'Steady Baseline'
        : stdDev < 0.85
          ? 'Moderate Shift'
          : 'Elevated Shift';

  // Burnout Resilience Index (0-100, calibrated from biometrics + mood strain when available)
  const seriesLen = Math.max(1, dailySeries.length);
  const finiteOr = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
  const avgSleepHours = Number(
    (
      dailySeries.reduce((s, d) => s + finiteOr(d.biometric.sleepHours, 7.0), 0) / seriesLen
    ).toFixed(1)
  );
  const avgSleepQuality = Math.round(
    dailySeries.reduce((s, d) => s + finiteOr(d.biometric.sleepQuality, 74), 0) / seriesLen
  );
  const avgRestingHr = Math.round(
    dailySeries.reduce((s, d) => s + finiteOr(d.biometric.restingHr, 65), 0) / seriesLen
  );
  const avgHrvMs = Math.round(
    dailySeries.reduce((s, d) => s + finiteOr(d.biometric.hrvMs, 46), 0) / seriesLen
  );
  const lowEnergyDays = dailySeries.filter(
    (d) => (d.avgMood !== null && d.avgMood < 3.0) || d.biometric.sleepHours < 6.6
  ).length;

  const sleepStrain = Math.max(0, (7.8 - avgSleepHours) * 16);
  const hrStrain = Math.max(0, (avgRestingHr - 58) * 1.45);
  const moodStrain = avgScore !== null ? Math.max(0, (4.3 - avgScore) * 14) : 10;
  const lowDayStrain = (lowEnergyDays / seriesLen) * 24;
  const burnoutScore = Math.max(
    8,
    Math.min(96, Math.round(sleepStrain + hrStrain + moodStrain + lowDayStrain))
  );

  const burnoutZone: TrendsAnalytics['burnoutZone'] =
    burnoutScore <= 35 ? 'Balanced' : burnoutScore <= 65 ? 'Strained' : 'Burnout Risk';

  const lowDaysText = `${lowEnergyDays} ${lowEnergyDays === 1 ? 'day' : 'days'}`;
  const lowEnergyDaysText = `${lowEnergyDays} lower-energy ${lowEnergyDays === 1 ? 'day' : 'days'}`;

  const burnoutGuidance = !hasMoodData
    ? `Estimated from Pixel Watch biometrics alone (${avgSleepHours}h avg sleep, ${avgRestingHr} bpm resting HR). Log check-ins to combine subjective mood valence.`
    : burnoutZone === 'Balanced'
      ? `Recovery reserves look steady across ${dailySeries.length} days (avg ${avgSleepHours}h sleep, ${avgRestingHr} bpm resting HR). Keep protecting evening wind-down consistency.`
      : burnoutZone === 'Strained'
        ? `Mild cumulative load detected across ${lowEnergyDaysText} (${avgSleepHours}h avg sleep, ${avgRestingHr} bpm RHR). A 4-7-8 reset before afternoon peaks can buffer strain.`
        : `Elevated autonomic strain across ${lowDaysText} with shortened sleep (${avgSleepHours}h) and higher resting HR (${avgRestingHr} bpm). Prioritize recovery boundaries and a calming reset now.`;

  // Steadiness summary (Daily Mood Range)
  let steadyDaysCount = 0;
  let highSwingDaysCount = 0;
  dailySeries.forEach((d) => {
    if (d.count === 0) return;
    if (d.span >= 1.6) {
      highSwingDaysCount += 1;
    } else {
      steadyDaysCount += 1;
    }
  });

  // 7x4 Mood Valence & Recovery Heatmap
  const heatmapCells: HeatmapCellData[] = [];
  last7Series.forEach((day) => {
    DAY_WINDOWS.forEach((win) => {
      const cellEntries = day.entries.filter((e) => e.dayWindow === win.id);
      const avg =
        cellEntries.length > 0
          ? Number(
              (
                cellEntries.reduce((sum, item) => sum + item.score, 0) / cellEntries.length
              ).toFixed(1)
            )
          : null;
      const winBio = day.biometric.windows[win.id];
      heatmapCells.push({
        dateKey: day.dateKey,
        dayShort: day.shortDay,
        fullDateLabel: day.fullDateLabel,
        window: win.id,
        windowLabel: win.fullLabel,
        windowRange: win.rangeLabel,
        avgScore: avg,
        entries: cellEntries,
        valenceCategory: scoreToValence(avg),
        optimalHrv: winBio.recoveryStatus === 'Optimal HRV' || day.biometric.optimalHrv,
        biometric: day.biometric,
        windowBiometric: winBio,
      });
    });
  });

  // Mind-Body Biometric Correlations (strictly guarded for <3 paired days)
  const pairedDays = dailySeries.filter((d) => d.avgMood !== null);
  const moodVals = pairedDays.map((d) => d.avgMood as number);

  const strengthLabel = (r: number | null) => {
    if (r === null) return 'Need ≥ 3 logged days';
    const abs = Math.abs(r);
    if (abs >= 0.65) return r > 0 ? 'Strong positive' : 'Strong inverse';
    if (abs >= 0.35) return r > 0 ? 'Moderate positive' : 'Moderate inverse';
    if (abs >= 0.15) return r > 0 ? 'Mild positive' : 'Mild inverse';
    return 'Weak / Independent';
  };

  // Sleep correlation
  const sleepVals = pairedDays.map((d) => d.biometric.sleepHours);
  const sleepR = pearsonR(sleepVals, moodVals);
  const aboveSleep = pairedDays.filter((d) => d.biometric.sleepHours >= 7.0);
  const belowSleep = pairedDays.filter((d) => d.biometric.sleepHours < 7.0);
  const aboveSleepAvg =
    aboveSleep.length > 0
      ? Number(
          (aboveSleep.reduce((s, d) => s + (d.avgMood ?? 0), 0) / aboveSleep.length).toFixed(2)
        )
      : null;
  const belowSleepAvg =
    belowSleep.length > 0
      ? Number(
          (belowSleep.reduce((s, d) => s + (d.avgMood ?? 0), 0) / belowSleep.length).toFixed(2)
        )
      : null;
  const sleepLift =
    aboveSleepAvg !== null && belowSleepAvg !== null
      ? normalizeZero(Number((aboveSleepAvg - belowSleepAvg).toFixed(2)))
      : null;

  let peakSleepDay: CorrelationStats['peakSyncDay'] = null;
  if (pairedDays.length > 0) {
    const best = [...pairedDays].sort(
      (a, b) =>
        (b.avgMood ?? 0) + b.biometric.sleepHours * 0.45 - ((a.avgMood ?? 0) + a.biometric.sleepHours * 0.45)
    )[0];
    peakSleepDay = {
      dateLabel: best.fullDateLabel,
      mood: Number((best.avgMood ?? 0).toFixed(1)),
      metricText: `${best.biometric.sleepHours.toFixed(1)}h sleep`,
    };
  }

  const sleepCorrelation: CorrelationStats = {
    r: sleepR,
    sampleCount: pairedDays.length,
    strengthLabel: strengthLabel(sleepR),
    thresholdLabel: '≥ 7.0h Sleep',
    aboveAvg: aboveSleepAvg,
    belowAvg: belowSleepAvg,
    liftDelta: sleepLift,
    peakSyncDay: peakSleepDay,
    patternNote:
      pairedDays.length < 3
        ? `Log mood check-ins on at least 3 days in this window to compute sleep duration correlation (${pairedDays.length}/3 days logged).`
        : sleepLift !== null && sleepLift > 0.15
          ? `Across ${pairedDays.length} tracked days, nights reaching at least 7.0 hours of sleep coincided with a +${sleepLift.toFixed(2)} higher daily mood average (${aboveSleepAvg?.toFixed(1)} vs. ${belowSleepAvg?.toFixed(1)}).`
          : `Sleep duration and daily mood moved independently over these ${pairedDays.length} days (r = ${(sleepR ?? 0).toFixed(2)}); daytime stressors and recovery breaks played a larger role.`,
  };

  // Steps correlation
  const stepsVals = pairedDays.map((d) => d.biometric.steps);
  const stepsR = pearsonR(stepsVals, moodVals);
  const aboveSteps = pairedDays.filter((d) => d.biometric.steps >= 7500);
  const belowSteps = pairedDays.filter((d) => d.biometric.steps < 7500);
  const aboveStepsAvg =
    aboveSteps.length > 0
      ? Number(
          (aboveSteps.reduce((s, d) => s + (d.avgMood ?? 0), 0) / aboveSteps.length).toFixed(2)
        )
      : null;
  const belowStepsAvg =
    belowSteps.length > 0
      ? Number(
          (belowSteps.reduce((s, d) => s + (d.avgMood ?? 0), 0) / belowSteps.length).toFixed(2)
        )
      : null;
  const stepsLift =
    aboveStepsAvg !== null && belowStepsAvg !== null
      ? normalizeZero(Number((aboveStepsAvg - belowStepsAvg).toFixed(2)))
      : null;

  let peakStepsDay: CorrelationStats['peakSyncDay'] = null;
  if (pairedDays.length > 0) {
    const best = [...pairedDays].sort(
      (a, b) =>
        (b.avgMood ?? 0) + b.biometric.steps / 5000 - ((a.avgMood ?? 0) + a.biometric.steps / 5000)
    )[0];
    peakStepsDay = {
      dateLabel: best.fullDateLabel,
      mood: Number((best.avgMood ?? 0).toFixed(1)),
      metricText: `${best.biometric.steps.toLocaleString()} steps`,
    };
  }

  const stepsCorrelation: CorrelationStats = {
    r: stepsR,
    sampleCount: pairedDays.length,
    strengthLabel: strengthLabel(stepsR),
    thresholdLabel: '≥ 7,500 Steps',
    aboveAvg: aboveStepsAvg,
    belowAvg: belowStepsAvg,
    liftDelta: stepsLift,
    peakSyncDay: peakStepsDay,
    patternNote:
      pairedDays.length < 3
        ? `Log mood check-ins on at least 3 days in this window to compute daily step correlation (${pairedDays.length}/3 days logged).`
        : stepsLift !== null && stepsLift > 0.15
          ? `Days above 7,500 Pixel Watch steps averaged ${aboveStepsAvg?.toFixed(1)}/5.0 mood (+${stepsLift.toFixed(2)} lift vs. lower-movement days), pointing to movement as a reliable mood buffer.`
          : `Step volume showed a mild relationship with mood valence (r = ${(stepsR ?? 0).toFixed(2)}) over the ${rangeDays}-day window; restorative pacing mattered alongside total steps.`,
  };

  // Ranked Context Triggers (01 - 06)
  const driverStats = CONTEXT_TAGS.map((tag) => {
    const matching = rangeEntries.filter((e) => e.tags.includes(tag));
    const avg =
      matching.length > 0
        ? Number((matching.reduce((s, e) => s + e.score, 0) / matching.length).toFixed(1))
        : null;
    const impactLabel: RankedDriver['impactLabel'] =
      avg === null
        ? 'No data'
        : avg >= 3.8
          ? 'Uplifting'
          : avg >= 2.8
            ? 'Balanced'
            : 'Straining';
    return {
      tag,
      count: matching.length,
      avgScore: avg,
      impactLabel,
    };
  }).sort((a, b) => b.count - a.count || (b.avgScore ?? -1) - (a.avgScore ?? -1));

  const rankedDrivers: RankedDriver[] = driverStats.map((d, idx) => ({
    rank: String(idx + 1).padStart(2, '0'),
    ...d,
  }));

  const topUpliftingDriver =
    [...rankedDrivers]
      .filter((d) => d.count > 0 && d.avgScore !== null)
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0) || b.count - a.count)[0] ?? null;

  // Emotional Distribution across 5 buckets (reconciled via Largest Remainder Method to sum to 100%)
  const bucketCounts = MOOD_BUCKETS.map((b) => rangeEntries.filter((e) => e.bucket === b.id).length);
  const totalDist = bucketCounts.reduce((acc, c) => acc + c, 0);
  const rawBuckets = MOOD_BUCKETS.map((b, idx) => {
    const count = bucketCounts[idx];
    const exactPct = totalDist > 0 ? (count / totalDist) * 100 : 0;
    const floorPct = Math.floor(exactPct);
    return {
      id: b.id,
      label: b.label,
      shortLabel: b.shortLabel,
      quadrant: b.quadrant,
      count,
      floorPct,
      remainder: exactPct - floorPct,
    };
  });

  const reconciledPct = rawBuckets.map((b) => b.floorPct);
  if (totalDist > 0) {
    let remaining = 100 - reconciledPct.reduce((acc, v) => acc + v, 0);
    const order = rawBuckets
      .map((b, idx) => ({ idx, remainder: b.remainder, count: b.count }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.remainder - a.remainder || b.count - a.count);
    for (let i = 0; i < remaining && i < order.length; i++) {
      reconciledPct[order[i].idx] += 1;
    }
  }

  const distribution: BucketDistribution[] = rawBuckets.map((b, idx) => ({
    id: b.id,
    label: b.label,
    shortLabel: b.shortLabel,
    quadrant: b.quadrant,
    count: b.count,
    percentage: reconciledPct[idx],
  }));

  return {
    rangeDays,
    rangeLabel,
    hasMoodData,
    activeStreak,
    avgScore,
    avgStateLabel,
    totalLoggedInRange: rangeEntries.length,
    totalLoggedAllTime: entries.length,
    topUpliftingDriver,
    stabilityShiftLabel,
    minRangeScore,
    maxRangeScore,
    stdDev,
    latestDeltaVsAvg,
    dailySeries,
    last7Series,
    burnoutScore,
    burnoutZone,
    avgSleepHours,
    avgSleepQuality,
    avgRestingHr,
    avgHrvMs,
    lowEnergyDays,
    burnoutGuidance,
    steadyDaysCount,
    highSwingDaysCount,
    heatmapCells,
    sleepCorrelation,
    stepsCorrelation,
    rankedDrivers,
    distribution,
  };
}

export function buildTherapistSummaryText(analytics: TrendsAnalytics, entries: MoodEntry[]): string {
  const recentNotes = entries
    .filter((e) => e.note.trim().length > 0)
    .slice(0, 6)
    .map(
      (e) =>
        `• ${formatShortDate(e.dateKey)} (${e.emotionLabel}, ${safeFixed(e.score, 1)}/5.0, ${e.tags.join(', ') || 'Untagged'}): "${e.note}"`
    )
    .join('\n');

  const topDriversText = analytics.rankedDrivers
    .filter((d) => d.count > 0 && d.avgScore !== null)
    .slice(0, 4)
    .map(
      (d) =>
        `  ${d.rank}. ${d.tag}: ${safeFixed(d.avgScore, 1)}/5.0 avg (${d.count} logs · ${d.impactLabel})`
    )
    .join('\n');

  return [
    `WELLBE+ CLINICAL WELL-BEING OVERVIEW`,
    `Period: ${analytics.rangeLabel} (${analytics.rangeDays}-Day Window)`,
    `Generated: ${new Date().toLocaleString()}`,
    ``,
    `1. AFFECTIVE BASELINE & STABILITY`,
    `• Check-ins Logged: ${analytics.totalLoggedInRange} in window (${analytics.totalLoggedAllTime} total persisted locally)`,
    `• Mean Valence Score: ${analytics.avgScore !== null ? `${analytics.avgScore.toFixed(1)} / 5.0 (${analytics.avgStateLabel})` : 'No mood check-ins logged in this window'}`,
    `• Emotional Variability: ${analytics.stdDev !== null ? `±${analytics.stdDev.toFixed(2)} SD (${analytics.stabilityShiftLabel}; range ${analytics.minRangeScore?.toFixed(1)}–${analytics.maxRangeScore?.toFixed(1)})` : 'Insufficient data'}`,
    `• Day Steadiness: ${analytics.steadyDaysCount} Steady days vs. ${analytics.highSwingDaysCount} High-Swing days`,
    ``,
    `2. WEARABLE BIOMETRIC & RESILIENCE CONTEXT (PIXEL WATCH)`,
    `• Burnout Resilience Index: ${analytics.burnoutScore}/100 (${analytics.burnoutZone})`,
    `• Mean Sleep: ${analytics.avgSleepHours.toFixed(1)}h (Quality ${analytics.avgSleepQuality}/100)`,
    `• Mean Est. HRV: ${analytics.avgHrvMs} ms | Mean Resting HR: ${analytics.avgRestingHr} bpm`,
    `• Sleep–Mood Correlation: ${analytics.sleepCorrelation.r !== null ? `r = ${analytics.sleepCorrelation.r.toFixed(2)} (${analytics.sleepCorrelation.strengthLabel})` : 'Need ≥ 3 logged days'}`,
    `• Steps–Mood Correlation: ${analytics.stepsCorrelation.r !== null ? `r = ${analytics.stepsCorrelation.r.toFixed(2)} (${analytics.stepsCorrelation.strengthLabel})` : 'Need ≥ 3 logged days'}`,
    ``,
    `3. RANKED CONTEXT DRIVERS`,
    topDriversText || '  No context tags logged in this window.',
    ``,
    `4. RECENT JOURNAL EXCERPTS`,
    recentNotes || '• No written journal excerpts recorded in this window.',
    ``,
    `Note: Prepared by WELLBE+ from self-reported local logs and wearable telemetry for collaborative session discussion. Not a clinical diagnosis.`,
  ].join('\n');
}

export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function entriesToCsv(entries: MoodEntry[]): string {
  const header = ['ID', 'Timestamp', 'Date', 'Window', 'Emotion', 'Quadrant', 'Bucket', 'Score', 'Tags', 'Source', 'Note'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = entries.map((e) =>
    [
      e.id,
      e.timestamp,
      e.dateKey,
      e.dayWindow,
      e.emotionLabel,
      e.isBlended && e.secondaryQuadrantLabel && e.secondaryQuadrantLabel !== e.quadrantLabel
        ? `${e.quadrantLabel} + ${e.secondaryQuadrantLabel}`
        : e.quadrantLabel,
      e.bucket,
      safeFixed(e.score, 1),
      e.tags.join('; '),
      e.source,
      e.note,
    ]
      .map(escape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}
