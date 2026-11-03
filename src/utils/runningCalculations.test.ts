import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDuration,
  parseDuration,
  calculatePaceSecPerKm,
  formatPace,
  calculate6kEquivalent,
  calculateTargetDistanceEquivalent,
  calculateTargetCutoff,
  groupRunsByWeek,
  inferRunType,
  findDuplicateRuns,
  isAerobicRun,
  isIntervalRun,
  calculateCategoryBreakdown,
  calculateRecoveryStatus,
  calculateGoalProjection,
  parseDateSafe,
  getIsoWeekKey,
  getCurrentWeekRange,
  isRunInCurrentWeek,
  calculateIntervalMetrics,
} from './runningCalculations';
import { RunRecord } from '../types/running';

test('formatDuration and parseDuration roundtrip correctly', () => {
  assert.equal(formatDuration(1260), '21:00');
  assert.equal(parseDuration('21:00'), 1260);
  assert.equal(parseDuration('24'), 1440); // 24 minutes
  assert.equal(parseDuration('24.5'), 1470); // 24m 30s
  assert.equal(parseDuration('24m'), 1440);
});

test('calculatePaceSecPerKm calculates pace', () => {
  const pace = calculatePaceSecPerKm(6.0, 1260);
  assert.equal(pace, 210);
  assert.equal(formatPace(pace, 'km'), '3:30 /km');
});

test('calculate6kEquivalent projects correctly', () => {
  assert.equal(calculate6kEquivalent(6.0, 1300), 1300);
});

test('calculateTargetCutoff calculates 23 seconds cut off from 4:43/km to 4:20/km', () => {
  // Current 6K: 28:18 (1698s) => pace 4:43/km (283s)
  // Target: 4:20 pace (260s) or 26:00 (1560s)
  const resultPaceInput = calculateTargetCutoff(260, 1698, 6.0);
  assert.ok(resultPaceInput);
  assert.equal(resultPaceInput.paceCutoffSeconds, 23); // exactly 23 seconds
  assert.equal(resultPaceInput.isAchieved, false);

  const resultTimeInput = calculateTargetCutoff(1560, 1698, 6.0);
  assert.ok(resultTimeInput);
  assert.equal(resultTimeInput.paceCutoffSeconds, 23); // exactly 23 seconds
});

test('inferRunType maps to clean categories', () => {
  assert.equal(inferRunType('Track 5x1000m Repeats', 6.0), 'Interval Training');
  assert.equal(inferRunType('Easy Recovery Shakeout', 5.0), 'Aerobic');
  assert.equal(inferRunType('Sunday Long Run', 10.0), 'Long Run');
  assert.equal(inferRunType('6K Time Trial on Grass', 6.0), '6K Time Trial');
});

test('isAerobicRun and isIntervalRun classify correctly', () => {
  assert.equal(isAerobicRun('Aerobic'), true);
  assert.equal(isAerobicRun('Easy'), true);
  assert.equal(isAerobicRun('Long Run'), true);
  assert.equal(isAerobicRun('Interval Training'), false);

  assert.equal(isIntervalRun('Interval Training'), true);
  assert.equal(isIntervalRun('Intervals'), true);
  assert.equal(isIntervalRun('Aerobic'), false);
});

test('findDuplicateRuns identifies matching runs and isolates unique ones', () => {
  const existingRuns: RunRecord[] = [
    {
      id: 'r1',
      userId: 'u1',
      date: '2026-10-25',
      title: '6K Tempo',
      distanceKm: 6.0,
      durationSeconds: 1350,
      averagePaceSecPerKm: 225,
      runType: 'Tempo',
      source: 'garmin',
      garminActivityId: 'act_101',
    },
  ];

  const incomingRuns: RunRecord[] = [
    {
      id: 'r_dup',
      userId: 'u1',
      date: '2026-10-25',
      title: '6K Tempo Re-import',
      distanceKm: 6.0,
      durationSeconds: 1350,
      averagePaceSecPerKm: 225,
      runType: 'Tempo',
      source: 'garmin',
      garminActivityId: 'act_101',
    },
    {
      id: 'r_new',
      userId: 'u1',
      date: '2026-10-27',
      title: 'Track 6x1000m Intervals',
      distanceKm: 7.2,
      durationSeconds: 1728,
      averagePaceSecPerKm: 240,
      runType: 'Interval Training',
      source: 'garmin',
      garminActivityId: 'act_102',
    },
  ];

  const { uniqueRuns, duplicateMatches } = findDuplicateRuns(incomingRuns, existingRuns);

  assert.equal(duplicateMatches.length, 1);
  assert.equal(duplicateMatches[0].incoming.id, 'r_dup');
  assert.equal(uniqueRuns.length, 1);
  assert.equal(uniqueRuns[0].id, 'r_new');
});

