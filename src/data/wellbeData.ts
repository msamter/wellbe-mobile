import {
  AppSettings,
  ContextTag,
  DailyBiometrics,
  DayWindow,
  EmotionDef,
  MoodBucket,
  MoodEntry,
  NudgeWindow,
  ResetProtocol,
  ScheduledRoutine,
} from '../types/wellbe';

export const CONTEXT_TAGS: ContextTag[] = [
  'Rest',
  'Work',
  'Social',
  'Movement',
  'Focus',
  'Sleep',
];

export const MOOD_BUCKETS: Array<{
  id: MoodBucket;
  label: string;
  shortLabel: string;
  quadrant: EmotionDef['quadrant'];
}> = [
  { id: 'happy', label: 'Happy / Joyful', shortLabel: 'Joyful', quadrant: 'yellow' },
  { id: 'calm', label: 'Calm / Content', shortLabel: 'Calm', quadrant: 'green' },
  { id: 'steady', label: 'Steady / Neutral', shortLabel: 'Steady', quadrant: 'balanced' },
  { id: 'low', label: 'Low / Drained', shortLabel: 'Low', quadrant: 'blue' },
  { id: 'upset', label: 'Upset / Stressed', shortLabel: 'Stressed', quadrant: 'red' },
];

export const DAY_WINDOWS: Array<{
  id: DayWindow;
  shortLabel: string;
  fullLabel: string;
  rangeLabel: string;
}> = [
  { id: 'morn', shortLabel: 'Morn', fullLabel: 'Morning', rangeLabel: '6:00 AM – 11:59 AM' },
  { id: 'mid', shortLabel: 'Mid', fullLabel: 'Midday', rangeLabel: '12:00 PM – 3:59 PM' },
  { id: 'aft', shortLabel: 'Aft', fullLabel: 'Afternoon', rangeLabel: '4:00 PM – 7:59 PM' },
  { id: 'eve', shortLabel: 'Eve', fullLabel: 'Evening', rangeLabel: '8:00 PM – 11:59 PM' },
];

/**
 * 16-Emotion Circumplex Matrix (4x4)
 * Order preserved for quadrant grouping:
 * Yellow (High-Energy Pleasant), Green (Low-Energy Pleasant),
 * Blue (Low-Energy Unpleasant), Red (High-Energy Unpleasant)
 */
