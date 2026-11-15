import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, AdherenceSummary } from '../types/running';
import {
  formatDuration,
  formatPace,
  calculateTargetCutoff,
  resolveTargetGoalName,
  calculateRaceCountdown,
  RaceCountdownInfo,
} from '../utils/runningCalculations';
import {
  Trophy,
  Target,
  Edit2,
  Calendar,
  Clock,
  TrendingDown,
  CheckCircle2,
  Flame,
  Share2,
  ChevronDown,
  Flag,
} from 'lucide-react';

interface GoalBannerProps {
  profile: UserProfile;
  adherence: AdherenceSummary;
  best6kSec?: number;
  isShortDistanceEstimate?: boolean;
  onEditGoal: () => void;
  onEditRaceDay?: () => void;
  onShare?: () => void;
}

const RaceCountdownTimer: React.FC<{
  countdown: RaceCountdownInfo;
  onEditRaceDay: () => void;
}> = ({ countdown, onEditRaceDay }) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (countdown.status !== 'upcoming') return;
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [countdown.status, countdown.targetMidnightMs]);

  const diffMs = Math.max(0, countdown.targetMidnightMs - nowMs);
  const totalSec = Math.floor(diffMs / 1000);
  const liveDays = Math.floor(totalSec / 86400);
  const liveHours = Math.floor((totalSec % 86400) / 3600);
  const liveMinutes = Math.floor((totalSec % 3600) / 60);
  const liveSeconds = totalSec % 60;

  return (
    <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-sky-500/10 border border-amber-500/25 dark:border-amber-500/30">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <Flag className="w-3.5 h-3.5 shrink-0" />
            <span>Target Race Day Countdown</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            {countdown.status === 'today' ? (
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                Race Day Today!
              </span>
            ) : countdown.status === 'passed' ? (
              <span className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                {Math.abs(countdown.daysRemaining)}{' '}
                {Math.abs(countdown.daysRemaining) === 1 ? 'day' : 'days'} since race day
              </span>
            ) : (
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                {countdown.daysRemaining}{' '}
                <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
                  {countdown.daysRemaining === 1 ? 'day' : 'days'} left
                </span>
              </span>
            )}
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums">
              · {countdown.formattedDate}
            </span>
          </div>
        </div>

        {countdown.status === 'upcoming' ? (
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 shrink-0 tabular-nums">
            {[
              { label: 'Days', val: String(liveDays).padStart(2, '0') },
              { label: 'Hrs', val: String(liveHours).padStart(2, '0') },
              { label: 'Min', val: String(liveMinutes).padStart(2, '0') },
              { label: 'Sec', val: String(liveSeconds).padStart(2, '0') },
            ].map((cell) => (
              <div
                key={cell.label}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-white dark:bg-[#0D1620] border border-amber-500/20 dark:border-amber-500/25 text-center min-w-[52px]"
              >
                <div className="text-sm sm:text-base font-extrabold font-mono text-slate-900 dark:text-white leading-tight">
                  {cell.val}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {cell.label}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={onEditRaceDay}
            className="self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Update Race Date
          </button>
        )}
      </div>
    </div>
  );
};

export const GoalBanner: React.FC<GoalBannerProps> = ({
  profile,
  adherence,
  best6kSec,
  isShortDistanceEstimate = false,
  onEditGoal,
  onEditRaceDay,
  onShare,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const targetDistKm = profile.targetDistanceKm || 6.0;
  const targetSec = profile.target6kTimeSeconds;
  const currentSec = best6kSec || profile.current6kPrSeconds;

  const raceCountdown = useMemo(
    () => calculateRaceCountdown(profile.targetGoalDate),
    [profile.targetGoalDate]
  );

  const cutoff = calculateTargetCutoff(targetSec, currentSec, targetDistKm);

  const targetPacePerKm = cutoff
    ? cutoff.targetPaceSecPerKm
    : targetSec && targetSec >= 600
    ? targetSec / targetDistKm
    : targetSec && targetSec < 600
    ? targetSec
    : null;

  const targetTotalTimeSec = cutoff
    ? cutoff.targetTotalSec
    : targetSec && targetSec >= 600
    ? targetSec
    : targetSec
    ? Math.round(targetSec * targetDistKm)
    : null;

  const currentPacePerKm = cutoff
    ? cutoff.currentPaceSecPerKm
    : currentSec
    ? currentSec / targetDistKm
    : null;
  const goalAchieved = cutoff ? cutoff.isAchieved : false;

  const baselineSec = Math.max(1600, (currentSec || 1500) + 120);
  let progressPct = 0;
  if (currentSec && targetTotalTimeSec) {
    if (goalAchieved) {
      progressPct = 100;
    } else {
      const totalSpan = baselineSec - targetTotalTimeSec;
      const currentProgress = baselineSec - currentSec;
      progressPct = Math.max(5, Math.min(95, Math.round((currentProgress / totalSpan) * 100)));
    }
  }

  const distTitle = resolveTargetGoalName(
    targetDistKm,
    profile.targetGoalName,
    '6K Race Target'
  );
  const distCardLabel = targetDistKm === 6 ? 'Target 6K' : `Target ${targetDistKm}K`;
  const projectedCardLabel =
    targetDistKm === 6 ? 'Fastest Projected 6K Time' : `Fastest Projected ${targetDistKm}K Time`;

  const handleHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsExpanded((prev) => !prev);
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#0F1C28] border border-slate-200/95 dark:border-slate-700/75 shadow-sm transition-colors">
      {/* Full-bleed sensitive Dropdown Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded((prev) => !prev)}
        onKeyDown={handleHeaderKeyDown}
        className="w-full px-3.5 py-3.5 sm:px-5 sm:py-4.5 flex items-center justify-between text-left cursor-pointer group accordion-trigger select-none hover:bg-slate-50/90 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        data-no-scale
        aria-expanded={isExpanded}
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sky-500 flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105">
            <Target className="w-4.5 h-4.5 stroke-[2.3]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">
                {distTitle}
              </h2>
              {goalAchieved ? (
                <span className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Target Achieved</span>
                </span>
              ) : targetTotalTimeSec ? (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  · {distCardLabel} {formatDuration(targetTotalTimeSec)}
                  {profile.goalTimeframeWeeks ? ` · ${profile.goalTimeframeWeeks}-Wk Plan` : ''}
                </span>
              ) : profile.goalTimeframeWeeks ? (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  · {profile.goalTimeframeWeeks}-Wk Plan
                </span>
              ) : null}

              {raceCountdown && (
                <span
                  className={`inline-flex items-center space-x-1 text-xs font-bold tabular-nums ${
                    raceCountdown.status === 'today'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : raceCountdown.status === 'passed'
                      ? 'text-slate-500 dark:text-slate-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="sm:hidden">{raceCountdown.compactLabel}</span>
                  <span className="hidden sm:inline">
                    {raceCountdown.daysLabel} ({raceCountdown.shortDate})
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls & Dropdown Chevron */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0 ml-2">
          {onShare && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
              className="inline-flex items-center space-x-1.5 px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              title="Show off progress to friends"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Show Off</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditGoal();
            }}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title="Edit Target Benchmark"
            aria-label="Edit Target"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

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
      </div>

      {/* Expanded Content Dropdown */}
      <div
        className={`accordion-collapse-wrapper ${isExpanded ? 'is-expanded' : ''}`}
        aria-hidden={!isExpanded}
      >
        <div className="accordion-collapse-inner">
          <div className="px-3.5 pb-4 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4 sm:space-y-5">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Structured distance conditioning and microcycle pacing ({targetDistKm.toFixed(1)} km benchmark)
            </p>

            {/* Optional Race Day Countdown Card (only rendered when user added a race day) */}
            {raceCountdown && (
              <RaceCountdownTimer
                countdown={raceCountdown}
                onEditRaceDay={onEditRaceDay || onEditGoal}
              />
            )}

            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {/* Target Distance Time */}
              <div className="p-3 sm:p-4 rounded-xl bg-sky-50/70 dark:bg-sky-950/25 border border-sky-200/80 dark:border-sky-800/60 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider mb-1">
                  <span>{distCardLabel}</span>
                  <Target className="w-3.5 h-3.5 text-sky-500" />
                </div>
                <div className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums font-sans">
                  {targetTotalTimeSec ? formatDuration(targetTotalTimeSec) : '--:--'}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 tabular-nums">
                  {targetPacePerKm
                    ? `Pace: ${formatPace(targetPacePerKm, profile.unitPreference)}`
                    : 'Click edit to configure'}
                </div>
              </div>

              {/* Current PR / Best */}
              <div className="p-3 sm:p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/80 dark:border-emerald-800/60 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-1">
                  <span>Current Trial PR</span>
                  <Trophy className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums font-sans">
                  {currentSec ? formatDuration(currentSec) : '--:--'}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 tabular-nums">
                  {cutoff
                    ? !cutoff.isAchieved
                      ? `Cut off ${cutoff.paceCutoffSeconds}s to goal`
                      : 'Goal reached'
                    : currentSec
                    ? `${formatPace(currentPacePerKm || 0, profile.unitPreference)}`
                    : 'No workouts logged'}
                </div>
              </div>

              {/* Weekly Microcycle */}
              <div className="p-3 sm:p-4 rounded-xl bg-violet-50/70 dark:bg-violet-950/25 border border-violet-200/80 dark:border-violet-800/60 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider mb-1">
                  <span>Weekly Microcycle</span>
                  <Calendar className="w-3.5 h-3.5 text-violet-500" />
                </div>
                <div className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums font-sans">
                  {adherence.currentWeekRuns} / {profile.weeklyRunGoal}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {adherence.currentWeekGoalMet
                    ? 'Weekly quota completed'
                    : `${profile.weeklyRunGoal - adherence.currentWeekRuns} session(s) remaining`}
                </div>
              </div>

              {/* Consistency Streak */}
              <div className="p-3 sm:p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/60 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-1">
                  <span>Adherence Streak</span>
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums font-sans">
                  {adherence.currentStreakWeeks > 0 ? (
                    <>
                      {adherence.currentStreakWeeks}{' '}
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400">wks</span>
                    </>
                  ) : (
                    '--'
                  )}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {adherence.totalWeeksTracked > 0
                    ? `${adherence.adherencePercentage}% weeks completed`
                    : 'Tracking consistency'}
                </div>
              </div>
            </div>

            {/* Under Target: Fastest Current Benchmark & Time to Cut Off */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200 dark:border-slate-700/80">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-sky-500" />
                    <span>{projectedCardLabel}</span>
                  </div>

                  <div className="flex items-baseline space-x-3">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                      {currentSec ? formatDuration(currentSec) : '--:--'}
                    </span>
                    {currentPacePerKm && (
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                        Pace: {formatPace(currentPacePerKm, profile.unitPreference)}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {currentSec
                      ? isShortDistanceEstimate
                        ? `Estimated with anaerobic fatigue scaling from a <2.5 km run — log a 3+ km continuous run for race-accurate ${targetDistKm}K pacing.`
                        : `Computed from your fastest qualifying workout equivalent across ${targetDistKm} km.`
                      : `Upload workouts or log training to compute your fastest projected ${targetDistKm}K trial.`}
                  </p>
                </div>

                <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200 dark:border-slate-800">
                  {cutoff ? (
                    !cutoff.isAchieved ? (
                      <div className="space-y-1">
                        <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-500/30">
                          <TrendingDown className="w-3.5 h-3.5" />
                          <span>
                            Cut off: {cutoff.paceCutoffSeconds}{' '}
                            {cutoff.paceCutoffSeconds === 1 ? 'second' : 'seconds'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          {formatPace(cutoff.currentPaceSecPerKm, profile.unitPreference)} →{' '}
                          {formatPace(cutoff.targetPaceSecPerKm, profile.unitPreference)} ({cutoff.paceCutoffSeconds}s
                          pace reduction to goal)
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 text-xs font-bold border border-sky-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Target Surpassed ({Math.abs(cutoff.paceCutoffSeconds)}s ahead of pace)</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          Exceeding your{' '}
                          <strong className="text-slate-900 dark:text-white">
                            {formatPace(cutoff.targetPaceSecPerKm, profile.unitPreference)}
                          </strong>{' '}
                          pace benchmark
                        </p>
                      </div>
                    )
                  ) : !targetSec ? (
                    <button
                      onClick={onEditGoal}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-[#0EA5E9] hover:bg-[#0284C7] text-white transition-colors cursor-pointer shadow-xs"
                    >
                      Set Target Benchmark
                    </button>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Awaiting your first workout to compute pace gap
                    </p>
                  )}
                </div>
              </div>

              {targetSec && currentSec && (
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 mb-1.5 tabular-nums">
                    <span className="font-semibold">Goal Trajectory</span>
                    <span className="font-bold text-slate-900 dark:text-white">{progressPct}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#0EA5E9] via-[#06B6D4] to-[#10B981] h-2.5 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
