import React, { useState } from 'react';
import { RunRecord, UserProfile, AdherenceSummary } from '../types/running';
import {
  calculateGoalProjection,
  formatDuration,
  formatPace,
  KM_TO_MILES,
} from '../utils/runningCalculations';
import {
  Target,
  TrendingDown,
  Calendar,
  CheckCircle2,
  Clock,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Sliders,
} from 'lucide-react';

interface GoalProjectionCardProps {
  runs: RunRecord[];
  profile: UserProfile;
  adherence: AdherenceSummary;
  best6kSec?: number;
  onOpenSettings: () => void;
}

export const GoalProjectionCard: React.FC<GoalProjectionCardProps> = ({
  runs,
  profile,
  adherence,
  best6kSec,
  onOpenSettings,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<'expected' | 'accelerated' | 'conservative'>('expected');
  const [showMethodology, setShowMethodology] = useState(false);

  const targetDistKm = profile.targetDistanceKm || 6.0;
  const targetSec = profile.target6kTimeSeconds;
  const currentBest = best6kSec || profile.current6kPrSeconds;

  const projection = calculateGoalProjection(
    runs,
    targetDistKm,
    targetSec,
    currentBest,
    profile.weeklyRunGoal || 3,
    adherence.currentStreakWeeks || 0
  );

  const unit = profile.unitPreference || 'km';

  // If no target set, render clean prompt card as collapsible dropdown
  if (!projection.hasTarget) {
    return (
      <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#0F1C28] border border-slate-200/95 dark:border-slate-700/75 shadow-sm transition-colors">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full px-4 py-4 sm:px-5 sm:py-4.5 flex items-center justify-between text-left cursor-pointer group accordion-trigger select-none hover:bg-slate-50/90 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800/70"
          data-no-scale
          aria-expanded={isExpanded}
        >
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-violet-500 flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105">
              <Target className="w-4.5 h-4.5 stroke-[2.3]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">
                Goal Projection & Timeframe
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
              Target Not Set
            </span>
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

        <div
          className={`accordion-collapse-wrapper ${isExpanded ? 'is-expanded' : ''}`}
          aria-hidden={!isExpanded}
        >
          <div className="accordion-collapse-inner">
            <div className="px-4 pb-5 pt-4 sm:px-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl">
                Set a target time for your {targetDistKm}K to calculate your future progression trajectory, estimated weeks remaining, and intermediate split milestones.
              </p>
              <button
                onClick={onOpenSettings}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs transition-all cursor-pointer shrink-0 shadow-xs"
              >
                Set Goal Time
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeScenarioData = projection.scenarios[selectedScenario];

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
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-violet-500 flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105">
            <TrendingDown className="w-4.5 h-4.5 stroke-[2.4]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">
                Goal Projection & Timeframe
              </h2>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                · {projection.isAchieved ? 'Achieved' : `~${activeScenarioData.weeks} Weeks (${projection.confidence})`}
              </span>
            </div>
          </div>
        </div>

        {/* Chevron Dropdown Toggle */}
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Projected trajectory and estimated weeks remaining until target {targetDistKm} km time is achieved
              </p>

              <button
                onClick={() => setShowMethodology(!showMethodology)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer self-start sm:self-auto"
              >
                <Info className="w-3.5 h-3.5 text-violet-500" />
                <span>{showMethodology ? 'Hide Model' : 'Projection Science'}</span>
              </button>
            </div>

      {/* Projection Highlights: When Achieved vs In Progress */}
      {projection.isAchieved ? (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                Target Already Achieved!
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Your current benchmark of {formatDuration(projection.currentBestSeconds)} beats your goal of {formatDuration(projection.targetTimeSeconds)}.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSettings}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shrink-0"
          >
            Set Faster Target
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4 mb-5">
          {/* Estimated Weeks */}
          <div className="p-4 rounded-xl bg-violet-50/70 dark:bg-violet-950/25 border border-violet-200/80 dark:border-violet-800/60 flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300 mb-1 flex items-center justify-between">
              <span>Estimated Timeline</span>
              <Calendar className="w-3.5 h-3.5 text-violet-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
              ~{activeScenarioData.weeks} <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Weeks</span>
            </div>
            <div className="text-xs text-violet-600 dark:text-violet-400 font-bold mt-1">
              Projected: {activeScenarioData.date}
            </div>
          </div>

          {/* Time Remaining to Cut Off */}
          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/80 dark:border-emerald-800/60 flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-1 flex items-center justify-between">
              <span>Gap to Goal</span>
              <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
              {formatDuration(projection.gapSeconds)}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 tabular-nums">
              Cut {Math.round(projection.gapSeconds / targetDistKm)}s / {unit} to hit goal
            </div>
          </div>

          {/* Weekly Progression Pace */}
          <div className="p-4 rounded-xl bg-sky-50/70 dark:bg-sky-950/25 border border-sky-200/80 dark:border-sky-800/60 flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 mb-1 flex items-center justify-between">
              <span>Progression Rate</span>
              <Zap className="w-3.5 h-3.5 text-sky-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-sky-600 dark:text-sky-400 tabular-nums tracking-tight">
              -{activeScenarioData.weeklyRateSec}s <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">/ wk</span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 tabular-nums">
              ~{(activeScenarioData.weeklyRateSec / targetDistKm).toFixed(1)}s / {unit} weekly gain
            </div>
          </div>

          {/* Goal Target */}
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/60 flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1 flex items-center justify-between">
              <span>Target Benchmark</span>
              <Target className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
              {formatDuration(projection.targetTimeSeconds)}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 tabular-nums">
              Pace: {formatPace((projection.targetTimeSeconds || 0) / targetDistKm, unit)}
            </div>
          </div>
        </div>
      )}

      {/* Consistency Scenarios Selector */}
      {!projection.isAchieved && (
        <div className="mb-5 p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div>
              <span className="text-xs font-bold text-neutral-900 dark:text-white">
                Training Consistency Scenarios:
              </span>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Choose a schedule scenario to see how weekly consistency accelerates your target date
              </p>
            </div>
            <div className="inline-flex p-0.5 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 text-xs self-start sm:self-auto">
              <button
                onClick={() => setSelectedScenario('expected')}
                className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  selectedScenario === 'expected'
                    ? 'bg-[#0593C6] text-[#FCFFFF] shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-[#FCFFFF]'
                }`}
              >
                Steady (3 runs/wk)
              </button>
              <button
                onClick={() => setSelectedScenario('accelerated')}
                className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  selectedScenario === 'accelerated'
                    ? 'bg-[#10B981] text-[#FCFFFF] shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-[#FCFFFF]'
                }`}
              >
                Accelerated (3-4 runs)
              </button>
              <button
                onClick={() => setSelectedScenario('conservative')}
                className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  selectedScenario === 'conservative'
                    ? 'bg-[#0593C6] text-[#FCFFFF] shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-[#FCFFFF]'
                }`}
              >
                Base (1-2 runs)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div
              onClick={() => setSelectedScenario('expected')}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                selectedScenario === 'expected'
                  ? 'border-[#0593C6] bg-[#0593C6]/10 ring-1 ring-[#0593C6]/30'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
              }`}
            >
              <div className="font-semibold text-neutral-900 dark:text-[#FCFFFF] flex items-center justify-between">
                <span>Steady Schedule</span>
                <span className="text-[#0593C6] tabular-nums font-bold">~{projection.scenarios.expected.weeks} wks</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Maintains your recommended 3 runs/week structure (Intervals + Tempo + Aerobic Long Run).
              </p>
            </div>

            <div
              onClick={() => setSelectedScenario('accelerated')}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                selectedScenario === 'accelerated'
                  ? 'border-[#10B981] bg-[#10B981]/10 ring-1 ring-[#10B981]/30'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
              }`}
            >
              <div className="font-semibold text-neutral-900 dark:text-[#FCFFFF] flex items-center justify-between">
                <span>Accelerated Focus</span>
                <span className="text-[#10B981] dark:text-[#34d399] tabular-nums font-bold">~{projection.scenarios.accelerated.weeks} wks</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Optimal recovery nutrition, race pace repeat intervals, and high weekly adherence.
              </p>
            </div>

            <div
              onClick={() => setSelectedScenario('conservative')}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                selectedScenario === 'conservative'
                  ? 'border-[#0593C6] bg-[#0593C6]/10 ring-1 ring-[#0593C6]/30'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
              }`}
            >
              <div className="font-semibold text-neutral-900 dark:text-[#FCFFFF] flex items-center justify-between">
                <span>Conservative Base</span>
                <span className="text-[#0593C6] tabular-nums font-bold">~{projection.scenarios.conservative.weeks} wks</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Gradual aerobic conditioning, lower volume or occasional missed sessions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Projected Milestones Roadmap */}
      {projection.milestones.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-neutral-900 dark:text-[#FCFFFF]">
              Projected Progression Milestones
            </span>
            <span className="text-[11px] text-neutral-400 tabular-nums">
              Target: {formatDuration(projection.targetTimeSeconds)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {projection.milestones.map((ms, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === projection.milestones.length - 1;
              const isAchievedGoal = isLast && projection.isAchieved;

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex flex-col justify-between text-xs transition-colors ${
                    isAchievedGoal
                      ? 'bg-[#0593C6]/10 border-[#0593C6]/40 ring-1 ring-[#0593C6]/30'
                      : isFirst
                      ? 'bg-[#F2F8FB] dark:bg-neutral-900 border-[#0593C6]/30 dark:border-neutral-700'
                      : 'bg-[#F2F8FB]/60 dark:bg-neutral-900/60 border-neutral-200/80 dark:border-neutral-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isAchievedGoal
                            ? 'bg-[#0593C6] text-[#FCFFFF]'
                            : isLast
                            ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700'
                            : isFirst
                            ? 'bg-[#0593C6]/15 text-[#0593C6] font-bold'
                            : 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {isFirst
                          ? 'Baseline'
                          : isLast
                          ? isAchievedGoal
                            ? 'Goal Hit'
                            : 'Projected Goal Hit'
                          : `Week ${ms.weekNumber}`}
                      </span>
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        {ms.projectedDate}
                      </span>
                    </div>

                    <div className="text-xl font-bold text-neutral-900 dark:text-[#FCFFFF] tabular-nums tracking-tight mt-1">
                      {formatDuration(ms.projectedTimeSeconds)}
                    </div>

                    <div className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5 tabular-nums">
                      Pace: {formatPace(ms.projectedPaceSecPerKm, unit)}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-neutral-200/70 dark:border-neutral-800 text-[10px] text-neutral-500 line-clamp-1">
                    {ms.notes}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

        {/* Expandable Methodology Explanation */}
        {showMethodology && (
          <div className="mt-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-300 space-y-2 animate-in fade-in duration-200">
            <div className="font-semibold text-neutral-900 dark:text-white">
              Projection Calculation Model
            </div>
            <p className="text-[11px] leading-relaxed">
              {projection.basisDescription}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              <div>
                <strong className="text-neutral-800 dark:text-neutral-200 block">Aerobic Adaptation Formula:</strong>
                Each quality session (Intervals + Lactate Tempo + Aerobic Long Run) produces neuromuscular and mitochondrial density adaptations yielding 12s-18s 6K race improvement per week.
              </div>
              <div>
                <strong className="text-neutral-800 dark:text-neutral-200 block">Timeline Calibration:</strong>
                Estimated weeks remaining = <code className="bg-neutral-200/60 dark:bg-neutral-800 px-1 py-0.5 rounded-xs font-mono text-neutral-900 dark:text-white">GapSeconds / WeeklyProgressionRate</code>.
              </div>
            </div>
          </div>
        )}
            </div>
          </div>
        </div>
      </div>
    );
};