export const EMOTIONS_16: EmotionDef[] = [
  // Yellow Quadrant — High-Energy Pleasant
  {
    id: 'ecstatic',
    label: 'Ecstatic',
    quadrant: 'yellow',
    quadrantLabel: 'Yellow',
    bucket: 'happy',
    score: 5.0,
    energy: 'high',
    pleasantness: 'pleasant',
    suggestedProtocolId: 'savoring',
    definition: 'Bursting with vivid excitement, delight, and unmistakable joy.',
    plainDefinition: 'Feeling super happy and full of bright energy.',
    physicalCues: ['Bright chest warmth', 'Bouncy energy', 'Wide smile'],
  },
  {
    id: 'joyful',
    label: 'Joyful',
    quadrant: 'yellow',
    quadrantLabel: 'Yellow',
    bucket: 'happy',
    score: 4.7,
    energy: 'high',
    pleasantness: 'pleasant',
    suggestedProtocolId: 'gratitude',
    definition: 'Bright, uplifted happiness that feels open and easy to share.',
    plainDefinition: 'Feeling genuinely happy, warm, and light inside.',
    physicalCues: ['Warm chest', 'Easy smile', 'Loose shoulders'],
  },
  {
    id: 'energized',
    label: 'Energized',
    quadrant: 'yellow',
    quadrantLabel: 'Yellow',
    bucket: 'happy',
    score: 4.4,
    energy: 'high',
    pleasantness: 'pleasant',
    suggestedProtocolId: 'savoring',
    definition: 'Charged with lively momentum and ready to move or create.',
    plainDefinition: 'Feeling awake, charged up, and ready to get things done.',
    physicalCues: ['Quick pulse', 'Alert posture', 'Restless hands'],
  },
  {
    id: 'inspired',
    label: 'Inspired',
    quadrant: 'yellow',
    quadrantLabel: 'Yellow',
    bucket: 'happy',
    score: 4.5,
    energy: 'high',
    pleasantness: 'pleasant',
    suggestedProtocolId: 'gratitude',
    definition: 'Sparked with fresh curiosity and excited to explore new ideas.',
    plainDefinition: 'Feeling excited by a new idea and eager to try it.',
    physicalCues: ['Sparked focus', 'Lifted chest', 'Forward lean'],
  },

  // Green Quadrant — Low-Energy Pleasant
  {
    id: 'grateful',
    label: 'Grateful',
    quadrant: 'green',
    quadrantLabel: 'Green',
    bucket: 'calm',
    score: 4.3,
    energy: 'low',
    pleasantness: 'pleasant',
    suggestedProtocolId: 'gratitude',
    definition: 'Warm appreciation for someone, something, or a quiet good moment.',
    plainDefinition: 'Feeling thankful and noticing what is going well.',
    physicalCues: ['Warm chest', 'Soft eyes', 'Easy exhale'],
  },
  {
    id: 'calm',
    label: 'Calm',
    quadrant: 'green',
    quadrantLabel: 'Green',
    bucket: 'calm',
    score: 4.1,
    energy: 'low',
    pleasantness: 'pleasant',
    suggestedProtocolId: 'savoring',
    definition: 'Peaceful and unhurried, with your mind and body at ease.',
    plainDefinition: 'Feeling quiet, safe, and relaxed with no rush.',
    physicalCues: ['Unclenched jaw', 'Steady breath', 'Heavy shoulders'],
  },
  {
    id: 'content',
    label: 'Content',
    quadrant: 'green',
    quadrantLabel: 'Green',
    bucket: 'calm',
    score: 3.9,
    energy: 'low',
    pleasantness: 'pleasant',
    suggestedProtocolId: 'grounding',
    definition: 'Quietly satisfied with things just as they are right now.',
    plainDefinition: 'Feeling good enough right where you are today.',
    physicalCues: ['Settled stomach', 'Relaxed brow', 'Unrushed breath'],
  },
  {
    id: 'rested',
    label: 'Rested',
    quadrant: 'green',
    quadrantLabel: 'Green',
    bucket: 'steady',
    score: 3.6,
    energy: 'low',
    pleasantness: 'pleasant',
    suggestedProtocolId: 'grounding',
    definition: 'Refreshed and restored after sleep, pause, or gentle recovery.',
    plainDefinition: 'Feeling recharged and clear-headed after resting.',
    physicalCues: ['Clear head', 'Loose limbs', 'Even heartbeat'],
  },

  // Blue Quadrant — Low-Energy Unpleasant
  {
    id: 'tired',
    label: 'Tired',
    quadrant: 'blue',
    quadrantLabel: 'Blue',
    bucket: 'low',
    score: 2.5,
    energy: 'low',
    pleasantness: 'unpleasant',
    suggestedProtocolId: 'stretch',
    definition: 'Low on physical or mental fuel and ready to slow down.',
    plainDefinition: 'Running low on energy and needing a break or sleep.',
    physicalCues: ['Heavy eyelids', 'Slowed limbs', 'Frequent yawning'],
  },
  {
    id: 'drained',
    label: 'Drained',
    quadrant: 'blue',
    quadrantLabel: 'Blue',
    bucket: 'low',
    score: 2.1,
    energy: 'low',
    pleasantness: 'unpleasant',
    suggestedProtocolId: 'stretch',
    definition: 'Running on empty after sustained effort, strain, or emotional load.',
    plainDefinition: 'Feeling totally worn out with very little left to give.',
    physicalCues: ['Empty energy', 'Slumped posture', 'Foggy focus'],
  },
  {
    id: 'sad',
    label: 'Sad',
    quadrant: 'blue',
    quadrantLabel: 'Blue',
    bucket: 'low',
    score: 1.9,
    energy: 'low',
    pleasantness: 'unpleasant',
    suggestedProtocolId: 'grounding',
    definition: 'A heavy ache from loss, disappointment, or feeling let down.',
    plainDefinition: 'Feeling down, hurt, or heavy-hearted right now.',
    physicalCues: ['Heavy chest', 'Throat tightness', 'Slowed pace'],
  },
  {
    id: 'lonely',
    label: 'Lonely',
    quadrant: 'blue',
    quadrantLabel: 'Blue',
    bucket: 'low',
    score: 1.8,
    energy: 'low',
    pleasantness: 'unpleasant',
    suggestedProtocolId: 'grounding',
    definition: 'Longing for closer connection, understanding, or company.',
    plainDefinition: 'Feeling disconnected and wishing someone were closer.',
    physicalCues: ['Hollow chest', 'Quiet restlessness', 'Slumped shoulders'],
  },

  // Red Quadrant — High-Energy Unpleasant
  {
    id: 'anxious',
    label: 'Anxious',
    quadrant: 'red',
    quadrantLabel: 'Red',
    bucket: 'upset',
    score: 2.0,
    energy: 'high',
    pleasantness: 'unpleasant',
    suggestedProtocolId: 'breathing',
    definition: 'On edge and braced for what might go wrong next.',
    plainDefinition: 'Feeling worried, jittery, and hard to settle down.',
    physicalCues: ['Fluttering stomach', 'Racing heart', 'Tense jaw'],
  },
  {
    id: 'stressed',
    label: 'Stressed',
    quadrant: 'red',
    quadrantLabel: 'Red',
    bucket: 'upset',
    score: 1.8,
    energy: 'high',
    pleasantness: 'unpleasant',
    suggestedProtocolId: 'breathing',
    definition: 'Stretched thin under pressure, deadlines, or competing demands.',
    plainDefinition: 'Feeling wound up because too much is pulling on you.',
    physicalCues: ['Raised shoulders', 'Tight neck', 'Short breaths'],
  },
  {
    id: 'frustrated',
    label: 'Frustrated',
    quadrant: 'red',
    quadrantLabel: 'Red',
    bucket: 'upset',
    score: 2.1,
    energy: 'high',
    pleasantness: 'unpleasant',
    suggestedProtocolId: 'breathing',
    definition: 'Blocked or irritated when things are not moving as expected.',
    plainDefinition: 'Feeling stuck and annoyed that something is not working.',
    physicalCues: ['Clenched jaw', 'Hot face', 'Tight hands'],
  },
  {
    id: 'overwhelmed',
    label: 'Overwhelmed',
    quadrant: 'red',
    quadrantLabel: 'Red',
    bucket: 'upset',
    score: 1.5,
    energy: 'high',
    pleasantness: 'unpleasant',
    suggestedProtocolId: 'breathing',
    definition: 'Flooded by more demands or feelings than you can hold at once.',
    plainDefinition: 'Feeling like everything is coming at you all at once.',
    physicalCues: ['Tight chest', 'Scattered focus', 'Shallow breath'],
  },
];