test('calculateCategoryBreakdown groups Easy, Interval, Tempo, and Race correctly', () => {
  const refDate = new Date('2026-10-30T12:00:00Z');
  const sampleRuns: RunRecord[] = [
    {
      id: '1',
      userId: 'u1',
      date: '2026-10-28',
      title: 'Easy Morning Aerobic Run',
      distanceKm: 8.0,
      durationSeconds: 2400,
      averagePaceSecPerKm: 300,
      runType: 'Easy',
      source: 'garmin',
    },
    {
      id: '2',
      userId: 'u1',
      date: '2026-10-25',
      title: 'Track Repeats',
      distanceKm: 6.0,
      durationSeconds: 1440,
      averagePaceSecPerKm: 240,
      runType: 'Interval Training',
      source: 'garmin',
    },
    {
      id: '3',
      userId: 'u1',
      date: '2026-10-20',
      title: 'Threshold Tempo',
      distanceKm: 6.0,
      durationSeconds: 1500,
      averagePaceSecPerKm: 250,
      runType: 'Tempo',
      source: 'garmin',
    },
    {
      id: '4',
      userId: 'u1',
      date: '2026-10-15',
      title: '6K Time Trial',
      distanceKm: 6.0,
      durationSeconds: 1560,
      averagePaceSecPerKm: 260,
      runType: '6K Time Trial',
      source: 'garmin',
    },
    {
      id: 'old',
      userId: 'u1',
      date: '2026-08-01', // > 30 days ago
      title: 'Summer Base Run',
      distanceKm: 10.0,
      durationSeconds: 3000,
      averagePaceSecPerKm: 300,
      runType: 'Easy',
      source: 'garmin',
    },
  ];

  const result = calculateCategoryBreakdown(sampleRuns, 30, refDate);
  assert.equal(result.totalRuns, 4); // Only the 4 runs in the last 30 days
  assert.equal(result.totalDistanceKm, 26.0);

  const easy = result.items.find((i) => i.category === 'Easy')!;
  const interval = result.items.find((i) => i.category === 'Interval')!;
  const tempo = result.items.find((i) => i.category === 'Tempo')!;
  const race = result.items.find((i) => i.category === 'Race')!;

  assert.equal(easy.runCount, 1);
  assert.equal(easy.totalDistanceKm, 8.0);
  assert.equal(interval.runCount, 1);
  assert.equal(interval.totalDistanceKm, 6.0);
  assert.equal(tempo.runCount, 1);
  assert.equal(tempo.totalDistanceKm, 6.0);
  assert.equal(race.runCount, 1);
  assert.equal(race.totalDistanceKm, 6.0);
});

test('calculateRecoveryStatus handles empty runs gracefully', () => {
  const status = calculateRecoveryStatus([]);
  assert.equal(status.hasRuns, false);
  assert.equal(status.recoveryPercentage, 100);
  assert.equal(status.readinessState, 'Fully Rested');
});

test('calculateRecoveryStatus reflects low recovery after recent hard workout', () => {
  const now = new Date('2026-10-31T15:00:00Z');
  const recentHardRun: RunRecord = {
    id: 'hard_race',
    userId: 'u1',
    date: '2026-10-31T12:00:00Z', // 3 hours ago
    title: 'XC 6K Championship Race',
    distanceKm: 6.0,
    durationSeconds: 1260, // 21:00 (3:30/km)
    averagePaceSecPerKm: 210,
    runType: 'Race',
    avgHeartRate: 184, // high HR
    maxHeartRate: 195,
    source: 'garmin',
  };

  const status = calculateRecoveryStatus([recentHardRun], now, 190);
  assert.equal(status.hasRuns, true);
  assert.equal(status.hoursSinceLastRun, 3);
  assert.ok(status.effortScore > 50, `Effort score should be high, was ${status.effortScore}`);
  assert.ok(status.recommendedRecoveryHours >= 24, `Should recommend >= 24h recovery, was ${status.recommendedRecoveryHours}`);
  assert.ok(status.recoveryPercentage < 40, `Recovery percentage after 3h should be < 40%, was ${status.recoveryPercentage}`);
  assert.equal(status.readinessState, 'Deep Recovery');
});

test('calculateRecoveryStatus reflects high recovery after sufficient elapsed time', () => {
  const now = new Date('2026-10-31T12:00:00Z');
  const pastRun: RunRecord = {
    id: 'easy_run',
    userId: 'u1',
    date: '2026-10-28T12:00:00Z', // 72 hours ago
    title: 'Easy 5K Base Run',
    distanceKm: 5.0,
    durationSeconds: 1600,
    averagePaceSecPerKm: 320,
    runType: 'Easy',
    avgHeartRate: 135,
    source: 'garmin',
  };

  const status = calculateRecoveryStatus([pastRun], now, 190);
  assert.equal(status.hasRuns, true);
  assert.equal(status.recoveryPercentage, 100);
  assert.equal(status.readinessState, 'Fully Rested');
  assert.equal(status.remainingRecoveryHours, 0);
});

