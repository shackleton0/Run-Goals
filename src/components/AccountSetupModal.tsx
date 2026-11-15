import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../types/running';
import {
  formatDuration,
  parseDuration,
  formatPace,
  KM_TO_MILES,
  MILES_TO_KM,
  getSuggestedWeeklySchedule,
  buildWeeklyDaySchedule,
  computeTargetGoalDate,
} from '../utils/runningCalculations';
import {
  User,
  Target,
  Calendar,
  Activity,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Clock,
  Zap,
  Gauge,
  Heart,
  Sparkles,
  Minus,
  Plus,
} from 'lucide-react';

interface AccountSetupModalProps {
  isOpen: boolean;
  profile: UserProfile;
  initialSuggestedName?: string;
  onComplete: (updatedProfile: UserProfile) => void;
  onDismiss: () => void;
}

const DISTANCE_PRESETS = [
  { label: '5K', km: 5.0, name: '5K Race', quickTimes: ['25:00', '22:00', '20:00', '18:30'] },
  { label: '6K', km: 6.0, name: '6K Race', quickTimes: ['30:00', '26:00', '24:00', '21:30'] },
  { label: '8K', km: 8.0, name: '8K Race', quickTimes: ['40:00', '35:00', '32:00', '28:30'] },
  { label: '10K', km: 10.0, name: '10K Race', quickTimes: ['52:00', '46:00', '42:00', '38:00'] },
  { label: 'Half Marathon', km: 21.0975, name: 'Half Marathon', quickTimes: ['115:00', '100:00', '90:00', '82:00'] },
  { label: 'Marathon', km: 42.195, name: 'Marathon', quickTimes: ['240:00', '210:00', '195:00', '180:00'] },
  { label: 'Custom', km: 0, name: 'Custom Distance', quickTimes: [] },
];

const TIMEFRAME_PRESETS = [
  { weeks: 4, label: '4 wks', sub: '1 month' },
  { weeks: 8, label: '8 wks', sub: '2 months' },
  { weeks: 12, label: '12 wks', sub: '3 months' },
  { weeks: 16, label: '16 wks', sub: '4 months' },
  { weeks: 26, label: '26 wks', sub: '6 months' },
];

const EXPERIENCE_LEVELS: Array<{
  id: NonNullable<UserProfile['athleteLevel']>;
  title: string;
  desc: string;
}> = [
  { id: 'Beginner', title: 'Developing Runner', desc: 'Building consistency & aerobic habit' },
  { id: 'High School XC', title: 'High School XC', desc: '5K–6K cross country & track prep' },
  { id: 'Collegiate / Advanced', title: 'Collegiate / Club', desc: '6K–10K competitive racing volume' },
  { id: 'Masters', title: 'Masters / Adult', desc: 'Structured road, trail & longevity' },
];

