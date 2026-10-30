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