test('calculateGoalProjection computes weeks remaining and trajectory milestones', () => {
  const currentRuns: RunRecord[] = [
    {
      id: 'r1',
      userId: 'u1',
      date: '2026-10-25',
      title: '6K Time Trial',
      distanceKm: 6.0,
      durationSeconds: 1380, // 23:00
      averagePaceSecPerKm: 230,
      runType: '6K Time Trial',
      best6kTimeSeconds: 1380,
      source: 'garmin',
    },
  ];

  // Target: 21:00 (1260s)
  const projection = calculateGoalProjection(currentRuns, 6.0, 1260, 1380, 3, 2);
  assert.equal(projection.hasTarget, true);
  assert.equal(projection.hasData, true);
  assert.equal(projection.isAchieved, false);
  assert.equal(projection.gapSeconds, 120);
  assert.ok(projection.estimatedWeeks >= 6 && projection.estimatedWeeks <= 12);
  assert.ok(projection.milestones.length >= 3);
  assert.ok(projection.projectedCompletionDate.length > 0);

  // When goal is surpassed
  const achievedProjection = calculateGoalProjection(currentRuns, 6.0, 1500, 1380, 3, 2);
  assert.equal(achievedProjection.isAchieved, true);
  assert.equal(achievedProjection.estimatedWeeks, 0);

  // When no target provided
  const noTargetProjection = calculateGoalProjection(currentRuns, 6.0, undefined, 1380, 3, 2);
  assert.equal(noTargetProjection.hasTarget, false);
});

test('parseDateSafe safely parses YYYY-MM-DD and preserves local calendar date', () => {
  const d = parseDateSafe('2026-11-02');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 10); // November is 10
  assert.equal(d.getDate(), 2);
});

test('getIsoWeekKey and isRunInCurrentWeek correctly partition runs by week', () => {
  // Monday Nov 2, 2026 to Sunday Nov 8, 2026 is week 2026-W45
  const nov2Key = getIsoWeekKey('2026-11-02').key;
  const nov8Key = getIsoWeekKey('2026-11-08').key;
  const nov9Key = getIsoWeekKey('2026-11-09').key; // next week
  const oct31Key = getIsoWeekKey('2026-10-31').key; // previous week

  assert.equal(nov2Key, '2026-W45');
  assert.equal(nov8Key, '2026-W45');
  assert.equal(nov9Key, '2026-W46');
  assert.equal(oct31Key, '2026-W44');

  const refDate = new Date('2026-11-04T10:00:00Z'); // Wednesday in W45
  assert.equal(isRunInCurrentWeek('2026-11-02', refDate), true);
  assert.equal(isRunInCurrentWeek('2026-11-08', refDate), true);
  assert.equal(isRunInCurrentWeek('2026-10-31', refDate), false); // last week
  assert.equal(isRunInCurrentWeek('2026-11-09', refDate), false); // next week
});

test('groupRunsByWeek excludes previous week runs from current week runsCount', () => {
  const runs: RunRecord[] = [
    {
      id: 'old_run',
      userId: 'u1',
      date: '2026-10-25', // Week 43
      title: 'Past Week Long Run',
      distanceKm: 10.0,
      durationSeconds: 3000,
      averagePaceSecPerKm: 300,
      runType: 'Long Run',
      source: 'manual',
    },
    {
      id: 'prev_run',
      userId: 'u1',
      date: '2026-10-30', // Week 44
      title: 'Previous Week Tempo',
      distanceKm: 6.0,
      durationSeconds: 1500,
      averagePaceSecPerKm: 250,
      runType: 'Tempo',
      source: 'manual',
    },
  ];

  const { weeklyStats } = groupRunsByWeek(runs, 3);
  // Current ISO week for 2026-11-02 is 2026-W45
  const w45 = weeklyStats.find((w) => w.weekKey === '2026-W45');
  assert.equal(w45, undefined); // No runs occurred in W45, so no W45 stat exists
});

test('calculateIntervalMetrics strips rest duration from Garmin workout and computes pure interval pace', () => {
  // Scenario: 5 x 1000m repeats with 90s rest
  // Garmin recorded total duration: 32:00 (1920s) for 7.0km (including 4 rests of 90s = 360s)
  // Target interval pace: 3:30/km (210s)
  const result = calculateIntervalMetrics({
    totalDurationSeconds: 1920, // 32 mins
    repCount: 5,
    repDistanceMeters: 1000,
    restDurationSeconds: 90,
    targetPaceSecPerKm: 210, // 3:30
  });

  assert.equal(result.workDistanceKm, 5.0);
  assert.equal(result.totalRestSeconds, 360); // 4 rests * 90s = 360s
  assert.equal(result.activeWorkDurationSeconds, 1560); // 1920 - 360 = 1560s (26 mins)
  assert.equal(result.activeIntervalPaceSecPerKm, 312); // 1560 / 5 = 312s (5:12/km)
  assert.equal(result.restDeductionFormatted, '06:00');
  assert.equal(result.isPaceMet, false); // 5:12 is slower than 3:30
});




