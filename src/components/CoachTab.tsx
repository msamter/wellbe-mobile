import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Watch,
  Wind,
} from 'lucide-react';
import { AppSettings, CoachMessage, MoodEntry, ResetProtocol } from '../types/wellbe';
import { RESET_PROTOCOLS } from '../data/wellbeData';
import { TrendsAnalytics } from '../utils/analytics';
import { useDragToScroll } from '../hooks/useDragToScroll';
import { speakCalmFemaleVoice, stopCalmVoice } from '../utils/voiceover';
import { getM3Spring, m3Shapes } from '../design/m3ExpressiveTokens';
import {
  ExpressiveMorphLoader,
  ExpressiveSkeletonBone,
} from './ExpressiveLoaders';
import { ExpressiveButton } from './ExpressiveControls';

interface CoachTabProps {
  isActive?: boolean;
  messages: CoachMessage[];
  analytics: TrendsAnalytics; // Always 7-day baseline context
  entries: MoodEntry[];
  settings: AppSettings;
  onAddMessage: (msg: CoachMessage) => void;
  onClearChat: () => void;
  onLaunchProtocol: (protocol: ResetProtocol) => void;
  onOpenTherapistSummary: () => void;
}

const PROMPT_SETS: string[][] = [
  [
    'Unpack my recent 7-day mood trends',
    'Suggest a 3-minute reset for work stress',
    'Help me label mixed emotions right now',
  ],
  [
    'How did my sleep hours affect my afternoon mood?',
    'Design a calm wind-down for higher resting HR nights',
    'Why do my lower-energy check-ins cluster in certain windows?',
  ],
  [
    'Reflect on my most uplifting context drivers this week',
    'Prepare 3 grounded talking points for my therapist',
    'Walk me through releasing physical shoulder and jaw tension',
  ],
];

const BREATHING_PROTOCOL = RESET_PROTOCOLS[0];
const GROUNDING_PROTOCOL = RESET_PROTOCOLS[2];

interface CoachMessageRowProps {
  msg: CoachMessage;
  isSpeaking: boolean;
  reduceMotion?: boolean;
  calmMode?: boolean;
  onToggleSpeak: (msg: CoachMessage) => void;
}

