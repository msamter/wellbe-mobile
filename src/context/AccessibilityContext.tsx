import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export const A11Y_STORAGE_KEY = 'wellbe_a11y_v1';
const LEGACY_SETTINGS_KEY = 'wellbe_v1_settings';

export interface AccessibilityPreferences {
  calmMode: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  highContrast: boolean;
  readingComfort: boolean;
  focusMode: boolean;
  patternAssist: boolean;
  plainLanguage: boolean;
  quietCues: boolean;
}

export type AccessibilityKey = keyof AccessibilityPreferences;

export type AccessibilityPresetId = 'overwhelmed' | 'max-clarity';

interface StoredAccessibilityRecord {
  prefs: Partial<AccessibilityPreferences>;
  userOverrides?: {
    reduceMotion?: boolean;
    highContrast?: boolean;
  };
}

export interface AccessibilityContextValue extends AccessibilityPreferences {
  preferences: AccessibilityPreferences;
  activePreset: AccessibilityPresetId | null;
  canRestorePrevious: boolean;
  announcement: string;
  togglePreference: (key: AccessibilityKey) => void;
  setPreference: (key: AccessibilityKey, value: boolean, customAnnouncement?: string) => void;
  updatePreferences: (patch: Partial<AccessibilityPreferences>, announcementText?: string) => void;
  applyPreset: (preset: AccessibilityPresetId) => void;
  restorePreviousSettings: () => void;
  resetToDefaults: () => void;
  announce: (message: string) => void;
}

const TOGGLE_ANNOUNCEMENTS: Record<
  AccessibilityKey,
  { on: string; off: string }
> = {
  calmMode: {
    on: 'Calm Mode turned on. Bright accents softened, card spacing widened, and streaks hidden.',
    off: 'Calm Mode turned off. Standard accents and streak counters restored.',
  },
  reduceTransparency: {
    on: 'Reduce Transparency turned on. Translucent glass surfaces switched to solid opaque panels.',
    off: 'Reduce Transparency turned off. Liquid Glass navigation surfaces restored.',
  },
  highContrast: {
    on: 'High-Contrast Mode turned on. Text, borders, charts, and focus outlines raised to WCAG AAA targets.',
    off: 'High-Contrast Mode turned off. Standard contrast palette restored.',
  },
  patternAssist: {
    on: 'Color-Vision and Pattern Assist turned on. Geometric patterns and quadrant codes added alongside colors.',
    off: 'Color-Vision and Pattern Assist turned off.',
  },
  reduceMotion: {
    on: 'Reduce Motion turned on. Animations, momentum coasting, and pulsing breathing rings switched to static pacing.',
    off: 'Reduce Motion turned off. Smooth transitions and breathing motion restored.',
  },
  quietCues: {
    on: 'Quiet Visual-Only Cues turned on. Voice narration, chimes, and haptics are silenced with large visual prompts.',
    off: 'Quiet Visual-Only Cues turned off. Optional audio and voice cues enabled.',
  },
  readingComfort: {
    on: 'Reading Comfort turned on. Text enlarged with wider line spacing, letter spacing, and 60-character measure.',
    off: 'Reading Comfort turned off. Standard typography scale restored.',
  },
  focusMode: {
    on: 'Focus Mode turned on. Secondary widgets and deep charts collapsed behind expandable sections.',
    off: 'Focus Mode turned off. All widgets and analytics expanded.',
  },
  plainLanguage: {
    on: 'Plain Language and Explicit Labels turned on. Everyday wording and visible button labels enabled.',
    off: 'Plain Language turned off. Standard terminology and compact icon buttons restored.',
  },
};

function getSystemMediaPreferences(): {
  prefersReducedMotion: boolean;
  prefersMoreContrast: boolean;
} {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return { prefersReducedMotion: false, prefersMoreContrast: false };
  }
  return {
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    prefersMoreContrast: window.matchMedia('(prefers-contrast: more)').matches,
  };
}

function getSystemDefaults(): AccessibilityPreferences {
  const sys = getSystemMediaPreferences();
  return {
    calmMode: false,
    reduceMotion: sys.prefersReducedMotion,
    reduceTransparency: false,
    highContrast: sys.prefersMoreContrast,
    readingComfort: false,
    focusMode: false,
    patternAssist: false,
    plainLanguage: false,
    quietCues: false,
  };
}

