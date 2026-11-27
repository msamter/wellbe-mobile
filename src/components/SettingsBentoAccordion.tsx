import React, { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';

export type BentoPillTone = 'neutral' | 'accent' | 'positive' | 'warn';

export interface BentoSummaryPill {
  label: string;
  tone?: BentoPillTone;
}

export interface SettingsBentoAccordionProps {
  id: string;
  title: string;
  subtitle?: string;
  pills?: BentoSummaryPill[];
  isOpen: boolean;
  onToggle: () => void;
  /** Optional ref hook for jump-to-section navigation */
  sectionRef?: (el: HTMLElement | null) => void;
  /** Optional leading icon rendered softly next to title */
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Pattern 3: Expandable Bento Accordion
 * Shared across all three WELLBE+ Settings tabs (Account, Wearables, Accessibility).
 * - Full-row clickable header (omits data-no-drag-scroll so vertical mouse drag-to-scroll works smoothly)
 * - Scannable 1–3 live summary pills visible while collapsed
 * - Smooth CSS Grid 0fr -> 1fr expansion (0ms instant swap under Reduce Motion)
 * - Full ARIA disclosure pattern (aria-expanded, aria-controls, role="region", aria-labelledby)
 */
export const SettingsBentoAccordion: React.FC<SettingsBentoAccordionProps> = ({
  id,
  title,
  subtitle,
  pills = [],
  isOpen,
  onToggle,
  sectionRef,
  icon,
  children,
}) => {
  const a11y = useAccessibility();
  const cardRef = useRef<HTMLElement | null>(null);
  const headerBtnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const prevOpenRef = useRef<boolean>(isOpen);

  const headerId = `bento-header-${id}`;
  const panelId = `bento-panel-${id}`;

  // Gently scroll into view when expanding; restore focus cleanly if collapsing while focused inside
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = isOpen;

    if (wasOpen && !isOpen) {
      const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
      if (activeEl && panelRef.current?.contains(activeEl)) {
        headerBtnRef.current?.focus();
      }
      return;
    }

    if (!wasOpen && isOpen && cardRef.current) {
      const prefersReduced =
        a11y.reduceMotion ||
        (typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const behavior: ScrollBehavior = prefersReduced ? 'auto' : 'smooth';
      const timer = window.setTimeout(
        () => {
          cardRef.current?.scrollIntoView({
            block: 'nearest',
            behavior,
          });
        },
        prefersReduced ? 0 : 40
      );
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, a11y.reduceMotion]);

  const setRefs = (el: HTMLElement | null) => {
    cardRef.current = el;
    if (sectionRef) sectionRef(el);
  };

  return (
    <section
      ref={setRefs}
      data-open={isOpen ? 'true' : 'false'}
      className="wb-bento-card scroll-mt-3"
    >
      <h3 className="m-0">
        <button
          ref={headerBtnRef}
          id={headerId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="wb-bento-header"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              {icon && (
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-[var(--brand-accent-text)]"
                >
                  {icon}
                </span>
              )}
              <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-[var(--ink-primary)]">
                {title}
              </span>
            </div>

            {subtitle && (
              <p className="wb-prose mt-0.5 break-words text-xs font-normal leading-snug text-[var(--ink-muted)]">
                {subtitle}
              </p>
            )}

            {pills.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {pills.map((pill, idx) => (
                  <span
                    key={`${id}-pill-${idx}`}
                    data-tone={pill.tone ?? 'neutral'}
                    className="wb-bento-pill font-mono-tabular"
                  >
                    {pill.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--ink-muted)]"
          >
            <ChevronDown className="wb-bento-chevron h-4 w-4" />
          </span>
        </button>
      </h3>

      <div
        ref={panelRef}
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        aria-hidden={!isOpen}
        inert={!isOpen}
        className="wb-bento-collapse"
      >
        <div className="wb-bento-collapse-inner">
          <div className="wb-bento-body">{children}</div>
        </div>
      </div>
    </section>
  );
};
