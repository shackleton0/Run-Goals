import React, { useState } from 'react';
import { RunRecord, RunType } from '../types/running';
import {
  formatDuration,
  formatPace,
  calculate6kEquivalent,
  calculatePaceSecPerKm,
  isAerobicRun,
  isIntervalRun,
} from '../utils/runningCalculations';
import {
  Trophy,
  Heart,
  Activity,
  Trash2,
  Search,
  Check,
  Watch,
  PlusCircle,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  Layers,
  CheckSquare,
  Square,
  X,
  Merge,
} from 'lucide-react';

interface RunListProps {
  runs: RunRecord[];
  unit: 'km' | 'miles';
  target6kSec?: number;
  onDeleteRun: (runId: string) => void;
  onUpdateRunCategory: (runId: string, newCategory: RunType) => void;
  onCombineRuns?: (combinedRun: RunRecord, sourceRunIds: string[]) => void;
  best6kSec?: number;
  onOpenGarminSync?: () => void;
  onOpenAddRun?: () => void;
}

export const RunList: React.FC<RunListProps> = ({
  runs,
  unit,
  target6kSec,
  onDeleteRun,
  onUpdateRunCategory,
  onCombineRuns,
  best6kSec,
  onOpenGarminSync,
  onOpenAddRun,
}) => {
  const [filterType, setFilterType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCombineMode, setIsCombineMode] = useState(false);
  const [selectedCombineIds, setSelectedCombineIds] = useState<Set<string>>(new Set());
  const [combinedTitle, setCombinedTitle] = useState('');
  const [combinedCategory, setCombinedCategory] = useState<RunType>('Aerobic');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const filterOptions = [
    'All',
    'Aerobic Runs',
    'Interval Training',
    '6K Time Trial',
    'Tempo',
    'Long Run',
    'Race',
  ];

  const categoryChoices: { label: string; value: RunType }[] = [
    { label: 'Aerobic Run', value: 'Aerobic' },
    { label: 'Interval Training', value: 'Interval Training' },
    { label: '6K Time Trial', value: '6K Time Trial' },
    { label: 'Tempo / Threshold', value: 'Tempo' },
    { label: 'Aerobic Long Run', value: 'Long Run' },
    { label: 'XC Race', value: 'Race' },
  ];

  const filteredRuns = runs.filter((run) => {
    let matchesType = true;
    if (filterType === 'Aerobic Runs') {
      matchesType = isAerobicRun(run.runType);
    } else if (filterType === 'Interval Training') {
      matchesType = isIntervalRun(run.runType);
    } else if (filterType !== 'All') {
      matchesType = run.runType === filterType;
    }

    const matchesSearch =
      !searchQuery.trim() ||
      run.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (run.notes && run.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      run.date.includes(searchQuery);

    return matchesType && matchesSearch;
  });

  const toggleSelectRunForCombine = (id: string) => {
    const next = new Set(selectedCombineIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedCombineIds(next);
  };

  // Selected runs to merge
  const selectedRunsForMerge = runs.filter((r) => selectedCombineIds.has(r.id));
  const mergedDistanceKm = selectedRunsForMerge.reduce((sum, r) => sum + r.distanceKm, 0);
  const mergedDurationSec = selectedRunsForMerge.reduce((sum, r) => sum + r.durationSeconds, 0);
  const mergedPaceSec = calculatePaceSecPerKm(mergedDistanceKm, mergedDurationSec);
  const merged6kSec = calculate6kEquivalent(mergedDistanceKm, mergedDurationSec);

  // Weighted HR / max HR
  const runsWithHr = selectedRunsForMerge.filter((r) => r.avgHeartRate);
  const mergedAvgHr =
    runsWithHr.length > 0
      ? Math.round(runsWithHr.reduce((sum, r) => sum + (r.avgHeartRate || 0), 0) / runsWithHr.length)
      : undefined;
  const mergedMaxHr = Math.max(
    ...selectedRunsForMerge.map((r) => r.maxHeartRate || 0).filter((h) => h > 0),
    0
  );
  const mergedElevation = selectedRunsForMerge.reduce(
    (sum, r) => sum + (r.elevationGainMeters || 0),
    0
  );

  const handleExecuteCombine = () => {
    if (selectedRunsForMerge.length < 2 || !onCombineRuns) return;

    // Pick latest date
    const latestDate = [...selectedRunsForMerge].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0].date;

    const defaultTitle = `Combined Workout (${selectedRunsForMerge.map((r) => r.title).join(' + ')})`;

    const combinedRecord: RunRecord = {
      id: `run_combined_${Date.now()}`,
      userId: selectedRunsForMerge[0].userId || 'local_user',
      date: latestDate,
      title: combinedTitle.trim() || defaultTitle,
      distanceKm: Number(mergedDistanceKm.toFixed(2)),
      durationSeconds: Math.round(mergedDurationSec),
      averagePaceSecPerKm: Math.round(mergedPaceSec),
      best6kTimeSeconds: merged6kSec,
      runType: combinedCategory,
      avgHeartRate: mergedAvgHr,
      maxHeartRate: mergedMaxHr > 0 ? mergedMaxHr : undefined,
      elevationGainMeters: mergedElevation > 0 ? mergedElevation : undefined,
      source: 'manual',
      notes: `Combined from ${selectedRunsForMerge.length} workouts: ${selectedRunsForMerge.map((r) => r.title).join(', ')}`,
      createdAt: new Date().toISOString(),
    };

    onCombineRuns(combinedRecord, Array.from(selectedCombineIds));
    setSelectedCombineIds(new Set());
    setIsCombineMode(false);
    setCombinedTitle('');
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800/80 shadow-xs p-5 sm:p-6 transition-colors">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
              Workout History
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {filteredRuns.length}
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Log of completed workouts with inline categories and workout combining
          </p>
        </div>

        {/* Search & Combine Action */}
        <div className="flex items-center space-x-2">
          {runs.length >= 2 && onCombineRuns && (
            <button
              onClick={() => {
                setIsCombineMode(!isCombineMode);
                setSelectedCombineIds(new Set());
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                isCombineMode
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
              }`}
            >
              <Merge className="w-3.5 h-3.5" />
              <span>{isCombineMode ? 'Cancel Combine' : 'Combine Workouts'}</span>
            </button>
          )}

          {/* Search */}
          <div className="relative min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search workouts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-[#30d158]"
            />
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      {runs.length > 0 && (
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {filterOptions.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filterType === type
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                  : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Combine Floating Action Banner when in Combine Mode */}
      {isCombineMode && (
        <div className="mb-4 p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Merge className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="font-bold text-xs text-purple-950 dark:text-purple-200">
                  Combine Multiple Workouts
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-200/70 dark:bg-purple-800 text-purple-900 dark:text-purple-100 font-semibold tabular-nums">
                  {selectedCombineIds.size} selected
                </span>
              </div>
              <p className="text-[11px] text-purple-700 dark:text-purple-300 mt-1">
                Select 2 or more workouts to merge their distances, times, and metrics into a single unified session.
              </p>
            </div>

            {selectedRunsForMerge.length >= 2 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExecuteCombine}
                  className="px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Merge {selectedCombineIds.size} Workouts</span>
                </button>
              </div>
            )}
          </div>

          {/* Merge Live Preview Card */}
          {selectedRunsForMerge.length >= 2 && (
            <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-white/80 dark:bg-black/50">
                <span className="text-[10px] text-neutral-500 block uppercase">Total Distance</span>
                <span className="font-bold text-neutral-900 dark:text-white tabular-nums">
                  {mergedDistanceKm.toFixed(2)} km
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white/80 dark:bg-black/50">
                <span className="text-[10px] text-neutral-500 block uppercase">Total Duration</span>
                <span className="font-bold text-neutral-900 dark:text-white tabular-nums">
                  {formatDuration(mergedDurationSec)}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white/80 dark:bg-black/50">
                <span className="text-[10px] text-neutral-500 block uppercase">Combined Pace</span>
                <span className="font-bold text-neutral-900 dark:text-white tabular-nums">
                  {formatPace(mergedPaceSec, unit)}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white/80 dark:bg-black/50">
                <span className="text-[10px] text-neutral-500 block uppercase">New 6K Time</span>
                <span className="font-bold text-[#30d158] tabular-nums">
                  {formatDuration(merged6kSec)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Runs List or Empty State */}
      {runs.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
          <Activity className="w-8 h-8 text-neutral-400 dark:text-neutral-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            No Runs Recorded Yet
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1 mb-4">
            Upload your Garmin Connect workout file or tap Log Run to start tracking your cross country training.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onOpenGarminSync && (
              <button
                onClick={onOpenGarminSync}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#0a84ff] hover:bg-[#0071e3] text-white cursor-pointer shadow-xs"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Garmin Data</span>
              </button>
            )}
            {onOpenAddRun && (
              <button
                onClick={onOpenAddRun}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Log Run</span>
              </button>
            )}
          </div>
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="py-8 text-center text-xs text-neutral-400">
          No workouts match this filter.
        </div>
      ) : (
        <div className="space-y-2.5">
          {(isExpanded || isCombineMode ? filteredRuns : filteredRuns.slice(0, 3)).map((run) => {
            const eq6k =
              run.best6kTimeSeconds || calculate6kEquivalent(run.distanceKm, run.durationSeconds);
            const isPr = best6kSec && eq6k === best6kSec;
            const beatsTarget = Boolean(target6kSec && target6kSec > 0 && eq6k <= target6kSec);
            const isCheckedForCombine = selectedCombineIds.has(run.id);

            return (
              <div
                key={run.id}
                onClick={() => {
                  if (isCombineMode) toggleSelectRunForCombine(run.id);
                }}
                className={`p-3.5 rounded-xl border transition-all ${
                  isCombineMode ? 'cursor-pointer' : ''
                } ${
                  isCheckedForCombine
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 dark:border-purple-600 shadow-xs'
                    : 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {/* Left: Checkbox (if in combine mode) + Icon + Title + Category Selector */}
                  <div className="flex items-start space-x-3 min-w-0">
                    {isCombineMode && (
                      <div className="mt-1 flex-shrink-0 text-purple-600">
                        {isCheckedForCombine ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-400" />
                        )}
                      </div>
                    )}

                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-0.5 ${
                        isIntervalRun(run.runType)
                          ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                          : isAerobicRun(run.runType)
                          ? 'bg-[#0a84ff]/15 text-[#0a84ff]'
                          : 'bg-[#30d158]/15 text-[#30d158]'
                      }`}
                    >
                      <Activity className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-sm text-neutral-900 dark:text-white truncate">
                          {run.title}
                        </span>

                        {/* Interactive Category Selector Dropdown */}
                        <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={run.runType}
                            onChange={(e) => onUpdateRunCategory(run.id, e.target.value as RunType)}
                            aria-label={`Change category for ${run.title}`}
                            className="appearance-none text-[11px] font-semibold pl-2 pr-5 py-0.5 rounded-full bg-neutral-200/80 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-none cursor-pointer focus:outline-none hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                          >
                            {categoryChoices.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 text-neutral-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {run.source.startsWith('garmin') && (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#0a84ff]/10 text-[#0a84ff]">
                            <Watch className="w-2.5 h-2.5" />
                            <span>Tracker</span>
                          </span>
                        )}
                        {isPr && (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#30d158]/15 text-[#30d158]">
                            <Trophy className="w-2.5 h-2.5" />
                            <span>PR</span>
                          </span>
                        )}
                        {beatsTarget && (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#0a84ff]/10 text-[#0a84ff]">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            <span>Sub-Goal</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center space-x-2">
                        <span>{run.date}</span>
                        {run.notes && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-sm italic">"{run.notes}"</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Telemetry & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-11 sm:pl-0 tabular-nums">
                    {/* Distance & Duration */}
                    <div className="text-left sm:text-right">
                      <div className="text-sm font-bold text-neutral-900 dark:text-white">
                        {run.distanceKm} km
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        {formatDuration(run.durationSeconds)}
                      </div>
                    </div>

                    {/* Pace */}
                    <div className="text-left sm:text-right">
                      <div className="text-xs font-semibold text-neutral-900 dark:text-white">
                        {formatPace(run.averagePaceSecPerKm, unit)}
                      </div>
                      <div className="text-[10px] text-neutral-400 uppercase">Pace</div>
                    </div>

                    {/* 6K Equivalent */}
                    <div className="text-left sm:text-right">
                      <div className="text-xs font-bold text-[#30d158]">
                        {formatDuration(eq6k)}
                      </div>
                      <div className="text-[10px] text-neutral-400 uppercase">6K Time</div>
                    </div>

                    {/* HR Pill */}
                    {run.avgHeartRate && (
                      <div className="hidden md:flex items-center space-x-1 text-xs text-[#ff375f]">
                        <Heart className="w-3 h-3" />
                        <span>{run.avgHeartRate}</span>
                      </div>
                    )}

                    {/* Delete (hidden when in combine mode) */}
                    {!isCombineMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRun(run.id);
                        }}
                        className="p-1.5 rounded-full text-neutral-400 hover:text-rose-500 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                        title="Delete run"
                        aria-label={`Delete ${run.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Dropdown toggle to expand/collapse when more than 3 workouts */}
          {filteredRuns.length > 3 && !isCombineMode && (
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-neutral-100 dark:border-neutral-800/80">
              <span className="text-xs text-neutral-500">
                {isExpanded
                  ? `Showing all ${filteredRuns.length} workouts`
                  : `Showing 3 most recent workouts (${filteredRuns.length - 3} older workouts collapsed)`}
              </span>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer"
              >
                <span>{isExpanded ? 'Show 3 Most Recent Only' : `Show All Workouts (${filteredRuns.length})`}</span>
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
