import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDuration,
  parseDuration,
  calculatePaceSecPerKm,
  formatPace,
  parsePace,
  calculate6kEquivalent,
  calculateTargetDistanceEquivalent,
  selectBestTargetEquivalent,
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
  getSuggestedWeeklySchedule,
  isHillRun,
  calculateMonthlyConsistency,
} from './runningCalculations';
import { RunRecord } from '../types/running';

test('formatDuration and parseDuration roundtrip correctly', () => {
  assert.equal(formatDuration(1260), '21:00');
  assert.equal(parseDuration('21:00'), 1260);
  assert.equal(parseDuration('24'), 1440); // 24 minutes
  assert.equal(parseDuration('24.5'), 1470); // 24m 30s
  assert.equal(parseDuration('24m'), 1440);
});

test('calculatePaceSecPerKm calculates pace and parsePace parses formats correctly', () => {
  const pace = calculatePaceSecPerKm(6.0, 1260);
  assert.equal(pace, 210);
  assert.equal(formatPace(pace, 'km'), '3:30 /km');
  assert.equal(parsePace('3:30'), 210);
  assert.equal(parsePace('3:30 /km'), 210);
  assert.equal(parsePace('5:38 /mi'), 210); // 338 / 1.60934 = 210
});

test('calculate6kEquivalent projects correctly including short 1k distance fatigue decay', () => {
  assert.equal(calculate6kEquivalent(6.0, 1300), 1300);

  // 1K in 3:56 (236s) should extrapolate to a significantly slower 6K pace (~5:03/km => ~1821s / 30:21), never ~3:56/km
  const projected1kTo6k = calculate6kEquivalent(1.0, 236);
  const projectedPace = projected1kTo6k / 6.0;
  assert.ok(projectedPace >= 290, `Projected 6K pace from 1K 3:56 should be >= 4:50/km (290s), was ${projectedPace}s`);
  assert.ok(projected1kTo6k >= 1750, `Projected 6K total from 1K 3:56 should be >= 29:10, was ${projected1kTo6k}s`);
});

test('selectBestTargetEquivalent prioritizes continuous 2.5km+ runs over short 1k sprints or intervals', () => {
  const runs: RunRecord[] = [
    {
      id: 'fast_1k',
      userId: 'u1',
      date: '2026-11-10',
      title: 'Fast 1K Test',
      distanceKm: 1.0,
      durationSeconds: 236, // 3:56/km
      averagePaceSecPerKm: 236,
      runType: 'Time Trial',
      source: 'manual',
    },
    {
      id: 'tempo_5k',
      userId: 'u1',
      date: '2026-11-08',
      title: 'Steady 5K',
      distanceKm: 5.0,
      durationSeconds: 1500, // 5:00/km -> 6K eq ~30:23
      averagePaceSecPerKm: 300,
      runType: 'Tempo',
      source: 'manual',
    },
  ];
  const res = selectBestTargetEquivalent(runs, 6.0);
  assert.equal(res.basisRun?.id, 'tempo_5k');
  assert.equal(res.isShortDistanceEstimate, false);

  // When only 1K run exists, flags as short distance estimate with steep fatigue curve
  const shortOnly = selectBestTargetEquivalent([runs[0]], 6.0);
  assert.equal(shortOnly.basisRun?.id, 'fast_1k');
  assert.equal(shortOnly.isShortDistanceEstimate, true);
  assert.ok((shortOnly.bestSeconds || 0) >= 1750);
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
  assert.equal(status.bodyBatteryScore, 100);
  assert.equal(status.batteryStatusLabel, 'Prime Charge');
  assert.equal(status.readinessState, 'Fully Rested');
});

test('calculateRecoveryStatus reflects low recovery and Body Battery drain after recent hard workout', () => {
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
  assert.ok(status.bodyBatteryScore < 50, `Body Battery after hard race 3h ago should be < 50, was ${status.bodyBatteryScore}`);
  assert.ok(status.drainedPoints >= 30, `Drained points should be significant, was ${status.drainedPoints}`);
  assert.equal(status.batteryTimeline.length, 6);
  assert.equal(status.readinessState, 'Deep Recovery');
});

