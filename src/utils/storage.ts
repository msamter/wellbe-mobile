import {
  AppSettings,
  CoachMessage,
  ContextTag,
  DailyBiometrics,
  DayWindow,
  MoodEntry,
  NudgeWindow,
  ScheduledRoutine,
} from '../types/wellbe';
import {
  ALL_EMOTIONS_MAP,
  CONTEXT_TAGS,
  DEFAULT_SETTINGS,
  INITIAL_NUDGES,
  INITIAL_ROUTINES,
  RESET_PROTOCOLS,
  STEADY_EMOTION,
  getDayWindowFromHour,
  toLocalDateKey,
} from '../data/wellbeData';

const VALID_TAGS = new Set<string>(CONTEXT_TAGS);
const VALID_WINDOWS = new Set<string>(['morn', 'mid', 'aft', 'eve']);
const VALID_PROTOCOL_IDS = new Set<string>(RESET_PROTOCOLS.map((p) => p.id));

export function safeReadStorage<T>(
  key: string,
  validator: (raw: unknown) => T | null,
  fallback: () => T
): T {
  if (typeof window === 'undefined') return fallback();
  try {
    const rawStr = window.localStorage.getItem(key);
    if (!rawStr) return fallback();
    const parsed: unknown = JSON.parse(rawStr);
    const validated = validator(parsed);
    return validated !== null ? validated : fallback();
  } catch {
    return fallback();
  }
}

export function safeWriteStorage<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function sanitizeEntries(raw: unknown): MoodEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const cleaned: MoodEntry[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const tsDate =
      typeof obj.timestamp === 'string' && !Number.isNaN(Date.parse(obj.timestamp))
        ? new Date(obj.timestamp)
        : new Date();
    const emotionId = typeof obj.emotionId === 'string' ? obj.emotionId : 'steady';
    const def = ALL_EMOTIONS_MAP[emotionId] ?? STEADY_EMOTION;
    const score =
      typeof obj.score === 'number' && Number.isFinite(obj.score)
        ? Math.max(1, Math.min(5, obj.score))
        : def.score;
    const tags = Array.isArray(obj.tags)
      ? Array.from(
          new Set(
            obj.tags.filter(
              (t): t is ContextTag => typeof t === 'string' && VALID_TAGS.has(t)
            )
          )
        )
      : [];
    const dayWindow: DayWindow =
      typeof obj.dayWindow === 'string' && VALID_WINDOWS.has(obj.dayWindow)
        ? (obj.dayWindow as DayWindow)
        : getDayWindowFromHour(tsDate.getHours());
    const dateKey =
      typeof obj.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.dateKey)
        ? obj.dateKey
        : toLocalDateKey(tsDate);

    const secondaryId =
      typeof obj.secondaryEmotionId === 'string'
        ? obj.secondaryEmotionId
        : typeof obj.secondaryEmotion === 'string'
          ? obj.secondaryEmotion
          : undefined;
    const secondaryDef =
      secondaryId && secondaryId !== def.id ? ALL_EMOTIONS_MAP[secondaryId] : undefined;

    const baseId =
      typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `recovered-${i}-${Date.now()}`;
    let uniqueId = baseId;
    if (seenIds.has(uniqueId)) {
      let suffix = 2;
      while (seenIds.has(`${baseId}-${suffix}`)) {
        suffix += 1;
      }
      uniqueId = `${baseId}-${suffix}`;
    }
    seenIds.add(uniqueId);

    cleaned.push({
      id: uniqueId,
      timestamp: tsDate.toISOString(),
      dateKey,
      emotionId: def.id,
      emotionLabel: secondaryDef
        ? `${def.label} + ${secondaryDef.label}`
        : def.label,
      quadrant: def.quadrant,
      quadrantLabel: def.quadrantLabel,
      bucket: def.bucket,
      score,
      tags,
      note: typeof obj.note === 'string' ? obj.note : '',
      source: obj.source === 'watch' ? 'watch' : 'app',
      dayWindow,
      ...(secondaryDef
        ? {
            isBlended: true,
            secondaryEmotion: secondaryDef.id,
            secondaryEmotionId: secondaryDef.id,
            secondaryEmotionLabel: secondaryDef.label,
            secondaryQuadrant: secondaryDef.quadrant,
            secondaryQuadrantLabel: secondaryDef.quadrantLabel,
            secondaryBucket: secondaryDef.bucket,
          }
        : {}),
    });
  }
  cleaned.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return cleaned;
}

