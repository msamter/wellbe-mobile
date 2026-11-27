export type AppTab = 'today' | 'routines' | 'log' | 'trends' | 'coach';

export type EmotionQuadrant = 'yellow' | 'green' | 'balanced' | 'blue' | 'red';

export type MoodBucket = 'happy' | 'calm' | 'steady' | 'low' | 'upset';

export type DayWindow = 'morn' | 'mid' | 'aft' | 'eve';

export type ContextTag = 'Rest' | 'Work' | 'Social' | 'Movement' | 'Focus' | 'Sleep';

export interface EmotionDef {
  id: string;
  label: string;
  quadrant: EmotionQuadrant;
  quadrantLabel: 'Yellow' | 'Green' | 'Balanced' | 'Blue' | 'Red';
  bucket: MoodBucket;
  score: number; // 1.0 to 5.0
  energy: 'high' | 'low' | 'neutral';
  pleasantness: 'pleasant' | 'unpleasant' | 'neutral';
  suggestedProtocolId: string;
  /** Concise one-line everyday definition */
  definition: string;
  /** Ultra-clear plain-language definition for Plain Language mode */
  plainDefinition: string;
  /** 2–3 concrete, scannable bodily signals */
  physicalCues: [string, string, string];
}

export interface MoodEntry {
  id: string;
  timestamp: string; // ISO string
  dateKey: string; // YYYY-MM-DD local
  emotionId: string;
  emotionLabel: string;
  quadrant: EmotionQuadrant;
  quadrantLabel: 'Yellow' | 'Green' | 'Balanced' | 'Blue' | 'Red';
  bucket: MoodBucket;
  score: number;
  tags: ContextTag[];
  note: string;
  source: 'app' | 'watch';
  dayWindow: DayWindow;
  /** Optional 5-second compound blend partner (Emotion A + Emotion B) */
  isBlended?: boolean;
  secondaryEmotionId?: string;
  secondaryEmotion?: string;
  secondaryEmotionLabel?: string;
  secondaryQuadrant?: EmotionQuadrant;
  secondaryQuadrantLabel?: 'Yellow' | 'Green' | 'Balanced' | 'Blue' | 'Red';
  secondaryBucket?: MoodBucket;
}

export interface WindowBiometric {
  window: DayWindow;
  hrvMs: number;
  restingHr: number;
  steps: number;
  recoveryStatus: 'Optimal HRV' | 'Balanced' | 'Strained';
}

export interface DailyBiometrics {
  dateKey: string; // YYYY-MM-DD
  sleepHours: number;
  sleepQuality: number; // 0-100
  hrvMs: number;
  restingHr: number;
  steps: number;
  optimalHrv: boolean;
  windows: Record<DayWindow, WindowBiometric>;
}

export type ProtocolType =
  | 'breathing'
  | 'stretch'
  | 'grounding'
  | 'savoring'
  | 'gratitude'
  | 'panic';

export interface ResetProtocol {
  id: string;
  title: string;
  shortTitle: string;
  durationMin: number;
  durationLabel: string;
  targetState: string;
  summary: string;
  scienceNote: string;
  type: ProtocolType;
  ctaLabel: string;
  steps: string[];
}

export interface RoutineStepItem {
  protocolId: string;
  durationMin: number;
}

export interface ScheduledRoutine {
  id: string;
  name: string;
  time: string; // e.g. "14:00"
  timeLabel: string; // e.g. "2:00 PM"
  weekdays: string[]; // ['Mon', 'Tue', ...]
  weekdayLabel: string; // e.g. "Mon–Fri"
  steps: RoutineStepItem[];
  enabled: boolean;
}

export interface NudgeWindow {
  id: string;
  time: string; // e.g. "09:00"
  timeLabel: string; // e.g. "9:00 AM"
  title: string;
  historicalBasis: string;
  avgScore: number;
  enabled: boolean;
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  highContrast: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  calmMode: boolean;
  readingComfort: boolean;
  focusMode: boolean;
  patternAssist: boolean;
  plainLanguage: boolean;
  dndEnabled: boolean;
  watchConnected: boolean;
  watchLastSync: string; // ISO string
  breathingStreak: number;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: string[];
  isError?: boolean;
}
