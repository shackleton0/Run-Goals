import React from 'react';
import { UserProfile } from '../types/running';
import { Activity, Calendar, Flame, Target, Settings, ChevronRight } from 'lucide-react';

interface MotivationalGreetingProps {
  profile: UserProfile;
  weeklyRunsCount: number;
  weeklyGoal: number;
  streakWeeks: number;
  onOpenSettings?: () => void;
}

export const MotivationalGreeting: React.FC<MotivationalGreetingProps> = ({
  profile,
  weeklyRunsCount,
  weeklyGoal,
  streakWeeks,
  onOpenSettings,
}) => {
  const runnerName = profile.displayName?.trim() || 'Distance Athlete';
  const targetDistKm = profile.targetDistanceKm || 6.0;
  const level = profile.athleteLevel || 'Varsity / Club';
  const runsRemaining = Math.max(0, weeklyGoal - weeklyRunsCount);
  const isGoalCompleted = weeklyRunsCount >= weeklyGoal;

  return (
    <div className="rounded-2xl bg-white dark:bg-[#111c24] border border-neutral-200 dark:border-neutral-800 shadow-xs p-5 transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Athlete Identity & Training Block */}
        <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#0593C6]/10 text-[#0593C6] dark:bg-[#0593C6]/20 dark:text-[#38bdf8] flex items-center justify-center shrink-0 border border-[#0593C6]/20 font-bold text-sm">
            <Activity className="w-5 h-5 stroke-[2.2]" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                {runnerName}
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                {level}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              <span>Cross Country · {targetDistKm.toFixed(1)}K Distance Target</span>
              <span aria-hidden="true">·</span>
              <span>3-Session Weekly Microcycle</span>
              {onOpenSettings && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    onClick={onOpenSettings}
                    className="inline-flex items-center text-[#0593C6] hover:underline font-semibold cursor-pointer"
                  >
                    <span>Profile Settings</span>
                    <ChevronRight className="w-3 h-3 ml-0.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Microcycle Adherence Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-neutral-100 dark:border-neutral-800">
          {/* Microcycle Completion */}
          <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-center min-w-[120px]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Weekly Sessions
            </span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">
                {weeklyRunsCount}
              </span>
              <span className="text-xs font-semibold text-neutral-400">
                / {weeklyGoal} target
              </span>
            </div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              {isGoalCompleted ? (
                <span className="text-[#10B981] font-semibold">Microcycle complete</span>
              ) : (
                <span>{runsRemaining} session{runsRemaining === 1 ? '' : 's'} remaining</span>
              )}
            </span>
          </div>

          {/* Training Streak */}
          <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-center min-w-[120px]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Adherence Streak
            </span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-lg font-bold text-[#10B981] tabular-nums">
                {streakWeeks}
              </span>
              <span className="text-xs font-semibold text-neutral-500">
                {streakWeeks === 1 ? 'week' : 'weeks'}
              </span>
            </div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Consistent target compliance
            </span>
          </div>

          {/* Microcycle Status Indicator */}
          <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-center min-w-[120px]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Session Status
            </span>
            <div className="flex items-center space-x-1.5 mt-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  isGoalCompleted ? 'bg-[#10B981]' : weeklyRunsCount > 0 ? 'bg-[#0593C6]' : 'bg-neutral-400'
                }`}
              />
              <span className="text-xs font-bold text-neutral-900 dark:text-white">
                {isGoalCompleted ? 'Quota Met' : weeklyRunsCount > 0 ? 'In Progress' : 'Pending First Run'}
              </span>
            </div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              {profile.target6kTimeSeconds ? 'Target set' : 'Awaiting 6K goal'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
