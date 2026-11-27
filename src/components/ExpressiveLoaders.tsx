import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  getM3Spring,
  m3Shapes,
  m3SurfaceTokens,
} from '../design/m3ExpressiveTokens';

/**
 * 1. Tonal Shimmer Bone
 * Uses WELLBE+ surfaceContainerHigh + soft primaryContainer / card light sweep.
 * Respects Reduce Motion by pausing the shimmer sweep into a calm tonal surface.
 */
export interface ExpressiveSkeletonBoneProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  clipPath?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const ExpressiveSkeletonBone: React.FC<ExpressiveSkeletonBoneProps> = ({
  width = '100%',
  height = 16,
  borderRadius = m3Shapes.pill,
  clipPath,
  className = '',
  style,
}) => {
  const { reduceMotion, calmMode } = useAccessibility();

  return (
    <div
      aria-hidden="true"
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{
        width,
        height,
        borderRadius: clipPath ? 0 : borderRadius,
        clipPath,
        backgroundColor: m3SurfaceTokens.surfaceContainerHigh,
        ...style,
      }}
    >
      {!reduceMotion && (
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{
            repeat: Infinity,
            duration: calmMode ? 2.2 : 1.5,
            ease: [0.4, 0, 0.2, 1],
          }}
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              90deg,
              transparent 0%,
              var(--brand-accent-soft) 45%,
              var(--surface-card) 50%,
              var(--brand-accent-soft) 55%,
              transparent 100%
            )`,
            opacity: 0.72,
          }}
        />
      )}
    </div>
  );
};

/**
 * 2. M3 Expressive Morphing Shape Indicator
 * Cycles through Pill -> Squircle -> Organic Blob -> Soft Burst with fastSpatial spring rotation.
 * Under Reduce Motion, renders a calm static squircle without rotation.
 */
const MORPH_SHAPES = [
  { borderRadius: '999px', scale: 1 },
  { borderRadius: '10px', scale: 0.92 },
  { borderRadius: m3Shapes.organicBlob, scale: 1.04 },
  { borderRadius: m3Shapes.softBurst, scale: 0.96 },
] as const;

export interface ExpressiveMorphLoaderProps {
  size?: number;
  label?: string;
  className?: string;
}

export const ExpressiveMorphLoader: React.FC<ExpressiveMorphLoaderProps> = ({
  size = 36,
  label = 'Loading',
  className = '',
}) => {
  const { reduceMotion, calmMode } = useAccessibility();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const intervalMs = calmMode ? 950 : 650;
    const id = window.setInterval(() => {
      setStep((prev) => (prev + 1) % MORPH_SHAPES.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [reduceMotion, calmMode]);

  const current = reduceMotion ? MORPH_SHAPES[1] : MORPH_SHAPES[step];
  const spring = getM3Spring('fastSpatial', {
    reduceMotion,
    calmMode,
  });

  return (
    <div
      role="img"
      aria-label={label}
      className={`grid shrink-0 place-items-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: m3Shapes.pill,
        backgroundColor: m3SurfaceTokens.primaryContainer,
      }}
    >
      <motion.div
        animate={
          reduceMotion
            ? { borderRadius: '10px', scale: 1, rotate: 0 }
            : {
                borderRadius: current.borderRadius,
                scale: current.scale,
                rotate: step * 90,
              }
        }
        transition={spring}
        style={{
          width: Math.round(size * 0.52),
          height: Math.round(size * 0.52),
          backgroundColor: m3SurfaceTokens.primary,
        }}
      />
    </div>
  );
};

/**
 * 3. Complete Expressive Card Skeleton
 * Uses extraLarge 28px card radius, 8-point scalloped cookie avatar mask,
 * media/content block bone, and contrasting pill + rounded-square chip bones.
 */