export function sanitizeBiometrics(raw: unknown): DailyBiometrics[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const cleaned: DailyBiometrics[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(obj.dateKey)) continue;

    const sleepHours =
      typeof obj.sleepHours === 'number' && Number.isFinite(obj.sleepHours)
        ? Math.max(2, Math.min(14, obj.sleepHours))
        : 7.0;
    const sleepQuality =
      typeof obj.sleepQuality === 'number' && Number.isFinite(obj.sleepQuality)
        ? Math.max(0, Math.min(100, Math.round(obj.sleepQuality)))
        : 75;
    const hrvMs =
      typeof obj.hrvMs === 'number' && Number.isFinite(obj.hrvMs)
        ? Math.max(15, Math.min(150, Math.round(obj.hrvMs)))
        : 48;
    const restingHr =
      typeof obj.restingHr === 'number' && Number.isFinite(obj.restingHr)
        ? Math.max(40, Math.min(120, Math.round(obj.restingHr)))
        : 64;
    const steps =
      typeof obj.steps === 'number' && Number.isFinite(obj.steps)
        ? Math.max(0, Math.round(obj.steps))
        : 7200;

    const rawWins = (obj.windows && typeof obj.windows === 'object'
      ? obj.windows
      : {}) as Record<string, Record<string, unknown>>;

    const makeSafeWin = (w: DayWindow) => {
      const rw = rawWins[w];
      const wHrv =
        rw && typeof rw.hrvMs === 'number' && Number.isFinite(rw.hrvMs)
          ? Math.max(15, Math.min(150, Math.round(rw.hrvMs)))
          : hrvMs;
      const wRhr =
        rw && typeof rw.restingHr === 'number' && Number.isFinite(rw.restingHr)
          ? Math.max(40, Math.min(120, Math.round(rw.restingHr)))
          : restingHr;
      const wSteps =
        rw && typeof rw.steps === 'number' && Number.isFinite(rw.steps)
          ? Math.max(0, Math.round(rw.steps))
          : Math.round(steps * 0.25);
      const status: 'Optimal HRV' | 'Balanced' | 'Strained' =
        rw?.recoveryStatus === 'Optimal HRV' ||
        rw?.recoveryStatus === 'Balanced' ||
        rw?.recoveryStatus === 'Strained'
          ? rw.recoveryStatus
          : wHrv >= 49
            ? 'Optimal HRV'
            : wHrv >= 41
              ? 'Balanced'
              : 'Strained';
      return { window: w, hrvMs: wHrv, restingHr: wRhr, steps: wSteps, recoveryStatus: status };
    };

    cleaned.push({
      dateKey: obj.dateKey,
      sleepHours,
      sleepQuality,
      hrvMs,
      restingHr,
      steps,
      optimalHrv:
        typeof obj.optimalHrv === 'boolean'
          ? obj.optimalHrv
          : hrvMs >= 48 && sleepQuality >= 76,
      windows: {
        morn: makeSafeWin('morn'),
        mid: makeSafeWin('mid'),
        aft: makeSafeWin('aft'),
        eve: makeSafeWin('eve'),
      },
    });
  }
  return cleaned.length > 0 ? cleaned : null;
}

export function sanitizeRoutines(raw: unknown): ScheduledRoutine[] | null {
  if (!Array.isArray(raw)) return null;
  const cleaned: ScheduledRoutine[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : null;
    if (!name) continue;
    const rawSteps = Array.isArray(obj.steps) ? obj.steps : [];
    const steps = rawSteps
      .map((s) => {
        if (!s || typeof s !== 'object') return null;
        const so = s as Record<string, unknown>;
        if (typeof so.protocolId !== 'string' || !VALID_PROTOCOL_IDS.has(so.protocolId)) {
          return null;
        }
        const durationMin =
          typeof so.durationMin === 'number' &&
          Number.isFinite(so.durationMin) &&
          so.durationMin > 0
            ? Math.max(1, Math.min(30, Math.round(so.durationMin)))
            : 2;
        return { protocolId: so.protocolId, durationMin };
      })
      .filter((x): x is { protocolId: string; durationMin: number } => x !== null);
    if (steps.length === 0) continue;

    const baseId =
      typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `routine-${i}-${Date.now()}`;
    let uniqueId = baseId;
    if (seenIds.has(uniqueId)) {
      let suffix = 2;
      while (seenIds.has(`${baseId}-${suffix}`)) suffix += 1;
      uniqueId = `${baseId}-${suffix}`;
    }
    seenIds.add(uniqueId);

    cleaned.push({
      id: uniqueId,
      name,
      time: typeof obj.time === 'string' && /^\d{2}:\d{2}$/.test(obj.time) ? obj.time : '14:00',
      timeLabel: typeof obj.timeLabel === 'string' && obj.timeLabel ? obj.timeLabel : '2:00 PM',
      weekdays: Array.isArray(obj.weekdays)
        ? obj.weekdays.filter((d): d is string => typeof d === 'string')
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      weekdayLabel:
        typeof obj.weekdayLabel === 'string' && obj.weekdayLabel ? obj.weekdayLabel : 'Mon–Fri',
      steps,
      enabled: typeof obj.enabled === 'boolean' ? obj.enabled : true,
    });
  }
  return cleaned.length > 0 || raw.length === 0 ? cleaned : INITIAL_ROUTINES;
}

