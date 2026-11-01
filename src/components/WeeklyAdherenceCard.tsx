import React, { useState } from 'react';
import { RunRecord, WeeklyStat, AdherenceSummary } from '../types/running';
import {
  formatDuration,
  formatPace,
  KM_TO_MILES,
  isIntervalRun,
  isAerobicRun,
  getIsoWeekKey,
} from '../utils/runningCalculations';
import { Check, Plus, Calendar, Info, Zap, Gauge, Heart } from 'lucide-react';

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

  // Compute Current Week Monday - Sunday Date Range
  const now = new Date();
  const currentDayNr = (now.getDay() + 6) % 7; // 0 = Monday, 6 = Sunday
  const monday = new Date(now);
  monday.setDate(now.getDate() - currentDayNr);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const formattedMonday = `${monthNames[monday.getMonth()]} ${monday.getDate()}`;
  const formattedSunday = `${monthNames[sunday.getMonth()]} ${sunday.getDate()}`;
  const weekRangeDisplay = `Mon ${formattedMonday} – Sun ${formattedSunday}`;

  // Current Week Runs (ISO week match or first available week stat)
  const currentIsoKey = getIsoWeekKey(now.toISOString()).key;
  const currentWeek =
    weeklyStats.find((s) => s.weekKey === currentIsoKey) || weeklyStats[0];
  const currentWeekRuns: RunRecord[] = currentWeek ? currentWeek.runs : [];

  const currentWeekDistKm = currentWeek ? currentWeek.totalDistanceKm : 0;
  const currentWeekDistFormatted =
    unit === 'miles'
      ? (currentWeekDistKm * KM_TO_MILES).toFixed(1)
      : currentWeekDistKm.toFixed(1);
  const weeklyDistGoalFormatted = weeklyDistanceGoalKm
    ? unit === 'miles'
      ? (weeklyDistanceGoalKm * KM_TO_MILES).toFixed(1)
      : weeklyDistanceGoalKm.toFixed(1)
    : null;

  // The 3 mandatory weekly run slots:
  // 1. Interval
  // 2. 6K Threshold Tempo
  // 3. Aerobic Long Run
  const expectedSlots = [
    {
      id: 'interval',
      slotNumber: 1,
      name: 'Interval',
      expectedLabel: 'Speed / Intervals',
      expectedDescription: '5x1000m or 4x1200m repetitions at 6K goal race pace',
      accentColor: 'text-[#10B981]',
      icon: Zap,
      matcher: (r: RunRecord) =>
        r.runType === 'Interval Training' ||
        isIntervalRun(r.runType) ||
        /interval|track|repeat|speed/i.test(r.title),
    },
    {
      id: 'tempo',
      slotNumber: 2,
      name: '6K Threshold Tempo',
      expectedLabel: '6K Threshold Tempo',
      expectedDescription: 'Sustained 5K–6.5K run at lactate threshold to elevate stamina',
      accentColor: 'text-[#0593C6]',
      icon: Gauge,
      matcher: (r: RunRecord) =>
        r.runType === 'Tempo' ||
        r.runType === 'Time Trial' ||
        r.runType === '6K Time Trial' ||
        r.runType === 'Race' ||
        /tempo|threshold|trial|race/i.test(r.title),
    },
    {
      id: 'long_run',
      slotNumber: 3,
      name: 'Aerobic Long Run',
      expectedLabel: 'Aerobic Long Run',
      expectedDescription: '9–12 km continuous aerobic volume building race stamina',
      accentColor: 'text-[#0593C6]',
      icon: Heart,
      matcher: (r: RunRecord) =>
        r.runType === 'Long Run' ||
        (r.distanceKm >= 8 && isAerobicRun(r.runType)) ||
        /long/i.test(r.title) ||
        r.runType === 'Aerobic',
    },
  ];

  // Assign uploaded/logged runs to the 3 slots for this current week
  const assignedSlots: { slot: (typeof expectedSlots)[0]; run: RunRecord | null }[] = [];
  const usedRunIds = new Set<string>();

  // Pass 1: Categorical / specialty match
  expectedSlots.forEach((slot) => {
    const matched = currentWeekRuns.find(
      (r) => !usedRunIds.has(r.id) && slot.matcher(r)
    );
    if (matched) {
      usedRunIds.add(matched.id);
      assignedSlots.push({ slot, run: matched });
    } else {
      assignedSlots.push({ slot, run: null });
    }
  });

  // Pass 2: Fill open slots with any other logged runs from this current week
  assignedSlots.forEach((item) => {
    if (!item.run) {
      const remainingRun = currentWeekRuns.find((r) => !usedRunIds.has(r.id));
      if (remainingRun) {
        usedRunIds.add(remainingRun.id);
        item.run = remainingRun;
      }
    }
  });

  const completedCount = assignedSlots.filter((s) => !!s.run).length;

  return (
    <div className="rounded-2xl bg-[#FCFFFF] dark:bg-[#12222f] border border-neutral-200/90 dark:border-neutral-800 shadow-xs p-5 sm:p-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-[#FCFFFF] tracking-tight">
              Weekly Training Schedule
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0593C6]/10 text-[#0593C6]">
              {completedCount} of 3 Completed
            </span>
            {weeklyDistGoalFormatted && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] dark:text-[#34d399] tabular-nums">
                {currentWeekDistFormatted} / {weeklyDistGoalFormatted} {unit}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            <Calendar className="w-3.5 h-3.5 text-[#0593C6]" />
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              Current Week (Mon – Sun):
            </span>
            <span className="text-[#0593C6] font-semibold">{weekRangeDisplay}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowTrainingGuide(!showTrainingGuide)}
          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Info className="w-3.5 h-3.5 text-[#0593C6]" />
          <span>{showTrainingGuide ? 'Hide Guide' : 'XC Training Framework'}</span>
        </button>
      </div>

      {/* Expandable Workout Blueprint */}
      {showTrainingGuide && (
        <div className="mb-5 p-4 rounded-xl bg-[#F2F8FB] dark:bg-[#0e1b25] border border-[#0593C6]/20 dark:border-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 space-y-2 animate-in fade-in duration-150">
          <div className="font-semibold text-neutral-900 dark:text-[#FCFFFF]">
            Current Week Required Workout Distribution:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-[#FCFFFF] dark:bg-[#12222f] border border-neutral-200/80 dark:border-neutral-800">
              <span className="font-semibold text-[#10B981] block mb-1">1. Interval</span>
              <p className="text-neutral-500 dark:text-neutral-400 text-[11px]">
                5x1000m or 4x1200m at goal 6K pace to sharpen turnover and race efficiency.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#FCFFFF] dark:bg-[#12222f] border border-neutral-200/80 dark:border-neutral-800">
              <span className="font-semibold text-[#0593C6] block mb-1">2. 6K Threshold Tempo</span>
              <p className="text-neutral-500 dark:text-neutral-400 text-[11px]">
                Sustained 5K–6.5K tempo run at lactate threshold to elevate aerobic stamina.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#FCFFFF] dark:bg-[#12222f] border border-neutral-200/80 dark:border-neutral-800">
              <span className="font-semibold text-[#0593C6] block mb-1">3. Aerobic Long Run</span>
              <p className="text-neutral-500 dark:text-neutral-400 text-[11px]">
                9–12 km conversational trail or turf run building stamina for late-race surges.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Exclusively shows the 3 required runs for this current week Mon - Sun */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {assignedSlots.map(({ slot, run }) => {
          const isDone = !!run;
          const Icon = slot.icon;

          if (!isDone) {
            // Greyed out placeholder box
            return (
              <div
                key={slot.id}
                className="p-4 rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 bg-[#F2F8FB]/50 dark:bg-[#0e1b25]/40 flex flex-col justify-between min-h-[175px] opacity-75 hover:opacity-90 transition-opacity"
              >
                <div>
                  {/* Placeholder Header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center space-x-1.5 text-neutral-400 dark:text-neutral-500">
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        Slot {slot.slotNumber}
                      </span>
                      <span>·</span>
                      <span className="text-xs font-semibold">
                        {slot.name}
                      </span>
                    </div>

                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-500 dark:text-neutral-400 border border-neutral-300/40 dark:border-neutral-700/40">
                      Not Completed
                    </span>
                  </div>

                  {/* Placeholder Body */}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      <Icon className="w-3.5 h-3.5 shrink-0 text-neutral-400 dark:text-neutral-500" />
                      <span>Expected: {slot.expectedLabel}</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 leading-relaxed">
                      {slot.expectedDescription}
                    </p>
                  </div>
                </div>

                {/* Placeholder Footer Action */}
                <div className="pt-3 mt-2 border-t border-dashed border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 italic">
                    Pending this week (Mon – Sun)
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
          return (
            <div
              key={slot.id}
              className="p-4 rounded-xl border border-[#0593C6]/25 dark:border-neutral-800 bg-[#FCFFFF] dark:bg-[#12222f] shadow-xs flex flex-col justify-between min-h-[175px] transition-all"
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

                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#0593C6]/15 text-[#0593C6]">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Completed</span>
                  </span>
                </div>

                {/* Completed Body */}
                <div className="space-y-1.5 mt-1">
                  <div className="font-bold text-sm text-neutral-900 dark:text-[#FCFFFF] truncate">
                    {run.title}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 tabular-nums">
                    <span className="font-bold text-neutral-900 dark:text-[#FCFFFF]">
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
    </div>
  );
};