test('calculateRecoveryStatus reflects high recovery and full Body Battery recharge after sufficient elapsed time', () => {
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
  assert.equal(status.bodyBatteryScore, 100);
  assert.equal(status.batteryStatusLabel, 'Prime Charge');
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

test('getSuggestedWeeklySchedule divides weekly km into balanced training schedule', () => {
  // 3-run week with 25 km target
  const plan25 = getSuggestedWeeklySchedule(25, 3, 'km');
  assert.equal(plan25.weeklyDistanceKm, 25);
  assert.equal(plan25.slots.length, 3);
  assert.equal(plan25.slots[0].id, 'interval');
  assert.equal(plan25.slots[0].suggestedDistanceKm, 6.0);
  assert.equal(plan25.slots[1].id, 'tempo');
  assert.equal(plan25.slots[1].suggestedDistanceKm, 7.5);
  assert.equal(plan25.slots[2].id, 'long_run');
  assert.equal(plan25.slots[2].suggestedDistanceKm, 11.5);
  assert.equal(plan25.totalSuggestedKm, 25);

  // 3-run week with 30 km target
  const plan30 = getSuggestedWeeklySchedule(30, 3, 'km');
  assert.equal(plan30.slots[0].suggestedDistanceKm, 7.2);
  assert.equal(plan30.slots[1].suggestedDistanceKm, 9.0);
  assert.equal(plan30.slots[2].suggestedDistanceKm, 13.8);
  assert.equal(plan30.totalSuggestedKm, 30);
});

test('calculateCategoryBreakdown returns 4 distinct colors for Easy, Interval, Tempo, and Race', () => {
  const sampleRuns: RunRecord[] = [
    { id: '1', userId: 'u1', date: '2026-10-28', title: 'Easy', distanceKm: 8, durationSeconds: 2400, averagePaceSecPerKm: 300, runType: 'Easy', source: 'manual' },
    { id: '2', userId: 'u1', date: '2026-10-27', title: 'Track Intervals', distanceKm: 6, durationSeconds: 1500, averagePaceSecPerKm: 250, runType: 'Intervals', source: 'manual' },
    { id: '3', userId: 'u1', date: '2026-10-26', title: 'Tempo Run', distanceKm: 7, durationSeconds: 1820, averagePaceSecPerKm: 260, runType: 'Tempo', source: 'manual' },
    { id: '4', userId: 'u1', date: '2026-10-25', title: 'XC Race 6K', distanceKm: 6, durationSeconds: 1440, averagePaceSecPerKm: 240, runType: 'Race', source: 'manual' },
  ];
  const breakdown = calculateCategoryBreakdown(sampleRuns, 30, new Date('2026-10-30T12:00:00Z'));
  const colors = breakdown.items.map((i) => i.color);
  // Verify all 4 colors are unique and distinct
  const uniqueColors = new Set(colors);
  assert.equal(uniqueColors.size, 4);
  assert.equal(breakdown.items.find((i) => i.category === 'Easy')?.color, '#10B981');
  assert.equal(breakdown.items.find((i) => i.category === 'Interval')?.color, '#F59E0B');
  assert.equal(breakdown.items.find((i) => i.category === 'Tempo')?.color, '#8B5CF6');
  assert.equal(breakdown.items.find((i) => i.category === 'Race')?.color, '#EF4444');
});

test('getSuggestedWeeklySchedule displays "Not enough data yet" when insufficient runs exist', () => {
  // 0 runs
  const planZero = getSuggestedWeeklySchedule(25, 3, 'km', 6.0, []);
  assert.equal(planZero.improvement.hasEnoughData, false);
  assert.equal(planZero.improvement.statusText, 'Not enough data yet');
  assert.equal(planZero.slots[0].suggestedPaceFormatted, undefined);

  // 1 run only
  const singleRun: RunRecord[] = [
    { id: '1', userId: 'u1', date: '2026-10-28', title: 'First Run', distanceKm: 5, durationSeconds: 1500, averagePaceSecPerKm: 300, runType: 'Easy', source: 'manual' },
  ];
  const planSingle = getSuggestedWeeklySchedule(25, 3, 'km', 6.0, singleRun);
  assert.equal(planSingle.improvement.hasEnoughData, false);
  assert.equal(planSingle.improvement.statusText, 'Not enough data yet');
});

test('getSuggestedWeeklySchedule calibrates paces from real improvement data when 2+ runs on separate days exist', () => {
  const multiRuns: RunRecord[] = [
    { id: '1', userId: 'u1', date: '2026-10-01', title: 'Early Base Run', distanceKm: 6, durationSeconds: 1800, averagePaceSecPerKm: 300, runType: 'Easy', source: 'manual' },
    { id: '2', userId: 'u1', date: '2026-10-15', title: 'Mid Progression', distanceKm: 6, durationSeconds: 1680, averagePaceSecPerKm: 280, runType: 'Tempo', source: 'manual' },
    { id: '3', userId: 'u1', date: '2026-10-28', title: 'Fast 6K Finish', distanceKm: 6, durationSeconds: 1560, averagePaceSecPerKm: 260, runType: 'Time Trial', source: 'manual' },
  ];
  const planReal = getSuggestedWeeklySchedule(25, 3, 'km', 6.0, multiRuns);
  assert.equal(planReal.improvement.hasEnoughData, true);
  assert.equal(planReal.improvement.trend, 'improving');
  assert.ok(planReal.slots[0].suggestedPaceFormatted);
  assert.ok(planReal.slots[1].suggestedPaceFormatted);
  assert.ok(planReal.slots[2].suggestedPaceFormatted);
});

test('isHillRun only labels run as hill workout if explicit runType option was selected', () => {
  assert.equal(isHillRun('Hill Repeats'), true);
  assert.equal(isHillRun('Hill Run'), true);
  assert.equal(isHillRun('Easy', '8x200m Hill Sprints'), false); // Only labeled if explicit option selected
  assert.equal(isHillRun('Easy', 'Morning Jog'), false);
  assert.equal(isHillRun('Aerobic', 'Rolling Hills 5K'), false);
});

test('calculateMonthlyConsistency computes month-to-date volume, 4 actual weeks breakdown, and hill stats', () => {
  const novemberRuns: RunRecord[] = [
    { id: 'r1', userId: 'u1', date: '2026-11-02', title: '6x200m Hill Repeats', distanceKm: 6, durationSeconds: 1500, averagePaceSecPerKm: 250, runType: 'Hill Repeats', elevationGainMeters: 120, source: 'manual' },
    { id: 'r2', userId: 'u1', date: '2026-11-04', title: '6K Tempo', distanceKm: 6, durationSeconds: 1440, averagePaceSecPerKm: 240, runType: 'Tempo', elevationGainMeters: 30, source: 'manual' },
    { id: 'r3', userId: 'u1', date: '2026-11-07', title: 'Aerobic Long Run', distanceKm: 12, durationSeconds: 3600, averagePaceSecPerKm: 300, runType: 'Long Run', elevationGainMeters: 80, source: 'manual' },
  ];

  const analysis = calculateMonthlyConsistency(novemberRuns, 24, 3, new Date('2026-11-15'));
  assert.equal(analysis.monthName, 'November');
  assert.equal(analysis.totalDistanceKm, 24.0);
  assert.equal(analysis.totalRuns, 3);
  assert.equal(analysis.hillRunsCount, 1);
  assert.equal(analysis.totalElevationGainMeters, 230); // Elevation reflects all runs
  assert.equal(analysis.weeks.length, 4); // Exactly 4 actual weeks in month
  assert.equal(analysis.weeks[0].dateRangeLabel, 'Nov 1 – Nov 7');
  assert.equal(analysis.weeks[1].dateRangeLabel, 'Nov 8 – Nov 14');
  assert.equal(analysis.weeks[2].dateRangeLabel, 'Nov 15 – Nov 21');
  assert.equal(analysis.weeks[3].dateRangeLabel, 'Nov 22 – Nov 30');
});






