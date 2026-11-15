import React, { useState, useRef } from 'react';
import { UploadCloud, Plus, Target, AlertCircle, ArrowUpCircle, FlaskConical, Sparkles } from 'lucide-react';
import { RunRecord } from '../types/running';
import { parseWatchFiles } from '../utils/watchFileParser';

interface EmptyGarminStateProps {
  unit: 'km' | 'miles';
  onProcessIncomingRuns: (runs: RunRecord[]) => void;
  onOpenGarminSync: () => void;
  onOpenGarminSyncWithRuns?: (runs: RunRecord[]) => void;
  onOpenAddRun: () => void;
  onOpenSettings: () => void;
  onOpenSetup?: () => void;
  onLoadPlaceholderData?: () => void;
}

export const EmptyGarminState: React.FC<EmptyGarminStateProps> = ({
  unit,
  onProcessIncomingRuns,
  onOpenGarminSync,
  onOpenGarminSyncWithRuns,
  onOpenAddRun,
  onOpenSettings,
  onOpenSetup,
  onLoadPlaceholderData,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const accumulatedRuns = await parseWatchFiles(files, 'local_user');

      if (accumulatedRuns.length === 0) {
        setErrorMessage(
          'No valid running activities were recognized. Supported: Apple Health export.zip / export.xml, Apple Watch CSV/JSON, Garmin .TCX, .GPX, and .CSV.'
        );
      } else {
        if (onOpenGarminSyncWithRuns) {
          onOpenGarminSyncWithRuns(accumulatedRuns);
        } else {
          onProcessIncomingRuns(accumulatedRuns);
        }
      }
    } catch (err: unknown) {
      console.error('File parsing error:', err);
      const msg = err instanceof Error ? err.message : 'Error reading watch file';
      setErrorMessage(`Failed to process watch data: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-2 sm:py-4">
      <div className="rounded-3xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800 shadow-xs p-5 sm:p-8 transition-colors space-y-6">
        {/* Concise Heading & Primary Actions */}
        <div className="text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Log Run / Upload Data
          </h2>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onOpenAddRun}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#30d158] hover:bg-[#28b84c] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Log Run</span>
            </button>

            <button
              type="button"
              onClick={onOpenGarminSync}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#0a84ff] hover:bg-[#0070e0] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Data</span>
            </button>
          </div>
        </div>

        {/* Compact Drag & Drop File Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-[#0a84ff] bg-[#0a84ff]/5 dark:bg-[#0a84ff]/10 scale-[1.01]'
              : 'border-neutral-300 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-black/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".zip,.xml,.fit,.tcx,.gpx,.csv,.json"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
            }}
          />

          <div className="flex flex-col items-center justify-center space-y-2">
            <ArrowUpCircle className="w-6 h-6 text-[#0a84ff]" />
            <span className="text-sm font-semibold text-neutral-900 dark:text-white">
              {isProcessing ? 'Processing file...' : 'Drop workout file here or browse'}
            </span>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              .TCX, .GPX, .CSV, .XML, .ZIP &amp; JSON
            </p>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Secondary Actions */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 border-t border-neutral-200/80 dark:border-neutral-800/80">
          <button
            type="button"
            onClick={onOpenSetup || onOpenSettings}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800/70 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer"
          >
            {onOpenSetup ? (
              <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
            ) : (
              <Target className="w-3.5 h-3.5 text-[#10B981]" />
            )}
            <span>{onOpenSetup ? 'Training Plan Setup' : 'Set Goal'}</span>
          </button>

          {onLoadPlaceholderData && (
            <button
              type="button"
              onClick={onLoadPlaceholderData}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/25 text-xs font-semibold text-violet-700 dark:text-violet-300 transition-colors cursor-pointer"
            >
              <FlaskConical className="w-3.5 h-3.5 text-violet-500" />
              <span>Load Sample Data</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
