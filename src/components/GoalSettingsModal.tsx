import React, { useState } from 'react';
import { UserProfile } from '../types/running';
import { formatDuration, parseDuration, formatPace, KM_TO_MILES, MILES_TO_KM } from '../utils/runningCalculations';
import { X, Target, Calendar, Flag, Activity } from 'lucide-react';

interface GoalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
}

const DISTANCE_PRESETS = [
  { label: '5K', km: 5.0, name: '5K Race' },
  { label: '6K (XC)', km: 6.0, name: '6K Cross Country' },
  { label: '8K', km: 8.0, name: '8K Race' },
  { label: '10K', km: 10.0, name: '10K Race' },
  { label: 'Half Marathon', km: 21.0975, name: 'Half Marathon' },
  { label: 'Custom', km: 0, name: 'Custom Distance' },
];

export const GoalSettingsModal: React.FC<GoalSettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
}) => {
  const currentDistKm = profile.targetDistanceKm || 6.0;
  const initialPreset = DISTANCE_PRESETS.find((p) => Math.abs(p.km - currentDistKm) < 0.05)
    ? DISTANCE_PRESETS.find((p) => Math.abs(p.km - currentDistKm) < 0.05)!.label
    : 'Custom';

  const [selectedPreset, setSelectedPreset] = useState<string>(initialPreset);
  const [customDistanceStr, setCustomDistanceStr] = useState<string>(
    profile.unitPreference === 'miles'
      ? (currentDistKm * KM_TO_MILES).toFixed(2)
      : currentDistKm.toString()
  );

  const [targetTimeStr, setTargetTimeStr] = useState<string>(
    profile.target6kTimeSeconds ? formatDuration(profile.target6kTimeSeconds) : ''
  );
  const [weeklyRunGoal, setWeeklyRunGoal] = useState<number>(profile.weeklyRunGoal || 3);
  const [weeklyDistGoalStr, setWeeklyDistGoalStr] = useState<string>(
    profile.weeklyDistanceGoalKm
      ? (profile.unitPreference === 'miles'
          ? (profile.weeklyDistanceGoalKm * KM_TO_MILES).toFixed(1)
          : profile.weeklyDistanceGoalKm.toString())
      : ''
  );

  const [unitPreference, setUnitPreference] = useState<'km' | 'miles'>(
    profile.unitPreference || 'km'
  );
  const [displayName, setDisplayName] = useState<string>(profile.displayName || '');
  const [athleteLevel, setAthleteLevel] = useState<
    'Beginner' | 'High School XC' | 'Collegiate / Advanced' | 'Masters' | undefined
  >(profile.athleteLevel);

  if (!isOpen) return null;

  // Compute effective distance in km
  let effectiveDistKm = 6.0;
  if (selectedPreset === 'Custom') {
    const parsedVal = parseFloat(customDistanceStr);
    if (!isNaN(parsedVal) && parsedVal > 0) {
      effectiveDistKm = unitPreference === 'miles' ? parsedVal * MILES_TO_KM : parsedVal;
    }
  } else {
    const preset = DISTANCE_PRESETS.find((p) => p.label === selectedPreset);
    if (preset && preset.km > 0) {
      effectiveDistKm = preset.km;
    }
  }

  const parsedTargetSec = targetTimeStr.trim() ? parseDuration(targetTimeStr) : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let weeklyDistanceGoalKm: number | undefined;
    if (weeklyDistGoalStr.trim()) {
      const parsedDist = parseFloat(weeklyDistGoalStr);
      if (!isNaN(parsedDist) && parsedDist > 0) {
        weeklyDistanceGoalKm = unitPreference === 'miles' ? parsedDist * MILES_TO_KM : parsedDist;
      }
    }

    const presetObj = DISTANCE_PRESETS.find((p) => p.label === selectedPreset);
    const targetGoalName = selectedPreset === 'Custom'
      ? `${(unitPreference === 'miles' ? effectiveDistKm * KM_TO_MILES : effectiveDistKm).toFixed(1)} ${unitPreference} Goal`
      : presetObj?.name || `${effectiveDistKm}K Goal`;

    onSaveProfile({
      ...profile,
      targetDistanceKm: Number(effectiveDistKm.toFixed(3)),
      targetGoalName,
      target6kTimeSeconds: parsedTargetSec && parsedTargetSec > 0 ? parsedTargetSec : undefined,
      hasCustomTarget: Boolean(parsedTargetSec && parsedTargetSec > 0),
      weeklyRunGoal: Number(weeklyRunGoal) || 3,
      weeklyDistanceGoalKm: weeklyDistanceGoalKm ? Number(weeklyDistanceGoalKm.toFixed(2)) : undefined,
      unitPreference,
      displayName: displayName.trim(),
      athleteLevel,
      updatedAt: new Date().toISOString(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-[#0a84ff]" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
              Distance Goal & Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Section 1: Set Whatever Distance Goal You Want */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5">
                <Flag className="w-3.5 h-3.5 text-[#30d158]" />
                <span>Target Race / Distance Goal</span>
              </label>
              <span className="text-[11px] font-semibold text-[#0a84ff] tabular-nums">
                {unitPreference === 'miles'
                  ? `${(effectiveDistKm * KM_TO_MILES).toFixed(2)} mi`
                  : `${effectiveDistKm.toFixed(2)} km`}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {DISTANCE_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.label;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(preset.label);
                      if (preset.km > 0) {
                        setCustomDistanceStr(
                          unitPreference === 'miles'
                            ? (preset.km * KM_TO_MILES).toFixed(2)
                            : preset.km.toString()
                        );
                      }
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0a84ff] text-white shadow-xs'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {selectedPreset === 'Custom' && (
              <div className="mt-2 flex items-center space-x-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="100"
                  value={customDistanceStr}
                  onChange={(e) => setCustomDistanceStr(e.target.value)}
                  placeholder={`Enter distance in ${unitPreference}`}
                  className="w-full px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-900 dark:text-white tabular-nums focus:outline-none focus:border-[#0a84ff]"
                />
                <span className="text-xs font-medium text-neutral-500 uppercase">{unitPreference}</span>
              </div>
            )}
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">
              Select 6K XC, 5K, 10K, or set whatever custom distance goal you want to target.
            </p>
          </div>

          {/* Section 2: Target Time or Pace */}
          <div>
            <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
              Target Goal Time or Pace
            </label>
            <div className="relative">
              <Target className="w-4 h-4 text-[#0a84ff] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={targetTimeStr}
                onChange={(e) => setTargetTimeStr(e.target.value)}
                placeholder="e.g. 24 for 24 mins, 4:20 for pace, or 24:00"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm font-semibold text-neutral-900 dark:text-white tabular-nums focus:outline-none focus:border-[#0a84ff]"
              />
            </div>

            {parsedTargetSec && parsedTargetSec > 0 ? (
              parsedTargetSec < 600 ? (
                <div className="mt-1 text-[11px] text-[#30d158] font-medium space-y-0.5 tabular-nums">
                  <p>
                    Target Pace: <strong>{formatDuration(parsedTargetSec)} {unitPreference === 'miles' ? '/mi' : '/km'}</strong>
                  </p>
                  <p className="text-neutral-500 dark:text-neutral-400">
                    Projected {effectiveDistKm.toFixed(1)} km Time: {formatDuration(Math.round(parsedTargetSec * effectiveDistKm))}
                  </p>
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-[#30d158] font-medium space-y-0.5 tabular-nums">
                  <p>
                    Goal Time: <strong>{formatDuration(parsedTargetSec)}</strong> ({Math.round(parsedTargetSec / 60)} minutes)
                  </p>
                  <p className="text-neutral-500 dark:text-neutral-400">
                    Required Pace: {formatPace(parsedTargetSec / effectiveDistKm, unitPreference)}
                  </p>
                </div>
              )
            ) : (
              <p className="text-[10px] text-neutral-400 mt-1">
                Enter your target in minutes (e.g. 24), pace (e.g. 4:20), or MM:SS (e.g. 24:00).
              </p>
            )}
          </div>

          {/* Section 3: Weekly Consistency & Weekly Distance Target */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-neutral-200 dark:border-neutral-800">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Weekly Runs Target
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#ff9f0a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  min="1"
                  max="14"
                  required
                  value={weeklyRunGoal}
                  onChange={(e) => setWeeklyRunGoal(parseInt(e.target.value, 10))}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white tabular-nums focus:outline-none focus:border-[#ff9f0a]"
                />
              </div>
              <p className="text-[10px] text-neutral-500 mt-0.5">Runs per week</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Weekly Distance Goal
              </label>
              <div className="relative">
                <Activity className="w-4 h-4 text-[#0a84ff] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="300"
                  value={weeklyDistGoalStr}
                  onChange={(e) => setWeeklyDistGoalStr(e.target.value)}
                  placeholder={`e.g. 25 (${unitPreference})`}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white tabular-nums focus:outline-none focus:border-[#0a84ff]"
                />
              </div>
              <p className="text-[10px] text-neutral-500 mt-0.5">Optional volume ({unitPreference}/wk)</p>
            </div>
          </div>

          {/* Section 4: Units & Profile */}
          <div className="grid grid-cols-2 gap-3">
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

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Runner Name (Optional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name or club"
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#30d158]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Runner Category / Level
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

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full text-xs font-semibold text-black bg-[#30d158] hover:bg-[#28cd41] transition-colors cursor-pointer shadow-xs"
            >
              Save Goals & Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
