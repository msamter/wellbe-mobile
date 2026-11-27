import React from 'react';
import { EmotionQuadrant, MoodBucket } from '../types/wellbe';

interface GlyphProps {
  emotionId?: string;
  bucket?: MoodBucket;
  quadrant?: EmotionQuadrant;
  size?: number;
  className?: string;
}

/**
 * Custom geometric/organic affective micro-glyphs replacing system emojis.
 * Clean, serene, adult-oriented vector forms paired with quadrant semantics.
 */
export const AffectiveGlyph: React.FC<GlyphProps> = React.memo(
  ({ emotionId, bucket, quadrant, size = 18, className = '' }) => {
    const strokeWidth = 1.65;

  const renderShape = () => {
    switch (emotionId) {
      // Yellow Quadrant — Radiant, upward, expansive geometry
      case 'ecstatic':
        return (
          <>
            <circle cx="12" cy="12" r="4.2" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth={strokeWidth} />
            <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
          </>
        );
      case 'joyful':
        return (
          <>
            <circle cx="12" cy="12" r="7.5" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth={strokeWidth} />
            <path d="M8.5 13.2c.9 1.6 2.1 2.3 3.5 2.3s2.6-.7 3.5-2.3" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
            <circle cx="9.2" cy="9.8" r="0.9" fill="currentColor" />
            <circle cx="14.8" cy="9.8" r="0.9" fill="currentColor" />
          </>
        );
      case 'energized':
        return (
          <>
            <path d="M13 3L6.5 13h5l-.8 8L17.5 11h-5l.5-8z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
          </>
        );
      case 'inspired':
        return (
          <>
            <path d="M12 3.2l2.1 5.6 5.7 2.1-5.7 2.1-2.1 5.8-2.1-5.8-5.7-2.1 5.7-2.1L12 3.2z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
          </>
        );

      // Green Quadrant — Organic, balanced, restorative curves
      case 'grateful':
        return (
          <>
            <path d="M12 19.2s-6.8-4.2-6.8-9.1a4 4 0 017-2.6 4 4 0 017 2.6c0 4.9-7.2 9.1-7.2 9.1z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
          </>
        );
      case 'calm':
        return (
          <>
            <path d="M3.5 10.5c2.2-1.8 4.2-1.8 6.4 0s4.2 1.8 6.4 0 3.2-1.2 4.2-.3" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
            <path d="M3.5 15c2.2-1.8 4.2-1.8 6.4 0s4.2 1.8 6.4 0 3.2-1.2 4.2-.3" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" fill="none" opacity="0.6" />
          </>
        );
      case 'content':
        return (
          <>
            <circle cx="12" cy="12" r="7.2" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth={strokeWidth} />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
          </>
        );
      case 'rested':
        return (
          <>
            <path d="M16.8 14.8A6.8 6.8 0 019.2 7.2a6.9 6.9 0 107.6 7.6z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
          </>
        );

      // Balanced / Steady
      case 'steady':
        return (
          <>
            <circle cx="12" cy="12" r="7.2" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth={strokeWidth} />
            <path d="M7.5 12h9" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
          </>
        );

      // Blue Quadrant — Weighted, downward, low-energy stillness
      case 'tired':
        return (
          <>
            <circle cx="12" cy="12" r="7.2" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth={strokeWidth} />
            <path d="M8.5 10.8h2.5M13 10.8h2.5M9.5 15h5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
          </>
        );
      case 'drained':
        return (
          <>
            <rect x="4" y="7.5" width="13.5" height="9" rx="2.2" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth={strokeWidth} />
            <path d="M19.5 10.2v3.6M7.2 10.5v3" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
          </>
        );
      case 'sad':
        return (
          <>
            <path d="M12 4.5s5.2 6 5.2 9.6a5.2 5.2 0 01-10.4 0C6.8 10.5 12 4.5 12 4.5z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
          </>
        );
      case 'lonely':
        return (
          <>
            <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray="3 3" fill="none" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          </>
        );

      // Red Quadrant — Sharp, constricted, high-tension geometry
      case 'anxious':
        return (
          <>
            <path d="M3.5 12l2.6-3.8 2.8 7.6 3.1-9.6 3 9.2 2.4-5.4 3.1 2" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </>
        );
      case 'stressed':
        return (
          <>
            <polygon points="12,3.8 20,18.2 4,18.2" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
            <path d="M12 9.5v4.2M12 16v.5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
          </>
        );
      case 'frustrated':
        return (
          <>
            <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={1.2} strokeOpacity="0.35" fill="none" />
          </>
        );
      case 'overwhelmed':
        return (
          <>
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={strokeWidth} fill="none" opacity="0.45" />
            <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth={strokeWidth} fill="none" opacity="0.75" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </>
        );
      default:
        break;
    }

    // Fallback by bucket or quadrant
    const key = bucket ?? quadrant;
    if (key === 'happy' || key === 'yellow') {
      return <circle cx="12" cy="12" r="5.5" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth={strokeWidth} />;
    }
    if (key === 'calm' || key === 'green') {
      return <path d="M4 12c2.5-2.5 5.5-2.5 8 0s5.5 2.5 8 0" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />;
    }
    if (key === 'low' || key === 'blue') {
      return <path d="M12 5.5s4.8 5.4 4.8 8.6a4.8 4.8 0 01-9.6 0c0-3.2 4.8-8.6 4.8-8.6z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth={strokeWidth} />;
    }
    if (key === 'upset' || key === 'red') {
      return <polygon points="12,4.5 19.5,18 4.5,18" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />;
    }
    return (
      <>
        <circle cx="12" cy="12" r="6.8" stroke="currentColor" strokeWidth={strokeWidth} fill="none" />
        <path d="M8.5 12h7" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      </>
    );
  };

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        {renderShape()}
      </svg>
    );
  }
);
AffectiveGlyph.displayName = 'AffectiveGlyph';

