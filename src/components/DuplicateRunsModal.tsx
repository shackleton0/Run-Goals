import React from 'react';
import { RunRecord, DuplicateRunMatch } from '../types/running';
import { formatDuration, formatPace } from '../utils/runningCalculations';
import { AlertCircle, Trash2, Check, RefreshCw, X, ArrowRight } from 'lucide-react';

interface DuplicateRunsModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateRunMatch[];
  uniqueRunsCount: number;
  onDiscardDuplicates: () => void; // Discards incoming duplicates, imports unique only
  onOverwriteExisting: () => void; // Overwrites existing matching runs with incoming
  onImportAll: () => void; // Imports all including duplicates
}

export const DuplicateRunsModal: React.FC<DuplicateRunsModalProps> = ({
  isOpen,
  onClose,
  duplicates,
  uniqueRunsCount,
  onDiscardDuplicates,
  onOverwriteExisting,
  onImportAll,
}) => {
  if (!isOpen || duplicates.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
                Duplicate Runs Detected
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Found {duplicates.length} workout(s) matching activities already in your log
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

        {/* List of Duplicate Matches */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 my-2">
          {duplicates.map(({ incoming, existing }, idx) => (
            <div
              key={incoming.id || idx}
              className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs space-y-2"
            >
              <div className="flex items-center justify-between font-semibold text-neutral-700 dark:text-neutral-300">
                <span>{incoming.date}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  Duplicate Match
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-neutral-200 dark:border-neutral-800 text-[11px]">
                {/* Existing run in log */}
                <div className="p-2 rounded-lg bg-white dark:bg-black/40 border border-neutral-200/80 dark:border-neutral-800">
                  <span className="text-neutral-400 block text-[10px] uppercase font-medium">
                    Currently in Log
                  </span>
                  <div className="font-semibold text-neutral-900 dark:text-white truncate">
                    {existing.title}
                  </div>
                  <div className="text-neutral-500 tabular-nums">
                    {existing.distanceKm} km · {formatDuration(existing.durationSeconds)} ·{' '}
                    {formatPace(existing.averagePaceSecPerKm, 'km')}
                  </div>
                </div>

                {/* Incoming uploaded run */}
                <div className="p-2 rounded-lg bg-white dark:bg-black/40 border border-neutral-200/80 dark:border-neutral-800">
                  <span className="text-[#0a84ff] block text-[10px] uppercase font-medium">
                    Incoming Upload
                  </span>
                  <div className="font-semibold text-neutral-900 dark:text-white truncate">
                    {incoming.title}
                  </div>
                  <div className="text-neutral-500 tabular-nums">
                    {incoming.distanceKm} km · {formatDuration(incoming.durationSeconds)} ·{' '}
                    {formatPace(incoming.averagePaceSecPerKm, 'km')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Choices */}
        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex-shrink-0 space-y-2">
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {uniqueRunsCount > 0
              ? `There are also ${uniqueRunsCount} new unique runs ready to import.`
              : 'All runs in this upload already exist in your log.'}
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
            {/* Primary Choice: Discard Duplicates */}
            <button
              onClick={onDiscardDuplicates}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-[#30d158] hover:bg-[#28cd41] text-black transition-colors cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Duplicates & Import New ({uniqueRunsCount})</span>
            </button>

            {/* Overwrite Existing */}
            <button
              onClick={onOverwriteExisting}
              className="px-3.5 py-2 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer flex items-center justify-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Overwrite Existing</span>
            </button>

            {/* Keep Both */}
            <button
              onClick={onImportAll}
              className="px-3.5 py-2 rounded-full text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <span>Keep Both</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
