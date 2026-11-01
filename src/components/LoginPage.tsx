import React, { useState } from 'react';
import {
  Activity,
  UploadCloud,
  TrendingDown,
  Heart,
  Calendar,
  ArrowRight,
  ShieldCheck,
  FlaskConical,
  Sun,
  Moon,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface LoginPageProps {
  onSignIn: () => Promise<void>;
  onContinueAsGuest: () => void;
  authError: string | null;
  onClearAuthError: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSignIn,
  onContinueAsGuest,
  authError,
  onClearAuthError,
  theme,
  onToggleTheme,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    onClearAuthError();
    try {
      await onSignIn();
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="min-h-screen bg-[#F2F8FB] dark:bg-[#0c1822] text-neutral-900 dark:text-[#FCFFFF] flex flex-col font-sans transition-colors selection:bg-[#0593C6] selection:text-[#FCFFFF]">
        {/* Minimal Navigation Bar */}
        <header className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-[#FCFFFF]/80 dark:bg-[#0c1822]/80 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#0593C6] text-[#FCFFFF] flex items-center justify-center font-bold shadow-xs">
                <Activity className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-neutral-900 dark:text-[#FCFFFF]">
                RunGoals
              </span>
            </div>

            <button
              onClick={onToggleTheme}
              className="p-2 rounded-full text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-[#FCFFFF] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              aria-label="Toggle dark / light theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Auth Error Banner */}
        {authError && (
          <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800/80 px-4 py-2 text-xs text-red-700 dark:text-red-300">
            <div className="max-w-md mx-auto flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{authError}</span>
              </div>
              <button
                onClick={onClearAuthError}
                className="text-xs font-semibold underline ml-2 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Main Hero & Auth Portal */}
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center justify-center">
          {/* Main Card */}
          <div className="w-full max-w-lg rounded-3xl bg-[#FCFFFF] dark:bg-[#12222f] border border-neutral-200/90 dark:border-neutral-800 shadow-xl p-6 sm:p-10 transition-colors">
            {/* Logo Badge */}
            <div className="flex flex-col items-center text-center space-y-3 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-[#0593C6]/10 text-[#0593C6] flex items-center justify-center shadow-inner">
                <Activity className="w-7 h-7 stroke-[2.5]" />
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-[#FCFFFF] tracking-tight">
                  Welcome to RunGoals
                </h1>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Cross country 6K pacing, Garmin fitness watch analytics, and empirical goal projections.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Primary: Google Sign In */}
              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#0593C6] hover:bg-[#047ea8] text-[#FCFFFF] font-bold text-sm flex items-center justify-center space-x-3 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting Google Account...</span>
                  </>
                ) : (
                  <>
                    {/* Official Google G Logo */}
                    <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center p-0.5 shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    </div>
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative py-2 flex items-center justify-center">
                <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
                <span className="absolute px-3 bg-[#FCFFFF] dark:bg-[#12222f] text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Or
                </span>
              </div>

              {/* Secondary / Testing: Guest Option with subtle green accent */}
              <button
                onClick={onContinueAsGuest}
                className="w-full py-3 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-[#FCFFFF] font-bold text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer group"
              >
                <FlaskConical className="w-4 h-4 text-[#10B981] group-hover:scale-110 transition-transform" />
                <span>Continue as Guest (for testing)</span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 text-center pt-1">
                Guest testing saves your workouts locally in your browser. You can sign in anytime later.
              </p>
            </div>

            {/* Feature Pills */}
            <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800/80 space-y-2.5">
              <div className="flex items-center space-x-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                <UploadCloud className="w-4 h-4 text-[#0593C6] shrink-0" />
                <span>Upload Garmin .TCX, .GPX, and .CSV files directly</span>
              </div>
              <div className="flex items-center space-x-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                <TrendingDown className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>Calculates empirical 6K splits and weeks remaining</span>
              </div>
              <div className="flex items-center space-x-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                <Heart className="w-4 h-4 text-[#0593C6] shrink-0" />
                <span>Z1 to Z5 physiological heart rate training distribution</span>
              </div>
            </div>
          </div>

          {/* Security & Reliability Footer Note */}
          <div className="mt-6 flex items-center space-x-2 text-[11px] text-neutral-400 dark:text-neutral-500">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0593C6]" />
            <span>Encrypted cloud database · Firebase Auth protected · Authentic Garmin data</span>
          </div>
        </main>
      </div>
    </div>
  );
};
