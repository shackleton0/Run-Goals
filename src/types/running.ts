export type RunType =
  | 'Aerobic'
  | 'Interval Training'
  | '6K Time Trial'
  | 'Tempo'
  | 'Long Run'
  | 'Race'
  | 'Easy'
  | 'Intervals';

export interface RunRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  distanceKm: number;
  durationSeconds: number;
  averagePaceSecPerKm: number;
  best6kTimeSeconds?: number;
  runType: RunType;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number; // SPM
  elevationGainMeters?: number;
  source: 'garmin' | 'garmin_tcx' | 'garmin_gpx' | 'garmin_csv' | 'manual';
  notes?: string;
  garminActivityId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  targetDistanceKm?: number; // Target distance goal (default 6 km, or 5K, 8K, 10K, or custom)
  targetGoalName?: string; // e.g. "6K XC", "5K Race", "10K"
  target6kTimeSeconds?: number; // Target time or pace for the goal distance
  hasCustomTarget?: boolean;
  current6kPrSeconds?: number;
  weeklyRunGoal: number; // default 3 runs/wk
  weeklyDistanceGoalKm?: number; // Optional weekly mileage/distance goal (e.g. 25 km / 15 mi)
  unitPreference: 'km' | 'miles';
  athleteLevel?: 'Beginner' | 'High School XC' | 'Collegiate / Advanced' | 'Masters';
  maxHeartRate?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WeeklyStat {
  weekKey: string;
  weekStart: string;
  runsCount: number;
  goalMet: boolean;
  totalDistanceKm: number;
  totalDurationSeconds: number;
  best6kInWeek?: number;
  runs: RunRecord[];
}

export interface AdherenceSummary {
  weeklyGoal: number;
  currentWeekRuns: number;
  currentWeekGoalMet: boolean;
  currentStreakWeeks: number;
  bestStreakWeeks: number;
  totalWeeksTracked: number;
  metGoalWeeksCount: number;
  adherencePercentage: number;
}

export interface DuplicateRunMatch {
  incoming: RunRecord;
  existing: RunRecord;
}
