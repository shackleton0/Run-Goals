import React, { useState } from 'react';
import { RunRecord } from '../types/running';
import {
  calculateCardioLoadAnalysis,
  CardioLoadPhase,
  CardioLoadDayPoint,
} from '../utils/runningCalculations';
import {
  HeartPulse,
  ChevronDown,
  ChevronUp,
  Activity,
  Target,
  TrendingUp,
  Info,
  Gauge,
} from 'lucide-react';

interface CardioLoadCardProps {
  runs: RunRecord[];
  maxHeartRate?: number;
}

const PHASE_META: Record<
  CardioLoadPhase,
  {
    color: string;
    softFill: string;
    textClass: string;
    borderClass: string;
    bgClass: string;
    rangeLabel: string;
  }
> = {
  Calibrating: {
    color: '#8B5CF6',
    softFill: 'rgba(139, 92, 246, 0.14)',
    textClass: 'text-violet-600 dark:text-violet-400',
    borderClass: 'border-violet-500/30',
    bgClass: 'bg-violet-500/10',
    rangeLabel: '< 7 days / < 3 runs',
  },
  Detraining: {
    color: '#F59E0B',
    softFill: 'rgba(245, 158, 11, 0.11)',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-500/30',
    bgClass: 'bg-amber-500/10',
    rangeLabel: '< 0.78x baseline',
  },
  Maintaining: {
    color: '#0EA5E9',
    softFill: 'rgba(14, 165, 233, 0.12)',
    textClass: 'text-sky-600 dark:text-sky-400',
    borderClass: 'border-sky-500/30',
    bgClass: 'bg-sky-500/10',
    rangeLabel: '0.78x – 1.05x baseline',
  },
  Improving: {
    color: '#10B981',
    softFill: 'rgba(16, 185, 129, 0.13)',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-500/30',
    bgClass: 'bg-emerald-500/10',
    rangeLabel: '1.05x – 1.32x baseline',
  },
  Overtraining: {
    color: '#EF4444',
    softFill: 'rgba(239, 68, 68, 0.14)',
    textClass: 'text-rose-600 dark:text-rose-400',
    borderClass: 'border-rose-500/30',
    bgClass: 'bg-rose-500/10',
    rangeLabel: '> 1.32x baseline',
  },
};

