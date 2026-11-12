import React, { useState } from 'react';
import { RunRecord } from '../types/running';
import { calculateRecoveryStatus } from '../utils/runningCalculations';
import { RecoveryBar } from './RecoveryBar';
import { BatteryCharging, ChevronDown } from 'lucide-react';

interface BodyBatteryCardProps {
  runs: RunRecord[];
  maxHeartRate?: number;
}

export const BodyBatteryCard: React.FC<BodyBatteryCardProps> = ({
  runs,
  maxHeartRate = 190,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const recovery = calculateRecoveryStatus(runs, new Date(), maxHeartRate);

  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#0F1C28] border border-slate-200/95 dark:border-slate-700/75 shadow-sm transition-colors">
      {/* Full-bleed sensitive Dropdown Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full px-4 py-4 sm:px-5 sm:py-4.5 flex items-center justify-between text-left cursor-pointer group accordion-trigger select-none hover:bg-slate-50/90 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800/70"
        data-no-scale
        aria-expanded={isExpanded}
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-amber-500 flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105">
            <BatteryCharging className="w-4.5 h-4.5 stroke-[2.3]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">
                Body Battery
              </h2>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                · {recovery.bodyBatteryScore}/100 ({recovery.batteryStatusLabel})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0 ml-2">
          <div
            className={`p-2 rounded-lg border chevron-badge transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isExpanded
                ? 'rotate-180 text-slate-900 dark:text-white bg-slate-200/80 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                : 'bg-slate-100 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* Expanded Body Battery Gauge, Timeline & Readiness Model */}
      <div
        className={`accordion-collapse-wrapper ${isExpanded ? 'is-expanded' : ''}`}
        aria-hidden={!isExpanded}
      >
        <div className="accordion-collapse-inner">
          <div className="px-4 pb-5 pt-4 sm:px-5 border-t border-slate-100 dark:border-slate-800">
            <RecoveryBar runs={runs} maxHeartRate={maxHeartRate} />
          </div>
        </div>
      </div>
    </div>
  );
};
