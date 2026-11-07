import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, RunRecord, AdherenceSummary } from '../types/running';
import {
  formatDuration,
  formatPace,
  calculateRealImprovement,
  calculateCategoryBreakdown,
  groupRunsByWeek,
  KM_TO_MILES,
} from '../utils/runningCalculations';
import {
  Share2,
  Copy,
  Check,
  Download,
  Flame,
  Trophy,
  Activity,
  Zap,
  Sparkles,
  X,
  Target,
  TrendingUp,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ShareProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  runs: RunRecord[];
  adherence: AdherenceSummary;
  best6kSec?: number;
}

type CardTheme = 'garmin' | 'neon' | 'forest' | 'ruby';

export const ShareProgressModal: React.FC<ShareProgressModalProps> = ({
  isOpen,
  onClose,
  profile,
  runs,
  adherence,
  best6kSec,
}) => {
  const [selectedTheme, setSelectedTheme] = useState<CardTheme>('garmin');
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate runner metrics
  const improvement = calculateRealImprovement(runs);
  const breakdown30d = calculateCategoryBreakdown(runs, 30);
  const totalKm = runs.reduce((acc, r) => acc + r.distanceKm, 0);
  const weekGrouping = groupRunsByWeek(runs, profile.weeklyRunGoal || 3);
  const currentWeekDist = weekGrouping.weeklyStats[0]?.totalDistanceKm || 0;
  const runnerName = profile.displayName || 'Cross Country Athlete';
  const targetTimeSec = profile.target6kTimeSeconds || 1260; // default 21:00
  const targetPaceSec = Math.round(targetTimeSec / (profile.targetDistanceKm || 6));
  const bestPaceSec = best6kSec ? Math.round(best6kSec / (profile.targetDistanceKm || 6)) : null;

  // Trigger celebration confetti when modal opens
  useEffect(() => {
    if (isOpen) {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#0593C6', '#10B981', '#F59E0B', '#8B5CF6'],
        });
      } catch {
        // canvas-confetti fallback
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Theme palettes for visual card preview & canvas rendering
  const themeStyles = {
    garmin: {
      id: 'garmin',
      name: 'Garmin Cyan',
      bgGradient: 'from-[#081726] via-[#0c1f33] to-[#052b48]',
      canvasBgTop: '#081726',
      canvasBgBottom: '#052b48',
      accent: '#0593C6',
      accentText: 'text-[#38bdf8]',
      accentBorder: 'border-[#0593C6]',
      accentBg: 'bg-[#0593C6]',
      badgeBg: 'bg-[#0593C6]/20 text-[#38bdf8] border-[#0593C6]/40',
    },
    neon: {
      id: 'neon',
      name: 'Track Gold',
      bgGradient: 'from-[#1a1500] via-[#241d04] to-[#120f02]',
      canvasBgTop: '#1a1500',
      canvasBgBottom: '#120f02',
      accent: '#F59E0B',
      accentText: 'text-amber-400',
      accentBorder: 'border-amber-500',
      accentBg: 'bg-amber-500',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    },
    forest: {
      id: 'forest',
      name: 'XC Forest',
      bgGradient: 'from-[#031c12] via-[#062c1d] to-[#02140d]',
      canvasBgTop: '#031c12',
      canvasBgBottom: '#02140d',
      accent: '#10B981',
      accentText: 'text-emerald-400',
      accentBorder: 'border-emerald-500',
      accentBg: 'bg-emerald-500',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    ruby: {
      id: 'ruby',
      name: 'Race Ruby',
      bgGradient: 'from-[#200508] via-[#330a10] to-[#150305]',
      canvasBgTop: '#200508',
      canvasBgBottom: '#150305',
      accent: '#EF4444',
      accentText: 'text-rose-400',
      accentBorder: 'border-rose-500',
      accentBg: 'bg-rose-500',
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    },
  };

  const activeTheme = themeStyles[selectedTheme];

  // Generate shareable message text
  const shareText = `🏃 ${runnerName}'s XC Training Dossier
🎯 Goal: ${formatDuration(targetTimeSec)} (${formatPace(targetPaceSec, profile.unitPreference)})
${best6kSec ? `⚡ Current Best 6K: ${formatDuration(best6kSec)} (${formatPace(bestPaceSec!, profile.unitPreference)})` : ''}
🔥 Streak: ${adherence.currentStreakWeeks} Weeks Active
👟 Weekly Mileage: ${currentWeekDist.toFixed(1)} km / ${profile.weeklyDistanceGoalKm || 30} km
📈 Improvement: ${improvement ? `${improvement.statusText}` : 'Training in progress'}
📊 Total Logged: ${totalKm.toFixed(1)} km across ${runs.length} workouts
#CrossCountry #XC #RunGoals #Garmin #Running`;

  // Draw card to HTML5 Canvas for high-res PNG download / clipboard copy
  const renderCardToCanvas = (): HTMLCanvasElement | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const width = 1080;
    const height = 1080;
    canvas.width = width;
    canvas.height = height;

    // 1. Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, activeTheme.canvasBgTop);
    bgGrad.addColorStop(1, activeTheme.canvasBgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle background mesh pattern / circles
    ctx.strokeStyle = `${activeTheme.accent}20`;
    ctx.lineWidth = 1.5;
    for (let r = 200; r <= 800; r += 120) {
      ctx.beginPath();
      ctx.arc(width - 150, 150, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Top branding badge
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('RUNGOALS', 80, 110);

    ctx.fillStyle = activeTheme.accent;
    ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('XC 6K PERFORMANCE', 320, 110);

    // Athlete Name Header
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 64px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(runnerName, 80, 190);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`Collegiate & Distance Training Telemetry · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, 80, 235);

    // Separator line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 270);
    ctx.lineTo(width - 80, 270);
    ctx.stroke();

    // 2. Main Stat Cards Grid
    const drawStatCard = (
      x: number,
      y: number,
      w: number,
      h: number,
      label: string,
      value: string,
      subvalue: string,
      highlightColor: string
    ) => {
      // Rounded Card Box
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 24);
      ctx.fill();
      ctx.stroke();

      // Accent pill on top of card
      ctx.fillStyle = highlightColor;
      ctx.beginPath();
      ctx.roundRect(x + 28, y + 28, 8, 28, 4);
      ctx.fill();

      // Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(label.toUpperCase(), x + 48, y + 50);

      // Value
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 54px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(value, x + 28, y + 125);

      // Subvalue
      ctx.fillStyle = highlightColor;
      ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(subvalue, x + 28, y + 170);
    };

    const cardW = 440;
    const cardH = 200;

    // Card 1: 6K Target Goal
    drawStatCard(
      80,
      310,
      cardW,
      cardH,
      '6K Target Benchmark',
      formatDuration(targetTimeSec),
      `Target Pace: ${formatPace(targetPaceSec, profile.unitPreference)}`,
      activeTheme.accent
    );

    // Card 2: Current Best / Projected
    drawStatCard(
      560,
      310,
      cardW,
      cardH,
      best6kSec ? 'Personal Best 6K' : 'Training Projection',
      best6kSec ? formatDuration(best6kSec) : 'In Progress',
      best6kSec ? `Pace: ${formatPace(bestPaceSec!, profile.unitPreference)}` : 'Log runs to calibrate',
      '#10B981'
    );

    // Card 3: Consistency Streak
    drawStatCard(
      80,
      540,
      cardW,
      cardH,
      'Consistency Streak',
      `${adherence.currentStreakWeeks} WEEKS`,
      `${adherence.currentWeekRuns} workouts this week`,
      '#F59E0B'
    );

    // Card 4: Weekly Distance Volume
    drawStatCard(
      560,
      540,
      cardW,
      cardH,
      'Weekly Volume',
      `${currentWeekDist.toFixed(1)} KM`,
      `Goal: ${profile.weeklyDistanceGoalKm || 30} km target`,
      '#8B5CF6'
    );

    // Bottom Banner: Trajectory & Total Logged
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = activeTheme.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(80, 770, width - 160, 160, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('PROGRESS TRAJECTORY', 115, 825);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
    const improvementText = improvement
      ? `${improvement.statusText} · Pace trend calibrated across separate training days`
      : 'Building aerobic consistency base. Log additional workouts to unlock real improvement trend.';
    ctx.fillText(improvementText.slice(0, 75), 115, 875);

    ctx.fillStyle = activeTheme.accent;
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`TOTAL LIFETIME MILEAGE: ${totalKm.toFixed(1)} KM (${runs.length} WORKOUTS)`, 115, 908);

    // Footer Watermark
    ctx.fillStyle = '#64748b';
    ctx.font = '500 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Generated with RunGoals · Garmin & XC 6K Tracker', 80, 1010);

    return canvas;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleCopyImage = async () => {
    try {
      const canvas = renderCardToCanvas();
      if (!canvas) return;

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setCopiedImage(true);
          setTimeout(() => setCopiedImage(false), 2500);
        } catch {
          // If direct clipboard write is restricted by browser permissions, fallback to download
          handleDownloadCard();
        }
      });
    } catch {
      // fallback
    }
  };

  const handleDownloadCard = () => {
    setDownloading(true);
    try {
      const canvas = renderCardToCanvas();
      if (!canvas) return;

      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${runnerName.toLowerCase().replace(/\s+/g, '_')}_6k_progress_card.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${runnerName}'s XC 6K Progress Card`,
          text: shareText,
          url: window.location.href,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopyText();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Hidden canvas for drawing high-res export image */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0c1822] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-[#0f1f2c]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0593C6]/15 text-[#0593C6] flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
                <span>Show Off Your Progress</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
                  Athlete Badge
                </span>
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Share your 6K targets, mileage streak, and training trajectory with teammates & friends
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Theme Selector */}
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              Card Style Theme:
            </span>
            <div className="flex items-center space-x-1.5">
              {(Object.keys(themeStyles) as CardTheme[]).map((thm) => (
                <button
                  key={thm}
                  onClick={() => setSelectedTheme(thm)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedTheme === thm
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                      : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {themeStyles[thm].name}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Card */}
          <div
            className={`p-5 sm:p-6 rounded-2xl bg-gradient-to-br ${activeTheme.bgGradient} border border-neutral-700/60 shadow-xl text-white relative overflow-hidden select-none`}
          >
            {/* Ambient Background Circle */}
            <div
              className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-25 pointer-events-none"
              style={{ backgroundColor: activeTheme.accent }}
            />

            {/* Card Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center font-bold">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className="text-xs font-black tracking-wider uppercase">RUNGOALS</span>
                  <span className="text-[10px] ml-1.5 font-bold px-1.5 py-0.5 rounded-sm bg-white/10 text-white/80">
                    XC 6K
                  </span>
                </div>
              </div>

              <div className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${activeTheme.badgeBg}`}>
                {adherence.currentStreakWeeks > 0 ? `${adherence.currentStreakWeeks} Week Streak 🔥` : 'Active Runner'}
              </div>
            </div>

            {/* Runner Identity */}
            <div className="pt-4 pb-3 relative z-10">
              <h4 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {runnerName}
              </h4>
              <p className="text-xs text-white/60 font-medium">
                Distance Telemetry · {runs.length} Workouts Logged ({totalKm.toFixed(1)} km)
              </p>
            </div>

            {/* 4 Key Stat Badges */}
            <div className="grid grid-cols-2 gap-3 pt-2 relative z-10">
              {/* Stat 1: 6K Goal */}
              <div className="p-3 rounded-xl bg-black/35 backdrop-blur-xs border border-white/10">
                <div className="flex items-center space-x-1.5 text-[10px] font-bold text-white/60 uppercase">
                  <Target className="w-3 h-3 text-[#38bdf8]" />
                  <span>Target 6K</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums">
                  {formatDuration(targetTimeSec)}
                </div>
                <div className="text-[11px] font-semibold text-white/70">
                  {formatPace(targetPaceSec, profile.unitPreference)} pace
                </div>
              </div>

              {/* Stat 2: Current Best */}
              <div className="p-3 rounded-xl bg-black/35 backdrop-blur-xs border border-white/10">
                <div className="flex items-center space-x-1.5 text-[10px] font-bold text-white/60 uppercase">
                  <Trophy className="w-3 h-3 text-amber-400" />
                  <span>Current Best</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums">
                  {best6kSec ? formatDuration(best6kSec) : '--:--'}
                </div>
                <div className="text-[11px] font-semibold text-white/70">
                  {best6kSec ? `${formatPace(bestPaceSec!, profile.unitPreference)} pace` : 'Awaiting baseline'}
                </div>
              </div>

              {/* Stat 3: Weekly Consistency */}
              <div className="p-3 rounded-xl bg-black/35 backdrop-blur-xs border border-white/10">
                <div className="flex items-center space-x-1.5 text-[10px] font-bold text-white/60 uppercase">
                  <Flame className="w-3 h-3 text-orange-400" />
                  <span>Weekly Runs</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums">
                  {adherence.currentWeekRuns} / {profile.weeklyRunGoal || 3}
                </div>
                <div className="text-[11px] font-semibold text-emerald-400">
                  {adherence.currentWeekRuns >= (profile.weeklyRunGoal || 3) ? 'Goal Hit! 🎯' : 'On track'}
                </div>
              </div>

              {/* Stat 4: Weekly Distance */}
              <div className="p-3 rounded-xl bg-black/35 backdrop-blur-xs border border-white/10">
                <div className="flex items-center space-x-1.5 text-[10px] font-bold text-white/60 uppercase">
                  <Activity className="w-3 h-3 text-purple-400" />
                  <span>Weekly Distance</span>
                </div>
                <div className="flex items-baseline space-x-1 mt-1">
                  <span className="text-xl sm:text-2xl font-black text-white tabular-nums">
                    {currentWeekDist.toFixed(1)}
                  </span>
                  <span className="text-xs font-bold text-white/60">km</span>
                </div>
                <div className="text-[11px] font-semibold text-white/70">
                  of {profile.weeklyDistanceGoalKm || 30} km target
                </div>
              </div>
            </div>

            {/* Improvement Banner */}
            <div className="mt-3 p-3 rounded-xl bg-black/45 border border-white/10 relative z-10 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-white/90">
                  {improvement ? improvement.statusText : 'Aerobic base building in progress'}
                </span>
              </div>
              <span className="text-[10px] font-mono text-white/50 hidden sm:inline">
                RunGoals Telemetry
              </span>
            </div>
          </div>

          {/* Social Caption Preview Box */}
          <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-[#12222f] border border-neutral-200 dark:border-neutral-800 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-neutral-800 dark:text-neutral-200">
                Ready-to-Paste Message Caption:
              </span>
              <button
                onClick={handleCopyText}
                className="flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 cursor-pointer transition-colors"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>
            <pre className="font-mono text-[11px] text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap select-all leading-relaxed bg-white/70 dark:bg-black/30 p-2.5 rounded-lg border border-neutral-200/70 dark:border-neutral-800">
              {shareText}
            </pre>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#0f1f2c]">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 hidden sm:block">
            Paste in group chats, Instagram, or Discord
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            {/* Native Share on mobile or supported browsers */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNativeShare}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0593C6] hover:bg-[#047da8] text-white cursor-pointer shadow-xs transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share App</span>
              </button>
            )}

            {/* Copy Card Image to Clipboard */}
            <button
              onClick={handleCopyImage}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
            >
              {copiedImage ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500 font-bold">Image Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Image</span>
                </>
              )}
            </button>

            {/* Download PNG */}
            <button
              onClick={handleDownloadCard}
              disabled={downloading}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 cursor-pointer shadow-xs transition-opacity"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'Exporting...' : 'Save Badge (PNG)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
