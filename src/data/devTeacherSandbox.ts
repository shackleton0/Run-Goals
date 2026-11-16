import { TeacherRecord, TeamInvite, UserProfile, RunRecord } from '../types/running';

export const DEV_SANDBOX_TEACHER: TeacherRecord = {
  id: 'dev_sandbox_coach@example.com',
  email: 'coach.preview@school.edu',
  displayName: 'Coach Jordan (Preview)',
  teamName: 'Northview Varsity XC',
  inviteCode: 'DEMO2026',
  status: 'active',
  addedBy: 'eskin.adam@gmail.com',
  createdAt: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
};

function daysAgoIsoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function futureIsoDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

export function createSandboxTeacherBundle(): {
  teacher: TeacherRecord;
  invite: TeamInvite;
  students: UserProfile[];
  runs: RunRecord[];
} {
  const now = new Date().toISOString();
  const teamCode = DEV_SANDBOX_TEACHER.inviteCode;
  const raceDate = futureIsoDate(34);

  const invite: TeamInvite = {
    id: teamCode,
    teamName: DEV_SANDBOX_TEACHER.teamName,
    coachName: DEV_SANDBOX_TEACHER.displayName,
    active: true,
    teamAnnouncementTitle: 'Thursday Meet · Bus Departs 2:15 PM',
    teamAnnouncementMessage:
      'Bring spikes, racing flats, and hydration. Warmup starts 3:30 PM sharp on the upper meadow.',
    teamAnnouncementSeverity: 'info',
    teamAnnouncementUpdatedAt: now,
    createdAt: DEV_SANDBOX_TEACHER.createdAt,
    updatedAt: now,
  };

  const students: UserProfile[] = [
    {
      id: 'sandbox_student_maya',
      email: 'maya.lin@student.edu',
      displayName: 'Maya Lin',
      athleteLevel: 'High School XC',
      unitPreference: 'km',
      targetDistanceKm: 6.0,
      targetGoalName: '6K Race',
      target6kTimeSeconds: 1350, // 22:30
      hasCustomTarget: true,
      goalTimeframeWeeks: 8,
      targetGoalDate: raceDate,
      weeklyRunGoal: 4,
      weeklyDistanceGoalKm: 34,
      yraaDivision: 'senior_women',
      onboardingCompleted: true,
      accountStatus: 'active',
      teamCode,
      teamName: invite.teamName,
      coachName: invite.coachName,
      joinedTeamAt: daysAgoIsoDate(21),
      coachNotes: 'Strong aerobic base; watch pacing on first 2K splits.',
      updatedAt: now,
    },
    {
      id: 'sandbox_student_liam',
      email: 'liam.okafor@student.edu',
      displayName: 'Liam Okafor',
      athleteLevel: 'High School XC',
      unitPreference: 'km',
      targetDistanceKm: 6.0,
      targetGoalName: '6K Race',
      target6kTimeSeconds: 1200, // 20:00
      hasCustomTarget: true,
      goalTimeframeWeeks: 6,
      targetGoalDate: raceDate,
      weeklyRunGoal: 5,
      weeklyDistanceGoalKm: 45,
      yraaDivision: 'senior_men',
      onboardingCompleted: true,
      accountStatus: 'active',
      teamCode,
      teamName: invite.teamName,
      coachName: invite.coachName,
      joinedTeamAt: daysAgoIsoDate(24),
      directMessageTitle: 'Great Threshold Session',
      directMessageBody: 'Awesome control on the 4x1K reps yesterday. Keep Friday recovery easy.',
      directMessageSeverity: 'success',
      directMessageSentAt: daysAgoIsoDate(1) + 'T18:00:00.000Z',
      updatedAt: now,
    },
    {
      id: 'sandbox_student_elena',
      email: 'elena.patel@student.edu',
      displayName: 'Elena Patel',
      athleteLevel: 'High School XC',
      unitPreference: 'km',
      targetDistanceKm: 4.0,
      targetGoalName: '4K Race',
      target6kTimeSeconds: 980, // 16:20 4K target
      hasCustomTarget: true,
      goalTimeframeWeeks: 10,
      targetGoalDate: raceDate,
      weeklyRunGoal: 3,
      weeklyDistanceGoalKm: 22,
      yraaDivision: 'junior_women',
      onboardingCompleted: true,
      accountStatus: 'active',
      teamCode,
      teamName: invite.teamName,
      coachName: invite.coachName,
      joinedTeamAt: daysAgoIsoDate(14),
      coachNotes: 'Returning from mild shin tightness — check in before hill day.',
      updatedAt: now,
    },
    {
      id: 'sandbox_student_noah',
      email: 'noah.brooks@student.edu',
      displayName: 'Noah Brooks',
      athleteLevel: 'Beginner',
      unitPreference: 'km',
      targetDistanceKm: 5.0,
      targetGoalName: '5K Race',
      target6kTimeSeconds: 1320, // 22:00 5K target
      hasCustomTarget: false,
      goalTimeframeWeeks: 12,
      weeklyRunGoal: 3,
      weeklyDistanceGoalKm: 18,
      yraaDivision: 'novice_men',
      onboardingCompleted: false,
      accountStatus: 'suspended',
      suspensionReason: 'Paused pending medical clearance form',
      teamCode,
      teamName: invite.teamName,
      coachName: invite.coachName,
      joinedTeamAt: daysAgoIsoDate(18),
      updatedAt: now,
    },
  ];

  const runs: RunRecord[] = [
    {
      id: 'sandbox_run_1',
      userId: 'sandbox_student_liam',
      teamCode,
      date: daysAgoIsoDate(1),
      title: '4x1K Track Repeats',
      distanceKm: 6.4,
      durationSeconds: 1395,
      averagePaceSecPerKm: 218,
      best6kTimeSeconds: 1255,
      targetEquivalentSeconds: 1255,
      runType: 'Interval Training',
      source: 'garmin_tcx',
      avgHeartRate: 174,
      maxHeartRate: 191,
      notes: '3:12 average per 1K rep with 90s jog rest',
    },
    {
      id: 'sandbox_run_2',
      userId: 'sandbox_student_liam',
      teamCode,
      date: daysAgoIsoDate(3),
      title: 'Sunday Aerobic Long Run',
      distanceKm: 12.2,
      durationSeconds: 3240,
      averagePaceSecPerKm: 266,
      best6kTimeSeconds: 1310,
      targetEquivalentSeconds: 1310,
      runType: 'Long Run',
      source: 'garmin_tcx',
      avgHeartRate: 156,
      maxHeartRate: 169,
    },
    {
      id: 'sandbox_run_3',
      userId: 'sandbox_student_liam',
      teamCode,
      date: daysAgoIsoDate(5),
      title: 'Meadow Tempo 5K',
      distanceKm: 5.0,
      durationSeconds: 1090,
      averagePaceSecPerKm: 218,
      best6kTimeSeconds: 1335,
      targetEquivalentSeconds: 1335,
      runType: 'Tempo',
      source: 'manual',
      avgHeartRate: 171,
    },
    {
      id: 'sandbox_run_4',
      userId: 'sandbox_student_maya',
      teamCode,
      date: daysAgoIsoDate(1),
      title: 'Progressive 6K Loop',
      distanceKm: 6.0,
      durationSeconds: 1410,
      averagePaceSecPerKm: 235,
      best6kTimeSeconds: 1410,
      targetEquivalentSeconds: 1410,
      runType: 'Tempo',
      source: 'apple_health_xml',
      avgHeartRate: 168,
      maxHeartRate: 184,
    },
    {
      id: 'sandbox_run_5',
      userId: 'sandbox_student_maya',
      teamCode,
      date: daysAgoIsoDate(2),
      title: 'Easy Shakeout',
      distanceKm: 5.2,
      durationSeconds: 1560,
      averagePaceSecPerKm: 300,
      runType: 'Easy',
      source: 'apple_health_xml',
      avgHeartRate: 144,
    },
    {
      id: 'sandbox_run_6',
      userId: 'sandbox_student_maya',
      teamCode,
      date: daysAgoIsoDate(4),
      title: 'Hill Surge Session',
      distanceKm: 7.1,
      durationSeconds: 2010,
      averagePaceSecPerKm: 283,
      runType: 'Hill Repeats',
      source: 'apple_health_xml',
      avgHeartRate: 166,
    },
    {
      id: 'sandbox_run_7',
      userId: 'sandbox_student_elena',
      teamCode,
      date: daysAgoIsoDate(9), // Triggers "Needs Check-in (7d+)" filter!
      title: 'Easy Grass Strides',
      distanceKm: 4.1,
      durationSeconds: 1210,
      averagePaceSecPerKm: 295,
      best6kTimeSeconds: 1820,
      targetEquivalentSeconds: 1180,
      runType: 'Recovery',
      source: 'manual',
      notes: 'Calves felt slightly tight after last rep',
    },
    {
      id: 'sandbox_run_8',
      userId: 'sandbox_student_noah',
      teamCode,
      date: daysAgoIsoDate(11),
      title: 'Park 3K Time Check',
      distanceKm: 3.0,
      durationSeconds: 900,
      averagePaceSecPerKm: 300,
      runType: 'Time Trial',
      source: 'manual',
    },
  ];

  return {
    teacher: DEV_SANDBOX_TEACHER,
    invite,
    students,
    runs,
  };
}
