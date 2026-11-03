/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  signInAnonymousUser,
  logOut,
  getOrCreateUserProfile,
  saveUserProfile,
  subscribeUserRuns,
  saveRunRecord,
  deleteRunRecord,
  batchSaveRuns,
} from './lib/firebase';
import { RunRecord, UserProfile, DuplicateRunMatch, RunType } from './types/running';
import { DEFAULT_RUNNER_PROFILE } from './data/sampleRuns';
import {
  groupRunsByWeek,
  calculate6kEquivalent,
  calculateTargetDistanceEquivalent,
  findDuplicateRuns,
} from './utils/runningCalculations';
import { Navbar } from './components/Navbar';
import { GoalBanner } from './components/GoalBanner';
import { GoalProjectionCard } from './components/GoalProjectionCard';
import { WeeklyAdherenceCard } from './components/WeeklyAdherenceCard';
import { ProgressVisualizer } from './components/ProgressVisualizer';
import { MotivationalGreeting } from './components/MotivationalGreeting';
import { FirstTimeNameModal } from './components/FirstTimeNameModal';
import { GarminSyncModal } from './components/GarminSyncModal';
import { DuplicateRunsModal } from './components/DuplicateRunsModal';
import { AiExportModal } from './components/AiExportModal';
import { AddRunModal } from './components/AddRunModal';
import { GoalSettingsModal } from './components/GoalSettingsModal';
import { EmptyGarminState } from './components/EmptyGarminState';
import { WatchTelemetrySection } from './components/WatchTelemetrySection';
import { LoginPage } from './components/LoginPage';
import { Cloud, CloudOff, Loader2, AlertCircle, X, FlaskConical, Activity } from 'lucide-react';
import confetti from 'canvas-confetti';

