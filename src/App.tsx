/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
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
import { WeeklyAdherenceCard } from './components/WeeklyAdherenceCard';
import { ProgressVisualizer } from './components/ProgressVisualizer';
import { RunList } from './components/RunList';
import { GarminSyncModal } from './components/GarminSyncModal';
import { DuplicateRunsModal } from './components/DuplicateRunsModal';
import { AiExportModal } from './components/AiExportModal';
import { AddRunModal } from './components/AddRunModal';
import { GoalSettingsModal } from './components/GoalSettingsModal';
import { EmptyGarminState } from './components/EmptyGarminState';
import { WatchTelemetrySection } from './components/WatchTelemetrySection';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

const LOCAL_STORAGE_RUNS_KEY = 'xc_6k_user_runs_data';
const LOCAL_STORAGE_PROFILE_KEY = 'xc_6k_user_profile_data';
const LOCAL_STORAGE_THEME_KEY = 'xc_6k_theme';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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
          setProfile(userProf);

          const unsubscribeRuns = subscribeUserRuns(
            currentUser.uid,
            (cloudRuns) => {
              if (cloudRuns) {
                setRuns(cloudRuns);
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

  // Save to local storage when offline
  useEffect(() => {
    if (!user) {
      localStorage.setItem(LOCAL_STORAGE_RUNS_KEY, JSON.stringify(runs));
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
    }
  }, [runs, profile, user]);

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

  // Run updates (e.g. changing category)
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

  const handleSaveRun = async (newRun: RunRecord) => {
    const runToSave = user ? { ...newRun, userId: user.uid } : newRun;
    const isNewPr =
      best6kSec === undefined ||
      (runToSave.best6kTimeSeconds && runToSave.best6kTimeSeconds < best6kSec);

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
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google sign in error', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      setUser(null);
    } catch (err) {
      console.error('Google sign out error', err);
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="min-h-screen bg-[#f2f2f7] dark:bg-black text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors selection:bg-[#30d158] selection:text-black">
        {/* Apple-style Navigation */}
        <Navbar
          user={user}
          profile={profile}
          adherence={adherence}
          best6kSec={best6kSec}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenGarminSync={handleOpenGarminSync}
          onOpenAiExport={() => setIsAiExportOpen(true)}
          onOpenAddRun={() => setIsAddRunOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />

        {/* Minimal Cloud / Local Status */}
        <div className="bg-white/60 dark:bg-neutral-900/40 border-b border-neutral-200 dark:border-neutral-800/80 px-4 py-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {authLoading ? (
                <span className="flex items-center space-x-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-[#30d158]" />
                  <span>Connecting...</span>
                </span>
              ) : user ? (
                <span className="flex items-center space-x-1.5 text-[#30d158] font-medium">
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Firebase Synced · {user.email}</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1.5">
                  <CloudOff className="w-3.5 h-3.5 text-[#ff9f0a]" />
                  <span>Local Session ·</span>
                  <button
                    onClick={handleSignIn}
                    className="text-[#0a84ff] hover:underline font-semibold cursor-pointer"
                  >
                    Sign in with Google for cloud storage
                  </button>
                </span>
              )}
            </div>

            <div className="hidden sm:flex items-center space-x-2 text-neutral-400 dark:text-neutral-500">
              <span className="tabular-nums">{runs.length} {runs.length === 1 ? 'run' : 'runs'} logged</span>
            </div>
          </div>
        </div>

        {/* Main Dashboard */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
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
              {/* 1. TARGET SPEED THING (6K Target, Pace & Race Splits) */}
              <GoalBanner
                profile={profile}
                adherence={adherence}
                best6kSec={best6kSec}
                onEditGoal={() => setIsSettingsOpen(true)}
              />

              {/* 2. WEEKLY TRAINING (Weekly Training Schedule) */}
              <WeeklyAdherenceCard
                weeklyStats={weeklyStats}
                adherence={adherence}
                onOpenAddRun={() => setIsAddRunOpen(true)}
                unit={profile.unitPreference}
                weeklyDistanceGoalKm={profile.weeklyDistanceGoalKm}
              />

              {/* 3. PERFORMANCE ANALYTICS (Progression curves, aerobic base, interval training) */}
              <ProgressVisualizer
                runs={runs}
                weeklyStats={weeklyStats}
                target6kSec={profile.target6kTimeSeconds}
                unit={profile.unitPreference}
                onOpenGarminSync={handleOpenGarminSync}
                onOpenAddRun={() => setIsAddRunOpen(true)}
              />

              {/* 4. FITNESS TRACKER DATA (Watch Biometrics, Fastest Pace, Peak Heartbeat, HR Training Zones) */}
              <WatchTelemetrySection
                runs={runs}
                unit={profile.unitPreference}
                customMaxHr={profile.maxHeartRate}
                onUpdateMaxHr={(val) => handleSaveProfile({ ...profile, maxHeartRate: val })}
              />

              {/* 5. WORKOUT HISTORY (History log, categories, and Combine Workout tool) */}
              <RunList
                runs={runs}
                unit={profile.unitPreference}
                target6kSec={profile.target6kTimeSeconds}
                onDeleteRun={handleDeleteRun}
                onUpdateRunCategory={handleUpdateRunCategory}
                onCombineRuns={handleCombineRuns}
                best6kSec={best6kSec}
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
