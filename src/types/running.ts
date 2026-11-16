import { YraaDivisionId } from '../data/yraaBenchmarks';

export type RunType =
  | 'Aerobic'
  | 'Interval Training'
  | '6K Time Trial'
  | 'Time Trial'
  | 'Tempo'
  | 'Long Run'
  | 'Race'
  | 'Easy'
  | 'Intervals'
  | 'Recovery'
  | 'Hill Repeats'
  | 'Hill Run';

export interface IntervalDetails {
  targetPaceSecPerKm?: number; // Target / Aimed interval pace in seconds per km (e.g. 210 for 3:30/km)
  repCount?: number; // Number of sets / repetitions (e.g. 5)
  repDistanceMeters?: number; // Distance per set in meters (e.g. 1000m)
  restDurationSeconds?: number; // Rest duration per set in seconds (e.g. 90s)
  totalRestSeconds?: number; // Total rest duration stripped from workout (e.g. 360s or 450s)
  activeWorkDurationSeconds?: number; // Active workout duration excluding rest
  activeIntervalPaceSecPerKm?: number; // True active pace during work sets without rest inflation
  workDistanceKm?: number; // Work distance in km (repCount * repDistanceMeters / 1000)
}

export interface RunRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  distanceKm: number;
  durationSeconds: number;
  averagePaceSecPerKm: number;
  best6kTimeSeconds?: number;
  targetEquivalentSeconds?: number;
  runType: RunType;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number; // SPM
  elevationGainMeters?: number;
  hillReps?: number;
  hillGradePercent?: number;
  source:
    | 'garmin'
    | 'garmin_tcx'
    | 'garmin_gpx'
    | 'garmin_csv'
    | 'apple_watch'
    | 'apple_health_xml'
    | 'apple_watch_csv'
    | 'apple_watch_gpx'
    | 'apple_watch_tcx'
    | 'manual';
  notes?: string;
  garminActivityId?: string;
  slotId?: 'interval' | 'tempo' | 'long_run';
  // Interval & Rest Calibration metrics
  intervalDetails?: IntervalDetails;
  targetIntervalPaceSecPerKm?: number;
  activeIntervalPaceSecPerKm?: number;
  repCount?: number;
  repDistanceMeters?: number;
  restDurationSeconds?: number;
  totalRestSeconds?: number;
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
  yraaDivision?: YraaDivisionId;
  maxHeartRate?: number;
  defaultIntervalPaceSecPerKm?: number;
  defaultRepDistanceMeters?: number;
  defaultRestDurationSeconds?: number;
  defaultRepCount?: number;
  goalTimeframeWeeks?: number;
  targetGoalDate?: string;
  onboardingCompleted?: boolean;
  accountStatus?: 'active' | 'suspended';
  suspensionReason?: string;
  adminNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppAnnouncement {
  id: 'announcement';
  enabled: boolean;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'success';
  updatedAt: string;
  updatedBy?: string;
}

export type AdminAuditAction =
  | 'delete_user'
  | 'suspend_user'
  | 'restore_user'
  | 'edit_user'
  | 'reset_user_runs'
  | 'reset_onboarding'
  | 'add_run'
  | 'edit_run'
  | 'delete_run'
  | 'purge_orphan_runs'
  | 'update_announcement'
  | 'change_pin';

export interface AdminAuditLog {
  id: string;
  adminUid: string;
  adminEmail: string;
  action: AdminAuditAction;
  targetId?: string;
  targetLabel?: string;
  details: string;
  createdAt: string;
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
