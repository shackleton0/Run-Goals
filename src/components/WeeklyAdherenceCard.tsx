import React, { useState } from 'react';
import { RunRecord, WeeklyStat, AdherenceSummary } from '../types/running';
import {
  formatDuration,
  formatPace,
  KM_TO_MILES,
  MILES_TO_KM,
  isIntervalRun,
  isAerobicRun,
  isHillRun,
  getCurrentWeekRange,
  isRunInCurrentWeek,
  getSuggestedWeeklySchedule,
  calculateMonthlyConsistency,
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
  Mountain,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Flame,
  CalendarDays,
  Sparkles,
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
  runs = [],
  onUpdateWeeklyDistanceGoal,
  onOpenSettings,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // Toggle between Weekly Schedule and Monthly Consistency Analysis
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [monthOffset, setMonthOffset] = useState<number>(0);
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
  const currentWeekRuns: RunRecord[] = runs.length > 0
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

  // Calculate Monthly Training Consistency Analysis
  const monthlyAnalysis = calculateMonthlyConsistency(
    runs,
    effectiveWeeklyGoalKm,
    weeklyRunGoal,
    now,
    monthOffset
  );

  // The 3 primary weekly run slots:
  const expectedSlots = [
    {
      id: 'interval' as const,
      slotNumber: 1,
      name: 'Interval / Hill Repeats',
      expectedLabel: 'Speed / Hill Repeats',
      expectedDescription: 'Repetitions at 6K goal race pace or uphill surges to develop VO2 max power',
      accentColor: 'text-[#10B981]',
      badgeBg: 'bg-[#10B981]/15 text-[#10B981] dark:text-[#34d399]',
      icon: Zap,
      matcher: (r: RunRecord) =>
        r.runType === 'Interval Training' ||
        r.runType === 'Intervals' ||
        r.runType === 'Hill Repeats' ||
        isHillRun(r.runType) ||
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
        r.runType === 'Hill Run' ||
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
    <div className="rounded-2xl bg-[#FCFFFF] dark:bg-[#12222f] border border-neutral-200/90 dark:border-neutral-800 shadow-xs p-4 sm:p-5 transition-colors">
      {/* Clickable Dropdown Header (Resting state shows only title) */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left cursor-pointer group"
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#0593C6]/15 text-[#0593C6] flex items-center justify-center shrink-0">
            {viewMode === 'weekly' ? (
              <Calendar className="w-4 h-4 stroke-[2.2]" />
            ) : (
              <CalendarDays className="w-4 h-4 stroke-[2.2]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-[#FCFFFF] tracking-tight group-hover:text-[#0593C6] transition-colors">
                {viewMode === 'weekly' ? 'Weekly Training Schedule' : 'Monthly Training Consistency'}
              </h2>
              {viewMode === 'weekly' ? (
                <>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0593C6]/10 text-[#0593C6]">
                    {completedCount} of 3 Categories
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] dark:text-[#34d399] tabular-nums hidden sm:inline">
                    {currentWeekDistFormatted} / {weeklyDistGoalFormatted} {unit} ({progressPct}%)
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono">
                    {monthlyAnalysis.consistencyGrade}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0593C6]/10 text-[#0593C6] tabular-nums">
                    {monthlyAnalysis.weeksMetCount} of {monthlyAnalysis.totalWeeksInMonth} Wks Met
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* View Switcher & Dropdown Chevron */}
        <div className="flex items-center space-x-2 shrink-0 ml-2">
          {/* Toggle between Weekly View and Monthly View */}
          <div className="inline-flex p-0.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewMode('weekly');
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                viewMode === 'weekly'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span className="hidden sm:inline">Weekly</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewMode('monthly');
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                viewMode === 'monthly'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="w-3 h-3" />
              <span className="hidden sm:inline">Monthly</span>
            </button>
          </div>

          <div className={`p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* Expanded Content Dropdown */}
      {isExpanded && (
        <div className="pt-4 mt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-5 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <Calendar className="w-3.5 h-3.5 text-[#0593C6]" />
              {viewMode === 'weekly' ? (
                <>
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Current Week (Mon – Sun):
                  </span>
                  <span className="text-[#0593C6] font-semibold">{formattedRange}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Monthly Review:
                  </span>
                  <span className="text-[#0593C6] font-semibold">{monthlyAnalysis.monthTitle}</span>
                </>
              )}
            </div>

            {viewMode === 'weekly' && (
              <button
                type="button"
                onClick={() => setShowTrainingGuide(!showTrainingGuide)}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Info className="w-3.5 h-3.5 text-[#0593C6]" />
                <span>{showTrainingGuide ? 'Hide Guide' : 'Training Blueprint'}</span>
              </button>
            )}
          </div>

      {/* VIEW MODE 1: WEEKLY VIEW */}
      {viewMode === 'weekly' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Interactive Weekly Distance Goal Selector Bar */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-neutral-50 dark:bg-[#0c1822] border border-neutral-200/80 dark:border-neutral-800 space-y-3">
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0593C6] text-white shadow-xs'
                        : 'bg-white dark:bg-[#12222f] text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {p} {unit}
                  </button>
                );
              })}

              {/* Custom Input Option */}
              {isEditingCustom ? (
                <form onSubmit={handleCustomSubmit} className="inline-flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.5"
                    min="5"
                    max="160"
                    value={customInputStr}
                    onChange={(e) => setCustomInputStr(e.target.value)}
                    autoFocus
                    className="w-16 px-2 py-0.5 rounded-lg bg-white dark:bg-[#12222f] border border-[#0593C6] text-xs font-bold text-neutral-900 dark:text-white text-center focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 rounded-lg bg-[#0593C6] text-white text-xs font-bold hover:bg-[#047da8] cursor-pointer"
                  >
                    Set
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingCustom(true)}
                  className="px-2 py-1 rounded-lg text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:underline cursor-pointer"
                >
                  Custom...
                </button>
              )}
            </div>

            {/* Real Data Calibration Status Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-200/60 dark:border-neutral-800/80 text-[11px]">
              <div className="flex items-center space-x-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    schedulePlan.improvement.hasEnoughData ? 'bg-[#10B981]' : 'bg-amber-500'
                  }`}
                />
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  {schedulePlan.improvement.hasEnoughData
                    ? `Adaptive Calibration Active (${schedulePlan.improvement.statusText})`
                    : 'Target Paces: Not enough data yet (log 2+ workouts on separate days)'}
                </span>
              </div>
              <span className="text-neutral-400 text-[10px]">
                {schedulePlan.improvement.basisDescription}
              </span>
            </div>
          </div>

          {/* Training Blueprint Explainer (Expandable) */}
          {showTrainingGuide && (
            <div className="p-4 rounded-xl bg-neutral-50/80 dark:bg-[#0c1822]/80 border border-neutral-200/80 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-neutral-200/60 dark:border-neutral-800 pb-2">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-[#0593C6]" />
                  <span className="font-bold text-neutral-900 dark:text-white">
                    Collegiate 80/20 & XC Hill Training Blueprint
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400">
                  Structured microcycle for {effectiveWeeklyGoalKm} km/week
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-white dark:bg-[#12222f] border border-neutral-200/60 dark:border-neutral-800 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-[#10B981]">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Slot 1: Intervals & Hill Repeats</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    6K race pace repetitions or 6-8 × 200m uphill sprints. Develops biomechanical power, knee drive, and maximal oxygen uptake (VO2 max) with lower impact stress.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-[#12222f] border border-neutral-200/60 dark:border-neutral-800 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-[#0593C6]">
                    <Gauge className="w-3.5 h-3.5" />
                    <span>Slot 2: 6K Threshold Tempo</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Sustained tempo at lactate threshold. Trains your body to buffer acidosis so you can hold fast pace without burning out over the final 2K.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-[#12222f] border border-neutral-200/60 dark:border-neutral-800 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-[#8B5CF6]">
                    <Heart className="w-3.5 h-3.5" />
                    <span>Slot 3: Aerobic Long Run</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Continuous conversational Zone 2 effort over natural XC terrain. Builds mitochondrial density, capillary beds, and muscular fatigue resistance.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* The 3 Primary Weekly Training Slots */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {assignedSlots.map(({ slot, run, suggestedPlan }) => {
              const suggestedKm = suggestedPlan?.suggestedDistanceKm || 5;
              const suggestedStr =
                unit === 'miles'
                  ? `${(suggestedKm * KM_TO_MILES).toFixed(1)} mi`
                  : `${suggestedKm.toFixed(1)} km`;
              const targetPaceStr = suggestedPlan?.suggestedPaceFormatted || 'Not enough data yet';
              const Icon = slot.icon;

              if (!run) {
                return (
                  <div
                    key={slot.id}
                    className="p-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#0c1822]/40 flex flex-col justify-between min-h-[200px]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          Slot {slot.slotNumber}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                          Pending This Week
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
                  ? `${diffKm * KM_TO_MILES > 0 ? '+' : ''}${(diffKm * KM_TO_MILES).toFixed(1)} mi`
                  : `${diffKm > 0 ? '+' : ''}${diffKm} km`;
              const isOnTarget = Math.abs(diffKm) <= 0.6;
              const isHill = isHillRun(run.runType, run.title);

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

                      <div className="flex items-center space-x-1">
                        {isHill && (
                          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500">
                            <Mountain className="w-2.5 h-2.5" />
                            <span>Hill</span>
                          </span>
                        )}
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#10B981]/15 text-[#10B981]">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Completed</span>
                        </span>
                      </div>
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
                        {run.elevationGainMeters && run.elevationGainMeters > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-0.5">
                              <Mountain className="w-3 h-3" />
                              <span>+{run.elevationGainMeters}m</span>
                            </span>
                          </>
                        )}
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
                {additionalWeekRuns.map((r) => {
                  const isHill = isHillRun(r.runType, r.title);
                  return (
                    <div
                      key={r.id}
                      className="px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#0e1b25] border border-neutral-200/70 dark:border-neutral-800 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-neutral-900 dark:text-[#FCFFFF] truncate text-xs flex items-center space-x-1">
                          {isHill && <Mountain className="w-3 h-3 text-amber-500 shrink-0" />}
                          <span className="truncate">{r.title}</span>
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
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: MONTHLY VIEW */}
      {viewMode === 'monthly' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Month Navigation & Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-neutral-50 dark:bg-[#0c1822] border border-neutral-200/80 dark:border-neutral-800">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setMonthOffset((prev) => prev - 1)}
                className="p-1.5 rounded-lg bg-white dark:bg-[#12222f] border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                title="View previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="min-w-[150px] text-center">
                <span className="text-sm font-bold text-neutral-900 dark:text-white">
                  {monthlyAnalysis.monthTitle}
                </span>
                {monthOffset !== 0 && (
                  <button
                    type="button"
                    onClick={() => setMonthOffset(0)}
                    className="block mx-auto text-[10px] text-[#0593C6] font-semibold hover:underline cursor-pointer"
                  >
                    Jump to Current Month
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setMonthOffset((prev) => Math.min(prev + 1, 0))}
                disabled={monthOffset >= 0}
                className="p-1.5 rounded-lg bg-white dark:bg-[#12222f] border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="View next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-neutral-600 dark:text-neutral-400">
              <span className="font-semibold text-neutral-900 dark:text-white">
                {monthlyAnalysis.consistencyMessage}
              </span>
            </div>
          </div>

          {/* 4 Monthly Highlight Telemetry Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Monthly Distance */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#0c1822] border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                <span>Monthly Distance</span>
                <Target className="w-3.5 h-3.5 text-[#0593C6]" />
              </div>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-2xl font-extrabold text-neutral-900 dark:text-white tabular-nums tracking-tight">
                  {unit === 'miles'
                    ? (monthlyAnalysis.totalDistanceKm * KM_TO_MILES).toFixed(1)
                    : monthlyAnalysis.totalDistanceKm.toFixed(1)}
                </span>
                <span className="text-xs font-semibold text-neutral-500">
                  / {unit === 'miles'
                    ? (monthlyAnalysis.monthlyDistanceGoalKm * KM_TO_MILES).toFixed(0)
                    : monthlyAnalysis.monthlyDistanceGoalKm} {unit}
                </span>
              </div>
              <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-[#0593C6] h-full rounded-full transition-all duration-300"
                  style={{ width: `${monthlyAnalysis.distanceProgressPct}%` }}
                />
              </div>
              <span className="text-[10px] text-neutral-400 mt-1 tabular-nums">
                {monthlyAnalysis.distanceProgressPct}% of monthly volume
              </span>
            </div>

            {/* Card 2: Workouts Completed */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#0c1822] border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                <span>Total Workouts</span>
                <Activity className="w-3.5 h-3.5 text-[#10B981]" />
              </div>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-2xl font-extrabold text-neutral-900 dark:text-white tabular-nums tracking-tight">
                  {monthlyAnalysis.totalRuns}
                </span>
                <span className="text-xs font-semibold text-neutral-500">
                  / {monthlyAnalysis.monthlyRunsGoal} sessions
                </span>
              </div>
              <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-[#10B981] h-full rounded-full transition-all duration-300"
                  style={{ width: `${monthlyAnalysis.runsProgressPct}%` }}
                />
              </div>
              <span className="text-[10px] text-[#10B981] font-semibold mt-1">
                {monthlyAnalysis.totalRuns >= monthlyAnalysis.monthlyRunsGoal ? 'Monthly Quota Met! 🎯' : `${monthlyAnalysis.runsProgressPct}% of planned microcycles`}
              </span>
            </div>

            {/* Card 3: Hill Runs & Elevation (Feature Highlight) */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#0c1822] border border-amber-500/30 dark:border-amber-500/20 bg-amber-50/20 dark:bg-amber-950/10 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">
                <span className="flex items-center space-x-1">
                  <Mountain className="w-3 h-3 text-amber-500" />
                  <span>Hill Workouts</span>
                </span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-500">
                  XC Power
                </span>
              </div>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-2xl font-extrabold text-neutral-900 dark:text-white tabular-nums tracking-tight">
                  {monthlyAnalysis.hillRunsCount}
                </span>
                <span className="text-xs font-semibold text-neutral-500">
                  {monthlyAnalysis.hillRunsCount === 1 ? 'session' : 'sessions'}
                </span>
              </div>
              <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                +{monthlyAnalysis.totalElevationGainMeters}m Total Elevation (All Runs)
              </div>
              <span className="text-[10px] text-neutral-400 mt-0.5">
                {monthlyAnalysis.hillRunsCount > 0 ? 'Course hill endurance locked' : 'Add hill repeats to build power'}
              </span>
            </div>

            {/* Card 4: Adherence & Streak Consistency */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#0c1822] border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                <span>Consistency Rate</span>
                <Flame className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-2xl font-extrabold text-neutral-900 dark:text-white tabular-nums tracking-tight">
                  {monthlyAnalysis.consistencyPercentage}%
                </span>
                <span className="text-xs font-semibold text-neutral-500">
                  adherence
                </span>
              </div>
              <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-orange-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${monthlyAnalysis.consistencyPercentage}%` }}
                />
              </div>
              <span className="text-[10px] text-neutral-600 dark:text-neutral-400 font-semibold mt-1">
                {monthlyAnalysis.weeksMetCount} of {monthlyAnalysis.totalWeeksInMonth} calendar weeks hit goal
              </span>
            </div>
          </div>

          {/* Week-by-Week Consistency Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                Week-by-Week Training Breakdown ({monthlyAnalysis.monthName})
              </h3>
              <span className="text-[11px] text-neutral-400">
                Evaluation based on your {weeklyRunGoal}-run/week and {effectiveWeeklyGoalKm} km/week target
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {monthlyAnalysis.weeks.map((w) => {
                const distFormatted =
                  unit === 'miles'
                    ? (w.totalDistanceKm * KM_TO_MILES).toFixed(1)
                    : w.totalDistanceKm.toFixed(1);
                const targetDistFormatted =
                  unit === 'miles'
                    ? (w.targetDistanceKm * KM_TO_MILES).toFixed(1)
                    : w.targetDistanceKm.toFixed(1);
                const isMet = w.goalMet;

                return (
                  <div
                    key={w.weekKey}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                      isMet
                        ? 'bg-emerald-500/5 dark:bg-emerald-950/15 border-emerald-500/30 dark:border-emerald-500/20 shadow-xs'
                        : 'bg-white dark:bg-[#0c1822] border-neutral-200/80 dark:border-neutral-800'
                    }`}
                  >
                    <div>
                      {/* Week Header */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-neutral-900 dark:text-white">
                          {w.weekLabel}
                        </span>
                        {isMet ? (
                          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/15 text-[#10B981]">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            <span>Goal Hit</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-neutral-400">
                            {w.runsCount} of {w.targetRuns} runs
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-neutral-400 mb-2">
                        {w.dateRangeLabel}
                      </div>

                      {/* Mileage & Elevation Metrics */}
                      <div className="p-2 rounded-lg bg-neutral-100/70 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 space-y-1 text-[11px] tabular-nums">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500 dark:text-neutral-400">Volume:</span>
                          <span className="font-bold text-neutral-900 dark:text-white">
                            {distFormatted} / {targetDistFormatted} {unit}
                          </span>
                        </div>
                        {w.elevationGainMeters > 0 && (
                          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 pt-0.5 border-t border-neutral-200/40 dark:border-neutral-800">
                            <span className="flex items-center space-x-1">
                              <Mountain className="w-3 h-3" />
                              <span>Elevation:</span>
                            </span>
                            <span className="font-semibold">+{w.elevationGainMeters}m</span>
                          </div>
                        )}
                      </div>

                      {/* Runs Chips in this week */}
                      <div className="mt-2.5 space-y-1">
                        {w.runs.length === 0 ? (
                          <p className="text-[10px] text-neutral-400 italic">No workouts recorded</p>
                        ) : (
                          w.runs.map((r) => {
                            const isHill = isHillRun(r.runType, r.title);
                            return (
                              <div
                                key={r.id}
                                className="flex items-center justify-between text-[11px] py-0.5 text-neutral-700 dark:text-neutral-300"
                              >
                                <span className="truncate pr-1 flex items-center space-x-1">
                                  {isHill && <Mountain className="w-3 h-3 text-amber-500 shrink-0" />}
                                  <span className="truncate">{r.title}</span>
                                </span>
                                <span className="text-[10px] font-semibold text-neutral-500 tabular-nums shrink-0">
                                  {unit === 'miles' ? (r.distanceKm * KM_TO_MILES).toFixed(1) : r.distanceKm} {unit}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hill Runs Feature Highlight Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-transparent border border-amber-500/20 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-500 flex items-center justify-center">
                    <Mountain className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="font-bold text-neutral-900 dark:text-white">
                    Cross Country Hill Training Impact
                  </h4>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-xl">
                  {monthlyAnalysis.hillRunsCount > 0
                    ? `You logged ${monthlyAnalysis.hillRunsCount} hill workout${monthlyAnalysis.hillRunsCount === 1 ? '' : 's'} with +${monthlyAnalysis.totalElevationGainMeters}m of climbing in ${monthlyAnalysis.monthName}. Uphill surges build neuromuscular knee drive and power needed for hilly XC courses.`
                    : `No hill workouts logged in ${monthlyAnalysis.monthName} yet. Incorporate 1 session of hill repeats (6-8 × 200m uphill surges) every 10-14 days to build late-race climbing resilience.`}
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenAddRun}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-xs transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Log Hill Workout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )}
</div>
  );
};
