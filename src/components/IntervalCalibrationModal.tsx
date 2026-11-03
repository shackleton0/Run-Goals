import React, { useState, useEffect } from 'react';
import { RunRecord } from '../types/running';
import {
  calculateIntervalMetrics,
  formatDuration,
  formatPace,
  parsePace,
  KM_TO_MILES,
  MILES_TO_KM,
} from '../utils/runningCalculations';
import { X, Zap, Clock, Target, Check, RotateCcw, AlertCircle } from 'lucide-react';

interface IntervalCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  run: RunRecord | null;
  unit: 'km' | 'miles';
  onSaveInterval: (runId: string, updatedFields: Partial<RunRecord>) => void;
  savedDefaultInterval?: {
    targetIntervalPaceSecPerKm?: number;
    repDistanceMeters?: number;
    restDurationSeconds?: number;
    repCount?: number;
  };
  onSaveDefaultInterval?: (defaults: {
    targetIntervalPaceSecPerKm?: number;
    repDistanceMeters?: number;
    restDurationSeconds?: number;
    repCount?: number;
  }) => void;
}

const LOCAL_STORAGE_INTERVAL_DEFAULTS_KEY = 'xc_default_interval_profile';

const COMMON_REP_COUNTS = [3, 4, 5, 6, 8, 10];
const COMMON_DISTANCES = [
  { label: '400m', meters: 400 },
  { label: '800m', meters: 800 },
  { label: '1000m (1K)', meters: 1000 },
  { label: '1200m', meters: 1200 },
  { label: '1600m (Mile)', meters: 1600 },
  { label: '2000m (2K)', meters: 2000 },
];
const COMMON_RESTS = [
  { label: '30s', seconds: 30 },
  { label: '45s', seconds: 45 },
  { label: '60s (1m)', seconds: 60 },
  { label: '90s (1:30)', seconds: 90 },
  { label: '120s (2m)', seconds: 120 },
  { label: '180s (3m)', seconds: 180 },
];