function loadInitialAccessibilityState(): {
  prefs: AccessibilityPreferences;
  userOverrides: { reduceMotion: boolean; highContrast: boolean };
} {
  const defaults = getSystemDefaults();
  if (typeof window === 'undefined') {
    return { prefs: defaults, userOverrides: { reduceMotion: false, highContrast: false } };
  }

  try {
    const raw = window.localStorage.getItem(A11Y_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        // Support both nested { prefs, userOverrides } and flat schema safely
        const src =
          obj.prefs && typeof obj.prefs === 'object'
            ? (obj.prefs as Record<string, unknown>)
            : obj;
        const ov =
          obj.userOverrides && typeof obj.userOverrides === 'object'
            ? (obj.userOverrides as Record<string, unknown>)
            : {};

        const hasMotionOverride =
          typeof ov.reduceMotion === 'boolean'
            ? ov.reduceMotion
            : typeof src.reduceMotion === 'boolean';
        const hasContrastOverride =
          typeof ov.highContrast === 'boolean'
            ? ov.highContrast
            : typeof src.highContrast === 'boolean';

        return {
          prefs: {
            calmMode: typeof src.calmMode === 'boolean' ? src.calmMode : defaults.calmMode,
            reduceMotion:
              hasMotionOverride && typeof src.reduceMotion === 'boolean'
                ? src.reduceMotion
                : defaults.reduceMotion,
            reduceTransparency:
              typeof src.reduceTransparency === 'boolean'
                ? src.reduceTransparency
                : defaults.reduceTransparency,
            highContrast:
              hasContrastOverride && typeof src.highContrast === 'boolean'
                ? src.highContrast
                : defaults.highContrast,
            readingComfort:
              typeof src.readingComfort === 'boolean'
                ? src.readingComfort
                : defaults.readingComfort,
            focusMode: typeof src.focusMode === 'boolean' ? src.focusMode : defaults.focusMode,
            patternAssist:
              typeof src.patternAssist === 'boolean' ? src.patternAssist : defaults.patternAssist,
            plainLanguage:
              typeof src.plainLanguage === 'boolean' ? src.plainLanguage : defaults.plainLanguage,
            quietCues: typeof src.quietCues === 'boolean' ? src.quietCues : defaults.quietCues,
          },
          userOverrides: {
            reduceMotion: hasMotionOverride,
            highContrast: hasContrastOverride,
          },
        };
      }
    }

    // One-time safe migration from legacy wellbe_v1_settings if present
    const legacyRaw = window.localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Record<string, unknown> | null;
      if (legacy && typeof legacy === 'object') {
        return {
          prefs: {
            calmMode: typeof legacy.calmMode === 'boolean' ? legacy.calmMode : defaults.calmMode,
            reduceMotion:
              typeof legacy.reduceMotion === 'boolean'
                ? legacy.reduceMotion
                : defaults.reduceMotion,
            reduceTransparency:
              typeof legacy.reduceTransparency === 'boolean'
                ? legacy.reduceTransparency
                : defaults.reduceTransparency,
            highContrast:
              typeof legacy.highContrast === 'boolean'
                ? legacy.highContrast
                : defaults.highContrast,
            readingComfort:
              typeof legacy.readingComfort === 'boolean'
                ? legacy.readingComfort
                : defaults.readingComfort,
            focusMode:
              typeof legacy.focusMode === 'boolean' ? legacy.focusMode : defaults.focusMode,
            patternAssist:
              typeof legacy.patternAssist === 'boolean'
                ? legacy.patternAssist
                : defaults.patternAssist,
            plainLanguage:
              typeof legacy.plainLanguage === 'boolean'
                ? legacy.plainLanguage
                : defaults.plainLanguage,
            quietCues:
              typeof legacy.quietCues === 'boolean' ? legacy.quietCues : defaults.quietCues,
          },
          userOverrides: {
            reduceMotion: typeof legacy.reduceMotion === 'boolean',
            highContrast: typeof legacy.highContrast === 'boolean',
          },
        };
      }
    }
  } catch {
    // Malformed storage falls back safely to defaults
  }

  return { prefs: defaults, userOverrides: { reduceMotion: false, highContrast: false } };
}