export interface QuadrantStyleTokens {
  readonly bg: string;
  readonly fg: string;
  readonly border: string;
  readonly solid: string;
  readonly ink: string;
}

const QUADRANT_STYLES: Readonly<Record<EmotionQuadrant, QuadrantStyleTokens>> = Object.freeze({
  yellow: Object.freeze({
    bg: 'var(--q-yellow-bg)',
    fg: 'var(--q-yellow-fg)',
    border: 'var(--q-yellow-border)',
    solid: 'var(--q-yellow-solid)',
    ink: 'var(--q-yellow-ink)',
  }),
  green: Object.freeze({
    bg: 'var(--q-green-bg)',
    fg: 'var(--q-green-fg)',
    border: 'var(--q-green-border)',
    solid: 'var(--q-green-solid)',
    ink: 'var(--q-green-ink)',
  }),
  blue: Object.freeze({
    bg: 'var(--q-blue-bg)',
    fg: 'var(--q-blue-fg)',
    border: 'var(--q-blue-border)',
    solid: 'var(--q-blue-solid)',
    ink: 'var(--q-blue-ink)',
  }),
  red: Object.freeze({
    bg: 'var(--q-red-bg)',
    fg: 'var(--q-red-fg)',
    border: 'var(--q-red-border)',
    solid: 'var(--q-red-solid)',
    ink: 'var(--q-red-ink)',
  }),
  balanced: Object.freeze({
    bg: 'var(--q-balanced-bg)',
    fg: 'var(--q-balanced-fg)',
    border: 'var(--q-balanced-border)',
    solid: 'var(--q-balanced-solid)',
    ink: 'var(--q-balanced-ink)',
  }),
});

export function getQuadrantStyle(quadrant: EmotionQuadrant): QuadrantStyleTokens {
  return QUADRANT_STYLES[quadrant] ?? QUADRANT_STYLES.balanced;
}
