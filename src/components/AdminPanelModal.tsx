import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  AdminConfigRecord,
  isAuthorizedAdmin,
  getAdminConfig,
  saveAdminPasscode,
  verifyAdminPasscode,
  fetchAllAdminData,
} from '../lib/firebase';
import { RunRecord, UserProfile } from '../types/running';
import { formatDuration, formatPace, KM_TO_MILES } from '../utils/runningCalculations';
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
} from 'lucide-react';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  isUnlocked: boolean;
  onUnlockChange: (unlocked: boolean) => void;
}

type PadMode = 'checking' | 'setup_first' | 'setup_confirm' | 'verify' | 'change_new' | 'change_confirm';

interface EnrichedUserSummary {
  userId: string;
  profile?: UserProfile;
  displayName: string;
  email: string;
  runs: RunRecord[];
  totalDistanceKm: number;
  totalDurationSeconds: number;
  lastRunDate: string | null;
}

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

  // Admin Explorer State
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allRuns, setAllRuns] = useState<RunRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'runs' | 'distance' | 'name'>('recent');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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

  // Check admin passcode configuration on open
  useEffect(() => {
    if (!isOpen || !authorized) return;
    setPinInput('');
    setPendingFirstPin('');
    setPadError(null);
    setPadStatus(null);

    if (isUnlocked) {
      setPadMode('verify');
      loadAllData();
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
  }, [isOpen, authorized, user, isUnlocked, loadAllData]);

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
        // Auto-verify once the user reaches their saved PIN length during unlock
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

  // Support physical keyboard typing while Num Pad is visible
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
      const lastRunDate = userRuns.length > 0 ? userRuns[0].date : null;

      list.push({
        userId: uid,
        profile: prof,
        displayName: prof?.displayName?.trim() || 'Unnamed Runner',
        email: prof?.email || 'No email recorded',
        runs: userRuns,
        totalDistanceKm,
        totalDurationSeconds,
        lastRunDate,
      });
    });

    return list;
  }, [allUsers, allRuns]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? enrichedUsers.filter(
          (u) =>
            u.displayName.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.userId.toLowerCase().includes(q)
        )
      : enrichedUsers;

    return [...filtered].sort((a, b) => {
      if (sortBy === 'runs') return b.runs.length - a.runs.length;
      if (sortBy === 'distance') return b.totalDistanceKm - a.totalDistanceKm;
      if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
      // 'recent'
      const aDate = a.lastRunDate || a.profile?.updatedAt || a.profile?.createdAt || '';
      const bDate = b.lastRunDate || b.profile?.updatedAt || b.profile?.createdAt || '';
      return bDate.localeCompare(aDate);
    });
  }, [enrichedUsers, searchQuery, sortBy]);

  useEffect(() => {
    if (!selectedUserId && filteredUsers.length > 0) {
      setSelectedUserId(filteredUsers[0].userId);
    }
  }, [filteredUsers, selectedUserId]);

  const selectedUser =
    enrichedUsers.find((u) => u.userId === selectedUserId) || filteredUsers[0] || null;

  const summaryStats = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 86400 * 1000;
    const activeLast7d = enrichedUsers.filter(
      (u) => u.lastRunDate && new Date(u.lastRunDate).getTime() >= sevenDaysAgo
    ).length;
    const totalKm = allRuns.reduce((sum, r) => sum + (r.distanceKm || 0), 0);
    return {
      totalUsers: enrichedUsers.length,
      totalRuns: allRuns.length,
      totalKm,
      activeLast7d,
    };
  }, [enrichedUsers, allRuns]);

  const handleExportAllUsersCsv = () => {
    const headers = [
      'User_ID',
      'Display_Name',
      'Email',
      'Athlete_Level',
      'Target_Distance_KM',
      'Target_Time',
      'Weekly_Run_Goal',
      'Runs_Count',
      'Total_Distance_KM',
      'Last_Run_Date',
    ];
    const rows = enrichedUsers.map((u) => [
      `"${u.userId}"`,
      `"${u.displayName.replace(/"/g, '""')}"`,
      `"${u.email.replace(/"/g, '""')}"`,
      `"${u.profile?.athleteLevel || ''}"`,
      u.profile?.targetDistanceKm || 6,
      `"${u.profile?.target6kTimeSeconds ? formatDuration(u.profile.target6kTimeSeconds) : ''}"`,
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

  if (!isOpen || !authorized) return null;

  const showPadScreen = !isUnlocked || padMode === 'change_new' || padMode === 'change_confirm';
  const expectedDots =
    padMode === 'verify' && adminConfig?.pinLength ? adminConfig.pinLength : Math.max(4, pinInput.length);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative w-full ${
          showPadScreen ? 'max-w-sm' : 'max-w-6xl'
        } rounded-2xl bg-white dark:bg-[#0D1620] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#09121B]/80">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30 flex items-center justify-center shrink-0">
              <Shield className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                  Admin Console
                </h2>
                <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-600 dark:text-violet-300 text-[10px] font-bold uppercase tracking-wider">
                  {showPadScreen ? 'Locked' : 'Unlocked'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {!showPadScreen && (
              <>
                <button
                  type="button"
                  onClick={loadAllData}
                  disabled={isLoadingData}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
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
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
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
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
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

        {/* PHASE 1: NUM PAD LOCK / FIRST-TIME PASSCODE SETUP */}
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
                      : 'Press your admin passcode on the numpad to view all users data.'}
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
                      className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-[#132232] dark:hover:bg-[#192c40] active:scale-[0.95] border border-slate-200/80 dark:border-slate-700/80 text-xl font-extrabold text-slate-900 dark:text-white tabular-nums transition-all cursor-pointer disabled:opacity-40 shadow-xs"
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
                    className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-[#132232] dark:hover:bg-[#192c40] active:scale-[0.95] border border-slate-200/80 dark:border-slate-700/80 text-xl font-extrabold text-slate-900 dark:text-white tabular-nums transition-all cursor-pointer disabled:opacity-40 shadow-xs"
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
                    className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-45 shadow-sm"
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

                  {(padMode === 'setup_confirm' || padMode === 'change_confirm' || padMode === 'change_new') && (
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
          /* PHASE 2: UNLOCKED CROSS-USER DATA EXPLORER */
          <div className="p-4 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto">
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
              <div className="p-3.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/25 border border-sky-200/80 dark:border-sky-800/60">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                  <span>Registered Users</span>
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
                  {summaryStats.totalUsers}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/80 dark:border-emerald-800/60">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  <span>Total Workouts</span>
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
                  {summaryStats.totalRuns}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-violet-50/70 dark:bg-violet-950/25 border border-violet-200/80 dark:border-violet-800/60">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                  <span>Combined Volume</span>
                  <Route className="w-3.5 h-3.5" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
                  {summaryStats.totalKm.toFixed(1)}{' '}
                  <span className="text-xs font-semibold text-slate-500">km</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/60">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  <span>Active (7 Days)</span>
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
                  {summaryStats.activeLast7d}
                </div>
              </div>
            </div>

            {/* Search, Sort & Export Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
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

              <div className="flex items-center space-x-2 shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
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
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-[#0593C6] hover:bg-[#047ea8] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-45"
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
                No cloud-synced users match your search yet.
              </div>
            ) : (
              /* Master-Detail User Explorer */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Pane: User Directory */}
                <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#09121B]/60 overflow-hidden flex flex-col max-h-[460px]">
                  <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>Athletes ({filteredUsers.length})</span>
                    <span>Workouts · Volume</span>
                  </div>

                  <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80 overflow-y-auto">
                    {filteredUsers.map((u) => {
                      const isSelected = selectedUser?.userId === u.userId;
                      return (
                        <button
                          key={u.userId}
                          type="button"
                          onClick={() => setSelectedUserId(u.userId)}
                          className={`w-full px-3.5 py-3 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-violet-500/12 dark:bg-violet-500/18 border-l-2 border-l-violet-500'
                              : 'hover:bg-white dark:hover:bg-[#0F1C28]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {u.displayName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {u.email}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate mt-0.5">
                              {u.lastRunDate ? `Last run: ${u.lastRunDate}` : 'No runs yet'}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0 text-right tabular-nums">
                            <div>
                              <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                                {u.runs.length} {u.runs.length === 1 ? 'run' : 'runs'}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">
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

                {/* Right Pane: Selected Athlete Details & Runs */}
                <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1520] p-4 flex flex-col max-h-[460px] overflow-hidden">
                  {selectedUser && (
                    <>
                      {/* Athlete Profile Header */}
                      <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-slate-200 dark:border-slate-800">
                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                            {selectedUser.displayName}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {selectedUser.email}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                            UID: {selectedUser.userId}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleExportSingleUserJson(selectedUser)}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export JSON</span>
                        </button>
                      </div>

                      {/* Profile Metadata Pills */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-3 border-b border-slate-100 dark:border-slate-800/80 text-[11px] tabular-nums">
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                            Goal
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {selectedUser.profile?.targetDistanceKm || 6}K ·{' '}
                            {selectedUser.profile?.target6kTimeSeconds
                              ? formatDuration(selectedUser.profile.target6kTimeSeconds)
                              : 'Not set'}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                            Weekly Target
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {selectedUser.profile?.weeklyRunGoal || 3} runs/wk
                            {selectedUser.profile?.weeklyDistanceGoalKm
                              ? ` · ${selectedUser.profile.weeklyDistanceGoalKm} km`
                              : ''}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                            Level / Units
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white truncate block">
                            {selectedUser.profile?.athleteLevel || 'Runner'} ·{' '}
                            {selectedUser.profile?.unitPreference || 'km'}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                            Division
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white truncate block">
                            {selectedUser.profile?.yraaDivision || 'Auto'}
                          </span>
                        </div>
                      </div>

                      {/* Athlete's Runs List */}
                      <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1">
                        {selectedUser.runs.length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                            No cloud workouts logged by this user yet.
                          </div>
                        ) : (
                          selectedUser.runs.map((run) => {
                            const unitPref = selectedUser.profile?.unitPreference || 'km';
                            const distLabel =
                              unitPref === 'miles'
                                ? `${(run.distanceKm * KM_TO_MILES).toFixed(2)} mi`
                                : `${run.distanceKm.toFixed(2)} km`;
                            return (
                              <div
                                key={run.id}
                                className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#0F1C28]/80 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center flex-wrap gap-1.5">
                                      <span className="font-bold text-slate-900 dark:text-white truncate">
                                        {run.title}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded bg-[#0593C6]/12 text-[#0593C6] text-[10px] font-bold">
                                        {run.runType}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-mono">
                                        {run.source}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                      {run.date}
                                    </div>
                                  </div>

                                  <div className="text-right tabular-nums shrink-0">
                                    <div className="font-extrabold text-slate-900 dark:text-white">
                                      {distLabel}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-end space-x-1">
                                      <Clock className="w-3 h-3" />
                                      <span>{formatDuration(run.durationSeconds)}</span>
                                    </div>
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
                                    <span className="inline-flex items-center space-x-1">
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
      </div>
    </div>
  );
};
