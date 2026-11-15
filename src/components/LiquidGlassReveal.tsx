import React, { useEffect, useRef, useState } from 'react';
import { usePerformanceMode } from '../contexts/PerformanceModeContext';

interface LiquidGlassRevealProps {
  children: React.ReactNode;
  className?: string;
}

export const LiquidGlassReveal: React.FC<LiquidGlassRevealProps> = ({
  children,
  className = '',
}) => {
  const { isLightweight } = usePerformanceMode();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (isLightweight) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        // Clear as soon as the card rises meaningfully above the bottom viewport edge
        setIsVisible(entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight * 0.82);
      },
      {
        rootMargin: '0px 0px -10% 0px',
        threshold: 0.05,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isLightweight]);

  if (isLightweight) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={containerRef}
      data-glass-state={isVisible ? 'clear' : 'frosted'}
      className={`liquid-glass-scroll-shell ${className}`}
    >
      {children}
    </div>
  );
};
