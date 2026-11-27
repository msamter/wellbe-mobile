import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  Music,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AppSettings, ResetProtocol } from '../types/wellbe';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useDragToScroll } from '../hooks/useDragToScroll';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  prefetchCalmFemaleVoice,
  speakCalmFemaleVoice,
  stopCalmVoice,
} from '../utils/voiceover';
import { SoothingAmbientEngine } from '../utils/soothingAmbientEngine';

interface ProtocolPlayerProps {
  protocols: ResetProtocol[];
  titleOverride?: string;
  settings: AppSettings;
  onClose: () => void;
  onCompleteSession: () => void;
  onSaveGratitude: (note: string) => void;
}

type BreathPhase = 'Inhale' | 'Hold' | 'Exhale';

/** Pure deterministic 4-7-8 cadence calculation from elapsed seconds (19s cycle) */
function get478State(elapsedSec: number): { phase: BreathPhase; remainingInPhase: number } {
  const mod = elapsedSec % 19;
  if (mod < 4) return { phase: 'Inhale', remainingInPhase: 4 - mod };
  if (mod < 11) return { phase: 'Hold', remainingInPhase: 11 - mod };
  return { phase: 'Exhale', remainingInPhase: 19 - mod };
}

/** Pure deterministic 4-4-6 panic anchor cadence from elapsed seconds (14s cycle) */
function get446State(elapsedSec: number): {
  phase: BreathPhase;
  remainingInPhase: number;
  cycleIndex: number;
} {
  const cycleIndex = Math.floor(elapsedSec / 14);
  const mod = elapsedSec % 14;
  if (mod < 4) return { phase: 'Inhale', remainingInPhase: 4 - mod, cycleIndex };
  if (mod < 8) return { phase: 'Hold', remainingInPhase: 8 - mod, cycleIndex };
  return { phase: 'Exhale', remainingInPhase: 14 - mod, cycleIndex };
}

/* ==========================================================================
   In-App Procedural Calming Ambient Audio (100% Local Web Audio Synthesis)
   Warm pastoral chord pads + gentle felt-piano motifs + stereo hall reverb.
   Zero external YouTube embeds, redirects, or network dependencies.
   ========================================================================== */
const AMBIENT_TRACK_TITLE = 'Soothing Sanctuary';
const AMBIENT_TRACK_SUBTITLE = 'Warm Piano & Pad';

interface SoothingRelaxationAudioProps {
  /** Whether the parent meditation / panic session is currently running */
  sessionRunning: boolean;
  /** Respects Quiet Visual-Only Cues unless user unmutes for this session */
  mutedByQuietMode?: boolean;
  /** Optional callback when user unmutes music while Quiet Mode is active */
  onRequestUnmuteSession?: () => void;
  /** Visual variant for modal vs full-screen sanctuary */
  variant?: 'modal' | 'sanctuary';
}