export const STEADY_EMOTION: EmotionDef = {
  id: 'steady',
  label: 'Steady',
  quadrant: 'balanced',
  quadrantLabel: 'Balanced',
  bucket: 'steady',
  score: 3.4,
  energy: 'neutral',
  pleasantness: 'neutral',
  suggestedProtocolId: 'grounding',
  definition: 'Even-keeled and grounded, moving through the moment without big swings.',
  plainDefinition: 'Feeling balanced and okay—not too high, not too low.',
  physicalCues: ['Even breath', 'Neutral posture', 'Grounded feet'],
};

export const ALL_EMOTIONS_MAP: Record<string, EmotionDef> = [
  ...EMOTIONS_16,
  STEADY_EMOTION,
].reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<string, EmotionDef>
);

export const RESET_PROTOCOLS: ResetProtocol[] = [
  {
    id: 'breathing',
    title: '4-7-8 Calm Breathing',
    shortTitle: '4-7-8 Calm Breathing',
    durationMin: 2,
    durationLabel: '2 min',
    targetState: 'For Upset',
    summary:
      'Extended exhalation cadence (4s inhale, 7s hold, 8s exhale) activates vagal tone and lowers acute sympathetic arousal.',
    scienceNote:
      'Longer exhales stimulate the parasympathetic vagus nerve, measurably slowing heart rate within 4 respiratory cycles.',
    type: 'breathing',
    ctaLabel: 'Start 4-7-8 Breathing',
    steps: [
      'Sit upright with shoulders dropped away from your ears.',
      'Inhale quietly through your nose for 4 seconds.',
      'Hold your breath gently for 7 seconds without tension.',
      'Exhale steadily through pursed lips for 8 seconds.',
    ],
  },
  {
    id: 'stretch',
    title: 'Sunlight & Stretch',
    shortTitle: 'Sunlight & Stretch',
    durationMin: 5,
    durationLabel: '5 min',
    targetState: 'For Low Energy',
    summary:
      'Step near natural light while cycling through gentle thoracic openers and shoulder releases to counter sluggishness.',
    scienceNote:
      'Natural daylight exposure paired with mild proprioceptive movement boosts alertness without elevating cortisol.',
    type: 'stretch',
    ctaLabel: 'Start Sunlight & Stretch',
    steps: [
      'Face a window or step outside toward ambient daylight.',
      'Roll your shoulders slowly backward 6 times with full inhales.',
      'Interlace fingers overhead and lengthen through both side ribs.',
      'Gently rotate neck ear-to-shoulder, holding 15 seconds per side.',
      'Finish with 30 seconds of relaxed standing and natural breathing.',
    ],
  },
  {
    id: 'grounding',
    title: 'Mindful Grounding Scan',
    shortTitle: 'Mindful Grounding Scan',
    durationMin: 3,
    durationLabel: '3 min',
    targetState: 'For Steady',
    summary:
      'Structured 5-4-3-2-1 sensory orientation anchored to sight, touch, sound, scent, and physical steadiness.',
    scienceNote:
      'Shifting attention to external sensory data interrupts rumination loops and stabilizes prefrontal focus.',
    type: 'grounding',
    ctaLabel: 'Start Grounding Scan',
    steps: [
      '5 things you can see right now — note shapes, light, and edges.',
      '4 textures you can physically feel against skin or feet.',
      '3 distinct ambient sounds in the near or far background.',
      '2 subtle scents or qualities of the air around you.',
      '1 deliberate full exhale, noticing the weight of your body supported.',
    ],
  },
  {
    id: 'savoring',
    title: 'Savoring Ritual',
    shortTitle: 'Savoring Ritual',
    durationMin: 2,
    durationLabel: '2 min',
    targetState: 'For Calm',
    summary:
      'Deliberately linger on one restorative micro-moment from today to consolidate positive emotional memory.',
    scienceNote:
      'Holding a pleasant experience in awareness for 20+ seconds strengthens neural pathways for emotional resilience.',
    type: 'savoring',
    ctaLabel: 'Start Savoring Ritual',
    steps: [
      'Recall one quiet or rewarding moment from the last 12 hours.',
      'Notice where that warmth or relief registers in your chest or shoulders.',
      'Breathe naturally and let the feeling stay present for 30 unhurried seconds.',
      'Name one small detail you want to remember about this moment.',
    ],
  },
  {
    id: 'gratitude',
    title: 'Gratitude Capture',
    shortTitle: 'Gratitude Capture',
    durationMin: 2,
    durationLabel: '1–2 min',
    targetState: 'For Happy',
    summary:
      'Record one specific person, anchor, or small win in a single sentence — saved directly into your local Mood Log.',
    scienceNote:
      'Specific, concrete gratitude notes correlate with improved evening sleep onset and sustained baseline mood.',
    type: 'gratitude',
    ctaLabel: 'Open Gratitude Capture',
    steps: [
      'Identify one concrete thing that supported you today.',
      'Write why it mattered in 1–2 honest sentences.',
      'Save it directly to your local WELLBE+ Mood Log.',
    ],
  },
  {
    id: 'panic',
    title: 'Voice Panic Anchor',
    shortTitle: 'Voice Panic Anchor',
    durationMin: 2,
    durationLabel: '2 min',
    targetState: 'For High-Energy Unpleasant',
    summary:
      'Slow 4-4-6 voice-paced breathing and steady visual orientation to settle racing heart rate, anxiety spikes, or acute overwhelm.',
    scienceNote:
      'Coordinated vocal pacing and extended 6-second exhales engage the vagal brake to down-regulate acute sympathetic arousal.',
    type: 'panic',
    ctaLabel: 'Start Voice Panic Anchor',
    steps: [
      'Plant both feet flat on the floor and unclench your jaw.',
      'Inhale smoothly through your nose for 4 seconds.',
      'Hold gently for 4 seconds without straining.',
      'Exhale slowly for 6 seconds while letting your shoulders drop.',
    ],
  },
];

