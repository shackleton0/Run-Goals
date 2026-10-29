import React from 'react';
import { User } from 'firebase/auth';
import { UserProfile, AdherenceSummary } from '../types/running';
import { formatDuration } from '../utils/runningCalculations';
import {
  Trophy,
  Flame,
  UploadCloud,
  Sparkles,
  Plus,
  LogIn,
  LogOut,
  Settings,
  Activity,
  Sun,
  Moon,
  Target,
} from 'lucide-react';

interface NavbarProps {
  user: User | null;
  profile: UserProfile;
  adherence: AdherenceSummary;
  best6kSec?: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenGarminSync: () => void;
  onOpenAiExport: () => void;
  onOpenAddRun: () => void;
  onOpenSettings: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  profile,
  adherence,
  best6kSec,
  theme,
  onToggleTheme,
  onOpenGarminSync,
  onOpenAiExport,
  onOpenAddRun,
  onOpenSettings,
  onSignIn,
  onSignOut,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/85 dark:bg-black/85 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand - Apple style minimal workout identity */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#30d158] text-black flex items-center justify-center font-bold shadow-xs">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base tracking-tight text-neutral-900 dark:text-white">
                  6K XC Tracker
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                  Garmin Sync
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 hidden sm:block">
                Cross Country 6K Race Goal & 3-Run Schedule
              </p>
            </div>
          </div>

          {/* Quick Metrics (Apple pill badges) - Only shown when user has real data */}
          <div className="hidden md:flex items-center space-x-2">
            {/* 3-Run Streak Badge - Only shown when streak is active */}
            {adherence.currentStreakWeeks > 0 && (
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
                <Flame className="w-3.5 h-3.5 text-[#ff9f0a] fill-[#ff9f0a]" />
                <span className="text-neutral-500 dark:text-neutral-400">Streak:</span>
                <span className="font-semibold text-neutral-900 dark:text-white tabular-nums">
                  {adherence.currentStreakWeeks} wks
                </span>
              </div>
            )}

            {/* Target 6K Badge - Only shown if user configured a target */}
            {profile.target6kTimeSeconds && profile.target6kTimeSeconds > 0 && (
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
                <Target className="w-3.5 h-3.5 text-[#0a84ff]" />
                <span className="text-neutral-500 dark:text-neutral-400">Target 6K:</span>
                <span className="font-semibold text-neutral-900 dark:text-white tabular-nums">
                  {formatDuration(profile.target6kTimeSeconds)}
                </span>
              </div>
            )}

            {/* Current 6K PR Badge */}
            {best6kSec && (
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
                <Trophy className="w-3.5 h-3.5 text-[#30d158]" />
                <span className="text-neutral-500 dark:text-neutral-400">6K PR:</span>
                <span className="font-semibold text-[#30d158] tabular-nums">
                  {formatDuration(best6kSec)}
                </span>
              </div>
            )}
          </div>

          {/* Actions & Theme toggle */}
          <div className="flex items-center space-x-2">
            {/* Light / Dark Mode Toggle */}
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Light and Dark Mode"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-700" />
              )}
            </button>

            {/* Garmin Sync */}
            <button
              onClick={onOpenGarminSync}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 transition-colors cursor-pointer"
              title="Connect and import Garmin activities"
              aria-label="Garmin Sync"
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#0a84ff]" />
              <span className="hidden sm:inline">Garmin Sync</span>
            </button>

            {/* Export for AI */}
            <button
              onClick={onOpenAiExport}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 transition-colors cursor-pointer"
              title="Export formatted data to ask AI"
              aria-label="Export for AI"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>Export for AI</span>
            </button>

            {/* Log Run Button */}
            <button
              onClick={onOpenAddRun}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#30d158] hover:bg-[#28cd41] text-black transition-colors shadow-xs cursor-pointer"
              aria-label="Log Run"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">Log Run</span>
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-full text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Auth */}
            {user ? (
              <div className="flex items-center space-x-2 pl-1 border-l border-neutral-200 dark:border-neutral-800">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-7 h-7 rounded-full border border-neutral-300 dark:border-neutral-700"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <button
                  onClick={onSignOut}
                  className="p-1.5 rounded-full text-neutral-500 hover:text-rose-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  title="Sign Out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black transition-colors cursor-pointer"
                aria-label="Sign In"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
