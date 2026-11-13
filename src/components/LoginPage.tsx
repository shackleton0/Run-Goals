import React, { useState } from 'react';
import {
  Activity,
  UploadCloud,
  TrendingDown,
  Heart,
  ArrowRight,
  ShieldCheck,
  FlaskConical,
  Sun,
  Moon,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  X,
} from 'lucide-react';
import { firebaseConfig } from '../lib/firebase';

interface LoginPageProps {
  onSignIn: () => Promise<void>;
  onInstantCloudSignIn?: () => Promise<void>;
  onContinueAsGuest: () => void;
  onContinueWithPlaceholder?: () => void;
  authError: string | null;
  onClearAuthError: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSignIn,
  onInstantCloudSignIn,
  onContinueAsGuest,
  onContinueWithPlaceholder,
  authError,
  onClearAuthError,
  theme,
  onToggleTheme,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isInstantSigningIn, setIsInstantSigningIn] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const isUnauthorizedDomain = Boolean(authError && authError.startsWith('UNAUTHORIZED_DOMAIN:'));
  const unauthorizedDomain = authError && isUnauthorizedDomain
    ? authError.replace('UNAUTHORIZED_DOMAIN:', '')
    : '';

  const handleCopyDomain = () => {
    if (unauthorizedDomain) {
      navigator.clipboard.writeText(unauthorizedDomain);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    onClearAuthError();
    try {
      await onSignIn();
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleInstantSignIn = async () => {
    if (!onInstantCloudSignIn) return;
    setIsInstantSigningIn(true);
    onClearAuthError();
    try {
      await onInstantCloudSignIn();
    } finally {
      setIsInstantSigningIn(false);
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0c151c] text-neutral-900 dark:text-white flex flex-col font-sans transition-colors selection:bg-[#0593C6] selection:text-white">
        {/* Minimal Navigation Bar */}
        <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-[#0c151c]/95 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-[#0593C6] text-white flex items-center justify-center font-bold shadow-xs">
                <Activity className="w-4 h-4 stroke-[2.4]" />
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-tight text-neutral-900 dark:text-white uppercase">
                  RUNGOALS
                </span>
              </div>
            </div>

            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-800"
              aria-label="Toggle dark / light appearance"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Unauthorized Domain Guide Card */}
        {isUnauthorizedDomain && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3.5 text-xs text-amber-900 dark:text-amber-100">
            <div className="max-w-xl mx-auto space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start space-x-2.5">
                  <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900 dark:text-white">
                      Authorize Website Domain in Firebase
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">
                      Google OAuth requires your current website domain to be authorized in your Firebase project (
                      <span className="font-mono font-semibold">{firebaseConfig.projectId}</span>) before sign-in can proceed from this URL.
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClearAuthError}
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white p-1 cursor-pointer"
                  aria-label="Dismiss banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step by step box */}
              <div className="bg-white/80 dark:bg-black/40 rounded-xl p-3 border border-amber-500/25 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Current Domain:</span>
                    <code className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono text-[11px] font-bold">
                      {unauthorizedDomain}
                    </code>
                  </div>
                  <button
                    onClick={handleCopyDomain}
                    className="px-2.5 py-1 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold text-[11px] flex items-center space-x-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDomain ? 'Domain Copied!' : 'Copy Domain'}</span>
                  </button>
                </div>

                <ol className="text-[11px] text-neutral-700 dark:text-neutral-300 list-decimal list-inside space-y-1">
                  <li>
                    Open Firebase Settings:{' '}
                    <a
                      href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0593C6] dark:text-[#38bdf8] font-bold underline inline-flex items-center space-x-1"
                    >
                      <span>Authorized Domains Console ↗</span>
                    </a>
                  </li>
                  <li>Under <span className="font-semibold">Authorized domains</span>, click <span className="font-semibold">Add domain</span>.</li>
                  <li>Paste <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">{unauthorizedDomain}</code> and save.</li>
                </ol>
              </div>

              {/* Actions row */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isSigningIn}
                    className="px-3 py-1.5 rounded-lg bg-[#0593C6] hover:bg-[#047ea8] text-white font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSigningIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Retry Sign-In</span>
                  </button>
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer border border-neutral-300 dark:border-neutral-700"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Firebase Console</span>
                  </a>
                </div>

                <button
                  onClick={onContinueAsGuest}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Use Guest Mode (Zero Setup Needed)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Standard Auth Error Banner */}
        {!isUnauthorizedDomain && authError && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/80 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
            <div className="max-w-xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                <span>{authError}</span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                >
                  {isSigningIn ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  <span>Retry</span>
                </button>
                <button
                  onClick={onContinueAsGuest}
                  className="px-2.5 py-1 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-semibold text-xs hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                >
                  Guest Mode
                </button>
                <button
                  onClick={onClearAuthError}
                  className="text-xs font-semibold underline text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 ml-1 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Hero & Auth Portal */}
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center justify-center">
          {/* Main Card */}
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111c24] border border-neutral-200 dark:border-neutral-800 shadow-xl p-6 sm:p-8 transition-colors">
            {/* Logo Badge */}
            <div className="flex flex-col items-center text-center space-y-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-[#0593C6]/10 text-[#0593C6] flex items-center justify-center border border-[#0593C6]/20 shadow-xs">
                <Activity className="w-6 h-6 stroke-[2.4]" />
              </div>

              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
                  Cross Country Performance Portal
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Collegiate & distance athlete training telemetry, Garmin fitness watch synchronization, and empirical 6K pace tracking.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Primary: Google Sign In */}
              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="w-full py-3 px-4 rounded-xl bg-[#0593C6] hover:bg-[#047ea8] text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-2.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting Athlete Account...</span>
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center p-0.5 shrink-0">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
                    <span>Sign in with Google Account</span>
                  </>
                )}
              </button>

              {/* Instant Cloud Athlete Account (1-Click Firestore Sync) */}
              {onInstantCloudSignIn && (
                <button
                  onClick={handleInstantSignIn}
                  disabled={isSigningIn || isInstantSigningIn}
                  className="w-full py-2.5 px-4 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-[#0593C6] dark:text-[#38bdf8] border border-[#0593C6]/30 font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                  title="Connect immediately to Firebase Firestore cloud storage with 1 click"
                >
                  {isInstantSigningIn ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Connecting Cloud Database...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4 text-[#0593C6]" />
                      <span>Instant Cloud Athlete Account (1-Click Sync)</span>
                    </>
                  )}
                </button>
              )}

              {/* Divider */}
              <div className="relative py-2 flex items-center justify-center">
                <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
                <span className="absolute px-3 bg-white dark:bg-[#111c24] text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Or
                </span>
              </div>

              {/* Secondary: Guest Access */}
              <button
                onClick={onContinueAsGuest}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-semibold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer group"
              >
                <FlaskConical className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Continue in Guest / Evaluation Mode</span>
                <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {onContinueWithPlaceholder && (
                <button
                  onClick={onContinueWithPlaceholder}
                  className="w-full py-2 px-4 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/25 text-violet-700 dark:text-violet-300 font-semibold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-violet-500" />
                  <span>Preview with Placeholder Data</span>
                </button>
              )}

              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 text-center pt-1">
                Guest mode persists data locally in browser storage. You can authenticate later to sync to cloud.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="mt-6 pt-5 border-t border-neutral-100 dark:border-neutral-800 space-y-2.5">
              <div className="flex items-center space-x-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                <UploadCloud className="w-4 h-4 text-[#0593C6] shrink-0" />
                <span>Upload Garmin .TCX, .GPX, and .CSV workout files</span>
              </div>
              <div className="flex items-center space-x-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                <TrendingDown className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>Empirical 6K split calculations and pace cutoff gaps</span>
              </div>
              <div className="flex items-center space-x-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                <Heart className="w-4 h-4 text-[#0593C6] shrink-0" />
                <span>5-zone cardiovascular training distribution & recovery status</span>
              </div>
            </div>
          </div>

          {/* Security & Reliability Footer Note */}
          <div className="mt-5 flex items-center space-x-2 text-[11px] text-neutral-400 dark:text-neutral-500">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0593C6]" />
            <span>Secure Firebase Firestore cloud database · Direct Garmin watch telemetry</span>
          </div>
        </main>
      </div>
    </div>
  );
};
