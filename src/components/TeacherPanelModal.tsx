import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TeacherRecord,
  TeamInvite,
  UserProfile,
  RunRecord,
  RunType,
  PlannedTeamWorkout,
} from '../types/running';
import {
  fetchTeamDataForTeacher,
  fetchTeamWorkoutsForTeacher,
  teacherUpdateStudentProfile,
  teacherSendStudentMessage,
  teacherClearStudentMessage,
  teacherSaveRunForStudent,
  teacherDeleteSingleRun,
  teacherClearStudentRuns,
  teacherRemoveStudentFromTeam,
  teacherUpdateTeamSettings,
  teacherSaveTeamAnnouncement,
  teacherSaveTeamWorkout,
  teacherDeleteTeamWorkout,
  teacherBulkCompleteWorkout,
  teacherBatchUpdateStudentGoals,
} from '../lib/firebase';
import {
  YRAA_DIVISION_LIST,
  YraaDivisionId,
} from '../data/yraaBenchmarks';
import {
  formatDuration,
  parseDuration,
  formatPace,
  calculatePaceSecPerKm,
  calculate6kEquivalent,
  calculateTargetDistanceEquivalent,
  selectBestTargetEquivalent,
  groupRunsByWeek,
  buildBulkTeamWorkoutRuns,
  applyBatchGoalPresetToProfiles,
  buildTeamRunDocId,
  formatLocalDateString,
  KM_TO_MILES,
} from '../utils/runningCalculations';
import {
  X,
  GraduationCap,
  Users,
  Activity,
  Route,
  Calendar,
  RefreshCw,
  Search,
  Download,
  Copy,
  Check,
  MessageSquare,
  UserCog,
  Plus,
  Ban,
  RotateCcw,
  Trash2,
  UserMinus,
  ChevronRight,
  Clock,
  Heart,
  Pencil,
  Megaphone,
  Link2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  FlaskConical,
  ClipboardList,
  Target,
  UsersRound,
  Save,
} from 'lucide-react';

interface TeacherPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: TeacherRecord;
  onTeacherUpdated?: (next: TeacherRecord) => void;
  previewMode?: boolean;
  previewStudents?: UserProfile[];
  previewRuns?: RunRecord[];
  previewInvite?: TeamInvite | null;
  previewTeamWorkouts?: PlannedTeamWorkout[];
  onBackToAdmin?: () => void;
}

type TeacherTab = 'roster' | 'workouts' | 'goals' | 'activity' | 'team';
type StudentFilter = 'all' | 'active' | 'inactive_7d' | 'suspended' | 'pending_setup';
type StudentActionPanel =
  | 'none'
  | 'message_student'
  | 'edit_profile'
  | 'add_run'
  | 'suspend'
  | 'clear_runs'
  | 'remove_team';

interface EnrichedStudentSummary {
  userId: string;
  profile: UserProfile;
  displayName: string;
  email: string;
  accountStatus: 'active' | 'suspended';
  runs: RunRecord[];
  totalDistanceKm: number;
  totalDurationSeconds: number;
  avgPaceSecPerKm: number;
  bestTargetSec?: number;
  lastRunDate: string | null;
  currentWeekRuns: number;
  currentWeekGoalMet: boolean;
  currentWeekDistanceKm: number;
  needsCheckIn: boolean;
}

const RUN_TYPE_OPTIONS: RunType[] = [
  'Aerobic',
  'Interval Training',
  '6K Time Trial',
  'Time Trial',
  'Tempo',
  'Long Run',
  'Race',
  'Easy',
  'Intervals',
  'Recovery',
  'Hill Repeats',
  'Hill Run',
];

const TARGET_DISTANCE_OPTIONS = [
  { label: '4K Race', km: 4.0 },
  { label: '5K Race', km: 5.0 },
  { label: '6K Race', km: 6.0 },
  { label: '8K Race', km: 8.0 },
  { label: '10K Race', km: 10.0 },
  { label: 'Half Marathon', km: 21.0975 },
  { label: 'Marathon', km: 42.195 },
];

const WORKOUT_PRESETS: Array<{
  label: string;
  title: string;
  runType: RunType;
  distanceKm: number;
  durationSeconds: number;
  targetPaceHint: string;
  notes: string;
}> = [
  {
    label: 'Track 4x1K',
    title: '4x1K Track Intervals',
    runType: 'Interval Training',
    distanceKm: 6.0,
    durationSeconds: 1440,
    targetPaceHint: '3:45–4:00 /km reps · 90s jog',
    notes: '1.5 km warmup + strides, 4x1000m @ 5K effort, 1 km cooldown.',
  },
  {
    label: 'Tempo 5K',
    title: '5K Threshold Tempo',
    runType: 'Tempo',
    distanceKm: 5.0,
    durationSeconds: 1290,
    targetPaceHint: '4:15–4:25 /km continuous',
    notes: 'Sustained comfortably hard pace on grass/path loop.',
  },
  {
    label: 'Hill Repeats',
    title: '6x200m Hill Repeats',
    runType: 'Hill Repeats',
    distanceKm: 5.5,
    durationSeconds: 1560,
    targetPaceHint: 'Strong uphill drive · jog down rest',
    notes: 'Warmup 2 km, 6x200m hill surges with full jog recovery, 1.5 km easy.',
  },
  {
    label: 'Long Run 10K',
    title: 'Sunday Aerobic Long Run',
    runType: 'Long Run',
    distanceKm: 10.0,
    durationSeconds: 3120,
    targetPaceHint: '5:05–5:25 /km conversational',
    notes: 'Relaxed rhythm and steady aerobic effort.',
  },
  {
    label: 'Easy Shakeout',
    title: 'Team Recovery Shakeout 4K',
    runType: 'Recovery',
    distanceKm: 4.0,
    durationSeconds: 1290,
    targetPaceHint: '5:15–5:35 /km relaxed',
    notes: 'Easy flush run before race day.',
  },
];

interface GoalDraftRow {
  targetDistanceKm: string;
  targetGoalName: string;
  targetTimeStr: string;
  weeklyRunGoal: string;
  weeklyDistKm: string;
  targetGoalDate: string;
  yraaDivision: YraaDivisionId;
  coachNotes: string;
}

function buildGoalDraftRow(p: UserProfile): GoalDraftRow {
  const distKm = p.targetDistanceKm || 6.0;
  return {
    targetDistanceKm: distKm.toString(),
    targetGoalName: p.targetGoalName || `${distKm}K Race`,
    targetTimeStr: p.target6kTimeSeconds ? formatDuration(p.target6kTimeSeconds) : '',
    weeklyRunGoal: String(p.weeklyRunGoal || 3),
    weeklyDistKm: p.weeklyDistanceGoalKm ? String(p.weeklyDistanceGoalKm) : '',
    targetGoalDate: p.targetGoalDate || '',
    yraaDivision: p.yraaDivision || 'senior_men',
    coachNotes: p.coachNotes || '',
  };
}

