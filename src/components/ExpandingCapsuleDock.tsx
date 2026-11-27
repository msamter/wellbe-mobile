import React, { useEffect, useRef, useState } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import {
  BarChart3,
  Layers,
  MessageSquareHeart,
  Plus,
  Sun,
} from 'lucide-react';
import { AppTab } from '../types/wellbe';

const NotepadIcon: React.FC<{ className?: string; 'aria-hidden'?: boolean }> = ({
  className,
  'aria-hidden': ariaHidden,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <path d="M8 7h8" />
    <path d="M8 12h8" />
    <path d="M8 17h5" />
  </svg>
);

export interface CapsuleTabItem {
  id: AppTab;
  label: string;
  plainDescription: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

export const CAPSULE_NAV_TABS: CapsuleTabItem[] = [
  {
    id: 'today',
    label: 'Today',
    plainDescription: 'Today — Check-in and daily overview',
    icon: Sun,
  },
  {
    id: 'routines',
    label: 'Routines',
    plainDescription: 'Routines — Scheduled calming habits',
    icon: Layers,
  },
  {
    id: 'log',
    label: 'Log',
    plainDescription: 'Log — Past mood entries and notes',
    icon: NotepadIcon,
  },
  {
    id: 'trends',
    label: 'Trends',
    plainDescription: 'Trends — Mood and wearable insights',
    icon: BarChart3,
  },
  {
    id: 'coach',
    label: 'Coach',
    plainDescription: 'Coach — Guided reflection support',
    icon: MessageSquareHeart,
  },
];

interface ExpandingCapsuleDockProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onQuickCheckIn: () => void;
  locked: boolean;
  plainLanguage: boolean;
  quickCheckInOpen: boolean;
  reduceMotion?: boolean;
}

export const ExpandingCapsuleDock: React.FC<ExpandingCapsuleDockProps> = React.memo(
  ({
    activeTab,
    onSelectTab,
    onQuickCheckIn,
    locked,
    plainLanguage,
    quickCheckInOpen,
    reduceMotion = false,
  }) => {
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const tabsRowRef = useRef<HTMLDivElement>(null);
    const [layoutEpoch, setLayoutEpoch] = useState(0);

    // Keep the shared layoutId spring pill pixel-aligned on viewport resize, orientation change, or font-scale shifts
    useEffect(() => {
      const el = tabsRowRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return;
      let lastWidth = Math.round(el.getBoundingClientRect().width);
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const nextWidth = Math.round(entry.contentRect.width);
        if (nextWidth > 0 && nextWidth !== lastWidth) {
          lastWidth = nextWidth;
          setLayoutEpoch((n) => n + 1);
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
      if (locked) return;
      let nextIdx = idx;
      if (e.key === 'ArrowRight') nextIdx = (idx + 1) % CAPSULE_NAV_TABS.length;
      else if (e.key === 'ArrowLeft')
        nextIdx = (idx - 1 + CAPSULE_NAV_TABS.length) % CAPSULE_NAV_TABS.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = CAPSULE_NAV_TABS.length - 1;
      else return;

      e.preventDefault();
      onSelectTab(CAPSULE_NAV_TABS[nextIdx].id);
      tabRefs.current[nextIdx]?.focus();
    };

    const pillTransition = reduceMotion
      ? { duration: 0 }
      : {
          type: 'tween' as const,
          duration: 0.2,
          ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
        };

    return (
      <nav
        aria-label="Primary navigation"
        aria-hidden={locked || undefined}
        data-locked={locked ? 'true' : 'false'}
        data-no-drag-scroll="true"
        className="wb-capsule-dock-wrap"
      >
        <div className="wb-capsule-dock">
          {/* 5-Tab Expanding Active-Tab Row with GPU-Composited Sliding Pill */}
          <LayoutGroup id="wb-capsule-dock-tabs">
            <div ref={tabsRowRef} className="wb-capsule-tabs" role="tablist" aria-label="App sections">
              {CAPSULE_NAV_TABS.map((tab, idx) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const accessibleName = plainLanguage ? tab.plainDescription : tab.label;

                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[idx] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={isActive ? undefined : accessibleName}
                    title={isActive ? undefined : accessibleName}
                    tabIndex={locked ? -1 : isActive ? 0 : -1}
                    aria-disabled={locked || undefined}
                    data-active={isActive ? 'true' : 'false'}
                    onClick={() => {
                      if (locked) return;
                      onSelectTab(tab.id);
                    }}
                    onKeyDown={(e) => handleKeyDown(e, idx)}
                    className="wb-capsule-tab"
                  >
                    {isActive && (
                      <motion.span
                        layoutId="wb-capsule-active-pill"
                        layoutDependency={`${activeTab}-${layoutEpoch}`}
                        aria-hidden="true"
                        className="wb-capsule-active-pill"
                        style={{ borderRadius: 9999 }}
                        transition={pillTransition}
                      />
                    )}
                    <Icon className="wb-capsule-tab-icon" aria-hidden={true} />
                    <span
                      className="wb-capsule-label-wrap"
                      aria-hidden={!isActive}
                    >
                      <span className="wb-capsule-label">{tab.label}</span>
                    </span>
                    {!isActive && (
                      <span className="wb-capsule-tooltip" aria-hidden="true">
                        {tab.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </LayoutGroup>

          {/* Subtle Divider Separating Nav Tabs from Quick-Action Orb */}
          <span className="wb-capsule-divider" aria-hidden="true" />

          {/* Integrated Quick-Action (+) Orb — Flush Right Edge */}
          <button
            type="button"
            aria-disabled={locked || undefined}
            tabIndex={locked ? -1 : 0}
            data-open={quickCheckInOpen ? 'true' : 'false'}
            onClick={() => {
              if (locked) return;
              onQuickCheckIn();
            }}
            aria-haspopup="dialog"
            aria-expanded={quickCheckInOpen}
            aria-label={
              plainLanguage
                ? 'Quick Check-In — Log how you feel right now'
                : 'Quick Check-In'
            }
            title="Quick Check-In"
            className="wb-capsule-plus-btn"
          >
            <Plus
              className="wb-capsule-plus-icon relative z-10 h-5 w-5 shrink-0"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </button>
        </div>
      </nav>
    );
  }
);

ExpandingCapsuleDock.displayName = 'ExpandingCapsuleDock';
