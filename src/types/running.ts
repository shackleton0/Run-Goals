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
  target6kTimeSeconds?: number; // Optional user goal (e.g. 1260 = 21:00)
  hasCustomTarget?: boolean;
  current6kPrSeconds?: number;
  weeklyRunGoal: number; // default 3
  unitPreference: 'km' | 'miles';
  athleteLevel?: 'Beginner' | 'High School XC' | 'Collegiate / Advanced' | 'Masters';
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