export const TeacherPanelModal: React.FC<TeacherPanelModalProps> = ({
  isOpen,
  onClose,
  teacher,
  onTeacherUpdated,
  previewMode = false,
  previewStudents,
  previewRuns,
  previewInvite,
  previewTeamWorkouts,
  onBackToAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<TeacherTab>('roster');
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [teamRuns, setTeamRuns] = useState<RunRecord[]>([]);
  const [teamInvite, setTeamInvite] = useState<TeamInvite | null>(null);
  const [teamWorkouts, setTeamWorkouts] = useState<PlannedTeamWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Copy states
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  // Roster filters
  const [searchQuery, setSearchQuery] = useState('');
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'runs' | 'distance' | 'name'>('recent');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [actionPanel, setActionPanel] = useState<StudentActionPanel>('none');

  // Message drawer draft
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgSeverity, setMsgSeverity] = useState<'info' | 'warning' | 'success'>('info');

  // Suspend drawer
  const [suspendReasonInput, setSuspendReasonInput] = useState('');

  // Edit profile draft
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editAthleteLevel, setEditAthleteLevel] =
    useState<NonNullable<UserProfile['athleteLevel']>>('High School XC');
  const [editUnitPref, setEditUnitPref] = useState<'km' | 'miles'>('km');
  const [editTargetDistKm, setEditTargetDistKm] = useState('6');
  const [editTargetGoalName, setEditTargetGoalName] = useState('6K Race');
  const [editTargetTimeStr, setEditTargetTimeStr] = useState('');
  const [editWeeklyRunGoal, setEditWeeklyRunGoal] = useState('3');
  const [editWeeklyDistKm, setEditWeeklyDistKm] = useState('');
  const [editTargetGoalDate, setEditTargetGoalDate] = useState('');
  const [editYraaDivision, setEditYraaDivision] = useState<YraaDivisionId>('senior_men');
  const [editMaxHr, setEditMaxHr] = useState('');
  const [editOnboardingDone, setEditOnboardingDone] = useState(true);
  const [editCoachNotes, setEditCoachNotes] = useState('');

  // Add run draft
  const [newRunTitle, setNewRunTitle] = useState('');
  const [newRunDate, setNewRunDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newRunType, setNewRunType] = useState<RunType>('Tempo');
  const [newRunDistKm, setNewRunDistKm] = useState('5.0');
  const [newRunDurationStr, setNewRunDurationStr] = useState('22:30');
  const [newRunAvgHr, setNewRunAvgHr] = useState('');
  const [newRunNotes, setNewRunNotes] = useState('');

  // Inline run editing
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [editRunTitle, setEditRunTitle] = useState('');
  const [editRunDate, setEditRunDate] = useState('');
  const [editRunType, setEditRunType] = useState<RunType>('Aerobic');
  const [editRunDistKm, setEditRunDistKm] = useState('');
  const [editRunDurationStr, setEditRunDurationStr] = useState('');
  const [editRunNotes, setEditRunNotes] = useState('');
  const [confirmDeleteRunId, setConfirmDeleteRunId] = useState<string | null>(null);

  // Activity feed filters
  const [runsSearch, setRunsSearch] = useState('');
  const [runsTypeFilter, setRunsTypeFilter] = useState('all');

  // Team Settings & Broadcast Drafts
  const [draftTeamName, setDraftTeamName] = useState(teacher.teamName);
  const [draftCoachName, setDraftCoachName] = useState(teacher.displayName);
  const [draftInviteActive, setDraftInviteActive] = useState(true);
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annSeverity, setAnnSeverity] = useState<'info' | 'warning' | 'success'>('info');

  // Team Workout Planner Drafts & Bulk Attendance
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [woTitle, setWoTitle] = useState('');
  const [woDate, setWoDate] = useState(() => formatLocalDateString(new Date()));
  const [woRunType, setWoRunType] = useState<RunType>('Interval Training');
  const [woDistKm, setWoDistKm] = useState('6.0');
  const [woDurationStr, setWoDurationStr] = useState('24:00');
  const [woPaceHint, setWoPaceHint] = useState('');
  const [woNotes, setWoNotes] = useState('');
  const [pickingAthletesWorkoutId, setPickingAthletesWorkoutId] = useState<string | null>(null);
  const [pickedAthleteIds, setPickedAthleteIds] = useState<Set<string>>(new Set());
  const [confirmDeleteWorkoutId, setConfirmDeleteWorkoutId] = useState<string | null>(null);

  // Multi-Athlete Goal Manager Drafts
  const [goalDrafts, setGoalDrafts] = useState<Record<string, GoalDraftRow>>({});
  const [selectedGoalStudentIds, setSelectedGoalStudentIds] = useState<Set<string>>(new Set());
  const [batchScope, setBatchScope] = useState<'active' | 'selected' | 'all'>('active');
  const [batchDistKm, setBatchDistKm] = useState<string>('');
  const [batchTargetTimeStr, setBatchTargetTimeStr] = useState<string>('');
  const [batchWeeklyRuns, setBatchWeeklyRuns] = useState<string>('');
  const [batchWeeklyDistKm, setBatchWeeklyDistKm] = useState<string>('');
  const [batchGoalDate, setBatchGoalDate] = useState<string>('');
  const [batchDivision, setBatchDivision] = useState<string>('');

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?join=${teacher.inviteCode}`
      : `?join=${teacher.inviteCode}`;

  const syncGoalDraftsFromStudents = useCallback((studentList: UserProfile[]) => {
    const next: Record<string, GoalDraftRow> = {};
    studentList.forEach((s) => {
      next[s.id] = buildGoalDraftRow(s);
    });
    setGoalDrafts(next);
  }, []);

  const loadTeamData = useCallback(async () => {
    setFeedback(null);
    if (previewMode) {
      const st = previewStudents ? previewStudents.map((s) => ({ ...s })) : [];
      const runs = previewRuns ? previewRuns.map((r) => ({ ...r })) : [];
      const invite = previewInvite ? { ...previewInvite } : null;
      const workouts = previewTeamWorkouts
        ? previewTeamWorkouts.map((w) => ({ ...w, completedUserIds: [...(w.completedUserIds || [])] }))
        : [];
      setStudents(st);
      setTeamRuns(runs);
      setTeamInvite(invite);
      setTeamWorkouts(workouts);
      syncGoalDraftsFromStudents(st);
      if (invite) {
        setDraftTeamName(invite.teamName);
        setDraftCoachName(invite.coachName);
        setDraftInviteActive(invite.active);
        setAnnTitle(invite.teamAnnouncementTitle || '');
        setAnnMessage(invite.teamAnnouncementMessage || '');
        setAnnSeverity(invite.teamAnnouncementSeverity || 'info');
      } else {
        setDraftTeamName(teacher.teamName);
        setDraftCoachName(teacher.displayName);
        setDraftInviteActive(true);
        setAnnTitle('');
        setAnnMessage('');
        setAnnSeverity('info');
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [{ students: st, runs, invite }, workouts] = await Promise.all([
        fetchTeamDataForTeacher(teacher),
        fetchTeamWorkoutsForTeacher(teacher),
      ]);
      setStudents(st);
      setTeamRuns(runs);
      setTeamInvite(invite);
      setTeamWorkouts(workouts);
      syncGoalDraftsFromStudents(st);
      if (invite) {
        setDraftTeamName(invite.teamName);
        setDraftCoachName(invite.coachName);
        setDraftInviteActive(invite.active);
        setAnnTitle(invite.teamAnnouncementTitle || '');
        setAnnMessage(invite.teamAnnouncementMessage || '');
        setAnnSeverity(invite.teamAnnouncementSeverity || 'info');
      } else {
        setDraftTeamName(teacher.teamName);
        setDraftCoachName(teacher.displayName);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to load team roster and workouts.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    teacher,
    previewMode,
    previewStudents,
    previewRuns,
    previewInvite,
    previewTeamWorkouts,
    syncGoalDraftsFromStudents,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    setActionPanel('none');
    setEditingRunId(null);
    setConfirmDeleteRunId(null);
    loadTeamData();
  }, [isOpen, loadTeamData]);

  const enrichedStudents = useMemo<EnrichedStudentSummary[]>(() => {
    const runsByUser = new Map<string, RunRecord[]>();
    teamRuns.forEach((r) => {
      const existing = runsByUser.get(r.userId) || [];
      existing.push(r);
      runsByUser.set(r.userId, existing);
    });

    const sevenDaysAgoMs = Date.now() - 7 * 86400 * 1000;

    return students.map((prof) => {
      const sRuns = [...(runsByUser.get(prof.id) || [])].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const totalDistanceKm = sRuns.reduce((sum, r) => sum + (r.distanceKm || 0), 0);
      const totalDurationSeconds = sRuns.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);
      const avgPaceSecPerKm =
        totalDistanceKm > 0 && totalDurationSeconds > 0
          ? totalDurationSeconds / totalDistanceKm
          : 0;
      const targetDist = prof.targetDistanceKm || 6.0;
      const bestTargetSec = selectBestTargetEquivalent(sRuns, targetDist).bestSeconds;
      const lastRunDate = sRuns.length > 0 ? sRuns[0].date : null;
      const { weeklyStats, adherence } = groupRunsByWeek(sRuns, prof.weeklyRunGoal || 3);
      const latestWeek = weeklyStats[0];
      const needsCheckIn =
        !lastRunDate || new Date(lastRunDate).getTime() < sevenDaysAgoMs;

      return {
        userId: prof.id,
        profile: prof,
        displayName: prof.displayName?.trim() || 'Unnamed Athlete',
        email: prof.email || '',
        accountStatus: prof.accountStatus === 'suspended' ? 'suspended' : 'active',
        runs: sRuns,
        totalDistanceKm,
        totalDurationSeconds,
        avgPaceSecPerKm,
        bestTargetSec,
        lastRunDate,
        currentWeekRuns: adherence.currentWeekRuns,
        currentWeekGoalMet: adherence.currentWeekGoalMet,
        currentWeekDistanceKm: latestWeek?.totalDistanceKm || 0,
        needsCheckIn,
      };
    });
  }, [students, teamRuns]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = enrichedStudents.filter((s) => {
      if (studentFilter === 'active' && s.accountStatus !== 'active') return false;
      if (studentFilter === 'inactive_7d' && !s.needsCheckIn) return false;
      if (studentFilter === 'suspended' && s.accountStatus !== 'suspended') return false;
      if (studentFilter === 'pending_setup' && s.profile.onboardingCompleted) return false;
      if (!q) return true;
      return (
        s.displayName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.userId.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'runs') return b.runs.length - a.runs.length;
      if (sortBy === 'distance') return b.totalDistanceKm - a.totalDistanceKm;
      if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
      const aDate = a.lastRunDate || a.profile.updatedAt || a.profile.createdAt || '';
      const bDate = b.lastRunDate || b.profile.updatedAt || b.profile.createdAt || '';
      return bDate.localeCompare(aDate);
    });
  }, [enrichedStudents, searchQuery, studentFilter, sortBy]);

  useEffect(() => {
    if (filteredStudents.length === 0) {
      setSelectedStudentId(null);
      return;
    }
    if (!selectedStudentId || !filteredStudents.some((s) => s.userId === selectedStudentId)) {
      setSelectedStudentId(filteredStudents[0].userId);
    }
  }, [filteredStudents, selectedStudentId]);

  const selectedStudent =
    filteredStudents.find((s) => s.userId === selectedStudentId) ||
    filteredStudents[0] ||
    null;

  useEffect(() => {
    setActionPanel('none');
    setSuspendReasonInput('');
    setConfirmDeleteRunId(null);
    setEditingRunId(null);
    setCopiedUid(false);
  }, [selectedStudent?.userId]);

  const teamStats = useMemo(() => {
    const totalStudents = enrichedStudents.length;
    const suspendedCount = enrichedStudents.filter((s) => s.accountStatus === 'suspended').length;
    const activeLast7d = enrichedStudents.filter((s) => !s.needsCheckIn).length;
    const goalMetCount = enrichedStudents.filter((s) => s.currentWeekGoalMet).length;
    const totalRuns = teamRuns.length;
    const totalKm = teamRuns.reduce((sum, r) => sum + (r.distanceKm || 0), 0);
    return {
      totalStudents,
      suspendedCount,
      activeLast7d,
      goalMetCount,
      totalRuns,
      totalKm,
    };
  }, [enrichedStudents, teamRuns]);

  const studentLookupMap = useMemo(() => {
    const map = new Map<string, EnrichedStudentSummary>();
    enrichedStudents.forEach((s) => map.set(s.userId, s));
    return map;
  }, [enrichedStudents]);

  const filteredTeamRuns = useMemo(() => {
    const q = runsSearch.trim().toLowerCase();
    return [...teamRuns]
      .filter((r) => {
        if (runsTypeFilter !== 'all' && r.runType !== runsTypeFilter) return false;
        if (!q) return true;
        const owner = studentLookupMap.get(r.userId);
        return (
          r.title.toLowerCase().includes(q) ||
          (r.notes || '').toLowerCase().includes(q) ||
          (owner?.displayName || '').toLowerCase().includes(q) ||
          (owner?.email || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [teamRuns, runsSearch, runsTypeFilter, studentLookupMap]);

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1800);
  };

  const handleCopyInviteCode = () => {
    navigator.clipboard.writeText(teacher.inviteCode);
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleCopyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(true);
    window.setTimeout(() => setCopiedUid(false), 1800);
  };

  const openMessagePanel = (s: EnrichedStudentSummary) => {
    setMsgTitle(s.profile.directMessageTitle || '');
    setMsgBody(s.profile.directMessageBody || '');
    setMsgSeverity(s.profile.directMessageSeverity || 'info');
    setActionPanel((p) => (p === 'message_student' ? 'none' : 'message_student'));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || isMutating) return;
    if (!msgBody.trim()) {
      setFeedback({ type: 'error', message: 'Enter a message before sending.' });
      return;
    }
    if (previewMode) {
      const saved: UserProfile = {
        ...selectedStudent.profile,
        directMessageTitle: msgTitle.trim() || undefined,
        directMessageBody: msgBody.trim(),
        directMessageSeverity: msgSeverity,
        directMessageSentAt: new Date().toISOString(),
        directMessageReadAt: undefined,
      };
      setStudents((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setActionPanel('none');
      setFeedback({
        type: 'success',
        message: `Message sent to ${selectedStudent.displayName} (Dev sandbox — no database writes).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const saved = await teacherSendStudentMessage(teacher, selectedStudent.profile, {
        title: msgTitle,
        body: msgBody,
        severity: msgSeverity,
      });
      setStudents((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setActionPanel('none');
      setFeedback({
        type: 'success',
        message: `Message sent to ${selectedStudent.displayName}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to send message.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleClearMessage = async () => {
    if (!selectedStudent || isMutating) return;
    if (previewMode) {
      const saved: UserProfile = {
        ...selectedStudent.profile,
        directMessageTitle: undefined,
        directMessageBody: undefined,
        directMessageSeverity: undefined,
        directMessageSentAt: undefined,
        directMessageReadAt: undefined,
      };
      setStudents((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setMsgTitle('');
      setMsgBody('');
      setActionPanel('none');
      setFeedback({
        type: 'success',
        message: `Cleared direct message for ${selectedStudent.displayName} (Dev sandbox — no database writes).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const saved = await teacherClearStudentMessage(teacher, selectedStudent.profile);
      setStudents((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setMsgTitle('');
      setMsgBody('');
      setActionPanel('none');
      setFeedback({
        type: 'success',
        message: `Cleared direct message for ${selectedStudent.displayName}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to clear message.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const openEditProfile = (s: EnrichedStudentSummary) => {
    const p = s.profile;
    setEditDisplayName(p.displayName || '');
    setEditAthleteLevel(p.athleteLevel || 'High School XC');
    setEditUnitPref(p.unitPreference || 'km');
    setEditTargetDistKm((p.targetDistanceKm || 6).toString());
    setEditTargetGoalName(p.targetGoalName || `${p.targetDistanceKm || 6}K Race`);
    setEditTargetTimeStr(p.target6kTimeSeconds ? formatDuration(p.target6kTimeSeconds) : '');
    setEditWeeklyRunGoal((p.weeklyRunGoal || 3).toString());
    setEditWeeklyDistKm(p.weeklyDistanceGoalKm ? p.weeklyDistanceGoalKm.toString() : '');
    setEditTargetGoalDate(p.targetGoalDate || '');
    setEditYraaDivision(p.yraaDivision || 'senior_men');
    setEditMaxHr(p.maxHeartRate ? p.maxHeartRate.toString() : '');
    setEditOnboardingDone(Boolean(p.onboardingCompleted));
    setEditCoachNotes(p.coachNotes || '');
    setActionPanel((prev) => (prev === 'edit_profile' ? 'none' : 'edit_profile'));
  };

  const handleSaveStudentProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || isMutating) return;

    const distKm = Math.min(100, Math.max(0.1, parseFloat(editTargetDistKm) || 6));
    const parsedTime = editTargetTimeStr.trim() ? parseDuration(editTargetTimeStr) : undefined;
    const weeklyRuns = Math.min(14, Math.max(1, parseInt(editWeeklyRunGoal, 10) || 3));
    const weeklyDist = editWeeklyDistKm.trim() ? parseFloat(editWeeklyDistKm) : undefined;
    const maxHr = editMaxHr.trim() ? parseInt(editMaxHr, 10) : undefined;

    const updated: UserProfile = {
      ...selectedStudent.profile,
      displayName: editDisplayName.trim() || 'Athlete',
      athleteLevel: editAthleteLevel,
      unitPreference: editUnitPref,
      targetDistanceKm: distKm,
      targetGoalName: editTargetGoalName.trim() || `${distKm}K Race`,
      target6kTimeSeconds: parsedTime && parsedTime > 0 ? parsedTime : undefined,
      hasCustomTarget: Boolean(parsedTime && parsedTime > 0),
      weeklyRunGoal: weeklyRuns,
      weeklyDistanceGoalKm: weeklyDist && weeklyDist > 0 ? weeklyDist : undefined,
      targetGoalDate: editTargetGoalDate.trim() || undefined,
      yraaDivision: editYraaDivision,
      maxHeartRate: maxHr && maxHr >= 100 && maxHr <= 250 ? maxHr : undefined,
      onboardingCompleted: editOnboardingDone,
      coachNotes: editCoachNotes.trim() || undefined,
    };

    if (previewMode) {
      setStudents((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setActionPanel('none');
      setFeedback({
        type: 'success',
        message: `Updated goals & profile for ${updated.displayName} (Dev sandbox — no database writes).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const saved = await teacherUpdateStudentProfile(teacher, updated);
      setStudents((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setActionPanel('none');
      setFeedback({
        type: 'success',
        message: `Updated goals & profile for ${saved.displayName}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update student profile.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleToggleSuspendStudent = async () => {
    if (!selectedStudent || isMutating) return;
    const currentlySuspended = selectedStudent.accountStatus === 'suspended';
    const nextStatus = currentlySuspended ? 'active' : 'suspended';
    const reason = currentlySuspended ? undefined : suspendReasonInput.trim() || undefined;

    if (previewMode) {
      const saved: UserProfile = {
        ...selectedStudent.profile,
        accountStatus: nextStatus,
        suspensionReason: reason,
      };
      setStudents((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setActionPanel('none');
      setSuspendReasonInput('');
      setFeedback({
        type: 'success',
        message: `${
          currentlySuspended
            ? `Restored access for ${selectedStudent.displayName}`
            : `Suspended ${selectedStudent.displayName}`
        } (Dev sandbox — no database writes).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const saved = await teacherUpdateStudentProfile(teacher, {
        ...selectedStudent.profile,
        accountStatus: nextStatus,
        suspensionReason: reason,
      });
      setStudents((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setActionPanel('none');
      setSuspendReasonInput('');
      setFeedback({
        type: 'success',
        message: currentlySuspended
          ? `Restored access for ${selectedStudent.displayName}.`
          : `Suspended ${selectedStudent.displayName}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update student status.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleResetStudentSetup = async (s: EnrichedStudentSummary) => {
    if (isMutating) return;
    if (previewMode) {
      const saved: UserProfile = {
        ...s.profile,
        onboardingCompleted: false,
      };
      setStudents((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setFeedback({
        type: 'success',
        message: `Setup wizard reset for ${s.displayName} (Dev sandbox — no database writes).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const saved = await teacherUpdateStudentProfile(teacher, {
        ...s.profile,
        onboardingCompleted: false,
      });
      setStudents((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setFeedback({
        type: 'success',
        message: `Setup wizard reset for ${s.displayName}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to reset student setup.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleClearStudentRuns = async () => {
    if (!selectedStudent || isMutating) return;
    if (previewMode) {
      const count = selectedStudent.runs.length;
      setTeamRuns((prev) => prev.filter((r) => r.userId !== selectedStudent.userId));
      setActionPanel('none');
      setFeedback({
        type: 'success',
        message: `Cleared ${count} workout${count === 1 ? '' : 's'} for ${selectedStudent.displayName} (Dev sandbox — no database writes).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const count = await teacherClearStudentRuns(teacher, selectedStudent.userId);
      setTeamRuns((prev) => prev.filter((r) => r.userId !== selectedStudent.userId));
      setActionPanel('none');
      setFeedback({
        type: 'success',
        message: `Cleared ${count} workout${count === 1 ? '' : 's'} for ${selectedStudent.displayName}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to clear student workouts.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleRemoveStudentFromTeam = async () => {
    if (!selectedStudent || isMutating) return;
    if (previewMode) {
      const targetId = selectedStudent.userId;
      const targetName = selectedStudent.displayName;
      setStudents((prev) => prev.filter((p) => p.id !== targetId));
      setTeamRuns((prev) => prev.filter((r) => r.userId !== targetId));
      setActionPanel('none');
      setFeedback({
        type: 'success',
        message: `Removed ${targetName} from ${teacher.teamName} (Dev sandbox — no database writes).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const targetId = selectedStudent.userId;
      const targetName = selectedStudent.displayName;
      await teacherRemoveStudentFromTeam(teacher, targetId);
      setStudents((prev) => prev.filter((p) => p.id !== targetId));
      setTeamRuns((prev) => prev.filter((r) => r.userId !== targetId));
      setActionPanel('none');
      setFeedback({
        type: 'success',
        message: `Removed ${targetName} from ${teacher.teamName}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to remove student from team.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateRunForStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || isMutating) return;
    const distKm = parseFloat(newRunDistKm);
    const durSec = parseDuration(newRunDurationStr);
    if (isNaN(distKm) || distKm <= 0 || durSec <= 0) {
      setFeedback({
        type: 'error',
        message: 'Enter a valid distance (> 0 km) and duration (e.g. 22:30).',
      });
      return;
    }
    const pace = calculatePaceSecPerKm(distKm, durSec);
    const targetDist = selectedStudent.profile.targetDistanceKm || 6.0;
    const avgHr = newRunAvgHr.trim() ? parseInt(newRunAvgHr, 10) : undefined;
    const run: RunRecord = {
      id: `coach_run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: selectedStudent.userId,
      teamCode: teacher.inviteCode,
      date: newRunDate || new Date().toISOString().split('T')[0],
      title: newRunTitle.trim() || `${newRunType} (${distKm.toFixed(1)}K)`,
      distanceKm: distKm,
      durationSeconds: durSec,
      averagePaceSecPerKm: pace,
      best6kTimeSeconds: calculate6kEquivalent(distKm, durSec),
      targetEquivalentSeconds: calculateTargetDistanceEquivalent(distKm, durSec, targetDist),
      runType: newRunType,
      source: 'manual',
      avgHeartRate: avgHr && !isNaN(avgHr) && avgHr > 40 ? avgHr : undefined,
      notes: newRunNotes.trim() || undefined,
    };

    if (previewMode) {
      setTeamRuns((prev) => [run, ...prev]);
      setActionPanel('none');
      setNewRunTitle('');
      setNewRunNotes('');
      setNewRunAvgHr('');
      setFeedback({
        type: 'success',
        message: `Logged "${run.title}" for ${selectedStudent.displayName} (Dev sandbox — no database writes).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const saved = await teacherSaveRunForStudent(teacher, selectedStudent.userId, run, true);
      setTeamRuns((prev) => [saved, ...prev]);
      setActionPanel('none');
      setNewRunTitle('');
      setNewRunNotes('');
      setNewRunAvgHr('');
      setFeedback({
        type: 'success',
        message: `Logged "${saved.title}" for ${selectedStudent.displayName}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to log run for student.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const startEditingRun = (run: RunRecord) => {
    setConfirmDeleteRunId(null);
    setEditingRunId(run.id);
    setEditRunTitle(run.title);
    setEditRunDate(run.date);
    setEditRunType(run.runType);
    setEditRunDistKm(run.distanceKm.toString());
    setEditRunDurationStr(formatDuration(run.durationSeconds));
    setEditRunNotes(run.notes || '');
  };

  const handleSaveEditedRun = async (run: RunRecord) => {
    if (isMutating) return;
    const distKm = parseFloat(editRunDistKm);
    const durSec = parseDuration(editRunDurationStr);
    if (isNaN(distKm) || distKm <= 0 || durSec <= 0) {
      setFeedback({ type: 'error', message: 'Enter valid distance (> 0 km) and duration.' });
      return;
    }
    const ownerProfile = studentLookupMap.get(run.userId)?.profile;
    const targetDist = ownerProfile?.targetDistanceKm || 6.0;
    const updated: RunRecord = {
      ...run,
      teamCode: teacher.inviteCode,
      title: editRunTitle.trim() || run.title,
      date: editRunDate || run.date,
      runType: editRunType,
      distanceKm: distKm,
      durationSeconds: durSec,
      averagePaceSecPerKm: calculatePaceSecPerKm(distKm, durSec),
      best6kTimeSeconds: calculate6kEquivalent(distKm, durSec),
      targetEquivalentSeconds: calculateTargetDistanceEquivalent(distKm, durSec, targetDist),
      notes: editRunNotes.trim() || undefined,
    };

    if (previewMode) {
      setTeamRuns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditingRunId(null);
      setFeedback({
        type: 'success',
        message: `Updated workout "${updated.title}" (Dev sandbox — no database writes).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const saved = await teacherSaveRunForStudent(teacher, run.userId, updated, false);
      setTeamRuns((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      setEditingRunId(null);
      setFeedback({ type: 'success', message: `Updated workout "${saved.title}".` });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update workout.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteSingleRun = async (run: RunRecord) => {
    if (isMutating) return;
    if (previewMode) {
      setTeamRuns((prev) => prev.filter((r) => r.id !== run.id));
      setConfirmDeleteRunId(null);
      setFeedback({
        type: 'success',
        message: `Deleted workout "${run.title}" (Dev sandbox — no database writes).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      await teacherDeleteSingleRun(run);
      setTeamRuns((prev) => prev.filter((r) => r.id !== run.id));
      setConfirmDeleteRunId(null);
      setFeedback({ type: 'success', message: `Deleted workout "${run.title}".` });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete workout.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveTeamSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMutating) return;
    if (previewMode) {
      const now = new Date().toISOString();
      const nextTeacher: TeacherRecord = {
        ...teacher,
        displayName: draftCoachName.trim() || teacher.displayName,
        teamName: draftTeamName.trim() || teacher.teamName,
        updatedAt: now,
      };
      const nextInvite: TeamInvite = {
        ...(teamInvite || {
          id: teacher.inviteCode,
          teamName: nextTeacher.teamName,
          coachName: nextTeacher.displayName,
          active: draftInviteActive,
          createdAt: now,
          updatedAt: now,
        }),
        teamName: nextTeacher.teamName,
        coachName: nextTeacher.displayName,
        active: draftInviteActive,
        updatedAt: now,
      };
      setTeamInvite(nextInvite);
      onTeacherUpdated?.(nextTeacher);
      setFeedback({
        type: 'success',
        message: 'Saved team settings and invite status (Dev sandbox — no database writes).',
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const { teacher: nextTeacher, invite: nextInvite } = await teacherUpdateTeamSettings(teacher, {
        displayName: draftCoachName,
        teamName: draftTeamName,
        active: draftInviteActive,
      });
      setTeamInvite(nextInvite);
      onTeacherUpdated?.(nextTeacher);
      setFeedback({
        type: 'success',
        message: 'Saved team settings and invite link status.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save team settings.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveTeamAnnouncement = async (e: React.FormEvent, clear = false) => {
    e.preventDefault();
    if (isMutating) return;
    if (previewMode) {
      const now = new Date().toISOString();
      const savedInvite: TeamInvite = {
        ...(teamInvite || {
          id: teacher.inviteCode,
          teamName: teacher.teamName,
          coachName: teacher.displayName,
          active: true,
          createdAt: now,
          updatedAt: now,
        }),
        teamAnnouncementTitle: clear ? undefined : annTitle.trim() || undefined,
        teamAnnouncementMessage: clear ? undefined : annMessage.trim() || undefined,
        teamAnnouncementSeverity: clear ? undefined : annSeverity,
        teamAnnouncementUpdatedAt: now,
        updatedAt: now,
      };
      setTeamInvite(savedInvite);
      if (clear) {
        setAnnTitle('');
        setAnnMessage('');
      }
      setFeedback({
        type: 'success',
        message: `${
          clear ? 'Team broadcast cleared' : 'Team broadcast published'
        } (Dev sandbox — no database writes).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const savedInvite = await teacherSaveTeamAnnouncement(
        teacher,
        clear
          ? null
          : {
              title: annTitle,
              message: annMessage,
              severity: annSeverity,
            }
      );
      setTeamInvite(savedInvite);
      if (clear) {
        setAnnTitle('');
        setAnnMessage('');
      }
      setFeedback({
        type: 'success',
        message: clear
          ? 'Team broadcast cleared.'
          : 'Team broadcast published live to your athletes.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update team broadcast.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleExportTeamCsv = () => {
    const headers = [
      'Student_Name',
      'Email',
      'Status',
      'Runs_This_Week',
      'Weekly_Goal',
      'Total_Runs',
      'Total_Distance_KM',
      'Best_Target_Sec',
      'Last_Run_Date',
    ];
    const rows = enrichedStudents.map((s) => [
      `"${s.displayName.replace(/"/g, '""')}"`,
      `"${s.email.replace(/"/g, '""')}"`,
      `"${s.accountStatus}"`,
      s.currentWeekRuns,
      s.profile.weeklyRunGoal || 3,
      s.runs.length,
      s.totalDistanceKm.toFixed(2),
      s.bestTargetSec ? Math.round(s.bestTargetSec) : '',
      `"${s.lastRunDate || ''}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rungoals_team_${teacher.inviteCode}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportStudentJson = (s: EnrichedStudentSummary) => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            userId: s.userId,
            profile: s.profile,
            runs: s.runs,
            exportedAt: new Date().toISOString(),
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rungoals_student_${s.displayName.replace(/\s+/g, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================
  // Coach Tools: Team Workout Planner & Bulk Attendance Handlers
  // ============================================================

  const activeStudentsList = useMemo(
    () => students.filter((s) => s.accountStatus !== 'suspended'),
    [students]
  );

  const resetWorkoutForm = () => {
    setEditingWorkoutId(null);
    setWoTitle('');
    setWoDate(formatLocalDateString(new Date()));
    setWoRunType('Interval Training');
    setWoDistKm('6.0');
    setWoDurationStr('24:00');
    setWoPaceHint('');
    setWoNotes('');
  };

  const applyWorkoutPreset = (preset: (typeof WORKOUT_PRESETS)[number]) => {
    setWoTitle(preset.title);
    setWoRunType(preset.runType);
    setWoDistKm(preset.distanceKm.toString());
    setWoDurationStr(formatDuration(preset.durationSeconds));
    setWoPaceHint(preset.targetPaceHint);
    setWoNotes(preset.notes);
  };

  const startEditingTeamWorkout = (w: PlannedTeamWorkout) => {
    setEditingWorkoutId(w.id);
    setWoTitle(w.title);
    setWoDate(w.date);
    setWoRunType(w.runType);
    setWoDistKm(w.distanceKm.toString());
    setWoDurationStr(w.durationSeconds > 0 ? formatDuration(w.durationSeconds) : '24:00');
    setWoPaceHint(w.targetPaceHint || '');
    setWoNotes(w.notes || '');
  };

  const getCompletedIdsForWorkout = useCallback(
    (w: PlannedTeamWorkout): Set<string> => {
      const set = new Set<string>(w.completedUserIds || []);
      students.forEach((s) => {
        const detId = buildTeamRunDocId(w.id, s.id);
        if (
          teamRuns.some(
            (r) => r.userId === s.id && (r.plannedWorkoutId === w.id || r.id === detId)
          )
        ) {
          set.add(s.id);
        }
      });
      return set;
    },
    [students, teamRuns]
  );

  const handleSavePlannedWorkout = async (alsoMarkEveryoneCompleted = false) => {
    if (isMutating) return;
    const distKm = parseFloat(woDistKm);
    const durSec = woDurationStr.trim() ? parseDuration(woDurationStr) : 0;
    if (!woTitle.trim() || isNaN(distKm) || distKm <= 0) {
      setFeedback({
        type: 'error',
        message: 'Enter a workout title and distance greater than 0 km.',
      });
      return;
    }

    const now = new Date().toISOString();
    const existing = editingWorkoutId
      ? teamWorkouts.find((w) => w.id === editingWorkoutId)
      : undefined;
    const workoutObj: PlannedTeamWorkout = {
      id:
        existing?.id ||
        `tw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      teamCode: teacher.inviteCode,
      coachEmail: teacher.email,
      date: woDate || formatLocalDateString(new Date()),
      title: woTitle.trim().slice(0, 150),
      runType: woRunType,
      distanceKm: Number(Math.min(500, Math.max(0.1, distKm)).toFixed(2)),
      durationSeconds: Math.min(86400, Math.max(0, durSec)),
      targetPaceHint: woPaceHint.trim() ? woPaceHint.trim().slice(0, 80) : undefined,
      notes: woNotes.trim() ? woNotes.trim().slice(0, 1000) : undefined,
      completedUserIds: existing?.completedUserIds || [],
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    if (previewMode) {
      let nextWorkout = workoutObj;
      let addedCount = 0;
      if (alsoMarkEveryoneCompleted && activeStudentsList.length > 0) {
        const res = buildBulkTeamWorkoutRuns(workoutObj, activeStudentsList, teamRuns);
        nextWorkout = res.updatedWorkout;
        addedCount = res.createdRuns.length;
        if (res.createdRuns.length > 0) {
          setTeamRuns((prev) => [...res.createdRuns, ...prev]);
        }
      }
      setTeamWorkouts((prev) => {
        const filtered = prev.filter((w) => w.id !== nextWorkout.id);
        return [nextWorkout, ...filtered].sort((a, b) =>
          (b.date || '').localeCompare(a.date || '')
        );
      });
      resetWorkoutForm();
      setFeedback({
        type: 'success',
        message: alsoMarkEveryoneCompleted
          ? `Saved "${nextWorkout.title}" and logged completion for ${addedCount} athlete${
              addedCount === 1 ? '' : 's'
            } (Dev sandbox — no database writes).`
          : `${existing ? 'Updated' : 'Planned'} team workout "${nextWorkout.title}" (Dev sandbox — no database writes).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const saved = await teacherSaveTeamWorkout(teacher, workoutObj, !existing);
      let finalWorkout = saved;
      let addedCount = 0;
      if (alsoMarkEveryoneCompleted && activeStudentsList.length > 0) {
        const bulkRes = await teacherBulkCompleteWorkout(
          teacher,
          saved,
          activeStudentsList,
          teamRuns
        );
        finalWorkout = bulkRes.updatedWorkout;
        addedCount = bulkRes.createdRuns.length;
        if (bulkRes.createdRuns.length > 0) {
          setTeamRuns((prev) => [...bulkRes.createdRuns, ...prev]);
        }
      }
      setTeamWorkouts((prev) => {
        const filtered = prev.filter((w) => w.id !== finalWorkout.id);
        return [finalWorkout, ...filtered].sort((a, b) =>
          (b.date || '').localeCompare(a.date || '')
        );
      });
      resetWorkoutForm();
      setFeedback({
        type: 'success',
        message: alsoMarkEveryoneCompleted
          ? `Saved "${finalWorkout.title}" and logged completion for ${addedCount} athlete${
              addedCount === 1 ? '' : 's'
            }.`
          : `${existing ? 'Updated' : 'Planned'} team workout "${finalWorkout.title}".`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save planned team workout.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleBulkCompleteWorkout = async (
    workout: PlannedTeamWorkout,
    targetStudents: UserProfile[]
  ) => {
    if (isMutating) return;
    if (targetStudents.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Select at least one athlete to mark completed.',
      });
      return;
    }

    if (previewMode) {
      const res = buildBulkTeamWorkoutRuns(workout, targetStudents, teamRuns);
      if (res.createdRuns.length > 0) {
        setTeamRuns((prev) => [...res.createdRuns, ...prev]);
      }
      setTeamWorkouts((prev) =>
        prev.map((w) => (w.id === res.updatedWorkout.id ? res.updatedWorkout : w))
      );
      setPickingAthletesWorkoutId(null);
      setFeedback({
        type: 'success',
        message:
          res.createdRuns.length > 0
            ? `Logged "${workout.title}" for ${res.createdRuns.length} athlete${
                res.createdRuns.length === 1 ? '' : 's'
              }${
                res.skippedUserIds.length > 0
                  ? ` (${res.skippedUserIds.length} already logged)`
                  : ''
              } (Dev sandbox — no database writes).`
            : `All selected athletes already completed "${workout.title}" (Dev sandbox).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const res = await teacherBulkCompleteWorkout(
        teacher,
        workout,
        targetStudents,
        teamRuns
      );
      if (res.createdRuns.length > 0) {
        setTeamRuns((prev) => [...res.createdRuns, ...prev]);
      }
      setTeamWorkouts((prev) =>
        prev.map((w) => (w.id === res.updatedWorkout.id ? res.updatedWorkout : w))
      );
      setPickingAthletesWorkoutId(null);
      setFeedback({
        type: 'success',
        message:
          res.createdRuns.length > 0
            ? `Logged "${workout.title}" for ${res.createdRuns.length} athlete${
                res.createdRuns.length === 1 ? '' : 's'
              }${
                res.skippedCount > 0 ? ` (${res.skippedCount} already logged)` : ''
              }.`
            : `All selected athletes already completed "${workout.title}".`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to log workout for team.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeletePlannedWorkout = async (workout: PlannedTeamWorkout) => {
    if (isMutating) return;
    if (previewMode) {
      setTeamWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
      setConfirmDeleteWorkoutId(null);
      if (editingWorkoutId === workout.id) resetWorkoutForm();
      setFeedback({
        type: 'success',
        message: `Deleted team workout "${workout.title}" (Dev sandbox — no database writes).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      await teacherDeleteTeamWorkout(workout);
      setTeamWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
      setConfirmDeleteWorkoutId(null);
      if (editingWorkoutId === workout.id) resetWorkoutForm();
      setFeedback({
        type: 'success',
        message: `Deleted team workout "${workout.title}".`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete team workout.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  // ============================================================
  // Coach Tools: Multi-Athlete Goal Manager Handlers
  // ============================================================

  const updateGoalDraftField = (
    studentId: string,
    patch: Partial<GoalDraftRow>
  ) => {
    setGoalDrafts((prev) => {
      const base =
        prev[studentId] ||
        buildGoalDraftRow(
          students.find((s) => s.id === studentId) || {
            id: studentId,
            email: '',
            displayName: '',
            weeklyRunGoal: 3,
            unitPreference: 'km',
          }
        );
      return {
        ...prev,
        [studentId]: { ...base, ...patch },
      };
    });
  };

  const isGoalRowModified = useCallback(
    (p: UserProfile): boolean => {
      const draft = goalDrafts[p.id];
      if (!draft) return false;
      const base = buildGoalDraftRow(p);
      return (
        draft.targetDistanceKm !== base.targetDistanceKm ||
        draft.targetGoalName !== base.targetGoalName ||
        draft.targetTimeStr !== base.targetTimeStr ||
        draft.weeklyRunGoal !== base.weeklyRunGoal ||
        draft.weeklyDistKm !== base.weeklyDistKm ||
        draft.targetGoalDate !== base.targetGoalDate ||
        draft.yraaDivision !== base.yraaDivision ||
        draft.coachNotes !== base.coachNotes
      );
    },
    [goalDrafts]
  );

  const modifiedGoalStudents = useMemo(
    () => students.filter(isGoalRowModified),
    [students, isGoalRowModified]
  );

  const handleApplyBatchGoalPreset = () => {
    const scopeIds = new Set<string>();
    students.forEach((s) => {
      if (batchScope === 'all') scopeIds.add(s.id);
      else if (batchScope === 'active' && s.accountStatus !== 'suspended') scopeIds.add(s.id);
      else if (batchScope === 'selected' && selectedGoalStudentIds.has(s.id)) scopeIds.add(s.id);
    });

    if (scopeIds.size === 0) {
      setFeedback({
        type: 'error',
        message: 'No athletes match the selected scope. Check athletes or pick All Active.',
      });
      return;
    }

    const parsedDist = batchDistKm ? parseFloat(batchDistKm) : undefined;
    const foundPreset = batchDistKm
      ? TARGET_DISTANCE_OPTIONS.find((o) => o.km.toString() === batchDistKm)
      : undefined;
    const parsedTimeSec = batchTargetTimeStr.trim()
      ? parseDuration(batchTargetTimeStr)
      : undefined;
    const parsedWeeklyRuns = batchWeeklyRuns.trim()
      ? Math.min(14, Math.max(1, parseInt(batchWeeklyRuns, 10) || 3))
      : undefined;
    const parsedWeeklyDist = batchWeeklyDistKm.trim()
      ? Math.min(500, Math.max(0, parseFloat(batchWeeklyDistKm) || 0))
      : undefined;

    if (
      parsedDist === undefined &&
      (!parsedTimeSec || parsedTimeSec <= 0) &&
      parsedWeeklyRuns === undefined &&
      parsedWeeklyDist === undefined &&
      !batchGoalDate.trim() &&
      !batchDivision
    ) {
      setFeedback({
        type: 'error',
        message: 'Fill at least one goal field in the Batch Preset bar before applying.',
      });
      return;
    }

    const baseList = students.map((s) => {
      const d = goalDrafts[s.id] || buildGoalDraftRow(s);
      const tSec = d.targetTimeStr.trim() ? parseDuration(d.targetTimeStr) : undefined;
      return {
        ...s,
        targetDistanceKm: parseFloat(d.targetDistanceKm) || 6.0,
        targetGoalName: d.targetGoalName,
        target6kTimeSeconds: tSec && tSec > 0 ? tSec : undefined,
        weeklyRunGoal: parseInt(d.weeklyRunGoal, 10) || 3,
        weeklyDistanceGoalKm: d.weeklyDistKm.trim() ? parseFloat(d.weeklyDistKm) : undefined,
        targetGoalDate: d.targetGoalDate.trim() || undefined,
        yraaDivision: d.yraaDivision,
        coachNotes: d.coachNotes.trim() || undefined,
      };
    });

    const applied = applyBatchGoalPresetToProfiles(baseList, scopeIds, {
      ...(parsedDist !== undefined
        ? {
            targetDistanceKm: parsedDist,
            targetGoalName: foundPreset ? foundPreset.label : `${parsedDist}K Race`,
          }
        : {}),
      ...(parsedTimeSec && parsedTimeSec > 0 ? { target6kTimeSeconds: parsedTimeSec } : {}),
      ...(parsedWeeklyRuns !== undefined ? { weeklyRunGoal: parsedWeeklyRuns } : {}),
      ...(parsedWeeklyDist !== undefined ? { weeklyDistanceGoalKm: parsedWeeklyDist } : {}),
      ...(batchGoalDate.trim() ? { targetGoalDate: batchGoalDate.trim() } : {}),
      ...(batchDivision ? { yraaDivision: batchDivision as YraaDivisionId } : {}),
    });

    const nextDrafts: Record<string, GoalDraftRow> = {};
    applied.forEach((p) => {
      nextDrafts[p.id] = buildGoalDraftRow(p);
    });
    setGoalDrafts(nextDrafts);
    setFeedback({
      type: 'success',
      message: `Applied goal preset to ${scopeIds.size} athlete${
        scopeIds.size === 1 ? '' : 's'
      }. Review the table and click "Save Goal Changes" to persist.`,
    });
  };

  const handleSaveAllGoalChanges = async () => {
    if (isMutating || modifiedGoalStudents.length === 0) return;

    const updatedProfiles: UserProfile[] = modifiedGoalStudents.map((orig) => {
      const d = goalDrafts[orig.id] || buildGoalDraftRow(orig);
      const distKm = Math.min(100, Math.max(0.1, parseFloat(d.targetDistanceKm) || 6));
      const parsedTime = d.targetTimeStr.trim() ? parseDuration(d.targetTimeStr) : undefined;
      const weeklyRuns = Math.min(14, Math.max(1, parseInt(d.weeklyRunGoal, 10) || 3));
      const weeklyDist = d.weeklyDistKm.trim() ? parseFloat(d.weeklyDistKm) : undefined;

      return {
        ...orig,
        targetDistanceKm: distKm,
        targetGoalName: d.targetGoalName.trim() || `${distKm}K Race`,
        target6kTimeSeconds: parsedTime && parsedTime > 0 ? parsedTime : undefined,
        hasCustomTarget: Boolean(parsedTime && parsedTime > 0),
        weeklyRunGoal: weeklyRuns,
        weeklyDistanceGoalKm: weeklyDist && weeklyDist > 0 ? weeklyDist : undefined,
        targetGoalDate: d.targetGoalDate.trim() || undefined,
        yraaDivision: d.yraaDivision,
        coachNotes: d.coachNotes.trim() || undefined,
      };
    });

    if (previewMode) {
      const updatedMap = new Map(updatedProfiles.map((p) => [p.id, p]));
      const nextStudents = students.map((s) => updatedMap.get(s.id) || s);
      setStudents(nextStudents);
      syncGoalDraftsFromStudents(nextStudents);
      setFeedback({
        type: 'success',
        message: `Saved goal updates for ${updatedProfiles.length} athlete${
          updatedProfiles.length === 1 ? '' : 's'
        } (Dev sandbox — no database writes).`,
      });
      return;
    }

    setIsMutating(true);
    setFeedback(null);
    try {
      const savedList = await teacherBatchUpdateStudentGoals(teacher, updatedProfiles);
      const savedMap = new Map(savedList.map((p) => [p.id, p]));
      const nextStudents = students.map((s) => savedMap.get(s.id) || s);
      setStudents(nextStudents);
      syncGoalDraftsFromStudents(nextStudents);
      setFeedback({
        type: 'success',
        message: `Saved goal updates for ${savedList.length} athlete${
          savedList.length === 1 ? '' : 's'
        }.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save athlete goals.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-slate-950/75 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-6xl rounded-2xl bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-3">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#09121B]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                  {teamInvite?.teamName || teacher.teamName}
                </h2>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  {previewMode
                    ? 'Dev Sandbox · Coach Console'
                    : onBackToAdmin
                    ? 'Admin Preview · Coach Console'
                    : 'Coach Console'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono tabular-nums">
                {teacher.displayName} · Invite Code {teacher.inviteCode}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-1.5 shrink-0">
            {onBackToAdmin && (
              <button
                type="button"
                onClick={onBackToAdmin}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-violet-500/15 hover:bg-violet-500/25 text-violet-700 dark:text-violet-300 border border-violet-500/30 transition-colors cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Admin</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#0593C6] hover:bg-[#047ea8] text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied' : 'Copy Student Invite Link'}</span>
            </button>
            <button
              type="button"
              onClick={loadTeamData}
              disabled={isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{previewMode ? 'Reset Sandbox' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close Coach Console"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4 max-h-[84vh] overflow-y-auto">
          {/* Interactive Dev Sandbox Banner */}
          {previewMode && (
            <div className="p-3 rounded-xl border border-violet-500/30 bg-violet-500/10 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2 text-violet-900 dark:text-violet-100 min-w-0">
                <FlaskConical className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5 sm:mt-0" />
                <p className="leading-snug">
                  <strong className="font-bold">Interactive Coach UI Sandbox</strong> — Test roster filters, edits, direct messages, workout logs, and broadcasts with 4 sample athletes. All edits stay in local memory.
                </p>
              </div>
              <button
                type="button"
                onClick={loadTeamData}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[#0D1620] border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 font-semibold hover:bg-violet-50 dark:hover:bg-violet-950/40 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Sample Data</span>
              </button>
            </div>
          )}

          {/* Action Feedback Banner */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate font-medium">{feedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="p-1 opacity-70 hover:opacity-100 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 4-Card KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Team Roster</span>
                <Users className="w-3.5 h-3.5 text-[#0593C6]" />
              </div>
              <div className="flex items-baseline gap-2 mt-1 tabular-nums">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {teamStats.totalStudents}
                </span>
                {teamStats.suspendedCount > 0 && (
                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    {teamStats.suspendedCount} suspended
                  </span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Team Workouts</span>
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
                {teamStats.totalRuns}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Team Volume</span>
                <Route className="w-3.5 h-3.5 text-violet-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
                {teamStats.totalKm.toFixed(1)}{' '}
                <span className="text-xs font-semibold text-slate-500">km</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Active (7d) · Goals Met</span>
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2 mt-1 tabular-nums">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {teamStats.activeLast7d}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {teamStats.goalMetCount} met weekly goal
                </span>
              </div>
            </div>
          </div>

          {/* Primary Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#09121B] border border-slate-200/80 dark:border-slate-800 overflow-x-auto max-w-full">
              {(
                [
                  { id: 'roster', label: 'Roster & Student Control', icon: Users },
                  { id: 'workouts', label: 'Team Workouts', icon: ClipboardList },
                  { id: 'goals', label: 'Goal Manager', icon: Target },
                  { id: 'activity', label: 'Leaderboard & Feed', icon: Activity },
                  { id: 'team', label: 'Invite & Broadcast', icon: Megaphone },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      active
                        ? 'bg-white dark:bg-[#132232] text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleExportTeamCsv}
              disabled={enrichedStudents.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0593C6] hover:bg-[#047ea8] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-45 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Team CSV</span>
            </button>
          </div>

          {/* TAB 1: ROSTER & STUDENT CONTROL */}
          {activeTab === 'roster' && (
            <div className="space-y-3.5">
              {/* Filters */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search athletes by name, email, or user ID..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#09121B] border border-slate-200/80 dark:border-slate-800 overflow-x-auto">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'active', label: 'Active' },
                        { id: 'inactive_7d', label: 'Inactive 7d+' },
                        { id: 'suspended', label: 'Suspended' },
                        { id: 'pending_setup', label: 'Setup Pending' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setStudentFilter(f.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                          studentFilter === f.id
                            ? 'bg-white dark:bg-[#132232] text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
                >
                  <option value="recent">Sort: Most Recent</option>
                  <option value="runs">Sort: Most Workouts</option>
                  <option value="distance">Sort: Highest Volume</option>
                  <option value="name">Sort: Name (A–Z)</option>
                </select>
              </div>

              {isLoading && students.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2 text-xs text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  <span>Loading your team roster and workouts...</span>
                </div>
              ) : enrichedStudents.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-center space-y-3">
                  <Users className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      No athletes have joined your team yet
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                      Send your student invite link or team code <strong className="font-mono">{teacher.inviteCode}</strong> to your athletes so they appear here.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyInviteLink}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0593C6] hover:bg-[#047ea8] text-white text-xs font-bold cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Invite Link Copied' : 'Copy Student Invite Link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyInviteCode}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied Code' : `Code: ${teacher.inviteCode}`}</span>
                    </button>
                  </div>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                  No athletes match the current filter or search query.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left Directory */}
                  <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#09121B]/60 overflow-hidden flex flex-col max-h-[540px]">
                    <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Athletes ({filteredStudents.length})</span>
                      <span>Week · Volume</span>
                    </div>

                    <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80 overflow-y-auto">
                      {filteredStudents.map((s) => {
                        const isSelected = selectedStudent?.userId === s.userId;
                        return (
                          <button
                            key={s.userId}
                            type="button"
                            onClick={() => setSelectedStudentId(s.userId)}
                            className={`w-full px-3.5 py-3 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-500/10 dark:bg-emerald-500/15'
                                : 'hover:bg-white dark:hover:bg-[#0F1C28]'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="font-bold text-slate-900 dark:text-white truncate">
                                  {s.displayName}
                                </span>
                                {s.accountStatus === 'suspended' && (
                                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                                    · Suspended
                                  </span>
                                )}
                                {s.profile.directMessageBody && (
                                  <span className="text-[11px] font-semibold text-[#0593C6] dark:text-sky-400 shrink-0">
                                    ·{' '}
                                    {!s.profile.directMessageReadAt ||
                                    (s.profile.directMessageSentAt &&
                                      s.profile.directMessageReadAt < s.profile.directMessageSentAt)
                                      ? 'Unread msg'
                                      : 'Msg read'}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {s.email}
                              </div>
                              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate mt-0.5 tabular-nums">
                                {s.lastRunDate ? `Last run ${s.lastRunDate}` : 'No runs logged yet'}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 text-right tabular-nums">
                              <div>
                                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                                  {s.currentWeekRuns}/{s.profile.weeklyRunGoal || 3} wk
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {s.totalDistanceKm.toFixed(1)} km
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Student Inspector */}
                  <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1520] p-4 flex flex-col max-h-[540px] overflow-y-auto space-y-3.5">
                    {selectedStudent && (
                      <>
                        {/* Student Header */}
                        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                          <div className="min-w-0">
                            <div className="flex items-center flex-wrap gap-2">
                              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                                {selectedStudent.displayName}
                              </h3>
                              {selectedStudent.accountStatus === 'suspended' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Suspended</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              <span className="truncate">{selectedStudent.email}</span>
                              <span aria-hidden="true">·</span>
                              <button
                                type="button"
                                onClick={() => handleCopyUid(selectedStudent.userId)}
                                className="inline-flex items-center gap-1 font-mono text-[11px] hover:text-slate-900 dark:hover:text-white cursor-pointer"
                              >
                                <span>UID {selectedStudent.userId.slice(0, 10)}...</span>
                                {copiedUid ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleExportStudentJson(selectedStudent)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0 whitespace-nowrap"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export JSON</span>
                          </button>
                        </div>

                        {/* Coach Action Toolbar */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openMessagePanel(selectedStudent)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                              actionPanel === 'message_student'
                                ? 'bg-[#0593C6] text-white border-[#0593C6]'
                                : 'bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30 text-sky-700 dark:text-sky-300'
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>
                              {selectedStudent.profile.directMessageBody
                                ? 'Edit Message'
                                : 'Message Student'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditProfile(selectedStudent)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                              actionPanel === 'edit_profile'
                                ? 'bg-violet-600 text-white border-violet-600'
                                : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#09121B] dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <UserCog className="w-3.5 h-3.5" />
                            <span>Edit Goals &amp; Profile</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setActionPanel((p) => (p === 'add_run' ? 'none' : 'add_run'))
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                              actionPanel === 'add_run'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#09121B] dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Log Run</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSuspendReasonInput(selectedStudent.profile.suspensionReason || '');
                              setActionPanel((p) => (p === 'suspend' ? 'none' : 'suspend'));
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                              actionPanel === 'suspend'
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#09121B] dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>
                              {selectedStudent.accountStatus === 'suspended' ? 'Restore' : 'Suspend'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleResetStudentSetup(selectedStudent)}
                            disabled={isMutating}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 dark:bg-[#09121B] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset Setup</span>
                          </button>

                          {selectedStudent.runs.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setActionPanel((p) => (p === 'clear_runs' ? 'none' : 'clear_runs'))
                              }
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                                actionPanel === 'clear_runs'
                                  ? 'bg-amber-600 text-white border-amber-600'
                                  : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#09121B] dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Clear Runs</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setActionPanel((p) => (p === 'remove_team' ? 'none' : 'remove_team'))
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                              actionPanel === 'remove_team'
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            <span>Remove from Team</span>
                          </button>
                        </div>

                        {/* INLINE DRAWER: MESSAGE STUDENT */}
                        {actionPanel === 'message_student' && (
                          <form
                            onSubmit={handleSendMessage}
                            className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-sky-500/30 space-y-3 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                Direct Message to {selectedStudent.displayName}
                              </span>
                              <button
                                type="button"
                                onClick={() => setActionPanel('none')}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <label className="space-y-1 sm:col-span-2">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Title (optional)
                                </span>
                                <input
                                  type="text"
                                  value={msgTitle}
                                  onChange={(e) => setMsgTitle(e.target.value)}
                                  maxLength={120}
                                  placeholder="e.g. Workout check-in"
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">Tone</span>
                                <select
                                  value={msgSeverity}
                                  onChange={(e) =>
                                    setMsgSeverity(e.target.value as 'info' | 'warning' | 'success')
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                >
                                  <option value="info">Coach Note (Blue)</option>
                                  <option value="success">Praise / PR (Green)</option>
                                  <option value="warning">Alert (Amber)</option>
                                </select>
                              </label>
                            </div>
                            <textarea
                              rows={3}
                              required
                              maxLength={1000}
                              value={msgBody}
                              onChange={(e) => setMsgBody(e.target.value)}
                              placeholder={`Write a direct coaching message to ${selectedStudent.displayName}...`}
                              className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              {selectedStudent.profile.directMessageBody ? (
                                <button
                                  type="button"
                                  disabled={isMutating}
                                  onClick={handleClearMessage}
                                  className="px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-semibold cursor-pointer"
                                >
                                  Clear Message
                                </button>
                              ) : (
                                <span />
                              )}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setActionPanel('none')}
                                  className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={isMutating || !msgBody.trim()}
                                  className="px-3.5 py-1.5 rounded-lg bg-[#0593C6] hover:bg-[#047ea8] text-white font-bold cursor-pointer disabled:opacity-50"
                                >
                                  {isMutating ? 'Sending...' : 'Send Message'}
                                </button>
                              </div>
                            </div>
                          </form>
                        )}

                        {/* INLINE DRAWER: SUSPEND / RESTORE */}
                        {actionPanel === 'suspend' && (
                          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 text-xs">
                            <div className="font-bold text-amber-900 dark:text-amber-200">
                              {selectedStudent.accountStatus === 'suspended'
                                ? `Restore access for ${selectedStudent.displayName}?`
                                : `Suspend ${selectedStudent.displayName}?`}
                            </div>
                            {selectedStudent.accountStatus !== 'suspended' && (
                              <input
                                type="text"
                                value={suspendReasonInput}
                                onChange={(e) => setSuspendReasonInput(e.target.value)}
                                placeholder="Optional reason shown to student"
                                maxLength={300}
                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#09121B] border border-amber-300 dark:border-amber-800 text-xs text-slate-900 dark:text-white"
                              />
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isMutating}
                                onClick={handleToggleSuspendStudent}
                                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer disabled:opacity-50"
                              >
                                {isMutating
                                  ? 'Updating...'
                                  : selectedStudent.accountStatus === 'suspended'
                                  ? 'Restore Student'
                                  : 'Suspend Student'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setActionPanel('none')}
                                className="px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* INLINE DRAWER: CLEAR RUNS */}
                        {actionPanel === 'clear_runs' && (
                          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-amber-900 dark:text-amber-200 font-semibold">
                              Clear all {selectedStudent.runs.length} runs logged by{' '}
                              {selectedStudent.displayName}?
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isMutating}
                                onClick={handleClearStudentRuns}
                                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer disabled:opacity-50"
                              >
                                {isMutating ? 'Clearing...' : 'Clear All Runs'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setActionPanel('none')}
                                className="px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* INLINE DRAWER: REMOVE FROM TEAM */}
                        {actionPanel === 'remove_team' && (
                          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2.5 text-xs">
                            <div className="flex items-start gap-2 text-rose-800 dark:text-rose-200">
                              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                              <div>
                                <div className="font-bold">
                                  Remove {selectedStudent.displayName} from {teacher.teamName}?
                                </div>
                                <p className="mt-0.5 text-rose-700 dark:text-rose-300 leading-relaxed">
                                  Their account and personal workouts stay intact, but they will be unlinked from your team roster and no longer monitored here.
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isMutating}
                                onClick={handleRemoveStudentFromTeam}
                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer disabled:opacity-50"
                              >
                                {isMutating ? 'Removing...' : 'Confirm Remove'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setActionPanel('none')}
                                className="px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* INLINE DRAWER: EDIT STUDENT GOALS & PROFILE */}
                        {actionPanel === 'edit_profile' && (
                          <form
                            onSubmit={handleSaveStudentProfile}
                            className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 space-y-3 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 dark:text-white">
                                Edit Student Profile &amp; Goals
                              </span>
                              <button
                                type="button"
                                onClick={() => setActionPanel('none')}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Display Name
                                </span>
                                <input
                                  type="text"
                                  value={editDisplayName}
                                  onChange={(e) => setEditDisplayName(e.target.value)}
                                  maxLength={128}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Athlete Level
                                </span>
                                <select
                                  value={editAthleteLevel}
                                  onChange={(e) =>
                                    setEditAthleteLevel(
                                      e.target.value as NonNullable<UserProfile['athleteLevel']>
                                    )
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                >
                                  <option value="Beginner">Beginner</option>
                                  <option value="High School XC">High School XC</option>
                                  <option value="Collegiate / Advanced">Collegiate / Advanced</option>
                                  <option value="Masters">Masters</option>
                                </select>
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Goal Distance Preset
                                </span>
                                <select
                                  value={editTargetDistKm}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditTargetDistKm(val);
                                    const found = TARGET_DISTANCE_OPTIONS.find(
                                      (o) => o.km.toString() === val
                                    );
                                    if (found) setEditTargetGoalName(found.label);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                >
                                  {TARGET_DISTANCE_OPTIONS.map((opt) => (
                                    <option key={opt.label} value={opt.km.toString()}>
                                      {opt.label} ({opt.km} km)
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Target Time (mm:ss)
                                </span>
                                <input
                                  type="text"
                                  value={editTargetTimeStr}
                                  onChange={(e) => setEditTargetTimeStr(e.target.value)}
                                  placeholder="e.g. 21:00"
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Weekly Run Goal (runs/wk)
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  max={14}
                                  value={editWeeklyRunGoal}
                                  onChange={(e) => setEditWeeklyRunGoal(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Weekly Distance Goal (km)
                                </span>
                                <input
                                  type="number"
                                  step="0.5"
                                  min={0}
                                  max={500}
                                  value={editWeeklyDistKm}
                                  onChange={(e) => setEditWeeklyDistKm(e.target.value)}
                                  placeholder="Optional"
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Target Race Date
                                </span>
                                <input
                                  type="date"
                                  value={editTargetGoalDate}
                                  onChange={(e) => setEditTargetGoalDate(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Units &amp; YRAA Division
                                </span>
                                <div className="flex gap-1.5">
                                  <select
                                    value={editUnitPref}
                                    onChange={(e) =>
                                      setEditUnitPref(e.target.value as 'km' | 'miles')
                                    }
                                    className="px-2 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                  >
                                    <option value="km">km</option>
                                    <option value="miles">mi</option>
                                  </select>
                                  <select
                                    value={editYraaDivision}
                                    onChange={(e) =>
                                      setEditYraaDivision(e.target.value as YraaDivisionId)
                                    }
                                    className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                  >
                                    {YRAA_DIVISION_LIST.map((div) => (
                                      <option key={div.id} value={div.id}>
                                        {div.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Max Heart Rate (bpm)
                                </span>
                                <input
                                  type="number"
                                  min={100}
                                  max={250}
                                  value={editMaxHr}
                                  onChange={(e) => setEditMaxHr(e.target.value)}
                                  placeholder="Auto"
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                                />
                              </label>
                              <label className="flex items-center gap-2 pt-4 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editOnboardingDone}
                                  onChange={(e) => setEditOnboardingDone(e.target.checked)}
                                  className="rounded border-slate-300 text-violet-600"
                                />
                                <span className="text-slate-700 dark:text-slate-200 font-semibold">
                                  Onboarding Completed
                                </span>
                              </label>
                            </div>
                            <label className="block space-y-1">
                              <span className="text-[11px] font-semibold text-slate-500">
                                Coach Private Notes (only visible to coach/admin)
                              </span>
                              <textarea
                                rows={2}
                                value={editCoachNotes}
                                onChange={(e) => setEditCoachNotes(e.target.value)}
                                maxLength={1000}
                                placeholder="Splits, injury notes, training group..."
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                              />
                            </label>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setActionPanel('none')}
                                className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isMutating}
                                className="px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold cursor-pointer disabled:opacity-50"
                              >
                                {isMutating ? 'Saving...' : 'Save Changes'}
                              </button>
                            </div>
                          </form>
                        )}

                        {/* INLINE DRAWER: LOG RUN FOR STUDENT */}
                        {actionPanel === 'add_run' && (
                          <form
                            onSubmit={handleCreateRunForStudent}
                            className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 dark:text-white">
                                Log Workout for {selectedStudent.displayName}
                              </span>
                              <button
                                type="button"
                                onClick={() => setActionPanel('none')}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <label className="space-y-1 sm:col-span-2">
                                <span className="text-[11px] font-semibold text-slate-500">Title</span>
                                <input
                                  type="text"
                                  value={newRunTitle}
                                  onChange={(e) => setNewRunTitle(e.target.value)}
                                  placeholder="e.g. Track Practice 5x1000m"
                                  maxLength={150}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">Date</span>
                                <input
                                  type="date"
                                  value={newRunDate}
                                  onChange={(e) => setNewRunDate(e.target.value)}
                                  required
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Category
                                </span>
                                <select
                                  value={newRunType}
                                  onChange={(e) => setNewRunType(e.target.value as RunType)}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                >
                                  {RUN_TYPE_OPTIONS.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Distance (km)
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.1"
                                  value={newRunDistKm}
                                  onChange={(e) => setNewRunDistKm(e.target.value)}
                                  required
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Duration (mm:ss)
                                </span>
                                <input
                                  type="text"
                                  value={newRunDurationStr}
                                  onChange={(e) => setNewRunDurationStr(e.target.value)}
                                  required
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Avg HR (optional)
                                </span>
                                <input
                                  type="number"
                                  min={50}
                                  max={240}
                                  value={newRunAvgHr}
                                  onChange={(e) => setNewRunAvgHr(e.target.value)}
                                  placeholder="168"
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                                />
                              </label>
                              <label className="space-y-1 sm:col-span-2">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Notes (optional)
                                </span>
                                <input
                                  type="text"
                                  value={newRunNotes}
                                  onChange={(e) => setNewRunNotes(e.target.value)}
                                  maxLength={1000}
                                  placeholder="Logged by coach"
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                />
                              </label>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setActionPanel('none')}
                                className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isMutating}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50"
                              >
                                {isMutating ? 'Saving...' : 'Save Workout'}
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Student Telemetry Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2.5 border-y border-slate-100 dark:border-slate-800/80 text-xs tabular-nums">
                          <div>
                            <span className="text-[11px] text-slate-400 block">Target Goal</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {selectedStudent.profile.targetDistanceKm || 6}K ·{' '}
                              {selectedStudent.profile.target6kTimeSeconds
                                ? formatDuration(selectedStudent.profile.target6kTimeSeconds)
                                : 'Not set'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 block">Best Est. · Pace</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {selectedStudent.bestTargetSec
                                ? formatDuration(selectedStudent.bestTargetSec)
                                : '--:--'}{' '}
                              ·{' '}
                              {selectedStudent.avgPaceSecPerKm > 0
                                ? formatPace(
                                    selectedStudent.avgPaceSecPerKm,
                                    selectedStudent.profile.unitPreference || 'km'
                                  )
                                : '--:--'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 block">This Week</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {selectedStudent.currentWeekRuns}/
                              {selectedStudent.profile.weeklyRunGoal || 3} runs ·{' '}
                              {selectedStudent.currentWeekDistanceKm.toFixed(1)} km
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 block">Race Day</span>
                            <span className="font-bold text-slate-900 dark:text-white truncate block">
                              {selectedStudent.profile.targetGoalDate || 'Not set'}
                            </span>
                          </div>
                        </div>

                        {/* Message / Suspension / Coach Notes Summary */}
                        {(selectedStudent.profile.directMessageBody ||
                          selectedStudent.profile.suspensionReason ||
                          selectedStudent.profile.coachNotes) && (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                            {selectedStudent.profile.directMessageBody && (
                              <div className="flex flex-wrap items-start justify-between gap-2 text-sky-900 dark:text-sky-100">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <MessageSquare className="w-3.5 h-3.5 text-[#0593C6] shrink-0" />
                                    <strong className="font-semibold">
                                      {selectedStudent.profile.directMessageTitle ||
                                        'Active Direct Message'}
                                    </strong>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                      ·{' '}
                                      {!selectedStudent.profile.directMessageReadAt ||
                                      (selectedStudent.profile.directMessageSentAt &&
                                        selectedStudent.profile.directMessageReadAt <
                                          selectedStudent.profile.directMessageSentAt)
                                        ? 'Unread'
                                        : `Read ${new Date(
                                            selectedStudent.profile.directMessageReadAt
                                          ).toLocaleDateString()}`}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                                    {selectedStudent.profile.directMessageBody}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => openMessagePanel(selectedStudent)}
                                    className="px-2 py-1 rounded-md bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-[11px] font-semibold cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleClearMessage}
                                    disabled={isMutating}
                                    className="px-2 py-1 rounded-md text-[11px] font-semibold text-rose-600 dark:text-rose-400 cursor-pointer"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>
                            )}
                            {selectedStudent.profile.suspensionReason && (
                              <div className="text-rose-700 dark:text-rose-300">
                                <strong className="font-semibold">Suspension reason:</strong>{' '}
                                {selectedStudent.profile.suspensionReason}
                              </div>
                            )}
                            {selectedStudent.profile.coachNotes && (
                              <div className="text-slate-600 dark:text-slate-300">
                                <strong className="font-semibold">Coach note:</strong>{' '}
                                {selectedStudent.profile.coachNotes}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Workouts List */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <span>Logged Workouts ({selectedStudent.runs.length})</span>
                            <span className="tabular-nums">
                              Total: {selectedStudent.totalDistanceKm.toFixed(1)} km ·{' '}
                              {formatDuration(selectedStudent.totalDurationSeconds)}
                            </span>
                          </div>

                          {selectedStudent.runs.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                              No workouts logged by {selectedStudent.displayName} yet.
                            </div>
                          ) : (
                            selectedStudent.runs.map((run) => {
                              const unitPref = selectedStudent.profile.unitPreference || 'km';
                              const distLabel =
                                unitPref === 'miles'
                                  ? `${(run.distanceKm * KM_TO_MILES).toFixed(2)} mi`
                                  : `${run.distanceKm.toFixed(2)} km`;

                              if (editingRunId === run.id) {
                                return (
                                  <div
                                    key={run.id}
                                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-[#0593C6]/40 space-y-2 text-xs"
                                  >
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      <input
                                        type="text"
                                        value={editRunTitle}
                                        onChange={(e) => setEditRunTitle(e.target.value)}
                                        placeholder="Title"
                                        className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700"
                                      />
                                      <input
                                        type="date"
                                        value={editRunDate}
                                        onChange={(e) => setEditRunDate(e.target.value)}
                                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700"
                                      />
                                      <select
                                        value={editRunType}
                                        onChange={(e) => setEditRunType(e.target.value as RunType)}
                                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700"
                                      >
                                        {RUN_TYPE_OPTIONS.map((t) => (
                                          <option key={t} value={t}>
                                            {t}
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={editRunDistKm}
                                        onChange={(e) => setEditRunDistKm(e.target.value)}
                                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 tabular-nums"
                                      />
                                      <input
                                        type="text"
                                        value={editRunDurationStr}
                                        onChange={(e) => setEditRunDurationStr(e.target.value)}
                                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 font-mono"
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingRunId(null)}
                                        className="px-2.5 py-1 rounded-lg text-slate-500 cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isMutating}
                                        onClick={() => handleSaveEditedRun(run)}
                                        className="px-3 py-1 rounded-lg bg-[#0593C6] text-white font-bold cursor-pointer disabled:opacity-50"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={run.id}
                                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                >
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 dark:text-white truncate">
                                      {run.title}
                                    </div>
                                    <div className="flex items-center flex-wrap gap-x-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                      <span>{run.date}</span>
                                      <span aria-hidden="true">·</span>
                                      <span>{run.runType}</span>
                                      <span aria-hidden="true">·</span>
                                      <span>{run.source}</span>
                                    </div>
                                    {run.notes && (
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1 truncate">
                                        {run.notes}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                    <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
                                      <span className="font-bold text-slate-900 dark:text-white">
                                        {distLabel}
                                      </span>
                                      <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        {formatDuration(run.durationSeconds)}
                                      </span>
                                      <span className="text-[#0593C6] font-semibold">
                                        {formatPace(run.averagePaceSecPerKm, unitPref)}
                                      </span>
                                      {run.avgHeartRate && (
                                        <span className="text-rose-500 flex items-center gap-1">
                                          <Heart className="w-3 h-3" />
                                          {Math.round(run.avgHeartRate)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => startEditingRun(run)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#0593C6] hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                                        title="Edit workout"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      {confirmDeleteRunId === run.id ? (
                                        <button
                                          type="button"
                                          disabled={isMutating}
                                          onClick={() => handleDeleteSingleRun(run)}
                                          className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                                        >
                                          Delete?
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDeleteRunId(run.id)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                                          title="Delete workout"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1B: TEAM WORKOUT PLANNER & BULK ATTENDANCE */}
          {activeTab === 'workouts' && (
            <div className="space-y-4">
              {/* Plan Workout Form */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {editingWorkoutId ? 'Edit Planned Team Workout' : 'Plan Team Workout'}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Publish a workout to your team and log completion for everyone at once.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {WORKOUT_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyWorkoutPreset(preset)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                  <label className="space-y-1 lg:col-span-2">
                    <span className="text-[11px] font-semibold text-slate-500">Workout Title</span>
                    <input
                      type="text"
                      value={woTitle}
                      onChange={(e) => setWoTitle(e.target.value)}
                      maxLength={150}
                      placeholder="e.g. 4x1K Track Intervals"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">Date</span>
                    <input
                      type="date"
                      value={woDate}
                      onChange={(e) => setWoDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">Category</span>
                    <select
                      value={woRunType}
                      onChange={(e) => setWoRunType(e.target.value as RunType)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      {RUN_TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">Distance (km)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="500"
                      value={woDistKm}
                      onChange={(e) => setWoDistKm(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Est. Duration (mm:ss)
                    </span>
                    <input
                      type="text"
                      value={woDurationStr}
                      onChange={(e) => setWoDurationStr(e.target.value)}
                      placeholder="24:00"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Target Pace / Splits Hint (optional)
                    </span>
                    <input
                      type="text"
                      value={woPaceHint}
                      onChange={(e) => setWoPaceHint(e.target.value)}
                      maxLength={80}
                      placeholder="e.g. 4:00 /km reps · 90s rest"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Workout Instructions / Notes
                    </span>
                    <input
                      type="text"
                      value={woNotes}
                      onChange={(e) => setWoNotes(e.target.value)}
                      maxLength={1000}
                      placeholder="Warmup, rep structure, cooldown details..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {editingWorkoutId && (
                    <button
                      type="button"
                      onClick={resetWorkoutForm}
                      className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => handleSavePlannedWorkout(false)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{editingWorkoutId ? 'Save Workout Edits' : 'Save Planned Workout'}</span>
                  </button>
                  {!editingWorkoutId && (
                    <button
                      type="button"
                      disabled={isMutating || activeStudentsList.length === 0}
                      onClick={() => handleSavePlannedWorkout(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      <UsersRound className="w-3.5 h-3.5" />
                      <span>
                        Plan &amp; Mark Everyone Completed ({activeStudentsList.length})
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Scheduled Workouts List & Bulk Attendance */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-white">
                  <span>Scheduled &amp; Recent Team Workouts ({teamWorkouts.length})</span>
                  <span className="text-[11px] font-normal text-slate-500 tabular-nums">
                    {activeStudentsList.length} active athletes on roster
                  </span>
                </div>

                {teamWorkouts.length === 0 ? (
                  <div className="p-8 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                    No team workouts planned yet. Use the planner above or click a preset to create one.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {teamWorkouts.map((w) => {
                      const completedSet = getCompletedIdsForWorkout(w);
                      const completedActiveCount = activeStudentsList.filter((s) =>
                        completedSet.has(s.id)
                      ).length;
                      const remainingActiveCount = Math.max(
                        0,
                        activeStudentsList.length - completedActiveCount
                      );
                      const allActiveDone =
                        activeStudentsList.length > 0 && remainingActiveCount === 0;
                      const isPicking = pickingAthletesWorkoutId === w.id;

                      return (
                        <div
                          key={w.id}
                          className="p-3.5 rounded-xl bg-white dark:bg-[#0B1520] border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                  {w.title}
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                  · {w.date} · {w.runType}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {w.distanceKm.toFixed(1)} km
                                </span>
                                {w.durationSeconds > 0 && (
                                  <span>{formatDuration(w.durationSeconds)}</span>
                                )}
                                {w.durationSeconds > 0 && (
                                  <span className="text-[#0593C6] font-semibold">
                                    {formatPace(
                                      calculatePaceSecPerKm(w.distanceKm, w.durationSeconds),
                                      'km'
                                    )}
                                  </span>
                                )}
                                <span
                                  className={`font-sans font-bold ${
                                    allActiveDone
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  · {completedActiveCount}/{activeStudentsList.length} active completed
                                </span>
                              </div>
                              {(w.targetPaceHint || w.notes) && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug pt-0.5">
                                  {[w.targetPaceHint, w.notes].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={
                                  isMutating || activeStudentsList.length === 0 || allActiveDone
                                }
                                onClick={() => handleBulkCompleteWorkout(w, activeStudentsList)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold cursor-pointer whitespace-nowrap transition-colors ${
                                  allActiveDone
                                    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 cursor-default'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50'
                                }`}
                              >
                                {allActiveDone ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Everyone Completed</span>
                                  </>
                                ) : (
                                  <>
                                    <UsersRound className="w-3.5 h-3.5" />
                                    <span>Everyone Did It ({remainingActiveCount} left)</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={students.length === 0}
                                onClick={() => {
                                  if (isPicking) {
                                    setPickingAthletesWorkoutId(null);
                                  } else {
                                    setPickingAthletesWorkoutId(w.id);
                                    setPickedAthleteIds(
                                      new Set(activeStudentsList.map((s) => s.id))
                                    );
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer whitespace-nowrap"
                              >
                                <Users className="w-3.5 h-3.5" />
                                <span>{isPicking ? 'Hide List' : 'Pick Athletes'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => startEditingTeamWorkout(w)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#0593C6] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title="Edit team workout"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              {confirmDeleteWorkoutId === w.id ? (
                                <button
                                  type="button"
                                  disabled={isMutating}
                                  onClick={() => handleDeletePlannedWorkout(w)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  Delete?
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteWorkoutId(w.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                                  title="Delete team workout"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expandable Athlete Attendance Checklist */}
                          {isPicking && (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  Select athletes to mark completed ({pickedAthleteIds.size} selected)
                                </span>
                                <div className="flex items-center gap-2 text-[11px]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPickedAthleteIds(
                                        new Set(activeStudentsList.map((s) => s.id))
                                      )
                                    }
                                    className="font-semibold text-[#0593C6] hover:underline cursor-pointer"
                                  >
                                    All Active
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPickedAthleteIds(new Set(students.map((s) => s.id)))
                                    }
                                    className="font-semibold text-[#0593C6] hover:underline cursor-pointer"
                                  >
                                    Entire Roster
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPickedAthleteIds(new Set())}
                                    className="font-semibold text-slate-500 hover:underline cursor-pointer"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                {students.map((s) => {
                                  const alreadyDone = completedSet.has(s.id);
                                  const checked = pickedAthleteIds.has(s.id);
                                  return (
                                    <label
                                      key={s.id}
                                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-800 cursor-pointer"
                                    >
                                      <span className="flex items-center gap-2 min-w-0">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => {
                                            setPickedAthleteIds((prev) => {
                                              const next = new Set(prev);
                                              if (next.has(s.id)) next.delete(s.id);
                                              else next.add(s.id);
                                              return next;
                                            });
                                          }}
                                          className="rounded border-slate-300 text-emerald-600"
                                        />
                                        <span className="truncate font-semibold text-slate-900 dark:text-white">
                                          {s.displayName || 'Unnamed Athlete'}
                                        </span>
                                      </span>
                                      <span className="text-[11px] shrink-0">
                                        {alreadyDone ? (
                                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                            Done
                                          </span>
                                        ) : s.accountStatus === 'suspended' ? (
                                          <span className="text-rose-500">Suspended</span>
                                        ) : (
                                          <span className="text-slate-400">Pending</span>
                                        )}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>

                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setPickingAthletesWorkoutId(null)}
                                  className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={isMutating || pickedAthleteIds.size === 0}
                                  onClick={() => {
                                    const targets = students.filter((s) =>
                                      pickedAthleteIds.has(s.id)
                                    );
                                    handleBulkCompleteWorkout(w, targets);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>
                                    Log Completion for Selected ({pickedAthleteIds.size})
                                  </span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1C: MULTI-ATHLETE GOAL MANAGER */}
          {activeTab === 'goals' && (
            <div className="space-y-4">
              {/* Batch Preset Assigner */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Batch Assign &amp; Customize Athletes&apos; Goals
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Push a race distance, target time, weekly goal, or race day to multiple athletes at once, or edit each athlete individually below.
                    </p>
                  </div>
                  <select
                    value={batchScope}
                    onChange={(e) =>
                      setBatchScope(e.target.value as 'active' | 'selected' | 'all')
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                  >
                    <option value="active">
                      Apply to: All Active Athletes ({activeStudentsList.length})
                    </option>
                    <option value="selected">
                      Apply to: Checked Athletes ({selectedGoalStudentIds.size})
                    </option>
                    <option value="all">Apply to: Entire Roster ({students.length})</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">Race Distance</span>
                    <select
                      value={batchDistKm}
                      onChange={(e) => setBatchDistKm(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="">No change</option>
                      {TARGET_DISTANCE_OPTIONS.map((opt) => (
                        <option key={opt.label} value={opt.km.toString()}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Target Time (mm:ss)
                    </span>
                    <input
                      type="text"
                      value={batchTargetTimeStr}
                      onChange={(e) => setBatchTargetTimeStr(e.target.value)}
                      placeholder="Keep current"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">Runs / Wk</span>
                    <input
                      type="number"
                      min={1}
                      max={14}
                      value={batchWeeklyRuns}
                      onChange={(e) => setBatchWeeklyRuns(e.target.value)}
                      placeholder="Keep"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">Weekly km</span>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={500}
                      value={batchWeeklyDistKm}
                      onChange={(e) => setBatchWeeklyDistKm(e.target.value)}
                      placeholder="Keep"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">Race Day</span>
                    <input
                      type="date"
                      value={batchGoalDate}
                      onChange={(e) => setBatchGoalDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">Division</span>
                    <select
                      value={batchDivision}
                      onChange={(e) => setBatchDivision(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="">No change</option>
                      {YRAA_DIVISION_LIST.map((div) => (
                        <option key={div.id} value={div.id}>
                          {div.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>
                      Select rows below to target specific athletes, or apply across Active / Entire Roster.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyBatchGoalPreset}
                    disabled={students.length === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0593C6] hover:bg-[#047ea8] text-white font-bold cursor-pointer disabled:opacity-45 whitespace-nowrap"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Apply Preset to Table</span>
                  </button>
                </div>
              </div>

              {/* Save Bar + Editable Multi-Athlete Goal Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-[#0B1520]">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#09121B] border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-bold text-slate-800 dark:text-white tabular-nums">
                    Individual Athlete Goals ({students.length})
                    {modifiedGoalStudents.length > 0 && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">
                        · {modifiedGoalStudents.length} unsaved
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {modifiedGoalStudents.length > 0 && (
                      <button
                        type="button"
                        disabled={isMutating}
                        onClick={() => syncGoalDraftsFromStudents(students)}
                        className="px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Discard Changes
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isMutating || modifiedGoalStudents.length === 0}
                      onClick={handleSaveAllGoalChanges}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-45 whitespace-nowrap"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>
                        {isMutating
                          ? 'Saving Goals...'
                          : `Save Goal Changes (${modifiedGoalStudents.length})`}
                      </span>
                    </button>
                  </div>
                </div>

                {students.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No athletes on your roster yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/70 dark:bg-[#09121B]/70 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 pl-3 pr-2 w-8">
                            <input
                              type="checkbox"
                              checked={
                                students.length > 0 &&
                                selectedGoalStudentIds.size === students.length
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedGoalStudentIds(new Set(students.map((s) => s.id)));
                                } else {
                                  setSelectedGoalStudentIds(new Set());
                                }
                              }}
                              aria-label="Select all athletes"
                              className="rounded border-slate-300 text-[#0593C6]"
                            />
                          </th>
                          <th className="py-2.5 px-2.5 font-semibold whitespace-nowrap">Athlete</th>
                          <th className="py-2.5 px-2 font-semibold whitespace-nowrap">Goal Race</th>
                          <th className="py-2.5 px-2 font-semibold whitespace-nowrap">Target Time</th>
                          <th className="py-2.5 px-2 font-semibold whitespace-nowrap">Runs/Wk</th>
                          <th className="py-2.5 px-2 font-semibold whitespace-nowrap">Weekly km</th>
                          <th className="py-2.5 px-2 font-semibold whitespace-nowrap">Race Date</th>
                          <th className="py-2.5 px-2 font-semibold whitespace-nowrap">Division</th>
                          <th className="py-2.5 px-2.5 font-semibold whitespace-nowrap">Coach Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
                        {students.map((s) => {
                          const d = goalDrafts[s.id] || buildGoalDraftRow(s);
                          const dirty = isGoalRowModified(s);
                          return (
                            <tr
                              key={s.id}
                              className={
                                dirty
                                  ? 'bg-amber-500/5 dark:bg-amber-500/10'
                                  : 'hover:bg-slate-50/70 dark:hover:bg-[#09121B]/50'
                              }
                            >
                              <td className="py-2 pl-3 pr-2">
                                <input
                                  type="checkbox"
                                  checked={selectedGoalStudentIds.has(s.id)}
                                  onChange={() => {
                                    setSelectedGoalStudentIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(s.id)) next.delete(s.id);
                                      else next.add(s.id);
                                      return next;
                                    });
                                  }}
                                  aria-label={`Select ${s.displayName}`}
                                  className="rounded border-slate-300 text-[#0593C6]"
                                />
                              </td>
                              <td className="py-2 px-2.5 whitespace-nowrap">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {s.displayName || 'Unnamed Athlete'}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {s.accountStatus === 'suspended' ? 'Suspended' : s.athleteLevel || 'XC'}
                                  {dirty && (
                                    <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                                      · Modified
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-2">
                                <select
                                  value={d.targetDistanceKm}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const found = TARGET_DISTANCE_OPTIONS.find(
                                      (o) => o.km.toString() === val
                                    );
                                    updateGoalDraftField(s.id, {
                                      targetDistanceKm: val,
                                      targetGoalName: found ? found.label : `${val}K Race`,
                                    });
                                  }}
                                  className="px-2 py-1 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                                >
                                  {TARGET_DISTANCE_OPTIONS.map((opt) => (
                                    <option key={opt.label} value={opt.km.toString()}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  value={d.targetTimeStr}
                                  onChange={(e) =>
                                    updateGoalDraftField(s.id, { targetTimeStr: e.target.value })
                                  }
                                  placeholder="21:00"
                                  className="w-20 px-2 py-1 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={14}
                                  value={d.weeklyRunGoal}
                                  onChange={(e) =>
                                    updateGoalDraftField(s.id, { weeklyRunGoal: e.target.value })
                                  }
                                  className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.5"
                                  min={0}
                                  max={500}
                                  value={d.weeklyDistKm}
                                  onChange={(e) =>
                                    updateGoalDraftField(s.id, { weeklyDistKm: e.target.value })
                                  }
                                  placeholder="—"
                                  className="w-18 px-2 py-1 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="date"
                                  value={d.targetGoalDate}
                                  onChange={(e) =>
                                    updateGoalDraftField(s.id, { targetGoalDate: e.target.value })
                                  }
                                  className="px-2 py-1 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <select
                                  value={d.yraaDivision}
                                  onChange={(e) =>
                                    updateGoalDraftField(s.id, {
                                      yraaDivision: e.target.value as YraaDivisionId,
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                                >
                                  {YRAA_DIVISION_LIST.map((div) => (
                                    <option key={div.id} value={div.id}>
                                      {div.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-2.5">
                                <input
                                  type="text"
                                  value={d.coachNotes}
                                  onChange={(e) =>
                                    updateGoalDraftField(s.id, { coachNotes: e.target.value })
                                  }
                                  maxLength={1000}
                                  placeholder="Optional coach note"
                                  className="w-40 px-2 py-1 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TEAM MONITORING & LEADERBOARD */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              {/* Side-by-Side Consistency Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#09121B] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-white">
                  <span>Team Weekly Adherence &amp; Progress</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Click an athlete to manage
                  </span>
                </div>
                {enrichedStudents.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No athletes on your roster yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/60 dark:bg-[#09121B]/60 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3.5 font-semibold">Athlete</th>
                          <th className="py-2.5 px-3 font-semibold text-right">This Week</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Wk Volume</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Total Runs</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Total Vol</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Best Est.</th>
                          <th className="py-2.5 px-3.5 font-semibold text-right">Last Run</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80 tabular-nums">
                        {enrichedStudents.map((s) => (
                          <tr
                            key={s.userId}
                            onClick={() => {
                              setSelectedStudentId(s.userId);
                              setActiveTab('roster');
                            }}
                            className="hover:bg-slate-50 dark:hover:bg-[#09121B] cursor-pointer transition-colors"
                          >
                            <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">
                              <div>{s.displayName}</div>
                              <div className="text-[11px] font-normal text-slate-500">
                                {s.accountStatus === 'suspended' ? 'Suspended' : s.email}
                              </div>
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-bold ${
                                s.currentWeekGoalMet
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {s.currentWeekRuns}/{s.profile.weeklyRunGoal || 3}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {s.currentWeekDistanceKm.toFixed(1)} km
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{s.runs.length}</td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {s.totalDistanceKm.toFixed(1)} km
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[#0593C6] font-semibold">
                              {s.bestTargetSec ? formatDuration(s.bestTargetSec) : '--:--'}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono text-slate-500">
                              {s.lastRunDate || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Team Workouts Feed */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={runsSearch}
                      onChange={(e) => setRunsSearch(e.target.value)}
                      placeholder="Filter team workouts by athlete name, title, or notes..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <select
                    value={runsTypeFilter}
                    onChange={(e) => setRunsTypeFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <option value="all">All Run Types</option>
                    {RUN_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {filteredTeamRuns.length === 0 ? (
                  <div className="p-8 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                    No team workouts found.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[340px] overflow-y-auto">
                    {filteredTeamRuns.map((run) => {
                      const owner = studentLookupMap.get(run.userId);
                      return (
                        <div
                          key={run.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white truncate">
                                {run.title}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                · {owner?.displayName || 'Athlete'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                              {run.date} · {run.runType} · {run.source}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {run.distanceKm.toFixed(2)} km
                            </span>
                            <span>{formatDuration(run.durationSeconds)}</span>
                            <span className="text-[#0593C6] font-semibold">
                              {formatPace(run.averagePaceSecPerKm, 'km')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: INVITE LINK & TEAM BROADCAST */}
          {activeTab === 'team' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Invite Link & Team Settings */}
              <form
                onSubmit={handleSaveTeamSettings}
                className="p-4 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 space-y-3.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    Student Invite Link &amp; Team Settings
                  </div>
                  <span
                    className={`text-[11px] font-bold ${
                      draftInviteActive
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {draftInviteActive ? 'Accepting Students' : 'Link Paused'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500">
                    Shareable Student Invite URL
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 truncate px-2.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                      {inviteUrl}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyInviteLink}
                      className="px-3 py-2 rounded-lg bg-[#0593C6] hover:bg-[#047ea8] text-white font-bold shrink-0 cursor-pointer"
                    >
                      {copiedLink ? 'Copied' : 'Copy Link'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                    <span>
                      Or have athletes enter Team Code:{' '}
                      <strong className="font-mono text-slate-900 dark:text-white">
                        {teacher.inviteCode}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyInviteCode}
                      className="font-semibold text-[#0593C6] hover:underline cursor-pointer"
                    >
                      {copiedCode ? 'Copied' : 'Copy Code'}
                    </button>
                  </div>
                </div>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">Team Name</span>
                  <input
                    type="text"
                    value={draftTeamName}
                    onChange={(e) => setDraftTeamName(e.target.value)}
                    maxLength={120}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Coach / Teacher Display Name
                  </span>
                  <input
                    type="text"
                    value={draftCoachName}
                    onChange={(e) => setDraftCoachName(e.target.value)}
                    maxLength={128}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </label>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={draftInviteActive}
                    onChange={(e) => setDraftInviteActive(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Allow new students to join via this link &amp; code
                  </span>
                </label>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isMutating}
                    className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isMutating ? 'Saving...' : 'Save Team Settings'}
                  </button>
                </div>
              </form>

              {/* Live Team Broadcast */}
              <form
                onSubmit={(e) => handleSaveTeamAnnouncement(e, false)}
                className="p-4 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 space-y-3.5 text-xs"
              >
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    Team Broadcast Banner
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Display a live practice schedule or team update across all your students&apos; dashboards.
                  </p>
                </div>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">Tone</span>
                  <select
                    value={annSeverity}
                    onChange={(e) =>
                      setAnnSeverity(e.target.value as 'info' | 'warning' | 'success')
                    }
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="info">Practice Info (Blue)</option>
                    <option value="success">Meet / Shoutout (Green)</option>
                    <option value="warning">Schedule Change / Alert (Amber)</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">Title</span>
                  <input
                    type="text"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    maxLength={120}
                    placeholder="e.g. Thursday Meet Bus Departs 2:15 PM"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">Message</span>
                  <textarea
                    rows={3}
                    value={annMessage}
                    onChange={(e) => setAnnMessage(e.target.value)}
                    maxLength={500}
                    placeholder="Write details for your team..."
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  {teamInvite?.teamAnnouncementMessage || teamInvite?.teamAnnouncementTitle ? (
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={(e) => handleSaveTeamAnnouncement(e, true)}
                      className="px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-semibold cursor-pointer"
                    >
                      Clear Broadcast
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    type="submit"
                    disabled={isMutating || (!annTitle.trim() && !annMessage.trim())}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isMutating ? 'Publishing...' : 'Publish to Team'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
