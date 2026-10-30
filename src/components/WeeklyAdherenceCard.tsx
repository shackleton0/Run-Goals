import React, { useState } from 'react';
import { RunRecord, WeeklyStat, AdherenceSummary } from '../types/running';
import { formatDuration, formatPace, KM_TO_MILES } from '../utils/runningCalculations';
import { Check, Plus, Calendar, Info, X, ChevronDown, ChevronUp } from 'lucide-react';

interface WeeklyAdherenceCardProps {
  weeklyStats: WeeklyStat[];
  adherence: AdherenceSummary;
  onOpenAddRun: () => void;
  unit: 'km' | 'miles';
  weeklyDistanceGoalKm?: number;
}

export const WeeklyAdherenceCard: React.FC<WeeklyAdherenceCardProps> = ({
  weeklyStats,
  adherence,
  onOpenAddRun,
  unit,
  weeklyDistanceGoalKm,
}) => {
  const [showTrainingGuide, setShowTrainingGuide] = useState(false);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);

  const currentWeek = weeklyStats[0];
  const currentWeekRuns: RunRecord[] = currentWeek ? currentWeek.runs : [];
  const currentWeekDistKm = currentWeek ? currentWeek.totalDistanceKm : 0;
  const currentWeekDistFormatted = unit === 'miles' ? (currentWeekDistKm * KM_TO_MILES).toFixed(1) : currentWeekDistKm.toFixed(1);
  const weeklyDistGoalFormatted = weeklyDistanceGoalKm
    ? (unit === 'miles' ? (weeklyDistanceGoalKm * KM_TO_MILES).toFixed(1) : weeklyDistanceGoalKm.toFixed(1))
    : null;

  const selectedWeek = selectedWeekKey ? weeklyStats.find((s) => s.weekKey === selectedWeekKey) : null;

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800/80 shadow-xs p-5 sm:p-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
              Weekly Training Schedule
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              {adherence.currentWeekRuns} of {adherence.weeklyGoal} Completed
            </span>
            {weeklyDistGoalFormatted && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#0a84ff]/10 text-[#0a84ff] tabular-nums">
                {currentWeekDistFormatted} / {weeklyDistGoalFormatted} {unit}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Consistent weekly workouts develop aerobic threshold and 6K race endurance
          </p>
        </div>

        <button
          onClick={() => setShowTrainingGuide(!showTrainingGuide)}
          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Info className="w-3.5 h-3.5 text-[#0a84ff]" />
          <span>{showTrainingGuide ? 'Hide XC Guide' : 'XC Training Framework'}</span>
        </button>
      </div>

      {/* Expandable Workout Blueprint */}
      {showTrainingGuide && (
        <div className="mb-5 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 space-y-2">
          <div className="font-semibold text-neutral-900 dark:text-white">
            Recommended Weekly Workout Distribution:
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
                    <span>{unit === 'miles' ? (run.distanceKm * KM_TO_MILES).toFixed(2) : run.distanceKm} {unit}</span>
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

      {/* Recent Weeks Consistency History - Press to view week runs */}
      {weeklyStats.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
            <span>RECENT WEEKS COMPLETED (PRESS TO VIEW RUNS)</span>
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-[#30d158]" />
                <span>3+ runs completed</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {weeklyStats.slice(0, 6).map((stat) => {
              const isSelected = selectedWeekKey === stat.weekKey;
              const distDisplay = unit === 'miles' ? (stat.totalDistanceKm * KM_TO_MILES).toFixed(1) : stat.totalDistanceKm.toFixed(1);

              return (
                <button
                  type="button"
                  key={stat.weekKey}
                  onClick={() => setSelectedWeekKey(isSelected ? null : stat.weekKey)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer text-left block w-full relative ${
                    isSelected
                      ? 'bg-[#0a84ff]/10 dark:bg-[#0a84ff]/15 border-[#0a84ff] shadow-xs ring-2 ring-[#0a84ff]/30'
                      : stat.goalMet
                      ? 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                      : 'bg-white dark:bg-black/30 border-neutral-200 dark:border-neutral-800/60 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                  title={`Click to view the ${stat.runs.length} runs in week of ${stat.weekStart}`}
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
                      {stat.runsCount} / {adherence.weeklyGoal}
                    </span>
                    {stat.goalMet && <Check className="w-3.5 h-3.5 text-[#30d158] stroke-[3]" />}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {distDisplay} {unit}
                  </div>
                  <div className="mt-1 text-[10px] text-[#0a84ff] font-medium flex items-center justify-center space-x-1">
                    <span>{isSelected ? 'Hide runs' : 'View runs'}</span>
                    {isSelected ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Expanded Runs That Make Up The Selected Week */}
          {selectedWeek && (
            <div className="mt-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/70 border border-[#0a84ff]/40 dark:border-[#0a84ff]/30 shadow-xs animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-neutral-900 dark:text-white">
                    <Calendar className="w-4 h-4 text-[#0a84ff]" />
                    <span>Runs for Week of {selectedWeek.weekStart}</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                    {selectedWeek.runs.length} {selectedWeek.runs.length === 1 ? 'workout' : 'workouts'}
                  </span>
                  <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 tabular-nums">
                    Total: {unit === 'miles' ? (selectedWeek.totalDistanceKm * KM_TO_MILES).toFixed(2) : selectedWeek.totalDistanceKm} {unit} · {formatDuration(selectedWeek.totalDurationSeconds)}
                  </span>
                  {selectedWeek.goalMet && (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#30d158]/15 text-[#30d158]">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Weekly Target Met</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedWeekKey(null)}
                  className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  title="Close week runs breakdown"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedWeek.runs.length === 0 ? (
                <div className="py-4 text-center text-xs text-neutral-400">
                  No workouts recorded during this week.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedWeek.runs.map((run, idx) => (
                    <div
                      key={run.id || idx}
                      className="p-3 rounded-lg bg-white dark:bg-black/50 border border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-neutral-900 dark:text-white truncate">
                            {run.title}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 flex-shrink-0">
                            {run.runType}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center space-x-2">
                          <span>{run.date}</span>
                          {run.notes && (
                            <>
                              <span>·</span>
                              <span className="truncate italic">"{run.notes}"</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 text-xs tabular-nums text-neutral-700 dark:text-neutral-300 flex-shrink-0 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-neutral-100 dark:border-neutral-800">
                        <div className="text-left sm:text-right">
                          <span className="font-bold text-neutral-900 dark:text-white">
                            {unit === 'miles' ? (run.distanceKm * KM_TO_MILES).toFixed(2) : run.distanceKm} {unit}
                          </span>
                        </div>
                        <span>·</span>
                        <div>
                          <span>{formatDuration(run.durationSeconds)}</span>
                        </div>
                        <span>·</span>
                        <div>
                          <span className="font-semibold text-[#30d158]">
                            {formatPace(run.averagePaceSecPerKm, unit)}
                          </span>
                        </div>
                        {run.avgHeartRate && (
                          <>
                            <span>·</span>
                            <div className="text-[#ff375f] font-medium flex items-center space-x-0.5">
                              <span>{run.avgHeartRate} bpm</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
