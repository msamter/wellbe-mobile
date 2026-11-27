import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bug,
  Check,
  Copy,
  ExternalLink,
  Heart,
  HeartHandshake,
  Mail,
  Phone,
  Wind,
} from 'lucide-react';
import { AppTab } from '../types/wellbe';
import {
  APP_BUILD_CHANNEL,
  APP_NAME,
  APP_VERSION,
  FEEDBACK_EMAIL,
} from '../data/appMeta';
import { useAccessibility } from '../context/AccessibilityContext';
import { BentoSummaryPill, SettingsBentoAccordion } from './SettingsBentoAccordion';

export interface HelpSupportTabProps {
  openSectionId: string | null;
  onToggleSection: (id: string) => void;
  onOpenSection?: (id: string) => void;
  activeView: AppTab;
  themeLabel: string;
  onLaunchBreathingReset: () => void;
  onAnnounce: (msg: string) => void;
  onNotify?: (title: string, subtitle?: string) => void;
}

type SupportSectionKey = 'nami';

const VIEW_LABELS: Record<AppTab, string> = {
  today: 'Today',
  routines: 'Routines',
  log: 'Mood Log',
  trends: 'Trends',
  coach: 'Coach',
};

export const HelpSupportTab: React.FC<HelpSupportTabProps> = ({
  openSectionId,
  onToggleSection,
  onOpenSection,
  activeView,
  themeLabel,
  onLaunchBreathingReset,
  onAnnounce,
  onNotify,
}) => {
  const a11y = useAccessibility();
  const [copiedContext, setCopiedContext] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const namiSectionRef = useRef<HTMLElement | null>(null);
  const feedbackSectionRef = useRef<HTMLElement | null>(null);

  const isSectionExpanded = (key: SupportSectionKey) => openSectionId === key;
  const activeViewLabel = VIEW_LABELS[activeView] ?? activeView;

  const diagnosticContext = useMemo(() => {
    const viewport =
      typeof window !== 'undefined'
        ? `${window.innerWidth}×${window.innerHeight}`
        : 'Unknown';
    return [
      `App: ${APP_NAME} v${APP_VERSION} (${APP_BUILD_CHANNEL})`,
      `Current View: ${activeViewLabel}`,
      `Theme: ${themeLabel}`,
      `Viewport: ${viewport}`,
    ].join('\n');
  }, [activeViewLabel, themeLabel]);

  const mailtoHref = useMemo(() => {
    const subject = `${APP_NAME} v${APP_VERSION} Feedback / Bug Report (${activeViewLabel})`;
    const body = [
      'Hi WELLBE+ team,',
      '',
      'Describe your feedback or issue below:',
      '',
      '',
      '--- Context ---',
      diagnosticContext,
    ].join('\n');
    return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [activeViewLabel, diagnosticContext]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
    };
  }, []);

  const scrollToTarget = (target: 'nami' | 'feedback') => {
    if (target === 'nami') {
      if (onOpenSection) onOpenSection('nami');
      else if (!isSectionExpanded('nami')) onToggleSection('nami');
    }
    const reduced =
      a11y.reduceMotion ||
      (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(
      () => {
        scrollTimerRef.current = null;
        const el = target === 'nami' ? namiSectionRef.current : feedbackSectionRef.current;
        el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      },
      reduced ? 0 : 40
    );
    onAnnounce(
      target === 'nami'
        ? 'Jumped to NAMI & 24/7 crisis support details.'
        : 'Jumped to Feedback & Bug Report.'
    );
  };

  const handleCopyReportContext = async () => {
    const text = `Feedback Contact: ${FEEDBACK_EMAIL}\n${diagnosticContext}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedContext(true);
      onAnnounce('Feedback email and app diagnostics copied to clipboard.');
      onNotify?.('Report context copied', `Ready to paste into an email to ${FEEDBACK_EMAIL}`);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedContext(false);
        copyTimerRef.current = null;
      }, 2500);
    } catch {
      onAnnounce(`Clipboard unavailable. Contact ${FEEDBACK_EMAIL}.`);
      onNotify?.('Clipboard unavailable', `Send feedback directly to ${FEEDBACK_EMAIL}`);
    }
  };

  const namiPills: BentoSummaryPill[] = [
    { label: 'NAMI.org', tone: 'accent' },
    { label: '24/7 Crisis Info', tone: 'positive' },
  ];

  return (
    <div
      id="settings-panel-support"
      role="tabpanel"
      aria-labelledby="settings-tab-support"
      className="wb-calm-stack space-y-3.5 pb-4"
    >
      {/* Unified Section Header */}
      <div className="border-b border-[var(--border-hairline)] pb-3">
        <h2 className="text-base font-semibold tracking-tight text-[var(--ink-primary)]">
          Help &amp; Support
        </h2>
        <p className="wb-prose mt-0.5 text-xs text-[var(--ink-muted)]">
          24/7 crisis care, NAMI helplines &amp; app feedback
        </p>
      </div>

      {/* Immediate Quick-Reach Row: 988, NAMI & Feedback */}
      <nav
        aria-label="Quick support actions"
        className="wb-pane-grid-3"
      >
        <a
          href="tel:988"
          data-no-drag-scroll="true"
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--brand-accent-border)] bg-[var(--brand-accent-soft)] px-3 text-xs font-semibold text-[var(--brand-accent-text)] transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)]"
        >
          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Call 988 (24/7)</span>
        </a>
        <button
          type="button"
          data-no-drag-scroll="true"
          onClick={() => scrollToTarget('nami')}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)]"
        >
          <HeartHandshake
            className="h-3.5 w-3.5 shrink-0 text-[var(--brand-accent-text)]"
            aria-hidden="true"
          />
          <span>NAMI Support</span>
        </button>
        <button
          type="button"
          data-no-drag-scroll="true"
          onClick={() => scrollToTarget('feedback')}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)]"
        >
          <Bug className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
          <span>Send Feedback</span>
        </button>
      </nav>

      {/* Concise Grounding Card + One-Tap Routines Launch (Full-Width Stacked Copy) */}
      <section
        aria-labelledby="support-grounding-heading"
        className="wb-support-grounding space-y-3 rounded-2xl p-3.5 sm:p-4"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'var(--support-banner-icon-bg)',
              color: 'var(--support-banner-icon-fg)',
            }}
          >
            <HeartHandshake className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h3
              id="support-grounding-heading"
              className="text-sm font-semibold leading-snug text-[var(--ink-primary)]"
            >
              Take a slow breath—you don&apos;t have to carry this alone.
            </h3>
            <p className="wb-prose text-xs leading-relaxed text-[var(--ink-secondary)]">
              Choose whichever next step feels easiest right now.
            </p>
          </div>
        </div>

        <button
          type="button"
          data-no-drag-scroll="true"
          onClick={onLaunchBreathingReset}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3.5 text-xs font-semibold transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)]"
          style={{
            backgroundColor: 'var(--support-secondary-bg)',
            borderColor: 'var(--support-secondary-border)',
            color: 'var(--support-secondary-fg)',
          }}
        >
          <Wind className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{a11y.plainLanguage ? 'Open Calming Routines' : 'Open Routines'}</span>
        </button>
      </section>

      {/* Mental Health & Crisis Resources (NAMI & 988) */}
      <SettingsBentoAccordion
        id="support-nami"
        title={
          a11y.plainLanguage
            ? 'Free Mental Health Help (NAMI)'
            : 'Mental Health & Crisis Support (NAMI)'
        }
        subtitle="Free education, peer groups, and 24/7 human helplines"
        icon={<HeartHandshake className="h-4 w-4" />}
        pills={namiPills}
        isOpen={isSectionExpanded('nami')}
        onToggle={() => onToggleSection('nami')}
        sectionRef={(el) => {
          namiSectionRef.current = el;
        }}
      >
        <div className="space-y-3">
          {/* Direct Human Support Cards */}
          <div className="space-y-2">
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3">
              <div className="flex items-start gap-2.5">
                <Heart
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bio-mint)]"
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-xs font-semibold text-[var(--ink-primary)]">
                    Immediate 24/7 Crisis Support
                  </p>
                  <p className="wb-prose break-words text-xs leading-relaxed text-[var(--ink-secondary)]">
                    Call or text{' '}
                    <a
                      href="tel:988"
                      className="font-mono-tabular font-bold text-[var(--brand-accent-text)] underline underline-offset-2"
                    >
                      988
                    </a>{' '}
                    (Suicide &amp; Crisis Lifeline — free, confidential, 24/7).
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3">
              <div className="flex items-start gap-2.5">
                <Phone
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-accent-text)]"
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-xs font-semibold text-[var(--ink-primary)]">NAMI HelpLine</p>
                  <p className="wb-prose break-words text-xs leading-relaxed text-[var(--ink-secondary)]">
                    Call{' '}
                    <a
                      href="tel:18009506264"
                      className="font-mono-tabular font-semibold text-[var(--brand-accent-text)] underline underline-offset-2"
                    >
                      1-800-950-6264
                    </a>{' '}
                    or text{' '}
                    <strong className="font-semibold text-[var(--ink-primary)]">HelpLine</strong>{' '}
                    to{' '}
                    <span className="font-mono-tabular font-semibold text-[var(--ink-primary)]">
                      62640
                    </span>{' '}
                    (Mon–Fri, 10 AM–10 PM ET){' '}
                    <span aria-hidden="true">·</span>{' '}
                    <a
                      href="https://www.nami.org/help"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[var(--brand-accent-text)] underline underline-offset-2"
                    >
                      nami.org/help
                      <span className="sr-only"> (Opens in a new tab)</span>
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <a
            href="https://www.nami.org"
            target="_blank"
            rel="noopener noreferrer"
            data-no-drag-scroll="true"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold transition-opacity hover:opacity-95"
            style={{
              backgroundColor: 'var(--support-cta-bg)',
              color: 'var(--support-cta-fg)',
            }}
          >
            <span>Visit NAMI Website</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only"> (Opens NAMI.org in a new tab)</span>
          </a>
        </div>
      </SettingsBentoAccordion>

      {/* App Help: Feedback & Bug Report */}
      <section
        ref={feedbackSectionRef}
        aria-labelledby="support-feedback-heading"
        className="scroll-mt-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3.5"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--brand-accent-text)]"
          >
            <Bug className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3
              id="support-feedback-heading"
              className="text-sm font-semibold text-[var(--ink-primary)]"
            >
              Feedback &amp; Bug Report
            </h3>
            <p className="wb-prose mt-0.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
              Send notes to{' '}
              <span className="font-mono-tabular font-semibold text-[var(--ink-primary)]">
                {FEEDBACK_EMAIL}
              </span>{' '}
              with <span className="font-mono-tabular">v{APP_VERSION}</span> and{' '}
              <span className="font-semibold text-[var(--ink-primary)]">{activeViewLabel}</span>{' '}
              pre-filled.
            </p>
          </div>
        </div>

        <div className="wb-pane-item-actions mt-3">
          <a
            href={mailtoHref}
            data-no-drag-scroll="true"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-center text-xs font-semibold leading-snug transition-opacity hover:opacity-95"
            style={{
              backgroundColor: 'var(--brand-action-bg)',
              color: 'var(--brand-action-fg)',
            }}
          >
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span>Send Feedback / Bug Report</span>
          </a>

          <button
            type="button"
            data-no-drag-scroll="true"
            onClick={handleCopyReportContext}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 py-2 text-center text-xs font-semibold leading-snug text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            {copiedContext ? (
              <>
                <Check className="h-3.5 w-3.5 shrink-0 text-[var(--bio-mint)]" />
                <span>Copied Context</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" />
                <span>Copy Context</span>
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
};
