import React, { useState } from 'react';
import { UserProfile } from '../types/running';
import { Flame, RotateCcw } from 'lucide-react';

interface MotivationalGreetingProps {
  profile: UserProfile;
  weeklyRunsCount: number;
  weeklyGoal: number;
  streakWeeks: number;
  onOpenSettings?: () => void;
}

const MOTIVATIONAL_MESSAGES = [
  'stay locked in.',
  'good progress on your 6K build.',
  'every rep counts today — keep the pace honest.',
  'consistency is where speed is forged. Let’s get after it.',
  'great work stacking aerobic miles. The breakthrough is coming.',
  'eyes on the goal — stay disciplined and attack the hills.',
  'great momentum this week. Make today’s workout count.',
  'keep pushing that lactate threshold higher.',
  'trust the training. You are closer to your goal than yesterday.',
  'lace up and execute. Another step toward the PR.',
  'strong aerobic foundation builds championship finishes.',
  'stay smooth, stay relaxed, and stay locked in.',
];

export const MotivationalGreeting: React.FC<MotivationalGreetingProps> = ({
  profile,
  weeklyRunsCount,
  weeklyGoal,
  streakWeeks,
  onOpenSettings,
}) => {
  const [quoteIndex, setQuoteIndex] = useState<number>(() => {
    const saved = sessionStorage.getItem('xc_greeting_idx');
    if (saved !== null) {
      return parseInt(saved, 10) % MOTIVATIONAL_MESSAGES.length;
    }
    const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length);
    sessionStorage.setItem('xc_greeting_idx', randomIndex.toString());
    return randomIndex;
  });

  const nextQuote = () => {
    setQuoteIndex((prev) => {
      const next = (prev + 1) % MOTIVATIONAL_MESSAGES.length;
      sessionStorage.setItem('xc_greeting_idx', next.toString());
      return next;
    });
  };

  const runnerName = profile.displayName?.trim() || 'Runner';
  const message = MOTIVATIONAL_MESSAGES[quoteIndex];

  return (
    <div className="rounded-2xl bg-gradient-to-r from-[#FF6B00] via-[#F25C00] to-[#E05000] text-[#FCFFFF] p-4 sm:p-5 shadow-sm border border-orange-500/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative overflow-hidden">
      {/* Decorative subtle texture glow */}
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start sm:items-center space-x-3.5 min-w-0 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs text-[#FCFFFF] flex items-center justify-center shrink-0 border border-white/25 shadow-xs">
          <Flame className="w-5 h-5 fill-white" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-[#FCFFFF] drop-shadow-xs">
              Hey {runnerName}, {message}
            </h1>
          </div>
          <p className="text-xs text-white/90 mt-0.5 flex flex-wrap items-center gap-x-2">
            <span>
              Week progress: <strong className="text-white font-bold">{weeklyRunsCount} of {weeklyGoal} runs</strong>
            </span>
            {streakWeeks > 1 && (
              <>
                <span>·</span>
                <span className="bg-black/15 px-2 py-0.5 rounded-full font-semibold text-[#FCFFFF] text-[11px]">
                  {streakWeeks} week streak
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0 relative z-10">
        <button
          type="button"
          onClick={nextQuote}
          title="New motivational message"
          className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
          aria-label="Shuffle motivation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        {onOpenSettings && !profile.displayName && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-xs font-bold text-white underline hover:no-underline cursor-pointer"
          >
            Set Name
          </button>
        )}
      </div>
    </div>
  );
};
