import React from 'react';
import { UserProfile, AdherenceSummary } from '../types/running';
import {
  formatDuration,
  formatPace,
  calculateTargetCutoff,
  KM_TO_MILES,
} from '../utils/runningCalculations';
import { Trophy, Target, Edit2, Flame, Calendar, Sparkles, TrendingDown, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface GoalBannerProps {
  profile: UserProfile;
  adherence: AdherenceSummary;
  best6kSec?: number;
  onEditGoal: () => void;
}

export const GoalBanner: React.FC<GoalBannerProps> = ({
  profile,
  adherence,
  best6kSec,
  onEditGoal,
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

  const triggerCelebrate = () => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
    });
  };

  const distTitle = profile.targetGoalName || (targetDistKm === 6 ? '6K Cross Country Target' : `${targetDistKm}K Target`);
  const distCardLabel = targetDistKm === 6 ? 'Target 6K' : `Target ${targetDistKm}K`;
  const projectedCardLabel = targetDistKm === 6 ? 'Fastest Current Projected 6K Time' : `Fastest Current Projected ${targetDistKm}K Time`;

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800/80 shadow-xs p-5 sm:p-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
              {distTitle}
            </h1>
            <button
              onClick={onEditGoal}
              className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Edit Target Distance, Time or Units"
              aria-label="Edit Target"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Targeting faster race times with structured endurance training ({targetDistKm} km goal)
          </p>
        </div>

        {goalAchieved && (
          <button
            onClick={triggerCelebrate}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#30d158]/15 text-[#30d158] text-xs font-semibold hover:bg-[#30d158]/25 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Target Achieved! Celebrate 🎉</span>
          </button>
        )}
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {/* Target Distance Time */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800/60">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>{distCardLabel}</span>
            <Target className="w-3.5 h-3.5 text-[#0a84ff]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight tabular-nums">
            {targetTotalTimeSec ? formatDuration(targetTotalTimeSec) : '--:--'}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
            {targetPacePerKm ? `Pace: ${formatPace(targetPacePerKm, profile.unitPreference)}` : 'Tap pencil to set'}
          </div>
        </div>

        {/* Current PR / Best */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800/60">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>Current PR</span>
            <Trophy className="w-3.5 h-3.5 text-[#30d158]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#30d158] tracking-tight tabular-nums">
            {currentSec ? formatDuration(currentSec) : '--:--'}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
            {cutoff
              ? !cutoff.isAchieved
                ? `Cut off ${cutoff.paceCutoffSeconds}s to goal`
                : 'Goal reached!'
              : currentSec
              ? `${formatPace(currentPacePerKm || 0, profile.unitPreference)}`
              : 'No workouts logged'}
          </div>
        </div>

        {/* Weekly Target */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800/60">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>This Week</span>
            <Calendar className="w-3.5 h-3.5 text-[#ff9f0a]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight tabular-nums">
            {adherence.currentWeekRuns} / {profile.weeklyRunGoal}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {adherence.currentWeekGoalMet
              ? 'Weekly goal completed'
              : `${profile.weeklyRunGoal - adherence.currentWeekRuns} workout(s) remaining`}
          </div>
        </div>

        {/* Consistency Streak */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800/60">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>Weekly Streak</span>
            <Flame className="w-3.5 h-3.5 text-[#ff9f0a] fill-[#ff9f0a]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight tabular-nums">
            {adherence.currentStreakWeeks > 0 ? (
              <>
                {adherence.currentStreakWeeks} <span className="text-sm font-medium text-neutral-500">wks</span>
              </>
            ) : (
              '--'
            )}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {adherence.totalWeeksTracked > 0
              ? `${adherence.adherencePercentage}% weeks completed`
              : 'Consistency tracking'}
          </div>
        </div>
      </div>

      {/* Under Target: Fastest Current Projected Time & Time to Cut Off */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-neutral-50 to-neutral-100/50 dark:from-neutral-900/80 dark:to-neutral-900/40 border border-neutral-200/90 dark:border-neutral-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Left: Fastest Current Projected Time */}
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              <Sparkles className="w-3.5 h-3.5 text-[#0a84ff]" />
              <span>{projectedCardLabel}</span>
            </div>

            <div className="flex items-baseline space-x-3">
              <span className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight tabular-nums">
                {currentSec ? formatDuration(currentSec) : '--:--'}
              </span>
              {currentPacePerKm && (
                <span className="text-xs font-medium text-neutral-500 tabular-nums">
                  Pace: {formatPace(currentPacePerKm, profile.unitPreference)}
                </span>
              )}
            </div>

            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {currentSec
                ? `Calculated from your fastest logged workout equivalent for ${targetDistKm} km.`
                : `Log or sync your workouts to compute your fastest projected ${targetDistKm}K performance.`}
            </p>
          </div>

          {/* Right: How Much Time to Cut Off */}
          <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-neutral-200 dark:border-neutral-800">
            {cutoff ? (
              !cutoff.isAchieved ? (
                <div className="space-y-1">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Cut off: {cutoff.paceCutoffSeconds} {cutoff.paceCutoffSeconds === 1 ? 'second' : 'seconds'}</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {formatPace(cutoff.currentPaceSecPerKm, profile.unitPreference)} → {formatPace(cutoff.targetPaceSecPerKm, profile.unitPreference)} (cut off {cutoff.paceCutoffSeconds}s to reach your goal)
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#30d158]/15 text-[#30d158] text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Target Achieved ({Math.abs(cutoff.paceCutoffSeconds)}s ahead of target pace!)</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Surpassed your <strong className="text-neutral-900 dark:text-white">{formatPace(cutoff.targetPaceSecPerKm, profile.unitPreference)}</strong> pace goal
                  </p>
                </div>
              )
            ) : !targetSec ? (
              <button
                onClick={onEditGoal}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black transition-colors cursor-pointer"
              >
                Set Target to See Gap
              </button>
            ) : (
              <p className="text-xs text-neutral-400">
                Awaiting your first run to compute target cutoff
              </p>
            )}
          </div>
        </div>

        {/* Progress Bar towards goal */}
        {targetSec && currentSec && (
          <div className="mt-4 pt-3 border-t border-neutral-200/80 dark:border-neutral-800/80">
            <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1.5 tabular-nums">
              <span>Goal Progress</span>
              <span className="font-semibold text-neutral-900 dark:text-white">{progressPct}%</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#30d158] h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
