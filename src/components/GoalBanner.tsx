import React from 'react';
import { UserProfile, AdherenceSummary } from '../types/running';
import {
  formatDuration,
  formatPace,
  calculateTargetCutoff,
} from '../utils/runningCalculations';
import { Trophy, Target, Edit2, Calendar, Clock, TrendingDown, CheckCircle2, Flame, Share2 } from 'lucide-react';

interface GoalBannerProps {
  profile: UserProfile;
  adherence: AdherenceSummary;
  best6kSec?: number;
  onEditGoal: () => void;
  onShare?: () => void;
}

export const GoalBanner: React.FC<GoalBannerProps> = ({
  profile,
  adherence,
  best6kSec,
  onEditGoal,
  onShare,
}) => {
  const targetDistKm = profile.targetDistanceKm || 6.0;
  const targetSec = profile.target6kTimeSeconds;
  const currentSec = best6kSec || profile.current6kPrSeconds;

  const cutoff = calculateTargetCutoff(targetSec, currentSec, targetDistKm);

  const targetPacePerKm = cutoff
    ? cutoff.targetPaceSecPerKm
    : targetSec && targetSec >= 600
    ? targetSec / targetDistKm
    : targetSec && targetSec < 600
    ? targetSec
    : null;

  const targetTotalTimeSec = cutoff
    ? cutoff.targetTotalSec
    : targetSec && targetSec >= 600
    ? targetSec
    : targetSec
    ? Math.round(targetSec * targetDistKm)
    : null;

  const currentPacePerKm = cutoff ? cutoff.currentPaceSecPerKm : currentSec ? currentSec / targetDistKm : null;
  const goalAchieved = cutoff ? cutoff.isAchieved : false;

  // Baseline assumption for initial progress bar
  const baselineSec = Math.max(1600, (currentSec || 1500) + 120);
  let progressPct = 0;
  if (currentSec && targetTotalTimeSec) {
    if (goalAchieved) {
      progressPct = 100;
    } else {
      const totalSpan = baselineSec - targetTotalTimeSec;
      const currentProgress = baselineSec - currentSec;
      progressPct = Math.max(5, Math.min(95, Math.round((currentProgress / totalSpan) * 100)));
    }
  }

  const distTitle = profile.targetGoalName || (targetDistKm === 6 ? 'Cross Country 6K Race Target' : `${targetDistKm}K Competition Goal`);
  const distCardLabel = targetDistKm === 6 ? 'Target 6K' : `Target ${targetDistKm}K`;
  const projectedCardLabel = targetDistKm === 6 ? 'Fastest Projected 6K Time' : `Fastest Projected ${targetDistKm}K Time`;

  return (
    <div className="rounded-2xl bg-white dark:bg-[#111c24] border border-neutral-200 dark:border-neutral-800 shadow-xs p-5 sm:p-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
              {distTitle}
            </h2>
            <button
              onClick={onEditGoal}
              className="p-1 rounded-md text-neutral-400 hover:text-[#0593C6] dark:hover:text-[#38bdf8] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Edit Target Benchmark"
              aria-label="Edit Target"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Structured distance conditioning and microcycle pacing ({targetDistKm.toFixed(1)} km benchmark)
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {onShare && (
            <button
              onClick={onShare}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Show off progress to friends"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Show Off</span>
            </button>
          )}

          {goalAchieved && (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#10B981]/10 text-[#10B981] dark:text-[#34d399] text-xs font-bold border border-[#10B981]/20">
              <Trophy className="w-3.5 h-3.5" />
              <span>Target Benchmark Achieved</span>
            </div>
          )}
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {/* Target Distance Time */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>{distCardLabel}</span>
            <Target className="w-3.5 h-3.5 text-[#0593C6]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight tabular-nums font-sans">
            {targetTotalTimeSec ? formatDuration(targetTotalTimeSec) : '--:--'}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
            {targetPacePerKm ? `Pace: ${formatPace(targetPacePerKm, profile.unitPreference)}` : 'Click edit to configure'}
          </div>
        </div>

        {/* Current PR / Best */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>Current Trial PR</span>
            <Trophy className="w-3.5 h-3.5 text-[#10B981]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#0593C6] dark:text-[#38bdf8] tracking-tight tabular-nums font-sans">
            {currentSec ? formatDuration(currentSec) : '--:--'}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
            {cutoff
              ? !cutoff.isAchieved
                ? `Cut off ${cutoff.paceCutoffSeconds}s to goal`
                : 'Goal reached'
              : currentSec
              ? `${formatPace(currentPacePerKm || 0, profile.unitPreference)}`
              : 'No workouts logged'}
          </div>
        </div>

        {/* Weekly Microcycle */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>Weekly Microcycle</span>
            <Calendar className="w-3.5 h-3.5 text-[#0593C6]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight tabular-nums font-sans">
            {adherence.currentWeekRuns} / {profile.weeklyRunGoal}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {adherence.currentWeekGoalMet
              ? 'Weekly quota completed'
              : `${profile.weeklyRunGoal - adherence.currentWeekRuns} session(s) remaining`}
          </div>
        </div>

        {/* Consistency Streak */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>Adherence Streak</span>
            <Flame className="w-3.5 h-3.5 text-[#10B981]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight tabular-nums font-sans">
            {adherence.currentStreakWeeks > 0 ? (
              <>
                {adherence.currentStreakWeeks} <span className="text-sm font-semibold text-[#10B981]">wks</span>
              </>
            ) : (
              '--'
            )}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {adherence.totalWeeksTracked > 0
              ? `${adherence.adherencePercentage}% weeks completed`
              : 'Tracking consistency'}
          </div>
        </div>
      </div>

      {/* Under Target: Fastest Current Benchmark & Time to Cut Off */}
      <div className="p-4 rounded-xl bg-neutral-50/70 dark:bg-[#0c151c]/70 border border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Left: Fastest Current Projected Time */}
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              <Clock className="w-3.5 h-3.5 text-[#0593C6]" />
              <span>{projectedCardLabel}</span>
            </div>

            <div className="flex items-baseline space-x-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight tabular-nums">
                {currentSec ? formatDuration(currentSec) : '--:--'}
              </span>
              {currentPacePerKm && (
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 tabular-nums">
                  Pace: {formatPace(currentPacePerKm, profile.unitPreference)}
                </span>
              )}
            </div>

            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {currentSec
                ? `Computed from your fastest logged workout equivalent across ${targetDistKm} km.`
                : `Upload Garmin workouts or log training to compute your fastest projected ${targetDistKm}K trial.`}
            </p>
          </div>

          {/* Right: How Much Time to Cut Off */}
          <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-neutral-200 dark:border-neutral-800">
            {cutoff ? (
              !cutoff.isAchieved ? (
                <div className="space-y-1">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-md bg-[#10B981]/10 text-[#10B981] dark:text-[#34d399] text-xs font-bold border border-[#10B981]/20">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Cut off: {cutoff.paceCutoffSeconds} {cutoff.paceCutoffSeconds === 1 ? 'second' : 'seconds'}</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {formatPace(cutoff.currentPaceSecPerKm, profile.unitPreference)} → {formatPace(cutoff.targetPaceSecPerKm, profile.unitPreference)} ({cutoff.paceCutoffSeconds}s pace reduction to goal)
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-md bg-[#0593C6]/15 text-[#0593C6] text-xs font-bold border border-[#0593C6]/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Target Surpassed ({Math.abs(cutoff.paceCutoffSeconds)}s ahead of pace)</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Exceeding your <strong className="text-neutral-900 dark:text-white">{formatPace(cutoff.targetPaceSecPerKm, profile.unitPreference)}</strong> pace benchmark
                  </p>
                </div>
              )
            ) : !targetSec ? (
              <button
                onClick={onEditGoal}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0593C6] hover:bg-[#047da8] text-white transition-colors cursor-pointer shadow-xs"
              >
                Set Target Benchmark
              </button>
            ) : (
              <p className="text-xs text-neutral-400">
                Awaiting your first workout to compute pace gap
              </p>
            )}
          </div>
        </div>

        {/* Progress Bar towards goal */}
        {targetSec && currentSec && (
          <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1.5 tabular-nums">
              <span className="font-medium">Goal Trajectory</span>
              <span className="font-bold text-neutral-900 dark:text-white">{progressPct}%</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#0593C6] dark:bg-[#38bdf8] h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
