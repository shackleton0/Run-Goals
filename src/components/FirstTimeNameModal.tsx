import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { UserCheck, Sparkles, ArrowRight, X } from 'lucide-react';

interface FirstTimeNameModalProps {
  isOpen: boolean;
  initialName?: string;
  onSaveName: (name: string) => void;
  onDismiss: () => void;
}

export const FirstTimeNameModal: React.FC<FirstTimeNameModalProps> = ({
  isOpen,
  initialName = '',
  onSaveName,
  onDismiss,
}) => {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name or nickname to continue.');
      return;
    }
    onSaveName(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#30d158]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#30d158]/15 text-[#30d158] flex items-center justify-center">
            <UserCheck className="w-5 h-5 stroke-[2.5]" />
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Skip for now"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h2 className="text-xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
            Welcome to RunGoals!
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
            What is your name? We will personalize your daily workouts, motivational check-ins, and 6K training logs.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5">
              Your Name or Nickname
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Alex, Jordan, Coach Davis"
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm font-medium text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-[#30d158] transition-colors"
            />
            {error && (
              <p className="text-[11px] text-rose-500 mt-1 font-medium">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors cursor-pointer"
            >
              Skip for now
            </button>
            <button
              type="submit"
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-[#30d158] hover:bg-[#28cd41] text-black transition-all cursor-pointer shadow-sm hover:shadow"
            >
              <span>Save & Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