export function sanitizeNudges(raw: unknown): NudgeWindow[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const cleaned: NudgeWindow[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.title !== 'string' || !obj.title.trim()) continue;

    const baseId = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `nudge-${i}`;
    let uniqueId = baseId;
    if (seenIds.has(uniqueId)) {
      let suffix = 2;
      while (seenIds.has(`${baseId}-${suffix}`)) suffix += 1;
      uniqueId = `${baseId}-${suffix}`;
    }
    seenIds.add(uniqueId);

    cleaned.push({
      id: uniqueId,
      time: typeof obj.time === 'string' ? obj.time : '09:00',
      timeLabel: typeof obj.timeLabel === 'string' ? obj.timeLabel : '9:00 AM',
      title: obj.title.trim(),
      historicalBasis:
        typeof obj.historicalBasis === 'string' ? obj.historicalBasis : 'Based on local logs',
      avgScore: typeof obj.avgScore === 'number' && Number.isFinite(obj.avgScore) ? obj.avgScore : 2.8,
      enabled: typeof obj.enabled === 'boolean' ? obj.enabled : true,
    });
  }
  return cleaned.length > 0 ? cleaned : INITIAL_NUDGES;
}

export function sanitizeSettings(raw: unknown): AppSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const theme =
    obj.theme === 'light' || obj.theme === 'dark' || obj.theme === 'system'
      ? obj.theme
      : DEFAULT_SETTINGS.theme;
  return {
    theme,
    highContrast: typeof obj.highContrast === 'boolean' ? obj.highContrast : false,
    reduceMotion: typeof obj.reduceMotion === 'boolean' ? obj.reduceMotion : false,
    reduceTransparency:
      typeof obj.reduceTransparency === 'boolean' ? obj.reduceTransparency : false,
    calmMode: typeof obj.calmMode === 'boolean' ? obj.calmMode : false,
    readingComfort: typeof obj.readingComfort === 'boolean' ? obj.readingComfort : false,
    focusMode: typeof obj.focusMode === 'boolean' ? obj.focusMode : false,
    patternAssist: typeof obj.patternAssist === 'boolean' ? obj.patternAssist : false,
    plainLanguage: typeof obj.plainLanguage === 'boolean' ? obj.plainLanguage : false,
    dndEnabled: typeof obj.dndEnabled === 'boolean' ? obj.dndEnabled : false,
    watchConnected: typeof obj.watchConnected === 'boolean' ? obj.watchConnected : true,
    watchLastSync:
      typeof obj.watchLastSync === 'string' && !Number.isNaN(Date.parse(obj.watchLastSync))
        ? obj.watchLastSync
        : new Date().toISOString(),
    breathingStreak:
      typeof obj.breathingStreak === 'number' && Number.isFinite(obj.breathingStreak) && obj.breathingStreak >= 0
        ? Math.round(obj.breathingStreak)
        : DEFAULT_SETTINGS.breathingStreak,
  };
}

export function sanitizeCoachMessages(raw: unknown): CoachMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const cleaned: CoachMessage[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if ((obj.role !== 'user' && obj.role !== 'assistant') || typeof obj.content !== 'string') {
      continue;
    }
    const baseId = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `msg-${i}`;
    let uniqueId = baseId;
    if (seenIds.has(uniqueId)) {
      let suffix = 2;
      while (seenIds.has(`${baseId}-${suffix}`)) suffix += 1;
      uniqueId = `${baseId}-${suffix}`;
    }
    seenIds.add(uniqueId);

    cleaned.push({
      id: uniqueId,
      role: obj.role,
      content: obj.content,
      timestamp:
        typeof obj.timestamp === 'string' && !Number.isNaN(Date.parse(obj.timestamp))
          ? obj.timestamp
          : new Date().toISOString(),
      citations: Array.isArray(obj.citations)
        ? obj.citations.filter((c): c is string => typeof c === 'string')
        : undefined,
      isError: typeof obj.isError === 'boolean' ? obj.isError : undefined,
    });
  }
  return cleaned;
}