const SoothingRelaxationAudio: React.FC<SoothingRelaxationAudioProps> = React.memo(
  ({
    sessionRunning,
    mutedByQuietMode = false,
    onRequestUnmuteSession,
    variant = 'modal',
  }) => {
    const a11y = useAccessibility();
    const engineRef = useRef<SoothingAmbientEngine | null>(null);
    const isMountedRef = useRef(true);
    const [musicEnabled, setMusicEnabled] = useState(!mutedByQuietMode);
    const [isMuted, setIsMuted] = useState(mutedByQuietMode);
    const [volume, setVolume] = useState(50);
    const [needsTapToUnlock, setNeedsTapToUnlock] = useState(false);

    const getOrCreateEngine = useCallback(() => {
      if (!engineRef.current) {
        engineRef.current = new SoothingAmbientEngine();
      }
      return engineRef.current;
    }, []);

    // Graceful fade-out (~450ms) and full disposal when leaving Panic Anchor or switching views
    useEffect(() => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
        if (engineRef.current) {
          engineRef.current.stopAndDispose();
          engineRef.current = null;
        }
      };
    }, []);

    // Sync quiet-mode toggles cleanly
    useEffect(() => {
      if (mutedByQuietMode) {
        setIsMuted(true);
      } else {
        setIsMuted(false);
        setMusicEnabled(true);
      }
    }, [mutedByQuietMode]);

    const shouldPlay = musicEnabled && sessionRunning && !mutedByQuietMode;
    const isAudiblyPlaying = shouldPlay && !isMuted && volume > 0 && !needsTapToUnlock;

    // Drive procedural Web Audio engine smoothly on play/pause state changes
    useEffect(() => {
      let cancelled = false;

      if (shouldPlay) {
        const engine = getOrCreateEngine();
        void engine.start(volume / 100, isMuted).then((started) => {
          if (cancelled) return;
          setNeedsTapToUnlock(!started);
        });
      } else if (engineRef.current) {
        engineRef.current.pause();
      }

      return () => {
        cancelled = true;
      };
      // Volume & mute updates are applied smoothly in the dedicated effect below
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shouldPlay, getOrCreateEngine]);

    // Smoothly ramp gain when volume or mute changes while running
    useEffect(() => {
      if (!engineRef.current) return;
      engineRef.current.setVolume(volume / 100, isMuted || mutedByQuietMode);
    }, [volume, isMuted, mutedByQuietMode]);

    const handleToggleMusic = useCallback(() => {
      // Explicit user gesture unlocks Web Audio immediately if autoplay was blocked
      if (mutedByQuietMode && onRequestUnmuteSession) {
        onRequestUnmuteSession();
        setIsMuted(false);
        setMusicEnabled(true);
        const engine = getOrCreateEngine();
        void engine.start(Math.max(0.25, volume / 100), false).then((started) => {
          if (isMountedRef.current) setNeedsTapToUnlock(!started);
        });
        return;
      }

      if (needsTapToUnlock) {
        setIsMuted(false);
        setMusicEnabled(true);
        const engine = getOrCreateEngine();
        void engine.start(Math.max(0.25, volume / 100), false).then((started) => {
          if (isMountedRef.current) setNeedsTapToUnlock(!started);
        });
        return;
      }

      const nextEnabled = !musicEnabled;
      setMusicEnabled(nextEnabled);
      if (nextEnabled) {
        const nextVol = volume === 0 ? 45 : volume;
        if (volume === 0) setVolume(nextVol);
        if (isMuted) setIsMuted(false);
        const engine = getOrCreateEngine();
        void engine.start(nextVol / 100, false).then((started) => {
          if (isMountedRef.current) setNeedsTapToUnlock(!started);
        });
      } else {
        engineRef.current?.pause();
      }
    }, [
      mutedByQuietMode,
      onRequestUnmuteSession,
      needsTapToUnlock,
      musicEnabled,
      volume,
      isMuted,
      getOrCreateEngine,
    ]);

    const handleToggleMute = useCallback(() => {
      if (mutedByQuietMode && onRequestUnmuteSession) {
        onRequestUnmuteSession();
        setIsMuted(false);
        setMusicEnabled(true);
        const engine = getOrCreateEngine();
        void engine.start(Math.max(0.25, volume / 100), false).then((started) => {
          if (isMountedRef.current) setNeedsTapToUnlock(!started);
        });
        return;
      }

      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      if (!nextMuted && needsTapToUnlock && shouldPlay) {
        const engine = getOrCreateEngine();
        void engine.start(Math.max(0.25, volume / 100), false).then((started) => {
          if (isMountedRef.current) setNeedsTapToUnlock(!started);
        });
      } else {
        engineRef.current?.setVolume(volume / 100, nextMuted);
      }
    }, [
      mutedByQuietMode,
      onRequestUnmuteSession,
      isMuted,
      needsTapToUnlock,
      shouldPlay,
      volume,
      getOrCreateEngine,
    ]);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextVol = Number(e.target.value);
      setVolume(nextVol);
      const nextMuted = nextVol === 0;
      if (nextVol > 0 && isMuted) {
        setIsMuted(false);
      } else if (nextVol === 0 && !isMuted) {
        setIsMuted(true);
      }
      if (nextVol > 0 && needsTapToUnlock && shouldPlay) {
        const engine = getOrCreateEngine();
        void engine.start(nextVol / 100, false).then((started) => {
          if (isMountedRef.current) setNeedsTapToUnlock(!started);
        });
      } else {
        engineRef.current?.setVolume(nextVol / 100, nextMuted);
      }
    };

    const statusLabel = isAudiblyPlaying
      ? 'Playing'
      : needsTapToUnlock && shouldPlay
        ? 'Tap Play to start'
        : mutedByQuietMode || isMuted || volume === 0
          ? 'Muted'
          : 'Paused';

    return (
      <div
        data-no-drag-scroll="true"
        className={`relative overflow-hidden rounded-2xl border border-[var(--border-hairline)] ${
          variant === 'sanctuary'
            ? 'liquid-glass w-full max-w-md px-3 py-2'
            : 'bg-[var(--surface-subtle)] px-3 py-2'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={handleToggleMusic}
              aria-pressed={isAudiblyPlaying}
              aria-label={
                isAudiblyPlaying
                  ? 'Pause calming ambient audio'
                  : 'Play calming ambient audio'
              }
              style={{
                backgroundColor: isAudiblyPlaying
                  ? 'var(--accent-soft)'
                  : 'var(--surface-card)',
                color: isAudiblyPlaying ? 'var(--accent-primary)' : 'var(--ink-muted)',
                border: '1px solid var(--border-hairline)',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
              className="flex h-[44px] w-[44px] min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              {isAudiblyPlaying ? (
                <Pause className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4 translate-x-[0.5px]" aria-hidden="true" />
              )}
            </button>

            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1.5">
                <Music className="h-3 w-3 shrink-0 text-[var(--bio-mint)]" aria-hidden="true" />
                <p className="truncate text-xs font-semibold text-[var(--ink-primary)]">
                  {AMBIENT_TRACK_TITLE}
                </p>
                {isAudiblyPlaying && (
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bio-mint)] ${
                      a11y.reduceMotion ? '' : 'motion-safe:animate-pulse'
                    }`}
                  />
                )}
              </div>
              <p className="truncate text-[11px] text-[var(--ink-muted)]">
                {AMBIENT_TRACK_SUBTITLE} · {statusLabel}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={handleToggleMute}
              aria-pressed={isMuted || volume === 0}
              aria-label={
                isMuted || volume === 0
                  ? 'Unmute calming ambient audio'
                  : 'Mute calming ambient audio'
              }
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
              className="flex h-[44px] w-[44px] min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4 text-[var(--bio-mint)]" aria-hidden="true" />
              )}
            </button>

            <div className="flex min-h-[44px] items-center px-1">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Calming ambient audio volume"
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
                className="h-2 w-16 cursor-pointer accent-[var(--accent-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] sm:w-20"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);
