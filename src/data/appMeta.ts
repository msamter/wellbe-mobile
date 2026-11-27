export const APP_NAME = 'WELLBE+';
export const APP_VERSION = '3.0.0';
export const APP_RELEASE_LABEL = 'WELLBE+ 3.0';
export const APP_BUILD_CHANNEL = 'Local-First Web App';
export const APP_RELEASE_DATE = 'November 2026';
export const FEEDBACK_EMAIL = 'micah.samter@proton.me';

export interface ReleaseNoteEntry {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const RELEASE_NOTES: ReleaseNoteEntry[] = [
  {
    version: '3.0.0',
    date: 'November 2026',
    title: 'Focused Surfaces, Settings About & Performance Pass',
    highlights: [
      'Added Help, Legal & About to Settings with version details, release notes, Privacy Policy, Terms of Use, contextual bug reporting, and guarded Reset to Defaults.',
      'Streamlined the Today Latest emotion card and Quick Check-In matrix by removing secondary comparison deltas and redundant color filter bars.',
      'Tightened Mood Log layout density so more check-ins remain visible above the floating capsule dock, with reliable Quick Undo restoration on delete.',
      'Reduced bundle and memory overhead across charts, heatmaps, and GPU-composited somatic progress indicators.',
    ],
  },
  {
    version: '2.9.0',
    date: 'October 2026',
    title: 'Integrated Routines Architecture & Dual-Emotion Blending',
    highlights: [
      'Consolidated Gratitude Capture, Voice Panic Anchor, and Reset Duration pacing directly inside the Routines workspace.',
      'Added 10-second auto-dismiss for Attach to Entry, 10-second tile outline reversion, and crisp 250ms quadrant border pulse feedback.',
      'Introduced 2-emotion blending with cross-quadrant color gradients and accessible keyboard arrow-key navigation.',
    ],
  },
  {
    version: '2.8.0',
    date: 'September 2026',
    title: 'Neuro-Inclusive Accessibility & Wearable Continuity',
    highlights: [
      'Added 9 declarative accessibility modes including Calm Mode, High Contrast, Reading Comfort, Focus Mode, Quiet Cues, Pattern Assist, and Plain Language.',
      'Introduced 7x4 mood-and-HRV recovery heatmap, Burnout Resilience gauge, and printable 1-page Therapist Summary export.',
    ],
  },
];

export interface LegalDocumentSection {
  id: string;
  heading: string;
  body: string;
}

export const PRIVACY_POLICY_SECTIONS: LegalDocumentSection[] = [
  {
    id: 'local-first',
    heading: '1. Local-First Journal & Check-In Storage',
    body: 'Your mood check-ins, blended emotions, context tags, personal notes, custom routines, and wearable preferences are stored locally in your browser via localStorage. WELLBE+ does not require an account login or upload your journal history to an external database by default.',
  },
  {
    id: 'optional-ai',
    heading: '2. Optional On-Demand AI & Voice Features',
    body: 'When you explicitly send a message in the Coach tab or enable voice guidance during a somatic exercise, only the prompt context or spoken phrase needed for that request is sent through the app server to generate your response or audio cue. No journal data is transmitted while browsing Today, Routines, Mood Log, or Trends.',
  },
  {
    id: 'wearables',
    heading: '3. Biometric & Wearable Telemetry',
    body: 'Biometric metrics (HRV, resting heart rate, sleep, and steps) and wearable preferences stay on your device. You can pause individual sensor streams or unpair a wearable at any time inside Settings > Devices without losing historical logs.',
  },
  {
    id: 'user-control',
    heading: '4. Your Data Control & Exports',
    body: 'You can export a local Therapist Summary (TXT or print/PDF), delete individual check-ins with Quick Undo, clear your local journal from Mood Log, or restore app preferences to defaults from Settings > Legal & About without deleting your saved check-ins.',
  },
];

export const TERMS_OF_USE_SECTIONS: LegalDocumentSection[] = [
  {
    id: 'wellness-scope',
    heading: '1. Supportive Wellness Tool — Not Medical Care',
    body: 'WELLBE+ is an emotional self-awareness and somatic pacing tool designed for everyday reflection and nervous-system regulation. It is not a medical device, clinical diagnostic tool, therapist, or substitute for licensed mental health or medical care.',
  },
  {
    id: 'crisis-boundary',
    heading: '2. Emergency & Crisis Support',
    body: 'If you are experiencing a mental health emergency or thoughts of self-harm, please contact local emergency services immediately, or call/text 988 in the United States and Canada for free, confidential 24/7 support.',
  },
  {
    id: 'local-responsibility',
    heading: '3. On-Device Data & Browser Storage',
    body: 'Because WELLBE+ stores check-ins locally in your browser, clearing site data or using private browsing windows may remove locally stored records. Export any summaries you wish to keep long-term.',
  },
  {
    id: 'feedback-contact',
    heading: '4. Feedback & Contact',
    body: `Questions, accessibility requests, and bug reports can be sent directly to ${FEEDBACK_EMAIL}.`,
  },
];
