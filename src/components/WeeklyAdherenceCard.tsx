import React, { useState } from 'react';
import { RunRecord, WeeklyStat, AdherenceSummary } from '../types/running';
import { formatDuration, formatPace } from '../utils/runningCalculations';
import { Check, Plus, Calendar, Info } from 'lucide-react';

interface WeeklyAdherenceCardProps {
  weeklyStats: WeeklyStat[];
  adherence: AdherenceSummary;
  onOpenAddRun: () => void;
  unit: 'km' | 'miles';
}

export const WeeklyAdherenceCard: React.FC<WeeklyAdherenceCardProps> = ({
  weeklyStats,
  adherence,
  onOpenAddRun,
  unit,
}) => {
  const [showTrainingGuide, setShowTrainingGuide] = useState(false);

  const currentWeek = weeklyStats[0];
  const currentWeekRuns: RunRecord[] = currentWeek ? currentWeek.runs : [];

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800/80 shadow-xs p-5 sm:p-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
              3 Runs / Week Schedule
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              {adherence.currentWeekRuns} of {adherence.weeklyGoal} Completed
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Consistent 3 runs each week develops aerobic threshold and 6K race endurance
          </p>
        </div>

        <button
          onClick={() => setShowTrainingGuide(!showTrainingGuide)}
          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Info className="w-3.5 h-3.5 text-[#0a84ff]" />
          <span>{showTrainingGuide ? 'Hide XC Guide' : '3-Run XC Framework'}</span>
        </button>
      </div>

      {/* Expandable 3-Run Blueprint */}
      {showTrainingGuide && (
        <div className="mb-5 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 space-y-2">
          <div className="font-semibold text-neutral-900 dark:text-white">
            Recommended 3-Run Weekly Distribution:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-white dark:bg-black/50 border border-neutral-200/80 dark:border-neutral-800">
              <span className="font-semibold text-[#30d158] block mb-1">1. Speed / Intervals</span>
              <p className="text-neutral-500 dark:text-neutral-400 text-[11px]">
                5x1000m or 4x1200m at goal 6K pace to sharpen turnover and race efficiency.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white dark:bg-black/50 border border-neutral-200/80 dark:border-neutral-800">
              <span className="font-semibold text-[#0a84ff] block mb-1">2. 6K Threshold Tempo</span>
              <p className="text-neutral-500 dark:text-neutral-400 text-[11px]">
                Sustained 5K-6.5K tempo run at lactate threshold to elevate aerobic stamina.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white dark:bg-black/50 border border-neutral-200/80 dark:border-neutral-800">
              <span className="font-semibold text-[#ff9f0a] block mb-1">3. Aerobic Long Run</span>
              <p className="text-neutral-500 dark:text-neutral-400 text-[11px]">
                9-12 km conversational trail or turf run building stamina for late-race surges.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3 Run Slots (Apple Activity Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[0, 1, 2].map((index) => {
          const run = currentWeekRuns[index];
          const isDone = !!run;

          return (
            <div
              key={index}
              className={`p-4 rounded-xl border transition-all ${
                isDone
                  ? 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200/90 dark:border-neutral-800'
                  : 'bg-white dark:bg-black/40 border-dashed border-neutral-300 dark:border-neutral-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  Run #{index + 1}
                </span>
                {isDone ? (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#30d158]/15 text-[#30d158]">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Done</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                    Pending
                  </span>
                )}
              </div>

              {isDone ? (
                <div>
                  <div className="font-bold text-sm text-neutral-900 dark:text-white truncate">
                    {run.title}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-neutral-600 dark:text-neutral-300 mt-1 tabular-nums">
                    <span>{run.distanceKm} km</span>
                    <span>·</span>
                    <span>{formatDuration(run.durationSeconds)}</span>
                    <span>·</span>
                    <span className="text-[#30d158] font-semibold">
                      {formatPace(run.averagePaceSecPerKm, unit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span className="px-1.5 py-0.5 rounded bg-neutral-200/60 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium">
                      {run.runType}
                    </span>
                    <span>{run.date}</span>
                  </div>
                </div>
              ) : (
                <div className="py-2 text-center">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                    Slot ready for this week
                  </p>
                  <button
                    onClick={onOpenAddRun}
                    className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Log / Sync</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Weeks Consistency History */}
      {weeklyStats.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
            <span>RECENT WEEKS</span>
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-[#30d158]" />
                <span>3+ runs completed</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {weeklyStats.slice(0, 6).map((stat) => (
              <div
                key={stat.weekKey}
                className={`p-2.5 rounded-xl border text-center transition-colors ${
                  stat.goalMet
                    ? 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800'
                    : 'bg-white dark:bg-black/30 border-neutral-200 dark:border-neutral-800/60'
                }`}
              >
                <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  {stat.weekStart}
                </div>
                <div className="flex items-center justify-center space-x-1 my-1">
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      stat.goalMet ? 'text-[#30d158]' : 'text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {stat.runsCount} / 3
                  </span>
                  {stat.goalMet && <Check className="w-3.5 h-3.5 text-[#30d158] stroke-[3]" />}
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                  {stat.totalDistanceKm} km
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
