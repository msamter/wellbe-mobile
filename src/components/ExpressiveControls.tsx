import React, { forwardRef } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { Check } from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  getM3Spring,
  m3Shapes,
  m3Springs,
  m3SurfaceTokens,
} from '../design/m3ExpressiveTokens';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ExpressiveButtonProps
  extends Omit<
    HTMLMotionProps<'button'>,
    'children' | 'ref' | 'style'
  > {
  variant?: ButtonVariant;
  size?: ButtonSize;
  selected?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const SIZE_MAP: Record<
  ButtonSize,
  { minHeight: number; paddingX: number; fontSize: number; gap: number }
> = {
  sm: { minHeight: 36, paddingX: 14, fontSize: 12, gap: 6 },
  md: { minHeight: 44, paddingX: 18, fontSize: 13, gap: 7 },
  lg: { minHeight: 50, paddingX: 22, fontSize: 14, gap: 8 },
};

function getButtonVariantStyles(
  variant: ButtonVariant,
  selected: boolean
): React.CSSProperties {
  if (selected) {
    return {
      backgroundColor: m3SurfaceTokens.primaryContainer,
      color: m3SurfaceTokens.onPrimaryContainer,
      border: '1px solid var(--accent-primary)',
    };
  }

  switch (variant) {
    case 'filled':
      return {
        backgroundColor: m3SurfaceTokens.primary,
        color: m3SurfaceTokens.onPrimary,
        border: '1px solid transparent',
      };
    case 'tonal':
      return {
        backgroundColor: m3SurfaceTokens.brandContainer,
        color: m3SurfaceTokens.onBrandContainer,
        border: '1px solid var(--brand-accent-border)',
      };
    case 'outlined':
      return {
        backgroundColor: m3SurfaceTokens.surfaceContainerLowest,
        color: m3SurfaceTokens.onSurface,
        border: '1px solid var(--border-hairline)',
      };
    case 'text':
      return {
        backgroundColor: 'transparent',
        color: m3SurfaceTokens.primary,
        border: '1px solid transparent',
      };
  }
}

/**
 * Universal M3 Expressive Button Primitive
 * - Pill (999px) at rest -> morphs to rounded squircle (11px–15px) on press via fastSpatial spring
 * - Selected state morphs smoothly to 14px squircle with primaryContainer tonal shift
 * - Honors both OS prefers-reduced-motion and WELLBE+ AccessibilityContext (reduceMotion & calmMode)
 */
export const ExpressiveButton = forwardRef<HTMLButtonElement, ExpressiveButtonProps>(
  (
    {
      variant = 'filled',
      size = 'md',
      selected = false,
      leadingIcon,
      trailingIcon,
      children,
      style,
      className = '',
      disabled,
      onClick,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const osReduced = useReducedMotion();
    const { reduceMotion: appReduced, calmMode } = useAccessibility();
    const reduceMotion = Boolean(osReduced || appReduced);
    const dims = SIZE_MAP[size];
    const palette = getButtonVariantStyles(variant, selected);

    const spring = reduceMotion
      ? m3Springs.defaultEffects
      : getM3Spring('fastSpatial', { reduceMotion: false, calmMode });

    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={disabled}
        onClick={onClick}
        whileHover={disabled || reduceMotion ? undefined : { scale: 1.02 }}
        whileTap={
          disabled || reduceMotion
            ? undefined
            : {
                scale: 0.94,
                borderRadius: size === 'sm' ? '11px' : '15px',
              }
        }
        animate={{
          borderRadius: selected ? '14px' : m3Shapes.pill,
        }}
        transition={spring}
        className={`inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
        style={{
          minHeight: dims.minHeight,
          paddingLeft: dims.paddingX,
          paddingRight: dims.paddingX,
          fontSize: dims.fontSize,
          gap: dims.gap,
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...palette,
          ...style,
        }}
        {...rest}
      >
        {leadingIcon && <span className="inline-flex shrink-0">{leadingIcon}</span>}
        <span>{children}</span>
        {trailingIcon && <span className="inline-flex shrink-0">{trailingIcon}</span>}
      </motion.button>
    );
  }
);
ExpressiveButton.displayName = 'ExpressiveButton';

/**
 * M3 Expressive Icon Button Primitive
 * - 40px–48px circular pill hit target (999px) -> morphs into 14px squircle on press or active toggle
 */
export type IconButtonVariant = 'standard' | 'filled' | 'tonal' | 'outlined';

export interface ExpressiveIconButtonProps
  extends Omit<
    HTMLMotionProps<'button'>,
    'children' | 'ref' | 'style'
  > {
  variant?: IconButtonVariant;
  toggled?: boolean;
  size?: number;
  ariaLabel: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const ExpressiveIconButton = forwardRef<
  HTMLButtonElement,
  ExpressiveIconButtonProps
>(
  (
    {
      variant = 'standard',
      toggled = false,
      size = 44,
      ariaLabel,
      children,
      style,
      className = '',
      disabled,
      onClick,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const osReduced = useReducedMotion();
    const { reduceMotion: appReduced, calmMode } = useAccessibility();
    const reduceMotion = Boolean(osReduced || appReduced);

    const getColors = (): React.CSSProperties => {
      if (toggled) {
        return {
          backgroundColor: m3SurfaceTokens.primary,
          color: m3SurfaceTokens.onPrimary,
          border: '1px solid transparent',
        };
      }
      switch (variant) {
        case 'filled':
          return {
            backgroundColor: m3SurfaceTokens.primaryContainer,
            color: m3SurfaceTokens.onPrimaryContainer,
            border: '1px solid transparent',
          };
        case 'tonal':
          return {
            backgroundColor: m3SurfaceTokens.surfaceContainerHigh,
            color: m3SurfaceTokens.onSurface,
            border: '1px solid transparent',
          };
        case 'outlined':
          return {
            backgroundColor: m3SurfaceTokens.surfaceContainerLowest,
            color: m3SurfaceTokens.onSurfaceVariant,
            border: '1px solid var(--border-hairline)',
          };
        case 'standard':
        default:
          return {
            backgroundColor: 'transparent',
            color: m3SurfaceTokens.onSurfaceVariant,
            border: '1px solid transparent',
          };
      }
    };

    const palette = getColors();
    const spring = reduceMotion
      ? m3Springs.defaultEffects
      : getM3Spring('fastSpatial', { reduceMotion: false, calmMode });

    return (
      <motion.button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        aria-pressed={rest['aria-pressed'] ?? toggled}
        disabled={disabled}
        onClick={onClick}
        whileHover={disabled || reduceMotion ? undefined : { scale: 1.05 }}
        whileTap={
          disabled || reduceMotion
            ? undefined
            : {
                scale: 0.9,
                borderRadius: m3Shapes.squircle,
              }
        }
        animate={{
          borderRadius: toggled ? m3Shapes.squircle : m3Shapes.pill,
        }}
        transition={spring}
        className={`inline-flex shrink-0 select-none items-center justify-center p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
        style={{
          width: size,
          height: size,
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...palette,
          ...style,
        }}
        {...rest}
      >
        {children}
      </motion.button>
    );
  }
);
ExpressiveIconButton.displayName = 'ExpressiveIconButton';

/**
 * M3 Expressive Filter / Choice Chip Primitive
 * - Unselected: 999px pill on surfaceContainer
 * - Selected / Pressed: morphs to 10px–11px squircle with spring Check reveal and tonal shift
 * - Supports optional toneStyle override so WELLBE+'s 4 emotional quadrants retain semantic colors
 */
export interface ExpressiveChipProps
  extends Omit<
    HTMLMotionProps<'button'>,
    'children' | 'ref' | 'style'
  > {
  label: string;
  count?: number;
  selected?: boolean;
  icon?: React.ReactNode;
  showCheckOnSelect?: boolean;
  toneStyle?: React.CSSProperties;
  style?: React.CSSProperties;
}

export const ExpressiveChip = forwardRef<HTMLButtonElement, ExpressiveChipProps>(
  (
    {
      label,
      count,
      selected = false,
      onClick,
      icon,
      showCheckOnSelect = true,
      toneStyle,
      className = '',
      style,
      disabled,
      ...rest
    },
    ref
  ) => {
    const osReduced = useReducedMotion();
    const { reduceMotion: appReduced, calmMode } = useAccessibility();
    const reduceMotion = Boolean(osReduced || appReduced);

    const spring = reduceMotion
      ? m3Springs.defaultEffects
      : getM3Spring('fastSpatial', { reduceMotion: false, calmMode });

    const defaultPalette: React.CSSProperties = selected
      ? {
          backgroundColor: m3SurfaceTokens.primaryContainer,
          color: m3SurfaceTokens.onPrimaryContainer,
          border: '1px solid var(--accent-primary)',
        }
      : {
          backgroundColor: m3SurfaceTokens.surfaceContainerLowest,
          color: m3SurfaceTokens.onSurfaceVariant,
          border: '1px solid var(--border-hairline)',
        };

    return (
      <motion.button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-pressed={rest['aria-pressed'] ?? selected}
        whileHover={disabled || reduceMotion ? undefined : { scale: 1.03 }}
        whileTap={
          disabled || reduceMotion
            ? undefined
            : {
                scale: 0.92,
                borderRadius: m3Shapes.selectedChip,
              }
        }
        animate={{
          borderRadius: selected ? '11px' : m3Shapes.pill,
        }}
        transition={spring}
        className={`inline-flex min-h-[34px] shrink-0 select-none items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-semibold transition-colors tabular-nums disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...defaultPalette,
          ...toneStyle,
          ...style,
        }}
        {...rest}
      >
        {selected && showCheckOnSelect ? (
          <motion.span
            initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={spring}
            className="inline-flex shrink-0"
          >
            <Check size={13} strokeWidth={2.8} aria-hidden="true" />
          </motion.span>
        ) : (
          icon && <span className="inline-flex shrink-0">{icon}</span>
        )}
        <span>{label}</span>
        {typeof count === 'number' && count > 0 && (
          <span className="opacity-70">{count}</span>
        )}
      </motion.button>
    );
  }
);
ExpressiveChip.displayName = 'ExpressiveChip';
