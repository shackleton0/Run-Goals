import React, { useState } from 'react';
import { RunRecord } from '../types/running';
import {
  TrainingCategory,
  calculateCategoryBreakdown,
  formatDuration,
  formatPace,
  KM_TO_MILES,
} from '../utils/runningCalculations';
import { PieChart, RotateCcw, Activity, X } from 'lucide-react';

interface CategoryPieChartProps {
  runs: RunRecord[];
  unit: 'km' | 'miles';
  onOpenGarminSync?: () => void;
  onOpenAddRun?: () => void;
}

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({
  runs,
  unit,
  onOpenGarminSync,
  onOpenAddRun,
}) => {
  const [timeWindow, setTimeWindow] = useState<'30d' | 'all'>('30d');
  const [metricMode, setMetricMode] = useState<'distance' | 'count'>('distance');
  // Locked isolation state via click/tap
  const [activeCategory, setActiveCategory] = useState<TrainingCategory | null>(null);
  // Hover preview state across donut and cards
  const [hoveredCategory, setHoveredCategory] = useState<TrainingCategory | null>(null);

  // Compute 30-day breakdown (or all-time if toggled)
  const windowDays = timeWindow === '30d' ? 30 : 9999;
  const breakdown = calculateCategoryBreakdown(runs, windowDays);
  const totalVolume = metricMode === 'distance' ? breakdown.totalDistanceKm : breakdown.totalRuns;

  // The category currently in focus: click/tap lock takes precedence over hover
  const effectiveCategory = activeCategory || hoveredCategory;
  const focusedItem = effectiveCategory
    ? breakdown.items.find((i) => i.category === effectiveCategory)
    : null;

  // Convert distance to unit preference helper
  const formatDist = (km: number) => {
    if (unit === 'miles') {
      return `${(km * KM_TO_MILES).toFixed(1)} mi`;
    }
    return `${km.toFixed(1)} km`;
  };

  // Fixed SVG Donut Math (geometry remains strictly constant to prevent mouse boundary flicker loops)
  const size = 280;
  const center = size / 2;
  const outerRadius = 120;
  const innerRadius = 78;

  // Build slices data
  const validItems = breakdown.items.filter((item) =>
    metricMode === 'distance' ? item.totalDistanceKm > 0 : item.runCount > 0
  );

  let currentAngle = -90; // Start at 12 o'clock
  const slices = breakdown.items.map((item) => {
    const value = metricMode === 'distance' ? item.totalDistanceKm : item.runCount;
    const percentage = totalVolume > 0 ? (value / totalVolume) * 100 : 0;
    const angleSpan = totalVolume > 0 ? (value / totalVolume) * 360 : 0;

    const startAngle = currentAngle;
    const endAngle = currentAngle + angleSpan;
    if (angleSpan > 0) {
      currentAngle += angleSpan;
    }

    return {
      ...item,
      value,
      percentage,
      startAngle,
      endAngle,
      angleSpan,
    };
  });

  // Helper for polar to cartesian
  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  // Generate SVG path for a donut segment with constant outer radius
  const createDonutSlicePath = (startAngle: number, endAngle: number) => {
    if (endAngle - startAngle >= 359.9) {
      return null;
    }

    // Angular gap for visual separation between slices
    const gap = validItems.length > 1 ? 1.5 : 0;
    const adjStart = startAngle + gap;
    const adjEnd = endAngle - gap;

    if (adjEnd <= adjStart) return '';

    const p1 = polarToCartesian(center, center, outerRadius, adjStart);
    const p2 = polarToCartesian(center, center, outerRadius, adjEnd);
    const p3 = polarToCartesian(center, center, innerRadius, adjEnd);
    const p4 = polarToCartesian(center, center, innerRadius, adjStart);

    const largeArc = adjEnd - adjStart > 180 ? 1 : 0;

    return `M ${p1.x} ${p1.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;
  };

  const handleToggleCategory = (cat: TrainingCategory) => {
    setActiveCategory((prev) => (prev === cat ? null : cat));
  };

  return (
    <div className="space-y-6">
      {/* Controls & Mode Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800/80">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
              30-Day Training Distribution
            </h3>
            <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 tabular-nums">
              ({breakdown.totalRuns} runs recorded)
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Breakdown across Easy, Interval, Tempo, and Race efforts to monitor 80/20 training balance
          </p>
        </div>

        {/* View Switchers */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {/* Window: 30 Days / All Time */}
          <div className="inline-flex p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
            <button
              onClick={() => setTimeWindow('30d')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                timeWindow === '30d'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setTimeWindow('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                timeWindow === 'all'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Metric: Distance vs Sessions */}
          <div className="inline-flex p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
            <button
              onClick={() => setMetricMode('distance')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                metricMode === 'distance'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Mileage
            </button>
            <button
              onClick={() => setMetricMode('count')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                metricMode === 'count'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Runs
            </button>
          </div>
        </div>
      </div>

      {/* Main Breakdown Layout */}
      {breakdown.totalRuns === 0 ? (
        <div className="py-12 px-4 text-center rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
          <PieChart className="w-8 h-8 text-neutral-400 dark:text-neutral-600 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            {timeWindow === '30d' ? 'No Runs Logged in the Last 30 Days' : 'No Training Activities Recorded'}
          </h4>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1 mb-4">
            {runs.length > 0
              ? 'You have training runs from earlier seasons. Switch to All Time or import recent Garmin activities to populate your category breakdown.'
              : 'Upload your Garmin Connect workout files or log a training run to visualize your category balance.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {runs.length > 0 && timeWindow === '30d' && (
              <button
                onClick={() => setTimeWindow('all')}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-black cursor-pointer hover:opacity-90"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>View All Time ({runs.length} runs)</span>
              </button>
            )}
            {onOpenGarminSync && (
              <button
                onClick={onOpenGarminSync}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0593C6] text-white cursor-pointer hover:bg-[#047da8]"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Upload Garmin Activities</span>
              </button>
            )}
            {onOpenAddRun && (
              <button
                onClick={onOpenAddRun}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <span>Log Manual Run</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active Isolation Status Pill */}
          {activeCategory && focusedItem && (
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-white/90 dark:bg-[#12222f]/90 backdrop-blur-md border border-neutral-200/90 dark:border-neutral-700 shadow-xs animate-in fade-in duration-150">
              <div className="flex items-center space-x-2">
                <span
                  className="w-3 h-3 rounded-full shadow-xs"
                  style={{ backgroundColor: focusedItem.color }}
                />
                <span className="text-xs font-bold text-neutral-900 dark:text-white">
                  Locked on {focusedItem.name}
                </span>
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">
                  · {focusedItem.totalDistanceKm.toFixed(1)} km ({focusedItem.percentageDistance}% volume)
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveCategory(null);
                  setHoveredCategory(null);
                }}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
              >
                <span>Reset View</span>
                <X className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Interactive SVG Donut Viewport (Desktop: 5 cols, Mobile: full width centered) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-2 sm:p-3">
              <div
                className="relative w-[280px] h-[280px] flex items-center justify-center select-none"
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <svg
                  viewBox={`0 0 ${size} ${size}`}
                  className="w-full h-full transform -rotate-0 drop-shadow-xs overflow-visible"
                >
                  {/* Background Track Ring */}
                  <circle
                    cx={center}
                    cy={center}
                    r={(outerRadius + innerRadius) / 2}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={outerRadius - innerRadius}
                    className="text-neutral-100 dark:text-neutral-800/50"
                  />

                  {/* Single Full Ring Case */}
                  {validItems.length === 1 && (
                    <circle
                      cx={center}
                      cy={center}
                      r={(outerRadius + innerRadius) / 2}
                      fill="none"
                      stroke={validItems[0].color}
                      strokeWidth={outerRadius - innerRadius}
                      className="cursor-pointer transition-all duration-200"
                      onClick={() => handleToggleCategory(validItems[0].category)}
                    />
                  )}

                  {/* Multiple Slices with Glitch-Free Hover and Isolation */}
                  {validItems.length > 1 &&
                    slices.map((slice) => {
                      if (slice.angleSpan <= 0) return null;
                      const isTarget = effectiveCategory === slice.category;
                      const isMuted = effectiveCategory !== null && !isTarget;

                      const path = createDonutSlicePath(slice.startAngle, slice.endAngle);
                      if (!path) return null;

                      return (
                        <path
                          key={slice.category}
                          d={path}
                          fill={slice.color}
                          className="cursor-pointer"
                          style={{
                            opacity: isMuted ? 0.25 : 1,
                            stroke: isTarget ? '#FFFFFF' : 'none',
                            strokeWidth: isTarget ? 3 : 0,
                            strokeLinejoin: 'round',
                            transition: 'opacity 0.15s ease',
                          }}
                          onMouseEnter={() => setHoveredCategory(slice.category)}
                          onClick={() => handleToggleCategory(slice.category)}
                        />
                      );
                    })}
                </svg>

                {/* Donut Center Display: Clean, Uncluttered Informative Data Inside the Circle */}
                <div
                  className="absolute inset-0 rounded-full flex flex-col items-center justify-center text-center p-3 pointer-events-none select-none bg-white/92 dark:bg-[#0c1822]/95 backdrop-blur-md border border-neutral-200/90 dark:border-neutral-700/80 shadow-md transition-all duration-200"
                  style={{
                    width: `${innerRadius * 2 - 4}px`,
                    height: `${innerRadius * 2 - 4}px`,
                    margin: 'auto',
                    borderColor: focusedItem ? focusedItem.color : undefined,
                    boxShadow: focusedItem
                      ? `0 10px 28px -6px ${focusedItem.color}35`
                      : undefined,
                  }}
                >
                  {focusedItem ? (
                    <>
                      {/* 1. Category Tag */}
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs truncate max-w-[125px]"
                        style={{ backgroundColor: focusedItem.color }}
                      >
                        {focusedItem.name}
                      </span>

                      {/* 2. Primary Distance in KM */}
                      <div className="flex items-baseline justify-center mt-1">
                        <span className="text-3xl sm:text-4xl font-black text-neutral-900 dark:text-white tabular-nums tracking-tight">
                          {focusedItem.totalDistanceKm.toFixed(1)}
                        </span>
                        <span
                          className="text-xs font-black ml-1 uppercase"
                          style={{ color: focusedItem.color }}
                        >
                          km
                        </span>
                      </div>

                      {/* 3. Volume Share */}
                      <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200 tabular-nums mt-0.5">
                        {focusedItem.percentageDistance}% volume
                      </div>

                      {/* 4. Workout Count and Pace */}
                      <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 tabular-nums mt-0.5">
                        {focusedItem.runCount} {focusedItem.runCount === 1 ? 'run' : 'runs'}
                        {focusedItem.avgPaceSecPerKm > 0 ? ` · ${formatPace(focusedItem.avgPaceSecPerKm, unit)}` : ''}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Default: 30-Day Total Informative Summary */}
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#0593C6]/15 text-[#0593C6] dark:text-[#38bdf8]">
                        {timeWindow === '30d' ? '30-Day Total' : 'All-Time Total'}
                      </span>

                      {/* Total Distance in KM */}
                      <div className="flex items-baseline justify-center mt-1">
                        <span className="text-3xl sm:text-4xl font-black text-neutral-900 dark:text-white tabular-nums tracking-tight">
                          {breakdown.totalDistanceKm.toFixed(1)}
                        </span>
                        <span className="text-xs font-black ml-1 uppercase text-[#0593C6] dark:text-[#38bdf8]">
                          km
                        </span>
                      </div>

                      {/* Total Workouts */}
                      <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200 tabular-nums mt-0.5">
                        {breakdown.totalRuns} {breakdown.totalRuns === 1 ? 'workout' : 'workouts'} logged
                      </div>

                      {/* Average Pace */}
                      {breakdown.avgPaceSecPerKm > 0 && (
                        <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 tabular-nums mt-0.5">
                          Avg Pace: {formatPace(breakdown.avgPaceSecPerKm, unit)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Category Cards with Smooth Responsive Hover Synchronization */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {breakdown.items.map((item) => {
                const isSelected = activeCategory === item.category;
                const isTarget = effectiveCategory === item.category;
                const isMuted = effectiveCategory !== null && !isTarget;
                const hasRuns = item.runCount > 0;

                return (
                  <div
                    key={item.category}
                    onMouseEnter={() => setHoveredCategory(item.category)}
                    onMouseLeave={() => setHoveredCategory((prev) => (prev === item.category ? null : prev))}
                    onClick={() => hasRuns && handleToggleCategory(item.category)}
                    className={`p-3.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                      isTarget
                        ? 'scale-[1.02] shadow-md border-2 bg-white dark:bg-[#12222f]'
                        : isMuted
                        ? 'opacity-40 border-neutral-200 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/40'
                        : 'border-neutral-200 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/60 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/70'
                    }`}
                    style={{
                      borderColor: isTarget ? item.color : undefined,
                      boxShadow: isTarget
                        ? `0 0 0 1px ${item.color}40, 0 10px 24px -6px ${item.color}25`
                        : undefined,
                    }}
                  >
                    {/* Category Header */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span
                          className={`w-3 h-3 rounded-full shrink-0 shadow-xs transition-transform ${
                            isTarget ? 'scale-125' : ''
                          }`}
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                          {item.name}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        {isSelected && (
                          <span
                            className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: item.color }}
                          >
                            Locked
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 tabular-nums">
                          {item.percentageDistance}% vol
                        </span>
                      </div>
                    </div>

                    {/* Subtitle / Focus */}
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2.5 line-clamp-1">
                      {item.description}
                    </p>

                    {/* Metrics Row: Displays km distinctly */}
                    <div className="grid grid-cols-3 gap-1 pt-2 border-t border-neutral-200/70 dark:border-neutral-800 text-[11px] tabular-nums">
                      <div>
                        <span className="block text-[10px] text-neutral-400 uppercase">Runs</span>
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {item.runCount}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-neutral-400 uppercase">Distance</span>
                        <span className="font-bold text-neutral-900 dark:text-white">
                          {item.totalDistanceKm.toFixed(1)} km
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-neutral-400 uppercase">Avg Pace</span>
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {item.avgPaceSecPerKm > 0 ? formatPace(item.avgPaceSecPerKm, unit) : '--:--'}
                        </span>
                      </div>
                    </div>

                    {/* Share Progress Bar */}
                    <div className="w-full h-1.5 bg-neutral-200/80 dark:bg-neutral-800 rounded-full mt-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${item.percentageDistance}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

