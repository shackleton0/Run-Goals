import React, { useState } from 'react';
import { RunRecord } from '../types/running';
import { calculateRecoveryStatus } from '../utils/runningCalculations';
import {
  BatteryCharging,
  Clock,
  Flame,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface RecoveryBarProps {
  runs: RunRecord[];
  maxHeartRate?: number;
}

export const RecoveryBar: React.FC<RecoveryBarProps> = ({ runs, maxHeartRate = 190 }) => {
  const [showFormula, setShowFormula] = useState(false);
  const recovery = calculateRecoveryStatus(runs, new Date(), maxHeartRate);

  // Gradient styles based on recovery percentage
  const getGradientClass = (pct: number) => {
    if (pct >= 90) return 'from-emerald-500 to-[#30d158]';
    if (pct >= 70) return 'from-blue-600 to-[#0a84ff]';
    if (pct >= 45) return 'from-amber-600 to-[#ff9f0a]';
    return 'from-rose-600 to-[#ff453a]';
  };

  const getGlowColor = (pct: number) => {
    if (pct >= 90) return 'rgba(48, 209, 88, 0.35)';
    if (pct >= 70) return 'rgba(10, 132, 255, 0.35)';
    if (pct >= 45) return 'rgba(255, 159, 10, 0.35)';
    return 'rgba(255, 69, 58, 0.35)';
  };

  const getBadgeStyle = (pct: number) => {
    if (pct >= 90) {
      return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-[#30d158] border-emerald-200 dark:border-emerald-800/60';
    }
    if (pct >= 70) {
      return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-[#0a84ff] border-blue-200 dark:border-blue-800/60';
    }
    if (pct >= 45) {
      return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-[#ff9f0a] border-amber-200 dark:border-amber-800/60';
    }
    return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-[#ff453a] border-rose-200 dark:border-rose-800/60';
  };

  return (
    <div className="rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/40 border border-neutral-200/90 dark:border-neutral-800/80 p-4 sm:p-5 mb-5 transition-all">
      {/* Top Row: Title, Icon, Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-3.5">
        <div className="flex items-center space-x-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
            style={{
              backgroundColor: `${recovery.color}15`,
              color: recovery.color,
            }}
          >
            <BatteryCharging className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight">
                Recovery & Readiness
              </h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 bg-neutral-200/60 dark:bg-neutral-800 px-1.5 py-0.5 rounded-sm">
                Math Engine
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Physiological recovery calculated from workout strain, heart rate, and elapsed rest
            </p>
          </div>
        </div>

        {/* Readiness Badge */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <div
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${getBadgeStyle(
              recovery.recoveryPercentage
            )}`}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: recovery.color }}
            />
            <span className="tabular-nums font-mono">{recovery.recoveryPercentage}%</span>
            <span>·</span>
            <span>{recovery.readinessState}</span>
          </div>
        </div>
      </div>

      {/* Recovery Progress Bar with Scale & Markers */}
      <div className="space-y-1.5 mb-4">
        <div className="relative w-full h-4 bg-neutral-200 dark:bg-neutral-800/90 rounded-full overflow-hidden p-0.5 shadow-inner">
          {/* Tick marks for 25%, 50%, 75% */}
          <div className="absolute inset-0 flex justify-between px-[25%] pointer-events-none z-10 opacity-30">
            <span className="w-px h-full bg-neutral-400 dark:bg-neutral-600" />
            <span className="w-px h-full bg-neutral-400 dark:bg-neutral-600" />
          </div>

          <div
            className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out ${getGradientClass(
              recovery.recoveryPercentage
            )}`}
            style={{
              width: `${Math.max(4, recovery.recoveryPercentage)}%`,
              boxShadow: `0 0 10px ${getGlowColor(recovery.recoveryPercentage)}`,
            }}
          />
        </div>

        {/* Progress Labels */}
        <div className="flex justify-between text-[10px] font-medium text-neutral-400 dark:text-neutral-500 px-0.5 tabular-nums">
          <span>0h (Resting)</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span className="text-neutral-600 dark:text-neutral-300 font-semibold">100% Fully Primed</span>
        </div>
      </div>

      {/* 4 Informative Metrics Grid */}
      {recovery.hasRuns && recovery.lastRun ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3.5">
          {/* Last Run Info */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between">
            <div className="flex items-center space-x-1.5 text-neutral-400 dark:text-neutral-500 text-[11px] mb-1">
              <Activity className="w-3.5 h-3.5 text-sky-500" />
              <span>Last Workout</span>
            </div>
            <div className="font-semibold text-xs text-neutral-900 dark:text-white truncate">
              {recovery.lastRun.title}
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums truncate">
              {recovery.lastRun.runType} · {recovery.lastRun.distanceKm} km
            </div>
          </div>

          {/* Time Elapsed */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between">
            <div className="flex items-center space-x-1.5 text-neutral-400 dark:text-neutral-500 text-[11px] mb-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>Elapsed Rest</span>
            </div>
            <div className="font-bold text-xs text-neutral-900 dark:text-white tabular-nums">
              {recovery.hoursSinceLastRun} hours
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              since last activity
            </div>
          </div>

          {/* Workout Strain & Effort */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between">
            <div className="flex items-center space-x-1.5 text-neutral-400 dark:text-neutral-500 text-[11px] mb-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Session Strain</span>
            </div>
            <div className="font-bold text-xs text-neutral-900 dark:text-white flex items-center space-x-1">
              <span>{recovery.effortLevel}</span>
              <span className="text-[10px] font-normal text-neutral-400 tabular-nums">
                (Load: {recovery.effortScore})
              </span>
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
              {recovery.trainingStressMultiplier}x intensity factor
            </div>
          </div>

          {/* Recovery Window */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between">
            <div className="flex items-center space-x-1.5 text-neutral-400 dark:text-neutral-500 text-[11px] mb-1">
              {recovery.remainingRecoveryHours === 0 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#30d158]" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-[#ff9f0a]" />
              )}
              <span>Status to 100%</span>
            </div>
            <div className="font-bold text-xs text-neutral-900 dark:text-white tabular-nums">
              {recovery.remainingRecoveryHours === 0 ? (
                <span className="text-[#30d158]">Fully Restored</span>
              ) : (
                <span>{recovery.remainingRecoveryHours}h remaining</span>
              )}
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
              {recovery.recommendedRecoveryHours}h recommended window
            </div>
          </div>
        </div>
      ) : (
        <div className="py-2 text-xs text-neutral-500 dark:text-neutral-400 mb-2">
          No runs logged yet. Log your first run or sync your fitness watch to activate the recovery model.
        </div>
      )}

      {/* Next Session Guidance Banner */}
      <div className="rounded-xl bg-white/80 dark:bg-neutral-900/80 border border-neutral-200/60 dark:border-neutral-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-start sm:items-center space-x-2">
          <div
            className="w-2 h-2 rounded-full mt-1 sm:mt-0 shrink-0"
            style={{ backgroundColor: recovery.color }}
          />
          <p className="text-neutral-700 dark:text-neutral-300">
            <strong className="text-neutral-900 dark:text-white font-semibold">Recommendation: </strong>
            {recovery.nextSessionRecommendation}
          </p>
        </div>

        {/* Toggle Calculation Model Formula */}
        <button
          onClick={() => setShowFormula(!showFormula)}
          className="inline-flex items-center space-x-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer shrink-0 self-end sm:self-auto"
        >
          <Info className="w-3 h-3 text-neutral-400" />
          <span>{showFormula ? 'Hide Formula' : 'How this is calculated'}</span>
          {showFormula ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expandable Mathematical Model Explanation */}
      {showFormula && (
        <div className="mt-3 p-3.5 rounded-xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 space-y-1.5 animate-in fade-in duration-200">
          <div className="font-semibold text-neutral-900 dark:text-white flex items-center space-x-1.5">
            <span>Deterministic Sports Science Formula (No AI)</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            1. <strong>Training Stress Load (TSL)</strong> = <code className="text-neutral-900 dark:text-white font-mono bg-neutral-100 dark:bg-neutral-900 px-1 py-0.5 rounded-sm">(DurationMin × 0.85 + DistanceKm × 2.6) × IntensityMultiplier × HRFactor</code>.
          </p>
          <p className="text-[11px] leading-relaxed">
            2. <strong>Recommended Recovery Window</strong> = <code className="text-neutral-900 dark:text-white font-mono bg-neutral-100 dark:bg-neutral-900 px-1 py-0.5 rounded-sm">TSL × 0.46 + 4 hours</code> (clamped to 12h min, 72h max).
          </p>
          <p className="text-[11px] leading-relaxed">
            3. <strong>Cellular Recovery Curve</strong> = <code className="text-neutral-900 dark:text-white font-mono bg-neutral-100 dark:bg-neutral-900 px-1 py-0.5 rounded-sm">Math.min(100, (ElapsedHours / WindowHours)^0.85 × 100)</code>.
          </p>
        </div>
      )}
    </div>
  );
};