export const IntervalCalibrationModal: React.FC<IntervalCalibrationModalProps> = ({
  isOpen,
  onClose,
  run,
  unit,
  onSaveInterval,
  savedDefaultInterval,
  onSaveDefaultInterval,
}) => {
  if (!isOpen || !run) return null;

  // Retrieve cached local defaults if available
  const cachedDefaults = (() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_INTERVAL_DEFAULTS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return null;
  })();

  const effectiveDefaults = {
    ...cachedDefaults,
    ...savedDefaultInterval,
  };

  // Initialize from existing run metrics or saved default preferences or reasonable heuristics
  const initialReps =
    run.repCount ||
    effectiveDefaults.repCount ||
    (run.distanceKm >= 5 ? 5 : Math.max(3, Math.round(run.distanceKm)));

  const initialDistance =
    run.repDistanceMeters ||
    effectiveDefaults.repDistanceMeters ||
    1000;

  const initialRest =
    run.restDurationSeconds !== undefined
      ? run.restDurationSeconds
      : effectiveDefaults.restDurationSeconds !== undefined
      ? effectiveDefaults.restDurationSeconds
      : 90;

  // Format initial target pace
  const initialTargetSec = run.targetIntervalPaceSecPerKm || effectiveDefaults.targetIntervalPaceSecPerKm;
  let initialTargetPaceStr = '';
  if (initialTargetSec && initialTargetSec > 0) {
    const paceToFormat = unit === 'miles' ? initialTargetSec * MILES_TO_KM : initialTargetSec;
    const m = Math.floor(paceToFormat / 60);
    const s = Math.round(paceToFormat % 60);
    initialTargetPaceStr = `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  const [repCount, setRepCount] = useState<number>(initialReps);
  const [repDistanceMeters, setRepDistanceMeters] = useState<number>(initialDistance);
  const [restDurationSeconds, setRestDurationSeconds] = useState<number>(initialRest);
  const [targetPaceStr, setTargetPaceStr] = useState<string>(initialTargetPaceStr);
  const [includeFinalRest, setIncludeFinalRest] = useState<boolean>(false);
  const [rememberForFuture, setRememberForFuture] = useState<boolean>(true);

  // Parse target pace
  let targetPaceSecPerKm: number | undefined = undefined;
  if (targetPaceStr.trim()) {
    const parsedTarget = parsePace(targetPaceStr, unit);
    if (parsedTarget && parsedTarget > 0) {
      targetPaceSecPerKm = parsedTarget;
    }
  }

  // Calculate total rest
  const restMultiplier = includeFinalRest ? repCount : Math.max(1, repCount - 1);
  const totalRestSec = restMultiplier * restDurationSeconds;

  // Live interval metrics
  const metrics = calculateIntervalMetrics(
    {
      totalDurationSeconds: run.durationSeconds,
      totalDistanceKm: run.distanceKm,
      repCount,
      repDistanceMeters,
      restDurationSeconds,
      totalRestSeconds: totalRestSec,
      targetPaceSecPerKm,
    },
    unit
  );

  const handleSave = () => {
    const intervalDetails = {
      repCount,
      repDistanceMeters,
      restDurationSeconds,
      totalRestSeconds: metrics.totalRestSeconds,
      targetPaceSecPerKm,
      activeIntervalPaceSecPerKm: metrics.activeIntervalPaceSecPerKm,
      activeWorkDurationSeconds: metrics.activeWorkDurationSeconds,
      workDistanceKm: metrics.workDistanceKm,
    };

    onSaveInterval(run.id, {
      runType: 'Intervals',
      targetIntervalPaceSecPerKm: targetPaceSecPerKm,
      activeIntervalPaceSecPerKm: metrics.activeIntervalPaceSecPerKm,
      repCount,
      repDistanceMeters,
      restDurationSeconds,
      totalRestSeconds: metrics.totalRestSeconds,
      intervalDetails,
    });

    // Save as defaults for future interval sessions & uploads
    if (rememberForFuture) {
      const defaultsToSave = {
        targetIntervalPaceSecPerKm: targetPaceSecPerKm,
        repDistanceMeters,
        restDurationSeconds,
        repCount,
      };
      localStorage.setItem(LOCAL_STORAGE_INTERVAL_DEFAULTS_KEY, JSON.stringify(defaultsToSave));
      if (onSaveDefaultInterval) {
        onSaveDefaultInterval(defaultsToSave);
      }
    }

    onClose();
  };

  const handleResetToGarmin = () => {
    onSaveInterval(run.id, {
      targetIntervalPaceSecPerKm: undefined,
      activeIntervalPaceSecPerKm: undefined,
      repCount: undefined,
      repDistanceMeters: undefined,
      restDurationSeconds: undefined,
      totalRestSeconds: undefined,
      intervalDetails: undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-[#18232c] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0593C6]/15 text-[#0593C6] flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
                Calibrate Interval Workout & Rest
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {run.title} · Total time {formatDuration(run.durationSeconds)} ({run.distanceKm} km recorded)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1 text-xs">
          {/* Explanation Alert */}
          <div className="p-3 rounded-xl bg-[#0593C6]/10 border border-[#0593C6]/20 text-[#0593C6] dark:text-[#38bdf8] flex items-start space-x-2">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <span className="font-semibold block">Strip Rest Periods From Average Pace</span>
              <span className="text-[11px] opacity-90 block">
                Garmin records your entire session including recovery rests, artificially lowering your average pace.
                Enter your interval sets and rest time below to calculate your true active interval pace.
              </span>
            </div>
          </div>

          {/* 1. Target Aimed Pace */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5">
              <Target className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Aimed Interval Pace ({unit === 'miles' ? 'MM:SS /mi' : 'MM:SS /km'})</span>
            </label>
            <input
              type="text"
              value={targetPaceStr}
              onChange={(e) => setTargetPaceStr(e.target.value)}
              placeholder={unit === 'miles' ? 'e.g. 5:35' : 'e.g. 3:30'}
              className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white font-mono font-semibold focus:outline-none focus:border-[#10B981]"
            />
            <span className="text-[10px] text-neutral-400">
              The pace you were aiming to hit during active repetitions (saved for future comparison).
            </span>
          </div>

          {/* 2. Rep Count */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-neutral-800 dark:text-neutral-200">
                Number of Repetitions / Sets
              </label>
              <span className="font-bold text-neutral-900 dark:text-white tabular-nums">
                {repCount} sets
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {COMMON_REP_COUNTS.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setRepCount(num)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    repCount === num
                      ? 'bg-[#0593C6] text-white shadow-xs'
                      : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                  }`}
                >
                  {num}
                </button>
              ))}
              <input
                type="number"
                min="1"
                max="50"
                value={repCount}
                onChange={(e) => setRepCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-16 px-2 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center font-bold text-neutral-900 dark:text-white"
                title="Custom rep count"
              />
            </div>
          </div>

          {/* 3. Distance Per Set */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-neutral-800 dark:text-neutral-200">
                Distance Per Set
              </label>
              <span className="font-bold text-neutral-900 dark:text-white tabular-nums">
                {repDistanceMeters}m ({(repDistanceMeters / 1000).toFixed(2)} km)
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {COMMON_DISTANCES.map((d) => (
                <button
                  key={d.meters}
                  type="button"
                  onClick={() => setRepDistanceMeters(d.meters)}
                  className={`py-1.5 px-2 rounded-lg font-semibold text-center transition-all cursor-pointer ${
                    repDistanceMeters === d.meters
                      ? 'bg-[#0593C6] text-white shadow-xs'
                      : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="pt-1 flex items-center space-x-2">
              <span className="text-[11px] text-neutral-500">Custom distance:</span>
              <input
                type="number"
                step="50"
                min="50"
                value={repDistanceMeters}
                onChange={(e) => setRepDistanceMeters(Math.max(50, parseInt(e.target.value, 10) || 50))}
                className="w-24 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white font-semibold"
              />
              <span className="text-[11px] text-neutral-500">meters</span>
            </div>
          </div>

          {/* 4. Rest Duration Per Set */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-neutral-800 dark:text-neutral-200">
                Rest Duration Per Set
              </label>
              <span className="font-bold text-neutral-900 dark:text-white tabular-nums">
                {restDurationSeconds}s ({formatDuration(restDurationSeconds)})
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {COMMON_RESTS.map((r) => (
                <button
                  key={r.seconds}
                  type="button"
                  onClick={() => setRestDurationSeconds(r.seconds)}
                  className={`py-1.5 px-2 rounded-lg font-semibold text-center transition-all cursor-pointer ${
                    restDurationSeconds === r.seconds
                      ? 'bg-[#0593C6] text-white shadow-xs'
                      : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="pt-1 flex items-center space-x-2">
              <span className="text-[11px] text-neutral-500">Custom rest:</span>
              <input
                type="number"
                min="0"
                step="5"
                value={restDurationSeconds}
                onChange={(e) => setRestDurationSeconds(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-20 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white font-semibold"
              />
              <span className="text-[11px] text-neutral-500">seconds per rest</span>
            </div>
          </div>

          {/* Live Calculated Metric Comparison Card */}
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-black/50 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-900 dark:text-white uppercase tracking-wider text-[11px]">
                Active Interval Pace Calculation
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                Rest Deducted: -{formatDuration(metrics.totalRestSeconds)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 tabular-nums">
              <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800">
                <span className="text-[10px] text-neutral-400 block uppercase">Garmin Raw Pace</span>
                <span className="font-semibold text-neutral-500 line-through">
                  {formatPace(run.averagePaceSecPerKm, unit)}
                </span>
                <span className="text-[10px] text-neutral-400 block mt-0.5">Ruined by rest</span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-[#10B981]/40 shadow-xs">
                <span className="text-[10px] text-[#10B981] font-bold block uppercase">
                  True Active Pace
                </span>
                <span className="font-extrabold text-sm text-[#10B981]">
                  {metrics.activePaceFormatted}
                </span>
                <span className="text-[10px] text-neutral-500 block mt-0.5">
                  {metrics.summaryText}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-neutral-400 block uppercase">Target Pace</span>
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {metrics.targetPaceFormatted}
                </span>
                {metrics.paceDifferenceSeconds !== undefined && (
                  <span
                    className={`text-[10px] font-bold block mt-0.5 ${
                      metrics.isPaceMet ? 'text-emerald-500' : 'text-amber-500'
                    }`}
                  >
                    {metrics.isPaceMet
                      ? `${Math.abs(metrics.paceDifferenceSeconds)}s/km faster than target!`
                      : `${metrics.paceDifferenceSeconds}s/km slower than target`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Remember defaults for future uploads & workouts */}
          <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800">
            <input
              id="remember-interval-defaults"
              type="checkbox"
              checked={rememberForFuture}
              onChange={(e) => setRememberForFuture(e.target.checked)}
              className="w-4 h-4 rounded text-[#10B981] accent-[#10B981] cursor-pointer"
            />
            <label
              htmlFor="remember-interval-defaults"
              className="text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer select-none"
            >
              <strong className="text-neutral-900 dark:text-white block font-semibold">
                Save as default interval profile for future uploads & sessions
              </strong>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block mt-0.5">
                Automatically pre-fills your aimed pace ({targetPaceStr || 'None'}), {repCount}×{repDistanceMeters}m sets, and {restDurationSeconds}s rest on future Garmin uploads.
              </span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={handleResetToGarmin}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Revert to Raw Garmin Pace</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-full text-xs font-semibold bg-[#10B981] hover:bg-[#0ea372] text-white transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Save Interval Pace</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
