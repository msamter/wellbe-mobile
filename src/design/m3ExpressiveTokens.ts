/**
 * Material 3 Expressive Design Tokens & Spring Physics for WELLBE+
 * - Official M3 Expressive Spring Schemes (fastSpatial, defaultSpatial, defaultEffects)
 * - Semantic surface tokens bound to WELLBE+'s live CSS variables (Light/Dark/High-Contrast parity)
 * - Organic M3 Expressive shape masks (Pill, Squircle, ExtraLarge 28px, Organic Blob, 8-point Cookie)
 */

export const m3SurfaceTokens = {
  surface: 'var(--surface-canvas)',
  surfaceContainerLow: 'var(--surface-subtle)',
  surfaceContainer: 'var(--surface-subtle)',
  surfaceContainerHigh: 'var(--surface-hover)',
  surfaceContainerLowest: 'var(--surface-card)',
  primary: 'var(--accent-primary)',
  onPrimary: 'var(--accent-primary-ink)',
  primaryContainer: 'var(--accent-soft)',
  onPrimaryContainer: 'var(--accent-primary)',
  brandContainer: 'var(--brand-accent-soft)',
  onBrandContainer: 'var(--brand-accent-text)',
  onSurface: 'var(--ink-primary)',
  onSurfaceVariant: 'var(--ink-secondary)',
  outlineVariant: 'var(--border-hairline)',
} as const;

export type M3SpringScheme = 'fastSpatial' | 'defaultSpatial' | 'defaultEffects';

// Official M3 Expressive Spring Schemes (Translated to motion/react)
export const m3Springs = {
  // For small interactive elements (buttons, chips, toggles, shape morphs, dock pill)
  fastSpatial: {
    type: 'spring' as const,
    stiffness: 800,
    damping: 32,
    mass: 1,
  },
  // For cards, layout shifts, and staggered list reveals
  defaultSpatial: {
    type: 'spring' as const,
    stiffness: 380,
    damping: 26,
    mass: 1,
  },
  // Critically damped (zero bounce) for opacity, shimmer handoffs, and color transitions
  defaultEffects: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 40,
    mass: 1,
  },
  // Trauma-informed Calm Mode spatial spring (critically damped, softer deceleration)
  calmSpatial: {
    type: 'spring' as const,
    stiffness: 280,
    damping: 34,
    mass: 1,
  },
  // Strict Reduce Motion instant handoff
  instant: {
    duration: 0,
  },
} as const;

export interface M3MotionOptions {
  reduceMotion?: boolean;
  calmMode?: boolean;
  delay?: number;
}

/**
 * Resolves an M3 Expressive spring preset while honoring WELLBE+'s
 * neuro-inclusive Reduce Motion and Calm Mode accessibility settings.
 */
export function getM3Spring(
  scheme: M3SpringScheme,
  options: M3MotionOptions = {}
) {
  const { reduceMotion = false, calmMode = false, delay = 0 } = options;
  if (reduceMotion) {
    return m3Springs.instant;
  }
  const base =
    calmMode && scheme !== 'defaultEffects'
      ? m3Springs.calmSpatial
      : m3Springs[scheme];
  return delay > 0 ? { ...base, delay } : base;
}

// Organic M3 Expressive Shape Library Masks (border-radius & clip-path)
export const m3Shapes = {
  pill: '999px',
  extraLarge: '28px',
  large: '20px',
  medium: '16px',
  squircle: '14px',
  selectedChip: '10px',
  // Organic "Blob / Squircle" silhouette
  organicBlob: '38% 62% 63% 37% / 41% 44% 56% 59%',
  softBurst: '24% 76% 35% 65% / 64% 31% 69% 36%',
  // 8-sided Scalloped "Cookie" polygon
  cookie8:
    'polygon(50% 0%, 68% 9%, 88% 12%, 91% 32%, 100% 50%, 91% 68%, 88% 88%, 68% 91%, 50% 100%, 32% 91%, 12% 88%, 9% 68%, 0% 50%, 9% 32%, 12% 12%, 32% 9%)',
} as const;
