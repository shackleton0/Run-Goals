import React, { useState } from 'react';
import { RunRecord, WeeklyStat } from '../types/running';
import {
  formatDuration,
  formatPace,
  calculate6kEquivalent,
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
} from 'lucide-react';

interface ProgressVisualizerProps {
  runs: RunRecord[];
  weeklyStats: WeeklyStat[];
  target6kSec?: number;
  unit: 'km' | 'miles';
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
  unit,
  onOpenGarminSync,
  onOpenAddRun,
}) => {
  // Set 30-Day Category Breakdown as the default view
  const [activeTab, setActiveTab] = useState<ViewMode>('categories_30d');
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);

  // Filter categories
  const quality6kRuns = [...runs]
    .filter((r) => r.runType === '6K Time Trial' || r.runType === 'Race' || r.runType === 'Tempo')
    .map((r) => ({
      ...r,
      calc6k: r.best6kTimeSeconds || calculate6kEquivalent(r.distanceKm, r.durationSeconds),
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
  const height = 280;
  const padding = { top: 25, right: 25, bottom: 40, left: 60 };
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
    run: r,
  }));

  const linePathAerobic =
    pointsAerobic.length > 0
      ? pointsAerobic.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
      : '';

  // Interval Chart Math
  const intervalPaces = intervalRuns.map((r) => r.averagePaceSecPerKm);
  const minIntervalPace = intervalPaces.length > 0 ? Math.min(...intervalPaces) : 200;
  const maxIntervalPace = intervalPaces.length > 0 ? Math.max(...intervalPaces) : 300;
  const yIntervalMin = Math.floor((minIntervalPace - 15) / 15) * 15;
  const yIntervalMax = Math.ceil((maxIntervalPace + 15) / 15) * 15;

  const getIntervalY = (paceSec: number) => {
    const ratio = (paceSec - yIntervalMin) / (yIntervalMax - yIntervalMin || 1);
    return padding.top + ratio * chartHeight;
  };

  const pointsInterval = intervalRuns.map((r, i) => ({
    x: getX(i, intervalRuns.length),
    y: getIntervalY(r.averagePaceSecPerKm),
    run: r,
  }));

  const linePathInterval =
    pointsInterval.length > 0
      ? pointsInterval.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
      : '';

  // Weekly Volume
  const chronologicalWeeks = [...weeklyStats].reverse();
  const maxDistance = Math.max(...chronologicalWeeks.map((w) => w.totalDistanceKm), 25);

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800 shadow-xs p-4 sm:p-6 transition-colors">
      {/* Header & Mobile-Optimized Segmented Navigation */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
              Performance Analytics
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              30-day category breakdown, race progression curves, and aerobic foundation
            </p>
          </div>
        </div>

        {/* Mobile-Friendly Horizontally Scrollable Segmented Tab Control */}
        <div className="w-full overflow-x-auto no-scrollbar scroll-smooth -mx-1 px-1">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 min-w-full sm:min-w-0">
            <button
              onClick={() => {
                setActiveTab('categories_30d');
                setSelectedRun(null);
              }}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] transition-all cursor-pointer ${
                activeTab === 'categories_30d'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <PieChart className="w-3.5 h-3.5 text-sky-500" />
              <span>30-Day Breakdown</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('6k_progression');
                setSelectedRun(null);
              }}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] transition-all cursor-pointer ${
                activeTab === '6k_progression'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#30d158]" />
              <span>Goal Race Curve</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('aerobic_runs');
                setSelectedRun(null);
              }}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] transition-all cursor-pointer ${
                activeTab === 'aerobic_runs'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-[#0a84ff]" />
              <span>Aerobic Base ({aerobicRuns.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('interval_training');
                setSelectedRun(null);
              }}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] transition-all cursor-pointer ${
                activeTab === 'interval_training'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-purple-500" />
              <span>Intervals ({intervalRuns.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('weekly_volume');
                setSelectedRun(null);
              }}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] transition-all cursor-pointer ${
                activeTab === 'weekly_volume'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-[#ff9f0a]" />
              <span>Weekly Volume</span>
            </button>
          </div>
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
              <TrendingUp className="w-8 h-8 text-neutral-400 dark:text-neutral-600 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                No Time Trials or Races Recorded
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1 mb-4">
                Import your Garmin workout files or log your first time trial to chart your official race pace progression.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {onOpenGarminSync && (
                  <button
                    onClick={onOpenGarminSync}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0a84ff] text-white cursor-pointer hover:bg-[#0071e3]"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload Garmin</span>
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
                      <span className="w-3 h-0.5 bg-[#0a84ff] inline-block border-t border-[#0a84ff] border-dashed" />
                      <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                        Goal: {formatDuration(target6kSec)}
                      </span>
                    </span>
                  )}
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#30d158] inline-block" />
                    <span>Quality Trials & Races</span>
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400">Tap or hover point for details</div>
              </div>

              {/* Chart Canvas with Smooth Touch Scrolling */}
              <div className="w-full overflow-x-auto touch-pan-x rounded-lg border border-neutral-100 dark:border-neutral-800/80 p-1 sm:p-2 bg-neutral-50/40 dark:bg-neutral-900/30">
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-auto min-w-[560px] sm:min-w-full select-none"
                >
                  {/* Goal Line */}
                  {targetY !== null && target6kSec && (
                    <>
                      <line
                        x1={padding.left}
                        y1={targetY}
                        x2={width - padding.right}
                        y2={targetY}
                        stroke="#0a84ff"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                      />
                      <text
                        x={width - padding.right}
                        y={targetY - 5}
                        fill="#0a84ff"
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
                      stroke="#30d158"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Points */}
                  {points6k.map((pt, i) => (
                    <g
                      key={pt.run.id || i}
                      className="cursor-pointer"
                      onClick={() => setSelectedRun(selectedRun?.id === pt.run.id ? null : pt.run)}
                      onMouseEnter={() => setSelectedRun(pt.run)}
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={selectedRun?.id === pt.run.id ? 7 : 4.5}
                        fill="#30d158"
                        stroke="currentColor"
                        className="text-white dark:text-[#1c1c1e] transition-all"
                        strokeWidth="2"
                      />
                      <text
                        x={pt.x}
                        y={height - padding.bottom + 18}
                        fill="currentColor"
                        className="text-neutral-400 dark:text-neutral-500 font-mono text-[10px]"
                        textAnchor="middle"
                      >
                        {pt.run.date.slice(5)}
                      </text>
                    </g>
                  ))}
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
              <Activity className="w-8 h-8 text-[#0a84ff] mx-auto mb-2 opacity-60" />
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
                  {aerobicRuns.length} aerobic sessions logged
                </span>
              </div>

              <div className="w-full overflow-x-auto touch-pan-x rounded-lg border border-neutral-100 dark:border-neutral-800/80 p-1 sm:p-2 bg-neutral-50/40 dark:bg-neutral-900/30">
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-auto min-w-[560px] sm:min-w-full select-none"
                >
                  {linePathAerobic && (
                    <path
                      d={linePathAerobic}
                      fill="none"
                      stroke="#0a84ff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {pointsAerobic.map((pt, i) => (
                    <g
                      key={pt.run.id || i}
                      className="cursor-pointer"
                      onClick={() => setSelectedRun(selectedRun?.id === pt.run.id ? null : pt.run)}
                      onMouseEnter={() => setSelectedRun(pt.run)}
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={selectedRun?.id === pt.run.id ? 7 : 4.5}
                        fill="#0a84ff"
                        stroke="currentColor"
                        className="text-white dark:text-[#1c1c1e] transition-all"
                        strokeWidth="2"
                      />
                      <text
                        x={pt.x}
                        y={height - padding.bottom + 18}
                        fill="currentColor"
                        className="text-neutral-400 dark:text-neutral-500 font-mono text-[10px]"
                        textAnchor="middle"
                      >
                        {pt.run.date.slice(5)}
                      </text>
                    </g>
                  ))}
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
              <Zap className="w-8 h-8 text-purple-500 mx-auto mb-2 opacity-60" />
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
                  {intervalRuns.length} interval sessions recorded
                </span>
              </div>

              <div className="w-full overflow-x-auto touch-pan-x rounded-lg border border-neutral-100 dark:border-neutral-800/80 p-1 sm:p-2 bg-neutral-50/40 dark:bg-neutral-900/30">
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-auto min-w-[560px] sm:min-w-full select-none"
                >
                  {linePathInterval && (
                    <path
                      d={linePathInterval}
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {pointsInterval.map((pt, i) => (
                    <g
                      key={pt.run.id || i}
                      className="cursor-pointer"
                      onClick={() => setSelectedRun(selectedRun?.id === pt.run.id ? null : pt.run)}
                      onMouseEnter={() => setSelectedRun(pt.run)}
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={selectedRun?.id === pt.run.id ? 7 : 4.5}
                        fill="#a855f7"
                        stroke="currentColor"
                        className="text-white dark:text-[#1c1c1e] transition-all"
                        strokeWidth="2"
                      />
                      <text
                        x={pt.x}
                        y={height - padding.bottom + 18}
                        fill="currentColor"
                        className="text-neutral-400 dark:text-neutral-500 font-mono text-[10px]"
                        textAnchor="middle"
                      >
                        {pt.run.date.slice(5)}
                      </text>
                    </g>
                  ))}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3">
              {chronologicalWeeks.slice(-6).map((week) => {
                const heightPct = Math.min(
                  100,
                  Math.round((week.totalDistanceKm / maxDistance) * 100)
                );
                const displayDist =
                  unit === 'miles'
                    ? `${(week.totalDistanceKm * KM_TO_MILES).toFixed(1)} mi`
                    : `${week.totalDistanceKm} km`;

                return (
                  <div
                    key={week.weekKey}
                    className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex flex-col items-center"
                  >
                    <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                      {week.weekStart}
                    </span>

                    <div className="w-8 h-24 sm:h-28 bg-neutral-200 dark:bg-neutral-800 rounded-md relative flex items-end justify-center p-0.5 overflow-hidden">
                      <div
                        className={`w-full rounded-xs transition-all duration-300 ${
                          week.goalMet ? 'bg-[#30d158]' : 'bg-neutral-400 dark:bg-neutral-600'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>

                    <span className="text-xs font-bold text-neutral-900 dark:text-white mt-2 tabular-nums">
                      {displayDist}
                    </span>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
                      {week.runsCount} / 3 runs
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Inspection Card for Selected / Hovered Run on Curves */}
      {selectedRun && (
        <div className="mt-3.5 p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-neutral-900 dark:text-white">
              {selectedRun.title}
            </span>
            <span className="text-neutral-400 tabular-nums">({selectedRun.date})</span>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {selectedRun.runType}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 tabular-nums text-neutral-600 dark:text-neutral-300 text-xs">
            <span>
              Dist:{' '}
              <strong className="text-neutral-900 dark:text-white font-semibold">
                {unit === 'miles'
                  ? `${(selectedRun.distanceKm * KM_TO_MILES).toFixed(2)} mi`
                  : `${selectedRun.distanceKm} km`}
              </strong>
            </span>
            <span>
              Pace:{' '}
              <strong className="text-neutral-900 dark:text-white font-semibold">
                {formatPace(selectedRun.averagePaceSecPerKm, unit)}
              </strong>
            </span>
            <span>
              Time:{' '}
              <strong className="text-neutral-900 dark:text-white font-semibold">
                {formatDuration(selectedRun.durationSeconds)}
              </strong>
            </span>
            {selectedRun.avgHeartRate && (
              <span>
                HR: <strong className="text-[#ff375f] font-semibold">{selectedRun.avgHeartRate} bpm</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
