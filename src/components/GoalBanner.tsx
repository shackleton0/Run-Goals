import React from 'react';
import { UserProfile, AdherenceSummary } from '../types/running';
import { formatDuration, formatPace, MILES_TO_KM } from '../utils/runningCalculations';
import { Trophy, Target, Edit2, Flame, Calendar, Sparkles } from 'lucide-react';
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
  const targetSec = profile.target6kTimeSeconds;
  const currentSec = best6kSec || profile.current6kPrSeconds;

  const targetPacePerKm = targetSec && targetSec > 0 ? targetSec / 6.0 : null;
  const targetPacePerMile = targetPacePerKm ? targetPacePerKm * MILES_TO_KM : null;
  const targetPacePer400m = targetPacePerKm ? targetPacePerKm * 0.4 : null;
  const currentPacePerKm = currentSec ? currentSec / 6.0 : null;

  const diffSec = currentSec && targetSec ? currentSec - targetSec : null;
  const goalAchieved = diffSec !== null && diffSec <= 0;

  // Baseline assumption for initial progress bar (e.g. 25:00 = 1500s)
  const baselineSec = 1500;
  let progressPct = 0;
  if (currentSec && targetSec) {
    if (goalAchieved) {
      progressPct = 100;
    } else {
      const totalSpan = baselineSec - targetSec;
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

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800/80 shadow-xs p-5 sm:p-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
              6K Cross Country Target
            </h1>
            <button
              onClick={onEditGoal}
              className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Edit 6K Target or Units"
              aria-label="Edit Target 6K"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Targeting faster race times with a structured 3-run weekly training cycle
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

      {/* Primary Metrics Grid (Apple style clean metric cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {/* Target 6K */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800/60">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>Target 6K</span>
            <Target className="w-3.5 h-3.5 text-[#0a84ff]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight tabular-nums">
            {targetSec ? formatDuration(targetSec) : '--:--'}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
            {targetPacePerKm ? `Pace: ${formatPace(targetPacePerKm, profile.unitPreference)}` : 'Tap pencil to set'}
          </div>
        </div>

        {/* Current 6K PR */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800/60">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>Current PR</span>
            <Trophy className="w-3.5 h-3.5 text-[#30d158]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#30d158] tracking-tight tabular-nums">
            {currentSec ? formatDuration(currentSec) : '--:--'}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
            {currentSec
              ? diffSec && diffSec > 0
                ? `${diffSec}s remaining to goal`
                : 'Goal reached!'
              : 'No 6K race logged'}
          </div>
        </div>

        {/* Weekly 3-Run Target */}
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
              ? '3-run target reached'
              : `${profile.weeklyRunGoal - adherence.currentWeekRuns} workout(s) remaining`}
          </div>
        </div>

        {/* Consistency Streak */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800/60">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            <span>3-Run Streak</span>
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
              : 'Target: 3 runs / week'}
          </div>
        </div>
      </div>

      {/* Target Splits or Set Goal Prompt */}
      {targetSec && targetSec > 0 && targetPacePerKm && targetPacePerMile && targetPacePer400m ? (
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800/60">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-2">
            <span>Target 6K Race Splits ({formatDuration(targetSec)})</span>
            {currentSec ? (
              <span className="text-neutral-500 dark:text-neutral-400 tabular-nums">
                {progressPct}% to goal
              </span>
            ) : (
              <span className="text-neutral-500 dark:text-neutral-400">Pacing reference</span>
            )}
          </div>

          {/* Progress Bar (Apple workout green) */}
          {currentSec ? (
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2 mb-3 overflow-hidden">
              <div
                className="bg-[#30d158] h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          ) : null}

          {/* Split Reference Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="px-3 py-2 rounded-lg bg-white dark:bg-black/50 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-500 dark:text-neutral-400">1K Split</span>
              <span className="font-semibold text-neutral-900 dark:text-white tabular-nums">
                {formatDuration(Math.round(targetPacePerKm))}
              </span>
            </div>
            <div className="px-3 py-2 rounded-lg bg-white dark:bg-black/50 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-500 dark:text-neutral-400">3K Halfway</span>
              <span className="font-semibold text-neutral-900 dark:text-white tabular-nums">
                {formatDuration(Math.round(targetSec / 2))}
              </span>
            </div>
            <div className="px-3 py-2 rounded-lg bg-white dark:bg-black/50 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-500 dark:text-neutral-400">400m Lap</span>
              <span className="font-semibold text-neutral-900 dark:text-white tabular-nums">
                {formatDuration(Math.round(targetPacePer400m))}
              </span>
            </div>
            <div className="px-3 py-2 rounded-lg bg-white dark:bg-black/50 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-500 dark:text-neutral-400">Mile Pace</span>
              <span className="font-semibold text-neutral-900 dark:text-white tabular-nums">
                {formatDuration(Math.round(targetPacePerMile))}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Define your goal 6K cross country time to calculate custom race pacing splits.
          </p>
          <button
            onClick={onEditGoal}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white transition-colors cursor-pointer self-start sm:self-auto"
          >
            Set 6K Goal
          </button>
        </div>
      )}
    </div>
  );
};
