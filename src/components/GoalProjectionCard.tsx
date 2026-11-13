import React, { useState, useMemo } from 'react';
import { RunRecord, UserProfile, AdherenceSummary } from '../types/running';
import { LiquidGlassReveal } from './LiquidGlassReveal';
import {
  YRAA_DIVISIONS,
  YRAA_DIVISION_LIST,
  YraaDivisionId,
  YRAA_MEET_URL,
} from '../data/yraaBenchmarks';
import {
  calculateGoalProjection,
  calculateMultiDistancePredictions,
  estimateYraaPlacement,
  formatOrdinalPlace,
  inferDefaultYraaDivision,
  formatDuration,
  formatPace,
  KM_TO_MILES,
} from '../utils/runningCalculations';
import {
  Target,
  TrendingDown,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Zap,
  Info,
  ChevronDown,
  Trophy,
  ExternalLink,
  ArrowRight,
  Award,
  Gauge,
  RotateCcw,
} from 'lucide-react';

interface GoalProjectionCardProps {
  runs: RunRecord[];
  profile: UserProfile;
  adherence: AdherenceSummary;
  best6kSec?: number;
  onOpenSettings: () => void;
  onSaveProfile?: (profile: UserProfile) => void;
}

interface HoveredChartNode {
  kind: 'history' | 'projection';
  x: number;
  y: number;
  label: string;
  sublabel: string;
  timeSec: number;
  paceSecPerKm: number;
  secondaryText?: string;
}