export const AccountSetupModal: React.FC<AccountSetupModalProps> = ({
  isOpen,
  profile,
  initialSuggestedName = '',
  onComplete,
  onDismiss,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [unit, setUnit] = useState<'km' | 'miles'>('km');
  const [athleteLevel, setAthleteLevel] = useState<NonNullable<UserProfile['athleteLevel']>>('High School XC');

  const [selectedPreset, setSelectedPreset] = useState<string>('6K');
  const [customDistStr, setCustomDistStr] = useState<string>('6');
  const [targetTimeStr, setTargetTimeStr] = useState<string>('24:00');
  const [timeframeWeeks, setTimeframeWeeks] = useState<number>(12);

  const [weeklyRunGoal, setWeeklyRunGoal] = useState<number>(3);
  const [weeklyDistStr, setWeeklyDistStr] = useState<string>('25');
  const [hasEditedWeeklyDist, setHasEditedWeeklyDist] = useState<boolean>(false);

  // Sync initial values cleanly whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setNameError(null);
    const startingUnit = profile.unitPreference || 'km';
    setUnit(startingUnit);
    setName(profile.displayName?.trim() || initialSuggestedName || '');
    setAthleteLevel(profile.athleteLevel || 'High School XC');

    const distKm = profile.targetDistanceKm || 6.0;
    const matched = DISTANCE_PRESETS.find((p) => p.km > 0 && Math.abs(p.km - distKm) < 0.05);
    setSelectedPreset(matched ? matched.label : 'Custom');
    setCustomDistStr(
      startingUnit === 'miles' ? (distKm * KM_TO_MILES).toFixed(2) : distKm.toString()
    );
    setTargetTimeStr(
      profile.target6kTimeSeconds ? formatDuration(profile.target6kTimeSeconds) : ''
    );
    setTimeframeWeeks(profile.goalTimeframeWeeks || 12);

    const runsPerWk = profile.weeklyRunGoal || 3;
    setWeeklyRunGoal(runsPerWk);

    if (profile.weeklyDistanceGoalKm && profile.weeklyDistanceGoalKm > 0) {
      setWeeklyDistStr(
        startingUnit === 'miles'
          ? (profile.weeklyDistanceGoalKm * KM_TO_MILES).toFixed(1)
          : profile.weeklyDistanceGoalKm.toString()
      );
      setHasEditedWeeklyDist(true);
    } else {
      const defaultKm = runsPerWk === 3 ? 25 : Math.max(12, runsPerWk * 8);
      setWeeklyDistStr(
        startingUnit === 'miles' ? (defaultKm * KM_TO_MILES).toFixed(0) : defaultKm.toString()
      );
      setHasEditedWeeklyDist(false);
    }
  }, [isOpen, profile, initialSuggestedName]);

  const effectiveDistKm = useMemo(() => {
    if (selectedPreset === 'Custom') {
      const parsed = parseFloat(customDistStr);
      if (!isNaN(parsed) && parsed > 0) {
        return unit === 'miles' ? parsed * MILES_TO_KM : parsed;
      }
      return 6.0;
    }
    const found = DISTANCE_PRESETS.find((p) => p.label === selectedPreset);
    return found && found.km > 0 ? found.km : 6.0;
  }, [selectedPreset, customDistStr, unit]);

  const parsedTargetSec = useMemo(() => {
    return targetTimeStr.trim() ? parseDuration(targetTimeStr) : undefined;
  }, [targetTimeStr]);

  const effectiveWeeklyKm = useMemo(() => {
    const parsed = parseFloat(weeklyDistStr);
    if (!isNaN(parsed) && parsed > 0) {
      return unit === 'miles' ? parsed * MILES_TO_KM : parsed;
    }
    return Math.max(10, weeklyRunGoal * 8);
  }, [weeklyDistStr, unit, weeklyRunGoal]);

  const targetGoalDate = useMemo(
    () => computeTargetGoalDate(timeframeWeeks),
    [timeframeWeeks]
  );

  const formattedTargetDate = useMemo(() => {
    const [y, m, d] = targetGoalDate.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }, [targetGoalDate]);

  const schedulePlan = useMemo(
    () =>
      getSuggestedWeeklySchedule(
        effectiveWeeklyKm,
        weeklyRunGoal,
        unit,
        effectiveDistKm,
        [],
        parsedTargetSec
      ),
    [effectiveWeeklyKm, weeklyRunGoal, unit, effectiveDistKm, parsedTargetSec]
  );

  const weeklyDaySchedule = useMemo(
    () => buildWeeklyDaySchedule(schedulePlan),
    [schedulePlan]
  );

  if (!isOpen) return null;

  const handleToggleUnit = (nextUnit: 'km' | 'miles') => {
    if (nextUnit === unit) return;
    const factor = nextUnit === 'miles' ? KM_TO_MILES : MILES_TO_KM;

    const customNum = parseFloat(customDistStr);
    if (!isNaN(customNum) && customNum > 0) {
      setCustomDistStr((customNum * factor).toFixed(2));
    }

    const weeklyNum = parseFloat(weeklyDistStr);
    if (!isNaN(weeklyNum) && weeklyNum > 0) {
      const converted = weeklyNum * factor;
      setWeeklyDistStr(
        Math.abs(converted - Math.round(converted)) < 0.1
          ? Math.round(converted).toString()
          : converted.toFixed(1)
      );
    }

    setUnit(nextUnit);
  };

  const handleSelectRunsPerWeek = (runsCount: number) => {
    setWeeklyRunGoal(runsCount);
    if (!hasEditedWeeklyDist) {
      const smartKm = runsCount === 2 ? 16 : runsCount === 3 ? 25 : runsCount * 8;
      setWeeklyDistStr(
        unit === 'miles' ? Math.round(smartKm * KM_TO_MILES).toString() : smartKm.toString()
      );
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!name.trim()) {
        setNameError('Please enter your name so we can personalize your plan.');
        return;
      }
      setNameError(null);
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) setStep(3);
  };

  const handleFinish = () => {
    const presetObj = DISTANCE_PRESETS.find((p) => p.label === selectedPreset);
    const targetGoalName =
      selectedPreset === 'Custom'
        ? `${(unit === 'miles' ? effectiveDistKm * KM_TO_MILES : effectiveDistKm).toFixed(1)} ${unit} Goal`
        : presetObj?.name || `${effectiveDistKm}K Race`;

    onComplete({
      ...profile,
      displayName: name.trim() || profile.displayName || 'Runner',
      unitPreference: unit,
      athleteLevel,
      targetDistanceKm: Number(effectiveDistKm.toFixed(3)),
      targetGoalName,
      target6kTimeSeconds: parsedTargetSec && parsedTargetSec > 0 ? parsedTargetSec : undefined,
      hasCustomTarget: Boolean(parsedTargetSec && parsedTargetSec > 0),
      goalTimeframeWeeks: timeframeWeeks,
      targetGoalDate,
      weeklyRunGoal,
      weeklyDistanceGoalKm: Number(effectiveWeeklyKm.toFixed(1)),
      onboardingCompleted: true,
      updatedAt: new Date().toISOString(),
    });
  };

  const activePresetObj = DISTANCE_PRESETS.find((p) => p.label === selectedPreset);
  const weeklyDistDisplay =
    unit === 'miles'
      ? (effectiveWeeklyKm * KM_TO_MILES).toFixed(1)
      : effectiveWeeklyKm.toFixed(1);
  const avgRunDisplay =
    unit === 'miles'
      ? ((effectiveWeeklyKm / Math.max(1, weeklyRunGoal)) * KM_TO_MILES).toFixed(1)
      : (effectiveWeeklyKm / Math.max(1, weeklyRunGoal)).toFixed(1);

  const timeframeNote =
    timeframeWeeks <= 6
      ? 'Short sharpening phase: stay disciplined on key workouts and keep easy days strictly aerobic.'
      : timeframeWeeks <= 14
      ? 'Balanced build block: alternate speed, threshold tempo, and a steady Sunday long run to peak smoothly.'
      : 'Long-term base & peak cycle: build consistency over the first 6 weeks before pushing interval intensity.';

  const stepsMeta = [
    { num: 1, label: 'Profile', icon: User },
    { num: 2, label: 'Goal & Timeline', icon: Target },
    { num: 3, label: 'Weekly Volume', icon: Activity },
    { num: 4, label: 'Your Schedule', icon: Calendar },
  ] as const;

  const weeklyDistPresets = unit === 'miles' ? [10, 15, 20, 25, 30] : [15, 20, 25, 30, 40, 50];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Account and training plan setup"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Header & Stepper */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#09121B] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-[#0593C6] text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 stroke-[2.3]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Set Up Your Training Plan
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Step {step} of 4 · Tailored weekly schedule & goal timeline
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Close setup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 4-Step Progress Bar */}
          <div className="grid grid-cols-4 gap-1.5 mt-4">
            {stepsMeta.map((item) => {
              const Icon = item.icon;
              const isDone = step > item.num;
              const isCurrent = step === item.num;
              const canJump = item.num < step || (item.num > 1 && name.trim().length > 0);
              return (
                <button
                  key={item.num}
                  type="button"
                  disabled={!canJump}
                  onClick={() => {
                    if (canJump) setStep(item.num);
                  }}
                  className={`flex items-center justify-center sm:justify-start space-x-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-[#0593C6] text-white border-[#0593C6]'
                      : isDone
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/15'
                      : 'bg-white dark:bg-[#0D1620] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800'
                  } ${canJump && !isCurrent ? 'cursor-pointer' : ''}`}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden tabular-nums">{item.num}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* STEP 1: NAME & BASICS */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                  What&apos;s your name?
                </label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleNext();
                    }
                  }}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0593C6]/25 focus:border-[#0593C6]"
                />
                {nameError && (
                  <p className="text-xs text-rose-500 font-medium mt-1.5">{nameError}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Preferred Distance Units
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                  <button
                    type="button"
                    onClick={() => handleToggleUnit('km')}
                    className={`py-2.5 rounded-lg text-xs font-bold cursor-pointer ${
                      unit === 'km'
                        ? 'bg-white dark:bg-[#162433] text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Kilometers (km)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleUnit('miles')}
                    className={`py-2.5 rounded-lg text-xs font-bold cursor-pointer ${
                      unit === 'miles'
                        ? 'bg-white dark:bg-[#162433] text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Miles (mi)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Runner Experience Level
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {EXPERIENCE_LEVELS.map((lvl) => {
                    const isSelected = athleteLevel === lvl.id;
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setAthleteLevel(lvl.id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer ${
                          isSelected
                            ? 'bg-[#0593C6]/10 border-[#0593C6] text-slate-900 dark:text-white'
                            : 'bg-slate-50 dark:bg-[#09121B] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">{lvl.title}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {lvl.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: GOAL & TIMEFRAME */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    What distance is your goal?
                  </label>
                  <span className="text-xs font-bold text-[#0593C6] tabular-nums">
                    {unit === 'miles'
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
                            setCustomDistStr(
                              unit === 'miles'
                                ? (preset.km * KM_TO_MILES).toFixed(2)
                                : preset.km.toString()
                            );
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap truncate ${
                          isSelected
                            ? 'bg-[#0593C6] text-white'
                            : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {selectedPreset === 'Custom' && (
                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="100"
                      value={customDistStr}
                      onChange={(e) => setCustomDistStr(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white tabular-nums focus:outline-none focus:border-[#0593C6]"
                    />
                    <span className="text-xs font-bold text-slate-500 shrink-0">{unit}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Target Goal Time or Pace (Optional)
                </label>
                <div className="relative">
                  <Target className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={targetTimeStr}
                    onChange={(e) => setTargetTimeStr(e.target.value)}
                    placeholder="e.g. 24:00 or 4:00"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white tabular-nums focus:outline-none focus:border-[#0593C6]"
                  />
                </div>

                {activePresetObj && activePresetObj.quickTimes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 mr-1">Quick targets:</span>
                    {activePresetObj.quickTimes.map((qt) => (
                      <button
                        key={qt}
                        type="button"
                        onClick={() => setTargetTimeStr(qt)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tabular-nums cursor-pointer ${
                          targetTimeStr === qt
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {qt}
                      </button>
                    ))}
                  </div>
                )}

                {parsedTargetSec && parsedTargetSec > 0 ? (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs tabular-nums text-emerald-700 dark:text-emerald-300 font-semibold">
                    {parsedTargetSec < 600
                      ? `Target Pace: ${formatDuration(parsedTargetSec)} /${unit === 'miles' ? 'mi' : 'km'} · Est. Finish: ${formatDuration(Math.round(parsedTargetSec * effectiveDistKm))}`
                      : `Goal Time: ${formatDuration(parsedTargetSec)} · Required Pace: ${formatPace(parsedTargetSec / effectiveDistKm, unit)}`}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter finish time (e.g. 24:00) or pace (e.g. 4:00), or leave blank for volume-only coaching.
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    In how long do you want to reach this goal?
                  </label>
                  <span className="text-xs font-bold text-[#0593C6] tabular-nums shrink-0">
                    {timeframeWeeks} {timeframeWeeks === 1 ? 'week' : 'weeks'} ({formattedTargetDate})
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {TIMEFRAME_PRESETS.map((tp) => {
                    const isSelected = timeframeWeeks === tp.weeks;
                    return (
                      <button
                        key={tp.weeks}
                        type="button"
                        onClick={() => setTimeframeWeeks(tp.weeks)}
                        className={`p-2 rounded-xl border text-center cursor-pointer ${
                          isSelected
                            ? 'bg-[#0593C6] text-white border-[#0593C6]'
                            : 'bg-slate-50 dark:bg-[#09121B] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-extrabold tabular-nums">{tp.label}</div>
                        <div
                          className={`text-[10px] ${
                            isSelected ? 'text-white/85' : 'text-slate-400'
                          }`}
                        >
                          {tp.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="range"
                    min={2}
                    max={52}
                    value={Math.min(52, Math.max(2, timeframeWeeks))}
                    onChange={(e) => setTimeframeWeeks(Number(e.target.value))}
                    className="flex-1 accent-[#0593C6] cursor-pointer"
                    aria-label="Target timeframe in weeks"
                  />
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <input
                      type="number"
                      min={1}
                      max={104}
                      value={timeframeWeeks}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) setTimeframeWeeks(Math.max(1, Math.min(104, val)));
                      }}
                      className="w-16 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-xs font-bold text-center text-slate-900 dark:text-white tabular-nums"
                    />
                    <span className="text-xs text-slate-500 font-semibold">wks</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: HOW MUCH YOU WANT TO RUN PER WEEK */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    How many days per week do you want to run?
                  </label>
                  <span className="text-xs font-bold text-[#0593C6] tabular-nums">
                    {weeklyRunGoal} {weeklyRunGoal === 1 ? 'run' : 'runs'} / week
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[2, 3, 4, 5, 6, 7].map((count) => {
                    const isSelected = weeklyRunGoal === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => handleSelectRunsPerWeek(count)}
                        className={`py-3 px-2 rounded-xl border text-center cursor-pointer ${
                          isSelected
                            ? 'bg-[#0593C6] text-white border-[#0593C6]'
                            : 'bg-slate-50 dark:bg-[#09121B] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="text-base font-extrabold tabular-nums">{count}x</div>
                        <div
                          className={`text-[10px] font-medium ${
                            isSelected ? 'text-white/85' : 'text-slate-400'
                          }`}
                        >
                          per wk
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {weeklyRunGoal <= 2
                    ? '2 runs/wk focuses on one threshold tempo session and one aerobic long run.'
                    : weeklyRunGoal === 3
                    ? '3 runs/wk is our balanced core structure: 1 interval workout, 1 threshold tempo, and 1 long run.'
                    : weeklyRunGoal <= 5
                    ? `${weeklyRunGoal} runs/wk pairs your 3 quality/long sessions with ${weeklyRunGoal - 3} easy recovery run${weeklyRunGoal - 3 > 1 ? 's' : ''} for stronger endurance.`
                    : `${weeklyRunGoal} runs/wk builds high aerobic frequency with dedicated easy flush days between hard sessions.`}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      How much distance do you want to run per week?
                    </label>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      Averages ~{avgRunDisplay} {unit} per session across {weeklyRunGoal} runs
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <input
                      type="number"
                      step="1"
                      min="5"
                      max="250"
                      value={weeklyDistStr}
                      onChange={(e) => {
                        setWeeklyDistStr(e.target.value);
                        setHasEditedWeeklyDist(true);
                      }}
                      className="w-20 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-sm font-extrabold text-right text-slate-900 dark:text-white tabular-nums focus:outline-none focus:border-[#0593C6]"
                    />
                    <span className="text-xs font-bold text-slate-500">{unit}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {weeklyDistPresets.map((presetVal) => {
                    const isSelected = Math.abs(parseFloat(weeklyDistStr || '0') - presetVal) < 0.8;
                    return (
                      <button
                        key={presetVal}
                        type="button"
                        onClick={() => {
                          setWeeklyDistStr(presetVal.toString());
                          setHasEditedWeeklyDist(true);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums cursor-pointer ${
                          isSelected
                            ? 'bg-[#0593C6] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {presetVal} {unit}/wk
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: RECOMMENDED WEEKLY SCHEDULE */}
          {step === 4 && (
            <div className="space-y-4">
              {/* Plan Summary Strip + Quick Adjusters */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {name.trim() ? `${name.trim()}'s` : 'Your'} Recommended Weekly Schedule
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                      Goal: {selectedPreset === 'Custom' ? `${effectiveDistKm.toFixed(1)}K` : selectedPreset}
                      {parsedTargetSec ? ` in ${formatDuration(parsedTargetSec)}` : ''} ·{' '}
                      {timeframeWeeks} wks (by {formattedTargetDate})
                    </div>
                  </div>

                  {/* Quick Live Adjustment Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="inline-flex items-center rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 px-1.5 py-1 text-xs tabular-nums">
                      <button
                        type="button"
                        onClick={() => handleSelectRunsPerWeek(Math.max(1, weeklyRunGoal - 1))}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        aria-label="Decrease weekly runs"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-1.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {weeklyRunGoal}x/wk
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectRunsPerWeek(Math.min(7, weeklyRunGoal + 1))}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        aria-label="Increase weekly runs"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="inline-flex items-center rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 px-1.5 py-1 text-xs tabular-nums">
                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseFloat(weeklyDistStr) || 20;
                          setWeeklyDistStr(Math.max(5, Math.round(cur - (unit === 'miles' ? 2 : 3))).toString());
                          setHasEditedWeeklyDist(true);
                        }}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        aria-label="Decrease weekly distance"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-1.5 font-bold text-[#0593C6] whitespace-nowrap">
                        {weeklyDistDisplay} {unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseFloat(weeklyDistStr) || 20;
                          setWeeklyDistStr(Math.round(cur + (unit === 'miles' ? 2 : 3)).toString());
                          setHasEditedWeeklyDist(true);
                        }}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        aria-label="Increase weekly distance"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                  {timeframeNote}
                </p>
              </div>

              {/* 7-Day Mon-Sun Schedule Breakdown */}
              <div className="space-y-2">
                {weeklyDaySchedule.map((item) => {
                  if (item.isRestDay || !item.slot) {
                    return (
                      <div
                        key={item.day}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-50/70 dark:bg-[#09121B]/60 border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <span className="w-9 text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                            {item.day}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 font-medium truncate">
                            {item.restNote}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                          Rest Day
                        </span>
                      </div>
                    );
                  }

                  const slot = item.slot;
                  const accentClass =
                    slot.id === 'interval'
                      ? 'text-amber-600 dark:text-amber-400 bg-amber-500/12'
                      : slot.id === 'tempo'
                      ? 'text-violet-600 dark:text-violet-400 bg-violet-500/12'
                      : slot.id === 'long_run'
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/12'
                      : 'text-[#0593C6] bg-[#0593C6]/12';
                  const Icon =
                    slot.id === 'interval'
                      ? Zap
                      : slot.id === 'tempo'
                      ? Gauge
                      : slot.id === 'long_run'
                      ? Heart
                      : Activity;

                  return (
                    <div
                      key={item.day}
                      className="px-3.5 py-3 rounded-xl bg-white dark:bg-[#101C28] border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start space-x-3 min-w-0">
                        <span className="w-9 pt-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#0593C6] shrink-0">
                          {item.day}
                        </span>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${accentClass}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {slot.name}
                            </span>
                            <span className="text-[11px] text-slate-400">· {slot.category}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            {slot.structure}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 tabular-nums">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {slot.suggestedDistanceFormatted}
                        </div>
                        {slot.targetPaceHint && (
                          <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            ~{slot.targetPaceHint}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#09121B] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onDismiss}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer whitespace-nowrap"
              >
                Skip for now
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {step > 1 && (
              <button
                type="button"
                onClick={onDismiss}
                className="px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer hidden sm:inline-block whitespace-nowrap"
              >
                Skip
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0593C6] hover:bg-[#047da8] text-white cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>{step === 3 ? 'Preview Weekly Schedule' : 'Continue'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#10B981] hover:bg-[#059669] text-white cursor-pointer whitespace-nowrap shrink-0"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Save Plan &amp; Start Training</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
