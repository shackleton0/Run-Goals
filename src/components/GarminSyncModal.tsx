import React, { useState, useEffect } from 'react';
import { RunRecord, RunType } from '../types/running';
import {
  parseGarminCsv,
  parseTcx,
  parseGpx,
  formatDuration,
  formatPace,
} from '../utils/runningCalculations';
import {
  X,
  UploadCloud,
  Watch,
  Check,
  AlertCircle,
  HelpCircle,
  CheckSquare,
  Square,
  Search,
  Heart,
  Activity,
  ArrowLeft,
  ChevronRight,
  Zap,
  Mountain,
} from 'lucide-react';
import { IntervalCalibrationModal } from './IntervalCalibrationModal';

interface GarminSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  unit?: 'km' | 'miles';
  initialIncomingRuns?: RunRecord[];
  onProcessIncomingRuns: (runs: RunRecord[]) => void;
  savedDefaultInterval?: {
    targetIntervalPaceSecPerKm?: number;
    repDistanceMeters?: number;
    restDurationSeconds?: number;
    repCount?: number;
  };
  onSaveDefaultInterval?: (defaults: {
    targetIntervalPaceSecPerKm?: number;
    repDistanceMeters?: number;
    restDurationSeconds?: number;
    repCount?: number;
  }) => void;
}

