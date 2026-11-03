import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { UserProfile, AdherenceSummary } from '../types/running';
import {
  UploadCloud,
  FileText,
  Plus,
  LogIn,
  LogOut,
  Settings,
  Activity,
  Sun,
  Moon,
  ChevronDown,
  Flame,
} from 'lucide-react';

interface NavbarProps {
  user: User | null;
  profile: UserProfile;
  adherence: AdherenceSummary;
  best6kSec?: number;
  theme: 'dark' | 'light';
  isGuest?: boolean;
  onExitGuestMode?: () => void;
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
  isGuest,
  onExitGuestMode,
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
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0c151c]/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Identity */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[#0593C6] text-white flex items-center justify-center font-bold shadow-xs">
              <Activity className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-neutral-900 dark:text-white uppercase font-sans">
                  RunGoals
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-[#0593C6]/10 text-[#0593C6] dark:text-[#38bdf8] uppercase tracking-wider">
                  XC 6K
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium hidden sm:block">
                Collegiate & Distance Performance Telemetry
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Sync Garmin Action */}
            <button
              onClick={onOpenGarminSync}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0593C6] hover:bg-[#047da8] text-white transition-colors cursor-pointer shadow-xs"
              aria-label="Sync Garmin"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sync Garmin</span>
              <span className="sm:hidden">Sync</span>
            </button>

            {/* Quick Log Run Action */}
            <button
              onClick={onOpenAddRun}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#10B981] hover:bg-[#059669] text-white transition-colors cursor-pointer shadow-xs"
              aria-label="Log Run"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">Log Run</span>
              <span className="sm:hidden">Log</span>
            </button>

            {/* System / Athlete Menu Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  isDropdownOpen
                    ? 'bg-neutral-100 dark:bg-neutral-800 border-[#0593C6] text-neutral-900 dark:text-white'
                    : 'bg-white hover:bg-neutral-100 dark:bg-[#111c24] dark:hover:bg-[#16232e] text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-neutral-800'
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
                <span className="hidden sm:inline">Menu</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Popover */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-[#111c24] border border-neutral-200 dark:border-neutral-800 shadow-xl py-1.5 z-50 text-xs transition-all">
                  {/* Tool Actions */}
                  <div className="px-1.5 py-1 space-y-0.5">
                    {/* Training Dossier in Menu Dropdown */}
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenAiExport();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer group"
                    >
                      <div className="w-6 h-6 rounded-md bg-[#0593C6]/10 text-[#0593C6] flex items-center justify-center group-hover:bg-[#0593C6] group-hover:text-white transition-colors">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-neutral-900 dark:text-white flex items-center justify-between">
                          <span>Training Dossier</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#0593C6]/10 text-[#0593C6]">AI / Export</span>
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate">Coach prompt, CSV, JSON backup</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenGarminSync();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-md bg-[#0593C6]/10 text-[#0593C6] flex items-center justify-center">
                        <UploadCloud className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-neutral-900 dark:text-white">Garmin & Watch Sync</div>
                        <div className="text-[10px] text-neutral-500 truncate">Upload FIT/CSV training files</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center">
                        <Settings className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-neutral-900 dark:text-white">Athlete Profile Settings</div>
                        <div className="text-[10px] text-neutral-500 truncate">Pace targets, goals, distance units</div>
                      </div>
                    </button>
                  </div>

                  {/* Preferences: Theme Toggle */}
                  <div className="border-t border-neutral-200 dark:border-neutral-800 my-1 px-1.5 pt-1">
                    <button
                      onClick={onToggleTheme}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-6 h-6 rounded-md bg-[#0593C6]/10 text-[#0593C6] flex items-center justify-center">
                          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                        </div>
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          {theme === 'dark' ? 'Light Appearance' : 'Dark Appearance'}
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
                            {user.displayName || 'Athletic Member'}
                          </div>
                          <div className="text-[10px] text-neutral-500 truncate">{user.email}</div>
                        </div>
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            onSignOut();
                          }}
                          className="p-1.5 rounded-md text-neutral-400 hover:text-rose-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                          title="Sign Out"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            onSignIn();
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-[#0593C6] hover:bg-[#0593C6]/10 transition-colors text-left font-semibold cursor-pointer"
                        >
                          <LogIn className="w-4 h-4" />
                          <span>Sign In with Google</span>
                        </button>

                        {isGuest && onExitGuestMode && (
                          <button
                            onClick={() => {
                              setIsDropdownOpen(false);
                              onExitGuestMode();
                            }}
                            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left font-medium cursor-pointer"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Return to Portal</span>
                          </button>
                        )}
                      </div>
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
