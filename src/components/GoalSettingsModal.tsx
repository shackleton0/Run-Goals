import React, { useState } from 'react';
import { UserProfile } from '../types/running';
import { formatDuration, parseDuration } from '../utils/runningCalculations';
import { X, Target, Calendar } from 'lucide-react';

interface GoalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
}

export const GoalSettingsModal: React.FC<GoalSettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
}) => {
  const [targetTimeStr, setTargetTimeStr] = useState<string>(
    profile.target6kTimeSeconds ? formatDuration(profile.target6kTimeSeconds) : ''
  );
  const [weeklyRunGoal, setWeeklyRunGoal] = useState<number>(profile.weeklyRunGoal || 3);
  const [unitPreference, setUnitPreference] = useState<'km' | 'miles'>(
    profile.unitPreference || 'km'
  );
  const [displayName, setDisplayName] = useState<string>(profile.displayName || '');
  const [athleteLevel, setAthleteLevel] = useState<
    'Beginner' | 'High School XC' | 'Collegiate / Advanced' | 'Masters' | undefined
  >(profile.athleteLevel);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTargetSec = targetTimeStr.trim() ? parseDuration(targetTimeStr) : undefined;

    onSaveProfile({
      ...profile,
      target6kTimeSeconds: parsedTargetSec && parsedTargetSec > 0 ? parsedTargetSec : undefined,
      hasCustomTarget: Boolean(parsedTargetSec && parsedTargetSec > 0),
      weeklyRunGoal: Number(weeklyRunGoal) || 3,
      unitPreference,
      displayName: displayName.trim(),
      athleteLevel,
      updatedAt: new Date().toISOString(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
            Target & Settings
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
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Target 6K Race Time (Optional, MM:SS)
            </label>
            <div className="relative">
              <Target className="w-4 h-4 text-[#0a84ff] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={targetTimeStr}
                onChange={(e) => setTargetTimeStr(e.target.value)}
                placeholder="Leave blank or enter goal (e.g. 21:00)"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm font-semibold text-neutral-900 dark:text-white tabular-nums focus:outline-none focus:border-[#0a84ff]"
              />
            </div>
            {targetTimeStr.trim() && parseDuration(targetTimeStr) > 0 ? (
              <p className="text-[11px] text-neutral-500 mt-1 tabular-nums">
                Target pace: {Math.floor(parseDuration(targetTimeStr) / 6 / 60)}:
                {Math.floor((parseDuration(targetTimeStr) / 6) % 60)
                  .toString()
                  .padStart(2, '0')}{' '}
                /km
              </p>
            ) : (
              <p className="text-[11px] text-neutral-400 mt-1">
                Optional: Leave blank if you prefer to only track progression from your Garmin runs.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Weekly Run Target
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#ff9f0a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  min="1"
                  max="7"
                  required
                  value={weeklyRunGoal}
                  onChange={(e) => setWeeklyRunGoal(parseInt(e.target.value, 10))}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm font-semibold text-neutral-900 dark:text-white tabular-nums focus:outline-none focus:border-[#ff9f0a]"
                />
              </div>
              <p className="text-[10px] text-neutral-500 mt-0.5">Recommended: 3 runs/wk</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Distance Unit
              </label>
              <select
                value={unitPreference}
                onChange={(e) => setUnitPreference(e.target.value as 'km' | 'miles')}
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#30d158]"
              >
                <option value="km">Kilometers (km)</option>
                <option value="miles">Miles (mi)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Runner Name (Optional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name or team"
              className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#30d158]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Cross Country Level
            </label>
            <select
              value={athleteLevel}
              onChange={(e) =>
                setAthleteLevel(
                  e.target.value as 'Beginner' | 'High School XC' | 'Collegiate / Advanced' | 'Masters'
                )
              }
              className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#30d158]"
            >
              <option value="High School XC">High School Cross Country</option>
              <option value="Collegiate / Advanced">Collegiate / Club XC</option>
              <option value="Beginner">Developing Runner</option>
              <option value="Masters">Masters XC</option>
            </select>
          </div>

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
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
