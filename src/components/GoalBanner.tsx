import React from 'react';
import { UserProfile, AdherenceSummary } from '../types/running';
import {
  formatDuration,
  formatPace,
  calculateTargetCutoff,
  KM_TO_MILES,
} from '../utils/runningCalculations';
import { Trophy, Target, Edit2, Calendar, Clock, TrendingDown, CheckCircle2, Flame } from 'lucide-react';
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
      colors: ['#0593C6', '#10B981', '#FCFFFF'],
      origin: { y: 0.6 },
    });
  };

  const distTitle = profile.targetGoalName || (targetDistKm === 6 ? '6K Cross Country Target' : `${targetDistKm}K Target`);
  const distCardLabel = targetDistKm === 6 ? 'Target 6K' : `Target ${targetDistKm}K`;
  const projectedCardLabel = targetDistKm === 6 ? 'Fastest Current Projected 6K Time' : `Fastest Current Projected ${targetDistKm}K Time`;

  return (
    <div className="rounded-2xl bg-[#FCFFFF] dark:bg-[#12222f] border border-neutral-200/90 dark:border-neutral-800 shadow-xs p-5 sm:p-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-[#FCFFFF] tracking-tight">
              {distTitle}
            </h1>
            <button
              onClick={onEditGoal}
              className="p-1 rounded-full text-neutral-400 hover:text-[#0593C6] dark:hover:text-[#0593C6] hover:bg-[#0593C6]/10 transition-colors cursor-pointer"
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
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#0593C6]/15 text-[#0593C6] text-xs font-semibold hover:bg-[#0593C6]/25 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Target Goal Achieved</span>
          </button>
        )}
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {/* Target Distance Time */}
        <div className="p-4 rounded-xl bg-[#F2F8FB]/80 dark:bg-[#0e1b25]/80 border border-[#0593C6]/15 dark:border-neutral-800/80">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>{distCardLabel}</span>
            <Target className="w-3.5 h-3.5 text-[#0593C6]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-[#FCFFFF] tracking-tight tabular-nums">
            {targetTotalTimeSec ? formatDuration(targetTotalTimeSec) : '--:--'}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
            {targetPacePerKm ? `Pace: ${formatPace(targetPacePerKm, profile.unitPreference)}` : 'Tap pencil to set'}
          </div>
        </div>

        {/* Current PR / Best */}
        <div className="p-4 rounded-xl bg-[#F2F8FB]/80 dark:bg-[#0e1b25]/80 border border-[#0593C6]/15 dark:border-neutral-800/80">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>Current PR</span>
            <Trophy className="w-3.5 h-3.5 text-[#10B981]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#0593C6] tracking-tight tabular-nums">
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
        <div className="p-4 rounded-xl bg-[#F2F8FB]/80 dark:bg-[#0e1b25]/80 border border-[#0593C6]/15 dark:border-neutral-800/80">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>This Week</span>
            <Calendar className="w-3.5 h-3.5 text-[#0593C6]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-[#FCFFFF] tracking-tight tabular-nums">
            {adherence.currentWeekRuns} / {profile.weeklyRunGoal}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {adherence.currentWeekGoalMet
              ? 'Weekly goal completed'
              : `${profile.weeklyRunGoal - adherence.currentWeekRuns} workout(s) remaining`}
          </div>
        </div>

        {/* Consistency Streak with green accent */}
        <div className="p-4 rounded-xl bg-[#F2F8FB]/80 dark:bg-[#0e1b25]/80 border border-[#0593C6]/15 dark:border-neutral-800/80">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>Weekly Streak</span>
            <Flame className="w-3.5 h-3.5 text-[#10B981]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-[#FCFFFF] tracking-tight tabular-nums">
            {adherence.currentStreakWeeks > 0 ? (
              <>
                {adherence.currentStreakWeeks} <span className="text-sm font-medium text-[#10B981]">wks</span>
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

      {/* Under Target: Fastest Current Benchmark & Time to Cut Off */}
      <div className="p-4 rounded-xl bg-[#F2F8FB]/50 dark:bg-[#0e1b25]/60 border border-neutral-200/80 dark:border-neutral-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Left: Fastest Current Projected Time */}
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              <Clock className="w-3.5 h-3.5 text-[#0593C6]" />
              <span>{projectedCardLabel}</span>
            </div>

            <div className="flex items-baseline space-x-3">
              <span className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-[#FCFFFF] tracking-tight tabular-nums">
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
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] dark:text-[#34d399] text-xs font-bold border border-[#10B981]/20">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Cut off: {cutoff.paceCutoffSeconds} {cutoff.paceCutoffSeconds === 1 ? 'second' : 'seconds'}</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {formatPace(cutoff.currentPaceSecPerKm, profile.unitPreference)} → {formatPace(cutoff.targetPaceSecPerKm, profile.unitPreference)} (cut off {cutoff.paceCutoffSeconds}s to reach your goal)
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#0593C6]/15 text-[#0593C6] text-xs font-bold border border-[#0593C6]/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Target Achieved ({Math.abs(cutoff.paceCutoffSeconds)}s ahead of target pace!)</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Surpassed your <strong className="text-neutral-900 dark:text-[#FCFFFF]">{formatPace(cutoff.targetPaceSecPerKm, profile.unitPreference)}</strong> pace goal
                  </p>
                </div>
              )
            ) : !targetSec ? (
              <button
                onClick={onEditGoal}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#0593C6] hover:bg-[#047da8] text-[#FCFFFF] transition-colors cursor-pointer shadow-xs"
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
              <span className="font-semibold text-neutral-900 dark:text-[#FCFFFF]">{progressPct}%</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#0593C6] to-[#10B981] h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