export const ExpressiveCardSkeleton: React.FC<{
  showMedia?: boolean;
  mediaHeight?: number;
  compact?: boolean;
}> = ({ showMedia = true, mediaHeight = 124, compact = false }) => {
  const { reduceMotion, calmMode } = useAccessibility();
  const transition = getM3Spring('defaultEffects', {
    reduceMotion,
    calmMode,
  });

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
      transition={transition}
      className="wb-surface flex flex-col border border-[var(--border-hairline)]"
      style={{
        borderRadius: compact ? m3Shapes.large : m3Shapes.extraLarge,
        padding: compact ? 14 : 18,
        gap: compact ? 10 : 14,
      }}
    >
      {/* Header Row with Organic 8-Point Scalloped Avatar */}
      <div className="flex items-center gap-3.5">
        <ExpressiveSkeletonBone
          width={compact ? 40 : 48}
          height={compact ? 40 : 48}
          clipPath={m3Shapes.cookie8}
        />
        <div className="flex flex-1 flex-col gap-2">
          <ExpressiveSkeletonBone width="52%" height={14} />
          <ExpressiveSkeletonBone width="34%" height={10} />
        </div>
      </div>

      {showMedia && (
        <ExpressiveSkeletonBone
          width="100%"
          height={mediaHeight}
          borderRadius={m3Shapes.large}
        />
      )}

      {/* Contrasting M3 Expressive Shape Chips (Pill + Rounded Square) */}
      <div className="flex items-center gap-2">
        <ExpressiveSkeletonBone width={82} height={28} borderRadius={m3Shapes.pill} />
        <ExpressiveSkeletonBone
          width={96}
          height={28}
          borderRadius={m3Shapes.selectedChip}
        />
      </div>
    </motion.div>
  );
};

/**
 * 4. Spring-Staggered Reveal Wrapper
 * Smoothly reveals loaded cards/sections with M3 Expressive defaultSpatial spring.
 */
export const ExpressiveStaggerReveal: React.FC<{
  index?: number;
  className?: string;
  children: React.ReactNode;
}> = ({ index = 0, className = '', children }) => {
  const { reduceMotion, calmMode } = useAccessibility();
  const transition = getM3Spring('defaultSpatial', {
    reduceMotion,
    calmMode,
    delay: reduceMotion ? 0 : Math.min(index, 6) * 0.06,
  });

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * 5. Zero-Layout-Shift Lazy Tab Skeletons for WELLBE+ Suspense Boundaries
 */
export type ExpressiveTabSkeletonVariant =
  | 'routines'
  | 'log'
  | 'trends'
  | 'coach';

export const ExpressiveTabSkeleton: React.FC<{
  variant: ExpressiveTabSkeletonVariant;
}> = ({ variant }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Loading ${variant} view`}
      className="space-y-4 pb-[104px] sm:pb-[112px]"
    >
      {/* Editorial Section Header Row with Morphing Shape Indicator */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex flex-1 flex-col gap-2">
          <ExpressiveSkeletonBone width={132} height={24} borderRadius={m3Shapes.medium} />
          <ExpressiveSkeletonBone width={210} height={12} />
        </div>
        <ExpressiveMorphLoader size={38} label={`Loading ${variant}`} />
      </div>

      {variant === 'coach' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <ExpressiveCardSkeleton showMedia mediaHeight={220} />
          <ExpressiveCardSkeleton showMedia mediaHeight={132} compact />
        </div>
      ) : variant === 'trends' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ExpressiveSkeletonBone height={84} borderRadius={m3Shapes.large} />
            <ExpressiveSkeletonBone height={84} borderRadius={m3Shapes.large} />
            <ExpressiveSkeletonBone height={84} borderRadius={m3Shapes.large} />
            <ExpressiveSkeletonBone height={84} borderRadius={m3Shapes.large} />
          </div>
          <ExpressiveCardSkeleton showMedia mediaHeight={180} />
        </div>
      ) : variant === 'log' ? (
        <div className="space-y-3">
          {/* Contrasting Pill + Rounded Square Filter Strip Bones */}
          <div className="flex flex-wrap gap-2">
            <ExpressiveSkeletonBone width={68} height={30} borderRadius={m3Shapes.selectedChip} />
            <ExpressiveSkeletonBone width={76} height={30} borderRadius={m3Shapes.pill} />
            <ExpressiveSkeletonBone width={72} height={30} borderRadius={m3Shapes.pill} />
            <ExpressiveSkeletonBone width={78} height={30} borderRadius={m3Shapes.pill} />
          </div>
          <ExpressiveCardSkeleton showMedia={false} compact />
          <ExpressiveCardSkeleton showMedia={false} compact />
          <ExpressiveCardSkeleton showMedia={false} compact />
        </div>
      ) : (
        <div className="space-y-4">
          <ExpressiveCardSkeleton showMedia mediaHeight={116} />
          <ExpressiveCardSkeleton showMedia mediaHeight={116} />
        </div>
      )}
    </div>
  );
};
