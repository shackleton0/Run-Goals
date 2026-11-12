import React from 'react';
import { UserProfile } from '../types/running';
import { Activity, ChevronRight } from 'lucide-react';

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
    <div className="rounded-2xl bg-white dark:bg-[#0F1C28] border border-slate-200/95 dark:border-slate-700/75 shadow-sm p-5 transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Athlete Identity & Training Block */}
        <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#0593C6] text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-sm">
            <Activity className="w-5 h-5 stroke-[2.4]" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {runnerName}
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-sky-500/12 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/25">
                {level}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300 mt-1">
              <span className="font-medium">Cross Country · {targetDistKm.toFixed(1)}K Distance Target</span>
              <span aria-hidden="true">·</span>
              <span>3-Session Weekly Microcycle</span>
              {onOpenSettings && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    onClick={onOpenSettings}
                    className="inline-flex items-center text-sky-600 dark:text-sky-400 hover:underline font-bold cursor-pointer"
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
          {/* Microcycle Completion */}
          <div className="p-3 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60 flex flex-col justify-center min-w-[126px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
              Weekly Sessions
            </span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                {weeklyRunsCount}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                / {weeklyGoal} target
              </span>
            </div>
            <span className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">
              {isGoalCompleted ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Microcycle complete</span>
              ) : (
                <span>{runsRemaining} session{runsRemaining === 1 ? '' : 's'} remaining</span>
              )}
            </span>
          </div>

          {/* Training Streak */}
          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex flex-col justify-center min-w-[126px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Adherence Streak
            </span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {streakWeeks}
              </span>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {streakWeeks === 1 ? 'week' : 'weeks'}
              </span>
            </div>
            <span className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">
              Consistent compliance
            </span>
          </div>

          {/* Microcycle Status Indicator */}
          <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/50 flex flex-col justify-center min-w-[126px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Session Status
            </span>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                {isGoalCompleted ? 'Quota Met' : weeklyRunsCount > 0 ? 'In Progress' : 'Pending First Run'}
              </span>
            </div>
            <span className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">
              {profile.target6kTimeSeconds ? 'Target configured' : 'Awaiting 6K goal'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
