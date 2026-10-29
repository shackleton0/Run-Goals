import React, { useState } from 'react';
import { RunRecord } from '../types/running';
import { parseGarminCsv, parseTcx, parseGpx } from '../utils/runningCalculations';
import {
  X,
  UploadCloud,
  Watch,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface GarminSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onProcessIncomingRuns: (runs: RunRecord[]) => void;
}

export const GarminSyncModal: React.FC<GarminSyncModalProps> = ({
  isOpen,
  onClose,
  userId,
  onProcessIncomingRuns,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'instructions'>('upload');

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setErrorMsg(null);
    setImportStatus(`Reading ${file.name}...`);

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
          throw new Error('Please upload a .csv, .tcx, or .gpx exported from Garmin Connect.');
        }
      }

      if (parsedRuns.length === 0) {
        throw new Error('No running activities found in file.');
      }

      // Hand off to duplicate checker & importer
      onProcessIncomingRuns(parsedRuns);
      onClose();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#0a84ff]/10 text-[#0a84ff] flex items-center justify-center">
              <Watch className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                Garmin Data Sync
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Upload your Garmin Connect workout files to track 6K progress
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Control */}
        <div className="flex p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-xs font-semibold my-4">
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

        {/* Tab 1: Upload */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
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
                accept=".csv,.tcx,.gpx,.fit"
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
                Automatic duplicate detection checks before importing
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

        {/* Tab 2: Instructions */}
        {activeTab === 'instructions' && (
          <div className="space-y-3 text-xs text-neutral-700 dark:text-neutral-300 max-h-72 overflow-y-auto pr-1">
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
                <li>Drop the downloaded file here. Duplicate runs will be automatically flagged!</li>
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
      </div>
    </div>
  );
};
