import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types/running';
import {
  YRAA_DIVISIONS,
  YRAA_DIVISION_LIST,
  YraaDivisionId,
} from '../data/yraaBenchmarks';
import {
  formatDuration,
  parseDuration,
  formatPace,
  KM_TO_MILES,
  MILES_TO_KM,
  getSuggestedWeeklySchedule,
  inferDefaultYraaDivision,
} from '../utils/runningCalculations';
import {
  X,
  Target,
  Calendar,
  Flag,
  Activity,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Ruler,
  Heart,
  Sun,
  Moon,
  Minus,
  Plus,
} from 'lucide-react';

type SettingsSection = 'root' | 'profile' | 'race' | 'weekly' | 'units';

interface GoalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

const DISTANCE_PRESETS = [
  { label: '1 Mile', km: 1.60934, name: '1 Mile' },
  { label: '5K', km: 5.0, name: '5K Race' },
  { label: '6K', km: 6.0, name: '6K Race' },
  { label: '8K', km: 8.0, name: '8K Race' },
  { label: '10K', km: 10.0, name: '10K Race' },
  { label: 'Half Marathon', km: 21.0975, name: 'Half Marathon' },
  { label: 'Marathon', km: 42.195, name: 'Marathon' },
  { label: 'Custom', km: 0, name: 'Custom Distance' },
];

const ATHLETE_LEVEL_LABELS: Record<
  NonNullable<UserProfile['athleteLevel']>,
  string
> = {
  'High School XC': 'High School Cross Country',
  'Collegiate / Advanced': 'Collegiate / Club XC',
  Beginner: 'Developing Runner',
  Masters: 'Masters XC',
};

