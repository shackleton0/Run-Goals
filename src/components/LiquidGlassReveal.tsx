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
  const pointerRafRef = useRef<number | null>(null);

  const updateClarity = useCallback(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;

    el.dataset.glassExpanded = isExpandedRef.current ? 'true' : 'false';
    el.dataset.glassHovered = isHoveredRef.current ? 'true' : 'false';

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

    // Bring bottom-most cards to full clarity smoothly when scrolled near the page bottom
    const distFromBottom = Math.max(0, maxScroll - window.scrollY);
    const bottomBoost = maxScroll > 20 && distFromBottom < 200 ? 1 - distFromBottom / 200 : 0;

    // Position relative to viewport:
    // Upper ~64% of viewport -> crystal clear (1.0)
    // Lower ~36% of viewport -> smoothly fades into frosted liquid glass near bottom edge
    const topRatio = rect.top / vh;
    let positionalClarity = 1;
    if (topRatio > 0.64) {
      const normalized = Math.min(1, Math.max(0, (1.03 - topRatio) / 0.39));
      positionalClarity = normalized * normalized * (3 - 2 * normalized);
    }

    const clarity = Math.min(1, Math.max(positionalClarity, bottomBoost));
    el.style.setProperty('--lg-clarity', clarity.toFixed(3));
    el.dataset.glassState = clarity >= 0.82 ? 'clear' : 'frosted';
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;

    el.style.setProperty('--lg-mx', '50%');
    el.style.setProperty('--lg-my', '0%');

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
      if (pointerRafRef.current !== null) window.cancelAnimationFrame(pointerRafRef.current);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [updateClarity]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (pointerRafRef.current !== null) return;
    pointerRafRef.current = window.requestAnimationFrame(() => {
      pointerRafRef.current = null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const xPct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
      const yPct = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
      el.style.setProperty('--lg-mx', `${xPct.toFixed(1)}%`);
      el.style.setProperty('--lg-my', `${yPct.toFixed(1)}%`);
    });
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onMouseEnter={() => {
        isHoveredRef.current = true;
        updateClarity();
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
        const el = containerRef.current;
        if (el) {
          el.style.setProperty('--lg-mx', '50%');
          el.style.setProperty('--lg-my', '0%');
        }
        updateClarity();
      }}
      className={`liquid-glass-scroll-shell ${className}`}
    >
      {children}
    </div>
  );
};