const CoachMessageRow: React.FC<CoachMessageRowProps> = React.memo(
  ({ msg, isSpeaking, reduceMotion = false, calmMode = false, onToggleSpeak }) => {
    const isUser = msg.role === 'user';
    const entranceTransition = getM3Spring('defaultSpatial', {
      reduceMotion,
      calmMode,
    });
    return (
      <motion.div
        layout={false}
        initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={entranceTransition}
        role={msg.isError ? 'alert' : undefined}
        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
      >
        <div
          className="min-w-0 max-w-[90%] select-text rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
          style={
            isUser
              ? {
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-primary-ink)',
                }
              : msg.isError
                ? {
                    backgroundColor: 'var(--q-red-bg)',
                    color: 'var(--q-red-fg)',
                    border: '1px solid var(--q-red-border)',
                  }
                : {
                    backgroundColor: 'var(--surface-subtle)',
                    color: 'var(--ink-primary)',
                    border: '1px solid var(--border-hairline)',
                  }
          }
        >
          {!isUser && (
            <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold opacity-90">
              <div className="flex items-center gap-1.5">
                {msg.isError ? (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Sparkles className="h-3 w-3 shrink-0 text-[var(--bio-mint)]" />
                )}
                <span>{msg.isError ? 'Coach Connection Notice' : 'AI Coach'}</span>
              </div>
              {!msg.isError && (
                <button
                  type="button"
                  onClick={() => onToggleSpeak(msg)}
                  aria-pressed={isSpeaking}
                  aria-label={isSpeaking ? 'Stop voiceover' : 'Listen with gentle voice'}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="h-3 w-3 text-[var(--bio-mint)]" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3 w-3" />
                      <span>Listen</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
          <div className="wb-prose overflow-x-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {msg.content}
          </div>
          {msg.citations && msg.citations.length > 0 && (
            <p className="mt-2 break-words border-t border-[var(--border-hairline)] pt-1.5 text-xs text-[var(--ink-muted)] tabular-nums">
              Grounded in: {msg.citations.join(' · ')}
            </p>
          )}
        </div>
      </motion.div>
    );
  }
);
CoachMessageRow.displayName = 'CoachMessageRow';

interface CoachTelemetrySidebarProps {
  analytics: TrendsAnalytics;
  plainLanguage: boolean;
  mobileVisible: boolean;
  onLaunchProtocol: (protocol: ResetProtocol) => void;
  onOpenTherapistSummary: () => void;
}

const CoachTelemetrySidebar: React.FC<CoachTelemetrySidebarProps> = React.memo(
  ({
    analytics,
    plainLanguage,
    mobileVisible,
    onLaunchProtocol,
    onOpenTherapistSummary,
  }) => {
    const sidebarScrollRef = useRef<HTMLElement>(null);
    useDragToScroll(sidebarScrollRef, { axis: 'y' });

    return (
      <aside
        ref={sidebarScrollRef}
        aria-label="Live telemetry context shared with coach"
        className={`wb-surface hide-scrollbar min-h-0 min-w-0 flex-1 flex-col justify-between gap-3 overflow-y-auto overscroll-contain rounded-2xl p-4 lg:flex lg:w-[328px] lg:flex-none xl:w-[376px] ${
          mobileVisible ? 'flex' : 'hidden'
        }`}
      >
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--bio-mint)]">
              <Watch className="h-3.5 w-3.5 shrink-0" />
              <span>
                {plainLanguage
                  ? 'Your Recent Watch & Mood Summary'
                  : 'Factual Telemetry Context'}
              </span>
            </div>
            <h2 className="mt-0.5 text-sm font-semibold text-[var(--ink-primary)]">
              Live 7-Day Reference
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              Metrics passed to WELLBE+ Coach so advice stays grounded in your real logs.
            </p>
          </div>

          <dl className="divide-y divide-[var(--border-hairline)] border-y border-[var(--border-hairline)] text-xs">
            <div className="flex justify-between gap-2 py-2">
              <dt className="text-[var(--ink-muted)]">Mood average</dt>
              <dd className="text-right font-mono-tabular font-semibold text-[var(--ink-primary)]">
                {analytics.avgScore !== null
                  ? `${analytics.avgScore.toFixed(1)}/5.0 · ${analytics.avgStateLabel}`
                  : 'No logs yet'}
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-2">
              <dt className="text-[var(--ink-muted)]">
                {plainLanguage ? 'Energy reserve score' : 'Burnout index'}
              </dt>
              <dd className="text-right font-mono-tabular font-semibold text-[var(--ink-primary)]">
                {analytics.burnoutScore}/100 · {analytics.burnoutZone}
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-2">
              <dt className="text-[var(--ink-muted)]">Avg Sleep (Watch)</dt>
              <dd className="text-right font-mono-tabular font-semibold text-[var(--ink-primary)]">
                {analytics.avgSleepHours.toFixed(1)}h · Q{analytics.avgSleepQuality}
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-2">
              <dt className="text-[var(--ink-muted)]">
                {plainLanguage
                  ? 'Heart Rate Variability / Resting HR'
                  : 'Est. HRV / Resting HR'}
              </dt>
              <dd className="shrink-0 text-right font-mono-tabular font-semibold text-[var(--ink-primary)]">
                {analytics.avgHrvMs} ms · {analytics.avgRestingHr} bpm
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-2">
              <dt className="text-[var(--ink-muted)]">Top uplifting driver</dt>
              <dd className="font-semibold text-[var(--ink-primary)]">
                {analytics.topUpliftingDriver?.tag ?? '—'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[var(--ink-muted)]">
            {plainLanguage ? 'Quick Calming Exercises' : 'Quick Somatic Shortcuts'}
          </p>
          <button
            type="button"
            onClick={() => onLaunchProtocol(BREATHING_PROTOCOL)}
            className="flex min-h-[38px] w-full items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <span className="flex items-center gap-2">
              <Wind className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              <span>4-7-8 Calm Breathing</span>
            </span>
            <span className="text-[var(--ink-muted)]">Launch</span>
          </button>
          <button
            type="button"
            onClick={() => onLaunchProtocol(GROUNDING_PROTOCOL)}
            className="flex min-h-[38px] w-full items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <span>Mindful Grounding Scan</span>
            <span className="text-[var(--ink-muted)]">Launch</span>
          </button>
          <button
            type="button"
            onClick={onOpenTherapistSummary}
            className="flex min-h-[38px] w-full items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <span>Generate Therapist Summary</span>
            <span className="text-[var(--ink-muted)]">Open</span>
          </button>
        </div>
      </aside>
    );
  }
);
CoachTelemetrySidebar.displayName = 'CoachTelemetrySidebar';

export const CoachTab: React.FC<CoachTabProps> = React.memo(
  ({
    isActive = true,
    messages,
    analytics,
    entries,
    settings,
    onAddMessage,
    onClearChat,
    onLaunchProtocol,
    onOpenTherapistSummary,
  }) => {
    const [input, setInput] = useState('');
    const [promptSetIdx, setPromptSetIdx] = useState(0);
    const [isSending, setIsSending] = useState(false);
    const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
    const speakingMsgIdRef = useRef<string | null>(null);
    speakingMsgIdRef.current = speakingMsgId;
    const [mobileView, setMobileView] = useState<'chat' | 'context'>('chat');
    const scrollRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const requestGenRef = useRef(0);
    useDragToScroll(scrollRef, { axis: 'y' });

    useEffect(() => {
      if (!isActive && speakingMsgIdRef.current !== null) {
        stopCalmVoice();
        setSpeakingMsgId(null);
      }
    }, [isActive]);

    useEffect(() => {
      return () => {
        requestGenRef.current += 1;
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        stopCalmVoice();
      };
    }, []);

    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [messages, isSending, mobileView]);

    const handleToggleSpeakMessage = useCallback((msg: CoachMessage) => {
      if (speakingMsgIdRef.current === msg.id) {
        stopCalmVoice();
        setSpeakingMsgId(null);
        return;
      }
      setSpeakingMsgId(msg.id);
      void speakCalmFemaleVoice(msg.content, {
        onEnd: () => {
          setSpeakingMsgId((curr) => (curr === msg.id ? null : curr));
        },
        onError: () => {
          setSpeakingMsgId((curr) => (curr === msg.id ? null : curr));
        },
      });
    }, []);

    const handleClearThread = () => {
      requestGenRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      stopCalmVoice();
      setSpeakingMsgId(null);
      setIsSending(false);
      onClearChat();
    };

    const sendPrompt = async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      setMobileView('chat');
      requestGenRef.current += 1;
      const myGen = requestGenRef.current;
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const userMsg: CoachMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };
      onAddMessage(userMsg);
      setInput('');
      setIsSending(true);

      const historyPayload = [...messages.filter((m) => !m.isError), userMsg]
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const contextSummary = {
        rangeLabel: analytics.rangeLabel,
        totalLogged: analytics.totalLoggedAllTime,
        avgScore: analytics.avgScore ?? 3.0,
        avgState: analytics.avgStateLabel,
        streakDays: analytics.activeStreak,
        burnoutScore: analytics.burnoutScore,
        burnoutZone: analytics.burnoutZone,
        avgSleepHours: analytics.avgSleepHours,
        avgSleepQuality: analytics.avgSleepQuality,
        avgHrv: analytics.avgHrvMs,
        avgRestingHr: analytics.avgRestingHr,
        topDriver:
          analytics.topUpliftingDriver && analytics.topUpliftingDriver.avgScore !== null
            ? `${analytics.topUpliftingDriver.tag} (${analytics.topUpliftingDriver.avgScore.toFixed(1)}/5.0 across ${analytics.topUpliftingDriver.count} logs)`
            : 'No context drivers logged yet',
        recentEntries: entries.slice(0, 8).map((e) => ({
          date: e.dateKey,
          emotion: e.emotionLabel,
          score: e.score,
          tags: e.tags,
          note: e.note,
          source: e.source === 'watch' ? 'Pixel Watch' : 'App',
        })),
      };

      try {
        const res = await fetch('/api/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            messages: historyPayload,
            contextSummary,
          }),
        });
        let data: { reply?: string; citations?: string[]; error?: string } = {};
        try {
          data = (await res.json()) as { reply?: string; citations?: string[]; error?: string };
        } catch {
          data = {};
        }
        if (requestGenRef.current !== myGen) return;
        if (!res.ok || typeof data.reply !== 'string') {
          throw new Error(data?.error || `Request failed with status ${res.status}`);
        }

        onAddMessage({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toISOString(),
          citations: data.citations,
        });
      } catch (err: unknown) {
        if (
          requestGenRef.current !== myGen ||
          (err instanceof DOMException && err.name === 'AbortError')
        ) {
          return;
        }
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Unable to connect to WELLBE+ Coach right now.';
        onAddMessage({
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date().toISOString(),
          isError: true,
        });
      } finally {
        if (requestGenRef.current === myGen) {
          abortControllerRef.current = null;
          setIsSending(false);
        }
      }
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      void sendPrompt(input);
    };

    const activeSuggestions = PROMPT_SETS[promptSetIdx];

    return (
      <div className="wb-coach-viewport flex min-h-0 flex-1 flex-col gap-2 overflow-hidden sm:gap-2.5">
        {/* Header: WELLBE+ Coach title on top, date range & log count subheader beneath, full-size Context button */}
        <section className="flex shrink-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="text-2xl font-semibold tracking-tight text-[var(--ink-primary)] sm:text-[28px]"
              style={{ textWrap: 'balance' }}
            >
              WELLBE+ Coach
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-normal text-[var(--ink-muted)] tabular-nums">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--bio-mint)]" aria-hidden="true" />
              <span className="truncate">
                {analytics.rangeLabel}
                {analytics.totalLoggedInRange > 0
                  ? ` · ${analytics.totalLoggedInRange} ${analytics.totalLoggedInRange === 1 ? 'log' : 'logs'}`
                  : ''}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Full-Size Mobile/Tablet Context Switcher */}
            <ExpressiveButton
              variant="outlined"
              size="md"
              selected={mobileView === 'context'}
              onClick={() =>
                setMobileView((v) => (v === 'chat' ? 'context' : 'chat'))
              }
              aria-pressed={mobileView === 'context'}
              leadingIcon={
                mobileView === 'chat' ? (
                  <Watch className="h-4 w-4 shrink-0 text-[var(--bio-mint)]" />
                ) : (
                  <MessageSquare className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                )
              }
              className="lg:hidden"
            >
              {mobileView === 'chat' ? 'Context' : 'Chat'}
            </ExpressiveButton>

            {messages.length > 0 && (
              <ExpressiveButton
                variant="outlined"
                size="md"
                onClick={handleClearThread}
                leadingIcon={<Trash2 className="h-4 w-4 shrink-0" />}
                className="text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
              >
                New Thread
              </ExpressiveButton>
            )}
          </div>
        </section>

        {/* Single-Viewport Flexbox Workspace: Chat Window (flex-1) + Live Factual Telemetry Context */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row lg:items-stretch lg:gap-4">
          {/* Conversation Panel (flexbox flex-1 + min-h-0 fills remaining vertical space without overflow) */}
          <section
            aria-label="WELLBE+ Coach conversation"
            className={`wb-surface wb-coach-chat-window min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3 sm:p-4 lg:flex ${
              mobileView === 'chat' ? 'flex' : 'hidden'
            }`}
          >
            <div
              ref={scrollRef}
              className="hide-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-2 pr-0.5"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.length === 0 ? (
                <div className="flex min-h-full flex-col py-1.5">
                  <div className="my-auto w-full">
                    <div className="mx-auto max-w-md text-center">
                      <div
                        className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor: 'var(--accent-soft)',
                          color: 'var(--accent-primary)',
                        }}
                      >
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <h2 className="mt-2 text-lg font-semibold text-[var(--ink-primary)]">
                        What&apos;s on your mind?
                      </h2>
                      <p className="wb-prose mx-auto mt-1 text-xs leading-relaxed text-[var(--ink-secondary)] sm:text-sm">
                        Reflections are grounded directly in your local mood entries and Pixel
                        Watch sleep, HRV, and resting heart rate telemetry.
                      </p>
                    </div>

                    {/* 3 Clickable Starter Prompts (compact to fit cleanly in one viewport) */}
                    <div className="mx-auto mt-3 w-full max-w-md space-y-1.5 sm:mt-4 sm:space-y-2">
                      {activeSuggestions.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void sendPrompt(prompt)}
                          className="flex min-h-[38px] w-full items-center justify-between gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 py-2 text-left text-xs font-medium text-[var(--ink-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] sm:min-h-[40px] sm:text-sm"
                        >
                          <span>{prompt}</span>
                          <Send className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" />
                        </button>
                      ))}

                      <div className="pt-0.5 text-center">
                        <ExpressiveButton
                          variant="text"
                          size="sm"
                          onClick={() =>
                            setPromptSetIdx((i) => (i + 1) % PROMPT_SETS.length)
                          }
                          leadingIcon={<RefreshCw className="h-3.5 w-3.5" />}
                          className="hover:bg-[var(--accent-soft)]"
                        >
                          Show 3 other suggestions
                        </ExpressiveButton>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <CoachMessageRow
                    key={msg.id}
                    msg={msg}
                    isSpeaking={speakingMsgId === msg.id}
                    reduceMotion={settings.reduceMotion}
                    calmMode={settings.calmMode}
                    onToggleSpeak={handleToggleSpeakMessage}
                  />
                ))
              )}

              <AnimatePresence>
                {isSending && (
                  <motion.div
                    key="coach-thinking"
                    initial={settings.reduceMotion ? false : { opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={settings.reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
                    transition={getM3Spring('defaultEffects', {
                      reduceMotion: settings.reduceMotion,
                      calmMode: settings.calmMode,
                    })}
                    className="flex items-start"
                    role="status"
                    aria-live="polite"
                  >
                    <div
                      className="w-full max-w-[85%] space-y-2.5 border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3.5"
                      style={{ borderRadius: m3Shapes.large }}
                    >
                      <div className="flex items-center gap-3">
                        <ExpressiveMorphLoader
                          size={34}
                          label="WELLBE+ Coach is reflecting"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[var(--ink-primary)]">
                            Reviewing your 7-day logs &amp; biometrics
                          </p>
                          <p className="text-[11px] text-[var(--ink-muted)]">
                            Drafting a grounded reflection…
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1.5 pl-1">
                        <ExpressiveSkeletonBone width="92%" height={10} />
                        <ExpressiveSkeletonBone width="68%" height={10} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Pinned Message Composer (always visible inside the single viewport) */}
            <form
              onSubmit={handleSubmit}
              className="mt-2 flex shrink-0 items-center gap-2 border-t border-[var(--border-hairline)] pt-2.5 sm:mt-2.5"
            >
              <label htmlFor="coach-composer-input" className="sr-only">
                Message WELLBE+ Coach
              </label>
              <input
                id="coach-composer-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isSending}
                placeholder="Ask about moods, sleep, or a quick reset..."
                className="min-h-[42px] min-w-0 flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)]"
              />
              <ExpressiveButton
                type="submit"
                variant="filled"
                size="md"
                disabled={isSending || !input.trim()}
                leadingIcon={<Send className="h-4 w-4" />}
                aria-label="Send message to WELLBE+ Coach"
              >
                <span className={settings.plainLanguage ? 'inline' : 'hidden sm:inline'}>Send</span>
              </ExpressiveButton>
            </form>
          </section>

          {/* Live Factual Telemetry Context Sidebar (memoized against message/input updates) */}
          <CoachTelemetrySidebar
            analytics={analytics}
            plainLanguage={settings.plainLanguage}
            mobileVisible={mobileView === 'context'}
            onLaunchProtocol={onLaunchProtocol}
            onOpenTherapistSummary={onOpenTherapistSummary}
          />
        </div>
      </div>
    );
  }
);
CoachTab.displayName = 'CoachTab';
