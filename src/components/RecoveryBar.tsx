import React, { useState } from 'react';
import { RunRecord } from '../types/running';
import { calculateRecoveryStatus } from '../utils/runningCalculations';
import {
  BatteryCharging,
  Zap,
  Clock,
  Flame,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface RecoveryBarProps {
  runs: RunRecord[];
  maxHeartRate?: number;
}

export const RecoveryBar: React.FC<RecoveryBarProps> = ({ runs, maxHeartRate = 190 }) => {
  const [showFormula, setShowFormula] = useState(false);
  const recovery = calculateRecoveryStatus(runs, new Date(), maxHeartRate);
  const score = recovery.bodyBatteryScore;

  // Dynamic Garmin Body Battery Color Tiers (High Contrast)
  const getTierTheme = (val: number) => {
    if (val >= 80) {
      return {
        primary: '#10B981',
        secondary: '#06B6D4',
        textClass: 'text-emerald-600 dark:text-emerald-400',
        badgeClass:
          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        glow: 'rgba(16, 185, 129, 0.35)',
        gradientId: 'bb-grad-emerald',
      };
    }
    if (val >= 55) {
      return {
        primary: '#0EA5E9',
        secondary: '#38BDF8',
        textClass: 'text-sky-600 dark:text-sky-400',
        badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
        glow: 'rgba(14, 165, 233, 0.35)',
        gradientId: 'bb-grad-sky',
      };
    }
    if (val >= 35) {
      return {
        primary: '#F59E0B',
        secondary: '#FBBF24',
        textClass: 'text-amber-600 dark:text-amber-400',
        badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        glow: 'rgba(245, 158, 11, 0.35)',
        gradientId: 'bb-grad-amber',
      };
    }
    return {
      primary: '#EF4444',
      secondary: '#F97316',
      textClass: 'text-rose-600 dark:text-rose-400',
      badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
      glow: 'rgba(239, 68, 68, 0.35)',
      gradientId: 'bb-grad-red',
    };
  };

  const tier = getTierTheme(score);

  // Circular Ring Gauge Math
  const ringSize = 112;
  const strokeWidth = 10;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcOffset = circumference - (Math.max(5, score) / 100) * circumference;

  // 10-segment Garmin Battery Cell Meter
  const totalCells = 10;
  const activeCells = Math.max(1, Math.round((score / 100) * totalCells));

  // SVG Timeline Energy Curve Math
  const chartW = 360;
  const chartH = 74;
  const padX = 12;
  const padY = 10;
  const pts = recovery.batteryTimeline;
  const coords = pts.map((p, idx) => {
    const x = padX + (idx / Math.max(1, pts.length - 1)) * (chartW - padX * 2);
    const y = padY + ((100 - p.score) / 100) * (chartH - padY * 2);
    return { ...p, x, y };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x} ${chartH - padY} L ${coords[0].x} ${chartH - padY} Z`
      : '';

  return (
    <div className="rounded-xl bg-slate-50/90 dark:bg-[#0B1520] border border-slate-200 dark:border-slate-700/80 p-4 sm:p-5 transition-colors">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-4">
        <div className="flex items-center space-x-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center border shadow-xs"
            style={{
              backgroundColor: `${tier.primary}18`,
              borderColor: `${tier.primary}40`,
              color: tier.primary,
            }}
          >
            <BatteryCharging className="w-4.5 h-4.5 stroke-[2.3]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Body Battery & Recovery
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                Energy Reserve
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Garmin-style physiological energy balance (5–100) from workout drain & rest recharge
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border self-start sm:self-auto ${tier.badgeClass}`}
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span className="tabular-nums font-mono">{score}/100</span>
          <span>·</span>
          <span>{recovery.batteryStatusLabel}</span>
        </div>
      </div>

      {/* Main Garmin Body Battery Hero Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        {/* Left: Circular Body Battery Score Ring */}
        <div className="lg:col-span-4 rounded-xl bg-white dark:bg-[#101E2B] border border-slate-200/90 dark:border-slate-700/70 p-4 flex items-center space-x-4 shadow-xs">
          <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} className="-rotate-90">
              <defs>
                <linearGradient id={tier.gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={tier.primary} />
                  <stop offset="100%" stopColor={tier.secondary} />
                </linearGradient>
              </defs>
              {/* Track */}
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                className="stroke-slate-200 dark:stroke-slate-800"
              />
              {/* Active Energy Arc */}
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke={`url(#${tier.gradientId})`}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={arcOffset}
                style={{
                  transition: 'stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                  filter: `drop-shadow(0 0 6px ${tier.glow})`,
                }}
              />
            </svg>

            {/* Center Score Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="flex items-center space-x-0.5">
                <Zap className="w-3 h-3" style={{ color: tier.primary }} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Battery
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums leading-none mt-0.5">
                {score}
              </div>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                of 100
              </span>
            </div>
          </div>

          {/* Right side of Gauge Card: Charged vs Drained Deltas & 10-Cell Segmented Battery */}
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                <div className="flex items-center space-x-1 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Charged</span>
                </div>
                <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  +{recovery.chargedPoints}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25">
                <div className="flex items-center space-x-1 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
                  <ArrowDownRight className="w-3 h-3" />
                  <span>Drained</span>
                </div>
                <div className="text-base font-extrabold text-amber-700 dark:text-amber-300 tabular-nums">
                  -{recovery.drainedPoints}
                </div>
              </div>
            </div>

            {/* Garmin Segmented 10-Cell Battery Visual */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                <span>Cell Reserve</span>
                <span className={`font-bold ${tier.textClass}`}>{recovery.readinessState}</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="flex-1 grid grid-cols-10 gap-1 p-1 rounded-lg bg-slate-200/80 dark:bg-slate-900 border border-slate-300/70 dark:border-slate-700">
                  {Array.from({ length: totalCells }).map((_, idx) => {
                    const isFilled = idx < activeCells;
                    const cellColor =
                      idx < 2
                        ? '#EF4444'
                        : idx < 5
                        ? '#F59E0B'
                        : idx < 8
                        ? '#0EA5E9'
                        : '#10B981';
                    return (
                      <div
                        key={idx}
                        className="h-3 rounded-[2px] transition-all duration-300"
                        style={{
                          backgroundColor: isFilled ? cellColor : 'transparent',
                          opacity: isFilled ? 1 : 0.25,
                        }}
                      />
                    );
                  })}
                </div>
                {/* Battery Cap */}
                <div className="w-1.5 h-3.5 rounded-r-sm bg-slate-400 dark:bg-slate-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Garmin-Style Body Battery Discharge & Recharge Energy Curve */}
        <div className="lg:col-span-8 rounded-xl bg-white dark:bg-[#101E2B] border border-slate-200/90 dark:border-slate-700/70 p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Drain & Recharge Timeline
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-2">
                {recovery.hasRuns && recovery.lastRun
                  ? `Post-${recovery.lastRun.runType} restoration (${recovery.rechargeRatePerHour}/hr recharge rate)`
                  : 'Baseline peak readiness'}
              </span>
            </div>
            <span className="text-[11px] font-bold tabular-nums font-mono" style={{ color: tier.primary }}>
              Low: {recovery.batteryLowAfterRun} → Now: {score}
            </span>
          </div>

          <div className="w-full overflow-hidden">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-24">
              <defs>
                <linearGradient id="bbTimelineFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tier.primary} stopOpacity="0.38" />
                  <stop offset="100%" stopColor={tier.primary} stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Horizontal threshold gridlines */}
              {[25, 50, 75].map((pct) => {
                const y = padY + ((100 - pct) / 100) * (chartH - padY * 2);
                return (
                  <line
                    key={pct}
                    x1={padX}
                    y1={y}
                    x2={chartW - padX}
                    y2={y}
                    stroke="currentColor"
                    strokeDasharray="3 3"
                    className="text-slate-200 dark:text-slate-800"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Area + Curve */}
              {areaPath && <path d={areaPath} fill="url(#bbTimelineFill)" />}
              <path
                d={linePath}
                fill="none"
                stroke={tier.primary}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Curve Nodes */}
              {coords.map((pt, i) => {
                const dotColor =
                  pt.phase === 'drain'
                    ? '#F59E0B'
                    : pt.phase === 'now'
                    ? tier.primary
                    : '#94A3B8';
                const r = pt.phase === 'now' || pt.phase === 'drain' ? 4 : 2.5;
                return (
                  <g key={i}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={r}
                      fill={dotColor}
                      stroke="#ffffff"
                      strokeWidth={pt.phase === 'now' ? 1.5 : 1}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Timeline X Labels */}
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400 px-1 pt-1 border-t border-slate-100 dark:border-slate-800/80 tabular-nums">
            {coords.map((pt, idx) => (
              <div key={idx} className="text-center">
                <div className={pt.phase === 'now' ? 'text-slate-900 dark:text-white font-bold' : ''}>
                  {pt.label}
                </div>
                <div
                  className="text-[9px] font-mono"
                  style={{
                    color: pt.phase === 'drain' ? '#F59E0B' : pt.phase === 'now' ? tier.primary : undefined,
                  }}
                >
                  {pt.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4 High-Contrast Biometric Tiles */}
      {recovery.hasRuns && recovery.lastRun ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3.5">
          {/* Primary Drain Activity */}
          <div className="p-3 rounded-xl bg-white dark:bg-[#101E2B] border border-slate-200/90 dark:border-slate-700/70 flex flex-col justify-between">
            <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-medium mb-1">
              <Activity className="w-3.5 h-3.5 text-sky-500" />
              <span>Primary Drain</span>
            </div>
            <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
              {recovery.lastRun.title}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums truncate">
              {recovery.lastRun.runType} · {recovery.lastRun.distanceKm} km
            </div>
          </div>

          {/* Recharge Window */}
          <div className="p-3 rounded-xl bg-white dark:bg-[#101E2B] border border-slate-200/90 dark:border-slate-700/70 flex flex-col justify-between">
            <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-medium mb-1">
              <Clock className="w-3.5 h-3.5 text-violet-500" />
              <span>Recharge Time</span>
            </div>
            <div className="font-extrabold text-xs text-slate-900 dark:text-white tabular-nums">
              {recovery.hoursSinceLastRun} hours
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 tabular-nums">
              +{recovery.chargedPoints} pts restored
            </div>
          </div>

          {/* Workout Strain & Stress Multiplier */}
          <div className="p-3 rounded-xl bg-white dark:bg-[#101E2B] border border-slate-200/90 dark:border-slate-700/70 flex flex-col justify-between">
            <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-medium mb-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Strain Drain</span>
            </div>
            <div className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center space-x-1">
              <span>{recovery.effortLevel}</span>
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                (-{recovery.drainedPoints} pts)
              </span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
              Load {recovery.effortScore} · {recovery.trainingStressMultiplier}x factor
            </div>
          </div>

          {/* Full 100 Battery ETA */}
          <div className="p-3 rounded-xl bg-white dark:bg-[#101E2B] border border-slate-200/90 dark:border-slate-700/70 flex flex-col justify-between">
            <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-medium mb-1">
              {recovery.remainingRecoveryHours === 0 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>Peak 100 ETA</span>
            </div>
            <div className="font-extrabold text-xs text-slate-900 dark:text-white tabular-nums">
              {recovery.remainingRecoveryHours === 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400">Fully Charged</span>
              ) : (
                <span>{recovery.remainingRecoveryHours}h remaining</span>
              )}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
              {recovery.recommendedRecoveryHours}h total recovery span
            </div>
          </div>
        </div>
      ) : (
        <div className="py-2 text-xs text-slate-600 dark:text-slate-300 mb-2">
          No runs logged yet. Log your first workout or sync data to track Body Battery drain & recharge.
        </div>
      )}

      {/* Next Session Guidance Banner */}
      <div className="rounded-xl bg-white dark:bg-[#101E2B] border border-slate-200/90 dark:border-slate-700/70 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-start sm:items-center space-x-2">
          <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5 sm:mt-0" style={{ color: tier.primary }} />
          <p className="text-slate-700 dark:text-slate-200">
            <strong className="text-slate-900 dark:text-white font-bold">Training Readiness: </strong>
            {recovery.nextSessionRecommendation}
          </p>
        </div>

        {/* Toggle Calculation Model Formula */}
        <button
          type="button"
          onClick={() => setShowFormula(!showFormula)}
          className="inline-flex items-center space-x-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline transition-colors cursor-pointer shrink-0 self-end sm:self-auto"
        >
          <Info className="w-3 h-3" />
          <span>{showFormula ? 'Hide Formula' : 'How Body Battery Works'}</span>
          {showFormula ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expandable Mathematical Model Explanation */}
      {showFormula && (
        <div className="mt-3 p-3.5 rounded-xl bg-white dark:bg-[#070E16] border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
          <div className="font-bold text-slate-900 dark:text-white">
            Deterministic Body Battery & Recovery Model
          </div>
          <p className="text-[11px] leading-relaxed">
            1. <strong>Workout Strain Drain</strong> ={' '}
            <code className="text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded-sm">
              min(85, max(15, round(TSL × 0.72)))
            </code>{' '}
            deducted from pre-run reserve.
          </p>
          <p className="text-[11px] leading-relaxed">
            2. <strong>Full Recharge Window</strong> ={' '}
            <code className="text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded-sm">
              clamp(TSL × 0.46 + 4, 12h, 72h)
            </code>
            .
          </p>
          <p className="text-[11px] leading-relaxed">
            3. <strong>Restorative Charge Curve</strong> ={' '}
            <code className="text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded-sm">
              Low + (100 - Low) × (Elapsed / Window)^0.85
            </code>{' '}
            (scale 5–100).
          </p>
        </div>
      )}
    </div>
  );
};
