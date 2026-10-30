import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  User as UserIcon,
  Check,
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Software Name: Simple, clean "RunGoals" */}
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#30d158] text-black flex items-center justify-center font-bold shadow-xs">
              <Activity className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-bold text-lg tracking-tight text-neutral-900 dark:text-white">
              RunGoals
            </span>
          </div>

          {/* Clean Right Actions: Quick Log Run + Unified Tools & Info Dropdown */}
          <div className="flex items-center space-x-2.5">
            {/* Quick Log Run Action */}
            <button
              onClick={onOpenAddRun}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#30d158] hover:bg-[#28cd41] text-black transition-colors shadow-xs cursor-pointer"
              aria-label="Log Run"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Log Run</span>
            </button>

            {/* Tools & Info Dropdown Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  isDropdownOpen
                    ? 'bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white'
                    : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-neutral-800'
                }`}
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-700"
                  />
                ) : (
                  <Settings className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
                )}
                <span>Tools & Info</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Popover */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800 shadow-2xl py-2 z-50 text-xs transition-all animate-in fade-in zoom-in-95">
                  {/* Tool Actions */}
                  <div className="px-1.5 py-1 space-y-0.5">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenGarminSync();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors text-left cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-[#0a84ff]/10 text-[#0a84ff] flex items-center justify-center">
                        <UploadCloud className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-neutral-900 dark:text-white">Fitness Tracker Sync</div>
                        <div className="text-[10px] text-neutral-500">Upload & select activities</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenAiExport();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors text-left cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-neutral-900 dark:text-white">Export for AI</div>
                        <div className="text-[10px] text-neutral-500">Prompt for ChatGPT, Claude, Gemini</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors text-left cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center">
                        <Settings className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-neutral-900 dark:text-white">Settings</div>
                        <div className="text-[10px] text-neutral-500">Preferences and units</div>
                      </div>
                    </button>
                  </div>

                  {/* Preferences: Theme Toggle */}
                  <div className="border-t border-neutral-200 dark:border-neutral-800 my-1 px-1.5 pt-1">
                    <button
                      onClick={onToggleTheme}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                        </div>
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400 capitalize">{theme}</span>
                    </button>
                  </div>

                  {/* Account / Auth */}
                  <div className="border-t border-neutral-200 dark:border-neutral-800 my-1 px-1.5 pt-1">
                    {user ? (
                      <div className="px-3 py-2 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold text-neutral-900 dark:text-white truncate">
                            {user.displayName || 'Google User'}
                          </div>
                          <div className="text-[10px] text-neutral-500 truncate">{user.email}</div>
                        </div>
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            onSignOut();
                          }}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                          title="Sign Out"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onSignIn();
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-[#0a84ff] hover:bg-[#0a84ff]/10 transition-colors text-left font-semibold cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>Sign In with Google</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
