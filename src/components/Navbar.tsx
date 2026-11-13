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
  Share2,
  FlaskConical,
  Trash2,
} from 'lucide-react';

interface NavbarProps {
  user: User | null;
  profile: UserProfile;
  adherence: AdherenceSummary;
  best6kSec?: number;
  theme: 'dark' | 'light';
  isGuest?: boolean;
  hasPlaceholderData?: boolean;
  onExitGuestMode?: () => void;
  onToggleTheme: () => void;
  onOpenGarminSync: () => void;
  onOpenAiExport: () => void;
  onOpenAddRun: () => void;
  onOpenSettings: () => void;
  onOpenShare?: () => void;
  onLoadPlaceholderData?: () => void;
  onClearPlaceholderData?: () => void;
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
  hasPlaceholderData = false,
  onExitGuestMode,
  onToggleTheme,
  onOpenGarminSync,
  onOpenAiExport,
  onOpenAddRun,
  onOpenSettings,
  onOpenShare,
  onLoadPlaceholderData,
  onClearPlaceholderData,
  onSignIn,
  onSignOut,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isBetaVersionOpen, setIsBetaVersionOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const betaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (betaRef.current && !betaRef.current.contains(event.target as Node)) {
        setIsBetaVersionOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#09121B]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Identity */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[#0593C6] text-[#FCFFFF] flex items-center justify-center font-bold shadow-xs">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white uppercase font-sans whitespace-nowrap">
              RUNGOALS
            </span>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2.5 shrink-0">
            {/* Beta Badge + Version Popover */}
            <div className="relative" ref={betaRef}>
              <button
                type="button"
                onClick={() => setIsBetaVersionOpen((prev) => !prev)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 min-h-[34px] rounded-xl text-[11px] font-extrabold uppercase tracking-wider bg-orange-500/15 hover:bg-orange-500/25 active:scale-[0.96] text-orange-600 dark:text-orange-400 border border-orange-500/40 transition-all cursor-pointer shadow-xs"
                aria-expanded={isBetaVersionOpen}
                aria-haspopup="true"
                title="Click to view RunGoals beta version"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                <span>Beta</span>
              </button>

              {isBetaVersionOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#0F1C28] border border-orange-500/35 shadow-2xl p-3 z-50 text-xs">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white">RunGoals</span>
                    <span className="px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400 font-mono font-extrabold text-[11px] border border-orange-500/30">
                      v1.2
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                    Beta v1.2
                  </p>
                  <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Bugs or feedback:{' '}
                    <a
                      href="mailto:lootah07070@gmail.com"
                      className="font-semibold text-orange-600 dark:text-orange-400 hover:underline"
                    >
                      lootah07070@gmail.com
                    </a>
                  </p>
                </div>
              )}
            </div>

            {/* Sync Data Action */}
            <button
              onClick={onOpenGarminSync}
              className="flex items-center space-x-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-[#0593C6] hover:bg-[#047ea8] active:scale-[0.96] text-white transition-all cursor-pointer shadow-sm"
              aria-label="Sync Data"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sync Data</span>
              <span className="sm:hidden">Sync</span>
            </button>

            {/* System / Athlete Menu Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`flex items-center space-x-2 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold border transition-all cursor-pointer active:scale-[0.96] ${
                  isDropdownOpen
                    ? 'bg-sky-50 dark:bg-sky-950/60 border-[#0EA5E9] text-slate-900 dark:text-white shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#132232] dark:hover:bg-[#182B3E] text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700'
                }`}
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600"
                  />
                ) : (
                  <Settings className="w-3.5 h-3.5 text-[#0EA5E9]" />
                )}
                <span>Menu</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-300 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    isDropdownOpen ? 'rotate-180 text-[#0EA5E9]' : ''
                  }`}
                />
              </button>

              {/* Dropdown Popover with snappy 150ms enter/exit transition */}
              <div
                className={`absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-[#0F1C28] border border-slate-200 dark:border-slate-700 shadow-2xl py-1.5 z-50 text-xs origin-top-right transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isDropdownOpen
                    ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto visible'
                    : 'opacity-0 scale-95 -translate-y-1.5 pointer-events-none invisible'
                }`}
              >
                {/* Tool Actions */}
                <div className="px-1.5 py-1 space-y-0.5">
                  {/* Log Run in Dropdown Menu */}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenAddRun();
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200/80 dark:active:bg-neutral-700/80 transition-colors text-left cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-md bg-[#10B981]/15 text-[#10B981] flex items-center justify-center group-hover:bg-[#10B981] group-hover:text-white transition-colors">
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-neutral-900 dark:text-white flex items-center justify-between">
                          <span>Log Run</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981]">New</span>
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate">Record manual workout or interval</div>
                      </div>
                    </button>

                    {/* Show Off Progress in Dropdown Menu */}
                    {onOpenShare && (
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onOpenShare();
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer group"
                      >
                        <div className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-500 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors">
                          <Share2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-neutral-900 dark:text-white flex items-center justify-between">
                            <span>Show Off Progress</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500">Badge</span>
                          </div>
                          <div className="text-[10px] text-neutral-500 truncate">Share stats & streak card with friends</div>
                        </div>
                      </button>
                    )}

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
                        <div className="font-semibold text-neutral-900 dark:text-white">Sync Data</div>
                        <div className="text-[10px] text-neutral-500 truncate">Upload Apple Watch or Garmin files</div>
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
                        <div className="font-semibold text-neutral-900 dark:text-white">Settings</div>
                        <div className="text-[10px] text-neutral-500 truncate">Goals, units, profile & appearance</div>
                      </div>
                    </button>

                    {/* Placeholder Sample Data Toggle */}
                    {hasPlaceholderData && onClearPlaceholderData ? (
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onClearPlaceholderData();
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-md bg-rose-500/15 text-rose-500 flex items-center justify-center">
                          <Trash2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold flex items-center justify-between">
                            <span>Clear Placeholder Data</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-500">Active</span>
                          </div>
                          <div className="text-[10px] text-neutral-500 truncate">Remove sample preview workouts</div>
                        </div>
                      </button>
                    ) : onLoadPlaceholderData ? (
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onLoadPlaceholderData();
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer group"
                      >
                        <div className="w-6 h-6 rounded-md bg-violet-500/15 text-violet-500 flex items-center justify-center group-hover:bg-violet-500 group-hover:text-white transition-colors">
                          <FlaskConical className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-neutral-900 dark:text-white flex items-center justify-between">
                            <span>Load Placeholder Data</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-500">Demo</span>
                          </div>
                          <div className="text-[10px] text-neutral-500 truncate">Preview dashboard with sample runs</div>
                        </div>
                      </button>
                    ) : null}
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
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