SoothingRelaxationAudio.displayName = 'SoothingRelaxationAudio';

export const ProtocolPlayerModal: React.FC<ProtocolPlayerProps> = ({
  protocols,
  titleOverride,
  settings,
  onClose,
  onCompleteSession,
  onSaveGratitude,
}) => {
  const a11y = useAccessibility();
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const handleSafeProtocolClose = useCallback(() => {
    stopCalmVoice();
    onClose();
  }, [onClose]);
  useFocusTrap(dialogRef, handleSafeProtocolClose, true);
  useDragToScroll(bodyRef, { axis: 'y' });

  const [stepIdx, setStepIdx] = useState(0);
  const [sessionCuesUnmuted, setSessionCuesUnmuted] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  const current = protocols[stepIdx] ?? protocols[0];
  const totalSeconds = Math.max(30, current.durationMin * 60);
  const effectiveReduceMotion = a11y.reduceMotion || settings.reduceMotion;
  const effectiveQuiet = a11y.quietCues && !sessionCuesUnmuted;
  const effectiveVoiceOn = voiceEnabled && !effectiveQuiet;

  // Drift-free elapsed second tracking
  const [isRunning, setIsRunning] = useState(current.type !== 'gratitude');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [checkedGrounding, setCheckedGrounding] = useState<number[]>([]);
  const [gratitudeNote, setGratitudeNote] = useState('');
  const [gratitudeError, setGratitudeError] = useState('');
  const [gratitudeSaved, setGratitudeSaved] = useState(false);

  const gratitudeTimerRef = useRef<number | null>(null);
  const startTimestampRef = useRef<number>(Date.now());
  const accumulatedMsRef = useRef<number>(0);

  // Reset cleanly whenever step changes
  useEffect(() => {
    if (gratitudeTimerRef.current) {
      window.clearTimeout(gratitudeTimerRef.current);
      gratitudeTimerRef.current = null;
    }
    accumulatedMsRef.current = 0;
    startTimestampRef.current = Date.now();
    setElapsedSec(0);
    setCheckedGrounding([]);
    setGratitudeNote('');
    setGratitudeError('');
    setGratitudeSaved(false);
    setIsRunning(current.type !== 'gratitude');
  }, [current]);

  useEffect(() => {
    return () => {
      if (gratitudeTimerRef.current) window.clearTimeout(gratitudeTimerRef.current);
      stopCalmVoice();
    };
  }, []);

  // Drift-free single interval (computes from monotonic wall clock delta)
  useEffect(() => {
    if (!isRunning || current.type === 'gratitude') return;
    startTimestampRef.current = Date.now();

    const interval = window.setInterval(() => {
      const totalMs = accumulatedMsRef.current + (Date.now() - startTimestampRef.current);
      const nextElapsed = Math.floor(totalMs / 1000);
      if (nextElapsed >= totalSeconds) {
        accumulatedMsRef.current = totalSeconds * 1000;
        setElapsedSec((prev) => (prev === totalSeconds ? prev : totalSeconds));
        setIsRunning(false);
      } else {
        setElapsedSec((prev) => (prev === nextElapsed ? prev : nextElapsed));
      }
    }, 250);

    return () => {
      accumulatedMsRef.current += Date.now() - startTimestampRef.current;
      window.clearInterval(interval);
    };
  }, [isRunning, current.type, totalSeconds]);

  const secondsLeft = Math.max(0, totalSeconds - elapsedSec);
  const mins = Math.floor(secondsLeft / 60);
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const isLast = stepIdx >= protocols.length - 1;

  const isBreathingMode = current.type === 'breathing' || current.type === 'panic';
  const { phase: breathPhase, remainingInPhase: phaseSec } = useMemo(
    () => (current.type === 'panic' ? get446State(elapsedSec) : get478State(elapsedSec)),
    [current.type, elapsedSec]
  );

  const phaseTotalSec =
    current.type === 'panic'
      ? breathPhase === 'Inhale'
        ? 4
        : breathPhase === 'Hold'
          ? 4
          : 6
      : breathPhase === 'Inhale'
        ? 4
        : breathPhase === 'Hold'
          ? 7
          : 8;
  const phaseProgressPct = Math.min(
    100,
    Math.max(0, Math.round(((phaseTotalSec - phaseSec + 1) / phaseTotalSec) * 100))
  );
  const sessionProgressPct = Math.min(
    100,
    Math.max(0, Math.round((elapsedSec / totalSeconds) * 100))
  );

  const breathingVisualCaption =
    secondsLeft === 0
      ? 'Breathing exercise complete. Notice how your body feels.'
      : !isRunning
        ? 'Paused. Resume whenever you are ready.'
        : breathPhase === 'Inhale'
          ? 'Inhale gently through your nose.'
          : breathPhase === 'Hold'
            ? 'Hold softly without tension.'
            : 'Exhale slowly and let your shoulders drop.';

  // Announce breathing phase transitions politely to screen readers (only when phase changes)
  const phaseAnnouncement =
    isBreathingMode && isRunning
      ? breathPhase === 'Inhale'
        ? 'Inhale gently for 4 seconds'
        : breathPhase === 'Hold'
          ? current.type === 'panic'
            ? 'Hold gently for 4 seconds'
            : 'Hold breath for 7 seconds'
          : current.type === 'panic'
            ? 'Exhale slowly for 6 seconds'
            : 'Exhale slowly for 8 seconds'
      : '';

  // Calm, gentle woman's voiceover for breathing phase cues & somatic exercise guidance
  const protocolSpokenCue = useMemo(() => {
    if (current.type === 'gratitude') return '';
    if (isBreathingMode) {
      if (secondsLeft === 0) return 'Exercise complete. Notice how your body feels.';
      if (breathPhase === 'Inhale') return 'Inhale gently through your nose.';
      if (breathPhase === 'Hold') return 'Hold softly without tension.';
      return 'Exhale slowly and let your shoulders drop.';
    }
    if (current.type === 'grounding') {
      const nextStepIdx = current.steps.findIndex((_, idx) => !checkedGrounding.includes(idx));
      if (nextStepIdx === -1) {
        return 'All five grounding steps are complete. Take one slow breath.';
      }
      return current.steps[nextStepIdx];
    }
    if (current.steps.length > 0) {
      const stepWindow = Math.max(15, Math.floor(totalSeconds / current.steps.length));
      const activeIdx = Math.min(current.steps.length - 1, Math.floor(elapsedSec / stepWindow));
      return current.steps[activeIdx];
    }
    return '';
  }, [
    breathPhase,
    checkedGrounding,
    current.steps,
    current.type,
    elapsedSec,
    isBreathingMode,
    secondsLeft,
    totalSeconds,
  ]);

  // Pre-warm breathing phase clips when voice guidance is turned on
  useEffect(() => {
    if (!effectiveVoiceOn || !isBreathingMode) return;
    prefetchCalmFemaleVoice('Inhale gently through your nose.');
    prefetchCalmFemaleVoice('Hold softly without tension.');
    prefetchCalmFemaleVoice('Exhale slowly and let your shoulders drop.');
  }, [effectiveVoiceOn, isBreathingMode]);

  const handleUnmuteProtocolSession = useCallback(() => {
    setSessionCuesUnmuted(true);
  }, []);

  const isCompletedBreathingCue = isBreathingMode && secondsLeft === 0;
  useEffect(() => {
    if (!effectiveVoiceOn || (!isRunning && !isCompletedBreathingCue) || !protocolSpokenCue) {
      stopCalmVoice();
      return;
    }
    void speakCalmFemaleVoice(protocolSpokenCue, {
      onError: (msg) => {
        setVoiceNotice(msg);
        setVoiceEnabled(false);
      },
    });
  }, [effectiveVoiceOn, isRunning, isCompletedBreathingCue, protocolSpokenCue]);

  const handleResetTimer = () => {
    accumulatedMsRef.current = 0;
    startTimestampRef.current = Date.now();
    setElapsedSec(0);
    setIsRunning(true);
  };

  const handleFinishOrNext = () => {
    stopCalmVoice();
    if (!isLast) {
      setStepIdx((i) => i + 1);
      return;
    }
    onCompleteSession();
    onClose();
  };

  const handleGratitudeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = gratitudeNote.trim();
    if (!trimmed) {
      setGratitudeError('Please enter a short gratitude note before saving.');
      return;
    }
    setGratitudeError('');
    onSaveGratitude(trimmed);
    setGratitudeSaved(true);
    if (gratitudeTimerRef.current) window.clearTimeout(gratitudeTimerRef.current);
    gratitudeTimerRef.current = window.setTimeout(() => {
      if (!isLast) {
        setStepIdx((i) => i + 1);
      } else {
        onCompleteSession();
        onClose();
      }
    }, 750);
  };

  const orbScale =
    effectiveReduceMotion || !isRunning
      ? 1
      : breathPhase === 'Inhale'
        ? 1.18
        : breathPhase === 'Hold'
          ? 1.18
          : 0.86;

  return (
    <div
      style={{ zIndex: 'var(--z-modal)', backgroundColor: 'var(--scrim-bg)' }}
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-4"
      onClick={handleSafeProtocolClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="protocol-player-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="liquid-glass-strong flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl text-[var(--ink-primary)]"
      >
        {/* Pinned Top Bar */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-hairline)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--ink-muted)] tabular-nums">
              {titleOverride
                ? `${titleOverride} · Step ${stepIdx + 1} of ${protocols.length}`
                : `${current.targetState} · ${current.durationLabel}`}
            </p>
            <h2 id="protocol-player-title" className="mt-1 text-lg font-semibold">
              {current.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {current.type !== 'gratitude' && (
              <button
                type="button"
                onClick={() => {
                  setVoiceNotice('');
                  if (a11y.quietCues && !sessionCuesUnmuted) {
                    setSessionCuesUnmuted(true);
                    setVoiceEnabled(true);
                  } else {
                    setVoiceEnabled((v) => !v);
                  }
                }}
                aria-pressed={effectiveVoiceOn}
                aria-label={effectiveVoiceOn ? 'Turn voice guide off' : 'Turn gentle voice guide on'}
                className="inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2.5 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-hover)]"
              >
                {effectiveVoiceOn ? (
                  <Volume2 className="h-3.5 w-3.5 text-[var(--bio-mint)]" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                )}
                <span>{effectiveVoiceOn ? 'Voice On' : 'Voice'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSafeProtocolClose}
              aria-label="Exit protocol player"
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Screen-reader phase transition announcer */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {phaseAnnouncement}
        </div>

        {/* Internally Scrollable Body */}
        <div ref={bodyRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {/* Quiet / Visual-Only Cues Inline Notice + Session Unmute */}
          {a11y.quietCues && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2 font-medium text-[var(--ink-secondary)]">
                {effectiveQuiet ? (
                  <VolumeX className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                ) : (
                  <Volume2 className="h-4 w-4 shrink-0 text-[var(--bio-mint)]" />
                )}
                <span>
                  {effectiveQuiet
                    ? 'Quiet Visual-Only Cues · Sound & haptics muted'
                    : 'Session cues unmuted for this exercise'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSessionCuesUnmuted((u) => {
                    const next = !u;
                    if (!next) setVoiceEnabled(false);
                    return next;
                  });
                }}
                className="min-h-[36px] rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2.5 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--surface-hover)]"
              >
                {effectiveQuiet ? 'Unmute for this session' : 'Return to quiet mode'}
              </button>
            </div>
          )}

          {voiceNotice && (
            <p role="status" className="text-center text-xs text-[var(--ink-muted)]">
              {voiceNotice}
            </p>
          )}

          {/* Local Procedural Ambient Audio — Warm Piano & Pad */}
          <SoothingRelaxationAudio
            sessionRunning={current.type === 'gratitude' ? true : isRunning}
            mutedByQuietMode={effectiveQuiet}
            onRequestUnmuteSession={handleUnmuteProtocolSession}
            variant="modal"
          />

          {isBreathingMode && (
            <div className="flex flex-col items-center py-2 text-center">
              {effectiveReduceMotion ? (
                <div className="w-full space-y-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5 text-left">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-[var(--accent-primary)] tabular-nums">
                      {secondsLeft === 0
                        ? 'Complete'
                        : isRunning
                          ? `${breathPhase} · ${phaseSec}s`
                          : 'Paused'}
                    </span>
                    <span className="font-mono-tabular text-xs text-[var(--ink-muted)]">
                      {mins}:{secs} left
                    </span>
                  </div>
                  <p className="text-center font-mono-tabular text-5xl font-semibold text-[var(--ink-primary)]">
                    {secondsLeft === 0 ? 'Done' : `${phaseSec}s`}
                  </p>

                  {/* Smooth Static Progress Bar for Current Phase (zero pulsing rings) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-medium text-[var(--ink-muted)] tabular-nums">
                      <span>{breathPhase} progress</span>
                      <span>Session {sessionProgressPct}%</span>
                    </div>
                    <div
                      className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]"
                      role="progressbar"
                      aria-label="Breathing phase progress"
                      aria-valuenow={secondsLeft === 0 ? 100 : phaseProgressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full w-full origin-left rounded-full"
                        style={{
                          transform: `scaleX(${(secondsLeft === 0 ? 100 : phaseProgressPct) / 100})`,
                          backgroundColor: 'var(--accent-primary)',
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className="grid grid-cols-3 gap-2"
                    role="group"
                    aria-label={
                      current.type === 'panic'
                        ? '4-4-6 breathing cadence phases'
                        : '4-7-8 breathing cadence phases'
                    }
                  >
                    {(current.type === 'panic'
                      ? ([
                          { id: 'Inhale', dur: '4s' },
                          { id: 'Hold', dur: '4s' },
                          { id: 'Exhale', dur: '6s' },
                        ] as const)
                      : ([
                          { id: 'Inhale', dur: '4s' },
                          { id: 'Hold', dur: '7s' },
                          { id: 'Exhale', dur: '8s' },
                        ] as const)
                    ).map((seg) => {
                      const active = isRunning && secondsLeft > 0 && breathPhase === seg.id;
                      return (
                        <div
                          key={seg.id}
                          className="rounded-xl border px-2 py-2.5 text-center"
                          style={{
                            backgroundColor: active
                              ? 'var(--accent-primary)'
                              : 'var(--surface-subtle)',
                            color: active ? 'var(--accent-primary-ink)' : 'var(--ink-secondary)',
                            borderColor: active
                              ? 'var(--accent-primary)'
                              : 'var(--border-hairline)',
                          }}
                        >
                          <p className="text-xs font-semibold">{seg.id}</p>
                          <p className="font-mono-tabular text-[11px] opacity-90">{seg.dur}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="relative flex h-48 w-48 items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full transition-transform duration-1000"
                    style={{
                      transform: `scale(${orbScale})`,
                      backgroundColor: 'var(--accent-soft)',
                      border: '2px solid var(--accent-primary)',
                    }}
                  />
                  <div className="relative z-10 text-center">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent-primary)]">
                      {secondsLeft === 0 ? 'Complete' : isRunning ? breathPhase : 'Paused'}
                    </p>
                    <p className="mt-1 font-mono-tabular text-4xl font-semibold">
                      {secondsLeft === 0 ? 'Done' : `${phaseSec}s`}
                    </p>
                    <p className="mt-1 font-mono-tabular text-xs text-[var(--ink-muted)]">
                      {mins}:{secs} left
                    </p>
                  </div>
                </div>
              )}

              {/* Large Visual Caption for Quiet Mode & Easy Glancing */}
              <p className="wb-prose mt-4 text-sm font-semibold text-[var(--ink-primary)]">
                {breathingVisualCaption}
              </p>
              <p className="wb-prose mt-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
                {current.type === 'panic'
                  ? '4s gentle nasal inhale · 4s steady hold · 6s slow exhale through pursed lips.'
                  : '4s gentle nasal inhale · 7s quiet hold · 8s slow exhale through pursed lips.'}
              </p>
            </div>
          )}

          {current.type === 'grounding' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--ink-muted)] tabular-nums">
                <span>
                  {a11y.plainLanguage
                    ? '5-4-3-2-1 Notice Your Surroundings'
                    : '5-4-3-2-1 Sensory Orientation'}
                </span>
                <span className="font-mono-tabular font-semibold text-[var(--ink-primary)]">
                  {checkedGrounding.length}/{current.steps.length} · {mins}:{secs}
                </span>
              </div>
              {effectiveReduceMotion && (
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]"
                  role="progressbar"
                  aria-label="Grounding steps completed"
                  aria-valuenow={Math.round(
                    (checkedGrounding.length / Math.max(1, current.steps.length)) * 100
                  )}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(
                        (checkedGrounding.length / Math.max(1, current.steps.length)) * 100
                      )}%`,
                      backgroundColor: 'var(--q-green-solid)',
                    }}
                  />
                </div>
              )}
              {current.steps.map((stepText, idx) => {
                const done = checkedGrounding.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    aria-pressed={done}
                    onClick={() =>
                      setCheckedGrounding((prev) =>
                        prev.includes(idx)
                          ? prev.filter((x) => x !== idx)
                          : [...prev, idx]
                      )
                    }
                    className="flex min-h-[48px] w-full items-start gap-3 rounded-xl border p-3 text-left text-xs leading-relaxed transition-colors"
                    style={{
                      backgroundColor: done
                        ? 'var(--q-green-bg)'
                        : 'var(--surface-card)',
                      borderColor: done
                        ? 'var(--q-green-border)'
                        : 'var(--border-hairline)',
                      color: done ? 'var(--q-green-fg)' : 'var(--ink-primary)',
                    }}
                  >
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
                      style={{
                        backgroundColor: done ? 'var(--q-green-solid)' : 'transparent',
                        borderColor: done ? 'var(--q-green-solid)' : 'var(--border-strong)',
                        color: 'var(--q-green-ink)',
                      }}
                    >
                      {done && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span>{stepText}</span>
                  </button>
                );
              })}
            </div>
          )}

          {(current.type === 'stretch' || current.type === 'savoring') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-subtle)] p-4">
                <div>
                  <p className="text-xs text-[var(--ink-muted)]">Session Timer</p>
                  <p className="mt-0.5 font-mono-tabular text-3xl font-bold">
                    {mins}:{secs}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRunning((r) => !r)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: 'var(--accent-primary-ink)',
                    }}
                    aria-label={isRunning ? 'Pause timer' : 'Resume timer'}
                  >
                    {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetTimer}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-secondary)]"
                    aria-label="Reset timer"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <ol className="space-y-2">
                {current.steps.map((s, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3 text-xs leading-relaxed text-[var(--ink-secondary)]"
                  >
                    <span className="font-mono-tabular font-semibold text-[var(--accent-primary)]">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {current.type === 'gratitude' && (
            <form onSubmit={handleGratitudeSubmit} className="space-y-3" noValidate>
              <label htmlFor="gratitude-textarea" className="block text-xs leading-relaxed text-[var(--ink-secondary)]">
                Capture one concrete moment, person, or steady anchor from today. Saving adds
                a Grateful entry directly to your local Mood Log.
              </label>
              <textarea
                id="gratitude-textarea"
                data-autofocus="true"
                rows={4}
                value={gratitudeNote}
                onChange={(e) => {
                  setGratitudeNote(e.target.value);
                  if (gratitudeError) setGratitudeError('');
                }}
                placeholder="Today I'm grateful for…"
                aria-invalid={Boolean(gratitudeError)}
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3.5 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)]"
              />
              {gratitudeError && (
                <p role="alert" className="text-xs font-medium text-[var(--q-red-fg)]">
                  {gratitudeError}
                </p>
              )}
              <button
                type="submit"
                disabled={gratitudeSaved}
                className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-primary-ink)',
                }}
              >
                <Check className="h-4 w-4" />
                <span>
                  {gratitudeSaved ? 'Saved to Mood Log' : 'Save Gratitude to Mood Log'}
                </span>
              </button>
            </form>
          )}
        </div>

        {/* Pinned Footer Controls: Pause/Resume, Reset, Skip (in multi-step), Complete/Next */}
        {current.type !== 'gratitude' && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRunning((r) => !r)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3.5 text-xs font-semibold text-[var(--ink-primary)]"
              >
                {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{isRunning ? 'Pause' : 'Resume'}</span>
              </button>
              <button
                type="button"
                onClick={handleResetTimer}
                aria-label="Restart step timer"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {!isLast && (
                <button
                  type="button"
                  onClick={() => setStepIdx((i) => i + 1)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 text-xs font-semibold text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  <span>Skip</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleFinishOrNext}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-primary-ink)',
                }}
              >
                <span>
                  {isLast
                    ? a11y.plainLanguage
                      ? 'Finish Exercise'
                      : 'Complete Reset'
                    : 'Next Step'}
                </span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ==========================================================================
   Voice Panic Anchor — Full-screen ultra-calm breathing & voice grounding sanctuary
   ========================================================================== */

interface PanicAnchorProps {
  settings: AppSettings;
  onClose: () => void;
  onComplete: () => void;
}

const ANCHOR_PHRASES = [
  'You are safe in this room. Let your shoulders drop two inches.',
  'Feel the solid ground supporting both of your feet right now.',
  'Your nervous system is loud, not broken. Lengthen your exhale slowly.',
  'Name one quiet object in front of you and trace its edges.',
];

export const VoicePanicAnchorOverlay: React.FC<PanicAnchorProps> = ({
  settings,
  onClose,
  onComplete,
}) => {
  const a11y = useAccessibility();
  const overlayRef = useRef<HTMLDivElement>(null);

  const stopSpeech = useCallback(() => {
    stopCalmVoice();
  }, []);

  const handleSafeClose = useCallback(() => {
    stopSpeech();
    onClose();
  }, [onClose, stopSpeech]);

  const handleUnmuteSession = useCallback(() => {
    setSessionVoiceOverride(true);
  }, []);

  useFocusTrap(overlayRef, handleSafeClose, true);
  useDragToScroll(overlayRef, { axis: 'y' });

  const [isRunning, setIsRunning] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [manualPhraseOffset, setManualPhraseOffset] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [sessionVoiceOverride, setSessionVoiceOverride] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');

  const effectiveReduceMotion = a11y.reduceMotion || settings.reduceMotion;
  const effectiveVoiceOn = voiceEnabled && (!a11y.quietCues || sessionVoiceOverride);

  const startRef = useRef<number>(Date.now());
  const accMsRef = useRef<number>(0);

  // Drift-free breathing cadence timer
  useEffect(() => {
    if (!isRunning) return;
    startRef.current = Date.now();
    const timer = window.setInterval(() => {
      const ms = accMsRef.current + (Date.now() - startRef.current);
      const nextSec = Math.floor(ms / 1000);
      setElapsedSec((prev) => (prev === nextSec ? prev : nextSec));
    }, 250);
    return () => {
      accMsRef.current += Date.now() - startRef.current;
      window.clearInterval(timer);
    };
  }, [isRunning]);

  const { phase, remainingInPhase: sec, cycleIndex } = useMemo(
    () => get446State(elapsedSec),
    [elapsedSec]
  );

  const panicPhaseTotal = phase === 'Inhale' ? 4 : phase === 'Hold' ? 4 : 6;
  const panicPhasePct = Math.min(
    100,
    Math.max(0, Math.round(((panicPhaseTotal - sec + 1) / panicPhaseTotal) * 100))
  );

  const phraseIdx = (cycleIndex + manualPhraseOffset) % ANCHOR_PHRASES.length;

  useEffect(() => {
    return () => stopSpeech();
  }, []);

  // Immediately silence speech if user toggles Quiet Cues ON
  useEffect(() => {
    if (a11y.quietCues && !sessionVoiceOverride) {
      stopSpeech();
    }
  }, [a11y.quietCues, sessionVoiceOverride]);

  useEffect(() => {
    if (!effectiveVoiceOn || !isRunning) {
      stopSpeech();
      return;
    }

    // Pre-warm the next grounding cue in the background so transitions stay smooth and gentle
    const nextPhrase = ANCHOR_PHRASES[(phraseIdx + 1) % ANCHOR_PHRASES.length];
    prefetchCalmFemaleVoice(nextPhrase, 'sanctuary');

    void speakCalmFemaleVoice(ANCHOR_PHRASES[phraseIdx], {
      profile: 'sanctuary',
      onError: (msg) => {
        setVoiceNotice(msg);
        setVoiceEnabled(false);
      },
    });
  }, [effectiveVoiceOn, isRunning, phraseIdx]);

  const ringScale =
    effectiveReduceMotion || !isRunning
      ? 1
      : phase === 'Inhale'
        ? 1.24
        : phase === 'Hold'
          ? 1.24
          : 0.85;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Voice Panic Anchor grounding sanctuary"
      tabIndex={-1}
      style={{
        zIndex: 'var(--z-panic)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
      }}
      className="fixed inset-0 flex flex-col justify-between overflow-y-auto bg-[var(--surface-canvas)] px-5 sm:px-8"
    >
      {/* Top Bar */}
      <div className="mx-auto flex w-full max-w-2xl shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--ink-muted)]">
            WELLBE+ Sanctuary
          </p>
          <h2 className="text-base font-semibold text-[var(--ink-primary)]">
            {a11y.plainLanguage ? 'Panic Calm Guide' : 'Voice Panic Anchor'}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setVoiceNotice('');
              if (a11y.quietCues && !sessionVoiceOverride) {
                setSessionVoiceOverride(true);
                setVoiceEnabled(true);
              } else {
                setVoiceEnabled((v) => !v);
              }
            }}
            aria-pressed={effectiveVoiceOn}
            className="liquid-glass inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3.5 text-xs font-semibold text-[var(--ink-primary)]"
          >
            {effectiveVoiceOn ? (
              <Volume2 className="h-4 w-4 text-[var(--bio-mint)]" />
            ) : (
              <VolumeX className="h-4 w-4 text-[var(--ink-muted)]" />
            )}
            <span>
              {effectiveVoiceOn
                ? 'Voice On'
                : a11y.quietCues
                  ? 'Unmute for Session'
                  : 'Enable Voice'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleSafeClose}
            aria-label="Exit Voice Panic Anchor"
            className="liquid-glass flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--ink-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Screen-reader polite phase transition announcer */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isRunning ? `${phase} slowly` : 'Breathing paused'}
      </div>

      {/* Center Somatic Breathing Visual (dead-center across aspect ratios) */}
      <div className="mx-auto my-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-6 text-center">
        {a11y.quietCues && !effectiveVoiceOn && (
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-4 py-2.5 text-xs text-[var(--ink-secondary)]">
            <VolumeX className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
            <span>Quiet Cues Active · Visual-Only Mode</span>
            <button
              type="button"
              onClick={() => {
                setSessionVoiceOverride(true);
                setVoiceEnabled(true);
              }}
              className="rounded-lg font-semibold text-[var(--accent-primary)] underline underline-offset-2"
            >
              Unmute voice for this session
            </button>
          </div>
        )}

        {effectiveReduceMotion ? (
          <div className="w-full space-y-5 rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--bio-mint)] tabular-nums">
              {isRunning ? `${phase} · ${sec}s` : 'Paused'}
            </p>
            <p className="font-mono-tabular text-6xl font-semibold text-[var(--ink-primary)]">
              {sec}s
            </p>

            {/* Static Phase Progress Bar (replaces pulsing circle cleanly) */}
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]"
              role="progressbar"
              aria-label="Current breathing phase progress"
              aria-valuenow={panicPhasePct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full w-full origin-left rounded-full"
                style={{
                  transform: `scaleX(${panicPhasePct / 100})`,
                  backgroundColor: 'var(--bio-mint)',
                }}
              />
            </div>

            <div
              className="grid grid-cols-3 gap-2"
              role="group"
              aria-label="4-4-6 breathing cadence phases"
            >
              {(
                [
                  { id: 'Inhale', dur: '4s' },
                  { id: 'Hold', dur: '4s' },
                  { id: 'Exhale', dur: '6s' },
                ] as const
              ).map((seg) => {
                const active = isRunning && phase === seg.id;
                return (
                  <div
                    key={seg.id}
                    className="rounded-xl border px-2 py-2.5 text-center"
                    style={{
                      backgroundColor: active
                        ? 'var(--accent-primary)'
                        : 'var(--surface-subtle)',
                      color: active ? 'var(--accent-primary-ink)' : 'var(--ink-secondary)',
                      borderColor: active
                        ? 'var(--accent-primary)'
                        : 'var(--border-hairline)',
                    }}
                  >
                    <p className="text-xs font-semibold">{seg.id}</p>
                    <p className="font-mono-tabular text-[11px] opacity-90">{seg.dur}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
            <div
              className="liquid-glass absolute inset-0 rounded-full transition-transform duration-1000"
              style={{
                transform: `scale(${ringScale})`,
                borderColor: 'var(--bio-mint)',
              }}
            />
            <div className="relative z-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--bio-mint)]">
                {isRunning ? phase : 'Paused'}
              </p>
              <p className="mt-2 font-mono-tabular text-5xl font-bold text-[var(--ink-primary)]">
                {sec}
              </p>
              <p className="mt-2 text-xs text-[var(--ink-muted)]">
                4s in · 4s hold · 6s slow exhale
              </p>
            </div>
          </div>
        )}

        <p
          aria-live="polite"
          className="wb-prose mt-8 text-lg font-medium leading-relaxed text-[var(--ink-primary)]"
          style={{ textWrap: 'balance' }}
        >
          {ANCHOR_PHRASES[phraseIdx]}
        </p>

        {voiceNotice && (
          <p role="status" className="mt-2 text-xs text-[var(--ink-muted)]">
            {voiceNotice}
          </p>
        )}

        {/* Local Procedural Ambient Audio — Warm Piano & Pad */}
        <div className="mt-6 w-full max-w-md">
          <SoothingRelaxationAudio
            sessionRunning={isRunning}
            mutedByQuietMode={a11y.quietCues && !sessionVoiceOverride}
            onRequestUnmuteSession={handleUnmuteSession}
            variant="sanctuary"
          />
        </div>
      </div>

      {/* Bottom Safe Controls */}
      <div className="mx-auto flex w-full max-w-md shrink-0 flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => setIsRunning((r) => !r)}
          className="liquid-glass inline-flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-[var(--ink-primary)]"
        >
          {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          <span>{isRunning ? 'Pause' : 'Resume'}</span>
        </button>
        <button
          type="button"
          onClick={() => setManualPhraseOffset((o) => o + 1)}
          className="liquid-glass min-h-[46px] flex-1 rounded-xl px-4 text-xs font-semibold text-[var(--ink-primary)]"
        >
          Next Cue
        </button>
        <button
          type="button"
          onClick={() => {
            stopSpeech();
            onComplete();
            onClose();
          }}
          className="min-h-[46px] flex-1 rounded-xl px-4 text-xs font-semibold"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--accent-primary-ink)',
          }}
        >
          I Feel Steadier
        </button>
      </div>
    </div>
  );
};
