import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { EmotionDef } from '../types/wellbe';
import { EMOTIONS_16 } from '../data/wellbeData';
import { AffectiveGlyph, getQuadrantStyle } from './AffectiveGlyphs';
import { useAccessibility } from '../context/AccessibilityContext';
import { getM3Spring } from '../design/m3ExpressiveTokens';

export interface EmotionQuadrantMeta {
  key: EmotionDef['quadrant'];
  shortLabel: string;
  title: string;
  plainTitle: string;
  badge: string;
}

export const EMOTION_QUADRANTS: EmotionQuadrantMeta[] = [
  {
    key: 'yellow',
    shortLabel: 'Yellow',
    title: 'High-Energy Pleasant',
    plainTitle: 'Bright & Energized',
    badge: 'High+',
  },
  {
    key: 'green',
    shortLabel: 'Green',
    title: 'Low-Energy Pleasant',
    plainTitle: 'Calm & Rested',
    badge: 'Calm+',
  },
  {
    key: 'blue',
    shortLabel: 'Blue',
    title: 'Low-Energy Unpleasant',
    plainTitle: 'Low & Tired',
    badge: 'Low−',
  },
  {
    key: 'red',
    shortLabel: 'Red',
    title: 'High-Energy Unpleasant',
    plainTitle: 'Tense & Stressed',
    badge: 'High−',
  },
];

/**
 * Maps each logged emotion to its personal-color ambient glow derived from
 * the active theme's quadrant solid token, with subtle per-emotion luminance shifts.
 */
export function getEmotionPersonalGlow(
  emotionId: string,
  quadrant: EmotionDef['quadrant']
): string {
  switch (emotionId) {
    // Yellow Quadrant — Warm golden-amber spectrum
    case 'ecstatic':
      return 'var(--glow-ecstatic)';
    case 'joyful':
      return 'var(--q-yellow-solid)';
    case 'energized':
      return 'var(--glow-energized)';
    case 'inspired':
      return 'var(--glow-inspired)';

    // Green Quadrant — Soft sage-emerald / mint spectrum
    case 'grateful':
      return 'var(--glow-grateful)';
    case 'calm':
      return 'var(--q-green-solid)';
    case 'content':
      return 'var(--glow-content)';
    case 'rested':
      return 'var(--glow-rested)';

    // Blue Quadrant — Deep slate-cobalt / serene blue spectrum
    case 'tired':
      return 'var(--glow-tired)';
    case 'drained':
      return 'var(--glow-drained)';
    case 'sad':
      return 'var(--q-blue-solid)';
    case 'lonely':
      return 'var(--glow-lonely)';

    // Red Quadrant — Warm terracotta-coral / muted crimson spectrum
    case 'anxious':
      return 'var(--glow-anxious)';
    case 'stressed':
      return 'var(--q-red-solid)';
    case 'frustrated':
      return 'var(--glow-frustrated)';
    case 'overwhelmed':
      return 'var(--glow-overwhelmed)';

    default:
      if (quadrant === 'yellow') return 'var(--q-yellow-solid)';
      if (quadrant === 'green') return 'var(--q-green-solid)';
      if (quadrant === 'blue') return 'var(--q-blue-solid)';
      if (quadrant === 'red') return 'var(--q-red-solid)';
      return 'var(--q-balanced-solid)';
  }
}

