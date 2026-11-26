import { motion, useReducedMotion } from 'motion/react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  animated?: boolean;
  className?: string;
}

const ICON_SIZES = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const WORDMARK_SIZES = {
  sm: 'text-base sm:text-lg',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function BrandLogo({
  size = 'sm',
  showWordmark = true,
  animated = false,
  className = '',
}: BrandLogoProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animated && !prefersReducedMotion;

  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      <motion.svg
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        initial={shouldAnimate ? { scale: 0.9, opacity: 0 } : false}
        animate={shouldAnimate ? { scale: 1, opacity: 1 } : undefined}
        transition={{ duration: 0.42, ease: EASE_OUT_EXPO }}
        className={`${ICON_SIZES[size]} shrink-0`}
      >
        <rect width="64" height="64" rx="16" className="fill-emerald-900 dark:fill-emerald-800" />
        <motion.path
          d="M18 42C18 26 28 17 45 16C45 33 36 43 21 43"
          stroke="#ECFDF5"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={shouldAnimate ? { pathLength: 0, opacity: 0.25 } : false}
          animate={shouldAnimate ? { pathLength: 1, opacity: 1 } : undefined}
          transition={{ duration: 0.55, delay: 0.1, ease: EASE_OUT_EXPO }}
        />
        <motion.path
          d="M16 28H33C36 28 38 26 38 23.5C38 21 36 19.5 33.8 19.5"
          stroke="#5EEAD4"
          strokeWidth="3.4"
          strokeLinecap="round"
          initial={shouldAnimate ? { pathLength: 0, opacity: 0 } : false}
          animate={shouldAnimate ? { pathLength: 1, opacity: 1 } : undefined}
          transition={{ duration: 0.46, delay: 0.3, ease: EASE_OUT_EXPO }}
        />
        <motion.path
          d="M15 35H39C42.5 35 45 37 45 39.8C45 42.5 42.5 44.5 39.5 44.5"
          stroke="#5EEAD4"
          strokeWidth="3.4"
          strokeLinecap="round"
          initial={shouldAnimate ? { pathLength: 0, opacity: 0 } : false}
          animate={shouldAnimate ? { pathLength: 1, opacity: 1 } : undefined}
          transition={{ duration: 0.46, delay: 0.42, ease: EASE_OUT_EXPO }}
        />
      </motion.svg>
      {showWordmark && (
        <span
          className={`font-display font-bold tracking-tight text-slate-900 dark:text-white ${WORDMARK_SIZES[size]}`}
        >
          BreatheWise AI
        </span>
      )}
    </span>
  );
}