export const GoalSettingsModal: React.FC<GoalSettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
  theme,
  onToggleTheme,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('root');
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);

  const [selectedPreset, setSelectedPreset] = useState<string>('6K');
  const [customDistanceStr, setCustomDistanceStr] = useState<string>('6');
  const [targetTimeStr, setTargetTimeStr] = useState<string>('');
  const [weeklyRunGoal, setWeeklyRunGoal] = useState<number>(3);
  const [weeklyDistGoalStr, setWeeklyDistGoalStr] = useState<string>('');
  const [unitPreference, setUnitPreference] = useState<'km' | 'miles'>('km');
  const [displayName, setDisplayName] = useState<string>('');
  const [athleteLevel, setAthleteLevel] = useState<
    'Beginner' | 'High School XC' | 'Collegiate / Advanced' | 'Masters'
  >('High School XC');
  const [yraaDivision, setYraaDivision] = useState<YraaDivisionId>('senior_men');
  const [hrMode, setHrMode] = useState<'auto' | 'custom'>('auto');
  const [maxHrStr, setMaxHrStr] = useState<string>('195');

  // Re-sync draft state cleanly each time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setActiveSection('root');
    setShowSchedulePreview(false);

    const unit = profile.unitPreference || 'km';
    const currentDistKm = profile.targetDistanceKm || 6.0;
    const matchedPreset = DISTANCE_PRESETS.find(
      (p) => p.km > 0 && Math.abs(p.km - currentDistKm) < 0.05
    );

    setUnitPreference(unit);
    setSelectedPreset(matchedPreset ? matchedPreset.label : 'Custom');
    setCustomDistanceStr(
      unit === 'miles'
        ? (currentDistKm * KM_TO_MILES).toFixed(2)
        : currentDistKm.toString()
    );
    setTargetTimeStr(
      profile.target6kTimeSeconds ? formatDuration(profile.target6kTimeSeconds) : ''
    );
    setWeeklyRunGoal(profile.weeklyRunGoal || 3);
    setWeeklyDistGoalStr(
      profile.weeklyDistanceGoalKm
        ? unit === 'miles'
          ? (profile.weeklyDistanceGoalKm * KM_TO_MILES).toFixed(1)
          : profile.weeklyDistanceGoalKm.toString()
        : ''
    );
    setDisplayName(profile.displayName || '');
    setAthleteLevel(profile.athleteLevel || 'High School XC');
    setYraaDivision(profile.yraaDivision || inferDefaultYraaDivision(currentDistKm));

    if (profile.maxHeartRate && profile.maxHeartRate > 0) {
      setHrMode('custom');
      setMaxHrStr(profile.maxHeartRate.toString());
    } else {
      setHrMode('auto');
      setMaxHrStr('195');
    }
  }, [isOpen, profile]);

  // Escape navigates back up the hierarchy before closing
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeSection !== 'root') {
          setActiveSection('root');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, activeSection, onClose]);

  if (!isOpen) return null;

  // Compute effective distance in km
  let effectiveDistKm = 6.0;
  if (selectedPreset === 'Custom') {
    const parsedVal = parseFloat(customDistanceStr);
    if (!isNaN(parsedVal) && parsedVal > 0) {
      effectiveDistKm =
        unitPreference === 'miles' ? parsedVal * MILES_TO_KM : parsedVal;
    }
  } else {
    const preset = DISTANCE_PRESETS.find((p) => p.label === selectedPreset);
    if (preset && preset.km > 0) {
      effectiveDistKm = preset.km;
    }
  }

  const parsedTargetSec = targetTimeStr.trim()
    ? parseDuration(targetTimeStr)
    : undefined;

  const handleChangeUnit = (nextUnit: 'km' | 'miles') => {
    if (nextUnit === unitPreference) return;
    const factor = nextUnit === 'miles' ? KM_TO_MILES : MILES_TO_KM;

    const customVal = parseFloat(customDistanceStr);
    if (!isNaN(customVal) && customVal > 0) {
      setCustomDistanceStr((customVal * factor).toFixed(2));
    }

    const weeklyVal = parseFloat(weeklyDistGoalStr);
    if (!isNaN(weeklyVal) && weeklyVal > 0) {
      const converted = weeklyVal * factor;
      setWeeklyDistGoalStr(
        Math.abs(converted - Math.round(converted)) < 0.08
          ? Math.round(converted).toString()
          : converted.toFixed(1)
      );
    }

    setUnitPreference(nextUnit);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let weeklyDistanceGoalKm: number | undefined;
    if (weeklyDistGoalStr.trim()) {
      const parsedDist = parseFloat(weeklyDistGoalStr);
      if (!isNaN(parsedDist) && parsedDist > 0) {
        weeklyDistanceGoalKm =
          unitPreference === 'miles' ? parsedDist * MILES_TO_KM : parsedDist;
      }
    }

    let customMaxHr: number | undefined;
    if (hrMode === 'custom') {
      const parsedHr = parseInt(maxHrStr, 10);
      if (!isNaN(parsedHr) && parsedHr >= 120 && parsedHr <= 230) {
        customMaxHr = parsedHr;
      }
    }

    const presetObj = DISTANCE_PRESETS.find((p) => p.label === selectedPreset);
    const targetGoalName =
      selectedPreset === 'Custom'
        ? `${(unitPreference === 'miles'
            ? effectiveDistKm * KM_TO_MILES
            : effectiveDistKm
          ).toFixed(1)} ${unitPreference} Goal`
        : presetObj?.name || `${effectiveDistKm}K Goal`;

    onSaveProfile({
      ...profile,
      targetDistanceKm: Number(effectiveDistKm.toFixed(3)),
      targetGoalName,
      target6kTimeSeconds:
        parsedTargetSec && parsedTargetSec > 0 ? parsedTargetSec : undefined,
      hasCustomTarget: Boolean(parsedTargetSec && parsedTargetSec > 0),
      weeklyRunGoal: Number(weeklyRunGoal) || 3,
      weeklyDistanceGoalKm: weeklyDistanceGoalKm
        ? Number(weeklyDistanceGoalKm.toFixed(2))
        : undefined,
      unitPreference,
      displayName: displayName.trim(),
      athleteLevel,
      yraaDivision,
      maxHeartRate: customMaxHr,
      updatedAt: new Date().toISOString(),
    });

    onClose();
  };

  // Concise summaries for root hierarchy rows
  const targetTimeSummary =
    parsedTargetSec && parsedTargetSec > 0
      ? parsedTargetSec < 600
        ? `${formatDuration(parsedTargetSec)}/${unitPreference === 'miles' ? 'mi' : 'km'}`
        : formatDuration(parsedTargetSec)
      : 'No time set';

  const raceSummary = `${
    selectedPreset === 'Custom'
      ? `${(unitPreference === 'miles'
          ? effectiveDistKm * KM_TO_MILES
          : effectiveDistKm
        ).toFixed(1)} ${unitPreference}`
      : selectedPreset
  } · ${targetTimeSummary}`;

  const weeklySummary = weeklyDistGoalStr.trim()
    ? `${weeklyRunGoal} runs · ${weeklyDistGoalStr} ${unitPreference}`
    : `${weeklyRunGoal} runs / wk`;

  const unitsHrSummary = `${unitPreference === 'miles' ? 'Miles' : 'Kilometers'} · ${
    hrMode === 'custom' && maxHrStr ? `${maxHrStr} bpm` : 'Auto HR'
  }`;

  const sectionTitleMap: Record<SettingsSection, string> = {
    root: 'Settings',
    profile: 'Athlete Profile',
    race: 'Race & Target Goal',
    weekly: 'Weekly Training Plan',
    units: 'Units & Heart Rate',
  };

  const runnerInitial = (displayName.trim() || profile.email || 'R')
    .charAt(0)
    .toUpperCase();

  // Track whether draft differs from saved profile
  const hasUnsavedChanges = (() => {
    const initialDistKm = profile.targetDistanceKm || 6.0;
    const distChanged = Math.abs(effectiveDistKm - initialDistKm) > 0.01;
    const targetSecChanged =
      (parsedTargetSec && parsedTargetSec > 0 ? parsedTargetSec : undefined) !==
      profile.target6kTimeSeconds;
    const weeklyRunsChanged =
      (Number(weeklyRunGoal) || 3) !== (profile.weeklyRunGoal || 3);
    const parsedWeeklyKm = weeklyDistGoalStr.trim()
      ? (unitPreference === 'miles'
          ? parseFloat(weeklyDistGoalStr) * MILES_TO_KM
          : parseFloat(weeklyDistGoalStr))
      : undefined;
    const weeklyKmChanged =
      Math.abs((parsedWeeklyKm || 0) - (profile.weeklyDistanceGoalKm || 0)) > 0.05;
    const unitChanged = unitPreference !== (profile.unitPreference || 'km');
    const nameChanged = displayName.trim() !== (profile.displayName || '').trim();
    const levelChanged =
      athleteLevel !== (profile.athleteLevel || 'High School XC');
    const divisionChanged =
      yraaDivision !== (profile.yraaDivision || inferDefaultYraaDivision(initialDistKm));
    const parsedHr =
      hrMode === 'custom' ? parseInt(maxHrStr, 10) || undefined : undefined;
    const hrChanged = parsedHr !== profile.maxHeartRate;

    return (
      distChanged ||
      targetSecChanged ||
      weeklyRunsChanged ||
      weeklyKmChanged ||
      unitChanged ||
      nameChanged ||
      levelChanged ||
      divisionChanged ||
      hrChanged
    );
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#0D1620] border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
        {/* Sleek Top Navigation Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="min-w-0">
            {activeSection !== 'root' ? (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveSection('root')}
                  className="inline-flex items-center space-x-1 -ml-2 px-2 py-1 rounded-lg text-xs font-semibold text-[#0593C6] hover:bg-[#0593C6]/10 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Settings</span>
                </button>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">/</span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  {sectionTitleMap[activeSection]}
                </h2>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Settings
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Goals, training targets, and preferences
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="px-6 py-5 max-h-[68vh] overflow-y-auto">
            {/* LEVEL 1: CLEAN UNIFIED HIERARCHY OVERVIEW */}
            {activeSection === 'root' && (
              <div className="space-y-6">
                {/* Profile Summary Row */}
                <button
                  type="button"
                  onClick={() => setActiveSection('profile')}
                  className="w-full flex items-center justify-between -mx-2.5 px-2.5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/45 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-[#0593C6]/12 border border-[#0593C6]/20 text-[#0593C6] flex items-center justify-center font-bold text-sm shrink-0">
                      {runnerInitial}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {displayName.trim() || 'Runner Profile'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {ATHLETE_LEVEL_LABELS[athleteLevel]} · YRAA {YRAA_DIVISIONS[yraaDivision]?.label}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 pl-2 shrink-0">
                    <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
                      Edit
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>

                {/* Group 1: Training Goals */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Training Goals
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    <button
                      type="button"
                      onClick={() => setActiveSection('race')}
                      className="w-full flex items-center justify-between -mx-2.5 px-2.5 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/45 transition-colors text-left cursor-pointer group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 group-hover:text-[#0593C6] flex items-center justify-center shrink-0 transition-colors">
                          <Flag className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          Race & Target Goal
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 min-w-0 pl-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
                          {raceSummary}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSection('weekly')}
                      className="w-full flex items-center justify-between -mx-2.5 px-2.5 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/45 transition-colors text-left cursor-pointer group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 group-hover:text-[#0593C6] flex items-center justify-center shrink-0 transition-colors">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          Weekly Training Plan
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 min-w-0 pl-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
                          {weeklySummary}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  </div>
                </div>

                {/* Group 2: Preferences */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Preferences
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    <button
                      type="button"
                      onClick={() => setActiveSection('units')}
                      className="w-full flex items-center justify-between -mx-2.5 px-2.5 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/45 transition-colors text-left cursor-pointer group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 group-hover:text-[#0593C6] flex items-center justify-center shrink-0 transition-colors">
                          <Ruler className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          Units & Heart Rate
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 min-w-0 pl-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
                          {unitsHrSummary}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>

                    {theme && onToggleTheme && (
                      <div className="flex items-center justify-between -mx-2.5 px-2.5 py-2.5">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                            {theme === 'dark' ? (
                              <Moon className="w-4 h-4" />
                            ) : (
                              <Sun className="w-4 h-4" />
                            )}
                          </div>
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            Appearance
                          </span>
                        </div>
                        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                          <button
                            type="button"
                            onClick={() => {
                              if (theme !== 'light') onToggleTheme();
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              theme === 'light'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                          >
                            Light
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (theme !== 'dark') onToggleTheme();
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              theme === 'dark'
                                ? 'bg-[#162433] text-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                          >
                            Dark
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-PAGE 1: ATHLETE PROFILE */}
            {activeSection === 'profile' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Runner Name or Club
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name or team"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0593C6]/25 focus:border-[#0593C6] transition-shadow"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Category / Experience Level
                  </label>
                  <select
                    value={athleteLevel}
                    onChange={(e) =>
                      setAthleteLevel(
                        e.target.value as
                          | 'Beginner'
                          | 'High School XC'
                          | 'Collegiate / Advanced'
                          | 'Masters'
                      )
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0593C6]/25 focus:border-[#0593C6] transition-shadow"
                  >
                    <option value="High School XC">High School Cross Country</option>
                    <option value="Collegiate / Advanced">Collegiate / Club XC</option>
                    <option value="Beginner">Developing Runner</option>
                    <option value="Masters">Masters XC</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      YRAA Championship Category
                    </label>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      Used for meet placement estimate
                    </span>
                  </div>
                  <select
                    value={yraaDivision}
                    onChange={(e) => setYraaDivision(e.target.value as YraaDivisionId)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0593C6]/25 focus:border-[#0593C6] transition-shadow"
                  >
                    {YRAA_DIVISION_LIST.map((div) => (
                      <option key={div.id} value={div.id}>
                        {div.label} · {div.finishersCount} finishers
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* SUB-PAGE 2: RACE & TARGET GOAL */}
            {activeSection === 'race' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Target Distance
                    </label>
                    <span className="text-xs font-semibold text-[#0593C6] tabular-nums">
                      {unitPreference === 'miles'
                        ? `${(effectiveDistKm * KM_TO_MILES).toFixed(2)} mi`
                        : `${effectiveDistKm.toFixed(2)} km`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
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
                          className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer truncate ${
                            isSelected
                              ? 'bg-[#0593C6] text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800/75 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {selectedPreset === 'Custom' && (
                    <div className="pt-1 flex items-center space-x-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        max="100"
                        value={customDistanceStr}
                        onChange={(e) => setCustomDistanceStr(e.target.value)}
                        placeholder={`Distance in ${unitPreference}`}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0593C6]/25 focus:border-[#0593C6]"
                      />
                      <span className="text-xs font-semibold text-slate-500 shrink-0">
                        {unitPreference}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Goal Time or Pace
                  </label>
                  <div className="relative">
                    <Target className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={targetTimeStr}
                      onChange={(e) => setTargetTimeStr(e.target.value)}
                      placeholder="e.g. 24:00 or 4:20"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0593C6]/25 focus:border-[#0593C6]"
                    />
                  </div>

                  {parsedTargetSec && parsedTargetSec > 0 ? (
                    parsedTargetSec < 600 ? (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums pt-0.5">
                        <span className="font-semibold text-[#10B981]">
                          Target Pace: {formatDuration(parsedTargetSec)}{' '}
                          {unitPreference === 'miles' ? '/mi' : '/km'}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          Projected {effectiveDistKm.toFixed(1)} km:{' '}
                          {formatDuration(Math.round(parsedTargetSec * effectiveDistKm))}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums pt-0.5">
                        <span className="font-semibold text-[#10B981]">
                          Goal Time: {formatDuration(parsedTargetSec)}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          Required Pace: {formatPace(parsedTargetSec / effectiveDistKm, unitPreference)}
                        </span>
                      </div>
                    )
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Enter total minutes (24), MM:SS (24:00), or target pace (4:20).
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* SUB-PAGE 3: WEEKLY TRAINING PLAN */}
            {activeSection === 'weekly' && (
              <div className="space-y-5">
                {/* Weekly Runs Stepper */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      Weekly Runs
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Sessions per week
                    </div>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <button
                      type="button"
                      onClick={() => setWeeklyRunGoal((v) => Math.max(1, (v || 3) - 1))}
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                      aria-label="Decrease weekly runs"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      {weeklyRunGoal}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWeeklyRunGoal((v) => Math.min(14, (v || 3) + 1))}
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                      aria-label="Increase weekly runs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Weekly Distance */}
                <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        Weekly Distance
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Optional target in {unitPreference}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 w-28">
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="300"
                        value={weeklyDistGoalStr}
                        onChange={(e) => setWeeklyDistGoalStr(e.target.value)}
                        placeholder="25"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-sm font-semibold text-right text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0593C6]/25 focus:border-[#0593C6]"
                      />
                      <span className="text-xs font-medium text-slate-500">{unitPreference}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(unitPreference === 'miles'
                      ? [10, 15, 20, 25, 30]
                      : [15, 20, 25, 30, 35, 40, 50]
                    ).map((presetVal) => {
                      const isCurrent =
                        Math.abs(parseFloat(weeklyDistGoalStr || '0') - presetVal) < 0.8;
                      return (
                        <button
                          key={presetVal}
                          type="button"
                          onClick={() => setWeeklyDistGoalStr(presetVal.toString())}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer tabular-nums ${
                            isCurrent
                              ? 'bg-[#0593C6] text-white'
                              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {presetVal} {unitPreference}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Collapsible Suggested Schedule Preview (hidden by default) */}
                {(() => {
                  const currentNum = parseFloat(weeklyDistGoalStr);
                  const effectiveKm =
                    !isNaN(currentNum) && currentNum > 0
                      ? unitPreference === 'miles'
                        ? currentNum * MILES_TO_KM
                        : currentNum
                      : 25;
                  const livePlan = getSuggestedWeeklySchedule(
                    effectiveKm,
                    weeklyRunGoal || 3,
                    unitPreference
                  );

                  return (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => setShowSchedulePreview((prev) => !prev)}
                        className="w-full flex items-center justify-between -mx-2 px-2 py-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800/45 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <Activity className="w-4 h-4 text-[#0593C6]" />
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            Suggested Weekly Schedule ({livePlan.weeklyDistanceFormatted}/wk)
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
                            showSchedulePreview ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {showSchedulePreview && (
                        <div className="mt-2 space-y-2 divide-y divide-slate-100 dark:divide-slate-800/70">
                          {livePlan.slots.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-start justify-between gap-3 pt-2 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {s.name}
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                  {s.structure}
                                </div>
                              </div>
                              <span className="font-semibold text-[#0593C6] tabular-nums shrink-0">
                                {s.suggestedDistanceFormatted}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* SUB-PAGE 4: UNITS & HEART RATE */}
            {activeSection === 'units' && (
              <div className="space-y-6">
                <div className="space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Distance & Pace Units
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                    <button
                      type="button"
                      onClick={() => handleChangeUnit('km')}
                      className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        unitPreference === 'km'
                          ? 'bg-white dark:bg-[#162433] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      Kilometers (km)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeUnit('miles')}
                      className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        unitPreference === 'miles'
                          ? 'bg-white dark:bg-[#162433] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      Miles (mi)
                    </button>
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Heart className="w-3.5 h-3.5 text-rose-500" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Max Heart Rate
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      Used for zones & load
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setHrMode('auto')}
                      className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        hrMode === 'auto'
                          ? 'bg-white dark:bg-[#162433] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      Auto-estimate
                    </button>
                    <button
                      type="button"
                      onClick={() => setHrMode('custom')}
                      className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        hrMode === 'custom'
                          ? 'bg-white dark:bg-[#162433] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      Custom BPM
                    </button>
                  </div>

                  {hrMode === 'custom' && (
                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="number"
                        min="120"
                        max="230"
                        value={maxHrStr}
                        onChange={(e) => setMaxHrStr(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0593C6]/25 focus:border-[#0593C6]"
                      />
                      <span className="text-xs font-semibold text-slate-500 shrink-0">bpm</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Clean Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#09121B]/50">
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {hasUnsavedChanges ? 'Unsaved changes' : ''}
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#0593C6] hover:bg-[#047da8] transition-colors cursor-pointer shadow-xs"
              >
                {hasUnsavedChanges ? 'Save Changes' : 'Done'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