export const INITIAL_ROUTINES: ScheduledRoutine[] = [
  {
    id: 'routine-midday',
    name: 'Midday Decompression',
    time: '14:00',
    timeLabel: '2:00 PM',
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    weekdayLabel: 'Mon–Fri',
    enabled: true,
    steps: [
      { protocolId: 'breathing', durationMin: 2 },
      { protocolId: 'stretch', durationMin: 3 },
    ],
  },
  {
    id: 'routine-evening',
    name: 'Evening Wind-Down',
    time: '20:30',
    timeLabel: '8:30 PM',
    weekdays: ['Mon', 'Wed', 'Fri', 'Sun'],
    weekdayLabel: 'Mon, Wed, Fri, Sun',
    enabled: true,
    steps: [
      { protocolId: 'grounding', durationMin: 3 },
      { protocolId: 'savoring', durationMin: 2 },
    ],
  },
];

export const INITIAL_NUDGES: NudgeWindow[] = [
  {
    id: 'nudge-morning',
    time: '09:00',
    timeLabel: '9:00 AM',
    title: 'Morning Energy Dip',
    historicalBasis: 'Based on 2.8/5.0 avg across 4 morning logs',
    avgScore: 2.8,
    enabled: true,
  },
  {
    id: 'nudge-afternoon',
    time: '15:30',
    timeLabel: '3:30 PM',
    title: 'Late-Afternoon Slump',
    historicalBasis: 'Based on 2.9/5.0 avg across 5 afternoon logs',
    avgScore: 2.9,
    enabled: true,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  highContrast: false,
  reduceMotion: false,
  reduceTransparency: false,
  calmMode: false,
  readingComfort: false,
  focusMode: false,
  patternAssist: false,
  plainLanguage: false,
  dndEnabled: false,
  watchConnected: true,
  watchLastSync: new Date().toISOString(),
  breathingStreak: 4,
};

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDayWindowFromHour(hour: number): DayWindow {
  if (hour < 12) return 'morn';
  if (hour < 16) return 'mid';
  if (hour < 20) return 'aft';
  return 'eve';
}

function makeTimestamp(daysAgo: number, hour: number, minute: number): { iso: string; dateKey: string } {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return { iso: d.toISOString(), dateKey: toLocalDateKey(d) };
}

/**
 * Generates realistic, clinically coherent 30-day mood entries and Pixel Watch biometrics
 * anchored to today so all 7D/30D analytics, D3 7x4 heatmap cells, correlation cards,
 * and ranked context triggers work richly immediately on load.
 */
export function buildSeedData(): { entries: MoodEntry[]; biometrics: DailyBiometrics[] } {
  const entries: MoodEntry[] = [];
  const biometrics: DailyBiometrics[] = [];

  const pushEntry = (
    daysAgo: number,
    hour: number,
    minute: number,
    emotionId: string,
    tags: ContextTag[],
    note: string,
    source: 'app' | 'watch' = 'app'
  ) => {
    const def = ALL_EMOTIONS_MAP[emotionId] ?? STEADY_EMOTION;
    const { iso, dateKey } = makeTimestamp(daysAgo, hour, minute);
    entries.push({
      id: `seed-${daysAgo}-${hour}-${minute}-${emotionId}`,
      timestamp: iso,
      dateKey,
      emotionId: def.id,
      emotionLabel: def.label,
      quadrant: def.quadrant,
      quadrantLabel: def.quadrantLabel,
      bucket: def.bucket,
      score: def.score,
      tags,
      note,
      source,
      dayWindow: getDayWindowFromHour(hour),
    });
  };

  // Last 7 days (daysAgo = 6 down to 0) — Rich multi-window logs for 7x4 heatmap
  // Day 6 ago
  pushEntry(6, 9, 10, 'tired', ['Sleep', 'Work'], 'Slow start after staying up late finishing slides.', 'watch');
  pushEntry(6, 13, 25, 'steady', ['Focus', 'Work'], 'Found a rhythm after lunch and two deep-work blocks.', 'watch');
  pushEntry(6, 17, 45, 'calm', ['Movement', 'Rest'], '25-minute brisk walk outside cleared the fog.', 'app');
  pushEntry(6, 21, 15, 'content', ['Rest', 'Social'], 'Cooked dinner and talked with Maya on the phone.', 'app');

  // Day 5 ago
  pushEntry(5, 8, 45, 'rested', ['Sleep', 'Rest'], 'Solid 7.6 hours of sleep; woke before the alarm.', 'watch');
  pushEntry(5, 12, 50, 'energized', ['Focus', 'Movement'], 'Morning mobility session carried cleanly into design reviews.', 'app');
  pushEntry(5, 16, 40, 'joyful', ['Social', 'Work'], 'Great feedback from the team on the prototype walkthrough.', 'app');
  pushEntry(5, 20, 55, 'grateful', ['Rest', 'Social'], 'Quiet evening reading with chamomile tea.', 'app');

  // Day 4 ago
  pushEntry(4, 9, 20, 'anxious', ['Work', 'Focus'], 'Back-to-back sprint planning meetings stacked all morning.', 'app');
  pushEntry(4, 14, 15, 'stressed', ['Work'], 'Tight deadline shift; noticed jaw clenching during calls.', 'watch');
  pushEntry(4, 17, 30, 'steady', ['Movement', 'Rest'], 'Did 4-7-8 breathing and stretched by the window.', 'app');
  pushEntry(4, 21, 10, 'tired', ['Sleep', 'Work'], 'Ready for an early lights-out tonight.', 'watch');

  // Day 3 ago
  pushEntry(3, 8, 55, 'drained', ['Sleep', 'Work'], 'Woke up twice overnight; energy feels muted.', 'watch');
  pushEntry(3, 13, 10, 'frustrated', ['Work', 'Focus'], 'Context-switching between three threads slowed progress.', 'app');
  pushEntry(3, 18, 5, 'calm', ['Movement', 'Social'], 'Evening yoga class helped reset my shoulders.', 'app');
  pushEntry(3, 21, 30, 'rested', ['Rest', 'Sleep'], 'Screens off by 9 PM, felt much more settled.', 'app');

  // Day 2 ago
  pushEntry(2, 9, 5, 'calm', ['Sleep', 'Rest'], 'Restorative night; heart rate settled nicely.', 'watch');
  pushEntry(2, 13, 40, 'inspired', ['Focus', 'Work'], 'Deep uninterrupted 90-minute creative session.', 'app');
  pushEntry(2, 17, 20, 'joyful', ['Social', 'Movement'], 'Met friends for a sunset walk by the park.', 'app');
  pushEntry(2, 20, 50, 'grateful', ['Rest', 'Social'], 'Grateful for unhurried conversation and clear air.', 'app');

  // Day 1 ago (Yesterday)
  pushEntry(1, 9, 15, 'steady', ['Sleep', 'Focus'], 'Neutral start; easing into the inbox slowly.', 'watch');
  pushEntry(1, 14, 20, 'stressed', ['Work', 'Focus'], 'Afternoon budget review ran long and spiked tension.', 'app');
  pushEntry(1, 17, 50, 'content', ['Movement', 'Rest'], 'Took a 20-minute decompressing walk without headphones.', 'app');
  pushEntry(1, 21, 20, 'calm', ['Rest', 'Sleep'], 'Completed Evening Wind-Down sequence before bed.', 'app');

  // Day 0 (Today)
  pushEntry(0, 8, 35, 'rested', ['Sleep', 'Rest'], 'Woke feeling clear-headed after 7.4h sleep.', 'watch');
  pushEntry(0, 10, 10, 'steady', ['Focus', 'Work'], 'Settled into morning planning with steady pacing.', 'app');

  // Days 7 to 29 ago (for 30D analytics richness)
  const historicalTemplates: Array<{
    emotionId: string;
    tags: ContextTag[];
    note: string;
    source: 'app' | 'watch';
    hour: number;
  }> = [
    { emotionId: 'calm', tags: ['Rest', 'Sleep'], note: 'Quiet morning before notifications started.', source: 'app', hour: 9 },
    { emotionId: 'energized', tags: ['Movement', 'Focus'], note: 'Strong post-run clarity during morning work.', source: 'watch', hour: 11 },
    { emotionId: 'stressed', tags: ['Work'], note: 'Dense calendar afternoon without breaks.', source: 'app', hour: 15 },
    { emotionId: 'grateful', tags: ['Social', 'Rest'], note: 'Good catch-up call with family.', source: 'app', hour: 20 },
    { emotionId: 'tired', tags: ['Sleep', 'Work'], note: 'Short sleep window showed up by mid-afternoon.', source: 'watch', hour: 16 },
    { emotionId: 'joyful', tags: ['Social', 'Movement'], note: 'Weekend trail hike in crisp weather.', source: 'app', hour: 13 },
    { emotionId: 'steady', tags: ['Focus', 'Rest'], note: 'Balanced energy across tasks.', source: 'watch', hour: 14 },
    { emotionId: 'anxious', tags: ['Work', 'Focus'], note: 'Pre-presentation jitters eased after breathing reset.', source: 'app', hour: 10 },
    { emotionId: 'content', tags: ['Rest', 'Sleep'], note: 'Slow evening routine paid off.', source: 'app', hour: 21 },
  ];

  for (let d = 7; d < 30; d++) {
    const t1 = historicalTemplates[d % historicalTemplates.length];
    const t2 = historicalTemplates[(d + 4) % historicalTemplates.length];
    pushEntry(d, t1.hour, 15, t1.emotionId, t1.tags, t1.note, t1.source);
    if (d % 2 === 0) {
      pushEntry(d, (t2.hour + 6) % 22 || 19, 30, t2.emotionId, t2.tags, t2.note, t2.source);
    }
  }

  // Biometric series for 30 days (index 0 = 29 days ago ... index 29 = today)
  // Carefully crafted for last 7 days so Sleep, HRV, RHR, Steps correlate realistically
  const last7Bio: Array<{
    sleepHours: number;
    sleepQuality: number;
    hrvMs: number;
    restingHr: number;
    steps: number;
  }> = [
    { sleepHours: 6.4, sleepQuality: 68, hrvMs: 42, restingHr: 68, steps: 6420 }, // 6 days ago
    { sleepHours: 7.7, sleepQuality: 86, hrvMs: 56, restingHr: 61, steps: 9480 }, // 5 days ago (Optimal HRV)
    { sleepHours: 6.1, sleepQuality: 62, hrvMs: 37, restingHr: 72, steps: 5120 }, // 4 days ago (Stress spike)
    { sleepHours: 6.5, sleepQuality: 66, hrvMs: 40, restingHr: 70, steps: 7180 }, // 3 days ago
    { sleepHours: 7.9, sleepQuality: 89, hrvMs: 58, restingHr: 60, steps: 10240 }, // 2 days ago (Peak Sync Day)
    { sleepHours: 7.1, sleepQuality: 78, hrvMs: 49, restingHr: 64, steps: 8340 }, // 1 day ago (Optimal HRV)
    { sleepHours: 7.4, sleepQuality: 82, hrvMs: 52, restingHr: 62, steps: 5890 }, // Today (Optimal HRV)
  ];

  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const dateKey = toLocalDateKey(d);

    let sleepHours: number;
    let sleepQuality: number;
    let hrvMs: number;
    let restingHr: number;
    let steps: number;

    if (daysAgo <= 6) {
      const preset = last7Bio[6 - daysAgo];
      sleepHours = preset.sleepHours;
      sleepQuality = preset.sleepQuality;
      hrvMs = preset.hrvMs;
      restingHr = preset.restingHr;
      steps = preset.steps;
    } else {
      // Deterministic gentle wave for days 7..29
      const wave = Math.sin(daysAgo * 0.7);
      sleepHours = Number((7.0 + wave * 0.85).toFixed(1));
      sleepQuality = Math.round(74 + wave * 12);
      hrvMs = Math.round(47 + wave * 9);
      restingHr = Math.round(65 - wave * 4);
      steps = Math.round(7600 + wave * 2100);
    }

    const optimalHrv = hrvMs >= 48 && sleepQuality >= 76;

    const makeWin = (w: DayWindow, hrvOffset: number, rhrOffset: number, stepRatio: number) => {
      const wHrv = Math.max(28, Math.round(hrvMs + hrvOffset));
      const wRhr = Math.max(54, Math.round(restingHr + rhrOffset));
      const recoveryStatus: 'Optimal HRV' | 'Balanced' | 'Strained' =
        wHrv >= 49 ? 'Optimal HRV' : wHrv >= 41 ? 'Balanced' : 'Strained';
      return {
        window: w,
        hrvMs: wHrv,
        restingHr: wRhr,
        steps: Math.round(steps * stepRatio),
        recoveryStatus,
      };
    };

    biometrics.push({
      dateKey,
      sleepHours,
      sleepQuality,
      hrvMs,
      restingHr,
      steps,
      optimalHrv,
      windows: {
        morn: makeWin('morn', 3, -2, 0.24),
        mid: makeWin('mid', -3, 2, 0.31),
        aft: makeWin('aft', -1, 1, 0.32),
        eve: makeWin('eve', 2, -1, 0.13),
      },
    });
  }

  // Sort entries newest first
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return { entries, biometrics };
}