function applyRootAccessibilityAttributes(
  prefs: AccessibilityPreferences,
  hasReduceMotionOverride: boolean
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Declarative data-* attributes (primary CSS contract)
  root.setAttribute('data-calm-mode', String(prefs.calmMode));
  if (prefs.reduceMotion) {
    root.setAttribute('data-reduce-motion', 'true');
  } else if (hasReduceMotionOverride) {
    root.setAttribute('data-reduce-motion', 'false');
  } else {
    root.removeAttribute('data-reduce-motion');
  }
  root.setAttribute('data-reduce-transparency', String(prefs.reduceTransparency));
  root.setAttribute('data-high-contrast', String(prefs.highContrast));
  root.setAttribute('data-reading-comfort', String(prefs.readingComfort));
  root.setAttribute('data-focus-mode', String(prefs.focusMode));
  root.setAttribute('data-pattern-assist', String(prefs.patternAssist));
  root.setAttribute('data-plain-language', String(prefs.plainLanguage));
  root.setAttribute('data-quiet-cues', String(prefs.quietCues));

  // Keep synchronized utility classes for backwards compatibility
  root.classList.toggle('calm-mode', prefs.calmMode);
  root.classList.toggle('reduce-motion', prefs.reduceMotion);
  root.classList.toggle('allow-motion', !prefs.reduceMotion && hasReduceMotionOverride);
  root.classList.toggle('reduce-transparency', prefs.reduceTransparency);
  root.classList.toggle('high-contrast', prefs.highContrast);
  root.classList.toggle('reading-comfort', prefs.readingComfort);
  root.classList.toggle('focus-mode', prefs.focusMode);
  root.classList.toggle('pattern-assist', prefs.patternAssist);
  root.classList.toggle('plain-language', prefs.plainLanguage);
  root.classList.toggle('quiet-cues', prefs.quietCues);
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialRef = useRef<ReturnType<typeof loadInitialAccessibilityState> | null>(null);
  if (!initialRef.current) {
    initialRef.current = loadInitialAccessibilityState();
  }

  const [preferences, setPreferences] = useState<AccessibilityPreferences>(
    () => initialRef.current!.prefs
  );
  const preferencesRef = useRef<AccessibilityPreferences>(preferences);
  preferencesRef.current = preferences;
  const [userOverrides, setUserOverrides] = useState<{
    reduceMotion: boolean;
    highContrast: boolean;
  }>(() => initialRef.current!.userOverrides);

  const [previousBeforePreset, setPreviousBeforePreset] =
    useState<AccessibilityPreferences | null>(null);
  const [activePreset, setActivePreset] = useState<AccessibilityPresetId | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const announceSeqRef = useRef(0);

  const announce = useCallback((message: string) => {
    // Append invisible zero-width space alternating on repeat messages so screen readers always re-announce
    announceSeqRef.current += 1;
    const suffix = announceSeqRef.current % 2 === 0 ? '\u200B' : '';
    setAnnouncement(`${message}${suffix}`);
  }, []);

  // Synchronize declarative data-* attributes to <html> before paint (zero flicker)
  useLayoutEffect(() => {
    applyRootAccessibilityAttributes(preferences, userOverrides.reduceMotion);
  }, [preferences, userOverrides.reduceMotion]);

  // Persist cleanly to wellbe_a11y_v1
  useEffect(() => {
    try {
      const record: StoredAccessibilityRecord = {
        prefs: preferences,
        userOverrides,
      };
      window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(record));
    } catch {
      // Ignore storage quota or privacy-mode failures
    }
  }, [preferences, userOverrides]);

  // Stay synced with OS prefers-reduced-motion & prefers-contrast unless user saved an explicit override
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastMq = window.matchMedia('(prefers-contrast: more)');

    const onMotionChange = (e: MediaQueryListEvent) => {
      if (!userOverrides.reduceMotion) {
        setPreferences((prev) => ({ ...prev, reduceMotion: e.matches }));
      }
    };
    const onContrastChange = (e: MediaQueryListEvent) => {
      if (!userOverrides.highContrast) {
        setPreferences((prev) => ({ ...prev, highContrast: e.matches }));
      }
    };

    motionMq.addEventListener('change', onMotionChange);
    contrastMq.addEventListener('change', onContrastChange);
    return () => {
      motionMq.removeEventListener('change', onMotionChange);
      contrastMq.removeEventListener('change', onContrastChange);
    };
  }, [userOverrides.reduceMotion, userOverrides.highContrast]);

  const setPreference = useCallback(
    (key: AccessibilityKey, value: boolean, customAnnouncement?: string) => {
      setPreferences((prev) => {
        if (prev[key] === value) return prev;
        return { ...prev, [key]: value };
      });
      if (key === 'reduceMotion') {
        setUserOverrides((prev) => ({ ...prev, reduceMotion: true }));
      }
      if (key === 'highContrast') {
        setUserOverrides((prev) => ({ ...prev, highContrast: true }));
      }
      setActivePreset(null);
      announce(
        customAnnouncement ??
          (value ? TOGGLE_ANNOUNCEMENTS[key].on : TOGGLE_ANNOUNCEMENTS[key].off)
      );
    },
    [announce]
  );

  const togglePreference = useCallback(
    (key: AccessibilityKey) => {
      const nextVal = !preferencesRef.current[key];
      setPreferences((prev) => ({ ...prev, [key]: nextVal }));
      announce(nextVal ? TOGGLE_ANNOUNCEMENTS[key].on : TOGGLE_ANNOUNCEMENTS[key].off);
      if (key === 'reduceMotion') {
        setUserOverrides((prev) => ({ ...prev, reduceMotion: true }));
      }
      if (key === 'highContrast') {
        setUserOverrides((prev) => ({ ...prev, highContrast: true }));
      }
      setActivePreset(null);
    },
    [announce]
  );

  const updatePreferences = useCallback(
    (patch: Partial<AccessibilityPreferences>, announcementText?: string) => {
      setPreferences((prev) => ({ ...prev, ...patch }));
      if (typeof patch.reduceMotion === 'boolean') {
        setUserOverrides((prev) => ({ ...prev, reduceMotion: true }));
      }
      if (typeof patch.highContrast === 'boolean') {
        setUserOverrides((prev) => ({ ...prev, highContrast: true }));
      }
      setActivePreset(null);
      if (announcementText) announce(announcementText);
    },
    [announce]
  );

  const applyPreset = useCallback(
    (preset: AccessibilityPresetId) => {
      // Preserve the user's pre-preset baseline cleanly outside the preferences state updater
      const snapshot = { ...preferencesRef.current };
      setPreviousBeforePreset((existing) => existing ?? snapshot);

      setPreferences((current) => {
        if (preset === 'overwhelmed') {
          return {
            ...current,
            calmMode: true,
            reduceMotion: true,
            focusMode: true,
            plainLanguage: true,
            quietCues: true,
          };
        }

        // 'max-clarity'
        return {
          ...current,
          highContrast: true,
          reduceTransparency: true,
          readingComfort: true,
          patternAssist: true,
        };
      });

      if (preset === 'overwhelmed') {
        setUserOverrides((prev) => ({ ...prev, reduceMotion: true }));
        setActivePreset('overwhelmed');
        announce(
          'Overwhelmed Right Now preset activated: Calm Mode, Reduce Motion, Focus Mode, Plain Language, and Quiet Cues are now on. You can restore previous settings anytime.'
        );
      } else {
        setUserOverrides((prev) => ({ ...prev, highContrast: true }));
        setActivePreset('max-clarity');
        announce(
          'Max Clarity preset activated: High Contrast, Reduce Transparency, Reading Comfort, and Pattern Assist are now on.'
        );
      }
    },
    [announce]
  );

  const restorePreviousSettings = useCallback(() => {
    if (!previousBeforePreset) return;
    setPreferences(previousBeforePreset);
    setPreviousBeforePreset(null);
    setActivePreset(null);
    announce('Previous accessibility settings restored.');
  }, [previousBeforePreset, announce]);

  const resetToDefaults = useCallback(() => {
    const sysDefaults = getSystemDefaults();
    setPreferences(sysDefaults);
    setUserOverrides({ reduceMotion: false, highContrast: false });
    setPreviousBeforePreset(null);
    setActivePreset(null);
    announce('All accessibility settings reset to system defaults.');
  }, [announce]);

  const value = useMemo<AccessibilityContextValue>(
    () => ({
      ...preferences,
      preferences,
      activePreset,
      canRestorePrevious: previousBeforePreset !== null,
      announcement,
      togglePreference,
      setPreference,
      updatePreferences,
      applyPreset,
      restorePreviousSettings,
      resetToDefaults,
      announce,
    }),
    [
      preferences,
      activePreset,
      previousBeforePreset,
      announcement,
      togglePreference,
      setPreference,
      updatePreferences,
      applyPreset,
      restorePreviousSettings,
      resetToDefaults,
      announce,
    ]
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      {/* Global Screen-Reader Polite Live Region for Instant Accessibility Announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </AccessibilityContext.Provider>
  );
};

export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error('useAccessibility must be used inside AccessibilityProvider');
  }
  return ctx;
}