export const GoalProjectionCard: React.FC<GoalProjectionCardProps> = ({
  runs,
  profile,
  adherence,
  best6kSec,
  onOpenSettings,
  onSaveProfile,
}) => {
  const [isProgressionExpanded, setIsProgressionExpanded] = useState(false);
  const [isScenariosExpanded, setIsScenariosExpanded] = useState(false);
  const [isYraaExpanded, setIsYraaExpanded] = useState(false);
  const [isPredictorExpanded, setIsPredictorExpanded] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<
    'expected' | 'accelerated' | 'conservative'
  >('expected');
  const [showMethodology, setShowMethodology] = useState(false);
  const [historySeriesMode, setHistorySeriesMode] = useState<'quality' | 'all'>('quality');
  const [hoveredNode, setHoveredNode] = useState<HoveredChartNode | null>(null);
  const [hoveredRankIndex, setHoveredRankIndex] = useState<number | null>(null);
  const [showAllPlaces, setShowAllPlaces] = useState(false);
  const [placeViewFilter, setPlaceViewFilter] = useState<'all' | 'around_today' | 'around_goal'>('all');
  const [simulatedWeeklyKm, setSimulatedWeeklyKm] = useState<number | null>(null);

  const targetDistKm = profile.targetDistanceKm || 6.0;
  const targetSec = profile.target6kTimeSeconds;
  const currentBest = best6kSec || profile.current6kPrSeconds;
  const unit = profile.unitPreference || 'km';

  const projection = useMemo(
    () =>
      calculateGoalProjection(
        runs,
        targetDistKm,
        targetSec,
        currentBest,
        profile.weeklyRunGoal || 3,
        adherence.currentStreakWeeks || 0
      ),
    [runs, targetDistKm, targetSec, currentBest, profile.weeklyRunGoal, adherence.currentStreakWeeks]
  );

  const multiDistancePrediction = useMemo(
    () =>
      calculateMultiDistancePredictions(
        runs,
        targetDistKm,
        projection.currentBestSeconds || currentBest,
        projection.targetTimeSeconds,
        simulatedWeeklyKm
      ),
    [runs, targetDistKm, projection.currentBestSeconds, currentBest, projection.targetTimeSeconds, simulatedWeeklyKm]
  );

  const selectedDivisionId: YraaDivisionId =
    profile.yraaDivision || inferDefaultYraaDivision(targetDistKm);
  const selectedDivision = YRAA_DIVISIONS[selectedDivisionId] || YRAA_DIVISIONS.senior_men;

  const currentYraaPlacement = useMemo(() => {
    const benchmarkSec = projection.currentBestSeconds || currentBest;
    if (!benchmarkSec || benchmarkSec <= 0) return null;
    return estimateYraaPlacement(benchmarkSec, targetDistKm, selectedDivisionId);
  }, [projection.currentBestSeconds, currentBest, targetDistKm, selectedDivisionId]);

  const goalYraaPlacement = useMemo(() => {
    const goalTime = projection.targetTimeSeconds;
    if (!goalTime || goalTime <= 0) return null;
    return estimateYraaPlacement(goalTime, targetDistKm, selectedDivisionId);
  }, [projection.targetTimeSeconds, targetDistKm, selectedDivisionId]);

  const handleSelectYraaDivision = (nextDiv: YraaDivisionId) => {
    if (onSaveProfile) {
      onSaveProfile({
        ...profile,
        yraaDivision: nextDiv,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const activeScenarioData = projection.scenarios[selectedScenario];
  const imp = projection.improvementSummary;

  const activeHistoryPoints =
    historySeriesMode === 'all' && projection.allRunsHistoryPoints.length > 0
      ? projection.allRunsHistoryPoints
      : projection.historyPoints;

  // Compute places gained between current fitness and goal target
  const placesGained =
    currentYraaPlacement && goalYraaPlacement
      ? currentYraaPlacement.estimatedPlace - goalYraaPlacement.estimatedPlace
      : null;

  // Per-card header summaries
  const progressionSummaryText = (() => {
    const parts: string[] = [];
    if (!projection.hasTarget) {
      parts.push('Target Not Set');
    } else if (projection.isAchieved) {
      parts.push('Goal Achieved');
    } else if (projection.hasData) {
      parts.push(`~${activeScenarioData.weeks} Wks (${projection.confidence})`);
    }
    if (imp.hasHistory && imp.totalDroppedSeconds > 0) {
      parts.push(`-${formatDuration(imp.totalDroppedSeconds)} gained`);
    }
    return parts.join(' · ');
  })();

  const scenariosSummaryText =
    projection.hasTarget && projection.hasData && !projection.isAchieved
      ? `Steady ~${projection.scenarios.expected.weeks} wks · Accelerated ~${projection.scenarios.accelerated.weeks} wks`
      : '';

  const yraaSummaryText = currentYraaPlacement
    ? `${selectedDivision.shortLabel}: ${
        goalYraaPlacement
          ? `${formatOrdinalPlace(currentYraaPlacement.estimatedPlace)} → ${formatOrdinalPlace(
              goalYraaPlacement.estimatedPlace
            )} of ${selectedDivision.finishersCount}`
          : `${formatOrdinalPlace(currentYraaPlacement.estimatedPlace)} of ${selectedDivision.finishersCount}`
      }`
    : `${selectedDivision.label} (${selectedDivision.finishersCount} finishers)`;

  const predictorSummaryText = (() => {
    if (!multiDistancePrediction.hasData) return '5K, 8K, 10K & Half Marathon';
    const p5 = multiDistancePrediction.predictions.find((p) => p.id === '5k');
    const p8 = multiDistancePrediction.predictions.find((p) => p.id === '8k');
    const p10 = multiDistancePrediction.predictions.find((p) => p.id === '10k');
    return [
      p5 ? `5K ${formatDuration(p5.predictedSeconds)}` : '',
      p8 ? `8K ${formatDuration(p8.predictedSeconds)}` : '',
      p10 ? `10K ${formatDuration(p10.predictedSeconds)}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  })();

  // SVG Trajectory Chart layout & coordinates (History -> Now -> Projected Goal)
  const chartData = useMemo(() => {
    const histPts = activeHistoryPoints;
    const projPts = projection.projectedCurve;
    const goalTimeSec = projection.targetTimeSeconds;

    if (histPts.length === 0 && projPts.length === 0) {
      return null;
    }

    const W = 640;
    const H = 215;
    const padL = 48;
    const padR = 20;
    const padT = 20;
    const padB = 34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const allTimes: number[] = [];
    histPts.forEach((p) => allTimes.push(p.equivalentTimeSeconds));
    projPts.forEach((p) => {
      allTimes.push(p.expectedSec, p.acceleratedSec, p.conservativeSec);
    });
    if (goalTimeSec && goalTimeSec > 0) allTimes.push(goalTimeSec);

    const rawMin = Math.min(...allTimes);
    const rawMax = Math.max(...allTimes);
    const span = Math.max(45, rawMax - rawMin);
    const yMin = Math.max(60, Math.floor((rawMin - span * 0.14) / 10) * 10);
    const yMax = Math.ceil((rawMax + span * 0.14) / 10) * 10;

    // Higher time = higher or lower? Let's put FASTER (lower time) moving UP OR DOWN?
    // Standard performance progression: lower race time = higher performance OR downward slope ("time cut").
    // Wait: if Y bottom = slower and Y top = faster (lower seconds at TOP), improving line rises up cleanly!
    // OR Y bottom = 0 / goal, Y top = slower -> downward slope (matching TrendingDown icon).
    // Let's check: users reading "minutes:seconds" expect smaller numbers lower on Y-axis OR rising faster upward?
    // Wait: when time drops from 27:00 -> 25:00 -> 22:00 (target at bottom), a downward-sloping time chart visually reinforces "cutting time", AND axis labels explicitly show exact mm:ss so there's zero ambiguity!
    // Let's place slower times at top (padT) and faster Goal time near bottom (padT + plotH), with clear "Faster ↓" / exact time labels on the Y axis.
    const toY = (sec: number) =>
      padT + ((sec - yMin) / Math.max(1, yMax - yMin)) * plotH;

    // Split horizontal axis: if both history and projection exist, put "Now" around 44% width
    const hasHist = histPts.length > 0;
    const hasFuture = projPts.length > 1 && !projection.isAchieved;
    const nowX = hasHist && hasFuture ? padL + plotW * 0.44 : hasFuture ? padL : padL + plotW;

    const maxHistWeeks = hasHist
      ? Math.max(1, histPts[histPts.length - 1].weeksFromBaseline)
      : 1;
    const maxFutureWeeks = hasFuture
      ? Math.max(1, projPts[projPts.length - 1].weekOffset)
      : 1;

    const historyCoords = histPts.map((pt, idx) => {
      let x = nowX;
      if (hasFuture) {
        if (histPts.length === 1) {
          x = nowX - 24;
        } else {
          const frac = pt.weeksFromBaseline / maxHistWeeks;
          x = padL + frac * (nowX - padL - 12);
        }
      } else {
        const frac = histPts.length === 1 ? 0.5 : idx / (histPts.length - 1);
        x = padL + frac * plotW;
      }
      return {
        ...pt,
        x,
        y: toY(pt.equivalentTimeSeconds),
      };
    });

    // Anchor "Now" start point for future projection
    const nowAnchorSec =
      projection.currentBestSeconds ||
      (histPts.length > 0 ? histPts[histPts.length - 1].equivalentTimeSeconds : 0);

    const futureCoords = hasFuture
      ? projPts.map((pt) => {
          const frac = pt.weekOffset / maxFutureWeeks;
          const x = nowX + frac * (padL + plotW - nowX);
          return {
            ...pt,
            x,
            yExpected: toY(pt.expectedSec),
            yAccelerated: toY(pt.acceleratedSec),
            yConservative: toY(pt.conservativeSec),
          };
        })
      : [];

    // Y-axis ticks (4 clean intervals)
    const yTicks: number[] = [];
    for (let i = 0; i <= 3; i++) {
      yTicks.push(Math.round(yMin + ((yMax - yMin) * i) / 3));
    }

    return {
      W,
      H,
      padL,
      padR,
      padT,
      padB,
      plotW,
      plotH,
      yMin,
      yMax,
      nowX,
      hasHist,
      hasFuture,
      historyCoords,
      futureCoords,
      nowAnchorY: nowAnchorSec > 0 ? toY(nowAnchorSec) : null,
      goalY: goalTimeSec && goalTimeSec > 0 ? toY(goalTimeSec) : null,
      yTicks,
    };
  }, [activeHistoryPoints, projection]);

  return (
    <div className="space-y-5">
      {/* CARD 1: GOAL PROGRESSION & FORECAST */}
      <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#0F1C28] border border-slate-200/95 dark:border-slate-700/75 shadow-sm transition-colors">
        <button
          type="button"
          onClick={() => setIsProgressionExpanded((prev) => !prev)}
          className="w-full px-4 py-4 sm:px-5 sm:py-4.5 flex items-center justify-between text-left cursor-pointer group accordion-trigger select-none hover:bg-slate-50/90 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800/70"
          data-no-scale
          aria-expanded={isProgressionExpanded}
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-violet-500 flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105">
              {projection.hasTarget ? (
                <TrendingDown className="w-4.5 h-4.5 stroke-[2.4]" />
              ) : (
                <Target className="w-4.5 h-4.5 stroke-[2.3]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">
                  Goal Progression & Forecast
                </h2>
                {progressionSummaryText && (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums truncate">
                    · {progressionSummaryText}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 ml-2">
            <div
              className={`p-2 rounded-lg border chevron-badge transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isProgressionExpanded
                  ? 'rotate-180 text-slate-900 dark:text-white bg-slate-200/80 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                  : 'bg-slate-100 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div
          className={`accordion-collapse-wrapper ${isProgressionExpanded ? 'is-expanded' : ''}`}
          aria-hidden={!isProgressionExpanded}
        >
          <div className="accordion-collapse-inner">
            <div className="px-4 pb-6 pt-4 sm:px-5 border-t border-slate-100 dark:border-slate-800 space-y-5">
              {/* Top Bar: Description + Model Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Tracks your verified time progression over logged blocks and models a diminishing-returns timeline to your target.
                </p>

                <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
                  {!projection.hasTarget && (
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="px-3.5 py-1.5 rounded-lg bg-[#0593C6] hover:bg-[#047da8] text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Set Goal Time
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowMethodology(!showMethodology)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5 text-violet-500" />
                    <span>{showMethodology ? 'Hide Model' : 'Projection Science'}</span>
                  </button>
                </div>
              </div>

              {showMethodology && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    How Goal Progression & Forecasting Work
                  </div>
                  <p className="text-[11px] leading-relaxed">{projection.basisDescription}</p>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-800 dark:text-slate-200">
                      Quality-Filtered Weighted Regression:{' '}
                    </strong>
                    Easy recovery jogs are excluded when quality efforts (Races, Time Trials, Tempo runs) exist so slow base days never mask your speed gains. Recent workouts carry higher regression weight, blended with a pace-scaled diminishing-returns taper.
                  </div>
                </div>
              )}

            {/* 1. PROVEN IMPROVEMENT SUMMARY & PROGRESSION TRAJECTORY */}
            {projection.hasData && (
              <div className="space-y-4">
                {/* Improvement Over Time KPI Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Earned Improvement */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200/80 dark:border-slate-800">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Earned Improvement</span>
                      {imp.totalDroppedSeconds >= 0 ? (
                        <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                      )}
                    </div>
                    {imp.hasHistory ? (
                      <>
                        <div
                          className={`text-xl sm:text-2xl font-extrabold tabular-nums tracking-tight mt-1 ${
                            imp.totalDroppedSeconds > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {imp.totalDroppedSeconds > 0
                            ? `-${formatDuration(imp.totalDroppedSeconds)}`
                            : imp.totalDroppedSeconds === 0
                            ? '00:00'
                            : `+${formatDuration(Math.abs(imp.totalDroppedSeconds))}`}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                          {formatDuration(imp.baselineSeconds)} → {formatDuration(imp.currentBenchmarkSeconds)}{' '}
                          {imp.totalDroppedSeconds > 0 && `(${imp.improvementPercent}% faster)`}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-lg font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                          {formatDuration(projection.currentBestSeconds)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Log workouts across 2+ weeks to track trend
                        </div>
                      </>
                    )}
                  </div>

                  {/* Measured Weekly Slope */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200/80 dark:border-slate-800">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Trend Pace / Wk</span>
                      <Zap className="w-3.5 h-3.5 text-[#0593C6]" />
                    </div>
                    {projection.hasTarget && !projection.isAchieved ? (
                      <>
                        <div className="text-xl sm:text-2xl font-extrabold text-[#0593C6] tabular-nums tracking-tight mt-1">
                          -{activeScenarioData.weeklyRateSec}s
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {' '}
                            / wk
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                          {imp.hasHistory && imp.empiricalWeeklyRateSec !== null
                            ? `Observed slope: ${
                                imp.empiricalWeeklyRateSec > 0 ? '-' : '+'
                              }${Math.abs(imp.empiricalWeeklyRateSec).toFixed(1)}s/wk`
                            : `~${(activeScenarioData.weeklyRateSec / targetDistKm).toFixed(1)}s/${unit} gain`}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xl sm:text-2xl font-extrabold text-[#0593C6] tabular-nums tracking-tight mt-1">
                          {imp.empiricalWeeklyRateSec !== null
                            ? `${imp.empiricalWeeklyRateSec > 0 ? '-' : '+'}${Math.abs(
                                imp.empiricalWeeklyRateSec
                              ).toFixed(1)}s/wk`
                            : 'Establishing'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                          {imp.hasHistory
                            ? `Across ${imp.benchmarkCount} runs (${imp.spanWeeks} wks)`
                            : `${projection.recentRunsPerWeek} runs/wk recent`}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Timeline / Gap */}
                  {projection.hasTarget ? (
                    projection.isAchieved ? (
                      <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 col-span-2 flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              Goal Target Achieved
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
                              Benchmark {formatDuration(projection.currentBestSeconds)} beats{' '}
                              {formatDuration(projection.targetTimeSeconds)} target.
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={onOpenSettings}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer shrink-0"
                        >
                          New Target
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200/80 dark:border-slate-800">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                            <span>Projected ETA</span>
                            <Calendar className="w-3.5 h-3.5 text-violet-500" />
                          </div>
                          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight mt-1">
                            ~{activeScenarioData.weeks}{' '}
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              wks
                            </span>
                          </div>
                          <div className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 mt-1">
                            {activeScenarioData.date}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200/80 dark:border-slate-800">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                            <span>Remaining Cut</span>
                            <Target className="w-3.5 h-3.5 text-amber-500" />
                          </div>
                          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight mt-1">
                            {formatDuration(projection.gapSeconds)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                            {formatDuration(projection.currentBestSeconds)} →{' '}
                            {formatDuration(projection.targetTimeSeconds)}
                          </div>
                        </div>
                      </>
                    )
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200/80 dark:border-slate-800 col-span-2 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          No Goal Time Set
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Add a target {targetDistKm}K time to unlock timeline ETA and projected YRAA championship placement.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenSettings}
                        className="px-3 py-1.5 rounded-lg bg-[#0593C6] hover:bg-[#047da8] text-white font-semibold text-xs cursor-pointer shrink-0"
                      >
                        Set Target
                      </button>
                    </div>
                  )}
                </div>

                {/* Past -> Current -> Goal Interactive Progression Curve */}
                {chartData && (
                  <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-[#0B1520] border border-slate-200/80 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>Performance Progression & Forecast ({targetDistKm}K Equivalent)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {imp.seriesLabel} · Click or hover points to inspect workouts & future weeks
                        </p>
                      </div>

                      <div className="inline-flex p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-[11px] self-start sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setHistorySeriesMode('quality');
                            setHoveredNode(null);
                          }}
                          className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                            historySeriesMode === 'quality'
                              ? 'bg-white dark:bg-[#162433] text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          Benchmarks ({projection.historyPoints.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHistorySeriesMode('all');
                            setHoveredNode(null);
                          }}
                          className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                            historySeriesMode === 'all'
                              ? 'bg-white dark:bg-[#162433] text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          All Runs ({projection.allRunsHistoryPoints.length})
                        </button>
                      </div>
                    </div>

                    {/* Interactive Tooltip Strip */}
                    <div className="min-h-[28px] mb-2 flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0F1C28] border border-slate-200/80 dark:border-slate-800/80">
                      {hoveredNode ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 w-full">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider ${
                              hoveredNode.kind === 'history'
                                ? 'text-[#0593C6]'
                                : 'text-violet-500'
                            }`}
                          >
                            {hoveredNode.kind === 'history' ? 'Logged' : 'Projected'}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {hoveredNode.label}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {hoveredNode.sublabel}
                          </span>
                          <span className="ml-auto font-bold text-slate-900 dark:text-white tabular-nums">
                            {formatDuration(hoveredNode.timeSec)} (
                            {formatPace(hoveredNode.paceSecPerKm, unit)})
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 w-full">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-0.5 bg-[#0593C6] inline-block" />
                            Past Benchmarks
                          </span>
                          {chartData.hasFuture && (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2.5 h-0.5 bg-violet-500 inline-block" />
                              Projected Path ({selectedScenario})
                            </span>
                          )}
                          {chartData.goalY !== null && (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2.5 h-0.5 border-t border-dashed border-emerald-500 inline-block" />
                              Target: {formatDuration(projection.targetTimeSeconds)}
                            </span>
                          )}
                          <span className="ml-auto hidden sm:inline text-slate-400">
                            Hover or click a point for details
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="w-full overflow-x-auto">
                      <svg
                        viewBox={`0 0 ${chartData.W} ${chartData.H}`}
                        className="w-full h-48 sm:h-52 select-none"
                        role="img"
                        aria-label="Historical improvement and projected goal progression chart"
                        onMouseLeave={() => setHoveredNode(null)}
                      >
                        {/* Horizontal grid lines + Y time labels */}
                        {chartData.yTicks.map((tickSec, idx) => {
                          const y =
                            chartData.padT +
                            ((tickSec - chartData.yMin) /
                              Math.max(1, chartData.yMax - chartData.yMin)) *
                              chartData.plotH;
                          return (
                            <g key={idx}>
                              <line
                                x1={chartData.padL}
                                x2={chartData.W - chartData.padR}
                                y1={y}
                                y2={y}
                                stroke="currentColor"
                                className="text-slate-200 dark:text-slate-800"
                                strokeWidth={1}
                              />
                              <text
                                x={chartData.padL - 8}
                                y={y + 3.5}
                                textAnchor="end"
                                className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono tabular-nums"
                              >
                                {formatDuration(tickSec)}
                              </text>
                            </g>
                          );
                        })}

                        {/* Target Goal dashed horizontal line */}
                        {chartData.goalY !== null && projection.targetTimeSeconds && (
                          <g>
                            <line
                              x1={chartData.padL}
                              x2={chartData.W - chartData.padR}
                              y1={chartData.goalY}
                              y2={chartData.goalY}
                              stroke="#10B981"
                              strokeWidth={1.5}
                              strokeDasharray="5 4"
                            />
                            <text
                              x={chartData.W - chartData.padR}
                              y={Math.max(12, chartData.goalY - 5)}
                              textAnchor="end"
                              className="fill-emerald-600 dark:fill-emerald-400 text-[10px] font-bold tabular-nums"
                            >
                              Goal {formatDuration(projection.targetTimeSeconds)}
                            </text>
                          </g>
                        )}

                        {/* Vertical "Now" divider with Current marker */}
                        {chartData.hasHist && chartData.hasFuture && (
                          <g>
                            <line
                              x1={chartData.nowX}
                              x2={chartData.nowX}
                              y1={chartData.padT}
                              y2={chartData.H - chartData.padB}
                              stroke="currentColor"
                              className="text-slate-300 dark:text-slate-700"
                              strokeWidth={1}
                              strokeDasharray="3 3"
                            />
                            <text
                              x={chartData.nowX}
                              y={chartData.H - 10}
                              textAnchor="middle"
                              className="fill-[#0593C6] text-[10px] font-bold"
                            >
                              You Today
                            </text>
                          </g>
                        )}
                        <text
                          x={chartData.padL + 6}
                          y={chartData.padT + chartData.plotH - 6}
                          textAnchor="start"
                          className="fill-emerald-600/80 dark:fill-emerald-400/80 text-[9px] font-bold uppercase tracking-wider"
                        >
                          ↓ Faster Times
                        </text>

                        {/* Shaded scenario band (Accelerated to Conservative) */}
                        {chartData.hasFuture && chartData.futureCoords.length >= 2 && (
                          <path
                            d={(() => {
                              const pts = chartData.futureCoords;
                              const upper = pts
                                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yConservative}`)
                                .join(' ');
                              const lower = [...pts]
                                .reverse()
                                .map((p) => `L ${p.x} ${p.yAccelerated}`)
                                .join(' ');
                              return `${upper} ${lower} Z`;
                            })()}
                            fill="#8B5CF6"
                            fillOpacity={0.09}
                          />
                        )}

                        {/* Connector from latest history point to Now projection start */}
                        {chartData.hasHist &&
                          chartData.hasFuture &&
                          chartData.historyCoords.length > 0 &&
                          chartData.futureCoords.length > 0 && (
                            <line
                              x1={chartData.historyCoords[chartData.historyCoords.length - 1].x}
                              y1={chartData.historyCoords[chartData.historyCoords.length - 1].y}
                              x2={chartData.futureCoords[0].x}
                              y2={chartData.futureCoords[0].yExpected}
                              stroke="#8B5CF6"
                              strokeOpacity={0.45}
                              strokeWidth={1.5}
                              strokeDasharray="3 3"
                            />
                          )}

                        {/* Recorded History Solid Polyline */}
                        {chartData.historyCoords.length >= 2 && (
                          <path
                            d={chartData.historyCoords
                              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                              .join(' ')}
                            fill="none"
                            stroke="#0593C6"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}

                        {/* Future Expected Projection Polyline */}
                        {chartData.hasFuture && chartData.futureCoords.length >= 2 && (
                          <path
                            d={chartData.futureCoords
                              .map((p, i) => {
                                const yVal =
                                  selectedScenario === 'accelerated'
                                    ? p.yAccelerated
                                    : selectedScenario === 'conservative'
                                    ? p.yConservative
                                    : p.yExpected;
                                return `${i === 0 ? 'M' : 'L'} ${p.x} ${yVal}`;
                              })
                              .join(' ')}
                            fill="none"
                            stroke="#8B5CF6"
                            strokeWidth={2.5}
                            strokeDasharray="6 4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}

                        {/* History Points */}
                        {chartData.historyCoords.map((pt, i) => {
                          const isSelected =
                            hoveredNode?.kind === 'history' && hoveredNode.label === pt.title && hoveredNode.sublabel === pt.date;
                          return (
                            <g
                              key={`h_${pt.runId}_${i}`}
                              className="cursor-pointer"
                              onMouseEnter={() =>
                                setHoveredNode({
                                  kind: 'history',
                                  x: pt.x,
                                  y: pt.y,
                                  label: pt.title,
                                  sublabel: `${pt.date} · ${pt.distanceKm.toFixed(1)} km`,
                                  timeSec: pt.equivalentTimeSeconds,
                                  paceSecPerKm: pt.equivalentPaceSecPerKm,
                                })
                              }
                              onClick={() =>
                                setHoveredNode({
                                  kind: 'history',
                                  x: pt.x,
                                  y: pt.y,
                                  label: pt.title,
                                  sublabel: `${pt.date} · ${pt.distanceKm.toFixed(1)} km`,
                                  timeSec: pt.equivalentTimeSeconds,
                                  paceSecPerKm: pt.equivalentPaceSecPerKm,
                                })
                              }
                            >
                              <circle cx={pt.x} cy={pt.y} r={10} fill="transparent" />
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={isSelected ? 5.5 : 4}
                                fill="#0593C6"
                                stroke="#FFFFFF"
                                strokeWidth={1.75}
                              />
                              {(i === 0 || i === chartData.historyCoords.length - 1) && (
                                <text
                                  x={pt.x}
                                  y={chartData.H - 10}
                                  textAnchor={i === 0 ? 'start' : 'end'}
                                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono"
                                >
                                  {pt.date.slice(5)}
                                </text>
                              )}
                            </g>
                          );
                        })}

                        {/* Future Projection Nodes */}
                        {chartData.hasFuture &&
                          chartData.futureCoords.map((pt, i) => {
                            const activeSec =
                              selectedScenario === 'accelerated'
                                ? pt.acceleratedSec
                                : selectedScenario === 'conservative'
                                ? pt.conservativeSec
                                : pt.expectedSec;
                            const activeY =
                              selectedScenario === 'accelerated'
                                ? pt.yAccelerated
                                : selectedScenario === 'conservative'
                                ? pt.yConservative
                                : pt.yExpected;
                            const labelText =
                              pt.weekOffset === 0 ? 'Current Benchmark' : `Week ${pt.weekOffset}`;
                            const isLast = i === chartData.futureCoords.length - 1;
                            return (
                              <g
                                key={`f_${pt.weekOffset}`}
                                className="cursor-pointer"
                                onMouseEnter={() =>
                                  setHoveredNode({
                                    kind: 'projection',
                                    x: pt.x,
                                    y: activeY,
                                    label: labelText,
                                    sublabel: pt.dateLabel,
                                    timeSec: activeSec,
                                    paceSecPerKm: activeSec / targetDistKm,
                                  })
                                }
                                onClick={() =>
                                  setHoveredNode({
                                    kind: 'projection',
                                    x: pt.x,
                                    y: activeY,
                                    label: labelText,
                                    sublabel: pt.dateLabel,
                                    timeSec: activeSec,
                                    paceSecPerKm: activeSec / targetDistKm,
                                  })
                                }
                              >
                                <circle cx={pt.x} cy={activeY} r={10} fill="transparent" />
                                <circle
                                  cx={pt.x}
                                  cy={activeY}
                                  r={isLast || pt.weekOffset === 0 ? 4.5 : 3.2}
                                  fill={isLast ? '#10B981' : '#8B5CF6'}
                                  stroke="#FFFFFF"
                                  strokeWidth={1.5}
                                />
                                {isLast && (
                                  <text
                                    x={pt.x}
                                    y={chartData.H - 10}
                                    textAnchor="end"
                                    className="fill-violet-600 dark:fill-violet-400 text-[10px] font-mono"
                                  >
                                    {pt.dateLabel}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* CARD 2: TRAINING SCENARIOS & MILESTONES */}
      {projection.hasTarget && projection.hasData && !projection.isAchieved && (
        <LiquidGlassReveal>
          <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#0F1C28] border border-slate-200/95 dark:border-slate-700/75 shadow-sm transition-colors">
          <button
            type="button"
            onClick={() => setIsScenariosExpanded((prev) => !prev)}
            className="w-full px-4 py-4 sm:px-5 sm:py-4.5 flex items-center justify-between text-left cursor-pointer group accordion-trigger select-none hover:bg-slate-50/90 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800/70"
            data-no-scale
            aria-expanded={isScenariosExpanded}
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-emerald-500 flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105">
                <Calendar className="w-4.5 h-4.5 stroke-[2.3]" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">
                    Training Scenarios & Milestones
                  </h2>
                  {scenariosSummaryText && (
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums truncate">
                      · {scenariosSummaryText}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 ml-2">
              <div
                className={`p-2 rounded-lg border chevron-badge transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isScenariosExpanded
                    ? 'rotate-180 text-slate-900 dark:text-white bg-slate-200/80 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                    : 'bg-slate-100 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          <div
            className={`accordion-collapse-wrapper ${isScenariosExpanded ? 'is-expanded' : ''}`}
            aria-hidden={!isScenariosExpanded}
          >
            <div className="accordion-collapse-inner">
              <div className="px-4 pb-6 pt-4 sm:px-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
                {/* Scenario Selector */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200/80 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Training Consistency Scenarios
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Compare how weekly volume impacts your time-to-goal curve
                      </p>
                    </div>
                    <div className="inline-flex p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-xs self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setSelectedScenario('expected')}
                        className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                          selectedScenario === 'expected'
                            ? 'bg-[#0593C6] text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Steady ({profile.weeklyRunGoal || 3}/wk)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedScenario('accelerated')}
                        className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                          selectedScenario === 'accelerated'
                            ? 'bg-[#10B981] text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Accelerated (+1 run)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedScenario('conservative')}
                        className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                          selectedScenario === 'conservative'
                            ? 'bg-violet-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Base (1–2/wk)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedScenario('expected')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        selectedScenario === 'expected'
                          ? 'border-[#0593C6] bg-[#0593C6]/10'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1C28]'
                      }`}
                    >
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>Steady Plan</span>
                        <span className="text-[#0593C6] tabular-nums font-bold">
                          ~{projection.scenarios.expected.weeks} wks
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                        -{projection.scenarios.expected.weeklyRateSec}s/wk initial · ETA{' '}
                        {projection.scenarios.expected.date}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedScenario('accelerated')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        selectedScenario === 'accelerated'
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1C28]'
                      }`}
                    >
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>Accelerated Focus</span>
                        <span className="text-emerald-600 dark:text-emerald-400 tabular-nums font-bold">
                          ~{projection.scenarios.accelerated.weeks} wks
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                        -{projection.scenarios.accelerated.weeklyRateSec}s/wk initial · ETA{' '}
                        {projection.scenarios.accelerated.date}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedScenario('conservative')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        selectedScenario === 'conservative'
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1C28]'
                      }`}
                    >
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>Conservative Base</span>
                        <span className="text-violet-600 dark:text-violet-400 tabular-nums font-bold">
                          ~{projection.scenarios.conservative.weeks} wks
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                        -{projection.scenarios.conservative.weeklyRateSec}s/wk initial · ETA{' '}
                        {projection.scenarios.conservative.date}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Projected Milestones */}
                {projection.milestones.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Projected Progression Checkpoints
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        Target: {formatDuration(projection.targetTimeSeconds)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {projection.milestones.map((ms, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === projection.milestones.length - 1;
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border flex flex-col justify-between text-xs ${
                              isFirst
                                ? 'bg-[#0593C6]/8 border-[#0593C6]/30'
                                : isLast
                                ? 'bg-emerald-500/8 border-emerald-500/30'
                                : 'bg-slate-50 dark:bg-[#0B1520] border-slate-200/80 dark:border-slate-800'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider ${
                                    isFirst
                                      ? 'text-[#0593C6]'
                                      : isLast
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {isFirst
                                    ? 'Now'
                                    : isLast
                                    ? 'Goal Hit'
                                    : `Week ${ms.weekNumber}`}
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {ms.projectedDate}
                                </span>
                              </div>
                              <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
                                {formatDuration(ms.projectedTimeSeconds)}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                {formatPace(ms.projectedPaceSecPerKm, unit)}
                              </div>
                            </div>
                            <div className="mt-2 pt-1.5 border-t border-slate-200/70 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                              {ms.notes}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </LiquidGlassReveal>
      )}

      {/* CARD 3: YRAA CHAMPIONSHIP PLACEMENT */}
      <LiquidGlassReveal>
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#0F1C28] border border-slate-200/95 dark:border-slate-700/75 shadow-sm transition-colors">
        <button
          type="button"
          onClick={() => setIsYraaExpanded((prev) => !prev)}
          className="w-full px-4 py-4 sm:px-5 sm:py-4.5 flex items-center justify-between text-left cursor-pointer group accordion-trigger select-none hover:bg-slate-50/90 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800/70"
          data-no-scale
          aria-expanded={isYraaExpanded}
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-amber-500 flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105">
              <Trophy className="w-4.5 h-4.5 stroke-[2.3]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">
                  YRAA Championship Placement
                </h2>
                {yraaSummaryText && (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums truncate">
                    · {yraaSummaryText}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 ml-2">
            <div
              className={`p-2 rounded-lg border chevron-badge transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isYraaExpanded
                  ? 'rotate-180 text-slate-900 dark:text-white bg-slate-200/80 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                  : 'bg-slate-100 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div
          className={`accordion-collapse-wrapper ${isYraaExpanded ? 'is-expanded' : ''}`}
          aria-hidden={!isYraaExpanded}
        >
          <div className="accordion-collapse-inner">
            <div className="px-4 pb-6 pt-4 sm:px-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/12 border border-amber-500/25 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        YRAA Championship Placement Estimate
                      </h3>
                      <a
                        href={selectedDivision.eventUrl || YRAA_MEET_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-[11px] font-semibold text-[#0593C6] hover:underline"
                      >
                        <span>YRAA XC (Oct 22, 2026)</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Calibrated directly against all {selectedDivision.finishersCount} finishers in{' '}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {selectedDivision.label}
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Inline Division Selector */}
                <div className="flex items-center space-x-2 shrink-0">
                  <label
                    htmlFor="yrea-division-select"
                    className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                  >
                    Category:
                  </label>
                  <select
                    id="yrea-division-select"
                    value={selectedDivisionId}
                    onChange={(e) => handleSelectYraaDivision(e.target.value as YraaDivisionId)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#0B1520] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0593C6]/30 focus:border-[#0593C6] cursor-pointer"
                  >
                    {YRAA_DIVISION_LIST.map((div) => (
                      <option key={div.id} value={div.id}>
                        {div.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {currentYraaPlacement ? (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Current YRAA Place */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <span>Where You Place Today</span>
                          <span className="text-[#0593C6] tabular-nums">
                            Top {currentYraaPlacement.percentileTop}%
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2.5 mt-1.5">
                          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
                            {formatOrdinalPlace(currentYraaPlacement.estimatedPlace)}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                            of {currentYraaPlacement.finishersCount}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-1">
                          {currentYraaPlacement.tierLabel}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 space-y-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        <div>
                          {selectedDivision.distanceKm}K equivalent:{' '}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {formatDuration(currentYraaPlacement.equivalentDivisionTimeSeconds)}
                          </strong>
                          {currentYraaPlacement.wasDistanceConverted && (
                            <span>
                              {' '}
                              (from {targetDistKm}K in{' '}
                              {formatDuration(currentYraaPlacement.sourceTimeSeconds)})
                            </span>
                          )}
                        </div>
                        <div>{currentYraaPlacement.nextMilestoneHint}</div>
                      </div>
                    </div>

                    {/* Expected Place at Goal */}
                    {goalYraaPlacement ? (
                      <div className="p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/30 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            <span>Expected Place at Goal</span>
                            <span className="tabular-nums">
                              Top {goalYraaPlacement.percentileTop}%
                            </span>
                          </div>
                          <div className="flex flex-wrap items-baseline gap-2.5 mt-1.5">
                            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
                              {formatOrdinalPlace(goalYraaPlacement.estimatedPlace)}
                            </span>
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                              of {goalYraaPlacement.finishersCount}
                            </span>
                            {placesGained !== null && placesGained > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                <ArrowRight className="w-3.5 h-3.5" />
                                +{placesGained} {placesGained === 1 ? 'spot' : 'spots'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-1">
                            {goalYraaPlacement.tierLabel}
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-emerald-500/20 space-y-1 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                          <div>
                            Goal {selectedDivision.distanceKm}K equivalent:{' '}
                            <strong className="text-slate-900 dark:text-white">
                              {formatDuration(goalYraaPlacement.equivalentDivisionTimeSeconds)}
                            </strong>
                            {goalYraaPlacement.wasDistanceConverted && (
                              <span>
                                {' '}
                                (from {targetDistKm}K in{' '}
                                {formatDuration(goalYraaPlacement.sourceTimeSeconds)})
                              </span>
                            )}
                          </div>
                          <div>{goalYraaPlacement.nextMilestoneHint}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-dashed border-slate-300 dark:border-slate-700 flex flex-col justify-center items-start gap-2">
                        <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 dark:text-white">
                          <Award className="w-4 h-4 text-emerald-500" />
                          <span>See Your Projected Championship Place</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Set a goal time in Settings to calculate how many spots you&apos;ll climb in {selectedDivision.label}.
                        </p>
                        <button
                          type="button"
                          onClick={onOpenSettings}
                          className="px-3 py-1.5 rounded-lg bg-[#0593C6] hover:bg-[#047da8] text-white font-semibold text-xs cursor-pointer"
                        >
                          Set Goal Time
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Field Position: Every Place (1st -> Nth) */}
                  {(() => {
                    const totalFinishers = selectedDivision.timesSec.length;
                    const todayPlace = currentYraaPlacement.estimatedPlace;
                    const goalPlace = goalYraaPlacement?.estimatedPlace;
                    const finishersBehindToday = Math.max(0, totalFinishers - (todayPlace - 1));
                    const aheadPct = Math.round((finishersBehindToday / Math.max(1, totalFinishers)) * 100);
                    const inspectedIdx =
                      hoveredRankIndex !== null
                        ? Math.min(totalFinishers - 1, Math.max(0, hoveredRankIndex))
                        : null;
                    const inspectedSec =
                      inspectedIdx !== null ? selectedDivision.timesSec[inspectedIdx] : null;

                    // Compute filtered place indices for the expandable every-place list
                    const visiblePlaceIndices = (() => {
                      if (placeViewFilter === 'around_today') {
                        const start = Math.max(0, todayPlace - 1 - 15);
                        const end = Math.min(totalFinishers, todayPlace - 1 + 16);
                        return Array.from({ length: end - start }, (_, k) => start + k);
                      }
                      if (placeViewFilter === 'around_goal' && goalPlace) {
                        const start = Math.max(0, goalPlace - 1 - 15);
                        const end = Math.min(totalFinishers, goalPlace - 1 + 16);
                        return Array.from({ length: end - start }, (_, k) => start + k);
                      }
                      return Array.from({ length: totalFinishers }, (_, k) => k);
                    })();

                    return (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span>
                              Field Position ({selectedDivision.label} · Every Place 1st–
                              {formatOrdinalPlace(totalFinishers)})
                            </span>
                            <span className="text-[#0593C6] font-bold tabular-nums">
                              · Faster than {finishersBehindToday} of {totalFinishers} ({aheadPct}%)
                            </span>
                          </div>
                          <span className="tabular-nums text-slate-500 dark:text-slate-400">
                            1st ({formatDuration(currentYraaPlacement.checkpoints.firstPlaceSec)}) →{' '}
                            {formatOrdinalPlace(totalFinishers)} (
                            {formatDuration(currentYraaPlacement.checkpoints.lastPlaceSec)})
                          </span>
                        </div>

                        {/* Fastest vs You Currently vs Goal Quick Reference Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] tabular-nums">
                          <div className="px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                                Fastest (1st Place)
                              </span>
                              <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                                {formatDuration(currentYraaPlacement.checkpoints.firstPlaceSec)}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 text-right">
                              {formatPace(
                                currentYraaPlacement.checkpoints.firstPlaceSec /
                                  selectedDivision.distanceKm,
                                unit
                              )}
                            </span>
                          </div>

                          <div className="px-2.5 py-2 rounded-lg bg-[#0593C6]/12 border border-[#0593C6]/35 flex items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0593C6] block">
                                You Currently
                              </span>
                              <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                                {formatOrdinalPlace(todayPlace)} of {totalFinishers}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold text-[#0593C6] text-right">
                              {formatDuration(currentYraaPlacement.equivalentDivisionTimeSeconds)}
                            </span>
                          </div>

                          {goalYraaPlacement && goalPlace !== undefined ? (
                            <div className="col-span-2 sm:col-span-1 px-2.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                                  Your Goal Target
                                </span>
                                <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                                  {formatOrdinalPlace(goalPlace)} of {totalFinishers}
                                </span>
                              </div>
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 text-right">
                                {formatDuration(goalYraaPlacement.equivalentDivisionTimeSeconds)}
                              </span>
                            </div>
                          ) : (
                            <div className="col-span-2 sm:col-span-1 px-2.5 py-2 rounded-lg bg-white dark:bg-[#0F1C28] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                  Slowest ({formatOrdinalPlace(totalFinishers)})
                                </span>
                                <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                                  {formatDuration(currentYraaPlacement.checkpoints.lastPlaceSec)}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 text-right">
                                Field end
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Interactive Inspect Strip for Every Place */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0F1C28] border border-slate-200/80 dark:border-slate-800 text-[11px] tabular-nums">
                          {inspectedIdx !== null && inspectedSec !== null ? (
                            <div className="flex flex-wrap items-center justify-between w-full gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {formatOrdinalPlace(inspectedIdx + 1)} of {totalFinishers}
                                {inspectedIdx === 0 ? ' (Fastest)' : ''}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">
                                Top {Math.max(1, Math.round(((inspectedIdx + 1) / totalFinishers) * 100))}%
                              </span>
                              <span className="ml-auto font-bold text-[#0593C6]">
                                {formatDuration(inspectedSec)} (
                                {formatPace(inspectedSec / selectedDivision.distanceKm, unit)})
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-between w-full gap-2 text-slate-500 dark:text-slate-400">
                              <span>
                                Hover or tap any bar below to inspect all {totalFinishers} places (left = fastest, right = slowest)
                              </span>
                              <span className="font-semibold text-[#0593C6]">
                                Faster than {finishersBehindToday} runners
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Every-Place SVG Field Spectrum (all N finishers from 1st to last) */}
                        <div className="w-full">
                          {(() => {
                            const svgW = 620;
                            const svgH = 128;
                            const padX = 14;
                            const plotW = svgW - padX * 2;
                            const barBaseY = 104;
                            const maxBarH = 48;
                            const minBarH = 8;

                            const posToX = (placeNum: number) =>
                              padX +
                              ((Math.min(Math.max(1, placeNum), totalFinishers) - 0.5) /
                                Math.max(1, totalFinishers)) *
                                plotW;

                            const rawTodayX = posToX(todayPlace);
                            const rawGoalX =
                              goalPlace !== undefined ? posToX(goalPlace) : null;

                            // Clamp badge center X so pills stay inside viewBox
                            const clampBadgeX = (x: number, halfW: number) =>
                              Math.max(padX + halfW, Math.min(svgW - padX - halfW, x));

                            const todayBadgeX = clampBadgeX(rawTodayX, 38);
                            const goalBadgeX =
                              rawGoalX !== null ? clampBadgeX(rawGoalX, 34) : null;

                            // Non-overlapping Y rows in the callout zone (y = 2..50 above bars)
                            const firstLabelRight = padX + 80;
                            const goalNearFirst =
                              goalBadgeX !== null && goalBadgeX - 34 < firstLabelRight;
                            const todayNearFirst = todayBadgeX - 38 < firstLabelRight;
                            const todayNearGoal =
                              goalBadgeX !== null && Math.abs(todayBadgeX - goalBadgeX) < 76;

                            const goalRowY = goalNearFirst ? 21 : 3;
                            const todayRowY =
                              todayNearGoal && goalRowY === 21
                                ? 38
                                : todayNearGoal || todayNearFirst
                                ? 21
                                : 3;

                            return (
                              <svg
                                viewBox={`0 0 ${svgW} ${svgH}`}
                                className="w-full h-32 sm:h-36 select-none cursor-crosshair"
                                role="img"
                                aria-label={`Every place distribution from 1st fastest to ${totalFinishers}th in ${selectedDivision.label}`}
                                onMouseLeave={() => setHoveredRankIndex(null)}
                              >
                                {/* Bars for all N places */}
                                {selectedDivision.timesSec.map((tSec, idx) => {
                                  const place = idx + 1;
                                  const minT = currentYraaPlacement.checkpoints.firstPlaceSec;
                                  const maxT = currentYraaPlacement.checkpoints.lastPlaceSec;
                                  const norm =
                                    maxT > minT ? (tSec - minT) / (maxT - minT) : 0.5;
                                  const barHeight = Math.max(
                                    minBarH,
                                    Math.round(maxBarH - norm * (maxBarH - minBarH))
                                  );
                                  const x = padX + (idx / Math.max(1, totalFinishers)) * plotW;
                                  const w = Math.max(1.2, plotW / totalFinishers - 0.35);
                                  const y = barBaseY - barHeight;

                                  const isFastest = place === 1;
                                  const isTodayPos = place === todayPlace;
                                  const isGoalPos =
                                    goalPlace !== undefined && place === goalPlace;
                                  const isBehindToday = place >= todayPlace;
                                  const isGainZone =
                                    goalPlace !== undefined &&
                                    place >= goalPlace &&
                                    place < todayPlace;
                                  const isHovered = inspectedIdx === idx;

                                  const fill = isHovered
                                    ? '#F59E0B'
                                    : isFastest
                                    ? '#F59E0B'
                                    : isGoalPos
                                    ? '#10B981'
                                    : isTodayPos
                                    ? '#0593C6'
                                    : isGainZone
                                    ? '#10B981'
                                    : isBehindToday
                                    ? '#0EA5E9'
                                    : '#94A3B8';

                                  const opacity =
                                    isHovered || isFastest || isTodayPos || isGoalPos
                                      ? 1
                                      : isGainZone
                                      ? 0.65
                                      : isBehindToday
                                      ? 0.52
                                      : 0.3;

                                  return (
                                    <g
                                      key={place}
                                      onMouseEnter={() => setHoveredRankIndex(idx)}
                                      onClick={() => setHoveredRankIndex(idx)}
                                    >
                                      <rect
                                        x={x}
                                        y={38}
                                        width={Math.max(2.5, plotW / totalFinishers)}
                                        height={70}
                                        fill="transparent"
                                      />
                                      <rect
                                        x={x}
                                        y={y}
                                        width={w}
                                        height={barHeight}
                                        rx={0.6}
                                        fill={fill}
                                        fillOpacity={opacity}
                                      />
                                    </g>
                                  );
                                })}

                                {/* Baseline */}
                                <line
                                  x1={padX}
                                  x2={svgW - padX}
                                  y1={barBaseY}
                                  y2={barBaseY}
                                  stroke="currentColor"
                                  className="text-slate-300 dark:text-slate-700"
                                  strokeWidth={1}
                                />

                                {/* 1st Place (Fastest) highlight marker */}
                                <g>
                                  <line
                                    x1={posToX(1)}
                                    x2={posToX(1)}
                                    y1={20}
                                    y2={barBaseY}
                                    stroke="#F59E0B"
                                    strokeWidth={1.6}
                                    strokeDasharray="2 2"
                                  />
                                  <circle
                                    cx={posToX(1)}
                                    cy={barBaseY - maxBarH}
                                    r={3.2}
                                    fill="#F59E0B"
                                    stroke="#FFFFFF"
                                    strokeWidth={1.2}
                                  />
                                  <rect
                                    x={padX}
                                    y={3}
                                    width={76}
                                    height={16}
                                    rx={8}
                                    fill="#F59E0B"
                                  />
                                  <text
                                    x={padX + 38}
                                    y={14}
                                    textAnchor="middle"
                                    fill="#FFFFFF"
                                    fontSize={8.5}
                                    fontWeight={800}
                                  >
                                    1st · FASTEST
                                  </text>
                                </g>

                                {/* Goal vertical marker + callout pill */}
                                {rawGoalX !== null && goalBadgeX !== null && goalPlace !== undefined && (
                                  <g>
                                    <line
                                      x1={rawGoalX}
                                      x2={rawGoalX}
                                      y1={goalRowY + 16}
                                      y2={barBaseY + 2}
                                      stroke="#10B981"
                                      strokeWidth={2}
                                    />
                                    <circle
                                      cx={rawGoalX}
                                      cy={barBaseY}
                                      r={3.5}
                                      fill="#10B981"
                                      stroke="#FFFFFF"
                                      strokeWidth={1.3}
                                    />
                                    <rect
                                      x={goalBadgeX - 33}
                                      y={goalRowY}
                                      width={66}
                                      height={16}
                                      rx={8}
                                      fill="#10B981"
                                    />
                                    <text
                                      x={goalBadgeX}
                                      y={goalRowY + 11}
                                      textAnchor="middle"
                                      fill="#FFFFFF"
                                      fontSize={9}
                                      fontWeight={700}
                                    >
                                      GOAL {formatOrdinalPlace(goalPlace)}
                                    </text>
                                  </g>
                                )}

                                {/* You Today vertical marker + prominent callout pill */}
                                <g>
                                  <line
                                    x1={rawTodayX}
                                    x2={rawTodayX}
                                    y1={todayRowY + 17}
                                    y2={barBaseY + 2}
                                    stroke="#0593C6"
                                    strokeWidth={2.4}
                                  />
                                  <circle
                                    cx={rawTodayX}
                                    cy={barBaseY}
                                    r={4.2}
                                    fill="#0593C6"
                                    stroke="#FFFFFF"
                                    strokeWidth={1.5}
                                  />
                                  <rect
                                    x={todayBadgeX - 36}
                                    y={todayRowY}
                                    width={72}
                                    height={17}
                                    rx={8.5}
                                    fill="#0593C6"
                                  />
                                  <text
                                    x={todayBadgeX}
                                    y={todayRowY + 11.5}
                                    textAnchor="middle"
                                    fill="#FFFFFF"
                                    fontSize={9.5}
                                    fontWeight={800}
                                  >
                                    YOU: {formatOrdinalPlace(todayPlace)}
                                  </text>
                                </g>

                                {/* Axis Direction & Speed Labels */}
                                <text
                                  x={padX}
                                  y={121}
                                  textAnchor="start"
                                  className="fill-amber-600 dark:fill-amber-400 text-[9.5px] font-bold tabular-nums"
                                >
                                  ← Fastest · 1st ({formatDuration(currentYraaPlacement.checkpoints.firstPlaceSec)})
                                </text>
                                <text
                                  x={padX + plotW / 2}
                                  y={121}
                                  textAnchor="middle"
                                  className="fill-slate-500 dark:fill-slate-400 text-[9px] font-semibold tabular-nums"
                                >
                                  Median {formatOrdinalPlace(Math.ceil(totalFinishers / 2))} (
                                  {formatDuration(currentYraaPlacement.checkpoints.medianSec)})
                                </text>
                                <text
                                  x={svgW - padX}
                                  y={121}
                                  textAnchor="end"
                                  className="fill-slate-500 dark:fill-slate-400 text-[9.5px] font-semibold tabular-nums"
                                >
                                  {formatOrdinalPlace(totalFinishers)} ({formatDuration(currentYraaPlacement.checkpoints.lastPlaceSec)}) · Slowest →
                                </text>
                              </svg>
                            );
                          })()}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                              Fastest: 1st ({formatDuration(currentYraaPlacement.checkpoints.firstPlaceSec)})
                            </span>
                            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#0593C6]" />
                              You Currently: {formatOrdinalPlace(todayPlace)} ({finishersBehindToday} behind you)
                            </span>
                            {goalPlace !== undefined && (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                Goal: {formatOrdinalPlace(goalPlace)} (beats{' '}
                                {Math.max(0, totalFinishers - (goalPlace - 1))} of {totalFinishers})
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setShowAllPlaces((prev) => !prev)}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#0F1C28] border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-[#0593C6] hover:bg-[#0593C6]/10 transition-colors cursor-pointer"
                          >
                            {showAllPlaces
                              ? 'Hide Full Standings'
                              : `View Every Place (1st–${formatOrdinalPlace(totalFinishers)})`}
                          </button>
                        </div>

                        {/* Division Meet Benchmark Checkpoints */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-[11px] tabular-nums">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase">1st Place</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {formatDuration(currentYraaPlacement.checkpoints.firstPlaceSec)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase">Top 5 Cutoff</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {formatDuration(currentYraaPlacement.checkpoints.top5Sec)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase">Top 10 Cutoff</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {formatDuration(currentYraaPlacement.checkpoints.top10Sec)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase">Top 25 Cutoff</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {formatDuration(currentYraaPlacement.checkpoints.top25Sec)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase">Median (50%)</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {formatDuration(currentYraaPlacement.checkpoints.medianSec)}
                            </span>
                          </div>
                        </div>

                        {/* Expandable Full Every-Place Standings Table */}
                        {showAllPlaces && (
                          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                Complete {selectedDivision.label} Standings ({totalFinishers} places)
                              </span>
                              <div className="inline-flex p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => setPlaceViewFilter('all')}
                                  className={`px-2.5 py-0.5 rounded-md font-semibold cursor-pointer ${
                                    placeViewFilter === 'all'
                                      ? 'bg-white dark:bg-[#162433] text-slate-900 dark:text-white'
                                      : 'text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  All ({totalFinishers})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPlaceViewFilter('around_today')}
                                  className={`px-2.5 py-0.5 rounded-md font-semibold cursor-pointer ${
                                    placeViewFilter === 'around_today'
                                      ? 'bg-white dark:bg-[#162433] text-[#0593C6]'
                                      : 'text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  Near Today ({formatOrdinalPlace(todayPlace)})
                                </button>
                                {goalPlace !== undefined && (
                                  <button
                                    type="button"
                                    onClick={() => setPlaceViewFilter('around_goal')}
                                    className={`px-2.5 py-0.5 rounded-md font-semibold cursor-pointer ${
                                      placeViewFilter === 'around_goal'
                                        ? 'bg-white dark:bg-[#162433] text-emerald-600 dark:text-emerald-400'
                                        : 'text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    Near Goal ({formatOrdinalPlace(goalPlace)})
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1C28] divide-y divide-slate-100 dark:divide-slate-800/70 text-[11px] tabular-nums">
                              {visiblePlaceIndices.map((idx) => {
                                const place = idx + 1;
                                const timeSec = selectedDivision.timesSec[idx];
                                const isTodaySpot = place === todayPlace;
                                const isGoalSpot = goalPlace === place;
                                const isBetween =
                                  goalPlace !== undefined &&
                                  place >= goalPlace &&
                                  place <= todayPlace;

                                return (
                                  <React.Fragment key={place}>
                                    {isGoalSpot && goalYraaPlacement && (
                                      <div className="px-3 py-1.5 bg-emerald-500/12 border-l-2 border-l-emerald-500 flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-300">
                                        <span>
                                          YOUR GOAL TARGET ({formatOrdinalPlace(place)} of{' '}
                                          {totalFinishers})
                                        </span>
                                        <span>
                                          {formatDuration(
                                            goalYraaPlacement.equivalentDivisionTimeSeconds
                                          )}{' '}
                                          ·{' '}
                                          {formatPace(
                                            goalYraaPlacement.equivalentDivisionTimeSeconds /
                                              selectedDivision.distanceKm,
                                            unit
                                          )}
                                        </span>
                                      </div>
                                    )}
                                    {isTodaySpot && (
                                      <div className="px-3 py-1.5 bg-[#0593C6]/12 border-l-2 border-l-[#0593C6] flex items-center justify-between font-bold text-[#0593C6]">
                                        <span>
                                          YOU TODAY ({formatOrdinalPlace(place)} of {totalFinishers} ·
                                          Ahead of {finishersBehindToday})
                                        </span>
                                        <span>
                                          {formatDuration(
                                            currentYraaPlacement.equivalentDivisionTimeSeconds
                                          )}{' '}
                                          ·{' '}
                                          {formatPace(
                                            currentYraaPlacement.equivalentDivisionTimeSeconds /
                                              selectedDivision.distanceKm,
                                            unit
                                          )}
                                        </span>
                                      </div>
                                    )}
                                    <div
                                      className={`px-3 py-1.5 flex items-center justify-between ${
                                        isBetween
                                          ? 'bg-emerald-500/5 text-slate-800 dark:text-slate-100'
                                          : place > todayPlace
                                          ? 'text-slate-500 dark:text-slate-400'
                                          : 'text-slate-700 dark:text-slate-300'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="font-semibold w-12">
                                          {formatOrdinalPlace(place)}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                          Top {Math.max(1, Math.round((place / totalFinishers) * 100))}%
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                                          {formatDuration(timeSec)}
                                        </span>
                                        <span className="text-slate-400 w-16 text-right">
                                          {formatPace(timeSec / selectedDivision.distanceKm, unit)}
                                        </span>
                                      </div>
                                    </div>
                                  </React.Fragment>
                                );
                              })}

                              {todayPlace > totalFinishers && (
                                <div className="px-3 py-1.5 bg-[#0593C6]/12 border-l-2 border-l-[#0593C6] flex items-center justify-between font-bold text-[#0593C6]">
                                  <span>
                                    YOU TODAY ({formatOrdinalPlace(todayPlace)} · Closing on{' '}
                                    {formatOrdinalPlace(totalFinishers)})
                                  </span>
                                  <span>
                                    {formatDuration(
                                      currentYraaPlacement.equivalentDivisionTimeSeconds
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  Log or sync at least one workout to compare your converted {selectedDivision.distanceKm}K fitness against the{' '}
                  <strong>{selectedDivision.label}</strong> field ({selectedDivision.finishersCount} finishers).
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </LiquidGlassReveal>

      {/* CARD 4: PREDICTOR TOOL (5K, 8K, 10K & MULTI-DISTANCE) */}
      <LiquidGlassReveal>
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#0F1C28] border border-slate-200/95 dark:border-slate-700/75 shadow-sm transition-colors">
        <button
          type="button"
          onClick={() => setIsPredictorExpanded((prev) => !prev)}
          className="w-full px-4 py-4 sm:px-5 sm:py-4.5 flex items-center justify-between text-left cursor-pointer group accordion-trigger select-none hover:bg-slate-50/90 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800/70"
          data-no-scale
          aria-expanded={isPredictorExpanded}
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[#0593C6] flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105">
              <Gauge className="w-4.5 h-4.5 stroke-[2.3]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">
                  Predictor Tool
                </h2>
                {predictorSummaryText && (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums truncate">
                    · {predictorSummaryText}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 ml-2">
            <div
              className={`p-2 rounded-lg border chevron-badge transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isPredictorExpanded
                  ? 'rotate-180 text-slate-900 dark:text-white bg-slate-200/80 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                  : 'bg-slate-100 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div
          className={`accordion-collapse-wrapper ${isPredictorExpanded ? 'is-expanded' : ''}`}
          aria-hidden={!isPredictorExpanded}
        >
          <div className="accordion-collapse-inner">
            <div className="px-4 pb-6 pt-4 sm:px-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Estimates equivalent race times for 5K, 8K, 10K, and more using your PR fitness and weekly training volume.
                </p>

                {multiDistancePrediction.hasData && (
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#0B1520] border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg tabular-nums self-start sm:self-auto shrink-0">
                    Endurance Curve: k = {multiDistancePrediction.enduranceExponent.toFixed(3)}
                  </div>
                )}
              </div>

              {multiDistancePrediction.hasData ? (
                <div className="space-y-3.5">
                  {/* Anchor PR & Volume Control Bar */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs tabular-nums">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Anchor PR Baseline
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white block truncate mt-0.5">
                          {multiDistancePrediction.anchorLabel}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Current Weekly Volume
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                          {unit === 'miles'
                            ? `${(multiDistancePrediction.measuredWeeklyKm * KM_TO_MILES).toFixed(1)} mi/wk`
                            : `${multiDistancePrediction.measuredWeeklyKm.toFixed(1)} km/wk`}{' '}
                          <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                            ({multiDistancePrediction.measuredRunsPerWeek}/wk · long{' '}
                            {unit === 'miles'
                              ? `${(multiDistancePrediction.longestRecentRunKm * KM_TO_MILES).toFixed(1)} mi`
                              : `${multiDistancePrediction.longestRecentRunKm.toFixed(1)} km`}
                            )
                          </span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Volume Durability Tier
                        </span>
                        <span className="font-bold text-[#0593C6] block mt-0.5">
                          {multiDistancePrediction.volumeTierLabel}
                        </span>
                      </div>
                    </div>

                    {/* Interactive Training Volume Simulator */}
                    <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0">
                        <label
                          htmlFor="predictor-volume-slider"
                          className="text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                        >
                          Simulate Volume:
                        </label>
                        <span className="text-xs font-extrabold text-[#0593C6] tabular-nums min-w-[68px]">
                          {unit === 'miles'
                            ? `${(multiDistancePrediction.effectiveWeeklyKm * KM_TO_MILES).toFixed(1)} mi/wk`
                            : `${multiDistancePrediction.effectiveWeeklyKm.toFixed(1)} km/wk`}
                        </span>
                      </div>

                      <input
                        id="predictor-volume-slider"
                        type="range"
                        min={5}
                        max={85}
                        step={1}
                        value={Math.min(85, Math.max(5, Math.round(multiDistancePrediction.effectiveWeeklyKm)))}
                        onChange={(e) => setSimulatedWeeklyKm(Number(e.target.value))}
                        className="w-full accent-[#0593C6] cursor-pointer"
                      />

                      {simulatedWeeklyKm !== null && (
                        <button
                          type="button"
                          onClick={() => setSimulatedWeeklyKm(null)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[#0F1C28] border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shrink-0 cursor-pointer self-start sm:self-auto"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {multiDistancePrediction.volumeAdjustmentSummary}
                    </p>
                  </div>

                  {/* Standard Race Distance Prediction Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 tabular-nums">
                    {multiDistancePrediction.predictions.map((item) => {
                      const deltaSec = item.predictedSeconds - item.measuredPredictedSeconds;
                      const isTargetRow = item.isGoalDistance;
                      const isCoreExtra =
                        item.id === '5k' || item.id === '8k' || item.id === '10k';

                      const readinessColor =
                        item.readiness === 'Race Ready'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : item.readiness === 'Strong Base'
                          ? 'text-[#0593C6]'
                          : item.readiness === 'Building Base'
                          ? 'text-violet-600 dark:text-violet-400'
                          : 'text-slate-500 dark:text-slate-400';

                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
                            isTargetRow
                              ? 'bg-[#0593C6]/8 border-[#0593C6]/35'
                              : isCoreExtra
                              ? 'bg-slate-50 dark:bg-[#0B1520] border-slate-200 dark:border-slate-700/80'
                              : 'bg-slate-50/70 dark:bg-[#0B1520]/80 border-slate-200/80 dark:border-slate-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`text-xs font-extrabold ${
                                  isTargetRow
                                    ? 'text-[#0593C6]'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {item.label}
                              </span>
                              {isTargetRow && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-[#0593C6]">
                                  Goal
                                </span>
                              )}
                            </div>

                            <div className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                              {formatDuration(item.predictedSeconds)}
                            </div>

                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              {formatPace(item.predictedPaceSecPerKm, unit)}
                            </div>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-0.5 text-[10px]">
                            <div className={`font-bold ${readinessColor}`}>
                              {item.readiness}
                            </div>

                            {simulatedWeeklyKm !== null && Math.abs(deltaSec) >= 1 ? (
                              <div
                                className={`font-semibold ${
                                  deltaSec < 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {deltaSec < 0
                                  ? `${formatDuration(Math.abs(deltaSec))} faster`
                                  : `+${formatDuration(deltaSec)} slower`}
                              </div>
                            ) : item.goalEquivalentSeconds ? (
                              <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                At Goal: {formatDuration(item.goalEquivalentSeconds)}
                              </div>
                            ) : (
                              <div className="text-slate-400">
                                Rec: {item.recommendedWeeklyKm} km/wk
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B1520] border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  Log or sync at least one run (or enter a current PR in Settings) to unlock volume-calibrated predictions for 3K, 5K, 6K, 8K, 10K, and Half Marathon.
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </LiquidGlassReveal>
    </div>
  );
};
