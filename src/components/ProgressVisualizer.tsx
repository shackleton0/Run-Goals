import React, { useState } from 'react';
import { RunRecord, WeeklyStat } from '../types/running';
import {
  formatDuration,
  formatPace,
  calculateTargetDistanceEquivalent,
  isAerobicRun,
  isIntervalRun,
  KM_TO_MILES,
} from '../utils/runningCalculations';
import { CategoryPieChart } from './CategoryPieChart';
import {
  PieChart,
  TrendingUp,
  BarChart2,
  Zap,
  Activity,
  PlusCircle,
  UploadCloud,
  ChevronDown,
} from 'lucide-react';

interface ProgressVisualizerProps {
  runs: RunRecord[];
  weeklyStats: WeeklyStat[];
  target6kSec?: number;
  targetDistanceKm?: number;
  targetGoalName?: string;
  unit: 'km' | 'miles';
  maxHeartRate?: number;
  onOpenGarminSync?: () => void;
  onOpenAddRun?: () => void;
}

type ViewMode =
  | 'categories_30d'
  | '6k_progression'
  | 'aerobic_runs'
  | 'interval_training'
  | 'weekly_volume';

export const ProgressVisualizer: React.FC<ProgressVisualizerProps> = ({
  runs,
  weeklyStats,
  target6kSec,
  targetDistanceKm = 6.0,
  targetGoalName,
  unit,
  maxHeartRate,
  onOpenGarminSync,
  onOpenAddRun,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // Set 30-Day Category Breakdown as the default view
  const [activeTab, setActiveTab] = useState<ViewMode>('categories_30d');
  const [hoveredRun, setHoveredRun] = useState<RunRecord | null>(null);
  const [pinnedRun, setPinnedRun] = useState<RunRecord | null>(null);
  const [hoveredWeek, setHoveredWeek] = useState<WeeklyStat | null>(null);
  const [pinnedWeek, setPinnedWeek] = useState<WeeklyStat | null>(null);
  const targetDistKm = targetDistanceKm || 6.0;
  const targetLabel = targetGoalName || `${targetDistKm}K`;

  const activeRun = hoveredRun || pinnedRun;
  const activeWeek = hoveredWeek || pinnedWeek;

  // Filter categories
  const quality6kRuns = [...runs]
    .filter((r) => r.runType === '6K Time Trial' || r.runType === 'Time Trial' || r.runType === 'Race' || r.runType === 'Tempo')
    .map((r) => ({
      ...r,
      calc6k:
        calculateTargetDistanceEquivalent(r.distanceKm, r.durationSeconds, targetDistKm) ||
        r.targetEquivalentSeconds ||
        r.best6kTimeSeconds ||
        0,
    }))
    .filter((r) => r.calc6k > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const aerobicRuns = [...runs]
    .filter((r) => isAerobicRun(r.runType))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const intervalRuns = [...runs]
    .filter((r) => isIntervalRun(r.runType))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Chart Dimensions
  const width = 800;
  const height = 290;
  const padding = { top: 34, right: 28, bottom: 42, left: 64 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 6K Progression Chart Math
  const all6kTimes = quality6kRuns.map((r) => r.calc6k);
  const baselineReference = target6kSec || (all6kTimes.length > 0 ? all6kTimes[0] : 1260);
  const min6k =
    quality6kRuns.length > 0
      ? Math.min(...all6kTimes, ...(target6kSec ? [target6kSec] : []))
      : baselineReference - 60;
  const max6k =
    quality6kRuns.length > 0
      ? Math.max(...all6kTimes, ...(target6kSec ? [target6kSec + 60] : []))
      : baselineReference + 120;

  const yDomainMin = Math.floor((min6k - 30) / 30) * 30;
  const yDomainMax = Math.ceil((max6k + 30) / 30) * 30;

  const get6kY = (timeSec: number) => {
    const ratio = (timeSec - yDomainMin) / (yDomainMax - yDomainMin || 1);
    return padding.top + ratio * chartHeight;
  };

  const getX = (index: number, total: number) => {
    if (total <= 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (total - 1)) * chartWidth;
  };

  const points6k = quality6kRuns.map((r, i) => ({
    x: getX(i, quality6kRuns.length),
    y: get6kY(r.calc6k),
    valueLabel: `${targetLabel}: ${formatDuration(r.calc6k)}`,
    subLabel: `${r.date} · ${unit === 'miles' ? `${(r.distanceKm * KM_TO_MILES).toFixed(2)} mi` : `${r.distanceKm} km`} (${formatPace(r.averagePaceSecPerKm, unit)})`,
    run: r,
  }));

  const linePath6k =
    points6k.length > 0
      ? points6k.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
      : '';

  const targetY = target6kSec && target6kSec > 0 ? get6kY(target6kSec) : null;

  // Aerobic Pace Chart Math
  const aerobicPaces = aerobicRuns.map((r) => r.averagePaceSecPerKm);
  const minAerobicPace = aerobicPaces.length > 0 ? Math.min(...aerobicPaces) : 240;
  const maxAerobicPace = aerobicPaces.length > 0 ? Math.max(...aerobicPaces) : 360;
  const yAerobicMin = Math.floor((minAerobicPace - 15) / 15) * 15;
  const yAerobicMax = Math.ceil((maxAerobicPace + 15) / 15) * 15;

  const getAerobicY = (paceSec: number) => {
    const ratio = (paceSec - yAerobicMin) / (yAerobicMax - yAerobicMin || 1);
    return padding.top + ratio * chartHeight;
  };

  const pointsAerobic = aerobicRuns.map((r, i) => ({
    x: getX(i, aerobicRuns.length),
    y: getAerobicY(r.averagePaceSecPerKm),
    valueLabel: `Pace: ${formatPace(r.averagePaceSecPerKm, unit)}`,
    subLabel: `${r.date} · ${unit === 'miles' ? `${(r.distanceKm * KM_TO_MILES).toFixed(2)} mi` : `${r.distanceKm} km`} · ${formatDuration(r.durationSeconds)}`,
    run: r,
  }));

  const linePathAerobic =
    pointsAerobic.length > 0
      ? pointsAerobic.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
      : '';

  // Interval Chart Math (prefer calibrated active interval pace when present)
  const intervalPaces = intervalRuns.map((r) => r.activeIntervalPaceSecPerKm || r.averagePaceSecPerKm);
  const minIntervalPace = intervalPaces.length > 0 ? Math.min(...intervalPaces) : 200;
  const maxIntervalPace = intervalPaces.length > 0 ? Math.max(...intervalPaces) : 300;
  const yIntervalMin = Math.floor((minIntervalPace - 15) / 15) * 15;
  const yIntervalMax = Math.ceil((maxIntervalPace + 15) / 15) * 15;

  const getIntervalY = (paceSec: number) => {
    const ratio = (paceSec - yIntervalMin) / (yIntervalMax - yIntervalMin || 1);
    return padding.top + ratio * chartHeight;
  };

  const pointsInterval = intervalRuns.map((r, i) => {
    const paceToPlot = r.activeIntervalPaceSecPerKm || r.averagePaceSecPerKm;
    return {
      x: getX(i, intervalRuns.length),
      y: getIntervalY(paceToPlot),
      valueLabel: `${r.activeIntervalPaceSecPerKm ? 'Active' : 'Pace'}: ${formatPace(paceToPlot, unit)}`,
      subLabel: `${r.date} · ${unit === 'miles' ? `${(r.distanceKm * KM_TO_MILES).toFixed(2)} mi` : `${r.distanceKm} km`} · ${r.title}`,
      run: r,
    };
  });

  const linePathInterval =
    pointsInterval.length > 0
      ? pointsInterval.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
      : '';

  // Weekly Volume
  const chronologicalWeeks = [...weeklyStats].reverse();
  const maxDistance = Math.max(...chronologicalWeeks.map((w) => w.totalDistanceKm), 25);

  const resetPointSelection = () => {
    setHoveredRun(null);
    setPinnedRun(null);
    setHoveredWeek(null);
    setPinnedWeek(null);
  };

  const renderYAxisTicks = (
    domainMin: number,
    domainMax: number,
    formatter: (val: number) => string
  ) => {
    return [0, 0.33, 0.67, 1].map((pct, idx) => {
      const val = Math.round(domainMin + pct * (domainMax - domainMin));
      const y = padding.top + pct * chartHeight;
      return (
        <g key={`ytick-${idx}`}>
          <line
            x1={padding.left}
            y1={y}
            x2={width - padding.right}
            y2={y}
            stroke="currentColor"
            className="text-slate-300/60 dark:text-slate-700/60"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <text
            x={padding.left - 8}
            y={y + 3.5}
            fill="currentColor"
            className="text-slate-500 dark:text-slate-400 font-mono text-[10px]"
            textAnchor="end"
          >
            {formatter(val)}
          </text>
        </g>
      );
    });
  };

  const renderSvgTooltip = (
    pt: { x: number; y: number; valueLabel: string; subLabel: string; run: RunRecord } | undefined,
    accentHex: string
  ) => {
    if (!pt) return null;
    const boxW = Math.max(195, pt.subLabel.length * 6.2 + 22);
    const boxH = 44;
    const clampedX = Math.max(
      padding.left + 4,
      Math.min(width - padding.right - boxW - 4, pt.x - boxW / 2)
    );
    const showBelow = pt.y - boxH - 14 < 6;
    const boxY = showBelow ? pt.y + 14 : pt.y - boxH - 14;

    return (
      <g className="pointer-events-none">
        <rect
          x={clampedX}
          y={boxY}
          width={boxW}
          height={boxH}
          rx={8}
          fill="#0F172A"
          stroke={accentHex}
          strokeWidth="1.25"
          opacity="0.96"
        />
        <text
          x={clampedX + 10}
          y={boxY + 17}
          fill="#FFFFFF"
          fontSize="12"
          fontWeight="700"
          className="font-sans"
        >
          {pt.valueLabel}
        </text>
        <text
          x={clampedX + 10}
          y={boxY + 33}
          fill="#94A3B8"
          fontSize="10"
          className="font-mono"
        >
          {pt.subLabel}
        </text>
      </g>
    );
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#0F1C28] border border-slate-200/95 dark:border-slate-700/75 shadow-sm transition-colors">
      {/* Full-bleed sensitive Dropdown Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full px-4 py-4 sm:px-5 sm:py-4.5 flex items-center justify-between text-left cursor-pointer group accordion-trigger select-none hover:bg-slate-50/90 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800/70"
        data-no-scale
        aria-expanded={isExpanded}
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-teal-500 flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105">
            <TrendingUp className="w-4.5 h-4.5 stroke-[2.3]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">
                Performance Analytics
              </h2>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                · {runs.length} Workouts
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0 ml-2">
          <div
            className={`p-2 rounded-lg border chevron-badge transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isExpanded
                ? 'rotate-180 text-slate-900 dark:text-white bg-slate-200/80 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                : 'bg-slate-100 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* Expanded Content Dropdown with snappy CSS grid interpolation */}
      <div
        className={`accordion-collapse-wrapper ${isExpanded ? 'is-expanded' : ''}`}
        aria-hidden={!isExpanded}
      >
        <div className="accordion-collapse-inner">
          <div className="px-4 pb-5 pt-4 sm:px-5 border-t border-slate-100 dark:border-slate-800 space-y-5">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              30-day training distribution, race progression curves, aerobic base speed, and weekly volume breakdown
            </p>

          {/* Mobile-Friendly Horizontally Scrollable Segmented Tab Control */}
          <div className="w-full overflow-x-auto no-scrollbar scroll-smooth -mx-1 px-1">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900/90 border border-neutral-200/80 dark:border-neutral-800 min-w-full sm:min-w-0">
            <button
              onClick={() => {
                setActiveTab('categories_30d');
                resetPointSelection();
              }}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] transition-all cursor-pointer ${
                activeTab === 'categories_30d'
                  ? 'bg-[#0593C6] text-[#FCFFFF] shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-[#FCFFFF]'
              }`}
            >
              <PieChart className={`w-3.5 h-3.5 ${activeTab === 'categories_30d' ? 'text-[#FCFFFF]' : 'text-[#0593C6]'}`} />
              <span>30-Day Breakdown</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('6k_progression');
                resetPointSelection();
              }}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] transition-all cursor-pointer ${
                activeTab === '6k_progression'
                  ? 'bg-[#0593C6] text-[#FCFFFF] shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-[#FCFFFF]'
              }`}
            >
              <TrendingUp className={`w-3.5 h-3.5 ${activeTab === '6k_progression' ? 'text-[#FCFFFF]' : 'text-[#0593C6]'}`} />
              <span>Goal Race Curve</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('aerobic_runs');
                resetPointSelection();
              }}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] transition-all cursor-pointer ${
                activeTab === 'aerobic_runs'
                  ? 'bg-[#0593C6] text-[#FCFFFF] shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-[#FCFFFF]'
              }`}
            >
              <Activity className={`w-3.5 h-3.5 ${activeTab === 'aerobic_runs' ? 'text-[#FCFFFF]' : 'text-[#0593C6]'}`} />
              <span>Aerobic Base ({aerobicRuns.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('interval_training');
                resetPointSelection();
              }}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] transition-all cursor-pointer ${
                activeTab === 'interval_training'
                  ? 'bg-[#0593C6] text-[#FCFFFF] shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-[#FCFFFF]'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${activeTab === 'interval_training' ? 'text-[#FCFFFF]' : 'text-[#10B981]'}`} />
              <span>Intervals ({intervalRuns.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('weekly_volume');
                resetPointSelection();
              }}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] transition-all cursor-pointer ${
                activeTab === 'weekly_volume'
                  ? 'bg-[#0593C6] text-[#FCFFFF] shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-[#FCFFFF]'
              }`}
            >
              <BarChart2 className={`w-3.5 h-3.5 ${activeTab === 'weekly_volume' ? 'text-[#FCFFFF]' : 'text-[#0593C6]'}`} />
              <span>Weekly Volume</span>
            </button>
          </div>
        </div>

      {/* Tab 1: 30-Day Category Breakdown Pie Chart */}
      {activeTab === 'categories_30d' && (
        <CategoryPieChart
          runs={runs}
          unit={unit}
          onOpenGarminSync={onOpenGarminSync}
          onOpenAddRun={onOpenAddRun}
        />
      )}

      {/* Tab 2: Goal Race Progression Curve */}
      {activeTab === '6k_progression' && (
        <div>
          {quality6kRuns.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
              <TrendingUp className="w-8 h-8 text-[#0593C6] mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                No Time Trials or Races Recorded
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1 mb-4">
                Import your watch workout files or log your first time trial to chart your official race pace progression.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {onOpenGarminSync && (
                  <button
                    onClick={onOpenGarminSync}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0593C6] hover:bg-[#047da8] text-[#FCFFFF] cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Sync Watch Data</span>
                  </button>
                )}
                {onOpenAddRun && (
                  <button
                    onClick={onOpenAddRun}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-black cursor-pointer hover:opacity-90"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Log Time Trial</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-3 px-1 gap-1">
                <div className="flex items-center space-x-4">
                  {target6kSec && (
                    <span className="flex items-center space-x-1.5">
                      <span className="w-3 h-0.5 bg-[#10B981] inline-block border-t border-[#10B981] border-dashed" />
                      <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                        Goal: {formatDuration(target6kSec)}
                      </span>
                    </span>
                  )}
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0593C6] inline-block" />
                    <span>Quality Trials &amp; Races</span>
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400">
                  Hover or click any point to inspect its exact value
                </div>
              </div>

              {/* Chart Canvas with Smooth Touch Scrolling */}
              <div
                className="w-full overflow-x-auto touch-pan-x rounded-lg border border-neutral-100 dark:border-neutral-800/80 p-1 sm:p-2 bg-neutral-50/40 dark:bg-neutral-900/30"
                onMouseLeave={() => setHoveredRun(null)}
              >
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-auto min-w-[560px] sm:min-w-full select-none overflow-visible"
                >
                  {renderYAxisTicks(yDomainMin, yDomainMax, (v) => formatDuration(v))}

                  {/* Goal Line */}
                  {targetY !== null && target6kSec && (
                    <>
                      <line
                        x1={padding.left}
                        y1={targetY}
                        x2={width - padding.right}
                        y2={targetY}
                        stroke="#10B981"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                      />
                      <text
                        x={width - padding.right}
                        y={targetY - 5}
                        fill="#10B981"
                        fontSize="11"
                        fontWeight="600"
                        textAnchor="end"
                      >
                        Target: {formatDuration(target6kSec)}
                      </text>
                    </>
                  )}

                  {/* Line */}
                  {linePath6k && (
                    <path
                      d={linePath6k}
                      fill="none"
                      stroke="#0593C6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Active Crosshair */}
                  {(() => {
                    const activePt = points6k.find((p) => p.run.id === activeRun?.id);
                    if (!activePt) return null;
                    return (
                      <line
                        x1={activePt.x}
                        y1={padding.top}
                        x2={activePt.x}
                        y2={padding.top + chartHeight}
                        stroke="#0593C6"
                        strokeWidth="1.25"
                        strokeDasharray="3 3"
                        opacity="0.7"
                      />
                    );
                  })()}

                  {/* Points */}
                  {points6k.map((pt, i) => {
                    const isActive = activeRun?.id === pt.run.id;
                    return (
                      <g
                        key={pt.run.id || i}
                        className="cursor-pointer"
                        onClick={() =>
                          setPinnedRun((prev) => (prev?.id === pt.run.id ? null : pt.run))
                        }
                        onMouseEnter={() => setHoveredRun(pt.run)}
                      >
                        {/* Wide invisible hit target */}
                        <circle cx={pt.x} cy={pt.y} r={20} fill="transparent" />
                        {isActive && (
                          <circle cx={pt.x} cy={pt.y} r={11} fill="#0593C6" opacity="0.2" />
                        )}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isActive ? 7 : 5}
                          fill="#0593C6"
                          stroke="currentColor"
                          className="text-[#FCFFFF] dark:text-[#12222f] transition-all"
                          strokeWidth="2"
                        />
                        <text
                          x={pt.x}
                          y={height - padding.bottom + 18}
                          fill="currentColor"
                          className={`font-mono text-[10px] ${
                            isActive
                              ? 'text-[#0593C6] font-bold'
                              : 'text-neutral-400 dark:text-neutral-500'
                          }`}
                          textAnchor="middle"
                        >
                          {pt.run.date.slice(5)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Floating Tooltip */}
                  {renderSvgTooltip(
                    points6k.find((p) => p.run.id === activeRun?.id),
                    '#0593C6'
                  )}
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Aerobic Runs */}
      {activeTab === 'aerobic_runs' && (
        <div>
          {aerobicRuns.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
              <Activity className="w-8 h-8 text-[#0593C6] mx-auto mb-2 opacity-60" />
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                No Aerobic Runs Categorized
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1 mb-4">
                Categorize any workout as 'Aerobic' or 'Easy' in your training history to track your aerobic base pace progression.
              </p>
              {onOpenAddRun && (
                <button
                  onClick={onOpenAddRun}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-black cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Log Aerobic Run</span>
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-3 px-1">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  Aerobic Base Pace Trend
                </span>
                <span className="text-[11px] text-neutral-400 tabular-nums">
                  {aerobicRuns.length} aerobic sessions · Hover or click point for exact pace
                </span>
              </div>

              <div
                className="w-full overflow-x-auto touch-pan-x rounded-lg border border-neutral-100 dark:border-neutral-800/80 p-1 sm:p-2 bg-neutral-50/40 dark:bg-neutral-900/30"
                onMouseLeave={() => setHoveredRun(null)}
              >
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-auto min-w-[560px] sm:min-w-full select-none overflow-visible"
                >
                  {renderYAxisTicks(yAerobicMin, yAerobicMax, (v) => formatPace(v, unit))}

                  {linePathAerobic && (
                    <path
                      d={linePathAerobic}
                      fill="none"
                      stroke="#0593C6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {(() => {
                    const activePt = pointsAerobic.find((p) => p.run.id === activeRun?.id);
                    if (!activePt) return null;
                    return (
                      <line
                        x1={activePt.x}
                        y1={padding.top}
                        x2={activePt.x}
                        y2={padding.top + chartHeight}
                        stroke="#0593C6"
                        strokeWidth="1.25"
                        strokeDasharray="3 3"
                        opacity="0.7"
                      />
                    );
                  })()}

                  {pointsAerobic.map((pt, i) => {
                    const isActive = activeRun?.id === pt.run.id;
                    return (
                      <g
                        key={pt.run.id || i}
                        className="cursor-pointer"
                        onClick={() =>
                          setPinnedRun((prev) => (prev?.id === pt.run.id ? null : pt.run))
                        }
                        onMouseEnter={() => setHoveredRun(pt.run)}
                      >
                        <circle cx={pt.x} cy={pt.y} r={20} fill="transparent" />
                        {isActive && (
                          <circle cx={pt.x} cy={pt.y} r={11} fill="#0593C6" opacity="0.2" />
                        )}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isActive ? 7 : 5}
                          fill="#0593C6"
                          stroke="currentColor"
                          className="text-[#FCFFFF] dark:text-[#12222f] transition-all"
                          strokeWidth="2"
                        />
                        <text
                          x={pt.x}
                          y={height - padding.bottom + 18}
                          fill="currentColor"
                          className={`font-mono text-[10px] ${
                            isActive
                              ? 'text-[#0593C6] font-bold'
                              : 'text-neutral-400 dark:text-neutral-500'
                          }`}
                          textAnchor="middle"
                        >
                          {pt.run.date.slice(5)}
                        </text>
                      </g>
                    );
                  })}

                  {renderSvgTooltip(
                    pointsAerobic.find((p) => p.run.id === activeRun?.id),
                    '#0593C6'
                  )}
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Interval Training */}
      {activeTab === 'interval_training' && (
        <div>
          {intervalRuns.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
              <Zap className="w-8 h-8 text-[#10B981] mx-auto mb-2 opacity-60" />
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                No Interval Sessions Logged
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1 mb-4">
                Track repeats (e.g. 5x1000m, 400m intervals) build high-turnover race velocity. Set 'Interval' on any workout to see speed development.
              </p>
              {onOpenAddRun && (
                <button
                  onClick={onOpenAddRun}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-black cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Log Interval Session</span>
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-3 px-1">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  Interval Velocity Trend
                </span>
                <span className="text-[11px] text-neutral-400 tabular-nums">
                  {intervalRuns.length} interval sessions · Hover or click point for exact pace
                </span>
              </div>

              <div
                className="w-full overflow-x-auto touch-pan-x rounded-lg border border-neutral-100 dark:border-neutral-800/80 p-1 sm:p-2 bg-neutral-50/40 dark:bg-neutral-900/30"
                onMouseLeave={() => setHoveredRun(null)}
              >
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-auto min-w-[560px] sm:min-w-full select-none overflow-visible"
                >
                  {renderYAxisTicks(yIntervalMin, yIntervalMax, (v) => formatPace(v, unit))}

                  {linePathInterval && (
                    <path
                      d={linePathInterval}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {(() => {
                    const activePt = pointsInterval.find((p) => p.run.id === activeRun?.id);
                    if (!activePt) return null;
                    return (
                      <line
                        x1={activePt.x}
                        y1={padding.top}
                        x2={activePt.x}
                        y2={padding.top + chartHeight}
                        stroke="#10B981"
                        strokeWidth="1.25"
                        strokeDasharray="3 3"
                        opacity="0.7"
                      />
                    );
                  })()}

                  {pointsInterval.map((pt, i) => {
                    const isActive = activeRun?.id === pt.run.id;
                    return (
                      <g
                        key={pt.run.id || i}
                        className="cursor-pointer"
                        onClick={() =>
                          setPinnedRun((prev) => (prev?.id === pt.run.id ? null : pt.run))
                        }
                        onMouseEnter={() => setHoveredRun(pt.run)}
                      >
                        <circle cx={pt.x} cy={pt.y} r={20} fill="transparent" />
                        {isActive && (
                          <circle cx={pt.x} cy={pt.y} r={11} fill="#10B981" opacity="0.2" />
                        )}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isActive ? 7 : 5}
                          fill="#10B981"
                          stroke="currentColor"
                          className="text-[#FCFFFF] dark:text-[#12222f] transition-all"
                          strokeWidth="2"
                        />
                        <text
                          x={pt.x}
                          y={height - padding.bottom + 18}
                          fill="currentColor"
                          className={`font-mono text-[10px] ${
                            isActive
                              ? 'text-[#10B981] font-bold'
                              : 'text-neutral-400 dark:text-neutral-500'
                          }`}
                          textAnchor="middle"
                        >
                          {pt.run.date.slice(5)}
                        </text>
                      </g>
                    );
                  })}

                  {renderSvgTooltip(
                    pointsInterval.find((p) => p.run.id === activeRun?.id),
                    '#10B981'
                  )}
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Weekly Volume */}
      {activeTab === 'weekly_volume' && (
        <div>
          {chronologicalWeeks.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              No weekly volume recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3"
                onMouseLeave={() => setHoveredWeek(null)}
              >
                {chronologicalWeeks.slice(-6).map((week) => {
                  const heightPct = Math.min(
                    100,
                    Math.round((week.totalDistanceKm / maxDistance) * 100)
                  );
                  const displayDist =
                    unit === 'miles'
                      ? `${(week.totalDistanceKm * KM_TO_MILES).toFixed(1)} mi`
                      : `${week.totalDistanceKm.toFixed(1)} km`;
                  const isActive = activeWeek?.weekKey === week.weekKey;

                  return (
                    <button
                      type="button"
                      key={week.weekKey}
                      onMouseEnter={() => setHoveredWeek(week)}
                      onClick={() =>
                        setPinnedWeek((prev) => (prev?.weekKey === week.weekKey ? null : week))
                      }
                      className={`p-3 rounded-xl border flex flex-col items-center cursor-pointer transition-all text-center ${
                        isActive
                          ? 'bg-sky-50/70 dark:bg-sky-950/30 border-[#0593C6] shadow-sm scale-[1.02]'
                          : 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                        {week.weekStart}
                      </span>

                      <div className="w-8 h-24 sm:h-28 bg-neutral-200 dark:bg-neutral-800 rounded-md relative flex items-end justify-center p-0.5 overflow-hidden">
                        <div
                          className={`w-full rounded-xs transition-all duration-300 ${
                            isActive
                              ? 'bg-[#0EA5E9]'
                              : week.goalMet
                              ? 'bg-[#0593C6]'
                              : 'bg-neutral-400 dark:bg-neutral-600'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>

                      <span className="text-xs font-bold text-neutral-900 dark:text-white mt-2 tabular-nums">
                        {displayDist}
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
                        {week.runsCount} runs
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeWeek && (
                <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-[#0593C6]/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-neutral-900 dark:text-white">
                      Week of {activeWeek.weekStart}
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400 ml-2">
                      · {activeWeek.runs.map((r) => r.title).join(', ') || 'Rest week'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 tabular-nums text-neutral-600 dark:text-neutral-300">
                    <span>
                      Volume:{' '}
                      <strong className="text-neutral-900 dark:text-white">
                        {unit === 'miles'
                          ? `${(activeWeek.totalDistanceKm * KM_TO_MILES).toFixed(2)} mi`
                          : `${activeWeek.totalDistanceKm.toFixed(2)} km`}
                      </strong>
                    </span>
                    <span>
                      Total Time:{' '}
                      <strong className="text-neutral-900 dark:text-white">
                        {formatDuration(activeWeek.totalDurationSeconds)}
                      </strong>
                    </span>
                    {activeWeek.best6kInWeek && (
                      <span>
                        Best 6K Equiv:{' '}
                        <strong className="text-[#10B981]">
                          {formatDuration(activeWeek.best6kInWeek)}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inspection Card for Selected / Hovered Run on Curves */}
      {activeRun && (
        <div className="mt-3.5 p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-[#0593C6]/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-neutral-900 dark:text-white">
              {activeRun.title}
            </span>
            <span className="text-neutral-400 tabular-nums">({activeRun.date})</span>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              · {activeRun.runType}
            </span>
            {pinnedRun?.id === activeRun.id && (
              <button
                type="button"
                onClick={() => setPinnedRun(null)}
                className="text-[10px] font-semibold text-[#0593C6] hover:underline cursor-pointer"
              >
                (Pinned · Unpin)
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 tabular-nums text-neutral-600 dark:text-neutral-300 text-xs">
            <span>
              Dist:{' '}
              <strong className="text-neutral-900 dark:text-white font-semibold">
                {unit === 'miles'
                  ? `${(activeRun.distanceKm * KM_TO_MILES).toFixed(2)} mi`
                  : `${activeRun.distanceKm} km`}
              </strong>
            </span>
            <span>
              Pace:{' '}
              <strong className="text-neutral-900 dark:text-white font-semibold">
                {formatPace(activeRun.activeIntervalPaceSecPerKm || activeRun.averagePaceSecPerKm, unit)}
              </strong>
            </span>
            <span>
              Time:{' '}
              <strong className="text-neutral-900 dark:text-white font-semibold">
                {formatDuration(activeRun.durationSeconds)}
              </strong>
            </span>
            {activeTab === '6k_progression' && (
              <span>
                {targetLabel} Equiv:{' '}
                <strong className="text-[#0593C6] font-bold">
                  {formatDuration(
                    calculateTargetDistanceEquivalent(
                      activeRun.distanceKm,
                      activeRun.durationSeconds,
                      targetDistKm
                    ) ||
                      activeRun.best6kTimeSeconds ||
                      activeRun.durationSeconds
                  )}
                </strong>
              </span>
            )}
            {activeRun.avgHeartRate && (
              <span>
                HR: <strong className="text-[#ff375f] font-semibold">{activeRun.avgHeartRate} bpm</strong>
              </span>
            )}
          </div>
        </div>
      )}
            </div>
          </div>
        </div>
      </div>
    );
};