export const CardioLoadCard: React.FC<CardioLoadCardProps> = ({
  runs,
  maxHeartRate = 190,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [windowDays, setWindowDays] = useState<14 | 28 | 42>(28);
  const [selectedPoint, setSelectedPoint] = useState<CardioLoadDayPoint | null>(null);
  const [showModelInfo, setShowModelInfo] = useState(false);

  const analysis = calculateCardioLoadAnalysis(runs, windowDays, new Date(), maxHeartRate);
  const currentMeta = PHASE_META[analysis.currentPhase];
  const points = analysis.points;

  // Chart dimensions
  const width = 860;
  const height = 290;
  const padding = { top: 24, right: 98, bottom: 38, left: 48 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  // Determine vertical domain across acute, chronic, daily load, and overtraining threshold
  const maxValueRaw = Math.max(
    60,
    ...points.map((p) =>
      Math.max(p.acuteLoad, p.overtrainingThreshold * 1.28, p.dailyLoad * 0.9, p.chronicLoad * 1.45)
    )
  );
  const yMax = Math.ceil(maxValueRaw / 20) * 20;

  const getX = (idx: number) => {
    if (points.length <= 1) return padding.left + plotW / 2;
    return padding.left + (idx / (points.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(yMax, val));
    return padding.top + (1 - clamped / yMax) * plotH;
  };

  // Build SVG coordinates
  const coords = points.map((pt, idx) => ({
    ...pt,
    x: getX(idx),
    yAcute: getY(pt.acuteLoad),
    yChronic: getY(pt.chronicLoad),
    yOvertrain: getY(pt.overtrainingThreshold),
    yImprove: getY(pt.improvingThreshold),
    yDetrain: getY(pt.detrainingThreshold),
    yDaily: getY(pt.dailyLoad),
  }));

  // Helper to create closed SVG polygon paths for phase ribbon bands
  const buildBandPath = (
    topGetter: (c: (typeof coords)[number]) => number,
    bottomGetter: (c: (typeof coords)[number]) => number
  ) => {
    if (coords.length === 0) return '';
    const topPts = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${topGetter(c)}`).join(' ');
    const botPts = [...coords]
      .reverse()
      .map((c) => `L ${c.x} ${bottomGetter(c)}`)
      .join(' ');
    return `${topPts} ${botPts} Z`;
  };

  const hasBaselineBands = coords.some((c) => c.chronicLoad > 0);
  const topEdge = () => padding.top;
  const bottomEdge = () => padding.top + plotH;

  // Overtraining band: topEdge -> yOvertrain
  const overtrainingBandPath = hasBaselineBands
    ? buildBandPath(topEdge, (c) => (c.chronicLoad > 0 ? c.yOvertrain : topEdge()))
    : '';
  // Improving band: yOvertrain -> yImprove
  const improvingBandPath = hasBaselineBands
    ? buildBandPath(
        (c) => (c.chronicLoad > 0 ? c.yOvertrain : padding.top + plotH * 0.28),
        (c) => (c.chronicLoad > 0 ? c.yImprove : padding.top + plotH * 0.48)
      )
    : '';
  // Maintaining band: yImprove -> yDetrain
  const maintainingBandPath = hasBaselineBands
    ? buildBandPath(
        (c) => (c.chronicLoad > 0 ? c.yImprove : padding.top + plotH * 0.48),
        (c) => (c.chronicLoad > 0 ? c.yDetrain : padding.top + plotH * 0.72)
      )
    : '';
  // Detraining band: yDetrain -> bottomEdge
  const detrainingBandPath = hasBaselineBands
    ? buildBandPath(
        (c) => (c.chronicLoad > 0 ? c.yDetrain : padding.top + plotH * 0.72),
        bottomEdge
      )
    : '';

  // Identify calibrating window span for translucent calibration highlight
  const firstCalibIdx = coords.findIndex((c) => c.phase === 'Calibrating' && (c.runsCount > 0 || c.acuteLoad > 0));
  const lastCalibIdx = coords.reduce(
    (acc, c, idx) => (c.phase === 'Calibrating' && (c.runsCount > 0 || c.acuteLoad > 0 || !analysis.hasRuns) ? idx : acc),
    -1
  );

  // Acute Load & Chronic Baseline polylines
  const acuteLinePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.yAcute}`)
    .join(' ');
  const chronicLinePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.yChronic}`)
    .join(' ');

  const latestCoord = coords[coords.length - 1];
  const inspectedPoint = selectedPoint || (points.length > 0 ? points[points.length - 1] : null);
  const inspectedMeta = inspectedPoint ? PHASE_META[inspectedPoint.phase] : currentMeta;

  // X-axis tick indices (~6 evenly spaced labels)
  const tickStep = Math.max(1, Math.floor((coords.length - 1) / 5));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    val: Math.round(pct * yMax),
    y: padding.top + (1 - pct) * plotH,
  }));

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
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-pink-500 flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105">
            <HeartPulse className="w-4.5 h-4.5 stroke-[2.3]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">
                Cardio Load
              </h2>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                · {analysis.hasRuns ? `${analysis.acuteLoad} Load` : 'No Runs'} ·{' '}
                <span className={currentMeta.textClass}>{analysis.currentPhase}</span>
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

      {/* Expandable Body */}
      <div
        className={`accordion-collapse-wrapper ${isExpanded ? 'is-expanded' : ''}`}
        aria-hidden={!isExpanded}
      >
        <div className="accordion-collapse-inner">
          <div className="px-4 pb-5 pt-4 sm:px-5 border-t border-slate-100 dark:border-slate-800 space-y-5">
            {/* Top Description & Time Window Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Rolling cardiovascular strain vs. 28-day fitness baseline across Calibrating, Detraining, Maintaining, Improving & Overtraining phases
                </p>
              </div>

              <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs self-start sm:self-auto">
                {([14, 28, 42] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => {
                      setWindowDays(days);
                      setSelectedPoint(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                      windowDays === days
                        ? 'bg-pink-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {days}D
                  </button>
                ))}
              </div>
            </div>

            {/* 4 Key Telemetry Tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Tile 1: Active Phase */}
              <div className={`p-3.5 rounded-xl border ${currentMeta.bgClass} ${currentMeta.borderClass}`}>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  <span>Training Phase</span>
                  <HeartPulse className={`w-3.5 h-3.5 ${currentMeta.textClass}`} />
                </div>
                <div className={`text-xl sm:text-2xl font-extrabold tracking-tight ${currentMeta.textClass}`}>
                  {analysis.currentPhase}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                  {analysis.currentPhase === 'Calibrating'
                    ? `${analysis.calibrationDaysLogged}/${analysis.calibrationDaysRequired} days baseline data`
                    : currentMeta.rangeLabel}
                </div>
              </div>

              {/* Tile 2: Acute Cardio Load */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  <span>Current Cardio Load</span>
                  <Activity className="w-3.5 h-3.5 text-pink-500" />
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
                  {analysis.acuteLoad}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
                  7-day weighted rolling score
                </div>
              </div>

              {/* Tile 3: Target Window */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  <span>Target Load Window</span>
                  <Target className="w-3.5 h-3.5 text-sky-500" />
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
                  {analysis.hasRuns ? `${analysis.targetRangeMin}–${analysis.targetRangeMax}` : '--'}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
                  Baseline CTL: {analysis.chronicLoad}
                </div>
              </div>

              {/* Tile 4: Load Ratio (ACWR) */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  <span>Load Ratio (ACWR)</span>
                  <Gauge className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
                  {analysis.hasRuns ? `${analysis.acwrRatio.toFixed(2)}x` : '--'}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
                  {analysis.totalWindowRuns} sessions in last {windowDays}d
                </div>
              </div>
            </div>

            {/* Cardio Load Line Graph with Colored Phase Zone Bands */}
            <div className="rounded-xl bg-slate-50/70 dark:bg-[#0B1520] border border-slate-200/90 dark:border-slate-800 p-3 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center space-x-1.5 font-semibold text-slate-900 dark:text-white">
                    <span className="w-4 h-0.5 bg-pink-500 inline-block rounded-full" />
                    <span>Cardio Load (Acute)</span>
                  </span>
                  <span className="inline-flex items-center space-x-1.5">
                    <span className="w-4 h-0 border-t-2 border-dashed border-slate-400 dark:border-slate-500 inline-block" />
                    <span>28-Day Baseline</span>
                  </span>
                  <span className="inline-flex items-center space-x-1.5">
                    <span className="w-2 h-3 rounded-xs bg-slate-400/50 inline-block" />
                    <span>Daily Workout Load</span>
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tap or hover any day for phase breakdown
                </span>
              </div>

              <div className="w-full overflow-x-auto touch-pan-x">
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-auto min-w-[600px] sm:min-w-full select-none"
                >
                  {/* Phase Zone Ribbons */}
                  {hasBaselineBands ? (
                    <>
                      <path d={overtrainingBandPath} fill={PHASE_META.Overtraining.softFill} />
                      <path d={improvingBandPath} fill={PHASE_META.Improving.softFill} />
                      <path d={maintainingBandPath} fill={PHASE_META.Maintaining.softFill} />
                      <path d={detrainingBandPath} fill={PHASE_META.Detraining.softFill} />
                    </>
                  ) : (
                    <>
                      {/* Default schematic phase bands when awaiting initial runs */}
                      <rect x={padding.left} y={padding.top} width={plotW} height={plotH * 0.25} fill={PHASE_META.Overtraining.softFill} />
                      <rect x={padding.left} y={padding.top + plotH * 0.25} width={plotW} height={plotH * 0.25} fill={PHASE_META.Improving.softFill} />
                      <rect x={padding.left} y={padding.top + plotH * 0.50} width={plotW} height={plotH * 0.25} fill={PHASE_META.Maintaining.softFill} />
                      <rect x={padding.left} y={padding.top + plotH * 0.75} width={plotW} height={plotH * 0.25} fill={PHASE_META.Detraining.softFill} />
                    </>
                  )}

                  {/* Calibrating Shaded Span */}
                  {firstCalibIdx >= 0 && lastCalibIdx >= firstCalibIdx && (
                    <g>
                      <rect
                        x={coords[firstCalibIdx].x}
                        y={padding.top}
                        width={Math.max(24, coords[lastCalibIdx].x - coords[firstCalibIdx].x)}
                        height={plotH}
                        fill="rgba(139, 92, 246, 0.14)"
                        stroke="rgba(139, 92, 246, 0.4)"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                      />
                      <text
                        x={coords[firstCalibIdx].x + 6}
                        y={padding.top + 14}
                        fill="#8B5CF6"
                        fontSize="10"
                        fontWeight="700"
                      >
                        Calibrating
                      </text>
                    </g>
                  )}

                  {/* Horizontal Y Gridlines & Labels */}
                  {yTicks.map((tick, idx) => (
                    <g key={idx}>
                      <line
                        x1={padding.left}
                        y1={tick.y}
                        x2={width - padding.right}
                        y2={tick.y}
                        stroke="currentColor"
                        className="text-slate-300/60 dark:text-slate-700/60"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                      <text
                        x={padding.left - 8}
                        y={tick.y + 3.5}
                        fill="currentColor"
                        className="text-slate-500 dark:text-slate-400 font-mono text-[10px]"
                        textAnchor="end"
                      >
                        {tick.val}
                      </text>
                    </g>
                  ))}

                  {/* Right-Side Phase Zone Labels */}
                  {latestCoord && (
                    <g className="font-sans">
                      <text
                        x={width - padding.right + 8}
                        y={Math.max(padding.top + 12, (padding.top + (hasBaselineBands ? latestCoord.yOvertrain : padding.top + plotH * 0.25)) / 2)}
                        fill="#EF4444"
                        fontSize="10.5"
                        fontWeight="700"
                      >
                        Overtraining
                      </text>
                      <text
                        x={width - padding.right + 8}
                        y={hasBaselineBands ? (latestCoord.yOvertrain + latestCoord.yImprove) / 2 + 3 : padding.top + plotH * 0.38}
                        fill="#10B981"
                        fontSize="10.5"
                        fontWeight="700"
                      >
                        Improving
                      </text>
                      <text
                        x={width - padding.right + 8}
                        y={hasBaselineBands ? (latestCoord.yImprove + latestCoord.yDetrain) / 2 + 3 : padding.top + plotH * 0.62}
                        fill="#0EA5E9"
                        fontSize="10.5"
                        fontWeight="700"
                      >
                        Maintaining
                      </text>
                      <text
                        x={width - padding.right + 8}
                        y={Math.min(padding.top + plotH - 6, hasBaselineBands ? (latestCoord.yDetrain + padding.top + plotH) / 2 + 3 : padding.top + plotH * 0.88)}
                        fill="#F59E0B"
                        fontSize="10.5"
                        fontWeight="700"
                      >
                        Detraining
                      </text>
                    </g>
                  )}

                  {/* Daily Run Load Bars (background bars for days with workouts) */}
                  {coords.map((c, idx) =>
                    c.dailyLoad > 0 ? (
                      <rect
                        key={`bar-${idx}`}
                        x={c.x - 4}
                        y={c.yDaily}
                        width={8}
                        height={Math.max(2, padding.top + plotH - c.yDaily)}
                        rx="2"
                        fill={PHASE_META[c.phase].color}
                        opacity="0.28"
                      />
                    ) : null
                  )}

                  {/* Chronic Baseline Dashed Line */}
                  {hasBaselineBands && (
                    <path
                      d={chronicLinePath}
                      fill="none"
                      stroke="#64748B"
                      strokeWidth="1.75"
                      strokeDasharray="5 4"
                    />
                  )}

                  {/* Acute Cardio Load Line */}
                  <path
                    d={acuteLinePath}
                    fill="none"
                    stroke="#EC4899"
                    strokeWidth="2.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Interactive Day Nodes + Hover Targets */}
                  {coords.map((c, idx) => {
                    const isSelected = inspectedPoint?.date === c.date;
                    const ptColor = PHASE_META[c.phase].color;
                    const showXLabel = idx % tickStep === 0 || idx === coords.length - 1;

                    return (
                      <g
                        key={c.date}
                        className="cursor-pointer"
                        onMouseEnter={() => setSelectedPoint(c)}
                        onClick={() => setSelectedPoint(c)}
                      >
                        {/* Invisible wide hit column */}
                        <rect
                          x={c.x - Math.max(8, plotW / coords.length / 2)}
                          y={padding.top}
                          width={Math.max(16, plotW / coords.length)}
                          height={plotH}
                          fill="transparent"
                        />

                        {isSelected && (
                          <line
                            x1={c.x}
                            y1={padding.top}
                            x2={c.x}
                            y2={padding.top + plotH}
                            stroke={ptColor}
                            strokeWidth="1.25"
                            strokeDasharray="3 3"
                            opacity="0.7"
                          />
                        )}

                        {(c.runsCount > 0 || isSelected || idx === coords.length - 1) && (
                          <circle
                            cx={c.x}
                            cy={c.yAcute}
                            r={isSelected ? 6 : c.runsCount > 0 ? 4 : 3}
                            fill={ptColor}
                            stroke="#FFFFFF"
                            strokeWidth={isSelected ? 2 : 1.5}
                          />
                        )}

                        {showXLabel && (
                          <text
                            x={c.x}
                            y={height - 12}
                            fill="currentColor"
                            className="text-slate-500 dark:text-slate-400 font-mono text-[10px]"
                            textAnchor="middle"
                          >
                            {c.shortLabel}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Phase Legend Bar */}
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-3">
                  {(Object.keys(PHASE_META) as CardioLoadPhase[]).map((phase) => {
                    const meta = PHASE_META[phase];
                    const count = analysis.phaseCounts[phase] || 0;
                    return (
                      <span key={phase} className="inline-flex items-center space-x-1.5 text-slate-700 dark:text-slate-300">
                        <span
                          className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="font-semibold">{phase}</span>
                        <span className="text-slate-400 dark:text-slate-500 tabular-nums font-mono">
                          ({count}d)
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected Day Inspector */}
            {inspectedPoint && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#101E2B] border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {inspectedPoint.shortLabel} ({inspectedPoint.date})
                    </span>
                    <span className={`font-bold ${inspectedMeta.textClass}`}>
                      · {inspectedPoint.phase}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {inspectedPoint.runsCount > 0
                      ? `Completed: ${inspectedPoint.runTitles.join(', ')} (+${inspectedPoint.dailyLoad} daily load)`
                      : 'Rest / recovery day — Cardio Load naturally tapered'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 tabular-nums text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="block text-[10px] text-slate-400">Acute Load</span>
                    <strong className="text-slate-900 dark:text-white font-bold">
                      {inspectedPoint.acuteLoad}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">Baseline</span>
                    <strong className="text-slate-900 dark:text-white font-bold">
                      {inspectedPoint.chronicLoad}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">Target Zone</span>
                    <strong className="text-slate-900 dark:text-white font-bold">
                      {inspectedPoint.targetMin}–{inspectedPoint.targetMax}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">ACWR</span>
                    <strong className={`font-bold ${inspectedMeta.textClass}`}>
                      {inspectedPoint.acwrRatio.toFixed(2)}x
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Actionable Coach Guidance & Formula Drawer */}
            <div className="rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200 dark:border-slate-700/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-start sm:items-center space-x-2">
                <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5 sm:mt-0 text-pink-500" />
                <p className="text-slate-700 dark:text-slate-200">
                  <strong className="text-slate-900 dark:text-white font-bold">Load Guidance: </strong>
                  {analysis.guidanceText}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModelInfo((prev) => !prev)}
                className="inline-flex items-center space-x-1 text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:underline transition-colors cursor-pointer shrink-0 self-end sm:self-auto"
              >
                <Info className="w-3 h-3" />
                <span>{showModelInfo ? 'Hide Phases Guide' : 'How Cardio Load Works'}</span>
                {showModelInfo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {showModelInfo && (
              <div className="p-4 rounded-xl bg-white dark:bg-[#070E16] border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white">
                  Fitbit-Style Cardio Load & Training Phase Thresholds
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1 text-[11px]">
                  {(Object.keys(PHASE_META) as CardioLoadPhase[]).map((phase) => {
                    const meta = PHASE_META[phase];
                    return (
                      <div
                        key={phase}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#0F1C28] border border-slate-200/80 dark:border-slate-800"
                      >
                        <div className={`font-bold ${meta.textClass}`}>{phase}</div>
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          {meta.rangeLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
