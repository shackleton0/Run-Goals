import { RunRecord, UserProfile } from '../types/running';

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
