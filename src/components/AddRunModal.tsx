import React, { useState } from 'react';
import { RunRecord, RunType } from '../types/running';
import {
  formatDuration,
  parseDuration,
  calculatePaceSecPerKm,
  formatPace,
  parsePace,
  calculate6kEquivalent,
  calculateTargetDistanceEquivalent,
  calculateIntervalMetrics,
} from '../utils/runningCalculations';
import { X, Plus, Zap, Clock, Target, Mountain } from 'lucide-react';

interface AddRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSaveRun: (run: RunRecord) => void;
  unit: 'km' | 'miles';
  targetDistanceKm?: number;
  savedDefaultInterval?: {
    targetIntervalPaceSecPerKm?: number;
    repDistanceMeters?: number;
    restDurationSeconds?: number;
    repCount?: number;
  };
}

export const AddRunModal: React.FC<AddRunModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSaveRun,
  unit,
  targetDistanceKm = 6.0,
  savedDefaultInterval,
}) => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState<string>('');
  const [distanceKm, setDistanceKm] = useState<string>('');
  const [durationStr, setDurationStr] = useState<string>('');
  const [runType, setRunType] = useState<RunType>('Aerobic');
  const [avgHeartRate, setAvgHeartRate] = useState<string>('');
  const [maxHeartRate, setMaxHeartRate] = useState<string>('');
  const [avgCadence, setAvgCadence] = useState<string>('');
  const [elevationGain, setElevationGain] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Retrieve cached local defaults if available
  const initialDefaultInterval = (() => {
    try {
      const saved = localStorage.getItem('xc_default_interval_profile');
      if (saved) return { ...JSON.parse(saved), ...savedDefaultInterval };
    } catch {
      // fallback
    }
    return savedDefaultInterval || {};
  })();

  const formatPaceFromSec = (sec?: number) => {
    if (!sec || sec <= 0) return '';
    const paceVal = unit === 'miles' ? sec * 1.60934 : sec;
    const m = Math.floor(paceVal / 60);
    const s = Math.round(paceVal % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Interval & Rest Calibration State
  const [isIntervalWorkout, setIsIntervalWorkout] = useState<boolean>(false);
  const [targetIntervalPaceStr, setTargetIntervalPaceStr] = useState<string>(
    formatPaceFromSec(initialDefaultInterval.targetIntervalPaceSecPerKm)
  );
  const [repCount, setRepCount] = useState<string>(
    String(initialDefaultInterval.repCount || 5)
  );
  const [repDistanceMeters, setRepDistanceMeters] = useState<string>(
    String(initialDefaultInterval.repDistanceMeters || 1000)
  );
  const [restDurationSeconds, setRestDurationSeconds] = useState<string>(
    String(initialDefaultInterval.restDurationSeconds !== undefined ? initialDefaultInterval.restDurationSeconds : 90)
  );

  if (!isOpen) return null;

  const rawDist = parseFloat(distanceKm) || 0;
  // If unit is miles, convert user input to km for internal standard representation
  const distNum = unit === 'miles' ? rawDist * 1.60934 : rawDist;
  const durationSec = parseDuration(durationStr);
  const avgPaceSec = calculatePaceSecPerKm(distNum, durationSec);
  const eq6kSec = calculate6kEquivalent(distNum, durationSec);
  const eqTargetSec = calculateTargetDistanceEquivalent(distNum, durationSec, targetDistanceKm);

  // Interval calculations
  const parsedTargetPaceSec = targetIntervalPaceStr.trim() ? parsePace(targetIntervalPaceStr, unit) : undefined;
  const parsedReps = parseInt(repCount, 10) || 1;
  const parsedRepDist = parseInt(repDistanceMeters, 10) || 1000;
  const parsedRestSec = parseInt(restDurationSeconds, 10) || 0;

  const intervalMetrics = (isIntervalWorkout || runType === 'Intervals') && durationSec > 0
    ? calculateIntervalMetrics(
        {
          totalDurationSeconds: durationSec,
          totalDistanceKm: distNum,
          repCount: parsedReps,
          repDistanceMeters: parsedRepDist,
          restDurationSeconds: parsedRestSec,
          targetPaceSecPerKm: parsedTargetPaceSec,
        },
        unit
      )
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (distNum <= 0 || durationSec <= 0) return;

    const finalRunType = (isIntervalWorkout || runType === 'Intervals') ? 'Intervals' : runType;

    const newRun: RunRecord = {
      id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      date,
      title: title.trim() || (finalRunType === 'Intervals' ? 'Track Intervals' : 'Running Workout'),
      distanceKm: Number(distNum.toFixed(2)),
      durationSeconds: durationSec,
      averagePaceSecPerKm: Math.round(avgPaceSec),
      best6kTimeSeconds: eq6kSec,
      targetEquivalentSeconds: eqTargetSec,
      runType: finalRunType,
      avgHeartRate: avgHeartRate ? parseInt(avgHeartRate, 10) : undefined,
      maxHeartRate: maxHeartRate ? parseInt(maxHeartRate, 10) : undefined,
      avgCadence: avgCadence ? parseInt(avgCadence, 10) : undefined,
      elevationGainMeters: elevationGain ? parseInt(elevationGain, 10) : undefined,
      source: 'manual',
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    if (intervalMetrics) {
      newRun.targetIntervalPaceSecPerKm = parsedTargetPaceSec;
      newRun.activeIntervalPaceSecPerKm = intervalMetrics.activeIntervalPaceSecPerKm;
      newRun.repCount = parsedReps;
      newRun.repDistanceMeters = parsedRepDist;
      newRun.restDurationSeconds = parsedRestSec;
      newRun.totalRestSeconds = intervalMetrics.totalRestSeconds;
      newRun.intervalDetails = {
        repCount: parsedReps,
        repDistanceMeters: parsedRepDist,
        restDurationSeconds: parsedRestSec,
        totalRestSeconds: intervalMetrics.totalRestSeconds,
        targetPaceSecPerKm: parsedTargetPaceSec,
        activeIntervalPaceSecPerKm: intervalMetrics.activeIntervalPaceSecPerKm,
        activeWorkDurationSeconds: intervalMetrics.activeWorkDurationSeconds,
        workDistanceKm: intervalMetrics.workDistanceKm,
      };
    }

    onSaveRun(newRun);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
            Log Workout
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#30d158]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Workout Type
              </label>
              <select
                value={runType}
                onChange={(e) => setRunType(e.target.value as RunType)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#30d158]"
              >
                <option value="Time Trial">Time Trial</option>
                <option value="6K Time Trial">6K Time Trial</option>
                <option value="Race">Race</option>
                <option value="Tempo">Tempo / Threshold</option>
                <option value="Intervals">Track / Speed Intervals</option>
                <option value="Hill Repeats">Hill Repeats / Incline Power</option>
                <option value="Hill Run">Hill Run / Rolling Hills</option>
                <option value="Long Run">Long Run</option>
                <option value="Easy">Easy / Aerobic</option>
                <option value="Recovery">Active Recovery</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Run title (e.g. Afternoon Run)"
              className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#30d158]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Distance ({unit})
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                required
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="0.0"
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white tabular-nums focus:outline-none focus:border-[#30d158]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Duration (MM:SS)
              </label>
              <input
                type="text"
                required
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
                placeholder="MM:SS"
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white tabular-nums focus:outline-none focus:border-[#30d158]"
              />
            </div>
          </div>

          {/* Interval Workout Toggle & Calibration Section */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                const next = !isIntervalWorkout;
                setIsIntervalWorkout(next);
                if (next && runType !== 'Intervals') {
                  setRunType('Intervals');
                }
              }}
              className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                isIntervalWorkout || runType === 'Intervals'
                  ? 'bg-[#0593C6]/10 border-[#0593C6]/30 text-neutral-900 dark:text-white'
                  : 'bg-neutral-50 dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Zap className={`w-4 h-4 ${isIntervalWorkout || runType === 'Intervals' ? 'text-[#0593C6]' : 'text-neutral-400'}`} />
                <span className="text-xs font-semibold">
                  Interval Workout & Rest Calibration
                </span>
              </div>
              <span className="text-[11px] font-semibold text-[#0593C6]">
                {isIntervalWorkout || runType === 'Intervals' ? 'Rest Stripping Active' : '+ Strip Rest / Add Aimed Pace'}
              </span>
            </button>
          </div>

          {/* Explicit Hill Workout Option Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                if (runType === 'Hill Repeats' || runType === 'Hill Run') {
                  setRunType('Aerobic');
                } else {
                  setRunType('Hill Repeats');
                }
              }}
              className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                runType === 'Hill Repeats' || runType === 'Hill Run'
                  ? 'bg-amber-500/10 border-amber-500/35 text-amber-900 dark:text-amber-200 shadow-2xs'
                  : 'bg-neutral-50 dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Mountain className={`w-4 h-4 ${runType === 'Hill Repeats' || runType === 'Hill Run' ? 'text-amber-500' : 'text-neutral-400'}`} />
                <span className="text-xs font-semibold">
                  Option: Label as Hill Workout
                </span>
              </div>
              <span className={`text-[11px] font-bold ${runType === 'Hill Repeats' || runType === 'Hill Run' ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-400'}`}>
                {runType === 'Hill Repeats' || runType === 'Hill Run' ? '✓ Hill Workout Active' : '+ Mark as Hill Workout'}
              </span>
            </button>
          </div>

          {(isIntervalWorkout || runType === 'Intervals') && (
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-black/40 border border-[#0593C6]/30 space-y-3">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-neutral-900 dark:text-white">
                <Target className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Interval Calibration Parameters</span>
              </div>

              {/* Aimed Pace */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Aimed Interval Target Pace ({unit === 'miles' ? 'MM:SS /mi' : 'MM:SS /km'})
                </label>
                <input
                  type="text"
                  value={targetIntervalPaceStr}
                  onChange={(e) => setTargetIntervalPaceStr(e.target.value)}
                  placeholder={unit === 'miles' ? 'e.g. 5:35' : 'e.g. 3:30'}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-mono font-semibold text-neutral-900 dark:text-white focus:outline-none focus:border-[#10B981]"
                />
              </div>

              {/* Reps & Rep Distance */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Repetitions / Sets
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={repCount}
                    onChange={(e) => setRepCount(e.target.value)}
                    placeholder="5"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Distance Per Set (meters)
                  </label>
                  <input
                    type="number"
                    step="50"
                    min="50"
                    value={repDistanceMeters}
                    onChange={(e) => setRepDistanceMeters(e.target.value)}
                    placeholder="1000"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              {/* Rest Duration */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Rest Duration Between Sets (seconds)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={restDurationSeconds}
                  onChange={(e) => setRestDurationSeconds(e.target.value)}
                  placeholder="90"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white tabular-nums"
                />
              </div>

              {/* Live Interval Calculation */}
              {intervalMetrics && (
                <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-[#10B981]/30 text-xs tabular-nums space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-neutral-400">Rest Excluded</span>
                    <span className="font-bold text-neutral-700 dark:text-neutral-300">
                      -{formatDuration(intervalMetrics.totalRestSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-[#10B981]">True Active Interval Pace</span>
                    <span className="font-extrabold text-[#10B981]">
                      {intervalMetrics.activePaceFormatted}
                    </span>
                  </div>
                  {intervalMetrics.paceDifferenceSeconds !== undefined && (
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500">Target Pace ({intervalMetrics.targetPaceFormatted})</span>
                      <span className={`font-semibold ${intervalMetrics.isPaceMet ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {intervalMetrics.isPaceMet
                          ? `${Math.abs(intervalMetrics.paceDifferenceSeconds)}s/km faster`
                          : `${intervalMetrics.paceDifferenceSeconds}s/km off`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Computed Metrics Live Preview */}
          {distNum > 0 && durationSec > 0 && !intervalMetrics && (
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-black/50 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs tabular-nums">
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase">Calculated Pace</span>
                <span className="text-neutral-900 dark:text-white font-semibold">
                  {formatPace(avgPaceSec, unit)}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase">{targetDistanceKm} km Equivalent</span>
                <span className="text-[#30d158] font-bold">{formatDuration(eqTargetSec)}</span>
              </div>
            </div>
          )}

          {/* Garmin Sensor Telemetry (Optional) */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Avg HR (bpm)
              </label>
              <input
                type="number"
                min="40"
                max="230"
                value={avgHeartRate}
                onChange={(e) => setAvgHeartRate(e.target.value)}
                placeholder="Optional"
                className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Cadence (spm)
              </label>
              <input
                type="number"
                min="100"
                max="240"
                value={avgCadence}
                onChange={(e) => setAvgCadence(e.target.value)}
                placeholder="Optional"
                className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Elevation (m)
              </label>
              <input
                type="number"
                min="0"
                value={elevationGain}
                onChange={(e) => setElevationGain(e.target.value)}
                placeholder="Optional"
                className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Turf conditions, pacing feel..."
              className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#30d158]"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full text-xs font-semibold text-black bg-[#30d158] hover:bg-[#28cd41] transition-colors cursor-pointer"
            >
              Save Workout
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
