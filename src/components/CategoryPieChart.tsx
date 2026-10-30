import React, { useState } from 'react';
import { RunRecord } from '../types/running';
import {
  TrainingCategory,
  calculateCategoryBreakdown,
  formatDuration,
  formatPace,
  KM_TO_MILES,
} from '../utils/runningCalculations';
import { PieChart, Clock, Calendar, ArrowRight, RotateCcw, Activity } from 'lucide-react';

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
  const [activeCategory, setActiveCategory] = useState<TrainingCategory | null>(null);

  // Compute 30-day breakdown (or all-time if toggled)
  const windowDays = timeWindow === '30d' ? 30 : 9999;
  const breakdown = calculateCategoryBreakdown(runs, windowDays);
  const totalVolume = metricMode === 'distance' ? breakdown.totalDistanceKm : breakdown.totalRuns;

  // Convert distance to unit preference
  const formatDist = (km: number) => {
    if (unit === 'miles') {
      return `${(km * KM_TO_MILES).toFixed(1)} mi`;
    }
    return `${km.toFixed(1)} km`;
  };

  // SVG Donut Math
  const size = 260;
  const center = size / 2;
  const outerRadius = 100;
  const innerRadius = 65;
  const activeOuterRadius = 108;

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

  // Generate SVG path for a donut segment
  const createDonutSlicePath = (
    startAngle: number,
    endAngle: number,
    isHovered: boolean
  ) => {
    // If a single item accounts for 100% of the volume
    if (endAngle - startAngle >= 359.9) {
      return null;
    }

    // Small angular gap for visual separation if more than 1 slice exists
    const gap = validItems.length > 1 ? 1.5 : 0;
    const adjStart = startAngle + gap;
    const adjEnd = endAngle - gap;

    if (adjEnd <= adjStart) return '';

    const currentOuterR = isHovered ? activeOuterRadius : outerRadius;
    const p1 = polarToCartesian(center, center, currentOuterR, adjStart);
    const p2 = polarToCartesian(center, center, currentOuterR, adjEnd);
    const p3 = polarToCartesian(center, center, innerRadius, adjEnd);
    const p4 = polarToCartesian(center, center, innerRadius, adjStart);

    const largeArc = adjEnd - adjStart > 180 ? 1 : 0;

    return `M ${p1.x} ${p1.y} A ${currentOuterR} ${currentOuterR} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;
  };

  const selectedItem = activeCategory
    ? breakdown.items.find((i) => i.category === activeCategory)
    : null;

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
            Breakdown across Easy, Interval, Tempo, and Race efforts to monitor 80/20 polarized balance
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
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0a84ff] text-white cursor-pointer hover:bg-[#0071e3]"
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Interactive SVG Donut Viewport (Desktop: 5 cols, Mobile: full width centered) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-2 sm:p-4">
            <div className="relative w-[240px] h-[240px] sm:w-[260px] sm:h-[260px] flex items-center justify-center">
              <svg
                viewBox={`0 0 ${size} ${size}`}
                className="w-full h-full transform -rotate-0 drop-shadow-xs"
              >
                {/* Background Ring */}
                <circle
                  cx={center}
                  cy={center}
                  r={(outerRadius + innerRadius) / 2}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={outerRadius - innerRadius}
                  className="text-neutral-100 dark:text-neutral-800/60"
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
                    onClick={() =>
                      setActiveCategory(
                        activeCategory === validItems[0].category ? null : validItems[0].category
                      )
                    }
                  />
                )}

                {/* Multiple Slices */}
                {validItems.length > 1 &&
                  slices.map((slice) => {
                    if (slice.angleSpan <= 0) return null;
                    const isHovered = activeCategory === slice.category;
                    const path = createDonutSlicePath(
                      slice.startAngle,
                      slice.endAngle,
                      isHovered
                    );
                    if (!path) return null;

                    return (
                      <path
                        key={slice.category}
                        d={path}
                        fill={slice.color}
                        className="cursor-pointer transition-all duration-200 hover:opacity-90"
                        onMouseEnter={() => setActiveCategory(slice.category)}
                        onMouseLeave={() => setActiveCategory(null)}
                        onClick={() =>
                          setActiveCategory(activeCategory === slice.category ? null : slice.category)
                        }
                      />
                    );
                  })}
              </svg>

              {/* Donut Center Display */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none select-none"
                style={{ width: `${innerRadius * 2}px`, height: `${innerRadius * 2}px`, margin: 'auto' }}
              >
                {selectedItem ? (
                  <>
                    <span
                      className="text-[11px] font-bold uppercase tracking-wider truncate max-w-[110px]"
                      style={{ color: selectedItem.color }}
                    >
                      {selectedItem.category}
                    </span>
                    <span className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white tabular-nums tracking-tight mt-0.5">
                      {metricMode === 'distance'
                        ? formatDist(selectedItem.totalDistanceKm)
                        : `${selectedItem.runCount} runs`}
                    </span>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                      {metricMode === 'distance'
                        ? `${selectedItem.percentageDistance}% volume`
                        : `${selectedItem.percentageCount}% of runs`}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                      {timeWindow === '30d' ? '30-Day Total' : 'All-Time Total'}
                    </span>
                    <span className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white tabular-nums tracking-tight mt-0.5">
                      {metricMode === 'distance'
                        ? formatDist(breakdown.totalDistanceKm)
                        : `${breakdown.totalRuns} runs`}
                    </span>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                      {breakdown.totalRuns} {breakdown.totalRuns === 1 ? 'session' : 'sessions'}
                    </span>
                  </>
                )}
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2 text-center">
              Tap or hover any slice to isolate workout volume
            </p>
          </div>

          {/* Category Cards (Desktop: 7 cols, Mobile: full width stack) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {breakdown.items.map((item) => {
              const isSelected = activeCategory === item.category;
              const hasRuns = item.runCount > 0;

              return (
                <div
                  key={item.category}
                  onMouseEnter={() => hasRuns && setActiveCategory(item.category)}
                  onMouseLeave={() => setActiveCategory(null)}
                  onClick={() => hasRuns && setActiveCategory(isSelected ? null : item.category)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-neutral-400 dark:border-neutral-600 bg-neutral-100/80 dark:bg-neutral-800/90 shadow-xs ring-1 ring-neutral-400/30'
                      : 'border-neutral-200 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/60 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50'
                  }`}
                >
                  {/* Category Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                        {item.category}
                      </span>
                    </div>

                    <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 tabular-nums shrink-0">
                      {item.percentageDistance}% vol
                    </span>
                  </div>

                  {/* Subtitle / Focus */}
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-3 line-clamp-1">
                    {item.description}
                  </p>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-1 pt-2 border-t border-neutral-200/70 dark:border-neutral-800 text-[11px] tabular-nums">
                    <div>
                      <span className="block text-[10px] text-neutral-400 uppercase">Runs</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {item.runCount}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-neutral-400 uppercase">Dist</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {formatDist(item.totalDistanceKm)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-neutral-400 uppercase">Pace</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {item.avgPaceSecPerKm > 0 ? formatPace(item.avgPaceSecPerKm, unit) : '--:--'}
                      </span>
                    </div>
                  </div>

                  {/* Share Progress Bar */}
                  <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full mt-2.5 overflow-hidden">
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
      )}
    </div>
  );
};
