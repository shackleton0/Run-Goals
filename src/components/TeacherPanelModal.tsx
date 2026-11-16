import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TeacherRecord,
  TeamInvite,
  UserProfile,
  RunRecord,
  RunType,
} from '../types/running';
import {
  fetchTeamDataForTeacher,
  teacherUpdateStudentProfile,
  teacherSendStudentMessage,
  teacherClearStudentMessage,
  teacherSaveRunForStudent,
  teacherDeleteSingleRun,
  teacherClearStudentRuns,
  teacherRemoveStudentFromTeam,
  teacherUpdateTeamSettings,
  teacherSaveTeamAnnouncement,
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
  onBackToAdmin?: () => void;
}

type TeacherTab = 'roster' | 'activity' | 'team';
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

export const TeacherPanelModal: React.FC<TeacherPanelModalProps> = ({
  isOpen,
  onClose,
  teacher,
  onTeacherUpdated,
  previewMode = false,
  previewStudents,
  previewRuns,
  previewInvite,
  onBackToAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<TeacherTab>('roster');
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [teamRuns, setTeamRuns] = useState<RunRecord[]>([]);
  const [teamInvite, setTeamInvite] = useState<TeamInvite | null>(null);
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

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?join=${teacher.inviteCode}`
      : `?join=${teacher.inviteCode}`;

  const loadTeamData = useCallback(async () => {
    setFeedback(null);
    if (previewMode) {
      const st = previewStudents ? previewStudents.map((s) => ({ ...s })) : [];
      const runs = previewRuns ? previewRuns.map((r) => ({ ...r })) : [];
      const invite = previewInvite ? { ...previewInvite } : null;
      setStudents(st);
      setTeamRuns(runs);
      setTeamInvite(invite);
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
      const { students: st, runs, invite } = await fetchTeamDataForTeacher(teacher);
      setStudents(st);
      setTeamRuns(runs);
      setTeamInvite(invite);
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
  }, [teacher, previewMode, previewStudents, previewRuns, previewInvite]);

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
                  { id: 'activity', label: 'Team Monitoring & Leaderboard', icon: Activity },
                  { id: 'team', label: 'Invite Link & Team Broadcast', icon: Megaphone },
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