export interface CompactEmotionButtonProps {
  emotion: EmotionDef;
  globalIdx: number;
  quadrantTitle: string;
  isActive: boolean;
  isGlowing?: boolean;
  glowBurstId?: number;
  isPulsing?: boolean;
  pulseSeq?: number;
  tapAnimPhase?: 'idle' | 'a' | 'b';
  onTapAnimEnd?: (emotionId: string) => void;
  patternAssist?: boolean;
  reduceMotion?: boolean;
  calmMode?: boolean;
  animateEntrance?: boolean;
  compact?: boolean;
  layoutMode?: 'default' | 'inline' | 'sheet';
  tabIndex: number;
  registerButtonRef?: (idx: number, el: HTMLButtonElement | null) => void;
  onSelectItem: (emotion: EmotionDef, idx: number) => void;
  onKeyDownItem: (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => void;
  onFocusItem: (idx: number) => void;
}

export const CompactEmotionButton: React.FC<CompactEmotionButtonProps> = React.memo(
  ({
    emotion,
    globalIdx,
    quadrantTitle,
    isActive,
    isGlowing = false,
    glowBurstId = 0,
    isPulsing = false,
    pulseSeq = 0,
    tapAnimPhase = 'idle',
    onTapAnimEnd,
    patternAssist = false,
    reduceMotion = false,
    calmMode = false,
    animateEntrance = false,
    compact = false,
    layoutMode = 'default',
    tabIndex,
    registerButtonRef,
    onSelectItem,
    onKeyDownItem,
    onFocusItem,
  }) => {
    const qStyle = getQuadrantStyle(emotion.quadrant);
    const effectiveMode = layoutMode !== 'default' ? layoutMode : compact ? 'inline' : 'default';
    const personalGlow = getEmotionPersonalGlow(emotion.id, emotion.quadrant);

    const handleRef = useCallback(
      (el: HTMLButtonElement | null) => {
        registerButtonRef?.(globalIdx, el);
      },
      [registerButtonRef, globalIdx]
    );

    const isSheet = effectiveMode === 'sheet';
    const isInline = effectiveMode === 'inline';
    const isAnimating = tapAnimPhase !== 'idle';

    // Unified Material 3 Expressive spring physics & shape-morphing radii across Quick & Instant Check-In
    const spatialSpring = useMemo(
      () => getM3Spring('fastSpatial', { reduceMotion, calmMode }),
      [reduceMotion, calmMode]
    );
    const entranceSpring = useMemo(
      () =>
        getM3Spring('defaultSpatial', {
          reduceMotion,
          calmMode,
          delay: animateEntrance && !reduceMotion ? Math.min(globalIdx * 0.011, 0.165) : 0,
        }),
      [reduceMotion, calmMode, animateEntrance, globalIdx]
    );

    // Expressive corner morphing: generous soft pill-card at rest -> crisp squircle when selected or tapped
    const restRadius = isSheet ? '16px' : isInline ? '14px' : '15px';
    const activeRadius = isSheet ? '11px' : isInline ? '10px' : '11px';
    const tapRadius = isSheet ? '9px' : '8px';

    const tileSizeClass = isInline
      ? 'wb-emotion-tile-inline px-2 sm:px-2.5'
      : isSheet
        ? 'wb-emotion-tile-sheet h-full w-full min-h-0 px-3.5 sm:px-5'
        : 'min-h-[44px] px-2.5';

    return (
      <div
        data-quadrant={emotion.quadrant}
        data-tap-anim={tapAnimPhase}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget && isAnimating) {
            onTapAnimEnd?.(emotion.id);
          }
        }}
        className={`wb-emotion-tile-cell relative min-w-0 ${
          isSheet ? 'h-full w-full min-h-0' : 'w-full'
        } ${isGlowing || isPulsing || isAnimating ? 'z-10' : ''}`}
      >
        <motion.div
          initial={
            animateEntrance && !reduceMotion
              ? { opacity: 0, y: 10, scale: 0.95 }
              : false
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={entranceSpring}
          className={isSheet ? 'h-full w-full min-h-0' : 'w-full'}
        >
          <motion.button
            ref={handleRef}
            type="button"
            role="gridcell"
            data-no-drag-scroll="true"
            data-selected={isActive ? 'true' : 'false'}
            data-quadrant={emotion.quadrant}
            aria-pressed={isActive}
            aria-label={`${isActive ? 'Selected: ' : ''}${emotion.label}, ${quadrantTitle}`}
            tabIndex={tabIndex}
            whileHover={
              reduceMotion
                ? undefined
                : {
                    scale: 1.022,
                    y: -1,
                  }
            }
            whileTap={
              reduceMotion
                ? undefined
                : {
                    scale: 0.945,
                    borderRadius: tapRadius,
                  }
            }
            animate={{
              borderRadius: isActive ? activeRadius : restRadius,
            }}
            transition={spatialSpring}
            onClick={(e) => {
              e.stopPropagation();
              onSelectItem(emotion, globalIdx);
            }}
            onDragStart={(e) => e.preventDefault()}
            onKeyDown={(e) => onKeyDownItem(e, globalIdx)}
            onFocus={() => onFocusItem(globalIdx)}
            className={`wb-emotion-tile group relative isolate flex w-full min-w-0 select-none touch-manipulation flex-row items-center justify-between gap-2 text-left ${
              isActive
                ? 'hover:brightness-[1.03]'
                : 'hover:brightness-[0.98] dark:hover:brightness-[1.06]'
            } ${tileSizeClass}`}
          style={
            {
              color: isActive ? qStyle.ink : qStyle.fg,
              '--tile-border': isActive ? qStyle.solid : qStyle.border,
              '--tile-border-hover': isActive
                ? qStyle.solid
                : `color-mix(in srgb, ${qStyle.solid} 64%, ${qStyle.border})`,
              '--tile-solid': qStyle.solid,
              '--tile-emotion-glow': personalGlow,
              '--tile-hover-glow': `0 6px 16px -6px color-mix(in srgb, ${personalGlow} 42%, transparent)`,
              boxShadow: isActive
                ? `0 0 0 1.5px ${qStyle.solid}, 0 6px 18px -4px color-mix(in srgb, ${personalGlow} 60%, transparent)`
                : undefined,
            } as React.CSSProperties
          }
        >
          {/* Crisp 280ms Quadrant Border Pulse on every tap */}
          {isPulsing && !reduceMotion && (
            <span
              key={`tile-pulse-${pulseSeq}`}
              aria-hidden="true"
              className="wb-emotion-border-pulse"
              style={{ '--tile-pulse-color': personalGlow } as React.CSSProperties}
            />
          )}

          {/* Personal-Color Ambient Glow Halo (identical across Quick & Instant Check-In) */}
          {isGlowing && !reduceMotion && (
            <span
              key={`tile-halo-${glowBurstId}`}
              aria-hidden="true"
              className="wb-emotion-tile-halo"
            />
          )}

          {/* Quadrant Tonal Surface Fill + Specular Micro-Highlight */}
          <span
            aria-hidden="true"
            className="wb-emotion-tile-fill pointer-events-none absolute inset-0 z-0"
            style={{
              backgroundColor: isActive ? qStyle.solid : 'var(--surface-card)',
              backgroundImage: isActive
                ? `linear-gradient(180deg, color-mix(in srgb, ${personalGlow} 26%, color-mix(in srgb, var(--palette-near-white) 22%, transparent)) 0%, transparent 100%)`
                : `linear-gradient(${qStyle.bg}, ${qStyle.bg})`,
            }}
          />

          {/* M3 Expressive Personal-Color Radial Wave Burst on Tap */}
          {isPulsing && !reduceMotion && (
            <span
              key={`tile-wave-${pulseSeq}`}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
              style={{ borderRadius: 'inherit' }}
            >
              <motion.span
                initial={{ scale: 0.25, opacity: 0.55 }}
                animate={{ scale: 2.1, opacity: 0 }}
                transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 m-auto aspect-square w-full rounded-full"
                style={{
                  background: isActive
                    ? `radial-gradient(circle, color-mix(in srgb, var(--palette-near-white) 52%, transparent) 0%, color-mix(in srgb, ${personalGlow} 40%, transparent) 55%, transparent 75%)`
                    : `radial-gradient(circle, color-mix(in srgb, ${personalGlow} 58%, transparent) 0%, transparent 72%)`,
                }}
              />
            </span>
          )}

          {patternAssist && (
            <span
              aria-hidden="true"
              className={`wb-emotion-tile-pattern wb-pattern-${emotion.quadrant} pointer-events-none absolute inset-0 z-[1] ${
                isActive ? 'opacity-[0.07]' : 'opacity-[0.12]'
              }`}
            />
          )}

          <span
            className={`relative z-10 flex min-w-0 items-center ${
              isSheet ? 'gap-2.5 sm:gap-3' : 'gap-1.5 sm:gap-2'
            }`}
          >
            <motion.span
              aria-hidden="true"
              animate={
                reduceMotion
                  ? undefined
                  : {
                      scale: isActive ? 1.12 : 1,
                    }
              }
              transition={spatialSpring}
              className="wb-emotion-tile-glyph flex shrink-0 items-center justify-center"
              style={{ color: isActive ? qStyle.ink : qStyle.fg }}
            >
              <AffectiveGlyph
                emotionId={emotion.id}
                quadrant={emotion.quadrant}
                size={isInline ? 15 : isSheet ? 20 : 17}
              />
            </motion.span>
            <span
              className={`wb-emotion-tile-label min-w-0 truncate leading-[1.15] ${
                isInline
                  ? 'text-[12.5px] sm:text-[13.5px]'
                  : isSheet
                    ? ''
                    : 'text-[13px] sm:text-[13.5px]'
              } ${isActive ? 'font-semibold' : 'font-medium'}`}
            >
              {emotion.label}
            </span>
          </span>

          <AnimatePresence initial={false}>
            {isActive && (
              <motion.span
                key="check-badge"
                aria-hidden="true"
                initial={reduceMotion ? false : { scale: 0, rotate: -26, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                transition={spatialSpring}
                className={`relative z-10 flex shrink-0 items-center justify-center rounded-full ${
                  isSheet ? 'h-5 w-5' : 'h-4 w-4'
                }`}
                style={{
                  backgroundColor: qStyle.ink,
                  color: qStyle.solid,
                }}
              >
                <Check className={isSheet ? 'h-3 w-3' : 'h-2.5 w-2.5'} strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
          </motion.button>
        </motion.div>
      </div>
    );
  }
);
CompactEmotionButton.displayName = 'CompactEmotionButton';

export interface CompactEmotionMatrixProps {
  /** Deterministic single-selection list (0 or 1 emotion ID) */
  selectedEmotions?: string[];
  activeEmotion?: string | null;
  onSelectEmotion: (emotion: EmotionDef) => void;
  plainLanguage?: boolean;
  patternAssist?: boolean;
  reduceMotion?: boolean;
  glowActive?: boolean;
  glowBurstId?: number;
  animateEntrance?: boolean;
  recedeQuadrants?: boolean;
  fitViewport?: boolean;
  layoutMode?: 'default' | 'inline' | 'sheet';
  syncFocusKey?: boolean | number;
  ariaLabel?: string;
  className?: string;
}

const BORDER_PULSE_MS = 320;
const TAP_ANIM_FALLBACK_MS = 680;

const GROUPED_QUADRANTS = EMOTION_QUADRANTS.map((q) => ({
  ...q,
  emotions: EMOTIONS_16.filter((em) => em.quadrant === q.key),
}));

const FLAT_EMOTIONS = GROUPED_QUADRANTS.flatMap((q) => q.emotions);

// Visual 4x4 grid mapping on sm+ screens where quadrants sit in a 2x2 grid of 2x2 blocks:
// Row 0: Yellow[0,1], Green[4,5] | Row 1: Yellow[2,3], Green[6,7]
// Row 2: Blue[8,9], Red[12,13]   | Row 3: Blue[10,11], Red[14,15]
const DESKTOP_GRID_ROWS: readonly (readonly number[])[] = [
  [0, 1, 4, 5],
  [2, 3, 6, 7],
  [8, 9, 12, 13],
  [10, 11, 14, 15],
];

const DESKTOP_POS_BY_IDX: ReadonlyArray<{ row: number; col: number }> = (() => {
  const map: Array<{ row: number; col: number }> = new Array(16);
  for (let r = 0; r < DESKTOP_GRID_ROWS.length; r += 1) {
    for (let c = 0; c < DESKTOP_GRID_ROWS[r].length; c += 1) {
      map[DESKTOP_GRID_ROWS[r][c]] = { row: r, col: c };
    }
  }
  return map;
})();

export const CompactEmotionMatrix: React.FC<CompactEmotionMatrixProps> = React.memo(
  ({
    selectedEmotions,
    activeEmotion = null,
    onSelectEmotion,
    plainLanguage,
    patternAssist,
    reduceMotion,
    glowActive = false,
    glowBurstId = 0,
    animateEntrance = false,
    recedeQuadrants = false,
    fitViewport = false,
    layoutMode = 'default',
    syncFocusKey,
    ariaLabel = '16-emotion check-in matrix',
    className = '',
  }) => {
    const osReduced = useReducedMotion();
    const a11y = useAccessibility();
    const usePlainLanguage = plainLanguage ?? a11y.plainLanguage;
    const usePatternAssist = patternAssist ?? a11y.patternAssist;
    const useReduceMotion = Boolean(osReduced || (reduceMotion ?? a11y.reduceMotion));
    const useCalmMode = a11y.calmMode;

    const gridRef = useRef<HTMLDivElement | null>(null);
    const emotionBtnRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const onSelectRef = useRef(onSelectEmotion);
    onSelectRef.current = onSelectEmotion;

    // Crisp 320ms quadrant border pulse + tonal radial wave state (resets cleanly on rapid taps)
    const [borderPulse, setBorderPulse] = useState<{ emotionId: string; seq: number } | null>(null);
    const pulseTimerRef = useRef<number | null>(null);
    const pulseSeqRef = useRef(0);

    // Per-group tactile tap animation state (alternating A/B phase restarts cleanly on rapid re-taps without remounting)
    const [tapAnim, setTapAnim] = useState<{
      emotionId: string;
      phase: 'a' | 'b';
      seq: number;
    } | null>(null);
    const tapAnimTimerRef = useRef<number | null>(null);
    const tapAnimSeqRef = useRef(0);

    useEffect(() => {
      return () => {
        if (pulseTimerRef.current !== null) {
          window.clearTimeout(pulseTimerRef.current);
          pulseTimerRef.current = null;
        }
        if (tapAnimTimerRef.current !== null) {
          window.clearTimeout(tapAnimTimerRef.current);
          tapAnimTimerRef.current = null;
        }
      };
    }, []);

    const selectedSet = useMemo(() => {
      const set = new Set<string>();
      const singleId =
        selectedEmotions !== undefined ? (selectedEmotions[0] ?? null) : activeEmotion;
      if (singleId) set.add(singleId);
      return set;
    }, [selectedEmotions, activeEmotion]);

    // Clear an active border pulse / tap animation ONLY when selection reverts from >0 to 0
    const prevSelectedSizeRef = useRef(selectedSet.size);
    useEffect(() => {
      const prevSize = prevSelectedSizeRef.current;
      prevSelectedSizeRef.current = selectedSet.size;
      if (prevSize > 0 && selectedSet.size === 0) {
        if (pulseTimerRef.current !== null) {
          window.clearTimeout(pulseTimerRef.current);
          pulseTimerRef.current = null;
        }
        setBorderPulse(null);
        if (tapAnimTimerRef.current !== null) {
          window.clearTimeout(tapAnimTimerRef.current);
          tapAnimTimerRef.current = null;
        }
        setTapAnim(null);
      }
    }, [selectedSet]);

    // Immediately clear any in-flight animations if Reduce Motion turns on
    useEffect(() => {
      if (!useReduceMotion) return;
      if (pulseTimerRef.current !== null) {
        window.clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
      if (tapAnimTimerRef.current !== null) {
        window.clearTimeout(tapAnimTimerRef.current);
        tapAnimTimerRef.current = null;
      }
      setBorderPulse(null);
      setTapAnim(null);
    }, [useReduceMotion]);

    const useReduceMotionRef = useRef(useReduceMotion);
    useReduceMotionRef.current = useReduceMotion;

    const triggerBorderPulse = useCallback((emotionId: string) => {
      if (pulseTimerRef.current !== null) {
        window.clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
      if (useReduceMotionRef.current) {
        setBorderPulse(null);
        return;
      }
      pulseSeqRef.current += 1;
      const seq = pulseSeqRef.current;
      setBorderPulse({ emotionId, seq });
      pulseTimerRef.current = window.setTimeout(() => {
        pulseTimerRef.current = null;
        setBorderPulse((curr) => (curr && curr.seq === seq ? null : curr));
      }, BORDER_PULSE_MS);
    }, []);

    const triggerTapAnim = useCallback((emotionId: string) => {
      if (tapAnimTimerRef.current !== null) {
        window.clearTimeout(tapAnimTimerRef.current);
        tapAnimTimerRef.current = null;
      }
      if (useReduceMotionRef.current) {
        setTapAnim(null);
        return;
      }
      tapAnimSeqRef.current += 1;
      const seq = tapAnimSeqRef.current;
      setTapAnim((prev) => ({
        emotionId,
        phase: prev && prev.emotionId === emotionId && prev.phase === 'a' ? 'b' : 'a',
        seq,
      }));
      tapAnimTimerRef.current = window.setTimeout(() => {
        tapAnimTimerRef.current = null;
        setTapAnim((curr) => (curr && curr.seq === seq ? null : curr));
      }, TAP_ANIM_FALLBACK_MS);
    }, []);

    const handleTapAnimEnd = useCallback((emotionId: string) => {
      setTapAnim((curr) => {
        if (!curr || curr.emotionId !== emotionId) return curr;
        if (tapAnimTimerRef.current !== null) {
          window.clearTimeout(tapAnimTimerRef.current);
          tapAnimTimerRef.current = null;
        }
        return null;
      });
    }, []);

    const primarySelectedId =
      selectedEmotions !== undefined ? (selectedEmotions[0] ?? null) : activeEmotion;

    const initialFocusIdx = useMemo(() => {
      if (!primarySelectedId) return 0;
      const idx = FLAT_EMOTIONS.findIndex((em) => em.id === primarySelectedId);
      return idx >= 0 ? idx : 0;
    }, [primarySelectedId]);

    // Focus index moves independently of selectedSet so arrow keys never clear selections
    const [focusedIdx, setFocusedIdx] = useState<number>(initialFocusIdx);

    useEffect(() => {
      if (syncFocusKey) {
        setFocusedIdx(initialFocusIdx);
      }
    }, [syncFocusKey, initialFocusIdx]);

    const registerButtonRef = useCallback((idx: number, el: HTMLButtonElement | null) => {
      emotionBtnRefs.current[idx] = el;
    }, []);

    const handleSelectItem = useCallback(
      (em: EmotionDef, globalIdx: number) => {
        setFocusedIdx(globalIdx);
        triggerBorderPulse(em.id);
        triggerTapAnim(em.id);
        onSelectRef.current(em);
      },
      [triggerBorderPulse, triggerTapAnim]
    );

    const resolvedMode =
      layoutMode !== 'default' ? layoutMode : fitViewport ? 'inline' : 'default';

    const handleGridKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
        const total = FLAT_EMOTIONS.length;
        const isDesktopTwoQuadCols =
          resolvedMode !== 'sheet' &&
          typeof window !== 'undefined' &&
          window.innerWidth >= 640;

        let nextIdx = idx;

        if (isDesktopTwoQuadCols && idx >= 0 && idx < DESKTOP_POS_BY_IDX.length) {
          const { row, col } = DESKTOP_POS_BY_IDX[idx];
          if (e.key === 'ArrowRight') nextIdx = DESKTOP_GRID_ROWS[row][(col + 1) % 4];
          else if (e.key === 'ArrowLeft') nextIdx = DESKTOP_GRID_ROWS[row][(col + 3) % 4];
          else if (e.key === 'ArrowDown') nextIdx = DESKTOP_GRID_ROWS[(row + 1) % 4][col];
          else if (e.key === 'ArrowUp') nextIdx = DESKTOP_GRID_ROWS[(row + 3) % 4][col];
          else if (e.key === 'Home') nextIdx = 0;
          else if (e.key === 'End') nextIdx = total - 1;
          else return;
        } else {
          if (e.key === 'ArrowRight') nextIdx = (idx + 1) % total;
          else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + total) % total;
          else if (e.key === 'ArrowDown') nextIdx = (idx + 2) % total;
          else if (e.key === 'ArrowUp') nextIdx = (idx - 2 + total) % total;
          else if (e.key === 'Home') nextIdx = 0;
          else if (e.key === 'End') nextIdx = total - 1;
          else return;
        }

        e.preventDefault();
        setFocusedIdx(nextIdx);
        emotionBtnRefs.current[nextIdx]?.focus({ preventScroll: true });
      },
      [resolvedMode]
    );

    const handleFocusItem = useCallback((idx: number) => {
      setFocusedIdx(idx);
    }, []);

    // Full-viewport equal-height 2x8 CSS Grid for Instant Check-In (fills 100% height & width, zero dead space, zero scroll)
    if (resolvedMode === 'sheet') {
      return (
        <div
          ref={gridRef}
          role="grid"
          aria-label={ariaLabel}
          className={`wb-emotion-matrix-sheet ${className}`}
        >
          {GROUPED_QUADRANTS.flatMap((q, qIdx) => {
            const quadrantHeading = usePlainLanguage ? q.plainTitle : q.title;
            return q.emotions.map((em, itemIdx) => {
              const globalIdx = qIdx * 4 + itemIdx;
              const isActive = selectedSet.has(em.id);
              const isGlowing = isActive && glowActive && !useReduceMotion;
              const isPulsing = !useReduceMotion && borderPulse?.emotionId === em.id;
              const tapAnimPhase =
                !useReduceMotion && tapAnim?.emotionId === em.id ? tapAnim.phase : 'idle';

              return (
                <CompactEmotionButton
                  key={em.id}
                  emotion={em}
                  globalIdx={globalIdx}
                  quadrantTitle={quadrantHeading}
                  isActive={isActive}
                  isGlowing={isGlowing}
                  glowBurstId={isGlowing ? glowBurstId : 0}
                  isPulsing={isPulsing}
                  pulseSeq={isPulsing ? borderPulse.seq : 0}
                  tapAnimPhase={tapAnimPhase}
                  onTapAnimEnd={handleTapAnimEnd}
                  patternAssist={usePatternAssist}
                  reduceMotion={useReduceMotion}
                  calmMode={useCalmMode}
                  animateEntrance={animateEntrance}
                  compact={fitViewport}
                  layoutMode="sheet"
                  tabIndex={focusedIdx === globalIdx ? 0 : -1}
                  registerButtonRef={registerButtonRef}
                  onSelectItem={handleSelectItem}
                  onKeyDownItem={handleGridKeyDown}
                  onFocusItem={handleFocusItem}
                />
              );
            });
          })}
        </div>
      );
    }

    const matrixSpacingClass =
      resolvedMode === 'inline'
        ? 'wb-emotion-matrix-inline gap-1 sm:gap-x-3 sm:gap-y-2'
        : 'gap-3 sm:gap-x-4 sm:gap-y-3.5';

    return (
      <div
        ref={gridRef}
        role="grid"
        aria-label={ariaLabel}
        className={`grid grid-cols-1 sm:grid-cols-2 ${matrixSpacingClass} ${className}`}
      >
        {GROUPED_QUADRANTS.map((q, qIdx) => {
          const quadrantHeading = usePlainLanguage ? q.plainTitle : q.title;

          return (
            <div
              key={q.key}
              role="rowgroup"
              aria-label={quadrantHeading}
              data-quadrant-group={q.key}
              {...(recedeQuadrants ? { 'data-edge-recede': '' } : {})}
              className="min-w-0 rounded-xl"
            >
              <div
                className={`grid grid-cols-2 ${
                  resolvedMode === 'inline' ? 'gap-1 sm:gap-1.5' : 'gap-1.5'
                }`}
                role="row"
              >
                {q.emotions.map((em, itemIdx) => {
                  const globalIdx = qIdx * 4 + itemIdx;
                  const isActive = selectedSet.has(em.id);
                  const isGlowing = isActive && glowActive && !useReduceMotion;
                  const isPulsing =
                    !useReduceMotion && borderPulse?.emotionId === em.id;
                  const tapAnimPhase =
                    !useReduceMotion && tapAnim?.emotionId === em.id ? tapAnim.phase : 'idle';

                  return (
                    <CompactEmotionButton
                      key={em.id}
                      emotion={em}
                      globalIdx={globalIdx}
                      quadrantTitle={quadrantHeading}
                      isActive={isActive}
                      isGlowing={isGlowing}
                      glowBurstId={isGlowing ? glowBurstId : 0}
                      isPulsing={isPulsing}
                      pulseSeq={isPulsing ? borderPulse.seq : 0}
                      tapAnimPhase={tapAnimPhase}
                      onTapAnimEnd={handleTapAnimEnd}
                      patternAssist={usePatternAssist}
                      reduceMotion={useReduceMotion}
                      calmMode={useCalmMode}
                      animateEntrance={animateEntrance}
                      compact={fitViewport}
                      layoutMode={resolvedMode}
                      tabIndex={focusedIdx === globalIdx ? 0 : -1}
                      registerButtonRef={registerButtonRef}
                      onSelectItem={handleSelectItem}
                      onKeyDownItem={handleGridKeyDown}
                      onFocusItem={handleFocusItem}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
);
CompactEmotionMatrix.displayName = 'CompactEmotionMatrix';
