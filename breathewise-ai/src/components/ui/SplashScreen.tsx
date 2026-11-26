import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BrandLogo } from './BrandLogo';

interface SplashScreenProps {
  onFinish: () => void;
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [exiting, setExiting] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    // Warm up backend health endpoint silently during splash display
    fetch('/api/v1/health').catch(() => {});

    const holdDuration = prefersReducedMotion ? 450 : 1600;
    const fadeDuration = prefersReducedMotion ? 120 : 280;

    const holdTimer = window.setTimeout(() => {
      setExiting(true);
    }, holdDuration);

    const doneTimer = window.setTimeout(() => {
      onFinish();
    }, holdDuration + fadeDuration);

    return () => {
      window.clearTimeout(holdTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onFinish, prefersReducedMotion]);

  const handleSkip = () => {
    setExiting(true);
    window.setTimeout(onFinish, prefersReducedMotion ? 60 : 160);
  };

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: prefersReducedMotion ? 0.12 : 0.28, ease: EASE_OUT_EXPO }}
      role="region"
      aria-label="BreatheWise AI welcome screen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-6 text-center"
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
        className="flex flex-col items-center gap-5 max-w-md"
      >
        {/* Brand Logo with calm concentric air-ripple reveal */}
        <div className="relative flex items-center justify-center">
          {!prefersReducedMotion && (
            <>
              <motion.span
                aria-hidden="true"
                initial={{ scale: 0.72, opacity: 0 }}
                animate={{ scale: 1.32, opacity: 0.35 }}
                transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
                className="absolute w-20 h-20 rounded-2xl border border-emerald-600/35 dark:border-teal-400/30 pointer-events-none"
              />
              <motion.span
                aria-hidden="true"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.6, opacity: 0.18 }}
                transition={{ duration: 1.15, delay: 0.1, ease: EASE_OUT_EXPO }}
                className="absolute w-20 h-20 rounded-3xl border border-teal-500/30 dark:border-emerald-400/20 pointer-events-none"
              />
            </>
          )}

          <motion.div
            initial={prefersReducedMotion ? false : { scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
            className="relative rounded-2xl shadow-lg shadow-emerald-950/10 dark:shadow-emerald-950/40"
          >
            <BrandLogo size="xl" showWordmark={false} animated />
          </motion.div>
        </div>

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.28, ease: EASE_OUT_EXPO }}
          className="space-y-2"
        >
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            BreatheWise AI
          </h1>
          <p className="text-sm sm:text-base font-medium text-emerald-700 dark:text-emerald-400">
            Breathe Better. Live Smarter. Together.
          </p>
        </motion.div>

        {/* Subtle compositor-only loading bar */}
        <div
          aria-hidden="true"
          className="w-44 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-2"
        >
          <motion.div
            initial={prefersReducedMotion ? { scaleX: 1 } : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 1.45, ease: EASE_OUT_EXPO }}
            style={{ transformOrigin: 'left center' }}
            className="w-full h-full bg-emerald-700 dark:bg-emerald-500"
          />
        </div>

        <motion.button
          type="button"
          onClick={handleSkip}
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="mt-2 px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md transition-colors"
        >
          Continue
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
