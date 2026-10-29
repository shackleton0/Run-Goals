import React, { useState } from 'react';
import { RunRecord, RunType } from '../types/running';
import {
  formatDuration,
  parseDuration,
  calculatePaceSecPerKm,
  formatPace,
  calculate6kEquivalent,
} from '../utils/runningCalculations';
import { X, Plus } from 'lucide-react';

interface AddRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSaveRun: (run: RunRecord) => void;
  unit: 'km' | 'miles';
}

export const AddRunModal: React.FC<AddRunModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSaveRun,
  unit,
}) => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState<string>('');
  const [distanceKm, setDistanceKm] = useState<string>('');
  const [durationStr, setDurationStr] = useState<string>('');
  const [runType, setRunType] = useState<RunType>('Aerobic');
  const [avgHeartRate, setAvgHeartRate] = useState<string>('');
  const [maxHeartRate, setMaxHeartRate] = useState<string>('');
  const [avgCadence, setAvgCadence] = useState<string>('');
  const [elevationGain, setElevationGain] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const distNum = parseFloat(distanceKm) || 0;
  const durationSec = parseDuration(durationStr);
  const avgPaceSec = calculatePaceSecPerKm(distNum, durationSec);
  const eq6kSec = calculate6kEquivalent(distNum, durationSec);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (distNum <= 0 || durationSec <= 0) return;

    const newRun: RunRecord = {
      id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      date,
      title: title.trim() || 'Cross Country Run',
      distanceKm: Number(distNum.toFixed(2)),
      durationSeconds: durationSec,
      averagePaceSecPerKm: Math.round(avgPaceSec),
      best6kTimeSeconds: eq6kSec,
      runType,
      avgHeartRate: avgHeartRate ? parseInt(avgHeartRate, 10) : undefined,
      maxHeartRate: maxHeartRate ? parseInt(maxHeartRate, 10) : undefined,
      avgCadence: avgCadence ? parseInt(avgCadence, 10) : undefined,
      elevationGainMeters: elevationGain ? parseInt(elevationGain, 10) : undefined,
      source: 'manual',
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    onSaveRun(newRun);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
            Log Workout
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#30d158]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Workout Type
              </label>
              <select
                value={runType}
                onChange={(e) => setRunType(e.target.value as RunType)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#30d158]"
              >
                <option value="6K Time Trial">6K Time Trial</option>
                <option value="Race">Race</option>
                <option value="Tempo">Tempo / Threshold</option>
                <option value="Intervals">Track / Hill Intervals</option>
                <option value="Long Run">Long Run</option>
                <option value="Easy">Easy / Recovery</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Run title (e.g. Afternoon Run)"
              className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#30d158]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Distance ({unit})
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                required
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="0.0"
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white tabular-nums focus:outline-none focus:border-[#30d158]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Duration (MM:SS)
              </label>
              <input
                type="text"
                required
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
                placeholder="MM:SS"
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white tabular-nums focus:outline-none focus:border-[#30d158]"
              />
            </div>
          </div>

          {/* Computed Metrics Live Preview */}
          {distNum > 0 && durationSec > 0 && (
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-black/50 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs tabular-nums">
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase">Pace</span>
                <span className="text-neutral-900 dark:text-white font-semibold">
                  {formatPace(avgPaceSec, unit)}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase">6K Equivalent</span>
                <span className="text-[#30d158] font-bold">{formatDuration(eq6kSec)}</span>
              </div>
            </div>
          )}

          {/* Garmin Sensor Telemetry (Optional) */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Avg HR (bpm)
              </label>
              <input
                type="number"
                min="40"
                max="230"
                value={avgHeartRate}
                onChange={(e) => setAvgHeartRate(e.target.value)}
                placeholder="Optional"
                className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Cadence (spm)
              </label>
              <input
                type="number"
                min="100"
                max="240"
                value={avgCadence}
                onChange={(e) => setAvgCadence(e.target.value)}
                placeholder="Optional"
                className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Elevation (m)
              </label>
              <input
                type="number"
                min="0"
                value={elevationGain}
                onChange={(e) => setElevationGain(e.target.value)}
                placeholder="Optional"
                className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Turf conditions, pacing feel..."
              className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#30d158]"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full text-xs font-semibold text-black bg-[#30d158] hover:bg-[#28cd41] transition-colors cursor-pointer"
            >
              Save Workout
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
