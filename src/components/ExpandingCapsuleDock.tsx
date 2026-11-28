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
import { getM3Spring, m3Shapes } from '../design/m3ExpressiveTokens';

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
  calmMode?: boolean;
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
    calmMode = false,
  }) => {
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const tabsRowRef = useRef<HTMLDivElement>(null);
    const lastScrollYRef = useRef(0);
    const [layoutEpoch, setLayoutEpoch] = useState(0);
    const [scrollVisible, setScrollVisible] = useState(true);

    // Keep the shared layoutId spring indicator pixel-aligned on viewport resize, orientation change, or font-scale shifts
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

    // Always reveal toolbar on tab switch, Coach single-viewport screen, or open quick sheet
    useEffect(() => {
      setScrollVisible(true);
      lastScrollYRef.current = typeof window !== 'undefined' ? window.scrollY : 0;
    }, [activeTab, quickCheckInOpen, locked]);

    // M3 Expressive Scroll-Aware Hide/Show: smoothly springs down past 24px on scroll down, bounces back on scroll up
    useEffect(() => {
      if (typeof window === 'undefined') return;
      if (activeTab === 'coach' || quickCheckInOpen || locked) {
        setScrollVisible(true);
        return;
      }

      lastScrollYRef.current = window.scrollY;
      let ticking = false;

      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          ticking = false;
          const currentY = Math.max(0, window.scrollY);
          const prevY = lastScrollYRef.current;
          const delta = currentY - prevY;

          if (currentY <= 24) {
            setScrollVisible(true);
          } else if (delta > 6 && currentY > 24) {
            setScrollVisible(false);
          } else if (delta < -4) {
            setScrollVisible(true);
          }
          lastScrollYRef.current = currentY;
        });
      };

      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }, [activeTab, quickCheckInOpen, locked]);

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
      setScrollVisible(true);
      onSelectTab(CAPSULE_NAV_TABS[nextIdx].id);
      tabRefs.current[nextIdx]?.focus();
    };

    const fastSpring = getM3Spring('fastSpatial', {
      reduceMotion,
      calmMode,
    });
    const dockSpring = getM3Spring('defaultSpatial', {
      reduceMotion,
      calmMode,
    });

    const isVisible = scrollVisible || quickCheckInOpen || activeTab === 'coach';

    return (
      <motion.nav
        aria-label="Primary navigation"
        aria-hidden={locked || undefined}
        data-locked={locked ? 'true' : 'false'}
        data-visible={isVisible ? 'true' : 'false'}
        data-no-drag-scroll="true"
        onFocus={() => setScrollVisible(true)}
        initial={reduceMotion ? false : { y: 80, opacity: 0 }}
        animate={{
          y: isVisible ? 0 : 104,
          opacity: isVisible ? (locked ? 0.45 : 1) : 0,
        }}
        transition={dockSpring}
        style={{
          pointerEvents: isVisible && !locked ? 'auto' : 'none',
        }}
        className="wb-capsule-dock-wrap"
      >
        {/* Main M3 Expressive Floating Pill Toolbar */}
        <div className="wb-capsule-dock">
          <LayoutGroup id="wb-capsule-dock-tabs">
            <div
              ref={tabsRowRef}
              className="wb-capsule-tabs"
              role="tablist"
              aria-label="App sections"
            >
              {CAPSULE_NAV_TABS.map((tab, idx) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const accessibleName = plainLanguage ? tab.plainDescription : tab.label;

                return (
                  <motion.button
                    key={tab.id}
                    id={`capsule-tab-${tab.id}`}
                    ref={(el) => {
                      tabRefs.current[idx] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`tabpanel-${tab.id}`}
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
                    whileTap={reduceMotion || locked ? undefined : { scale: 0.92 }}
                    animate={{
                      // Signature M3 Expressive morph: Pill (999px) when idle -> Squircle (18px) when active
                      borderRadius: isActive ? 18 : 999,
                    }}
                    transition={fastSpring}
                    className="wb-capsule-tab"
                  >
                    {isActive && (
                      <motion.span
                        layoutId="wb-capsule-active-pill"
                        layoutDependency={`${activeTab}-${layoutEpoch}`}
                        aria-hidden="true"
                        className="wb-capsule-active-pill"
                        style={{ borderRadius: 18 }}
                        transition={fastSpring}
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
                  </motion.button>
                );
              })}
            </div>
          </LayoutGroup>
        </div>

        {/* Adjacent Detached Expressive Action Button (Quick Check-In FAB) */}
        <motion.button
          type="button"
          aria-disabled={locked || undefined}
          tabIndex={locked ? -1 : 0}
          data-open={quickCheckInOpen ? 'true' : 'false'}
          onClick={() => {
            if (locked) return;
            onQuickCheckIn();
          }}
          whileHover={reduceMotion || locked ? undefined : { scale: 1.04 }}
          whileTap={
            reduceMotion || locked
              ? undefined
              : { scale: 0.9, borderRadius: m3Shapes.squircle }
          }
          animate={{
            // Morphs smoothly from 999px pill/orb -> 16px squircle when Quick Check-In is active
            borderRadius: quickCheckInOpen ? m3Shapes.medium : m3Shapes.pill,
          }}
          transition={fastSpring}
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
          <motion.span
            aria-hidden="true"
            animate={{ rotate: quickCheckInOpen ? 45 : 0 }}
            transition={fastSpring}
            className="relative z-10 grid place-items-center"
          >
            <Plus className="h-6 w-6 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          </motion.span>
        </motion.button>
      </motion.nav>
    );
  }
);

ExpandingCapsuleDock.displayName = 'ExpandingCapsuleDock';
