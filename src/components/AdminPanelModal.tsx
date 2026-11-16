import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  AdminConfigRecord,
  isAuthorizedAdmin,
  getAdminConfig,
  saveAdminPasscode,
  verifyAdminPasscode,
  fetchAllAdminData,
  fetchAdminLogs,
  clearAdminLogs,
  adminDeleteUserAccount,
  adminDeleteUserRuns,
  adminUpdateUserProfile,
  adminSaveRunForUser,
  adminDeleteSingleRun,
  adminPurgeOrphanRuns,
  adminSendUserMessage,
  adminClearUserMessage,
  getAppAnnouncement,
  saveAppAnnouncement,
} from '../lib/firebase';
import {
  RunRecord,
  RunType,
  UserProfile,
  AppAnnouncement,
  AdminAuditLog,
} from '../types/running';
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
  KM_TO_MILES,
} from '../utils/runningCalculations';
import {
  X,
  Shield,
  Lock,
  Unlock,
  Delete,
  RefreshCw,
  Search,
  Users,
  Activity,
  Route,
  Calendar,
  Download,
  KeyRound,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Heart,
  Trash2,
  UserCog,
  Ban,
  RotateCcw,
  Plus,
  Pencil,
  Megaphone,
  History,
  Copy,
  Check,
  AlertTriangle,
  Sparkles,
  MessageSquare,
} from 'lucide-react';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  isUnlocked: boolean;
  onUnlockChange: (unlocked: boolean) => void;
}

type PadMode =
  | 'checking'
  | 'setup_first'
  | 'setup_confirm'
  | 'verify'
  | 'change_new'
  | 'change_confirm';

type AdminTab = 'users' | 'runs' | 'announcements' | 'audit';
type UserFilter = 'all' | 'active' | 'suspended' | 'pending_setup' | 'orphaned';
type UserActionPanel = 'none' | 'message_user' | 'edit_profile' | 'suspend' | 'delete_user' | 'clear_runs' | 'add_run';