export const GarminSyncModal: React.FC<GarminSyncModalProps> = ({
  isOpen,
  onClose,
  userId,
  unit = 'km',
  initialIncomingRuns,
  onProcessIncomingRuns,
  savedDefaultInterval,
  onSaveDefaultInterval,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'selection' | 'instructions'>('upload');

  // Parsed activities from uploaded file(s)
  const [parsedActivities, setParsedActivities] = useState<RunRecord[]>([]);
  // Set of selected activity IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Search query in selection screen
  const [searchFilter, setSearchFilter] = useState('');
  const [fileName, setFileName] = useState<string>('');
  // Run being calibrated for intervals & rest
  const [calibratingRun, setCalibratingRun] = useState<RunRecord | null>(null);

  const handleUpdateParsedRun = (runId: string, updatedFields: Partial<RunRecord>) => {
    setParsedActivities((prev) =>
      prev.map((r) => (r.id === runId ? { ...r, ...updatedFields } : r))
    );
  };

  useEffect(() => {
    if (initialIncomingRuns && initialIncomingRuns.length > 0) {
      setParsedActivities(initialIncomingRuns);
      setSelectedIds(new Set(initialIncomingRuns.map((r) => r.id)));
      setActiveTab('selection');
    }
  }, [initialIncomingRuns]);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setErrorMsg(null);
    setImportStatus(`Parsing ${file.name}...`);
    setFileName(file.name);

    try {
      const text = await file.text();
      const ext = file.name.split('.').pop()?.toLowerCase();

      let parsedRuns: RunRecord[] = [];

      if (ext === 'csv') {
        parsedRuns = parseGarminCsv(text, userId);
      } else if (ext === 'tcx') {
        const run = parseTcx(text, userId, file.name);
        if (run) parsedRuns = [run];
      } else if (ext === 'gpx') {
        const run = parseGpx(text, userId, file.name);
        if (run) parsedRuns = [run];
      } else {
        if (text.includes('<TrainingCenterDatabase') || text.includes('<Activity')) {
          const run = parseTcx(text, userId, file.name);
          if (run) parsedRuns = [run];
        } else if (text.includes('<gpx')) {
          const run = parseGpx(text, userId, file.name);
          if (run) parsedRuns = [run];
        } else if (text.includes('Activity Type') || text.includes('Distance')) {
          parsedRuns = parseGarminCsv(text, userId);
        } else {
          // Check for JSON
          try {
            const rawJson = JSON.parse(text);
            const items = Array.isArray(rawJson) ? rawJson : [rawJson];
            const jsonRuns = items.filter((item: any) => item && (item.distanceKm || item.distance));
            if (jsonRuns.length > 0) {
              parsedRuns = jsonRuns.map((j: any, idx: number) => ({
                id: j.id || `garmin_json_${Date.now()}_${idx}`,
                userId,
                date: j.date || new Date().toISOString().split('T')[0],
                title: j.title || 'Garmin Run',
                distanceKm: Number(j.distanceKm || (j.distance ? j.distance / 1000 : 5)),
                durationSeconds: Number(j.durationSeconds || j.duration || 1200),
                averagePaceSecPerKm: Number(j.averagePaceSecPerKm || 240),
                runType: j.runType || 'Aerobic',
                avgHeartRate: j.avgHeartRate || j.averageHeartRate,
                maxHeartRate: j.maxHeartRate || j.maximumHeartRate,
                avgCadence: j.avgCadence || j.cadence,
                elevationGainMeters: j.elevationGainMeters || j.elevationGain,
                source: 'garmin',
                garminActivityId: j.garminActivityId || j.activityId,
              }));
            }
          } catch {
            // Not JSON
          }
        }
      }

      if (!parsedRuns || parsedRuns.length === 0) {
        throw new Error('No valid running activities found in this file. Please verify it is an exported Garmin activity file (.csv, .tcx, .gpx).');
      }

      // Transition to selection view
      setParsedActivities(parsedRuns);
      // Select all by default so user can deselect what they don't want
      setSelectedIds(new Set(parsedRuns.map((r) => r.id)));
      setImportStatus(null);
      setActiveTab('selection');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse file.');
      setImportStatus(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === parsedActivities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(parsedActivities.map((r) => r.id)));
    }
  };

  const toggleSelectRun = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleConfirmUpload = () => {
    const selectedRuns = parsedActivities.filter((r) => selectedIds.has(r.id));
    if (selectedRuns.length === 0) return;

    onProcessIncomingRuns(selectedRuns);
    onClose();
  };

  const handleResetToUpload = () => {
    setParsedActivities([]);
    setSelectedIds(new Set());
    setSearchFilter('');
    setErrorMsg(null);
    setImportStatus(null);
    setActiveTab('upload');
  };

  const handleToggleHill = (id: string) => {
    setParsedActivities((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const isCurrentlyHill = r.runType === 'Hill Repeats' || r.runType === 'Hill Run';
          return {
            ...r,
            runType: isCurrentlyHill ? 'Aerobic' : 'Hill Repeats',
          };
        }
        return r;
      })
    );
  };

  const handleUpdateRunType = (id: string, newType: RunType) => {
    setParsedActivities((prev) =>
      prev.map((r) => (r.id === id ? { ...r, runType: newType } : r))
    );
  };

  const filteredActivities = parsedActivities.filter((r) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.date.includes(q) || r.runType.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#0a84ff]/10 text-[#0a84ff] flex items-center justify-center">
              <Watch className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                {activeTab === 'selection' ? 'Select Garmin Activities to Upload' : 'Garmin Data Sync'}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {activeTab === 'selection'
                  ? `Choose which workouts to import (${selectedIds.size} of ${parsedActivities.length} selected)`
                  : 'Upload your Garmin Connect workout files to track 6K progress'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Control - Only in upload/instructions mode */}
        {activeTab !== 'selection' && (
          <div className="flex p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-xs font-semibold my-4 flex-shrink-0">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Upload Garmin File
            </button>
            <button
              onClick={() => setActiveTab('instructions')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'instructions'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Export Help
            </button>
          </div>
        )}

        {/* Tab 1: Upload View */}
        {activeTab === 'upload' && (
          <div className="space-y-4 py-2">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`p-8 text-center rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                dragOver
                  ? 'border-[#0a84ff] bg-[#0a84ff]/5'
                  : 'border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-black/40 hover:border-neutral-400 dark:hover:border-neutral-600'
              }`}
              onClick={() => document.getElementById('garmin-file-input')?.click()}
            >
              <input
                id="garmin-file-input"
                type="file"
                accept=".csv,.tcx,.gpx,.json,.fit"
                className="hidden"
                onChange={handleFileInput}
              />
              <UploadCloud className="w-10 h-10 text-[#0a84ff] mx-auto mb-2" />
              <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
                Drop your Garmin Connect file here, or click to browse
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                Supports Garmin .CSV (Activities Export), .TCX, and .GPX files
              </p>
              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                You can select and preview individual activities before uploading
              </span>
            </div>

            {importStatus && (
              <div className="p-3 rounded-xl bg-[#30d158]/15 text-[#30d158] text-xs font-medium flex items-center space-x-2">
                <Check className="w-4 h-4 flex-shrink-0 stroke-[3]" />
                <span>{importStatus}</span>
              </div>
            )}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/15 text-rose-500 text-xs font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Activity Selection Step */}
        {activeTab === 'selection' && (
          <div className="flex-1 flex flex-col min-h-0 py-2 space-y-3">
            {/* Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 flex-shrink-0 bg-neutral-50 dark:bg-neutral-900/60 p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
              <div className="flex items-center space-x-3">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center space-x-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:text-[#0a84ff] cursor-pointer"
                >
                  {selectedIds.size === parsedActivities.length ? (
                    <CheckSquare className="w-4 h-4 text-[#30d158]" />
                  ) : (
                    <Square className="w-4 h-4 text-neutral-400" />
                  )}
                  <span>{selectedIds.size === parsedActivities.length ? 'Deselect All' : 'Select All'}</span>
                </button>

                <span className="text-xs text-neutral-400">|</span>

                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 tabular-nums">
                  <strong className="text-neutral-900 dark:text-white">{selectedIds.size}</strong> of {parsedActivities.length} selected
                </span>
              </div>

              {/* Search filter for large CSVs */}
              {parsedActivities.length > 4 && (
                <div className="relative min-w-[180px]">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filter activities..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-[#30d158]"
                  />
                </div>
              )}
            </div>

            {/* Prompt for Detected Interval Sessions */}
            {(() => {
              const detectedIntervals = parsedActivities.filter(
                (r) =>
                  r.runType === 'Intervals' ||
                  r.runType === 'Interval Training' ||
                  Boolean(r.activeIntervalPaceSecPerKm) ||
                  /interval|repeat|track|reps|400m|1000m|1200m|1600m/i.test(r.title)
              );
              if (detectedIntervals.length === 0) return null;
              const uncalibrated = detectedIntervals.filter((r) => !r.activeIntervalPaceSecPerKm);

              return (
                <div className="p-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
                  <div className="flex items-start space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs">
                          {uncalibrated.length > 0
                            ? `Interval Session Detected (${uncalibrated.length} need calibration)`
                            : 'All Interval Sessions Calibrated'}
                        </span>
                        {uncalibrated.length === 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                            Rest Stripped
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80 block leading-tight">
                        Garmin average pace is ruined by rest periods. Input your aimed interval pace, distance per set, and rest time to deduct rest and save your true speed.
                      </span>
                    </div>
                  </div>
                  {uncalibrated.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCalibratingRun(uncalibrated[0])}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs shrink-0 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Zap className="w-3.5 h-3.5 fill-black" />
                      <span>Calibrate Interval Pace & Rest</span>
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Scrollable Activities Selection List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {filteredActivities.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400">
                  No activities match your search.
                </div>
              ) : (
                filteredActivities.map((run) => {
                  const isChecked = selectedIds.has(run.id);

                  const isInterval = run.runType === 'Intervals' || run.runType === 'Interval Training' || !!run.activeIntervalPaceSecPerKm || /interval|repeat|track|reps/i.test(run.title);

                  return (
                    <div
                      key={run.id}
                      onClick={() => toggleSelectRun(run.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs select-none ${
                        isChecked
                          ? 'bg-neutral-50 dark:bg-neutral-900/80 border-[#30d158]/50 dark:border-[#30d158]/40 shadow-xs'
                          : 'bg-white dark:bg-black/40 border-neutral-200 dark:border-neutral-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {/* Left: Checkbox + Title + Meta */}
                      <div className="flex items-start space-x-3 min-w-0 flex-1">
                        <div className="flex-shrink-0 mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#30d158]" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-400" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-neutral-900 dark:text-white truncate">
                              {run.title}
                            </span>

                            {/* Interactive Category Selector Dropdown */}
                            <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={run.runType}
                                onChange={(e) => handleUpdateRunType(run.id, e.target.value as RunType)}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-200/80 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-none cursor-pointer focus:outline-none hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                              >
                                <option value="Aerobic">Aerobic / Easy</option>
                                <option value="Tempo">Tempo / Threshold</option>
                                <option value="Intervals">Track Intervals</option>
                                <option value="Hill Repeats">Hill Repeats</option>
                                <option value="Hill Run">Hill Run</option>
                                <option value="Long Run">Long Run</option>
                                <option value="6K Time Trial">6K Time Trial</option>
                                <option value="Race">Race</option>
                              </select>
                            </div>

                            {/* Quick Option to toggle Hill Workout */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleHill(run.id);
                              }}
                              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                                run.runType === 'Hill Repeats' || run.runType === 'Hill Run'
                                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 font-bold'
                                  : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 border border-neutral-200 dark:border-neutral-700'
                              }`}
                              title="Option to label as Hill Workout"
                            >
                              <Mountain className="w-2.5 h-2.5 text-amber-500" />
                              <span>{run.runType === 'Hill Repeats' || run.runType === 'Hill Run' ? 'Hill Workout ✓' : '+ Hill Option'}</span>
                            </button>

                            {run.activeIntervalPaceSecPerKm && (
                              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center space-x-1">
                                <Zap className="w-2.5 h-2.5" />
                                <span>Rest Excluded (-{formatDuration(run.totalRestSeconds || 0)})</span>
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center gap-2">
                            <span>{run.date}</span>
                            {run.elevationGainMeters !== undefined && run.elevationGainMeters > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-amber-600 dark:text-amber-400 font-medium">+{run.elevationGainMeters}m elev</span>
                              </>
                            )}
                            {run.avgHeartRate && (
                              <>
                                <span>·</span>
                                <span className="flex items-center space-x-1 text-[#ff375f]">
                                  <Heart className="w-3 h-3 fill-[#ff375f]" />
                                  <span>{run.avgHeartRate} bpm</span>
                                </span>
                              </>
                            )}
                            {run.avgCadence && (
                              <>
                                <span>·</span>
                                <span>{run.avgCadence} spm</span>
                              </>
                            )}
                          </div>

                          {/* Calibrated Interval Details if present */}
                          {run.activeIntervalPaceSecPerKm && (
                            <div className="pt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="font-bold text-[#10B981]">
                                ⚡ Active Interval Pace: {formatPace(run.activeIntervalPaceSecPerKm, unit)}
                              </span>
                              {run.targetIntervalPaceSecPerKm && (
                                <span className="text-neutral-500 dark:text-neutral-400">
                                  🎯 Aimed: {formatPace(run.targetIntervalPaceSecPerKm, unit)}
                                </span>
                              )}
                              {run.repCount && run.repDistanceMeters && (
                                <span className="text-neutral-400">
                                  ({run.repCount} × {run.repDistanceMeters}m)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Distance, Pace & Calibration Button */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 text-right flex-shrink-0 tabular-nums border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-200/60 dark:border-neutral-800">
                        <div>
                          <div className="font-bold text-neutral-900 dark:text-white">
                            {run.distanceKm} km
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {formatDuration(run.durationSeconds)}
                          </div>
                        </div>

                        <div className="min-w-[65px]">
                          <div className={`font-semibold ${run.activeIntervalPaceSecPerKm ? 'text-[#10B981]' : 'text-neutral-800 dark:text-neutral-200'}`}>
                            {formatPace(run.activeIntervalPaceSecPerKm || run.averagePaceSecPerKm, unit)}
                          </div>
                          <div className="text-[10px] text-neutral-400 uppercase">
                            {run.activeIntervalPaceSecPerKm ? 'Active Pace' : 'Avg Pace'}
                          </div>
                        </div>

                        {/* Interval Calibration Action Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCalibratingRun(run);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1 shrink-0 ${
                            run.activeIntervalPaceSecPerKm
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                              : isInterval
                              ? 'bg-[#0593C6]/15 text-[#0593C6] dark:text-[#38bdf8] hover:bg-[#0593C6]/25 ring-1 ring-[#0593C6]/40'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                          }`}
                          title="Input aimed pace, reps, set distance, and rest duration to calculate true active interval pace"
                        >
                          <Zap className="w-3 h-3" />
                          <span>{run.activeIntervalPaceSecPerKm ? 'Edit Interval' : 'Strip Rest'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Action Footer */}
            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between flex-shrink-0">
              <button
                onClick={handleResetToUpload}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Upload Different File</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-full text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUpload}
                  disabled={selectedIds.size === 0}
                  className="px-5 py-2 rounded-full text-xs font-semibold bg-[#30d158] hover:bg-[#28cd41] text-black disabled:opacity-40 transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Upload Selected ({selectedIds.size})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Instructions */}
        {activeTab === 'instructions' && (
          <div className="space-y-3 text-xs text-neutral-700 dark:text-neutral-300 max-h-72 overflow-y-auto pr-1 py-2">
            <div className="font-semibold text-neutral-900 dark:text-white flex items-center space-x-1.5">
              <HelpCircle className="w-4 h-4 text-[#0a84ff]" />
              <span>How to Export from Garmin Connect:</span>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-black/40 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
              <span className="font-semibold text-neutral-900 dark:text-white block">
                Option A: Export All Activities (.CSV)
              </span>
              <ol className="list-decimal list-inside space-y-1 text-neutral-600 dark:text-neutral-400 pl-1">
                <li>Log in to <strong>connect.garmin.com</strong> in your browser.</li>
                <li>Go to <strong>Activities &gt; All Activities</strong> in the left menu.</li>
                <li>Click <strong>Export CSV</strong> at the top right of the table.</li>
                <li>Drop the downloaded file here. You will be able to select exactly which activities to import!</li>
              </ol>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-black/40 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
              <span className="font-semibold text-neutral-900 dark:text-white block">
                Option B: Export Individual Workout (.TCX or .GPX)
              </span>
              <ol className="list-decimal list-inside space-y-1 text-neutral-600 dark:text-neutral-400 pl-1">
                <li>Open the specific run activity in Garmin Connect.</li>
                <li>Click the gear icon in the top right.</li>
                <li>Select <strong>Export to TCX</strong> or <strong>Export to GPX</strong>.</li>
              </ol>
            </div>
          </div>
        )}

        {/* Interval & Rest Calibration Modal */}
        {calibratingRun && (
          <IntervalCalibrationModal
            isOpen={!!calibratingRun}
            onClose={() => setCalibratingRun(null)}
            run={calibratingRun}
            unit={unit}
            onSaveInterval={handleUpdateParsedRun}
            savedDefaultInterval={savedDefaultInterval}
            onSaveDefaultInterval={onSaveDefaultInterval}
          />
        )}
      </div>
    </div>
  );
};
