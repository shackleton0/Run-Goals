import React, { useState } from 'react';
import { RunRecord, WeeklyStat, AdherenceSummary } from '../types/running';
import {
  formatDuration,
  formatPace,
  KM_TO_MILES,
  MILES_TO_KM,
  isIntervalRun,
  isAerobicRun,
  getCurrentWeekRange,
  isRunInCurrentWeek,
  getSuggestedWeeklySchedule,
} from '../utils/runningCalculations';
import {
  Check,
  Plus,
  Calendar,
  Info,
  Zap,
  Gauge,
  Heart,
  Activity,
  Target,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

interface WeeklyAdherenceCardProps {
  weeklyStats: WeeklyStat[];
  adherence: AdherenceSummary;
  onOpenAddRun: () => void;
  unit: 'km' | 'miles';
  weeklyDistanceGoalKm?: number;
  weeklyRunGoal?: number;
  runs?: RunRecord[];
  onUpdateWeeklyDistanceGoal?: (newKm: number) => void;
  onOpenSettings?: () => void;
}

const KM_PRESETS = [15, 20, 25, 30, 35, 40, 50];
const MILES_PRESETS = [10, 15, 20, 25, 30];

export const WeeklyAdherenceCard: React.FC<WeeklyAdherenceCardProps> = ({
  weeklyStats,
  adherence,
  onOpenAddRun,
  unit,
  weeklyDistanceGoalKm,
  weeklyRunGoal = 3,
  runs,
  onUpdateWeeklyDistanceGoal,
  onOpenSettings,
}) => {
  const [showTrainingGuide, setShowTrainingGuide] = useState(false);
  const [isEditingCustom, setIsEditingCustom] = useState(false);

  // Default to 25 km (~15.5 mi) if not yet explicitly selected
  const effectiveWeeklyGoalKm = weeklyDistanceGoalKm && weeklyDistanceGoalKm > 0 ? weeklyDistanceGoalKm : 25;
  const [customInputStr, setCustomInputStr] = useState<string>(
    unit === 'miles' ? (effectiveWeeklyGoalKm * KM_TO_MILES).toFixed(1) : effectiveWeeklyGoalKm.toString()
  );

  // Compute Current Week Monday - Sunday Date Range in runner's local time
  const now = new Date();
  const { isoWeekKey, formattedRange, formattedMonday, formattedSunday } = getCurrentWeekRange(now);

  // Strictly Current Week Runs: ONLY runs that occurred in the current week (Mon – Sun)
  const currentWeekStat = weeklyStats.find((s) => s.weekKey === isoWeekKey);
  const currentWeekRuns: RunRecord[] = runs
    ? runs.filter((r) => isRunInCurrentWeek(r.date, now))
    : currentWeekStat
    ? currentWeekStat.runs
    : [];

  const currentWeekDistKm = currentWeekRuns.reduce((sum, r) => sum + r.distanceKm, 0);
  const currentWeekDistFormatted =
    unit === 'miles'
      ? (currentWeekDistKm * KM_TO_MILES).toFixed(1)
      : currentWeekDistKm.toFixed(1);

  const weeklyDistGoalFormatted =
    unit === 'miles'
      ? (effectiveWeeklyGoalKm * KM_TO_MILES).toFixed(1)
      : effectiveWeeklyGoalKm.toFixed(1);

  // Generate suggested schedule based on chosen weekly km and real data of improvement
  const schedulePlan = getSuggestedWeeklySchedule(
    effectiveWeeklyGoalKm,
    weeklyRunGoal,
    unit,
    6.0,
    runs
  );

  // The 3 primary weekly run slots:
  const expectedSlots = [
    {
      id: 'interval' as const,
      slotNumber: 1,
      name: 'Interval',
      expectedLabel: 'Speed / Intervals',
      expectedDescription: 'Repetitions at 6K goal race pace to develop VO2 max power',
      accentColor: 'text-[#10B981]',
      badgeBg: 'bg-[#10B981]/15 text-[#10B981] dark:text-[#34d399]',
      icon: Zap,
      matcher: (r: RunRecord) =>
        r.runType === 'Interval Training' ||
        r.runType === 'Intervals' ||
        isIntervalRun(r.runType) ||
        /interval|track|repeat|speed/i.test(r.title),
    },
    {
      id: 'tempo' as const,
      slotNumber: 2,
      name: '6K Threshold Tempo',
      expectedLabel: '6K Threshold Tempo',
      expectedDescription: 'Sustained run at lactate threshold to elevate aerobic stamina',
      accentColor: 'text-[#0593C6]',
      badgeBg: 'bg-[#0593C6]/15 text-[#0593C6] dark:text-[#38bdf8]',
      icon: Gauge,
      matcher: (r: RunRecord) =>
        r.runType === 'Tempo' ||
        r.runType === 'Time Trial' ||
        r.runType === '6K Time Trial' ||
        r.runType === 'Race' ||
        /tempo|threshold|trial|race/i.test(r.title),
    },
    {
      id: 'long_run' as const,
      slotNumber: 3,
      name: 'Aerobic Long Run',
      expectedLabel: 'Aerobic Long Run',
      expectedDescription: 'Continuous aerobic volume building late-race stamina',
      accentColor: 'text-[#0593C6]',
      badgeBg: 'bg-[#0593C6]/15 text-[#0593C6] dark:text-[#38bdf8]',
      icon: Heart,
      matcher: (r: RunRecord) =>
        r.runType === 'Long Run' ||
        (r.distanceKm >= 8 && isAerobicRun(r.runType)) ||
        /long/i.test(r.title) ||
        (r.runType === 'Aerobic' && r.distanceKm >= 7),
    },
  ];

  // Assign current week runs to the slots
  const assignedSlots: {
    slot: (typeof expectedSlots)[0];
    run: RunRecord | null;
    suggestedPlan: (typeof schedulePlan.slots)[0] | undefined;
  }[] = [];
  const usedRunIds = new Set<string>();

  expectedSlots.forEach((slot) => {
    const matched = currentWeekRuns.find(
      (r) => !usedRunIds.has(r.id) && slot.matcher(r)
    );
    const suggestedPlan = schedulePlan.slots.find((s) => s.id === slot.id);
    if (matched) {
      usedRunIds.add(matched.id);
      assignedSlots.push({ slot, run: matched, suggestedPlan });
    } else {
      assignedSlots.push({ slot, run: null, suggestedPlan });
    }
  });

  const additionalWeekRuns = currentWeekRuns.filter((r) => !usedRunIds.has(r.id));
  const completedCount = assignedSlots.filter((s) => !!s.run).length;
  const progressPct = Math.min(100, Math.round((currentWeekDistKm / effectiveWeeklyGoalKm) * 100));

  const handleSelectPreset = (val: number) => {
    const kmVal = unit === 'miles' ? val * MILES_TO_KM : val;
    setIsEditingCustom(false);
    setCustomInputStr(val.toString());
    if (onUpdateWeeklyDistanceGoal) {
      onUpdateWeeklyDistanceGoal(Number(kmVal.toFixed(1)));
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(customInputStr);
    if (!isNaN(parsed) && parsed > 0) {
      const kmVal = unit === 'miles' ? parsed * MILES_TO_KM : parsed;
      setIsEditingCustom(false);
      if (onUpdateWeeklyDistanceGoal) {
        onUpdateWeeklyDistanceGoal(Number(kmVal.toFixed(1)));
      }
    }
  };

  const handleStepKm = (delta: number) => {
    const currentDisplayVal = unit === 'miles' ? effectiveWeeklyGoalKm * KM_TO_MILES : effectiveWeeklyGoalKm;
    const nextVal = Math.max(5, Math.round(currentDisplayVal + delta));
    handleSelectPreset(nextVal);
  };

  const presets = unit === 'miles' ? MILES_PRESETS : KM_PRESETS;
  const currentPresetMatch = presets.find((p) => {
    const targetInUnit = unit === 'miles' ? effectiveWeeklyGoalKm * KM_TO_MILES : effectiveWeeklyGoalKm;
    return Math.abs(p - targetInUnit) < 0.8;
  });

  return (
    <div className="rounded-2xl bg-[#FCFFFF] dark:bg-[#12222f] border border-neutral-200/90 dark:border-neutral-800 shadow-xs p-5 sm:p-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-[#FCFFFF] tracking-tight">
              Weekly Training Schedule
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0593C6]/10 text-[#0593C6]">
              {completedCount} of 3 Categories Completed
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] dark:text-[#34d399] tabular-nums">
              {currentWeekDistFormatted} / {weeklyDistGoalFormatted} {unit} logged ({progressPct}%)
            </span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            <Calendar className="w-3.5 h-3.5 text-[#0593C6]" />
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              Current Week (Mon – Sun):
            </span>
            <span className="text-[#0593C6] font-semibold">{formattedRange}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowTrainingGuide(!showTrainingGuide)}
          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Info className="w-3.5 h-3.5 text-[#0593C6]" />
          <span>{showTrainingGuide ? 'Hide Training Guide' : 'Training Blueprint'}</span>
        </button>
      </div>

      {/* Interactive Weekly Distance Goal Selector Bar */}
      <div className="mb-5 p-3.5 sm:p-4 rounded-xl bg-neutral-50 dark:bg-[#0c1822] border border-neutral-200/80 dark:border-neutral-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-[#0593C6]/10 text-[#0593C6] flex items-center justify-center">
              <Target className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                  Weekly Distance Target:
                </span>
                <span className="text-sm font-extrabold text-[#0593C6] dark:text-[#38bdf8] tabular-nums">
                  {weeklyDistGoalFormatted} {unit}/week
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Select your weekly volume below to get recommended distances for each workout
              </p>
            </div>
          </div>

          {/* Stepper Buttons for quick adjustment */}
          <div className="flex items-center space-x-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleStepKm(unit === 'miles' ? -3 : -5)}
              className="px-2 py-1 rounded-lg bg-white dark:bg-[#12222f] border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
              title="Decrease weekly target"
            >
              -{unit === 'miles' ? '3 mi' : '5 km'}
            </button>
            <button
              type="button"
              onClick={() => handleStepKm(unit === 'miles' ? 3 : 5)}
              className="px-2 py-1 rounded-lg bg-white dark:bg-[#12222f] border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
              title="Increase weekly target"
            >
              +{unit === 'miles' ? '3 mi' : '5 km'}
            </button>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                title="Open detailed goal settings"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Preset Mileage Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mr-1">
            Presets:
          </span>
          {presets.map((p) => {
            const isSelected = currentPresetMatch === p && !isEditingCustom;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer tabular-nums ${
                  isSelected
                    ? 'bg-[#0593C6] text-white shadow-xs'
                    : 'bg-white dark:bg-[#12222f] text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-700/80 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {p} {unit}
              </button>
            );
          })}

          {/* Custom Input Toggle */}
          {isEditingCustom ? (
            <form onSubmit={handleCustomSubmit} className="inline-flex items-center space-x-1.5 ml-1">
              <input
                type="number"
                step="0.5"
                min="5"
                max="250"
                autoFocus
                value={customInputStr}
                onChange={(e) => setCustomInputStr(e.target.value)}
                className="w-16 px-2 py-0.5 rounded-md bg-white dark:bg-black border border-[#0593C6] text-xs font-bold tabular-nums text-neutral-900 dark:text-white focus:outline-none"
              />
              <span className="text-[11px] font-semibold text-neutral-500">{unit}</span>
              <button
                type="submit"
                className="px-2 py-0.5 rounded-md bg-[#0593C6] text-white font-bold text-[11px] cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditingCustom(false)}
                className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer ml-0.5"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsEditingCustom(true);
                setCustomInputStr(
                  unit === 'miles'
                    ? (effectiveWeeklyGoalKm * KM_TO_MILES).toFixed(1)
                    : effectiveWeeklyGoalKm.toString()
                );
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-[#12222f] text-neutral-600 dark:text-neutral-400 border border-neutral-200/80 dark:border-neutral-700/80 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
            >
              Custom...
            </button>
          )}
        </div>

        {/* Volume Progress Bar */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
            <span>Weekly Mileage Progress</span>
            <span className="font-semibold text-neutral-900 dark:text-white">
              {currentWeekDistFormatted} of {weeklyDistGoalFormatted} {unit} ({progressPct}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progressPct >= 100 ? 'bg-[#10B981]' : 'bg-[#0593C6]'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Live Suggested Breakdown Summary */}
        <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Suggested Schedule:
            </span>
            {schedulePlan.slots.map((s) => (
              <span key={s.id} className="inline-flex items-center space-x-1 tabular-nums font-medium text-neutral-700 dark:text-neutral-300">
                <span className="text-neutral-400">·</span>
                <span className="font-semibold text-neutral-900 dark:text-white">{s.name}:</span>
                <span className="text-[#0593C6] font-bold">{s.suggestedDistanceFormatted}</span>
                <span className="text-[10px] text-neutral-400">({s.percentageOfWeekly}%)</span>
              </span>
            ))}
          </div>

          {/* Real Data of Improvement Status Badge */}
          {schedulePlan.improvement.hasEnoughData ? (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real Data: {schedulePlan.improvement.statusText}</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-300/40 dark:border-neutral-700/40">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              <span>Real Improvement: <strong>Not enough data yet</strong></span>
            </span>
          )}
        </div>
      </div>

      {/* Expandable Workout Blueprint */}
      {showTrainingGuide && (
        <div className="mb-5 p-4 rounded-xl bg-[#F2F8FB] dark:bg-[#0e1b25] border border-[#0593C6]/20 dark:border-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 space-y-3 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="font-bold text-neutral-900 dark:text-[#FCFFFF]">
              Recommended Cross Country Training Architecture ({weeklyDistGoalFormatted} {unit}/week)
            </div>
            {schedulePlan.improvement.hasEnoughData ? (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                ✓ Paces calibrated from {schedulePlan.improvement.totalRunsAnalyzed} real workouts
              </span>
            ) : (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                Paces pending: Not enough data yet
              </span>
            )}
          </div>

          {!schedulePlan.improvement.hasEnoughData && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-neutral-700 dark:text-neutral-300">
              <span className="font-semibold text-amber-600 dark:text-amber-400">Not enough data yet:</span>
              <span className="text-[11px] ml-1.5">
                Log at least 2 recorded runs on separate calendar days to establish your personal empirical rate of improvement and unlock adaptive target workout paces.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {schedulePlan.slots.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-lg bg-[#FCFFFF] dark:bg-[#12222f] border border-neutral-200/80 dark:border-neutral-800 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0593C6]">
                    Slot {s.slotNumber}: {s.name}
                  </span>
                  <span className="text-[11px] font-extrabold text-[#10B981] tabular-nums">
                    {s.suggestedDistanceFormatted}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Target Pace:{' '}
                  <strong className="text-neutral-800 dark:text-neutral-200">
                    {s.suggestedPaceFormatted || 'Not enough data yet'}
                  </strong>
                </div>
                <p className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                  {s.structure}
                </p>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  {s.purpose}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exclusively shows the 3 required runs for this current week Mon - Sun */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {assignedSlots.map(({ slot, run, suggestedPlan }) => {
          const isDone = !!run;
          const Icon = slot.icon;
          const suggestedStr = suggestedPlan?.suggestedDistanceFormatted || '';
          const suggestedKm = suggestedPlan?.suggestedDistanceKm || 0;
          const targetPaceStr = suggestedPlan?.suggestedPaceFormatted || 'Not enough data yet';

          if (!isDone) {
            // Distinctly greyed-out card when no run fills this category in the current week
            return (
              <div
                key={slot.id}
                className="p-4 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700/80 bg-neutral-100/60 dark:bg-neutral-900/40 flex flex-col justify-between min-h-[200px] opacity-80 hover:opacity-100 transition-opacity"
              >
                <div>
                  {/* Placeholder Header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center space-x-1.5 text-neutral-400 dark:text-neutral-500">
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        Slot {slot.slotNumber}
                      </span>
                      <span>·</span>
                      <span className="text-xs font-semibold">
                        {slot.name}
                      </span>
                    </div>

                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-200/80 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-300/40 dark:border-neutral-700/40">
                      Not Logged
                    </span>
                  </div>

                  {/* Suggested Distance & Target Pace Highlight Badge */}
                  <div className="mb-2.5 p-2 rounded-lg bg-white/70 dark:bg-black/30 border border-neutral-200/60 dark:border-neutral-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                        Suggested Dist:
                      </span>
                      <span className="text-xs font-extrabold text-[#0593C6] dark:text-[#38bdf8] tabular-nums">
                        {suggestedStr}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
                      <span>Target Pace:</span>
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">
                        {targetPaceStr}
                      </span>
                    </div>
                  </div>

                  {/* Placeholder Body */}
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                      <Icon className="w-3.5 h-3.5 shrink-0 text-neutral-400 dark:text-neutral-500" />
                      <span>{slot.expectedLabel}</span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      {suggestedPlan?.structure || slot.expectedDescription}
                    </p>
                  </div>
                </div>

                {/* Placeholder Footer Action */}
                <div className="pt-3 mt-2 border-t border-dashed border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                    Week of {formattedMonday} – {formattedSunday}
                  </span>
                  <button
                    type="button"
                    onClick={onOpenAddRun}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#0593C6]/10 hover:bg-[#0593C6]/20 text-[#0593C6] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Upload / Log</span>
                  </button>
                </div>
              </div>
            );
          }

          // Completed Slot Box
          const actualKm = run.distanceKm;
          const diffKm = Number((actualKm - suggestedKm).toFixed(1));
          const diffStr =
            unit === 'miles'
              ? `${(diffKm * KM_TO_MILES > 0 ? '+' : '')}${(diffKm * KM_TO_MILES).toFixed(1)} mi`
              : `${diffKm > 0 ? '+' : ''}${diffKm} km`;
          const isOnTarget = Math.abs(diffKm) <= 0.6;

          return (
            <div
              key={slot.id}
              className="p-4 rounded-xl border border-[#0593C6]/30 dark:border-neutral-800 bg-[#FCFFFF] dark:bg-[#12222f] shadow-xs flex flex-col justify-between min-h-[200px] transition-all"
            >
              <div>
                {/* Completed Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Slot {slot.slotNumber}
                    </span>
                    <span className="text-neutral-300 dark:text-neutral-700">·</span>
                    <span className={`text-xs font-bold ${slot.accentColor}`}>
                      {slot.name}
                    </span>
                  </div>

                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#10B981]/15 text-[#10B981]">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Completed</span>
                  </span>
                </div>

                {/* Suggested vs Logged Target Comparison Badge */}
                <div className="mb-2 p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 space-y-1 text-[11px] tabular-nums">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 dark:text-neutral-400">
                      Suggested: <strong className="text-neutral-700 dark:text-neutral-300">{suggestedStr}</strong>
                    </span>
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded ${
                        isOnTarget
                          ? 'bg-[#10B981]/10 text-[#10B981]'
                          : diffKm > 0
                          ? 'bg-[#0593C6]/10 text-[#0593C6]'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {isOnTarget ? '🎯 On Target' : diffStr}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400 pt-0.5 border-t border-neutral-200/40 dark:border-neutral-800/60">
                    <span>Target Pace:</span>
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                      {targetPaceStr}
                    </span>
                  </div>
                </div>

                {/* Completed Body */}
                <div className="space-y-1 mt-1">
                  <div className="font-bold text-sm text-neutral-900 dark:text-[#FCFFFF] truncate">
                    {run.title}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 tabular-nums">
                    <span className="font-extrabold text-neutral-900 dark:text-[#FCFFFF]">
                      {unit === 'miles'
                        ? (run.distanceKm * KM_TO_MILES).toFixed(2)
                        : run.distanceKm}{' '}
                      {unit}
                    </span>
                    <span>·</span>
                    <span>{formatDuration(run.durationSeconds)}</span>
                    <span>·</span>
                    <span className="text-[#0593C6] font-bold">
                      {formatPace(run.averagePaceSecPerKm, unit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Completed Footer */}
              <div className="pt-2.5 mt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                <span className="px-2 py-0.5 rounded-full bg-[#0593C6]/10 text-[#0593C6] font-semibold text-[10px]">
                  {run.runType}
                </span>
                <span>{run.date}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Runs Completed in the Current Week (if any) */}
      {additionalWeekRuns.length > 0 && (
        <div className="mt-4 pt-4 border-t border-neutral-200/80 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-[#0593C6]" />
              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                Additional Runs This Week ({additionalWeekRuns.length})
              </span>
            </div>
            <span className="text-[11px] text-neutral-400">
              Supplementary volume logged in this calendar week
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {additionalWeekRuns.map((r) => (
              <div
                key={r.id}
                className="px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#0e1b25] border border-neutral-200/70 dark:border-neutral-800 flex items-center justify-between text-xs"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-semibold text-neutral-900 dark:text-[#FCFFFF] truncate text-xs">
                    {r.title}
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center space-x-1.5 mt-0.5">
                    <span className="font-medium text-[#0593C6]">{r.runType}</span>
                    <span>·</span>
                    <span>{r.date}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-bold text-neutral-900 dark:text-[#FCFFFF] tabular-nums">
                    {unit === 'miles' ? (r.distanceKm * KM_TO_MILES).toFixed(2) : r.distanceKm} {unit}
                  </div>
                  <div className="text-[11px] text-neutral-400 tabular-nums">
                    {formatDuration(r.durationSeconds)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