const LOCAL_STORAGE_RUNS_KEY = 'xc_6k_user_runs_data';
const LOCAL_STORAGE_PROFILE_KEY = 'xc_6k_user_profile_data';
const LOCAL_STORAGE_THEME_KEY = 'xc_6k_theme';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Guest Testing Mode
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return sessionStorage.getItem('xc_6k_guest_mode') === 'true';
  });

  const handleContinueAsGuest = () => {
    setIsGuest(true);
    sessionStorage.setItem('xc_6k_guest_mode', 'true');
  };

  const handleExitGuestMode = () => {
    setIsGuest(false);
    sessionStorage.removeItem('xc_6k_guest_mode');
  };

  // Theme: light / dark
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_THEME_KEY, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // User Profile: start completely clean with zero fake data
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.target6kTimeSeconds === 1260 && !(parsed as any).hasCustomTarget) {
          delete parsed.target6kTimeSeconds;
        }
        return { ...DEFAULT_RUNNER_PROFILE, ...parsed };
      } catch {
        // fallback
      }
    }
    return DEFAULT_RUNNER_PROFILE;
  });

  // Runs: strictly empty array by default, zero placeholder data
  const [runs, setRuns] = useState<RunRecord[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_RUNS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return [];
  });

  // Duplicate Resolution State
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateRunMatch[]>([]);
  const [pendingIncomingRuns, setPendingIncomingRuns] = useState<RunRecord[]>([]);
  const [pendingUniqueRuns, setPendingUniqueRuns] = useState<RunRecord[]>([]);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  // Modals state
  const [isGarminSyncOpen, setIsGarminSyncOpen] = useState(false);
  const [preParsedGarminRuns, setPreParsedGarminRuns] = useState<RunRecord[]>([]);
  const [isAiExportOpen, setIsAiExportOpen] = useState(false);
  const [isAddRunOpen, setIsAddRunOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFirstTimeNameOpen, setIsFirstTimeNameOpen] = useState(false);

  // Check if runner needs to be prompted for their name on first login / app entry
  useEffect(() => {
    if (!authLoading && (user || isGuest)) {
      const hasPrompted = localStorage.getItem('xc_name_prompt_completed');
      if (!profile.displayName && !hasPrompted) {
        setIsFirstTimeNameOpen(true);
      }
    }
  }, [authLoading, user, isGuest, profile.displayName]);

  const handleSaveFirstTimeName = (name: string) => {
    const updated = { ...profile, displayName: name };
    handleSaveProfile(updated);
    localStorage.setItem('xc_name_prompt_completed', 'true');
    setIsFirstTimeNameOpen(false);
  };

  const handleDismissFirstTimeName = () => {
    localStorage.setItem('xc_name_prompt_completed', 'true');
    setIsFirstTimeNameOpen(false);
  };

  const handleOpenGarminSync = () => {
    setPreParsedGarminRuns([]);
    setIsGarminSyncOpen(true);
  };

  const handleOpenGarminSyncWithRuns = (runsToSelect: RunRecord[]) => {
    setPreParsedGarminRuns(runsToSelect);
    setIsGarminSyncOpen(true);
  };

  const handleCloseGarminSync = () => {
    setIsGarminSyncOpen(false);
    setPreParsedGarminRuns([]);
  };

  // Firebase Auth & Firestore Subscription
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userProf = await getOrCreateUserProfile(currentUser);

          // Check if user set custom targets or distance goals locally before logging in
          const savedLocalProf = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
          let mergedProfile = userProf;
          if (savedLocalProf) {
            try {
              const parsedLocal = JSON.parse(savedLocalProf);
              if (
                parsedLocal.targetDistanceKm ||
                parsedLocal.targetGoalName ||
                parsedLocal.hasCustomTarget ||
                parsedLocal.weeklyDistanceGoalKm ||
                parsedLocal.target6kTimeSeconds
              ) {
                mergedProfile = {
                  ...userProf,
                  ...parsedLocal,
                  id: currentUser.uid,
                  email: currentUser.email || userProf.email,
                };
                await saveUserProfile(mergedProfile);
              }
            } catch (e) {
              console.warn('Error merging local profile with cloud profile:', e);
            }
          }
          setProfile(mergedProfile);
          localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(mergedProfile));

          const unsubscribeRuns = subscribeUserRuns(
            currentUser.uid,
            async (cloudRuns) => {
              if (cloudRuns && cloudRuns.length > 0) {
                setRuns(cloudRuns);
                localStorage.setItem(LOCAL_STORAGE_RUNS_KEY, JSON.stringify(cloudRuns));
              } else {
                // If cloud has no runs, but user logged local runs, migrate them to cloud
                const savedLocalRuns = localStorage.getItem(LOCAL_STORAGE_RUNS_KEY);
                if (savedLocalRuns) {
                  try {
                    const parsed: RunRecord[] = JSON.parse(savedLocalRuns);
                    if (parsed.length > 0) {
                      const toUpload = parsed.map((r) => ({ ...r, userId: currentUser.uid }));
                      await batchSaveRuns(toUpload);
                      setRuns(toUpload);
                    }
                  } catch (e) {
                    console.warn('Error uploading local runs to cloud:', e);
                  }
                }
              }
            },
            (error) => {
              console.warn('Could not subscribe to cloud runs:', error);
            }
          );
          setAuthLoading(false);
          return () => unsubscribeRuns();
        } catch (error) {
          console.error('Error in auth setup:', error);
          setAuthLoading(false);
        }
      } else {
        setAuthLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Always keep localStorage updated as immediate local cache
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_RUNS_KEY, JSON.stringify(runs));
    localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
  }, [runs, profile]);

  // Derived metrics
  const { weeklyStats, adherence } = groupRunsByWeek(runs, profile.weeklyRunGoal);

  const targetDistKm = profile.targetDistanceKm || 6.0;
  const best6kSec = runs.reduce<number | undefined>((best, run) => {
    const eq = calculateTargetDistanceEquivalent(run.distanceKm, run.durationSeconds, targetDistKm);
    if (!eq || eq <= 0) return best;
    if (best === undefined || eq < best) return eq;
    return best;
  }, undefined);

  // Duplicate Check & Processing
  const handleProcessIncomingRuns = (incoming: RunRecord[]) => {
    const { uniqueRuns, duplicateMatches: dups } = findDuplicateRuns(incoming, runs);

    if (dups.length > 0) {
      setDuplicateMatches(dups);
      setPendingIncomingRuns(incoming);
      setPendingUniqueRuns(uniqueRuns);
      setIsDuplicateModalOpen(true);
    } else {
      // No duplicates, import directly
      executeImportRuns(incoming);
    }
  };

  const handleDiscardDuplicates = () => {
    setIsDuplicateModalOpen(false);
    if (pendingUniqueRuns.length > 0) {
      executeImportRuns(pendingUniqueRuns);
    }
    setDuplicateMatches([]);
    setPendingIncomingRuns([]);
    setPendingUniqueRuns([]);
  };

  const handleOverwriteExistingDuplicates = async () => {
    setIsDuplicateModalOpen(false);
    const existingIdsToRemove = new Set(duplicateMatches.map((m) => m.existing.id));
    const filteredCurrentRuns = runs.filter((r) => !existingIdsToRemove.has(r.id));

    // Delete overwritten from Firestore if logged in
    if (user) {
      for (const id of existingIdsToRemove) {
        await deleteRunRecord(id);
      }
    }

    const updated = [...pendingIncomingRuns, ...filteredCurrentRuns];
    setRuns(updated);

    if (user) {
      await batchSaveRuns(pendingIncomingRuns.map((r) => ({ ...r, userId: user.uid })));
    }

    setDuplicateMatches([]);
    setPendingIncomingRuns([]);
    setPendingUniqueRuns([]);
  };

  const handleImportAllWithDuplicates = () => {
    setIsDuplicateModalOpen(false);
    executeImportRuns(pendingIncomingRuns);
    setDuplicateMatches([]);
    setPendingIncomingRuns([]);
    setPendingUniqueRuns([]);
  };

  const executeImportRuns = async (newRuns: RunRecord[]) => {
    const targetUserId = user ? user.uid : 'local_user';
    const formatted = newRuns.map((r) => ({ ...r, userId: targetUserId }));
    setRuns((prev) => [...formatted, ...prev]);

    if (user) {
      await batchSaveRuns(formatted);
    }
  };

  // Run updates (e.g. changing category or calibrating intervals)
  const handleUpdateRunCategory = async (runId: string, newCategory: RunType) => {
    const updatedRuns = runs.map((r) => {
      if (r.id === runId) {
        return { ...r, runType: newCategory };
      }
      return r;
    });
    setRuns(updatedRuns);

    const targetRun = updatedRuns.find((r) => r.id === runId);
    if (targetRun && user) {
      await saveRunRecord(targetRun);
    }
  };

  const handleUpdateRun = async (updatedRun: RunRecord) => {
    const runToSave = user ? { ...updatedRun, userId: user.uid } : updatedRun;
    setRuns((prev) => prev.map((r) => (r.id === updatedRun.id ? runToSave : r)));

    if (user) {
      await saveRunRecord(runToSave);
    }
  };

  const handleSaveRun = async (newRun: RunRecord) => {
    const runToSave = user ? { ...newRun, userId: user.uid } : newRun;
    const runEquiv = runToSave.targetEquivalentSeconds || runToSave.best6kTimeSeconds;
    const isNewPr =
      best6kSec === undefined ||
      (runEquiv !== undefined && runEquiv < best6kSec);

    setRuns((prev) => [runToSave, ...prev]);

    if (user) {
      await saveRunRecord(runToSave);
    }

    if (isNewPr) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  };

  const handleDeleteRun = async (runId: string) => {
    setRuns((prev) => prev.filter((r) => r.id !== runId));
    if (user) {
      await deleteRunRecord(runId);
    }
  };

  const handleCombineRuns = async (combinedRun: RunRecord, sourceRunIds: string[]) => {
    const targetUserId = user ? user.uid : 'local_user';
    const runToSave: RunRecord = { ...combinedRun, userId: targetUserId };
    const sourceIdsSet = new Set(sourceRunIds);

    const updatedRuns = [runToSave, ...runs.filter((r) => !sourceIdsSet.has(r.id))];
    setRuns(updatedRuns);

    if (user) {
      await saveRunRecord(runToSave);
      for (const id of sourceRunIds) {
        await deleteRunRecord(id);
      }
    }
  };

  const handleSaveProfile = async (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
    if (user) {
      await saveUserProfile(updatedProfile);
    }
  };

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
      setIsGuest(false);
      sessionStorage.removeItem('xc_6k_guest_mode');
    } catch (err: unknown) {
      console.error('Google sign in error', err);
      const errorObj = err as { code?: string; message?: string };
      if (errorObj?.code === 'auth/unauthorized-domain') {
        setAuthError(
          'Firebase Authentication domain is provisioning (takes ~1-2 minutes). Click Retry to connect, or use Guest Mode in the meantime.'
        );
      } else if (errorObj?.code === 'auth/popup-closed-by-user') {
        // Closed by user, no error banner needed
      } else if (errorObj?.code === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked by your browser. Please allow popups for this site.');
      } else {
        setAuthError(errorObj?.message || 'Failed to sign in with Google. Please try again.');
      }
    }
  };

  const handleInstantCloudSignIn = async () => {
    setAuthError(null);
    try {
      await signInAnonymousUser();
      setIsGuest(false);
      sessionStorage.removeItem('xc_6k_guest_mode');
    } catch (err: unknown) {
      console.error('Instant cloud sign in error', err);
      const errorObj = err as { message?: string };
      setAuthError(errorObj?.message || 'Failed to initialize instant cloud athlete account.');
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      setUser(null);
      setIsGuest(false);
      sessionStorage.removeItem('xc_6k_guest_mode');
    } catch (err) {
      console.error('Google sign out error', err);
    }
  };

  // 1. Initial auth loading splash
  if (authLoading) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
        <div className="min-h-screen bg-[#F2F8FB] dark:bg-[#0c1822] flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#0593C6] text-[#FCFFFF] flex items-center justify-center font-bold shadow-lg shadow-[#0593C6]/20 animate-pulse">
            <Activity className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="text-center">
            <span className="font-extrabold text-base tracking-tight text-neutral-900 dark:text-[#FCFFFF]">
              RunGoals
            </span>
            <p className="text-xs text-neutral-400 mt-0.5">Initializing training telemetry...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Login Page at start: Shown when not signed in and guest mode not activated
  if (!user && !isGuest) {
    return (
      <LoginPage
        onSignIn={handleSignIn}
        onInstantCloudSignIn={handleInstantCloudSignIn}
        onContinueAsGuest={handleContinueAsGuest}
        authError={authError}
        onClearAuthError={() => setAuthError(null)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="min-h-screen bg-[#F2F8FB] dark:bg-[#0c1822] text-neutral-900 dark:text-[#FCFFFF] flex flex-col font-sans transition-colors selection:bg-[#0593C6] selection:text-[#FCFFFF]">
        {/* Apple-style Navigation */}
        <Navbar
          user={user}
          profile={profile}
          adherence={adherence}
          best6kSec={best6kSec}
          theme={theme}
          isGuest={isGuest}
          onExitGuestMode={handleExitGuestMode}
          onToggleTheme={toggleTheme}
          onOpenGarminSync={handleOpenGarminSync}
          onOpenAiExport={() => setIsAiExportOpen(true)}
          onOpenAddRun={() => setIsAddRunOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />

        {/* Cloud / Guest Status Banner */}
        <div className="bg-[#FCFFFF]/85 dark:bg-[#12222f]/85 border-b border-[#0593C6]/15 dark:border-[#0593C6]/20 px-4 py-2 text-xs text-neutral-500 dark:text-neutral-400 backdrop-blur-xs">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {user ? (
                <span className="flex items-center space-x-1.5 text-[#0593C6] font-semibold">
                  <Cloud className="w-4 h-4" />
                  <span>Cloud Synced · {user.email}</span>
                </span>
              ) : isGuest ? (
                <span className="flex items-center space-x-1.5 text-neutral-700 dark:text-neutral-300 font-medium">
                  <FlaskConical className="w-4 h-4 text-[#10B981]" />
                  <span>Guest Testing Mode · Local storage only ·</span>
                  <button
                    onClick={handleSignIn}
                    className="text-[#0593C6] hover:underline font-bold cursor-pointer ml-1"
                  >
                    Sign in with Google to enable cloud sync
                  </button>
                </span>
              ) : (
                <span className="flex items-center space-x-1.5">
                  <CloudOff className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Local Session</span>
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3 text-neutral-400 dark:text-neutral-500 text-[11px]">
              <span className="tabular-nums font-mono">{runs.length} {runs.length === 1 ? 'workout' : 'workouts'} logged</span>
              {isGuest && (
                <>
                  <span>·</span>
                  <button
                    onClick={handleExitGuestMode}
                    className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white underline cursor-pointer"
                  >
                    Exit Guest Mode
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800/80 px-4 py-2 text-xs text-red-700 dark:text-red-300">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{authError}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSignIn}
                  className="px-2.5 py-0.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium text-[11px] cursor-pointer"
                >
                  Retry
                </button>
                <button
                  onClick={() => setAuthError(null)}
                  className="p-1 rounded-md text-red-500 hover:text-red-700 dark:hover:text-red-200 cursor-pointer"
                  aria-label="Dismiss alert"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Dashboard */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* Dynamic Motivational Greeting with User's Name */}
          <MotivationalGreeting
            profile={profile}
            weeklyRunsCount={adherence.currentWeekRuns}
            weeklyGoal={adherence.weeklyGoal}
            streakWeeks={adherence.currentStreakWeeks}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          {runs.length === 0 ? (
            <EmptyGarminState
              unit={profile.unitPreference}
              onProcessIncomingRuns={handleProcessIncomingRuns}
              onOpenGarminSync={handleOpenGarminSync}
              onOpenGarminSyncWithRuns={handleOpenGarminSyncWithRuns}
              onOpenAddRun={() => setIsAddRunOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          ) : (
            <div className="space-y-5">
              {/* 1. TARGET BENCHMARK (Target Distance, Pace & Current Best) */}
              <GoalBanner
                profile={profile}
                adherence={adherence}
                best6kSec={best6kSec}
                onEditGoal={() => setIsSettingsOpen(true)}
              />

              {/* 2. GOAL PROJECTION (Estimated weeks to goal, projected progress trajectory & milestones) */}
              <GoalProjectionCard
                runs={runs}
                profile={profile}
                adherence={adherence}
                best6kSec={best6kSec}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />

              {/* 3. WEEKLY TRAINING (Weekly Training Schedule: Interval, 6K Threshold Tempo, Aerobic Long Run) */}
              <WeeklyAdherenceCard
                weeklyStats={weeklyStats}
                adherence={adherence}
                runs={runs}
                onOpenAddRun={() => setIsAddRunOpen(true)}
                unit={profile.unitPreference}
                weeklyDistanceGoalKm={profile.weeklyDistanceGoalKm}
              />

              {/* 4. PERFORMANCE ANALYTICS (Recovery readiness, progression curves, aerobic base, interval training) */}
              <ProgressVisualizer
                runs={runs}
                weeklyStats={weeklyStats}
                target6kSec={profile.target6kTimeSeconds}
                targetDistanceKm={profile.targetDistanceKm}
                targetGoalName={profile.targetGoalName}
                unit={profile.unitPreference}
                maxHeartRate={profile.maxHeartRate}
                onOpenGarminSync={handleOpenGarminSync}
                onOpenAddRun={() => setIsAddRunOpen(true)}
              />

              {/* 5. FITNESS TRACKER DATA & UNIFIED ACTIVITY LOGS (Fastest Pace, Peak HR, HR Training Zones, Workout Combining, Categories & Deletion) */}
              <WatchTelemetrySection
                runs={runs}
                unit={profile.unitPreference}
                targetDistanceKm={profile.targetDistanceKm}
                target6kSec={profile.target6kTimeSeconds}
                best6kSec={best6kSec}
                customMaxHr={profile.maxHeartRate}
                onUpdateMaxHr={(val) => handleSaveProfile({ ...profile, maxHeartRate: val })}
                onDeleteRun={handleDeleteRun}
                onUpdateRunCategory={handleUpdateRunCategory}
                onUpdateRun={handleUpdateRun}
                onCombineRuns={handleCombineRuns}
                onOpenGarminSync={handleOpenGarminSync}
                onOpenAddRun={() => setIsAddRunOpen(true)}
              />
            </div>
          )}
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-black/50 py-5 text-center text-xs text-neutral-400 dark:text-neutral-500">
          <p>RunGoals · Cross Country 6K Pace & Fitness Tracker Data</p>
        </footer>

        {/* Modals */}
        <FirstTimeNameModal
          isOpen={isFirstTimeNameOpen}
          initialName={profile.displayName || (user?.displayName ? user.displayName.split(' ')[0] : '')}
          onSaveName={handleSaveFirstTimeName}
          onDismiss={handleDismissFirstTimeName}
        />

        <GarminSyncModal
          isOpen={isGarminSyncOpen}
          onClose={handleCloseGarminSync}
          userId={user ? user.uid : 'local_user'}
          unit={profile.unitPreference}
          initialIncomingRuns={preParsedGarminRuns}
          onProcessIncomingRuns={handleProcessIncomingRuns}
        />

        <DuplicateRunsModal
          isOpen={isDuplicateModalOpen}
          onClose={() => setIsDuplicateModalOpen(false)}
          duplicates={duplicateMatches}
          uniqueRunsCount={pendingUniqueRuns.length}
          onDiscardDuplicates={handleDiscardDuplicates}
          onOverwriteExisting={handleOverwriteExistingDuplicates}
          onImportAll={handleImportAllWithDuplicates}
        />

        <AiExportModal
          isOpen={isAiExportOpen}
          onClose={() => setIsAiExportOpen(false)}
          profile={profile}
          runs={runs}
          adherence={adherence}
        />

        <AddRunModal
          isOpen={isAddRunOpen}
          onClose={() => setIsAddRunOpen(false)}
          userId={user ? user.uid : 'local_user'}
          onSaveRun={handleSaveRun}
          unit={profile.unitPreference}
          targetDistanceKm={profile.targetDistanceKm}
        />

        <GoalSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          profile={profile}
          onSaveProfile={handleSaveProfile}
        />
      </div>
    </div>
  );
}
