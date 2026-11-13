import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

export type PerformancePreference = 'auto' | 'standard' | 'lightweight';

const PERFORMANCE_STORAGE_KEY = 'xc_6k_performance_mode';

interface PerformanceModeContextValue {
  preference: PerformancePreference;
  setPreference: (pref: PerformancePreference) => void;
  isLightweight: boolean;
  autoSlowDetected: boolean;
  prefersReducedMotion: boolean;
  showAutoNotice: boolean;
  dismissAutoNotice: () => void;
}

const PerformanceModeContext = createContext<PerformanceModeContextValue>({
  preference: 'auto',
  setPreference: () => {},
  isLightweight: false,
  autoSlowDetected: false,
  prefersReducedMotion: false,
  showAutoNotice: false,
  dismissAutoNotice: () => {},
});

function readStoredPreference(): PerformancePreference {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = localStorage.getItem(PERFORMANCE_STORAGE_KEY);
    if (raw === 'auto' || raw === 'standard' || raw === 'lightweight') {
      return raw;
    }
  } catch {
    // ignore storage errors
  }
  return 'auto';
}

export const PerformanceModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [preference, setPreferenceState] = useState<PerformancePreference>(readStoredPreference);
  const [autoSlowDetected, setAutoSlowDetected] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const startupTimeRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0);

  // Listen to OS reduced-motion preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    setPrefersReducedMotion(mq.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    return undefined;
  }, []);

  const setPreference = useCallback((next: PerformancePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(PERFORMANCE_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
    if (next === 'standard' || next === 'auto') {
      setAutoSlowDetected(false);
      setNoticeDismissed(false);
      if (typeof performance !== 'undefined') {
        startupTimeRef.current = performance.now();
      }
    }
  }, []);

  const dismissAutoNotice = useCallback(() => {
    setNoticeDismissed(true);
  }, []);

  // Automatic slowness detection when preference === 'auto'
  useEffect(() => {
    if (preference !== 'auto' || autoSlowDetected || typeof window === 'undefined') {
      return;
    }

    let cancelled = false;
    let burstRafId: number | null = null;
    let burstActiveUntil = 0;
    let lastFrameTime = 0;
    let consecutiveSlowFrames = 0;
    let cumulativeSlowFrames = 0;
    const longTaskTimestamps: number[] = [];

    const triggerSlowMode = () => {
      if (cancelled) return;
      cancelled = true;
      setAutoSlowDetected(true);
      setNoticeDismissed(false);
    };

    const runBurstSample = (now: number) => {
      if (cancelled) return;
      if (document.visibilityState !== 'visible') {
        burstRafId = null;
        lastFrameTime = 0;
        return;
      }

      if (lastFrameTime > 0) {
        const dt = now - lastFrameTime;
        // Ignore > 450ms gaps (e.g. backgrounding or debugger pause)
        if (dt > 55 && dt < 450) {
          consecutiveSlowFrames += 1;
          cumulativeSlowFrames += 1;
          if (consecutiveSlowFrames >= 6 || cumulativeSlowFrames >= 12) {
            triggerSlowMode();
            return;
          }
        } else if (dt <= 40) {
          consecutiveSlowFrames = Math.max(0, consecutiveSlowFrames - 0.5);
        }
      }

      lastFrameTime = now;

      if (now < burstActiveUntil) {
        burstRafId = window.requestAnimationFrame(runBurstSample);
      } else {
        burstRafId = null;
        lastFrameTime = 0;
        consecutiveSlowFrames = 0;
      }
    };

    const startBurst = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      const now = performance.now();
      // Give initial app mount 1.5s to settle before sampling frame deltas
      if (now - startupTimeRef.current < 1500) return;

      burstActiveUntil = now + 1100;
      if (burstRafId === null) {
        lastFrameTime = 0;
        burstRafId = window.requestAnimationFrame(runBurstSample);
      }
    };

    window.addEventListener('scroll', startBurst, { passive: true });
    window.addEventListener('pointerdown', startBurst, { passive: true });

    // Also monitor sustained UI main-thread long tasks (> 160ms) while visible
    let perfObserver: PerformanceObserver | null = null;
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const supported = PerformanceObserver.supportedEntryTypes || [];
        if (supported.includes('longtask')) {
          perfObserver = new PerformanceObserver((list) => {
            if (cancelled || document.visibilityState !== 'visible') return;
            const now = performance.now();
            if (now - startupTimeRef.current < 1500) return;

            for (const entry of list.getEntries()) {
              if (entry.duration >= 160) {
                longTaskTimestamps.push(now);
              }
            }

            // Retain tasks from the last 8 seconds
            while (longTaskTimestamps.length > 0 && now - longTaskTimestamps[0] > 8000) {
              longTaskTimestamps.shift();
            }

            if (longTaskTimestamps.length >= 4) {
              triggerSlowMode();
            }
          });
          perfObserver.observe({ entryTypes: ['longtask'] });
        }
      } catch {
        // Ignore if longtask observer isn't supported
      }
    }

    return () => {
      cancelled = true;
      if (burstRafId !== null) window.cancelAnimationFrame(burstRafId);
      window.removeEventListener('scroll', startBurst);
      window.removeEventListener('pointerdown', startBurst);
      perfObserver?.disconnect();
    };
  }, [preference, autoSlowDetected]);

  const isLightweight =
    preference === 'lightweight' ||
    (preference === 'auto' && (autoSlowDetected || prefersReducedMotion));

  // Toggle CSS root class immediately so all styles react instantaneously
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('low-power-mode', isLightweight);
  }, [isLightweight]);

  const showAutoNotice = preference === 'auto' && autoSlowDetected && !noticeDismissed;

  return (
    <PerformanceModeContext.Provider
      value={{
        preference,
        setPreference,
        isLightweight,
        autoSlowDetected,
        prefersReducedMotion,
        showAutoNotice,
        dismissAutoNotice,
      }}
    >
      {children}
    </PerformanceModeContext.Provider>
  );
};

export function usePerformanceMode() {
  return useContext(PerformanceModeContext);
}
