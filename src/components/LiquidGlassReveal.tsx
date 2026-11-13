import React, { useEffect, useRef, useCallback } from 'react';

interface LiquidGlassRevealProps {
  children: React.ReactNode;
  className?: string;
}

export const LiquidGlassReveal: React.FC<LiquidGlassRevealProps> = ({
  children,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isHoveredRef = useRef<boolean>(false);
  const isExpandedRef = useRef<boolean>(false);

  const updateClarity = useCallback(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;

    if (isExpandedRef.current || isHoveredRef.current) {
      el.style.setProperty('--lg-clarity', '1');
      el.dataset.glassState = 'clear';
      return;
    }

    const vh = window.innerHeight || 800;
    const rect = el.getBoundingClientRect();
    const docEl = document.documentElement;
    const scrollHeight = docEl?.scrollHeight || vh;
    const maxScroll = Math.max(0, scrollHeight - vh);

    // Smoothly bring bottom-most cards to full clarity when scrolled to the bottom
    const distFromBottom = Math.max(0, maxScroll - window.scrollY);
    const bottomBoost = maxScroll > 20 && distFromBottom < 180 ? 1 - distFromBottom / 180 : 0;

    // Position relative to viewport:
    // Upper ~65% of viewport -> crisp (1.0)
    // Lower ~35% of viewport -> smoothly fades toward frosted liquid glass near bottom edge
    const topRatio = rect.top / vh;
    let positionalClarity = 1;
    if (topRatio > 0.65) {
      const normalized = Math.min(1, Math.max(0, (1.03 - topRatio) / 0.38));
      positionalClarity = normalized * normalized * (3 - 2 * normalized);
    }

    const clarity = Math.min(1, Math.max(positionalClarity, bottomBoost));
    el.style.setProperty('--lg-clarity', clarity.toFixed(3));
    el.dataset.glassState = clarity >= 0.82 ? 'clear' : 'frosted';
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;

    let rafId: number | null = null;
    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateClarity();
      });
    };

    const syncExpanded = () => {
      isExpandedRef.current = Boolean(el.querySelector('[aria-expanded="true"]'));
    };

    syncExpanded();
    updateClarity();

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => scheduleUpdate())
        : null;
    resizeObserver?.observe(el);

    const mutationObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            syncExpanded();
            scheduleUpdate();
          })
        : null;
    mutationObserver?.observe(el, {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-expanded'],
    });

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [updateClarity]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => {
        isHoveredRef.current = true;
        updateClarity();
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
        updateClarity();
      }}
      className={`liquid-glass-scroll-shell ${className}`}
    >
      {children}
    </div>
  );
};
