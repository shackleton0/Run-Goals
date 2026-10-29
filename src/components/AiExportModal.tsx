import React, { useState } from 'react';
import { UserProfile, RunRecord, AdherenceSummary } from '../types/running';
import { generateAiExportText, formatDuration, formatPace } from '../utils/runningCalculations';
import {
  X,
  Sparkles,
  Copy,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  Bot,
  Send,
} from 'lucide-react';

interface AiExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  runs: RunRecord[];
  adherence: AdherenceSummary;
}

export const AiExportModal: React.FC<AiExportModalProps> = ({
  isOpen,
  onClose,
  profile,
  runs,
  adherence,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'prompt' | 'coach' | 'raw'>('prompt');
  const [coachQuestion, setCoachQuestion] = useState('');
  const [coachAnswer, setCoachAnswer] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);

  if (!isOpen) return null;

  const exportText = generateAiExportText(profile, runs, adherence);

  const handleCopy = () => {
    navigator.clipboard.writeText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJson = () => {
    const data = {
      profile,
      adherence,
      runs,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xc_6k_training_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    const headers = [
      'ID',
      'Date',
      'Title',
      'RunType',
      'DistanceKm',
      'DurationSec',
      'DurationFormatted',
      'AvgPaceSecPerKm',
      'AvgPaceFormatted',
      'Best6kSec',
      'Best6kFormatted',
      'AvgHR',
      'MaxHR',
      'AvgCadence',
      'ElevGainMeters',
      'Notes',
    ];

    const rows = runs.map((r) => [
      `"${r.id}"`,
      `"${r.date}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.runType}"`,
      r.distanceKm,
      r.durationSeconds,
      `"${formatDuration(r.durationSeconds)}"`,
      r.averagePaceSecPerKm,
      `"${formatPace(r.averagePaceSecPerKm, profile.unitPreference)}"`,
      r.best6kTimeSeconds || '',
      `"${r.best6kTimeSeconds ? formatDuration(r.best6kTimeSeconds) : ''}"`,
      r.avgHeartRate || '',
      r.maxHeartRate || '',
      r.avgCadence || '',
      r.elevationGainMeters || '',
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xc_6k_runs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAskCoach = (queryText: string) => {
    const q = queryText || coachQuestion;
    if (!q.trim()) return;

    setIsThinking(true);
    setCoachAnswer(null);

    const target6kStr = profile.target6kTimeSeconds ? formatDuration(profile.target6kTimeSeconds) : 'Not set';
    const targetPaceStr = profile.target6kTimeSeconds ? formatPace(profile.target6kTimeSeconds / 6.0, profile.unitPreference) : '--:--';
    const currentBestSec = runs.reduce((min, r) => {
      const val = r.best6kTimeSeconds || 0;
      return val > 0 && val < min ? val : min;
    }, 999999);
    const currentBestStr = currentBestSec < 999999 ? formatDuration(currentBestSec) : 'None';
    const diffSec = currentBestSec < 999999 && profile.target6kTimeSeconds ? currentBestSec - profile.target6kTimeSeconds : null;

    setTimeout(() => {
      let analysis = '';
      const lower = q.toLowerCase();

      if (lower.includes('break') || lower.includes('goal') || lower.includes('ready')) {
        analysis = `### 🏃 6K Goal Readiness Assessment
- **Target 6K**: ${target6kStr} (Target Pace: ${targetPaceStr})
- **Current 6K Best**: ${currentBestStr}
- **3-Run Weekly Adherence**: ${adherence.currentWeekRuns}/3 runs this week, ${adherence.currentStreakWeeks}-week streak.

**Key Recommendations**:
1. Focus on specific interval turnover: 5 x 1000m repeats at your goal 6K pace with 90s jog recovery.
2. Maintain your 3-run weekly consistency. With only 3 runs per week, make each session intentional (Intervals, Threshold Tempo, and Long Aerobic Run).`;
      } else if (lower.includes('structure') || lower.includes('week') || lower.includes('3 runs') || lower.includes('plan')) {
        analysis = `### 📋 Recommended 3-Run Weekly Cross Country Structure
To maximize 6K race performance while staying strictly within your 3 runs/week schedule:

- **Run 1 - Goal Pace Intervals**:
  - *Workout*: 2km warmup + 5 x 1000m at ${targetPaceStr} with 90s jog + 1.5km cooldown.
  - *Purpose*: Neuromuscular adaptation to 6K race velocity.
- **Run 2 - Lactate Threshold / 6K Tempo**:
  - *Workout*: 1.5km warmup + 6.0 km continuous tempo at threshold + 4x100m strides.
  - *Purpose*: Raises aerobic power and prevents early lactic buildup.
- **Run 3 - Aerobic Long Run**:
  - *Workout*: 9 to 12 km relaxed aerobic run on hilly grass or dirt trails.
  - *Purpose*: Expands aerobic ceiling and builds fatigue resistance.`;
      } else {
        analysis = `### 🎯 Cross Country 6K Analysis
- **Target 6K**: ${target6kStr} (${targetPaceStr})
- **3-Run Adherence**: ${adherence.currentStreakWeeks} consecutive weeks meeting your 3 runs/week target.
- **Coaching Tip**: Prioritize full recovery between your 3 weekly efforts so you hit your interval and tempo workouts at high quality.`;
      }

      setCoachAnswer(analysis);
      setIsThinking(false);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
              Export for AI Analysis
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Export your 6K targets, 3-run schedule adherence, and workout logs to ask ChatGPT, Claude, or Gemini
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* iOS-style Segmented Control */}
        <div className="flex p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-xs font-semibold my-4 flex-shrink-0">
          <button
            onClick={() => setActiveTab('prompt')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'prompt'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            1-Click AI Prompt
          </button>
          <button
            onClick={() => setActiveTab('coach')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1 ${
              activeTab === 'coach'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Ask Coach</span>
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'raw'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            JSON & CSV Downloads
          </button>
        </div>

        {/* Tab 1: AI Prompt */}
        {activeTab === 'prompt' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Structured markdown with 6K goals and workout history:
              </span>
              <button
                onClick={handleCopy}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  copied
                    ? 'bg-[#30d158] text-black'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Prompt'}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed select-all">
              {exportText}
            </div>

            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Paste directly into ChatGPT, Claude, or Gemini to receive personalized coaching feedback.
            </p>
          </div>
        )}

        {/* Tab 2: Ask Coach */}
        {activeTab === 'coach' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                Suggested questions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'How should I structure my 3 runs this week?',
                  'Can I break 21:00 in my next 6K?',
                  'Why does my cadence drop in the final 2km?',
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => {
                      setCoachQuestion(chip);
                      handleAskCoach(chip);
                    }}
                    className="px-2.5 py-1 rounded-full text-[11px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors text-left cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Ask about your 6K cross country training..."
                value={coachQuestion}
                onChange={(e) => setCoachQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskCoach(coachQuestion)}
                className="flex-1 px-3.5 py-2 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-[#30d158]"
              />
              <button
                onClick={() => handleAskCoach(coachQuestion)}
                disabled={isThinking || !coachQuestion.trim()}
                className="px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black disabled:opacity-40 font-semibold text-xs flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ask</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-800 dark:text-neutral-200 space-y-2 leading-relaxed">
              {isThinking ? (
                <div className="flex items-center space-x-2 text-neutral-500 py-6 justify-center">
                  <Sparkles className="w-4 h-4 animate-spin text-[#0a84ff]" />
                  <span>Analyzing your 6K workouts and 3-run weekly consistency...</span>
                </div>
              ) : coachAnswer ? (
                <div className="prose prose-neutral dark:prose-invert prose-xs max-w-none whitespace-pre-wrap">
                  {coachAnswer}
                </div>
              ) : (
                <div className="py-8 text-center text-neutral-400">
                  <Bot className="w-8 h-8 text-neutral-400 dark:text-neutral-600 mx-auto mb-2" />
                  <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Ready to analyze your 6K data
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Select a question above or type your own to get instant Cross Country advice.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Raw Downloads */}
        {activeTab === 'raw' && (
          <div className="space-y-4 py-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Download your complete dataset for local backups or spreadsheet analysis:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 font-semibold text-neutral-900 dark:text-white mb-1">
                    <FileJson className="w-4 h-4 text-[#ff9f0a]" />
                    <span>Raw JSON Export</span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                    Full structured JSON with profile, weekly adherence stats, and all individual runs.
                  </p>
                </div>
                <button
                  onClick={downloadJson}
                  className="w-full py-2 rounded-full bg-white hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .JSON</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 font-semibold text-neutral-900 dark:text-white mb-1">
                    <FileSpreadsheet className="w-4 h-4 text-[#30d158]" />
                    <span>Spreadsheet CSV</span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                    Tabular CSV containing dates, paces, Garmin heart rate, cadence, and 6K trial times.
                  </p>
                </div>
                <button
                  onClick={downloadCsv}
                  className="w-full py-2 rounded-full bg-white hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .CSV</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
