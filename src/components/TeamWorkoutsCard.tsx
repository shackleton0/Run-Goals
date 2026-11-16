import React, { useState } from 'react';
import { PlannedTeamWorkout, RunRecord, UserProfile } from '../types/running';
import {
  formatDuration,
  formatPace,
  calculatePaceSecPerKm,
  calculate6kEquivalent,
  calculateTargetDistanceEquivalent,
  buildTeamRunDocId,
  formatLocalDateString,
  KM_TO_MILES,
} from '../utils/runningCalculations';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  Pencil,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TeamWorkoutsCardProps {
  workouts: PlannedTeamWorkout[];
  runs: RunRecord[];
  profile: UserProfile;
  userId?: string;
  onCompleteWorkout: (run: RunRecord) => Promise<void> | void;
  onCustomizeWorkout: (workout: PlannedTeamWorkout) => void;
}

export const TeamWorkoutsCard: React.FC<TeamWorkoutsCardProps> = ({
  workouts,
  runs,
  profile,
  userId,
  onCompleteWorkout,
  onCustomizeWorkout,
}) => {
  const [showAll, setShowAll] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  if (!workouts || workouts.length === 0) return null;

  const todayStr = formatLocalDateString(new Date());
  const unit = profile.unitPreference || 'km';
  const targetDistKm = profile.targetDistanceKm || 6.0;

  const sortedWorkouts = [...workouts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const visibleWorkouts = showAll ? sortedWorkouts : sortedWorkouts.slice(0, 3);

  const isWorkoutDone = (w: PlannedTeamWorkout): boolean => {
    const uid = userId || profile.id;
    const detId = uid ? buildTeamRunDocId(w.id, uid) : '';
    const loggedInRuns = runs.some(
      (r) => r.plannedWorkoutId === w.id || (detId && r.id === detId)
    );
    const markedByCoach = Boolean(uid && w.completedUserIds?.includes(uid));
    return loggedInRuns || markedByCoach;
  };

  const completedCount = sortedWorkouts.filter(isWorkoutDone).length;

  const handleQuickComplete = async (w: PlannedTeamWorkout) => {
    if (completingId) return;
    setCompletingId(w.id);
    try {
      const uid = userId || profile.id || 'local_user';
      const distKm = Math.max(0.1, Number(w.distanceKm) || 1);
      const durSec =
        w.durationSeconds && w.durationSeconds > 0
          ? Math.round(w.durationSeconds)
          : Math.max(60, Math.round(distKm * 300));
      const newRun: RunRecord = {
        id: buildTeamRunDocId(w.id, uid),
        userId: uid,
        teamCode: profile.teamCode,
        date: w.date || todayStr,
        title: w.title,
        distanceKm: Number(distKm.toFixed(2)),
        durationSeconds: durSec,
        averagePaceSecPerKm: Math.round(calculatePaceSecPerKm(distKm, durSec)),
        best6kTimeSeconds: calculate6kEquivalent(distKm, durSec),
        targetEquivalentSeconds: calculateTargetDistanceEquivalent(distKm, durSec, targetDistKm),
        runType: w.runType,
        source: 'manual',
        plannedWorkoutId: w.id,
        notes: [w.targetPaceHint, w.notes].filter(Boolean).join(' · ') || 'Team workout completed',
        createdAt: new Date().toISOString(),
      };
      await onCompleteWorkout(newRun);
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <section
      aria-label="Coach Planned Team Workouts"
      className="rounded-2xl bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
              Coach&apos;s Team Workouts
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
              {profile.teamName || 'Your Team'} · {sortedWorkouts.length} planned · {completedCount}{' '}
              completed
            </p>
          </div>
        </div>

        {sortedWorkouts.length > 3 && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#0593C6] hover:bg-sky-500/10 transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>{showAll ? 'Show Fewer' : `Show All (${sortedWorkouts.length})`}</span>
            {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {visibleWorkouts.map((w) => {
          const done = isWorkoutDone(w);
          const distLabel =
            unit === 'miles'
              ? `${(w.distanceKm * KM_TO_MILES).toFixed(2)} mi`
              : `${w.distanceKm.toFixed(1)} km`;
          const estPace =
            w.durationSeconds > 0
              ? formatPace(calculatePaceSecPerKm(w.distanceKm, w.durationSeconds), unit)
              : null;

          return (
            <div
              key={w.id}
              className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-bold text-slate-900 dark:text-white">{w.title}</span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    · {w.date === todayStr ? `Today (${w.date})` : w.date} · {w.runType}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                  <span className="font-bold text-slate-800 dark:text-slate-100">{distLabel}</span>
                  {w.durationSeconds > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatDuration(w.durationSeconds)}
                    </span>
                  )}
                  {estPace && <span className="text-[#0593C6] font-semibold">{estPace}</span>}
                  {w.targetPaceHint && (
                    <span className="font-sans text-emerald-700 dark:text-emerald-400 font-semibold">
                      Target: {w.targetPaceHint}
                    </span>
                  )}
                </div>

                {w.notes && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-0.5">
                    {w.notes}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {done ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs whitespace-nowrap">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Completed</span>
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onCustomizeWorkout(w)}
                      disabled={completingId !== null}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit &amp; Log</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickComplete(w)}
                      disabled={completingId !== null}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{completingId === w.id ? 'Logging...' : 'Mark Completed'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