interface EnrichedUserSummary {
  userId: string;
  profile?: UserProfile;
  isOrphaned: boolean;
  displayName: string;
  email: string;
  accountStatus: 'active' | 'suspended';
  runs: RunRecord[];
  totalDistanceKm: number;
  totalDurationSeconds: number;
  avgPaceSecPerKm: number;
  bestTargetSec?: number;
  lastRunDate: string | null;
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

const AUDIT_ACTION_LABELS: Record<AdminAuditLog['action'], string> = {
  delete_user: 'Deleted User',
  suspend_user: 'Suspended User',
  restore_user: 'Restored User',
  edit_user: 'Edited Profile',
  reset_user_runs: 'Cleared Runs',
  reset_onboarding: 'Reset Setup',
  add_run: 'Logged Run',
  edit_run: 'Edited Run',
  delete_run: 'Deleted Run',
  purge_orphan_runs: 'Purged Orphans',
  update_announcement: 'Announcement',
  send_user_message: 'Messaged User',
  clear_user_message: 'Cleared Message',
  change_pin: 'Changed PIN',
};

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  user,
  isUnlocked,
  onUnlockChange,
}) => {
  const [adminConfig, setAdminConfig] = useState<AdminConfigRecord | null>(null);
  const [padMode, setPadMode] = useState<PadMode>('checking');
  const [pinInput, setPinInput] = useState<string>('');
  const [pendingFirstPin, setPendingFirstPin] = useState<string>('');
  const [padError, setPadError] = useState<string | null>(null);
  const [padStatus, setPadStatus] = useState<string | null>(null);
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  // Navigation & Explorer State
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allRuns, setAllRuns] = useState<RunRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // User Directory Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState<UserFilter>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'runs' | 'distance' | 'name'>('recent');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  // Selected User Action Panel State
  const [userActionPanel, setUserActionPanel] = useState<UserActionPanel>('none');
  const [deleteTypedConfirm, setDeleteTypedConfirm] = useState('');
  const [suspendReasonInput, setSuspendReasonInput] = useState('');
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgSeverity, setMsgSeverity] = useState<'info' | 'warning' | 'success'>('info');

  // Edit User Profile Draft
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editAthleteLevel, setEditAthleteLevel] =
    useState<NonNullable<UserProfile['athleteLevel']>>('High School XC');
  const [editUnitPref, setEditUnitPref] = useState<'km' | 'miles'>('km');
  const [editTargetDistKm, setEditTargetDistKm] = useState<string>('6');
  const [editTargetGoalName, setEditTargetGoalName] = useState<string>('6K Race');
  const [editTargetTimeStr, setEditTargetTimeStr] = useState<string>('');
  const [editWeeklyRunGoal, setEditWeeklyRunGoal] = useState<string>('3');
  const [editWeeklyDistKm, setEditWeeklyDistKm] = useState<string>('');
  const [editTargetGoalDate, setEditTargetGoalDate] = useState<string>('');
  const [editYraaDivision, setEditYraaDivision] = useState<YraaDivisionId>('senior_men');
  const [editMaxHr, setEditMaxHr] = useState<string>('');
  const [editOnboardingDone, setEditOnboardingDone] = useState<boolean>(true);
  const [editAdminNotes, setEditAdminNotes] = useState<string>('');

  // Add / Edit Run Draft
  const [newRunTitle, setNewRunTitle] = useState('');
  const [newRunDate, setNewRunDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newRunType, setNewRunType] = useState<RunType>('Tempo');
  const [newRunDistKm, setNewRunDistKm] = useState('5.0');
  const [newRunDurationStr, setNewRunDurationStr] = useState('22:30');
  const [newRunAvgHr, setNewRunAvgHr] = useState('');
  const [newRunNotes, setNewRunNotes] = useState('');

  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [editRunTitle, setEditRunTitle] = useState('');
  const [editRunDate, setEditRunDate] = useState('');
  const [editRunType, setEditRunType] = useState<RunType>('Aerobic');
  const [editRunDistKm, setEditRunDistKm] = useState('');
  const [editRunDurationStr, setEditRunDurationStr] = useState('');
  const [editRunNotes, setEditRunNotes] = useState('');
  const [confirmDeleteRunId, setConfirmDeleteRunId] = useState<string | null>(null);

  // Global Runs Tab Filters
  const [runsSearchQuery, setRunsSearchQuery] = useState('');
  const [runsTypeFilter, setRunsTypeFilter] = useState<string>('all');
  const [runsSourceFilter, setRunsSourceFilter] = useState<'all' | 'garmin' | 'apple' | 'manual'>('all');

  // Global Announcement Tab State
  const [annEnabled, setAnnEnabled] = useState(false);
  const [annSeverity, setAnnSeverity] = useState<'info' | 'warning' | 'success'>('info');
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annLastUpdated, setAnnLastUpdated] = useState<string | null>(null);
  const [isLoadingAnn, setIsLoadingAnn] = useState(false);

  const authorized = isAuthorizedAdmin(user);

  const loadAllData = useCallback(async () => {
    if (!authorized) return;
    setIsLoadingData(true);
    setDataError(null);
    try {
      const { users, runs } = await fetchAllAdminData();
      setAllUsers(users);
      setAllRuns(runs);
    } catch (err) {
      setDataError(
        err instanceof Error ? err.message : 'Unable to load cross-user Firestore records.'
      );
    } finally {
      setIsLoadingData(false);
    }
  }, [authorized]);

  const loadAuditLogs = useCallback(async () => {
    if (!authorized) return;
    setIsLoadingLogs(true);
    try {
      const logs = await fetchAdminLogs();
      setAuditLogs(logs);
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not load audit logs.',
      });
    } finally {
      setIsLoadingLogs(false);
    }
  }, [authorized]);

  const loadAnnouncement = useCallback(async () => {
    if (!authorized) return;
    setIsLoadingAnn(true);
    try {
      const existing = await getAppAnnouncement();
      if (existing) {
        setAnnEnabled(existing.enabled);
        setAnnSeverity(existing.severity);
        setAnnTitle(existing.title);
        setAnnMessage(existing.message);
        setAnnLastUpdated(existing.updatedAt);
      }
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not load global announcement.',
      });
    } finally {
      setIsLoadingAnn(false);
    }
  }, [authorized]);

  // Check admin passcode configuration on open
  useEffect(() => {
    if (!isOpen || !authorized) return;
    setPinInput('');
    setPendingFirstPin('');
    setPadError(null);
    setPadStatus(null);
    setActionFeedback(null);
    setUserActionPanel('none');
    setDeleteTypedConfirm('');
    setConfirmDeleteRunId(null);
    setEditingRunId(null);

    if (isUnlocked) {
      setPadMode('verify');
      loadAllData();
      loadAnnouncement();
      loadAuditLogs();
      return;
    }

    let cancelled = false;
    setPadMode('checking');
    getAdminConfig(user)
      .then((cfg) => {
        if (cancelled) return;
        setAdminConfig(cfg);
        setPadMode(cfg ? 'verify' : 'setup_first');
      })
      .catch((err) => {
        if (cancelled) return;
        setPadError(err instanceof Error ? err.message : 'Could not verify admin passcode status.');
        setPadMode('verify');
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, authorized, user, isUnlocked, loadAllData, loadAnnouncement, loadAuditLogs]);

  // Countdown tick during wrong-PIN lockout
  useEffect(() => {
    if (!lockoutUntil) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      if (now >= lockoutUntil) {
        setLockoutUntil(null);
        setFailedAttempts(0);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [lockoutUntil]);

  const remainingLockSeconds = lockoutUntil
    ? Math.max(0, Math.ceil((lockoutUntil - nowTick) / 1000))
    : 0;

  const submitPin = useCallback(
    async (enteredPin: string) => {
      if (!authorized || isSubmittingPin) return;
      if (lockoutUntil && Date.now() < lockoutUntil) return;

      const cleaned = enteredPin.replace(/\D/g, '');

      if (padMode === 'setup_first' || padMode === 'change_new') {
        if (cleaned.length < 4 || cleaned.length > 8) {
          setPadError('Choose a 4 to 8 digit numeric passcode.');
          return;
        }
        setPendingFirstPin(cleaned);
        setPinInput('');
        setPadError(null);
        setPadMode(padMode === 'setup_first' ? 'setup_confirm' : 'change_confirm');
        return;
      }

      if (padMode === 'setup_confirm' || padMode === 'change_confirm') {
        if (cleaned !== pendingFirstPin) {
          setPadError('Passcodes did not match. Enter it again to confirm.');
          setPinInput('');
          return;
        }
        setIsSubmittingPin(true);
        setPadError(null);
        try {
          const saved = await saveAdminPasscode(user, cleaned);
          setAdminConfig(saved);
          setPinInput('');
          setPendingFirstPin('');
          setPadStatus('Admin passcode saved.');
          setPadMode('verify');
          onUnlockChange(true);
          loadAllData();
          loadAnnouncement();
          loadAuditLogs();
        } catch (err) {
          setPadError(err instanceof Error ? err.message : 'Failed to save admin passcode.');
        } finally {
          setIsSubmittingPin(false);
        }
        return;
      }

      if (padMode === 'verify') {
        if (!adminConfig) {
          setPadError('No admin passcode configured yet.');
          return;
        }
        if (cleaned.length < 4) {
          setPadError('Enter your passcode.');
          return;
        }
        setIsSubmittingPin(true);
        setPadError(null);
        try {
          const ok = await verifyAdminPasscode(cleaned, adminConfig);
          if (ok) {
            setPinInput('');
            setFailedAttempts(0);
            onUnlockChange(true);
            loadAllData();
            loadAnnouncement();
            loadAuditLogs();
          } else {
            const nextFails = failedAttempts + 1;
            setFailedAttempts(nextFails);
            setPinInput('');
            if (nextFails >= 5) {
              const until = Date.now() + 30000;
              setLockoutUntil(until);
              setNowTick(Date.now());
              setPadError('Too many wrong attempts. Wait 30 seconds before trying again.');
            } else {
              setPadError(`Incorrect passcode (${5 - nextFails} attempts left).`);
            }
          }
        } catch (err) {
          setPadError(err instanceof Error ? err.message : 'Verification failed.');
        } finally {
          setIsSubmittingPin(false);
        }
      }
    },
    [
      authorized,
      isSubmittingPin,
      lockoutUntil,
      padMode,
      pendingFirstPin,
      user,
      onUnlockChange,
      loadAllData,
      loadAnnouncement,
      loadAuditLogs,
      adminConfig,
      failedAttempts,
    ]
  );

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (isSubmittingPin || remainingLockSeconds > 0 || padMode === 'checking') return;
      setPadError(null);
      setPinInput((prev) => {
        if (prev.length >= 8) return prev;
        const next = prev + digit;
        if (padMode === 'verify' && adminConfig?.pinLength && next.length === adminConfig.pinLength) {
          window.setTimeout(() => submitPin(next), 60);
        }
        return next;
      });
    },
    [isSubmittingPin, remainingLockSeconds, padMode, adminConfig?.pinLength, submitPin]
  );

  const handleBackspace = useCallback(() => {
    if (isSubmittingPin || remainingLockSeconds > 0) return;
    setPadError(null);
    setPinInput((prev) => prev.slice(0, -1));
  }, [isSubmittingPin, remainingLockSeconds]);

  const handleClearPin = useCallback(() => {
    if (isSubmittingPin) return;
    setPadError(null);
    setPinInput('');
  }, [isSubmittingPin]);

  useEffect(() => {
    if (!isOpen || !authorized || (isUnlocked && padMode !== 'change_new' && padMode !== 'change_confirm')) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submitPin(pinInput);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isOpen,
    authorized,
    isUnlocked,
    padMode,
    handleDigitPress,
    handleBackspace,
    submitPin,
    pinInput,
    onClose,
  ]);

  // Aggregate users + runs cleanly
  const enrichedUsers = useMemo<EnrichedUserSummary[]>(() => {
    const profileMap = new Map<string, UserProfile>();
    allUsers.forEach((p) => {
      if (p.id) profileMap.set(p.id, p);
    });

    const runsByUser = new Map<string, RunRecord[]>();
    allRuns.forEach((r) => {
      const uid = r.userId || 'unknown';
      const arr = runsByUser.get(uid) || [];
      arr.push(r);
      runsByUser.set(uid, arr);
    });

    const allIds = new Set<string>([...profileMap.keys(), ...runsByUser.keys()]);
    const list: EnrichedUserSummary[] = [];

    allIds.forEach((uid) => {
      const prof = profileMap.get(uid);
      const userRuns = [...(runsByUser.get(uid) || [])].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const totalDistanceKm = userRuns.reduce((sum, r) => sum + (r.distanceKm || 0), 0);
      const totalDurationSeconds = userRuns.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);
      const avgPaceSecPerKm =
        totalDistanceKm > 0 && totalDurationSeconds > 0
          ? totalDurationSeconds / totalDistanceKm
          : 0;
      const targetDist = prof?.targetDistanceKm || 6.0;
      const bestTargetSec = selectBestTargetEquivalent(userRuns, targetDist).bestSeconds;
      const lastRunDate = userRuns.length > 0 ? userRuns[0].date : null;

      list.push({
        userId: uid,
        profile: prof,
        isOrphaned: !prof,
        displayName: prof?.displayName?.trim() || (prof ? 'Unnamed Runner' : 'Orphaned Account'),
        email: prof?.email || 'No profile document',
        accountStatus: prof?.accountStatus === 'suspended' ? 'suspended' : 'active',
        runs: userRuns,
        totalDistanceKm,
        totalDurationSeconds,
        avgPaceSecPerKm,
        bestTargetSec,
        lastRunDate,
      });
    });

    return list;
  }, [allUsers, allRuns]);

  const orphanRunIds = useMemo(() => {
    const profileIds = new Set(allUsers.map((u) => u.id));
    return allRuns.filter((r) => !profileIds.has(r.userId)).map((r) => r.id);
  }, [allUsers, allRuns]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = enrichedUsers.filter((u) => {
      if (userFilter === 'active' && (u.isOrphaned || u.accountStatus === 'suspended')) return false;
      if (userFilter === 'suspended' && u.accountStatus !== 'suspended') return false;
      if (userFilter === 'pending_setup' && (u.isOrphaned || u.profile?.onboardingCompleted)) return false;
      if (userFilter === 'orphaned' && !u.isOrphaned) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'runs') return b.runs.length - a.runs.length;
      if (sortBy === 'distance') return b.totalDistanceKm - a.totalDistanceKm;
      if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
      const aDate = a.lastRunDate || a.profile?.updatedAt || a.profile?.createdAt || '';
      const bDate = b.lastRunDate || b.profile?.updatedAt || b.profile?.createdAt || '';
      return bDate.localeCompare(aDate);
    });
  }, [enrichedUsers, searchQuery, userFilter, sortBy]);

  useEffect(() => {
    if (filteredUsers.length === 0) {
      setSelectedUserId(null);
      return;
    }
    if (!selectedUserId || !filteredUsers.some((u) => u.userId === selectedUserId)) {
      setSelectedUserId(filteredUsers[0].userId);
    }
  }, [filteredUsers, selectedUserId]);

  const selectedUser =
    filteredUsers.find((u) => u.userId === selectedUserId) || filteredUsers[0] || null;

  // Reset inline drawers when switching user
  useEffect(() => {
    setUserActionPanel('none');
    setDeleteTypedConfirm('');
    setSuspendReasonInput('');
    setConfirmDeleteRunId(null);
    setEditingRunId(null);
    setCopiedUid(false);
  }, [selectedUser?.userId]);

  const summaryStats = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 86400 * 1000;
    const activeLast7d = enrichedUsers.filter(
      (u) => !u.isOrphaned && u.lastRunDate && new Date(u.lastRunDate).getTime() >= sevenDaysAgo
    ).length;
    const suspendedCount = enrichedUsers.filter((u) => u.accountStatus === 'suspended').length;
    const totalKm = allRuns.reduce((sum, r) => sum + (r.distanceKm || 0), 0);
    return {
      totalUsers: allUsers.length,
      suspendedCount,
      totalRuns: allRuns.length,
      totalKm,
      activeLast7d,
    };
  }, [enrichedUsers, allUsers.length, allRuns]);

  const userLookupMap = useMemo(() => {
    const map = new Map<string, EnrichedUserSummary>();
    enrichedUsers.forEach((u) => map.set(u.userId, u));
    return map;
  }, [enrichedUsers]);

  const globalFilteredRuns = useMemo(() => {
    const q = runsSearchQuery.trim().toLowerCase();
    return [...allRuns]
      .filter((r) => {
        if (runsTypeFilter !== 'all' && r.runType !== runsTypeFilter) return false;
        if (runsSourceFilter === 'garmin' && !r.source.includes('garmin')) return false;
        if (runsSourceFilter === 'apple' && !r.source.includes('apple')) return false;
        if (runsSourceFilter === 'manual' && r.source !== 'manual') return false;
        if (!q) return true;
        const owner = userLookupMap.get(r.userId);
        return (
          r.title.toLowerCase().includes(q) ||
          (r.notes || '').toLowerCase().includes(q) ||
          (owner?.displayName || '').toLowerCase().includes(q) ||
          (owner?.email || '').toLowerCase().includes(q) ||
          r.userId.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allRuns, runsSearchQuery, runsTypeFilter, runsSourceFilter, userLookupMap]);

  // Populate Edit Profile Draft
  const openEditProfilePanel = (u: EnrichedUserSummary) => {
    if (!u.profile) return;
    setEditDisplayName(u.profile.displayName || '');
    setEditAthleteLevel(u.profile.athleteLevel || 'High School XC');
    setEditUnitPref(u.profile.unitPreference || 'km');
    setEditTargetDistKm((u.profile.targetDistanceKm || 6).toString());
    setEditTargetGoalName(u.profile.targetGoalName || `${u.profile.targetDistanceKm || 6}K Race`);
    setEditTargetTimeStr(
      u.profile.target6kTimeSeconds ? formatDuration(u.profile.target6kTimeSeconds) : ''
    );
    setEditWeeklyRunGoal((u.profile.weeklyRunGoal || 3).toString());
    setEditWeeklyDistKm(
      u.profile.weeklyDistanceGoalKm ? u.profile.weeklyDistanceGoalKm.toString() : ''
    );
    setEditTargetGoalDate(u.profile.targetGoalDate || '');
    setEditYraaDivision(u.profile.yraaDivision || 'senior_men');
    setEditMaxHr(u.profile.maxHeartRate ? u.profile.maxHeartRate.toString() : '');
    setEditOnboardingDone(Boolean(u.profile.onboardingCompleted));
    setEditAdminNotes(u.profile.adminNotes || '');
    setUserActionPanel((prev) => (prev === 'edit_profile' ? 'none' : 'edit_profile'));
  };

  const openMessageUserPanel = (u: EnrichedUserSummary) => {
    if (!u.profile) return;
    setMsgTitle(u.profile.directMessageTitle || '');
    setMsgBody(u.profile.directMessageBody || '');
    setMsgSeverity(u.profile.directMessageSeverity || 'info');
    setUserActionPanel((prev) => (prev === 'message_user' ? 'none' : 'message_user'));
  };

  const handleSendUserMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser?.profile || isMutating) return;
    if (!msgBody.trim()) {
      setActionFeedback({
        type: 'error',
        message: 'Enter a message before sending.',
      });
      return;
    }

    setIsMutating(true);
    setActionFeedback(null);
    try {
      const saved = await adminSendUserMessage(user, selectedUser.profile, {
        title: msgTitle,
        body: msgBody,
        severity: msgSeverity,
      });
      setAllUsers((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setUserActionPanel('none');
      setActionFeedback({
        type: 'success',
        message: `Direct message delivered to ${selectedUser.displayName}.`,
      });
      loadAuditLogs();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to send message.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleClearUserMessage = async () => {
    if (!selectedUser?.profile || isMutating) return;
    setIsMutating(true);
    setActionFeedback(null);
    try {
      const saved = await adminClearUserMessage(user, selectedUser.profile);
      setAllUsers((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setMsgTitle('');
      setMsgBody('');
      setMsgSeverity('info');
      setUserActionPanel('none');
      setActionFeedback({
        type: 'success',
        message: `Cleared direct message for ${selectedUser.displayName}.`,
      });
      loadAuditLogs();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to clear message.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveEditedProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser?.profile || isMutating) return;

    const distKm = Math.min(100, Math.max(0.1, parseFloat(editTargetDistKm) || 6));
    const parsedTime = editTargetTimeStr.trim() ? parseDuration(editTargetTimeStr) : undefined;
    const weeklyRuns = Math.min(14, Math.max(1, parseInt(editWeeklyRunGoal, 10) || 3));
    const weeklyDist = editWeeklyDistKm.trim() ? parseFloat(editWeeklyDistKm) : undefined;
    const maxHr = editMaxHr.trim() ? parseInt(editMaxHr, 10) : undefined;

    const updatedProfile: UserProfile = {
      ...selectedUser.profile,
      displayName: editDisplayName.trim() || 'Runner',
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
      adminNotes: editAdminNotes.trim() || undefined,
    };

    setIsMutating(true);
    setActionFeedback(null);
    try {
      const saved = await adminUpdateUserProfile(
        user,
        updatedProfile,
        'edit_user',
        `Updated profile & goals for ${updatedProfile.displayName} (${updatedProfile.targetGoalName}, ${updatedProfile.weeklyRunGoal} runs/wk).`
      );
      setAllUsers((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setUserActionPanel('none');
      setActionFeedback({
        type: 'success',
        message: `Saved profile updates for ${saved.displayName}.`,
      });
      loadAuditLogs();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save user profile.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleToggleSuspendUser = async () => {
    if (!selectedUser?.profile || isMutating) return;
    if (selectedUser.userId === user.uid) {
      setActionFeedback({
        type: 'error',
        message: 'You cannot suspend your own active admin account.',
      });
      return;
    }

    const currentlySuspended = selectedUser.accountStatus === 'suspended';
    const nextStatus = currentlySuspended ? 'active' : 'suspended';
    const reason = currentlySuspended ? undefined : suspendReasonInput.trim() || undefined;

    const updatedProfile: UserProfile = {
      ...selectedUser.profile,
      accountStatus: nextStatus,
      suspensionReason: reason,
    };

    setIsMutating(true);
    setActionFeedback(null);
    try {
      const saved = await adminUpdateUserProfile(
        user,
        updatedProfile,
        currentlySuspended ? 'restore_user' : 'suspend_user',
        currentlySuspended
          ? `Restored active access for ${selectedUser.displayName}.`
          : `Suspended ${selectedUser.displayName}${reason ? ` (Reason: ${reason})` : ''}.`
      );
      setAllUsers((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setUserActionPanel('none');
      setSuspendReasonInput('');
      setActionFeedback({
        type: 'success',
        message: currentlySuspended
          ? `${selectedUser.displayName} has been restored.`
          : `${selectedUser.displayName} has been suspended.`,
      });
      loadAuditLogs();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update account status.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleResetOnboarding = async (u: EnrichedUserSummary) => {
    if (!u.profile || isMutating) return;
    setIsMutating(true);
    setActionFeedback(null);
    try {
      const saved = await adminUpdateUserProfile(
        user,
        { ...u.profile, onboardingCompleted: false },
        'reset_onboarding',
        `Reset onboarding wizard status for ${u.displayName}.`
      );
      setAllUsers((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setActionFeedback({
        type: 'success',
        message: `Onboarding setup reset for ${u.displayName}. They will see the setup flow next session.`,
      });
      loadAuditLogs();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to reset onboarding.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleClearUserRuns = async () => {
    if (!selectedUser || isMutating) return;
    setIsMutating(true);
    setActionFeedback(null);
    try {
      const count = await adminDeleteUserRuns(
        user,
        selectedUser.userId,
        `${selectedUser.displayName} (${selectedUser.email})`
      );
      setAllRuns((prev) => prev.filter((r) => r.userId !== selectedUser.userId));
      setUserActionPanel('none');
      setActionFeedback({
        type: 'success',
        message: `Cleared ${count} workout${count === 1 ? '' : 's'} for ${selectedUser.displayName}.`,
      });
      loadAuditLogs();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to clear user workouts.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteUserAccount = async () => {
    if (!selectedUser || isMutating) return;
    if (selectedUser.userId === user.uid) {
      setActionFeedback({
        type: 'error',
        message: 'Cannot delete the currently signed-in admin account from the Admin Console.',
      });
      return;
    }
    if (deleteTypedConfirm.trim().toUpperCase() !== 'DELETE') return;

    setIsMutating(true);
    setActionFeedback(null);
    try {
      const targetId = selectedUser.userId;
      const targetName = selectedUser.displayName;
      const { deletedRunsCount } = await adminDeleteUserAccount(
        user,
        targetId,
        `${selectedUser.displayName} (${selectedUser.email})`
      );
      setAllUsers((prev) => prev.filter((p) => p.id !== targetId));
      setAllRuns((prev) => prev.filter((r) => r.userId !== targetId));
      setUserActionPanel('none');
      setDeleteTypedConfirm('');
      setActionFeedback({
        type: 'success',
        message: `Deleted ${targetName}'s account and ${deletedRunsCount} workout${deletedRunsCount === 1 ? '' : 's'} from Firestore.`,
      });
      loadAuditLogs();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete user account.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateRunForUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || isMutating) return;
    const distKm = parseFloat(newRunDistKm);
    const durSec = parseDuration(newRunDurationStr);
    if (isNaN(distKm) || distKm <= 0 || durSec <= 0) {
      setActionFeedback({
        type: 'error',
        message: 'Enter a valid distance (> 0 km) and duration (e.g. 22:30).',
      });
      return;
    }

    const pace = calculatePaceSecPerKm(distKm, durSec);
    const targetDist = selectedUser.profile?.targetDistanceKm || 6.0;
    const avgHr = newRunAvgHr.trim() ? parseInt(newRunAvgHr, 10) : undefined;
    const run: RunRecord = {
      id: `admin_run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: selectedUser.userId,
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

    setIsMutating(true);
    setActionFeedback(null);
    try {
      const saved = await adminSaveRunForUser(user, selectedUser.userId, run, true);
      setAllRuns((prev) => [saved, ...prev]);
      setUserActionPanel('none');
      setNewRunTitle('');
      setNewRunNotes('');
      setNewRunAvgHr('');
      setActionFeedback({
        type: 'success',
        message: `Logged "${saved.title}" for ${selectedUser.displayName}.`,
      });
      loadAuditLogs();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to log workout for user.',
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
      setActionFeedback({
        type: 'error',
        message: 'Provide a valid distance (> 0 km) and duration.',
      });
      return;
    }
    const ownerProfile = userLookupMap.get(run.userId)?.profile;
    const targetDist = ownerProfile?.targetDistanceKm || 6.0;
    const updated: RunRecord = {
      ...run,
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

    setIsMutating(true);
    setActionFeedback(null);
    try {
      const saved = await adminSaveRunForUser(user, run.userId, updated, false);
      setAllRuns((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      setEditingRunId(null);
      setActionFeedback({
        type: 'success',
        message: `Updated workout "${saved.title}".`,
      });
      loadAuditLogs();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update workout.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteSingleRun = async (run: RunRecord) => {
    if (isMutating) return;
    setIsMutating(true);
    setActionFeedback(null);
    try {
      await adminDeleteSingleRun(user, run);
      setAllRuns((prev) => prev.filter((r) => r.id !== run.id));
      setConfirmDeleteRunId(null);
      setActionFeedback({
        type: 'success',
        message: `Deleted workout "${run.title}".`,
      });
      loadAuditLogs();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete workout.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handlePurgeOrphans = async () => {
    if (orphanRunIds.length === 0 || isMutating) return;
    setIsMutating(true);
    setActionFeedback(null);
    try {
      const count = await adminPurgeOrphanRuns(user, orphanRunIds);
      const orphanSet = new Set(orphanRunIds);
      setAllRuns((prev) => prev.filter((r) => !orphanSet.has(r.id)));
      setActionFeedback({
        type: 'success',
        message: `Purged ${count} orphaned workout record${count === 1 ? '' : 's'}.`,
      });
      loadAuditLogs();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to purge orphaned runs.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveAnnouncement = async (e: React.FormEvent, overrideEnabled?: boolean) => {
    e.preventDefault();
    if (isMutating) return;
    const enabled = overrideEnabled !== undefined ? overrideEnabled : annEnabled;
    if (enabled && !annTitle.trim() && !annMessage.trim()) {
      setActionFeedback({
        type: 'error',
        message: 'Enter a title or message before publishing an active banner.',
      });
      return;
    }

    setIsMutating(true);
    setActionFeedback(null);
    try {
      const saved = await saveAppAnnouncement(user, {
        enabled,
        title: annTitle.trim(),
        message: annMessage.trim(),
        severity: annSeverity,
      });
      setAnnEnabled(saved.enabled);
      setAnnLastUpdated(saved.updatedAt);
      setActionFeedback({
        type: 'success',
        message: saved.enabled
          ? 'Announcement banner published live to all signed-in dashboards.'
          : 'Announcement banner disabled.',
      });
      loadAuditLogs();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save announcement.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleClearAuditLogs = async () => {
    if (auditLogs.length === 0 || isMutating) return;
    setIsMutating(true);
    setActionFeedback(null);
    try {
      await clearAdminLogs(
        user,
        auditLogs.map((l) => l.id)
      );
      setAuditLogs([]);
      setActionFeedback({
        type: 'success',
        message: 'Audit log history cleared.',
      });
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to clear audit logs.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleExportAllUsersCsv = () => {
    const headers = [
      'User_ID',
      'Display_Name',
      'Email',
      'Status',
      'Athlete_Level',
      'Target_Distance_KM',
      'Target_Time',
      'Target_Race_Date',
      'Weekly_Run_Goal',
      'Runs_Count',
      'Total_Distance_KM',
      'Last_Run_Date',
    ];
    const rows = enrichedUsers.map((u) => [
      `"${u.userId}"`,
      `"${u.displayName.replace(/"/g, '""')}"`,
      `"${u.email.replace(/"/g, '""')}"`,
      `"${u.isOrphaned ? 'orphaned' : u.accountStatus}"`,
      `"${u.profile?.athleteLevel || ''}"`,
      u.profile?.targetDistanceKm || 6,
      `"${u.profile?.target6kTimeSeconds ? formatDuration(u.profile.target6kTimeSeconds) : ''}"`,
      `"${u.profile?.targetGoalDate || ''}"`,
      u.profile?.weeklyRunGoal || 3,
      u.runs.length,
      u.totalDistanceKm.toFixed(2),
      `"${u.lastRunDate || ''}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rungoals_all_users_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportRunsCsv = () => {
    const headers = [
      'Run_ID',
      'Date',
      'User_ID',
      'Runner_Name',
      'Email',
      'Title',
      'Run_Type',
      'Distance_KM',
      'Duration_Sec',
      'Pace_Sec_Per_KM',
      'Avg_HR',
      'Source',
    ];
    const rows = globalFilteredRuns.map((r) => {
      const owner = userLookupMap.get(r.userId);
      return [
        `"${r.id}"`,
        `"${r.date}"`,
        `"${r.userId}"`,
        `"${(owner?.displayName || 'Unknown').replace(/"/g, '""')}"`,
        `"${(owner?.email || '').replace(/"/g, '""')}"`,
        `"${r.title.replace(/"/g, '""')}"`,
        `"${r.runType}"`,
        r.distanceKm.toFixed(2),
        Math.round(r.durationSeconds),
        Math.round(r.averagePaceSecPerKm || 0),
        r.avgHeartRate || '',
        `"${r.source}"`,
      ];
    });
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rungoals_all_workouts_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSingleUserJson = (u: EnrichedUserSummary) => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            userId: u.userId,
            profile: u.profile || null,
            runs: u.runs,
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
    a.download = `rungoals_user_${u.userId.slice(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(true);
    window.setTimeout(() => setCopiedUid(false), 1800);
  };

  if (!isOpen || !authorized) return null;

  const showPadScreen = !isUnlocked || padMode === 'change_new' || padMode === 'change_confirm';
  const expectedDots =
    padMode === 'verify' && adminConfig?.pinLength ? adminConfig.pinLength : Math.max(4, pinInput.length);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-slate-950/75 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative w-full ${
          showPadScreen ? 'max-w-sm' : 'max-w-6xl'
        } rounded-2xl bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-3`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#09121B]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400 border border-violet-500/25 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                  Admin Console
                </h2>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-violet-600 dark:text-violet-400 whitespace-nowrap">
                  {showPadScreen ? 'Locked' : 'Unlocked'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!showPadScreen && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    loadAllData();
                    loadAuditLogs();
                    loadAnnouncement();
                  }}
                  disabled={isLoadingData}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  title="Refresh Firestore data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setPendingFirstPin('');
                    setPadError(null);
                    setPadStatus(null);
                    setPadMode('change_new');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                  title="Change Admin Passcode"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Change PIN</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUnlockChange(false);
                    setPinInput('');
                    setPadMode('verify');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-colors cursor-pointer whitespace-nowrap"
                  title="Lock Admin Panel"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Lock</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close Admin Console"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PHASE 1: NUM PAD LOCK / PASSCODE SETUP */}
        {showPadScreen ? (
          <div className="p-6 space-y-5">
            {padMode === 'checking' ? (
              <div className="py-10 flex flex-col items-center justify-center space-y-3 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                <span>Checking admin passcode status...</span>
              </div>
            ) : (
              <>
                <div className="text-center space-y-1.5">
                  <div className="w-11 h-11 rounded-2xl bg-violet-500/12 text-violet-600 dark:text-violet-400 border border-violet-500/25 flex items-center justify-center mx-auto">
                    {padMode === 'setup_first' || padMode === 'setup_confirm' ? (
                      <KeyRound className="w-5 h-5" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {padMode === 'setup_first'
                      ? 'Set Your Admin Passcode'
                      : padMode === 'setup_confirm'
                      ? 'Confirm Admin Passcode'
                      : padMode === 'change_new'
                      ? 'Enter New Passcode'
                      : padMode === 'change_confirm'
                      ? 'Confirm New Passcode'
                      : 'Enter Admin Passcode'}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {padMode === 'setup_first'
                      ? 'First-time setup: tap a 4–8 digit numeric passcode on the pad below.'
                      : padMode === 'setup_confirm' || padMode === 'change_confirm'
                      ? 'Re-enter your passcode on the numpad to lock it in.'
                      : padMode === 'change_new'
                      ? 'Tap your new 4–8 digit numeric passcode.'
                      : 'Press your admin passcode on the numpad to manage users & runs.'}
                  </p>
                </div>

                {/* Masked PIN Dots */}
                <div className="flex items-center justify-center space-x-2.5 py-2">
                  {Array.from({ length: Math.min(8, expectedDots) }).map((_, idx) => {
                    const filled = idx < pinInput.length;
                    return (
                      <div
                        key={idx}
                        className={`w-3.5 h-3.5 rounded-full border transition-all ${
                          filled
                            ? 'bg-violet-600 dark:bg-violet-400 border-violet-600 dark:border-violet-400 scale-110'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                        }`}
                      />
                    );
                  })}
                </div>

                {padError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-700 dark:text-rose-300 flex items-center justify-center space-x-1.5 text-center">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{padError}</span>
                  </div>
                )}

                {padStatus && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center justify-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{padStatus}</span>
                  </div>
                )}

                {/* Tactile Num Pad Grid */}
                <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto select-none">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      disabled={isSubmittingPin || remainingLockSeconds > 0}
                      onClick={() => handleDigitPress(digit)}
                      className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-[#132232] dark:hover:bg-[#192c40] active:scale-[0.95] border border-slate-200/80 dark:border-slate-700/80 text-xl font-extrabold text-slate-900 dark:text-white tabular-nums transition-all cursor-pointer disabled:opacity-40"
                    >
                      {digit}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={isSubmittingPin || remainingLockSeconds > 0}
                    onClick={handleClearPin}
                    className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:hover:bg-slate-800 active:scale-[0.95] border border-slate-200/80 dark:border-slate-700/70 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    disabled={isSubmittingPin || remainingLockSeconds > 0}
                    onClick={() => handleDigitPress('0')}
                    className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-[#132232] dark:hover:bg-[#192c40] active:scale-[0.95] border border-slate-200/80 dark:border-slate-700/80 text-xl font-extrabold text-slate-900 dark:text-white tabular-nums transition-all cursor-pointer disabled:opacity-40"
                  >
                    0
                  </button>

                  <button
                    type="button"
                    disabled={isSubmittingPin || remainingLockSeconds > 0 || pinInput.length === 0}
                    onClick={handleBackspace}
                    aria-label="Backspace"
                    className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:hover:bg-slate-800 active:scale-[0.95] border border-slate-200/80 dark:border-slate-700/70 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-all cursor-pointer disabled:opacity-40"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                </div>

                {/* Submit / Back Actions */}
                <div className="space-y-2 pt-1 max-w-[260px] mx-auto">
                  <button
                    type="button"
                    disabled={isSubmittingPin || remainingLockSeconds > 0 || pinInput.length < 4}
                    onClick={() => submitPin(pinInput)}
                    className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-45"
                  >
                    {isSubmittingPin ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : remainingLockSeconds > 0 ? (
                      <span>Locked ({remainingLockSeconds}s)</span>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>
                          {padMode === 'setup_first' || padMode === 'change_new'
                            ? 'Continue'
                            : padMode === 'setup_confirm' || padMode === 'change_confirm'
                            ? 'Save Passcode'
                            : 'Unlock Admin Panel'}
                        </span>
                      </>
                    )}
                  </button>

                  {(padMode === 'setup_confirm' ||
                    padMode === 'change_confirm' ||
                    padMode === 'change_new') && (
                    <button
                      type="button"
                      onClick={() => {
                        setPinInput('');
                        setPendingFirstPin('');
                        setPadError(null);
                        if (padMode === 'setup_confirm') {
                          setPadMode('setup_first');
                        } else if (padMode === 'change_confirm') {
                          setPadMode('change_new');
                        } else {
                          setPadMode('verify');
                        }
                      }}
                      className="w-full py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                    >
                      {padMode === 'change_new' ? 'Back to Admin Panel' : 'Start Over'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* PHASE 2: FULL ADMIN WORKSPACE */
          <div className="p-4 sm:p-5 space-y-4 max-h-[84vh] overflow-y-auto">
            {/* Action Feedback Banner */}
            {actionFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  actionFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {actionFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span className="truncate sm:whitespace-normal">{actionFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionFeedback(null)}
                  className="p-1 opacity-70 hover:opacity-100 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {padStatus && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{padStatus}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPadStatus(null)}
                  className="text-emerald-700 dark:text-emerald-300 hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {dataError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Could not fetch all users data</div>
                  <div className="mt-0.5 opacity-90 break-all">{dataError}</div>
                </div>
              </div>
            )}

            {/* Overview KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>Registered Users</span>
                  <Users className="w-3.5 h-3.5 text-sky-500" />
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {summaryStats.totalUsers}
                  </span>
                  {summaryStats.suspendedCount > 0 && (
                    <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                      {summaryStats.suspendedCount} suspended
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>Total Workouts</span>
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {summaryStats.totalRuns}
                  </span>
                  {orphanRunIds.length > 0 && (
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      {orphanRunIds.length} orphaned
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>Combined Volume</span>
                  <Route className="w-3.5 h-3.5 text-violet-500" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
                  {summaryStats.totalKm.toFixed(1)}{' '}
                  <span className="text-xs font-semibold text-slate-500">km</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>Active (7 Days)</span>
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
                  {summaryStats.activeLast7d}
                </div>
              </div>
            </div>

            {/* Primary Workspace Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#09121B] border border-slate-200/80 dark:border-slate-800 overflow-x-auto max-w-full">
                {(
                  [
                    { id: 'users', label: 'Users & Accounts', icon: Users },
                    { id: 'runs', label: 'All Workouts', icon: Activity },
                    { id: 'announcements', label: 'Announcements', icon: Megaphone },
                    { id: 'audit', label: 'Audit Log', icon: History },
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

              {orphanRunIds.length > 0 && activeTab === 'users' && (
                <button
                  type="button"
                  onClick={handlePurgeOrphans}
                  disabled={isMutating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purge {orphanRunIds.length} Orphaned Runs</span>
                </button>
              )}
            </div>

            {/* TAB 1: USERS & ACCOUNTS */}
            {activeTab === 'users' && (
              <div className="space-y-3.5">
                {/* Search, Filter & Export Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search runners by name, email, or user ID..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                      />
                    </div>

                    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#09121B] border border-slate-200/80 dark:border-slate-800 overflow-x-auto">
                      {(
                        [
                          { id: 'all', label: 'All' },
                          { id: 'active', label: 'Active' },
                          { id: 'suspended', label: 'Suspended' },
                          { id: 'pending_setup', label: 'Setup Pending' },
                          { id: 'orphaned', label: 'Orphaned' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setUserFilter(f.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                            userFilter === f.id
                              ? 'bg-white dark:bg-[#132232] text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="recent">Sort: Most Recent</option>
                      <option value="runs">Sort: Most Workouts</option>
                      <option value="distance">Sort: Highest Volume</option>
                      <option value="name">Sort: Name (A–Z)</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleExportAllUsersCsv}
                      disabled={enrichedUsers.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0593C6] hover:bg-[#047ea8] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-45 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {isLoadingData && allUsers.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-2 text-xs text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                    <span>Loading all athlete profiles and workout logs...</span>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                    No users match the selected filter or search.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left Pane: User Directory */}
                    <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#09121B]/60 overflow-hidden flex flex-col max-h-[540px]">
                      <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Athletes ({filteredUsers.length})</span>
                        <span>Workouts · Volume</span>
                      </div>

                      <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80 overflow-y-auto">
                        {filteredUsers.map((u) => {
                          const isSelected = selectedUser?.userId === u.userId;
                          const isSelf = u.userId === user.uid;
                          return (
                            <button
                              key={u.userId}
                              type="button"
                              onClick={() => setSelectedUserId(u.userId)}
                              className={`w-full px-3.5 py-3 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-violet-500/12 dark:bg-violet-500/18'
                                  : 'hover:bg-white dark:hover:bg-[#0F1C28]'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="font-bold text-slate-900 dark:text-white truncate">
                                    {u.displayName}
                                  </span>
                                  {isSelf && (
                                    <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 shrink-0">
                                      · Admin
                                    </span>
                                  )}
                                  {u.accountStatus === 'suspended' && (
                                    <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                                      · Suspended
                                    </span>
                                  )}
                                  {u.isOrphaned && (
                                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                                      · Orphaned
                                    </span>
                                  )}
                                  {u.profile?.directMessageBody && (
                                    <span className="text-[11px] font-semibold text-[#0593C6] dark:text-sky-400 shrink-0">
                                      ·{' '}
                                      {!u.profile.directMessageReadAt ||
                                      (u.profile.directMessageSentAt &&
                                        u.profile.directMessageReadAt < u.profile.directMessageSentAt)
                                        ? 'Unread msg'
                                        : 'Msg read'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {u.email}
                                </div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate mt-0.5 tabular-nums">
                                  {u.lastRunDate ? `Last run ${u.lastRunDate}` : 'No runs yet'}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 text-right tabular-nums">
                                <div>
                                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                                    {u.runs.length} {u.runs.length === 1 ? 'run' : 'runs'}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {u.totalDistanceKm.toFixed(1)} km
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Pane: Selected Athlete Inspector & Management */}
                    <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1520] p-4 flex flex-col max-h-[540px] overflow-y-auto space-y-3.5">
                      {selectedUser && (
                        <>
                          {/* Athlete Profile Header */}
                          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                            <div className="min-w-0">
                              <div className="flex items-center flex-wrap gap-2">
                                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                                  {selectedUser.displayName}
                                </h3>
                                {selectedUser.accountStatus === 'suspended' && (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                                    <Ban className="w-3.5 h-3.5" />
                                    <span>Suspended</span>
                                  </span>
                                )}
                                {selectedUser.userId === user.uid && (
                                  <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">
                                    · Current Admin
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                <span className="truncate">{selectedUser.email}</span>
                                <span aria-hidden="true">·</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyUid(selectedUser.userId)}
                                  className="inline-flex items-center gap-1 font-mono text-[11px] hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                  title="Copy full User ID"
                                >
                                  <span>UID {selectedUser.userId.slice(0, 12)}...</span>
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
                              onClick={() => handleExportSingleUserJson(selectedUser)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0 whitespace-nowrap"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Export JSON</span>
                            </button>
                          </div>

                          {/* Admin Action Toolbar */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {!selectedUser.isOrphaned && (
                              <button
                                type="button"
                                onClick={() => openMessageUserPanel(selectedUser)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                                  userActionPanel === 'message_user'
                                    ? 'bg-[#0593C6] text-white border-[#0593C6]'
                                    : 'bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30 text-sky-700 dark:text-sky-300'
                                }`}
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>
                                  {selectedUser.profile?.directMessageBody ? 'Edit Message' : 'Message User'}
                                </span>
                              </button>
                            )}

                            {!selectedUser.isOrphaned && (
                              <button
                                type="button"
                                onClick={() => openEditProfilePanel(selectedUser)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                                  userActionPanel === 'edit_profile'
                                    ? 'bg-violet-600 text-white border-violet-600'
                                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#09121B] dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <UserCog className="w-3.5 h-3.5" />
                                <span>Edit Profile</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                setUserActionPanel((p) => (p === 'add_run' ? 'none' : 'add_run'))
                              }
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                                userActionPanel === 'add_run'
                                  ? 'bg-[#0593C6] text-white border-[#0593C6]'
                                  : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#09121B] dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Log Run</span>
                            </button>

                            {!selectedUser.isOrphaned && selectedUser.userId !== user.uid && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSuspendReasonInput(selectedUser.profile?.suspensionReason || '');
                                  setUserActionPanel((p) => (p === 'suspend' ? 'none' : 'suspend'));
                                }}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                                  userActionPanel === 'suspend'
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#09121B] dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>
                                  {selectedUser.accountStatus === 'suspended' ? 'Restore' : 'Suspend'}
                                </span>
                              </button>
                            )}

                            {!selectedUser.isOrphaned && (
                              <button
                                type="button"
                                onClick={() => handleResetOnboarding(selectedUser)}
                                disabled={isMutating}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 dark:bg-[#09121B] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Reset Setup</span>
                              </button>
                            )}

                            {selectedUser.runs.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setUserActionPanel((p) =>
                                    p === 'clear_runs' ? 'none' : 'clear_runs'
                                  )
                                }
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                                  userActionPanel === 'clear_runs'
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#09121B] dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Clear Runs</span>
                              </button>
                            )}

                            {selectedUser.userId !== user.uid && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteTypedConfirm('');
                                  setUserActionPanel((p) =>
                                    p === 'delete_user' ? 'none' : 'delete_user'
                                  );
                                }}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                                  userActionPanel === 'delete_user'
                                    ? 'bg-rose-600 text-white border-rose-600'
                                    : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-700 dark:text-rose-300'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete Account</span>
                              </button>
                            )}
                          </div>

                          {/* INLINE PANEL: WRITE DIRECT MESSAGE TO USER */}
                          {userActionPanel === 'message_user' && selectedUser.profile && (
                            <form
                              onSubmit={handleSendUserMessage}
                              className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-sky-500/30 space-y-3 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="w-4 h-4 text-[#0593C6]" />
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    Direct Message to {selectedUser.displayName}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setUserActionPanel('none')}
                                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                Appears live at the top of {selectedUser.displayName}&apos;s dashboard until they mark it as read or you clear it.
                              </p>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <label className="space-y-1 sm:col-span-2">
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    Subject / Title (optional)
                                  </span>
                                  <input
                                    type="text"
                                    value={msgTitle}
                                    onChange={(e) => setMsgTitle(e.target.value)}
                                    maxLength={120}
                                    placeholder="e.g. Great work this week!"
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                  />
                                </label>

                                <label className="space-y-1">
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    Tone
                                  </span>
                                  <select
                                    value={msgSeverity}
                                    onChange={(e) =>
                                      setMsgSeverity(e.target.value as 'info' | 'warning' | 'success')
                                    }
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                  >
                                    <option value="info">Coach Note (Blue)</option>
                                    <option value="success">Praise / PR (Green)</option>
                                    <option value="warning">Important Alert (Amber)</option>
                                  </select>
                                </label>
                              </div>

                              <label className="block space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    Message Body
                                  </span>
                                  <span className="text-[11px] text-slate-400 tabular-nums">
                                    {msgBody.length}/1000
                                  </span>
                                </div>
                                <textarea
                                  rows={3}
                                  required
                                  maxLength={1000}
                                  value={msgBody}
                                  onChange={(e) => setMsgBody(e.target.value)}
                                  placeholder={`Write a personal note to ${selectedUser.displayName}...`}
                                  className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white leading-relaxed"
                                />
                              </label>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                                {selectedUser.profile.directMessageBody ? (
                                  <button
                                    type="button"
                                    disabled={isMutating}
                                    onClick={handleClearUserMessage}
                                    className="px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-semibold cursor-pointer disabled:opacity-50"
                                  >
                                    Clear Existing Message
                                  </button>
                                ) : (
                                  <span />
                                )}

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setUserActionPanel('none')}
                                    className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={isMutating || !msgBody.trim()}
                                    className="px-3.5 py-1.5 rounded-lg bg-[#0593C6] hover:bg-[#047ea8] text-white font-bold cursor-pointer disabled:opacity-50"
                                  >
                                    {isMutating
                                      ? 'Sending...'
                                      : selectedUser.profile.directMessageBody
                                      ? 'Update & Resend'
                                      : 'Send Message'}
                                  </button>
                                </div>
                              </div>
                            </form>
                          )}

                          {/* INLINE PANEL: DELETE ACCOUNT */}
                          {userActionPanel === 'delete_user' && (
                            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3 text-xs">
                              <div className="flex items-start gap-2 text-rose-800 dark:text-rose-200">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                  <div className="font-bold">
                                    Permanently delete {selectedUser.displayName}?
                                  </div>
                                  <p className="mt-0.5 text-rose-700 dark:text-rose-300 leading-relaxed">
                                    This immediately removes their Firestore profile ({selectedUser.email}) and deletes{' '}
                                    <strong className="tabular-nums">{selectedUser.runs.length}</strong> cloud workout
                                    {selectedUser.runs.length === 1 ? '' : 's'}. This action cannot be undone.
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <input
                                  type="text"
                                  value={deleteTypedConfirm}
                                  onChange={(e) => setDeleteTypedConfirm(e.target.value)}
                                  placeholder='Type DELETE to confirm'
                                  className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-[#09121B] border border-rose-300 dark:border-rose-800 text-xs text-slate-900 dark:text-white font-mono"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={
                                      isMutating ||
                                      deleteTypedConfirm.trim().toUpperCase() !== 'DELETE'
                                    }
                                    onClick={handleDeleteUserAccount}
                                    className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer disabled:opacity-45 whitespace-nowrap"
                                  >
                                    {isMutating ? 'Deleting...' : 'Confirm Delete'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setUserActionPanel('none')}
                                    className="px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* INLINE PANEL: SUSPEND / RESTORE */}
                          {userActionPanel === 'suspend' && (
                            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 text-xs">
                              <div className="font-bold text-amber-900 dark:text-amber-200">
                                {selectedUser.accountStatus === 'suspended'
                                  ? `Restore access for ${selectedUser.displayName}?`
                                  : `Suspend ${selectedUser.displayName}?`}
                              </div>
                              {selectedUser.accountStatus !== 'suspended' && (
                                <input
                                  type="text"
                                  value={suspendReasonInput}
                                  onChange={(e) => setSuspendReasonInput(e.target.value)}
                                  placeholder="Optional reason shown to user (e.g. Duplicate test account)"
                                  maxLength={300}
                                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#09121B] border border-amber-300 dark:border-amber-800 text-xs text-slate-900 dark:text-white"
                                />
                              )}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isMutating}
                                  onClick={handleToggleSuspendUser}
                                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                                >
                                  {isMutating
                                    ? 'Updating...'
                                    : selectedUser.accountStatus === 'suspended'
                                    ? 'Restore Account'
                                    : 'Suspend Account'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setUserActionPanel('none')}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* INLINE PANEL: CLEAR RUNS */}
                          {userActionPanel === 'clear_runs' && (
                            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="text-amber-900 dark:text-amber-200 font-semibold">
                                Remove all {selectedUser.runs.length} logged runs for{' '}
                                {selectedUser.displayName} while keeping their profile?
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isMutating}
                                  onClick={handleClearUserRuns}
                                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                                >
                                  {isMutating ? 'Clearing...' : 'Clear All Runs'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setUserActionPanel('none')}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* INLINE PANEL: EDIT USER PROFILE & GOALS */}
                          {userActionPanel === 'edit_profile' && selectedUser.profile && (
                            <form
                              onSubmit={handleSaveEditedProfile}
                              className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 space-y-3 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  Edit Profile & Training Goals
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setUserActionPanel('none')}
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
                                    Units & Division
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
                                  Admin Private Notes (visible only in Admin Console)
                                </span>
                                <textarea
                                  rows={2}
                                  value={editAdminNotes}
                                  onChange={(e) => setEditAdminNotes(e.target.value)}
                                  maxLength={1000}
                                  placeholder="Coaching observations, team notes, support details..."
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                />
                              </label>

                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setUserActionPanel('none')}
                                  className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
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

                          {/* INLINE PANEL: LOG RUN FOR USER */}
                          {userActionPanel === 'add_run' && (
                            <form
                              onSubmit={handleCreateRunForUser}
                              className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  Log Run for {selectedUser.displayName}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setUserActionPanel('none')}
                                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <label className="space-y-1 sm:col-span-2">
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    Workout Title
                                  </span>
                                  <input
                                    type="text"
                                    value={newRunTitle}
                                    onChange={(e) => setNewRunTitle(e.target.value)}
                                    placeholder="e.g. YRAA Pre-Meet 6K"
                                    maxLength={150}
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                  />
                                </label>
                                <label className="space-y-1">
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    Date
                                  </span>
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
                                    placeholder="22:30"
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
                                    placeholder="Logged by coach/admin"
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                  />
                                </label>
                              </div>

                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setUserActionPanel('none')}
                                  className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={isMutating}
                                  className="px-3.5 py-1.5 rounded-lg bg-[#0593C6] hover:bg-[#047ea8] text-white font-bold cursor-pointer disabled:opacity-50"
                                >
                                  {isMutating ? 'Saving...' : 'Save Workout'}
                                </button>
                              </div>
                            </form>
                          )}

                          {/* Athlete Telemetry Strip */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2.5 border-y border-slate-100 dark:border-slate-800/80 text-xs tabular-nums">
                            <div>
                              <span className="text-[11px] text-slate-400 block">Target Goal</span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {selectedUser.profile?.targetDistanceKm || 6}K ·{' '}
                                {selectedUser.profile?.target6kTimeSeconds
                                  ? formatDuration(selectedUser.profile.target6kTimeSeconds)
                                  : 'Not set'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-400 block">
                                Current Best Est.
                              </span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {selectedUser.bestTargetSec
                                  ? formatDuration(selectedUser.bestTargetSec)
                                  : '--:--'}{' '}
                                ·{' '}
                                {selectedUser.avgPaceSecPerKm > 0
                                  ? formatPace(
                                      selectedUser.avgPaceSecPerKm,
                                      selectedUser.profile?.unitPreference || 'km'
                                    )
                                  : '--:--'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-400 block">Weekly Plan</span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {selectedUser.profile?.weeklyRunGoal || 3} runs/wk
                                {selectedUser.profile?.weeklyDistanceGoalKm
                                  ? ` · ${selectedUser.profile.weeklyDistanceGoalKm} km`
                                  : ''}
                              </span>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-400 block">
                                Setup & Race Day
                              </span>
                              <span className="font-bold text-slate-900 dark:text-white truncate block">
                                {selectedUser.profile?.onboardingCompleted ? 'Complete' : 'Pending'}
                                {selectedUser.profile?.targetGoalDate
                                  ? ` · ${selectedUser.profile.targetGoalDate}`
                                  : ''}
                              </span>
                            </div>
                          </div>

                          {/* Direct Message, Suspension & Admin Notes Summary */}
                          {(selectedUser.profile?.directMessageBody ||
                            selectedUser.profile?.suspensionReason ||
                            selectedUser.profile?.adminNotes) && (
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                              {selectedUser.profile?.directMessageBody && (
                                <div className="flex flex-wrap items-start justify-between gap-2 text-sky-900 dark:text-sky-100">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <MessageSquare className="w-3.5 h-3.5 text-[#0593C6] shrink-0" />
                                      <strong className="font-semibold">
                                        {selectedUser.profile.directMessageTitle || 'Active Direct Message'}
                                      </strong>
                                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                        ·{' '}
                                        {!selectedUser.profile.directMessageReadAt ||
                                        (selectedUser.profile.directMessageSentAt &&
                                          selectedUser.profile.directMessageReadAt <
                                            selectedUser.profile.directMessageSentAt)
                                          ? 'Unread by user'
                                          : `Read ${new Date(
                                              selectedUser.profile.directMessageReadAt
                                            ).toLocaleDateString()}`}
                                      </span>
                                    </div>
                                    <p className="mt-0.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                                      {selectedUser.profile.directMessageBody}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => openMessageUserPanel(selectedUser)}
                                      className="px-2 py-1 rounded-md bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isMutating}
                                      onClick={handleClearUserMessage}
                                      className="px-2 py-1 rounded-md text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer disabled:opacity-50"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                </div>
                              )}
                              {selectedUser.profile?.suspensionReason && (
                                <div className="text-rose-700 dark:text-rose-300">
                                  <strong className="font-semibold">Suspension reason:</strong>{' '}
                                  {selectedUser.profile.suspensionReason}
                                </div>
                              )}
                              {selectedUser.profile?.adminNotes && (
                                <div className="text-slate-600 dark:text-slate-300">
                                  <strong className="font-semibold">Admin note:</strong>{' '}
                                  {selectedUser.profile.adminNotes}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Athlete's Runs List */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                              <span>Logged Workouts ({selectedUser.runs.length})</span>
                              <span className="tabular-nums">
                                Total: {selectedUser.totalDistanceKm.toFixed(1)} km ·{' '}
                                {formatDuration(selectedUser.totalDurationSeconds)}
                              </span>
                            </div>

                            {selectedUser.runs.length === 0 ? (
                              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                No cloud workouts logged by this user yet.
                              </div>
                            ) : (
                              selectedUser.runs.map((run) => {
                                const unitPref = selectedUser.profile?.unitPreference || 'km';
                                const distLabel =
                                  unitPref === 'miles'
                                    ? `${(run.distanceKm * KM_TO_MILES).toFixed(2)} mi`
                                    : `${run.distanceKm.toFixed(2)} km`;
                                const isEditing = editingRunId === run.id;
                                const isConfirmingDelete = confirmDeleteRunId === run.id;

                                if (isEditing) {
                                  return (
                                    <div
                                      key={run.id}
                                      className="p-3 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-violet-500/40 space-y-2 text-xs"
                                    >
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <input
                                          type="text"
                                          value={editRunTitle}
                                          onChange={(e) => setEditRunTitle(e.target.value)}
                                          placeholder="Title"
                                          className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                        />
                                        <input
                                          type="date"
                                          value={editRunDate}
                                          onChange={(e) => setEditRunDate(e.target.value)}
                                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                        />
                                        <select
                                          value={editRunType}
                                          onChange={(e) =>
                                            setEditRunType(e.target.value as RunType)
                                          }
                                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
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
                                          placeholder="km"
                                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                                        />
                                        <input
                                          type="text"
                                          value={editRunDurationStr}
                                          onChange={(e) => setEditRunDurationStr(e.target.value)}
                                          placeholder="mm:ss"
                                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                                        />
                                      </div>
                                      <input
                                        type="text"
                                        value={editRunNotes}
                                        onChange={(e) => setEditRunNotes(e.target.value)}
                                        placeholder="Notes"
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                      />
                                      <div className="flex justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setEditingRunId(null)}
                                          className="px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isMutating}
                                          onClick={() => handleSaveEditedRun(run)}
                                          className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold cursor-pointer disabled:opacity-50"
                                        >
                                          Save Run
                                        </button>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={run.id}
                                    className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#0F1C28]/80 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="font-bold text-slate-900 dark:text-white truncate">
                                          {run.title}
                                        </div>
                                        <div className="flex items-center flex-wrap gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                          <span className="font-mono">{run.date}</span>
                                          <span aria-hidden="true">·</span>
                                          <span className="font-semibold text-[#0593C6]">
                                            {run.runType}
                                          </span>
                                          <span aria-hidden="true">·</span>
                                          <span className="font-mono">{run.source}</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <div className="text-right tabular-nums">
                                          <div className="font-extrabold text-slate-900 dark:text-white">
                                            {distLabel}
                                          </div>
                                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1">
                                            <Clock className="w-3 h-3" />
                                            <span>{formatDuration(run.durationSeconds)}</span>
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => startEditingRun(run)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
                                          title="Edit run"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        {isConfirmingDelete ? (
                                          <button
                                            type="button"
                                            disabled={isMutating}
                                            onClick={() => handleDeleteSingleRun(run)}
                                            className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                                          >
                                            Confirm
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => setConfirmDeleteRunId(run.id)}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                            title="Delete run"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums pt-1 border-t border-slate-200/60 dark:border-slate-800/80">
                                      <span>
                                        Pace:{' '}
                                        <strong className="text-slate-900 dark:text-white">
                                          {formatPace(run.averagePaceSecPerKm, unitPref)}
                                        </strong>
                                      </span>
                                      {run.avgHeartRate && (
                                        <span className="inline-flex items-center gap-1">
                                          <Heart className="w-3 h-3 text-rose-500" />
                                          <span>
                                            {run.avgHeartRate}
                                            {run.maxHeartRate ? `/${run.maxHeartRate}` : ''} bpm
                                          </span>
                                        </span>
                                      )}
                                      {run.notes && (
                                        <span className="text-slate-500 dark:text-slate-400 italic truncate max-w-full">
                                          "{run.notes}"
                                        </span>
                                      )}
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

            {/* TAB 2: ALL WORKOUTS FEED */}
            {activeTab === 'runs' && (
              <div className="space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={runsSearchQuery}
                      onChange={(e) => setRunsSearchQuery(e.target.value)}
                      placeholder="Search all workouts by title, runner name, email, or notes..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select
                      value={runsTypeFilter}
                      onChange={(e) => setRunsTypeFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="all">All Types</option>
                      {RUN_TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>

                    <select
                      value={runsSourceFilter}
                      onChange={(e) =>
                        setRunsSourceFilter(e.target.value as typeof runsSourceFilter)
                      }
                      className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#09121B] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="all">All Sources</option>
                      <option value="garmin">Garmin</option>
                      <option value="apple">Apple Watch</option>
                      <option value="manual">Manual</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleExportRunsCsv}
                      disabled={globalFilteredRuns.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0593C6] hover:bg-[#047ea8] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-45 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Runs CSV</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-[#0B1520]">
                  <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-[#09121B] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Date</th>
                          <th className="py-2.5 px-3 font-semibold">Runner</th>
                          <th className="py-2.5 px-3 font-semibold">Workout</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Distance</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Duration</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Pace</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80 tabular-nums">
                        {globalFilteredRuns.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="py-10 text-center text-slate-500 dark:text-slate-400"
                            >
                              No workouts match your filters.
                            </td>
                          </tr>
                        ) : (
                          globalFilteredRuns.map((run) => {
                            const owner = userLookupMap.get(run.userId);
                            const isConfirming = confirmDeleteRunId === run.id;
                            return (
                              <tr
                                key={run.id}
                                className="hover:bg-slate-50 dark:hover:bg-[#0F1C28]/70 transition-colors"
                              >
                                <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                  {run.date}
                                </td>
                                <td className="py-2.5 px-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedUserId(run.userId);
                                      setActiveTab('users');
                                    }}
                                    className="font-semibold text-slate-900 dark:text-white hover:text-[#0593C6] text-left cursor-pointer truncate max-w-[160px] block"
                                    title="Inspect runner"
                                  >
                                    {owner?.displayName || 'Orphaned Account'}
                                  </button>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                                    {run.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {run.runType} · {run.source}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                  {run.distanceKm.toFixed(2)} km
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                  {formatDuration(run.durationSeconds)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                  {formatPace(run.averagePaceSecPerKm, 'km')}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  {isConfirming ? (
                                    <button
                                      type="button"
                                      disabled={isMutating}
                                      onClick={() => handleDeleteSingleRun(run)}
                                      className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                                    >
                                      Confirm
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteRunId(run.id)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                      title="Delete workout"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: GLOBAL ANNOUNCEMENTS */}
            {activeTab === 'announcements' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <form
                  onSubmit={(e) => handleSaveAnnouncement(e)}
                  className="lg:col-span-7 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#09121B] space-y-3.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Global Coach &amp; Admin Announcement
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Displayed live at the top of every signed-in athlete dashboard.
                      </p>
                    </div>

                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={annEnabled}
                        onChange={(e) => setAnnEnabled(e.target.checked)}
                        className="rounded border-slate-300 text-violet-600"
                      />
                      <span className="font-bold text-slate-900 dark:text-white">Active</span>
                    </label>
                  </div>

                  {isLoadingAnn ? (
                    <div className="py-6 flex items-center justify-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      <span>Loading announcement...</span>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Banner Style
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            [
                              { id: 'info', label: 'Info (Blue)' },
                              { id: 'warning', label: 'Alert (Amber)' },
                              { id: 'success', label: 'Milestone (Green)' },
                            ] as const
                          ).map((sev) => (
                            <button
                              key={sev.id}
                              type="button"
                              onClick={() => setAnnSeverity(sev.id)}
                              className={`py-2 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                                annSeverity === sev.id
                                  ? 'bg-white dark:bg-[#132232] border-violet-500 text-slate-900 dark:text-white'
                                  : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {sev.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Headline Title
                        </span>
                        <input
                          type="text"
                          value={annTitle}
                          onChange={(e) => setAnnTitle(e.target.value)}
                          maxLength={120}
                          placeholder="e.g. YRAA Regional Meet This Thursday"
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
                          placeholder="Share meet arrival times, training updates, or app notices..."
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </label>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {annLastUpdated
                            ? `Last saved ${new Date(annLastUpdated).toLocaleString()}`
                            : 'Not published yet'}
                        </span>
                        <div className="flex items-center gap-2">
                          {annEnabled && (
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={(e) => handleSaveAnnouncement(e, false)}
                              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              Disable Banner
                            </button>
                          )}
                          <button
                            type="submit"
                            disabled={isMutating}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{isMutating ? 'Saving...' : 'Save & Publish'}</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </form>

                {/* Live Preview */}
                <div className="lg:col-span-5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1520] space-y-3 text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">Dashboard Preview</div>
                  {annTitle || annMessage ? (
                    <div
                      className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                        annSeverity === 'warning'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100'
                          : annSeverity === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
                          : 'bg-sky-500/10 border-sky-500/30 text-sky-950 dark:text-sky-100'
                      }`}
                    >
                      <AlertCircle
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          annSeverity === 'warning'
                            ? 'text-amber-600 dark:text-amber-400'
                            : annSeverity === 'success'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-sky-600 dark:text-sky-400'
                        }`}
                      />
                      <div className="min-w-0">
                        {annTitle && (
                          <div className="font-bold text-slate-900 dark:text-white">{annTitle}</div>
                        )}
                        {annMessage && (
                          <p className="text-slate-700 dark:text-slate-200 mt-0.5 leading-relaxed">
                            {annMessage}
                          </p>
                        )}
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                          Status: {annEnabled ? 'Visible to users' : 'Draft (hidden)'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-10 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      Enter a title or message to preview how it will appear on athlete dashboards.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: AUDIT LOG */}
            {activeTab === 'audit' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Recorded admin operations ({auditLogs.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={loadAuditLogs}
                      disabled={isLoadingLogs}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                    {auditLogs.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAuditLogs}
                        disabled={isMutating}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear History</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1520] overflow-hidden max-h-[440px] overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-800/80">
                  {isLoadingLogs && auditLogs.length === 0 ? (
                    <div className="py-10 flex items-center justify-center text-xs text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin mr-2 text-violet-500" />
                      <span>Loading audit history...</span>
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                      No admin actions recorded yet. Actions like user edits, deletions, and announcements appear here.
                    </div>
                  ) : (
                    auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {AUDIT_ACTION_LABELS[log.action] || log.action}
                            </span>
                            {log.targetLabel && (
                              <>
                                <span aria-hidden="true" className="text-slate-400">
                                  ·
                                </span>
                                <span className="font-semibold text-violet-600 dark:text-violet-400 truncate max-w-[260px]">
                                  {log.targetLabel}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-slate-600 dark:text-slate-300">{log.details}</p>
                        </div>

                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums shrink-0 sm:text-right">
                          <div>{new Date(log.createdAt).toLocaleString()}</div>
                          <div>{log.adminEmail}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
