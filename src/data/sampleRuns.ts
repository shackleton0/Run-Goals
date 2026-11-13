import { RunRecord, UserProfile } from '../types/running';
import {
  calculatePaceSecPerKm,
  calculate6kEquivalent,
  calculateTargetDistanceEquivalent,
  formatLocalDateString,
} from '../utils/runningCalculations';

// Pure default clean profile with no mock names, fake emails, or placeholder target times
export const DEFAULT_RUNNER_PROFILE: UserProfile = {
  id: '',
  email: '',
  displayName: '',
  weeklyRunGoal: 3,
  unitPreference: 'km',
};

// Zero placeholder data by default
export const INITIAL_SAMPLE_RUNS: RunRecord[] = [];

export const PLACEHOLDER_ID_PREFIX = 'placeholder_run_';

export function isPlaceholderRun(run: Pick<RunRecord, 'id'>): boolean {
  return Boolean(run?.id && run.id.startsWith(PLACEHOLDER_ID_PREFIX));
}

/**
 * Generates an opt-in set of realistic multi-week placeholder workouts so runners
 * can preview progression curves, Body Battery, adherence, and badges before uploading data.
 */
export function createPlaceholderRuns(
  userId: string = 'local_user',
  targetDistanceKm: number = 6.0,
  referenceDate: Date = new Date()
): RunRecord[] {
  const daysAgo = (n: number): string => {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - n);
    return formatLocalDateString(d);
  };

  const specs: Array<{
    suffix: string;
    daysBack: number;
    title: string;
    distanceKm: number;
    durationSeconds: number;
    runType: RunRecord['runType'];
    avgHeartRate: number;
    maxHeartRate: number;
    avgCadence: number;
    elevationGainMeters: number;
    slotId?: RunRecord['slotId'];
    notes: string;
    interval?: {
      repCount: number;
      repDistanceMeters: number;
      restDurationSeconds: number;
      targetPaceSecPerKm: number;
      activeIntervalPaceSecPerKm: number;
    };
  }> = [
    {
      suffix: 'w0_tempo',
      daysBack: 1,
      title: 'Threshold Tempo Builder (Sample)',
      distanceKm: 6.0,
      durationSeconds: 1560, // 26:00 -> 4:20/km
      runType: 'Tempo',
      avgHeartRate: 171,
      maxHeartRate: 183,
      avgCadence: 180,
      elevationGainMeters: 42,
      slotId: 'tempo',
      notes: 'Placeholder workout: controlled lactate threshold pacing.',
    },
    {
      suffix: 'w0_intervals',
      daysBack: 3,
      title: '5 x 1000m Track Repeats (Sample)',
      distanceKm: 5.0,
      durationSeconds: 1470, // 24:30 incl. rest
      runType: 'Intervals',
      avgHeartRate: 168,
      maxHeartRate: 188,
      avgCadence: 184,
      elevationGainMeters: 8,
      slotId: 'interval',
      notes: 'Placeholder workout: 90s standing recovery between 1K reps.',
      interval: {
        repCount: 5,
        repDistanceMeters: 1000,
        restDurationSeconds: 90,
        targetPaceSecPerKm: 225, // 3:45/km
        activeIntervalPaceSecPerKm: 222, // 3:42/km
      },
    },
    {
      suffix: 'w1_long',
      daysBack: 6,
      title: 'Sunday Trail Aerobic Long Run (Sample)',
      distanceKm: 11.2,
      durationSeconds: 3360, // 56:00 -> 5:00/km
      runType: 'Long Run',
      avgHeartRate: 151,
      maxHeartRate: 164,
      avgCadence: 172,
      elevationGainMeters: 135,
      slotId: 'long_run',
      notes: 'Placeholder workout: relaxed aerobic base volume on soft trails.',
    },
    {
      suffix: 'w1_hills',
      daysBack: 9,
      title: 'Steep Incline Hill Repeats (Sample)',
      distanceKm: 6.4,
      durationSeconds: 1920,
      runType: 'Hill Repeats',
      avgHeartRate: 169,
      maxHeartRate: 185,
      avgCadence: 176,
      elevationGainMeters: 210,
      notes: 'Placeholder workout: 8 x 60s uphill power surges.',
    },
    {
      suffix: 'w1_easy',
      daysBack: 11,
      title: 'Recovery Shakeout Miles (Sample)',
      distanceKm: 5.2,
      durationSeconds: 1664, // 5:20/km
      runType: 'Easy',
      avgHeartRate: 141,
      maxHeartRate: 152,
      avgCadence: 168,
      elevationGainMeters: 28,
      notes: 'Placeholder workout: low heart rate recovery flush.',
    },
    {
      suffix: 'w2_tt',
      daysBack: 14,
      title: 'Mid-Block 6K Time Trial (Sample)',
      distanceKm: 6.0,
      durationSeconds: 1530, // 25:30 -> 4:15/km
      runType: '6K Time Trial',
      avgHeartRate: 178,
      maxHeartRate: 191,
      avgCadence: 182,
      elevationGainMeters: 36,
      notes: 'Placeholder workout: negative split time trial benchmark.',
    },
    {
      suffix: 'w2_aerobic',
      daysBack: 17,
      title: 'Steady Aerobic Loop (Sample)',
      distanceKm: 8.5,
      durationSeconds: 2508, // 4:55/km
      runType: 'Aerobic',
      avgHeartRate: 154,
      maxHeartRate: 166,
      avgCadence: 173,
      elevationGainMeters: 64,
      notes: 'Placeholder workout: steady state aerobic conditioning.',
    },
    {
      suffix: 'w3_tt',
      daysBack: 24,
      title: 'Early Season 5K Benchmark (Sample)',
      distanceKm: 5.0,
      durationSeconds: 1320, // 22:00 -> 4:24/km (~26:41 eq 6K)
      runType: 'Time Trial',
      avgHeartRate: 175,
      maxHeartRate: 189,
      avgCadence: 179,
      elevationGainMeters: 25,
      notes: 'Placeholder workout: opening season pace check.',
    },
    {
      suffix: 'w3_long',
      daysBack: 27,
      title: 'Base Endurance Long Run (Sample)',
      distanceKm: 10.0,
      durationSeconds: 3060, // 51:00 -> 5:06/km
      runType: 'Long Run',
      avgHeartRate: 149,
      maxHeartRate: 162,
      avgCadence: 170,
      elevationGainMeters: 95,
      notes: 'Placeholder workout: foundational endurance builder.',
    },
  ];

  return specs.map((spec) => {
    const avgPace = Math.round(calculatePaceSecPerKm(spec.distanceKm, spec.durationSeconds));
    const eq6k = calculate6kEquivalent(spec.distanceKm, spec.durationSeconds);
    const eqTarget = calculateTargetDistanceEquivalent(spec.distanceKm, spec.durationSeconds, targetDistanceKm);

    const record: RunRecord = {
      id: `${PLACEHOLDER_ID_PREFIX}${spec.suffix}`,
      userId,
      date: daysAgo(spec.daysBack),
      title: spec.title,
      distanceKm: spec.distanceKm,
      durationSeconds: spec.durationSeconds,
      averagePaceSecPerKm: avgPace,
      best6kTimeSeconds: eq6k,
      targetEquivalentSeconds: eqTarget,
      runType: spec.runType,
      avgHeartRate: spec.avgHeartRate,
      maxHeartRate: spec.maxHeartRate,
      avgCadence: spec.avgCadence,
      elevationGainMeters: spec.elevationGainMeters,
      source: 'manual',
      notes: spec.notes,
      slotId: spec.slotId,
      createdAt: referenceDate.toISOString(),
    };

    if (spec.interval) {
      const totalRest = Math.max(0, (spec.interval.repCount - 1) * spec.interval.restDurationSeconds);
      const workDistKm = (spec.interval.repCount * spec.interval.repDistanceMeters) / 1000;
      const activeWorkDur = Math.max(60, spec.durationSeconds - totalRest);
      record.targetIntervalPaceSecPerKm = spec.interval.targetPaceSecPerKm;
      record.activeIntervalPaceSecPerKm = spec.interval.activeIntervalPaceSecPerKm;
      record.repCount = spec.interval.repCount;
      record.repDistanceMeters = spec.interval.repDistanceMeters;
      record.restDurationSeconds = spec.interval.restDurationSeconds;
      record.totalRestSeconds = totalRest;
      record.intervalDetails = {
        repCount: spec.interval.repCount,
        repDistanceMeters: spec.interval.repDistanceMeters,
        restDurationSeconds: spec.interval.restDurationSeconds,
        totalRestSeconds: totalRest,
        targetPaceSecPerKm: spec.interval.targetPaceSecPerKm,
        activeIntervalPaceSecPerKm: spec.interval.activeIntervalPaceSecPerKm,
        activeWorkDurationSeconds: activeWorkDur,
        workDistanceKm: workDistKm,
      };
    }

    return record;
  });
}
