import React, { useState } from 'react';
import { UserProfile, RunRecord, AdherenceSummary } from '../types/running';
import { generateAiExportText, formatDuration, formatPace } from '../utils/runningCalculations';
import {
  X,
  Copy,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Activity,
  Target,
  Clock,
  Layers,
} from 'lucide-react';

interface AiExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  runs: RunRecord[];
  adherence: AdherenceSummary;
}

export const AiExportModal: React.FC<AiExportModalProps> = ({
  isOpen,
  onClose,
  profile,
  runs,
  adherence,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'dossier' | 'assessment' | 'raw'>('dossier');

  if (!isOpen) return null;

  const exportText = generateAiExportText(profile, runs, adherence);
  const targetDistKm = profile.targetDistanceKm || 6.0;
  const targetSec = profile.target6kTimeSeconds;
  const targetPacePerKm = targetSec ? targetSec / targetDistKm : null;

  const currentBestSec = runs.reduce((min, r) => {
    const val = r.targetEquivalentSeconds || r.best6kTimeSeconds || 0;
    return val > 0 && val < min ? val : min;
  }, 999999);
  const currentBestStr = currentBestSec < 999999 ? formatDuration(currentBestSec) : 'None';
  const targetTimeStr = targetSec ? formatDuration(targetSec) : 'Not configured';
  const gapSec = targetSec && currentBestSec < 999999 ? currentBestSec - targetSec : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJson = () => {
    const data = {
      profile,
      adherence,
      runs,
      exportedAt: new Date().toISOString(),
      formatVersion: '1.0',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xc_${targetDistKm}k_training_dossier_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    const headers = [
      'Activity_ID',
      'Date',
      'Workout_Title',
      'Session_Category',
      'Distance_KM',
      'Duration_Seconds',
      'Duration_Formatted',
      'Pace_Sec_Per_KM',
      'Pace_Formatted',
      'Projected_6K_Seconds',
      'Projected_6K_Formatted',
      'Avg_Heart_Rate_BPM',
      'Peak_Heart_Rate_BPM',
      'Avg_Cadence_SPM',
      'Elevation_Gain_Meters',
      'Notes',
    ];

    const rows = runs.map((r) => [
      `"${r.id}"`,
      `"${r.date}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.runType}"`,
      r.distanceKm,
      r.durationSeconds,
      `"${formatDuration(r.durationSeconds)}"`,
      r.averagePaceSecPerKm,
      `"${formatPace(r.averagePaceSecPerKm, profile.unitPreference)}"`,
      r.best6kTimeSeconds || '',
      `"${r.best6kTimeSeconds ? formatDuration(r.best6kTimeSeconds) : ''}"`,
      r.avgHeartRate || '',
      r.maxHeartRate || '',
      r.avgCadence || '',
      r.elevationGainMeters || '',
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xc_${targetDistKm}k_workout_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#121f29] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#0593C6]/10 text-[#0593C6] flex items-center justify-center">
              <FileText className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                Training Dossier & Data Export
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Official athlete report, workout logs, CSV spreadsheet, and raw dataset backup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Control */}
        <div className="flex p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-xs font-semibold my-4 flex-shrink-0">
          <button
            onClick={() => setActiveTab('dossier')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'dossier'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Training Dossier</span>
          </button>
          <button
            onClick={() => setActiveTab('assessment')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'assessment'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Athletic Assessment</span>
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'raw'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Spreadsheet & JSON</span>
          </button>
        </div>

        {/* Tab 1: Training Dossier */}
        {activeTab === 'dossier' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Structured text report formatted for coaches, training journals, or analytical review:
              </span>
              <button
                onClick={handleCopy}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  copied
                    ? 'bg-[#10B981] text-white'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy Dossier'}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed select-all">
              {exportText}
            </div>

            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Compatible with team logging systems, coaching review documents, and text-based analytics tools.
            </p>
          </div>
        )}

        {/* Tab 2: Athletic Assessment */}
        {activeTab === 'assessment' && (
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
            {/* Key Targets Card */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200 dark:border-neutral-800">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Target {targetDistKm}K Time
                </span>
                <span className="text-xl font-bold text-neutral-900 dark:text-white tabular-nums mt-0.5 block">
                  {targetTimeStr}
                </span>
                <span className="text-[11px] text-neutral-500 tabular-nums">
                  {targetPacePerKm ? `Pace: ${formatPace(targetPacePerKm, profile.unitPreference)}` : 'Set in Settings'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200 dark:border-neutral-800">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Fastest Logged Trial
                </span>
                <span className="text-xl font-bold text-[#0593C6] tabular-nums mt-0.5 block">
                  {currentBestStr}
                </span>
                <span className="text-[11px] text-neutral-500 tabular-nums">
                  {gapSec !== null
                    ? gapSec > 0
                      ? `${gapSec}s gap to target`
                      : 'Target achieved'
                    : 'Awaiting trials'}
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200 dark:border-neutral-800">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Weekly Adherence
                </span>
                <span className="text-xl font-bold text-[#10B981] tabular-nums mt-0.5 block">
                  {adherence.currentWeekRuns} / {adherence.weeklyGoal}
                </span>
                <span className="text-[11px] text-neutral-500">
                  {adherence.currentStreakWeeks} week streak
                </span>
              </div>
            </div>

            {/* Prescribed 3-Run Microcycle Blueprint */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200 dark:border-neutral-800 space-y-3">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-[#0593C6]" />
                <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                  Recommended 3-Session Weekly Microcycle
                </h3>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#121f29] border border-neutral-200/80 dark:border-neutral-800">
                  <div className="flex items-center justify-between font-semibold text-neutral-900 dark:text-white">
                    <span>Session 1: Goal Velocity Intervals</span>
                    <span className="text-[11px] text-[#0593C6] font-mono">5 x 1000m @ Target</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    Warm-up + 5 repetitions of 1000m at your goal pace with 90s jog recovery. Trains biomechanical turnover and VO2 max power.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-[#121f29] border border-neutral-200/80 dark:border-neutral-800">
                  <div className="flex items-center justify-between font-semibold text-neutral-900 dark:text-white">
                    <span>Session 2: Lactate Threshold Tempo</span>
                    <span className="text-[11px] text-[#10B981] font-mono">6.0 KM Continuous</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    Sustained aerobic tempo slightly below race pace. Elevates lactate clearance capacity to eliminate late-race fatigue.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-[#121f29] border border-neutral-200/80 dark:border-neutral-800">
                  <div className="flex items-center justify-between font-semibold text-neutral-900 dark:text-white">
                    <span>Session 3: Aerobic Foundation Long Run</span>
                    <span className="text-[11px] text-neutral-500 font-mono">9.0 – 12.0 KM</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    Relaxed conversational effort over rolling terrain. Expands cardiac stroke volume and mitochondrial capillary density.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Raw Downloads */}
        {activeTab === 'raw' && (
          <div className="space-y-4 py-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Download your complete dataset for local backup, coaching records, or spreadsheet analytics:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 font-semibold text-neutral-900 dark:text-white mb-1">
                    <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
                    <span>Workout Logs (CSV)</span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                    Tabular CSV containing activity dates, distances, durations, paces, Garmin heart rate, cadence, and 6K trial equivalents.
                  </p>
                </div>
                <button
                  onClick={downloadCsv}
                  className="w-full py-2.5 rounded-lg bg-white hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-semibold text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .CSV Spreadsheet</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 font-semibold text-neutral-900 dark:text-white mb-1">
                    <FileJson className="w-4 h-4 text-[#0593C6]" />
                    <span>Complete Archive (JSON)</span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                    Full structured database record with user settings, weekly adherence history, and all activity objects.
                  </p>
                </div>
                <button
                  onClick={downloadJson}
                  className="w-full py-2.5 rounded-lg bg-white hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-semibold text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .JSON Archive</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
