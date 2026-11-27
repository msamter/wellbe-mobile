import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileText,
  Info,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  APP_BUILD_CHANNEL,
  APP_NAME,
  APP_RELEASE_DATE,
  APP_VERSION,
  PRIVACY_POLICY_SECTIONS,
  RELEASE_NOTES,
  TERMS_OF_USE_SECTIONS,
} from '../data/appMeta';
import { BentoSummaryPill, SettingsBentoAccordion } from './SettingsBentoAccordion';

export interface HelpLegalAboutTabProps {
  openSectionId: string | null;
  onToggleSection: (id: string) => void;
  onResetAppDefaults: () => void;
  onAnnounce: (msg: string) => void;
}

type AboutSectionKey = 'releases' | 'privacy' | 'terms';

export const HelpLegalAboutTab: React.FC<HelpLegalAboutTabProps> = ({
  openSectionId,
  onToggleSection,
  onResetAppDefaults,
  onAnnounce,
}) => {
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetDoneNotice, setResetDoneNotice] = useState(false);

  const resetTriggerRef = useRef<HTMLButtonElement | null>(null);
  const cancelResetBtnRef = useRef<HTMLButtonElement | null>(null);
  const resetNoticeTimerRef = useRef<number | null>(null);
  const focusRafRef = useRef<number | null>(null);

  const isSectionExpanded = (key: AboutSectionKey) => openSectionId === key;

  const scheduleFocusTrigger = () => {
    if (focusRafRef.current !== null) {
      window.cancelAnimationFrame(focusRafRef.current);
    }
    focusRafRef.current = window.requestAnimationFrame(() => {
      focusRafRef.current = null;
      resetTriggerRef.current?.focus();
    });
  };

  useEffect(() => {
    return () => {
      if (resetNoticeTimerRef.current !== null) window.clearTimeout(resetNoticeTimerRef.current);
      if (focusRafRef.current !== null) window.cancelAnimationFrame(focusRafRef.current);
    };
  }, []);

  // Move focus into confirmation dialog on open and trap Escape so it closes only the prompt
  useEffect(() => {
    if (!confirmResetOpen) return;
    cancelResetBtnRef.current?.focus();

    const handleEscapeCapture = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setConfirmResetOpen(false);
      scheduleFocusTrigger();
    };

    document.addEventListener('keydown', handleEscapeCapture, true);
    return () => {
      document.removeEventListener('keydown', handleEscapeCapture, true);
    };
  }, [confirmResetOpen]);

  const handleCancelReset = () => {
    setConfirmResetOpen(false);
    scheduleFocusTrigger();
  };

  const handleConfirmReset = () => {
    onResetAppDefaults();
    setConfirmResetOpen(false);
    setResetDoneNotice(true);
    onAnnounce(
      'App preferences and accessibility defaults restored. Saved mood check-ins were preserved.'
    );
    if (resetNoticeTimerRef.current !== null) window.clearTimeout(resetNoticeTimerRef.current);
    resetNoticeTimerRef.current = window.setTimeout(() => {
      setResetDoneNotice(false);
      resetNoticeTimerRef.current = null;
    }, 4500);
    scheduleFocusTrigger();
  };

  const releasePills: BentoSummaryPill[] = [
    { label: `v${APP_VERSION}`, tone: 'accent' },
    { label: `${RELEASE_NOTES.length} Releases`, tone: 'neutral' },
  ];

  const privacyPills: BentoSummaryPill[] = [
    { label: 'Local-First', tone: 'positive' },
    { label: 'Optional Account', tone: 'neutral' },
  ];

  const termsPills: BentoSummaryPill[] = [{ label: 'Wellness Scope', tone: 'neutral' }];

  return (
    <div
      id="settings-panel-about"
      role="tabpanel"
      aria-labelledby="settings-tab-about"
      className="wb-calm-stack space-y-3.5 pb-4"
    >
      {/* Unified Section Header */}
      <div className="border-b border-[var(--border-hairline)] pb-3">
        <h2 className="text-base font-semibold tracking-tight text-[var(--ink-primary)]">
          Legal &amp; About
        </h2>
        <p className="wb-prose mt-0.5 text-xs text-[var(--ink-muted)]">
          Version {APP_VERSION} · Release notes, local-first privacy, terms &amp; defaults
        </p>
      </div>

      {/* App Version Summary Card */}
      <section
        aria-labelledby="about-version-heading"
        className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3.5"
      >
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--brand-accent-text)]"
            >
              <Info className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3
                id="about-version-heading"
                className="text-sm font-semibold text-[var(--ink-primary)]"
              >
                {APP_NAME}
              </h3>
              <p className="mt-0.5 font-mono-tabular text-xs text-[var(--ink-muted)]">
                {APP_BUILD_CHANNEL} · {APP_RELEASE_DATE}
              </p>
            </div>
          </div>

          <span className="inline-flex min-h-[28px] shrink-0 items-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface-card)] px-2.5 py-1 font-mono-tabular text-xs font-semibold text-[var(--ink-primary)]">
            v{APP_VERSION}
          </span>
        </div>

        <p className="wb-prose mt-2.5 border-t border-[var(--border-hairline)] pt-2.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
          Built around RULER emotional check-ins, integrated Routines, and zero-guilt local
          persistence so your journal stays quiet, private, and under your control.
        </p>
      </section>

      {/* Mutually Exclusive Single-Open Legal & Release Documentation */}
      <div className="wb-calm-stack space-y-2.5">
        {/* 1. Release Notes */}
        <SettingsBentoAccordion
          id="about-releases"
          title="Release Notes"
          subtitle="Recent updates, interface refinements, and performance improvements"
          icon={<Sparkles className="h-4 w-4" />}
          pills={releasePills}
          isOpen={isSectionExpanded('releases')}
          onToggle={() => onToggleSection('releases')}
        >
          <div className="space-y-2.5">
            {RELEASE_NOTES.map((release) => (
              <article
                key={release.version}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <h4 className="min-w-0 flex-1 break-words text-xs font-semibold text-[var(--ink-primary)]">
                    <span className="font-mono-tabular text-[var(--brand-accent-text)]">
                      v{release.version}
                    </span>{' '}
                    · {release.title}
                  </h4>
                  <span className="shrink-0 font-mono-tabular text-[11px] text-[var(--ink-muted)]">
                    {release.date}
                  </span>
                </div>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
                  {release.highlights.map((item, idx) => (
                    <li key={`${release.version}-${idx}`} className="wb-prose">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </SettingsBentoAccordion>

        {/* 2. Privacy Policy */}
        <SettingsBentoAccordion
          id="about-privacy"
          title="Privacy Policy"
          subtitle="Local-first check-in storage, optional AI requests, and your data control"
          icon={<ShieldCheck className="h-4 w-4" />}
          pills={privacyPills}
          isOpen={isSectionExpanded('privacy')}
          onToggle={() => onToggleSection('privacy')}
        >
          <div className="space-y-2.5">
            {PRIVACY_POLICY_SECTIONS.map((sec) => (
              <div
                key={sec.id}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3"
              >
                <h4 className="text-xs font-semibold text-[var(--ink-primary)]">{sec.heading}</h4>
                <p className="wb-prose mt-1 text-xs leading-relaxed text-[var(--ink-secondary)]">
                  {sec.body}
                </p>
              </div>
            ))}
          </div>
        </SettingsBentoAccordion>

        {/* 3. Terms of Use */}
        <SettingsBentoAccordion
          id="about-terms"
          title="Terms of Use"
          subtitle="Wellness-only scope, crisis resources, and browser storage terms"
          icon={<Scale className="h-4 w-4" />}
          pills={termsPills}
          isOpen={isSectionExpanded('terms')}
          onToggle={() => onToggleSection('terms')}
        >
          <div className="space-y-2.5">
            {TERMS_OF_USE_SECTIONS.map((sec) => (
              <div
                key={sec.id}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3"
              >
                <h4 className="text-xs font-semibold text-[var(--ink-primary)]">{sec.heading}</h4>
                <p className="wb-prose mt-1 text-xs leading-relaxed text-[var(--ink-secondary)]">
                  {sec.body}
                </p>
              </div>
            ))}
          </div>
        </SettingsBentoAccordion>
      </div>

      {/* Clear Visual Separation Before High-Risk Reset Action */}
      <div className="mt-4 border-t border-[var(--border-strong)] pt-4">
        <section
          aria-labelledby="about-reset-heading"
          className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3.5"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: 'var(--q-red-bg)',
                color: 'var(--q-red-fg)',
                border: '1px solid var(--q-red-border)',
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3
                id="about-reset-heading"
                className="text-sm font-semibold text-[var(--ink-primary)]"
              >
                Reset to Defaults
              </h3>
              <p className="wb-prose mt-1 text-xs leading-relaxed text-[var(--ink-secondary)]">
                Restores color theme, accessibility modes, wearable preferences, nudge defaults,
                and routine reset duration back to their default values.{' '}
                <strong className="font-semibold text-[var(--ink-primary)]">
                  Your saved mood check-ins and journal history will not be deleted.
                </strong>
              </p>
            </div>
          </div>

          {!confirmResetOpen ? (
            <div className="wb-pane-header-row mt-4">
              <div className="wb-pane-item-actions">
                <button
                  ref={resetTriggerRef}
                  type="button"
                  data-no-drag-scroll="true"
                  onClick={() => setConfirmResetOpen(true)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 py-2 text-center text-xs font-semibold leading-snug transition-colors hover:bg-[var(--q-red-bg)]"
                  style={{
                    borderColor: 'var(--q-red-border)',
                    backgroundColor: 'var(--surface-card)',
                    color: 'var(--q-red-fg)',
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                  <span>Reset to Defaults…</span>
                </button>
              </div>

              {resetDoneNotice && (
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--bio-mint)]"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span>Defaults restored (check-ins kept)</span>
                </span>
              )}
            </div>
          ) : (
            <div
              role="alertdialog"
              aria-modal="false"
              aria-labelledby="about-reset-confirm-title"
              aria-describedby="about-reset-confirm-desc"
              className="mt-4 rounded-xl border p-3.5"
              style={{
                backgroundColor: 'var(--q-red-bg)',
                borderColor: 'var(--q-red-border)',
              }}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--q-red-fg)]"
                />
                <div className="min-w-0 flex-1">
                  <p
                    id="about-reset-confirm-title"
                    className="text-xs font-semibold text-[var(--q-red-fg)]"
                  >
                    Confirm Reset to Defaults?
                  </p>
                  <p
                    id="about-reset-confirm-desc"
                    className="wb-prose mt-1 text-xs leading-relaxed text-[var(--ink-primary)]"
                  >
                    This restores app preferences, theme, accessibility settings, wearable
                    toggles, and routine pacing to defaults. Saved mood check-ins stay intact.
                  </p>
                </div>
              </div>

              <div className="wb-pane-item-actions mt-3">
                <button
                  ref={cancelResetBtnRef}
                  type="button"
                  data-no-drag-scroll="true"
                  onClick={handleCancelReset}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3.5 py-2 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-no-drag-scroll="true"
                  onClick={handleConfirmReset}
                  style={{
                    backgroundColor: 'var(--q-red-solid)',
                    color: 'var(--q-red-ink)',
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-95"
                >
                  <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                  <span>Confirm Reset</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
