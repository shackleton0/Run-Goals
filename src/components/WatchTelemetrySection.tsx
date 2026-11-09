import React, { useState, useMemo } from 'react';
import { RunRecord, RunType } from '../types/running';
import {
  formatDuration,
  formatPace,
  calculate6kEquivalent,
  calculateTargetDistanceEquivalent,
  calculatePaceSecPerKm,
  isAerobicRun,
  isIntervalRun,
  isHillRun,
  MILES_TO_KM,
  KM_TO_MILES,
} from '../utils/runningCalculations';
import {
  Watch,
  Heart,
  Zap,
  Activity,
  Gauge,
  Trophy,
  Sliders,
  ChevronDown,
  ChevronUp,
  Info,
  Search,
  Trash2,
  Check,
  Merge,
  CheckSquare,
  Square,
  UploadCloud,
  PlusCircle,
  Clock,
  Target,
  Mountain,
} from 'lucide-react';
import { IntervalCalibrationModal } from './IntervalCalibrationModal';

interface WatchTelemetrySectionProps {
  runs: RunRecord[];
  unit: 'km' | 'miles';
  targetDistanceKm?: number;
  target6kSec?: number;
  best6kSec?: number;
  customMaxHr?: number;
  onUpdateMaxHr?: (maxHr: number) => void;
  onDeleteRun: (runId: string) => void;
  onUpdateRunCategory: (runId: string, newCategory: RunType) => void;
  onUpdateRun?: (updatedRun: RunRecord) => void;
  onCombineRuns?: (combinedRun: RunRecord, sourceRunIds: string[]) => void;
  onOpenGarminSync?: () => void;
  onOpenAddRun?: () => void;
  savedDefaultInterval?: {
    targetIntervalPaceSecPerKm?: number;
    repDistanceMeters?: number;
    restDurationSeconds?: number;
    repCount?: number;
  };
  onSaveDefaultInterval?: (defaults: {
    targetIntervalPaceSecPerKm?: number;
    repDistanceMeters?: number;
    restDurationSeconds?: number;
    repCount?: number;
  }) => void;
}

export interface HrZoneDefinition {
  zone: number;
  name: string;
  shortName: string;
  minPct: number;
  maxPct: number;
  color: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
  textColor: string;
  description: string;
  benefit: string;
}

export const HR_ZONES: HrZoneDefinition[] = [
  {
    zone: 1,
    name: 'Active Recovery',
    shortName: 'Recovery',
    minPct: 50,
    maxPct: 60,
    color: '#38bdf8', // sky
    bgLight: 'bg-sky-50',
    bgDark: 'dark:bg-sky-950/30',
    borderLight: 'border-sky-200',
    borderDark: 'dark:border-sky-800/60',
    textColor: 'text-sky-600 dark:text-sky-400',
    description: 'Very light conversational effort. Flushes lactic acid and promotes cellular recovery.',
    benefit: 'Accelerates muscle restoration & aerobic capillary growth',
  },
  {
    zone: 2,
    name: 'Aerobic Base',
    shortName: 'Aerobic',
    minPct: 60,
    maxPct: 70,
    color: '#30d158', // green
    bgLight: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-950/30',
    borderLight: 'border-emerald-200',
    borderDark: 'dark:border-emerald-800/60',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    description: 'Foundational endurance pace. Enhances mitochondrial density and fat metabolism efficiency.',
    benefit: 'Builds core aerobic engine for cross country 6K stamina',
  },
  {
    zone: 3,
    name: 'Aerobic Tempo',
    shortName: 'Tempo',
    minPct: 70,
    maxPct: 80,
    color: '#0284c7', // sky blue
    bgLight: 'bg-sky-50',
    bgDark: 'dark:bg-sky-950/30',
    borderLight: 'border-sky-200',
    borderDark: 'dark:border-sky-800/60',
    textColor: 'text-sky-600 dark:text-sky-400',
    description: 'Comfortably hard tempo effort. Breathing is controlled but speaking requires pauses.',
    benefit: 'Improves muscular glycogen storage and sustained pace endurance',
  },
  {
    zone: 4,
    name: 'Lactate Threshold',
    shortName: 'Threshold',
    minPct: 80,
    maxPct: 90,
    color: '#ff375f', // pink/rose
    bgLight: 'bg-rose-50',
    bgDark: 'dark:bg-rose-950/30',
    borderLight: 'border-rose-200',
    borderDark: 'dark:border-rose-800/60',
    textColor: 'text-rose-600 dark:text-rose-400',
    description: 'Hard, rhythmic effort (6K race velocity). Highest intensity before rapid lactic buildup.',
    benefit: 'Shifts lactate turnpoint higher to hold aggressive 6K splits',
  },
  {
    zone: 5,
    name: 'Anaerobic / Max Effort',
    shortName: 'Max Effort',
    minPct: 90,
    maxPct: 100,
    color: '#a855f7', // purple
    bgLight: 'bg-purple-50',
    bgDark: 'dark:bg-purple-950/30',
    borderLight: 'border-purple-200',
    borderDark: 'dark:border-purple-800/60',
    textColor: 'text-purple-600 dark:text-purple-400',
    description: 'All-out velocity, track interval repetitions, and finish kick surges. Uses anaerobic glycolysis.',
    benefit: 'Maximizes VO2 max power and terminal finishing speed',
  },
];

const CATEGORY_CHOICES: { label: string; value: RunType }[] = [
  { label: 'Time Trial', value: 'Time Trial' },
  { label: '6K Time Trial', value: '6K Time Trial' },
  { label: 'Aerobic Run', value: 'Aerobic' },
  { label: 'Interval Training', value: 'Interval Training' },
  { label: 'Hill Repeats', value: 'Hill Repeats' },
  { label: 'Hill Run', value: 'Hill Run' },
  { label: 'Tempo / Threshold', value: 'Tempo' },
  { label: 'Aerobic Long Run', value: 'Long Run' },
  { label: 'Race', value: 'Race' },
  { label: 'Active Recovery', value: 'Recovery' },
];

export const WatchTelemetrySection: React.FC<WatchTelemetrySectionProps> = ({
  runs,
  unit,
  targetDistanceKm = 6.0,
  target6kSec,
  best6kSec,
  customMaxHr,
  onUpdateMaxHr,
  onDeleteRun,
  onUpdateRunCategory,
  onUpdateRun,
  onCombineRuns,
  onOpenGarminSync,
  onOpenAddRun,
  savedDefaultInterval,
  onSaveDefaultInterval,
}) => {
  const [isSectionExpanded, setIsSectionExpanded] = useState(false);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isEditingMaxHr, setIsEditingMaxHr] = useState(false);
  const [tempMaxHr, setTempMaxHr] = useState<number>(195);
  const [showZoneDetails, setShowZoneDetails] = useState(false);
  const [showAllActivityLogs, setShowAllActivityLogs] = useState(false);

  // Interval & Rest Calibration Modal State
  const [calibratingRun, setCalibratingRun] = useState<RunRecord | null>(null);

  const handleSaveIntervalForRun = (runId: string, updatedFields: Partial<RunRecord>) => {
    const targetRun = runs.find((r) => r.id === runId);
    if (targetRun && onUpdateRun) {
      onUpdateRun({ ...targetRun, ...updatedFields });
    }
  };

  // Combine Workouts Mode State
  const [isCombineMode, setIsCombineMode] = useState(false);
  const [selectedCombineIds, setSelectedCombineIds] = useState<Set<string>>(new Set());
  const [combinedTitle, setCombinedTitle] = useState('');
  const [combinedCategory, setCombinedCategory] = useState<RunType>('Aerobic');

  // Watch activities (from Garmin or with telemetry)
  const watchRuns = useMemo(() => {
    return runs.filter(
      (r) => r.source.startsWith('garmin') || r.avgHeartRate || r.maxHeartRate || r.avgCadence
    );
  }, [runs]);

  // Telemetry Calculations
  const metrics = useMemo(() => {
    if (runs.length === 0) {
      return {
        fastestPaceSec: 0,
        fastestRun: null as RunRecord | null,
        topPaces: [] as RunRecord[],
        peakHeartRate: 0,
        peakHeartRateRun: null as RunRecord | null,
        highestAvgHeartRate: 0,
        highestAvgHeartRateRun: null as RunRecord | null,
        overallAvgHeartRate: 0,
        overallAvgCadence: 0,
        totalElevationMeters: 0,
        detectedMaxHr: 195,
      };
    }

    const runsWithValidPace = [...runs].filter(
      (r) => r.averagePaceSecPerKm && r.averagePaceSecPerKm > 60 && r.averagePaceSecPerKm < 900
    );

    const sortedByPace = [...runsWithValidPace].sort(
      (a, b) => a.averagePaceSecPerKm - b.averagePaceSecPerKm
    );

    const fastestRun = sortedByPace[0] || null;
    const fastestPaceSec = fastestRun ? fastestRun.averagePaceSecPerKm : 0;
    const topPaces = sortedByPace.slice(0, 3);

    let peakHeartRate = 0;
    let peakHeartRateRun: RunRecord | null = null;
    let highestAvgHeartRate = 0;
    let highestAvgHeartRateRun: RunRecord | null = null;
    let hrSum = 0;
    let hrCount = 0;

    runs.forEach((r) => {
      if (r.maxHeartRate && r.maxHeartRate > peakHeartRate) {
        peakHeartRate = r.maxHeartRate;
        peakHeartRateRun = r;
      }
      if (r.avgHeartRate && r.avgHeartRate > peakHeartRate) {
        if (!r.maxHeartRate) {
          peakHeartRate = Math.round(r.avgHeartRate * 1.08);
          peakHeartRateRun = r;
        }
      }

      if (r.avgHeartRate) {
        hrSum += r.avgHeartRate;
        hrCount += 1;
        if (r.avgHeartRate > highestAvgHeartRate) {
          highestAvgHeartRate = r.avgHeartRate;
          highestAvgHeartRateRun = r;
        }
      }
    });

    const overallAvgHeartRate = hrCount > 0 ? Math.round(hrSum / hrCount) : 0;

    let cadSum = 0;
    let cadCount = 0;
    let totalElevationMeters = 0;

    runs.forEach((r) => {
      if (r.avgCadence) {
        cadSum += r.avgCadence;
        cadCount += 1;
      }
      if (r.elevationGainMeters) {
        totalElevationMeters += r.elevationGainMeters;
      }
    });

    const overallAvgCadence = cadCount > 0 ? Math.round(cadSum / cadCount) : 0;
    const detectedMaxHr = customMaxHr || (peakHeartRate > 150 ? peakHeartRate : 195);

    return {
      fastestPaceSec,
      fastestRun,
      topPaces,
      peakHeartRate,
      peakHeartRateRun,
      highestAvgHeartRate,
      highestAvgHeartRateRun,
      overallAvgHeartRate,
      overallAvgCadence,
      totalElevationMeters,
      detectedMaxHr,
    };
  }, [runs, customMaxHr]);

  const maxHrToUse = customMaxHr || metrics.detectedMaxHr;

  const getZoneForHr = (hr: number, maxHr: number): HrZoneDefinition => {
    const pct = (hr / maxHr) * 100;
    if (pct < 60) return HR_ZONES[0];
    if (pct < 70) return HR_ZONES[1];
    if (pct < 80) return HR_ZONES[2];
    if (pct < 90) return HR_ZONES[3];
    return HR_ZONES[4];
  };

  const zoneDistribution = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const zoneRunsMap: Record<number, RunRecord[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };

    runs.forEach((r) => {
      const representativeHr = r.avgHeartRate || (r.maxHeartRate ? Math.round(r.maxHeartRate * 0.88) : null);
      if (representativeHr) {
        const zoneDef = getZoneForHr(representativeHr, maxHrToUse);
        counts[zoneDef.zone as keyof typeof counts] += 1;
        zoneRunsMap[zoneDef.zone].push(r);
      }
    });

    return { counts, zoneRunsMap };
  }, [runs, maxHrToUse]);

  const totalZoneRuns = Object.values(zoneDistribution.counts).reduce((a, b) => a + b, 0);

  // Search and Zone Filtered Runs
  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      // Zone filter
      if (selectedZoneFilter !== 'all') {
        const repHr = run.avgHeartRate || (run.maxHeartRate ? Math.round(run.maxHeartRate * 0.88) : null);
        if (!repHr) return false;
        const zone = getZoneForHr(repHr, maxHrToUse).zone;
        if (zone !== selectedZoneFilter) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = run.title.toLowerCase().includes(q);
        const matchesNotes = run.notes ? run.notes.toLowerCase().includes(q) : false;
        const matchesDate = run.date.includes(q);
        const matchesType = run.runType.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNotes && !matchesDate && !matchesType) {
          return false;
        }
      }

      return true;
    });
  }, [runs, selectedZoneFilter, searchQuery, maxHrToUse]);

  // Combine selection logic
  const toggleSelectRunForCombine = (id: string) => {
    const next = new Set(selectedCombineIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedCombineIds(next);
  };

  const selectedRunsForMerge = useMemo(() => {
    return runs.filter((r) => selectedCombineIds.has(r.id));
  }, [runs, selectedCombineIds]);

  const mergedDistanceKm = selectedRunsForMerge.reduce((sum, r) => sum + r.distanceKm, 0);
  const mergedDurationSec = selectedRunsForMerge.reduce((sum, r) => sum + r.durationSeconds, 0);
  const mergedPaceSec = calculatePaceSecPerKm(mergedDistanceKm, mergedDurationSec);
  const merged6kSec = calculate6kEquivalent(mergedDistanceKm, mergedDurationSec);

  const runsWithHr = selectedRunsForMerge.filter((r) => r.avgHeartRate);
  const mergedAvgHr =
    runsWithHr.length > 0
      ? Math.round(runsWithHr.reduce((sum, r) => sum + (r.avgHeartRate || 0), 0) / runsWithHr.length)
      : undefined;
  const mergedMaxHr = Math.max(
    ...selectedRunsForMerge.map((r) => r.maxHeartRate || 0).filter((h) => h > 0),
    0
  );
  const mergedElevation = selectedRunsForMerge.reduce(
    (sum, r) => sum + (r.elevationGainMeters || 0),
    0
  );

  const handleExecuteCombine = () => {
    if (selectedRunsForMerge.length < 2 || !onCombineRuns) return;

    const latestDate = [...selectedRunsForMerge].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0].date;

    const defaultTitle = `Combined Workout (${selectedRunsForMerge.map((r) => r.title).join(' + ')})`;

    const combinedRecord: RunRecord = {
      id: `run_combined_${Date.now()}`,
      userId: selectedRunsForMerge[0].userId || 'local_user',
      date: latestDate,
      title: combinedTitle.trim() || defaultTitle,
      distanceKm: Number(mergedDistanceKm.toFixed(2)),
      durationSeconds: Math.round(mergedDurationSec),
      averagePaceSecPerKm: Math.round(mergedPaceSec),
      best6kTimeSeconds: merged6kSec,
      runType: combinedCategory,
      avgHeartRate: mergedAvgHr,
      maxHeartRate: mergedMaxHr > 0 ? mergedMaxHr : undefined,
      elevationGainMeters: mergedElevation > 0 ? mergedElevation : undefined,
      source: 'manual',
      notes: `Combined from ${selectedRunsForMerge.length} workouts: ${selectedRunsForMerge.map((r) => r.title).join(', ')}`,
      createdAt: new Date().toISOString(),
    };

    onCombineRuns(combinedRecord, Array.from(selectedCombineIds));
    setSelectedCombineIds(new Set());
    setIsCombineMode(false);
    setCombinedTitle('');
  };

  const speedKmh = metrics.fastestPaceSec > 0 ? (3600 / metrics.fastestPaceSec).toFixed(1) : '0.0';
  const speedMph = metrics.fastestPaceSec > 0 ? ((3600 / metrics.fastestPaceSec) * KM_TO_MILES).toFixed(1) : '0.0';

  const handleSaveMaxHr = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempMaxHr >= 140 && tempMaxHr <= 230) {
      if (onUpdateMaxHr) {
        onUpdateMaxHr(tempMaxHr);
      }
      setIsEditingMaxHr(false);
    }
  };

  // Determine which runs to render in list
  // Default: 1 most recent.
  // Expanded or in combine mode or searching: show all filtered
  const shouldShowAll = showAllActivityLogs || isCombineMode || searchQuery.trim().length > 0;
  const displayedRuns = shouldShowAll ? filteredRuns : filteredRuns.slice(0, 1);

  return (
    <div className="rounded-2xl bg-[#FCFFFF] dark:bg-[#12222f] border border-neutral-200/90 dark:border-neutral-800 shadow-xs p-4 sm:p-5 transition-colors">
      {/* Clickable Dropdown Header (Resting state shows only title) */}
      <button
        type="button"
        onClick={() => setIsSectionExpanded(!isSectionExpanded)}
        className="w-full flex items-center justify-between text-left cursor-pointer group"
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#0593C6]/15 text-[#0593C6] flex items-center justify-center shrink-0">
            <Watch className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-[#FCFFFF] tracking-tight group-hover:text-[#0593C6] transition-colors">
                Garmin & Fitness Watch Telemetry
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0593C6]/10 text-[#0593C6]">
                {runs.length} Activities Logged
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] dark:text-[#34d399] tabular-nums hidden sm:inline">
                Max HR: {maxHrToUse} bpm
              </span>
            </div>
          </div>
        </div>

        {/* Dropdown Chevron */}
        <div className="flex items-center space-x-2 shrink-0 ml-2">
          <div className={`p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 transition-transform duration-200 ${isSectionExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* Expanded Content Dropdown */}
      {isSectionExpanded && (
        <div className="pt-4 mt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Peak pace benchmarks, maximum cardiac load, 5-zone cardiovascular distribution, and unified activity logs
            </p>

            {/* Max HR Baseline Setting */}
            <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
              {isEditingMaxHr ? (
                <form onSubmit={handleSaveMaxHr} className="flex items-center space-x-1.5">
                  <span className="text-xs text-neutral-500 font-medium">Max HR:</span>
                  <input
                    type="number"
                    min={140}
                    max={230}
                    value={tempMaxHr}
                    onChange={(e) => setTempMaxHr(parseInt(e.target.value, 10) || 195)}
                    className="w-16 px-2 py-1 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white font-bold"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#0593C6] text-white cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingMaxHr(false)}
                    className="px-2 py-1 rounded-lg text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTempMaxHr(maxHrToUse);
                    setIsEditingMaxHr(true);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700"
                  title="Calibrate your physiological Max Heart Rate"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>
                    Max HR: <strong className="font-bold text-neutral-900 dark:text-white tabular-nums">{maxHrToUse} bpm</strong>
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowZoneDetails(!showZoneDetails)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700"
                title="Toggle Zone Details"
                aria-label="Toggle Zone Details"
              >
                <Info className="w-4 h-4 text-neutral-500" />
              </button>
            </div>
          </div>

      {/* Top 3 Key Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Card 1: Fastest Pace Recorded */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
              <span>Peak Velocity / Fastest Pace</span>
              <Zap className="w-4 h-4 text-[#0593C6]" />
            </div>

            <div className="text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight tabular-nums mt-1 font-sans">
              {metrics.fastestPaceSec > 0 ? formatPace(metrics.fastestPaceSec, unit) : '--:--'}
            </div>

            <div className="flex items-center space-x-2 text-xs text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
              <span>{unit === 'miles' ? `${speedMph} mph` : `${speedKmh} km/h`}</span>
              <span aria-hidden="true">·</span>
              <span>
                {metrics.fastestRun ? metrics.fastestRun.date : 'No runs logged'}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-200/80 dark:border-neutral-800/80">
            {metrics.fastestRun ? (
              <div className="text-[11px] text-neutral-600 dark:text-neutral-300 truncate">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {metrics.fastestRun.title}
                </span>{' '}
                ({metrics.fastestRun.distanceKm} km in {formatDuration(metrics.fastestRun.durationSeconds)})
              </div>
            ) : (
              <div className="text-[11px] text-neutral-400">
                Log a workout or sync Garmin to record your peak speed.
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Highest Heart Rate Recorded */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
              <span>Maximum Cardiac Load</span>
              <Heart className="w-4 h-4 text-[#10B981] fill-[#10B981]/20" />
            </div>

            <div className="text-3xl font-extrabold text-[#10B981] dark:text-[#34d399] tracking-tight tabular-nums mt-1 flex items-baseline space-x-1.5 font-sans">
              <span>{metrics.peakHeartRate > 0 ? metrics.peakHeartRate : '--'}</span>
              <span className="text-sm font-semibold text-neutral-500">BPM</span>
            </div>

            <div className="flex items-center space-x-2 text-xs text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
              <span>
                {metrics.peakHeartRate > 0
                  ? `${Math.round((metrics.peakHeartRate / maxHrToUse) * 100)}% of Max HR`
                  : 'Sensor ready'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {metrics.peakHeartRateRun ? metrics.peakHeartRateRun.date : '--'}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-200/80 dark:border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-300">
            <span>Overall Avg HR:</span>
            <span className="font-semibold text-neutral-900 dark:text-white tabular-nums">
              {metrics.overallAvgHeartRate > 0 ? `${metrics.overallAvgHeartRate} bpm` : '--'}
            </span>
          </div>
        </div>

        {/* Card 3: Fitness Tracker Biometrics Summary */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#0c151c] border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
              <span>Biometric Workload & Cadence</span>
              <Gauge className="w-4 h-4 text-[#0593C6]" />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Avg Cadence</span>
                <div className="text-xl font-extrabold text-neutral-900 dark:text-white tabular-nums">
                  {metrics.overallAvgCadence > 0 ? `${metrics.overallAvgCadence} spm` : '--'}
                </div>
                <span className="text-[10px] text-neutral-500">
                  {metrics.overallAvgCadence >= 170 ? 'Optimal turnover' : 'Steps per minute'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Elevation Climb</span>
                <div className="text-xl font-extrabold text-neutral-900 dark:text-white tabular-nums">
                  {metrics.totalElevationMeters > 0 ? `${metrics.totalElevationMeters} m` : '--'}
                </div>
                <span className="text-[10px] text-neutral-500">Total vertical gain</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-200/80 dark:border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-300">
            <span>Synced Activities:</span>
            <span className="font-semibold text-[#0593C6] tabular-nums">
              {watchRuns.length} workouts
            </span>
          </div>
        </div>
      </div>

      {/* Heart Rate Training Zones Breakdown - Clean Z1 to Z5 */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-[#FCFFFF] tracking-tight flex items-center space-x-1.5">
              <Activity className="w-4 h-4 text-[#10B981]" />
              <span>Training Zones (Based on {maxHrToUse} BPM Max)</span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Select a zone to filter activity logs and view physiological targets
            </p>
          </div>

          {selectedZoneFilter !== 'all' && (
            <button
              onClick={() => {
                setSelectedZoneFilter('all');
                setShowZoneDetails(false);
              }}
              className="text-xs font-semibold text-[#0593C6] hover:underline cursor-pointer self-start sm:self-auto"
            >
              Reset to All Zones
            </button>
          )}
        </div>

        {/* 5-Zone Distribution Bar */}
        <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-xl h-2.5 flex overflow-hidden p-0.5 gap-0.5 mb-3 shadow-inner">
          {HR_ZONES.map((zoneDef) => {
            const count = zoneDistribution.counts[zoneDef.zone as keyof typeof zoneDistribution.counts];
            const pct = totalZoneRuns > 0 ? (count / totalZoneRuns) * 100 : 20;

            return (
              <div
                key={zoneDef.zone}
                style={{ width: `${Math.max(5, pct)}%`, backgroundColor: zoneDef.color }}
                className="h-full rounded-xs transition-all duration-300 relative cursor-pointer hover:opacity-90"
                onClick={() => setSelectedZoneFilter(zoneDef.zone)}
                title={`Z${zoneDef.zone}: ${zoneDef.name} (${count} runs)`}
              />
            );
          })}
        </div>

        {/* Minimal Z1, Z2, Z3, Z4, Z5 Selector Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            onClick={() => {
              setSelectedZoneFilter('all');
              setShowZoneDetails(false);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              selectedZoneFilter === 'all'
                ? 'bg-[#0593C6] text-[#FCFFFF] shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
            }`}
          >
            <span>All Zones ({totalZoneRuns})</span>
          </button>

          {HR_ZONES.map((zoneDef) => {
            const count = zoneDistribution.counts[zoneDef.zone as keyof typeof zoneDistribution.counts];
            const isSelected = selectedZoneFilter === zoneDef.zone;

            return (
              <button
                key={zoneDef.zone}
                onClick={() => {
                  setSelectedZoneFilter(isSelected ? 'all' : zoneDef.zone);
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 shadow-xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}
                style={
                  isSelected
                    ? {
                        backgroundColor: zoneDef.color,
                        color: zoneDef.zone === 2 ? '#000000' : '#ffffff',
                        borderColor: zoneDef.color,
                      }
                    : undefined
                }
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isSelected ? 'currentColor' : zoneDef.color }}
                />
                <span>Z{zoneDef.zone}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold tabular-nums ${
                    isSelected
                      ? 'bg-black/20 text-current'
                      : 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Zone Focus Card with "Display More" Button */}
        {selectedZoneFilter !== 'all' && (() => {
          const activeZone = HR_ZONES.find((z) => z.zone === selectedZoneFilter);
          if (!activeZone) return null;
          const minBpm = Math.round((activeZone.minPct / 100) * maxHrToUse);
          const maxBpm = Math.round((activeZone.maxPct / 100) * maxHrToUse);
          const count = zoneDistribution.counts[activeZone.zone as keyof typeof zoneDistribution.counts];

          return (
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/90 dark:border-neutral-800 transition-all text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: activeZone.color }}
                  >
                    Z{activeZone.zone} {activeZone.name}
                  </span>
                  <span className="font-semibold text-neutral-900 dark:text-white tabular-nums">
                    {minBpm} – {maxBpm} bpm
                  </span>
                  <span className="text-neutral-400 tabular-nums">
                    ({activeZone.minPct}%–{activeZone.maxPct}% Max HR)
                  </span>
                  <span className="text-neutral-500 font-medium">
                    · {count} {count === 1 ? 'activity' : 'activities'} logged
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowZoneDetails(!showZoneDetails)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <Info className="w-3 h-3 text-[#0a84ff]" />
                  <span>{showZoneDetails ? 'Less Info' : 'More Zone Details'}</span>
                  {showZoneDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {showZoneDetails && (
                <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 space-y-2 animate-in fade-in duration-150">
                  <p className="text-xs leading-relaxed">
                    <strong className="text-neutral-900 dark:text-white font-semibold">Purpose: </strong>
                    {activeZone.description}
                  </p>
                  <p className="text-xs leading-relaxed">
                    <strong className="text-neutral-900 dark:text-white font-semibold">Adaptation Benefit: </strong>
                    {activeZone.benefit}
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Unified Activity Logs Section (Incorporates all Workout History features) */}
      <div className="pt-4 border-t border-neutral-200/80 dark:border-neutral-800">
        {/* Controls: Title, Search, Combine Workouts */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
              Activity & Workout Logs
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 tabular-nums">
              {filteredRuns.length}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Combine Workouts Mode Toggle */}
            {runs.length >= 2 && onCombineRuns && (
              <button
                type="button"
                onClick={() => {
                  setIsCombineMode(!isCombineMode);
                  setSelectedCombineIds(new Set());
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isCombineMode
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                }`}
              >
                <Merge className="w-3.5 h-3.5" />
                <span>{isCombineMode ? 'Cancel Combine' : 'Combine Workouts'}</span>
              </button>
            )}

            {/* Search Input */}
            <div className="relative min-w-[170px]">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-[#30d158]"
              />
            </div>
          </div>
        </div>

        {/* Combine Workouts Banner */}
        {isCombineMode && (
          <div className="mb-4 p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Merge className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-bold text-xs text-purple-950 dark:text-purple-200">
                    Combine Multiple Workouts
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-200/70 dark:bg-purple-800 text-purple-900 dark:text-purple-100 font-semibold tabular-nums">
                    {selectedCombineIds.size} selected
                  </span>
                </div>
                <p className="text-[11px] text-purple-700 dark:text-purple-300 mt-1">
                  Select 2 or more activities to merge their distances, times, and biometrics into a single unified session.
                </p>
              </div>

              {selectedRunsForMerge.length >= 2 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExecuteCombine}
                    className="px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Merge {selectedCombineIds.size} Workouts</span>
                  </button>
                </div>
              )}
            </div>

            {/* Merge Live Preview Card */}
            {selectedRunsForMerge.length >= 2 && (
              <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-white/80 dark:bg-black/50">
                  <span className="text-[10px] text-neutral-500 block uppercase">Total Distance</span>
                  <span className="font-bold text-neutral-900 dark:text-white tabular-nums">
                    {mergedDistanceKm.toFixed(2)} km
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white/80 dark:bg-black/50">
                  <span className="text-[10px] text-neutral-500 block uppercase">Total Duration</span>
                  <span className="font-bold text-neutral-900 dark:text-white tabular-nums">
                    {formatDuration(mergedDurationSec)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white/80 dark:bg-black/50">
                  <span className="text-[10px] text-neutral-500 block uppercase">Combined Pace</span>
                  <span className="font-bold text-neutral-900 dark:text-white tabular-nums">
                    {formatPace(mergedPaceSec, unit)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white/80 dark:bg-black/50">
                  <span className="text-[10px] text-neutral-500 block uppercase">New 6K Time</span>
                  <span className="font-bold text-[#30d158] tabular-nums">
                    {formatDuration(merged6kSec)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state vs Activity Items */}
        {runs.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
            <Activity className="w-8 h-8 text-neutral-400 dark:text-neutral-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              No Workouts Recorded Yet
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1 mb-4">
              Upload your Garmin Connect workout file or log a run to view cardiovascular training zones and telemetry.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {onOpenGarminSync && (
                <button
                  onClick={onOpenGarminSync}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#0a84ff] hover:bg-[#0071e3] text-white cursor-pointer shadow-xs"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload Garmin Data</span>
                </button>
              )}
              {onOpenAddRun && (
                <button
                  onClick={onOpenAddRun}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black cursor-pointer shadow-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Log Run</span>
                </button>
              )}
            </div>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-400 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
            No activities match your search or selected zone filter.
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedRuns.map((run) => {
              const repHr = run.avgHeartRate || (run.maxHeartRate ? Math.round(run.maxHeartRate * 0.88) : null);
              const zoneDef = repHr ? getZoneForHr(repHr, maxHrToUse) : null;
              const isFastestRun = metrics.fastestRun?.id === run.id;
              const isPeakHrRun = metrics.peakHeartRateRun?.id === run.id;
              const isCheckedForCombine = selectedCombineIds.has(run.id);

              const eqTarget =
                run.targetEquivalentSeconds ||
                calculateTargetDistanceEquivalent(run.distanceKm, run.durationSeconds, targetDistanceKm) ||
                run.best6kTimeSeconds ||
                0;
              const isPr = best6kSec && eqTarget === best6kSec;
              const beatsTarget = Boolean(target6kSec && target6kSec > 0 && eqTarget <= target6kSec);

              return (
                <div
                  key={run.id}
                  onClick={() => {
                    if (isCombineMode) toggleSelectRunForCombine(run.id);
                  }}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isCombineMode ? 'cursor-pointer' : ''
                  } ${
                    isCheckedForCombine
                      ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 dark:border-purple-600 shadow-xs'
                      : 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Left: Checkbox + Title + Interactive Category Dropdown + Zone Badge */}
                    <div className="flex items-start space-x-3 min-w-0">
                      {isCombineMode && (
                        <div className="mt-1 flex-shrink-0 text-purple-600">
                          {isCheckedForCombine ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-400" />
                          )}
                        </div>
                      )}

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-neutral-900 dark:text-white truncate">
                            {run.title}
                          </span>

                          {/* Zone Badge */}
                          {zoneDef && (
                            <span
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs"
                              style={{ backgroundColor: zoneDef.color }}
                            >
                              <span>Z{zoneDef.zone} {zoneDef.shortName}</span>
                            </span>
                          )}

                          {/* Interactive Category Selector Dropdown */}
                          <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={run.runType}
                              onChange={(e) => onUpdateRunCategory(run.id, e.target.value as RunType)}
                              aria-label={`Change category for ${run.title}`}
                              className="appearance-none text-[10px] font-semibold pl-2 pr-5 py-0.5 rounded-full bg-neutral-200/80 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-none cursor-pointer focus:outline-none hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                            >
                              {CATEGORY_CHOICES.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-2.5 h-2.5 text-neutral-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          {/* Hill Run Badge */}
                          {isHillRun(run.runType, run.title) && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              <Mountain className="w-2.5 h-2.5" />
                              <span>Hill{run.elevationGainMeters ? ` +${run.elevationGainMeters}m` : ''}</span>
                            </span>
                          )}

                          {/* Fastest Pace Badge */}
                          {isFastestRun && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#30d158]/15 text-[#30d158]">
                              <Zap className="w-2.5 h-2.5" />
                              <span>Fastest Pace</span>
                            </span>
                          )}

                          {/* Peak HR Badge */}
                          {isPeakHrRun && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ff375f]/15 text-[#ff375f]">
                              <Heart className="w-2.5 h-2.5 fill-[#ff375f]" />
                              <span>Peak HR</span>
                            </span>
                          )}

                          {/* PR / Sub-Goal */}
                          {isPr && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#30d158]/15 text-[#30d158]">
                              <Trophy className="w-2.5 h-2.5" />
                              <span>PR</span>
                            </span>
                          )}
                          {beatsTarget && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#0a84ff]/10 text-[#0a84ff]">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                              <span>Sub-Goal</span>
                            </span>
                          )}

                          {/* Rest Excluded Badge */}
                          {run.activeIntervalPaceSecPerKm && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              <Zap className="w-2.5 h-2.5" />
                              <span>Rest Excluded (-{formatDuration(run.totalRestSeconds || 0)})</span>
                            </span>
                          )}
                        </div>

                        {/* Date, notes, and tracker badge */}
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center gap-1.5">
                          <span>{run.date}</span>
                          {run.source.startsWith('garmin') && (
                            <>
                              <span>·</span>
                              <span className="text-[#0a84ff] font-medium">Tracker Synced</span>
                            </>
                          )}
                          {run.notes && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-xs italic text-neutral-600 dark:text-neutral-300">
                                "{run.notes}"
                              </span>
                            </>
                          )}
                        </div>

                        {/* Calibrated Active Interval Telemetry Row */}
                        {run.activeIntervalPaceSecPerKm && (
                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                            <span className="font-bold text-[#10B981]">
                              ⚡ Active Pace: {formatPace(run.activeIntervalPaceSecPerKm, unit)}
                            </span>
                            {run.targetIntervalPaceSecPerKm && (
                              <span className="text-neutral-600 dark:text-neutral-400 flex items-center space-x-1">
                                <Target className="w-3 h-3 text-[#10B981]" />
                                <span>Aimed: {formatPace(run.targetIntervalPaceSecPerKm, unit)}</span>
                                <span className={`font-semibold ${run.activeIntervalPaceSecPerKm <= run.targetIntervalPaceSecPerKm ? 'text-emerald-500' : 'text-amber-500'}`}>
                                  ({run.activeIntervalPaceSecPerKm <= run.targetIntervalPaceSecPerKm ? 'Target Hit!' : 'Off target'})
                                </span>
                              </span>
                            )}
                            {run.repCount && run.repDistanceMeters && (
                              <span className="text-neutral-400">
                                · {run.repCount} × {run.repDistanceMeters}m ({run.restDurationSeconds || 90}s rest)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Metrics + Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 tabular-nums border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-200 dark:border-neutral-800 text-xs">
                      {/* Distance & Time */}
                      <div className="text-left sm:text-right">
                        <div className="font-bold text-neutral-900 dark:text-white">
                          {unit === 'miles' ? `${(run.distanceKm * KM_TO_MILES).toFixed(2)} mi` : `${run.distanceKm} km`}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {formatDuration(run.durationSeconds)}
                        </div>
                      </div>

                      {/* Pace */}
                      <div className="text-left sm:text-right">
                        <div className={`font-semibold ${run.activeIntervalPaceSecPerKm ? 'text-[#10B981]' : 'text-neutral-900 dark:text-white'}`}>
                          {formatPace(run.activeIntervalPaceSecPerKm || run.averagePaceSecPerKm, unit)}
                        </div>
                        <div className="text-[10px] text-neutral-400 uppercase">
                          {run.activeIntervalPaceSecPerKm ? 'Active Pace' : 'Avg Pace'}
                        </div>
                        {run.activeIntervalPaceSecPerKm && (
                          <div className="text-[9px] text-neutral-400 line-through">
                            {formatPace(run.averagePaceSecPerKm, unit)}
                          </div>
                        )}
                      </div>

                      {/* 6K / Target Time Equivalent */}
                      <div className="text-left sm:text-right">
                        <div className="font-bold text-[#30d158]">
                          {formatDuration(eqTarget)}
                        </div>
                        <div className="text-[10px] text-neutral-400 uppercase">
                          {targetDistanceKm === 6 ? '6K Time' : `${targetDistanceKm}K Time`}
                        </div>
                      </div>

                      {/* Heart Rate */}
                      <div className="text-left sm:text-right min-w-[65px]">
                        {run.avgHeartRate || run.maxHeartRate ? (
                          <>
                            <div className="font-bold text-[#ff375f] flex items-center justify-start sm:justify-end space-x-1">
                              <Heart className="w-3 h-3 fill-[#ff375f]" />
                              <span>{run.avgHeartRate || '--'} bpm</span>
                            </div>
                            <div className="text-[10px] text-neutral-400">
                              Max: {run.maxHeartRate ? `${run.maxHeartRate}` : '--'}
                            </div>
                          </>
                        ) : (
                          <div className="text-[11px] text-neutral-400">--</div>
                        )}
                      </div>

                      {/* Cadence */}
                      {run.avgCadence ? (
                        <div className="hidden md:block text-right min-w-[55px]">
                          <div className="font-semibold text-neutral-800 dark:text-neutral-200">
                            {run.avgCadence} spm
                          </div>
                          <div className="text-[10px] text-neutral-400 uppercase">Cadence</div>
                        </div>
                      ) : null}

                      {/* Actions: Calibrate Interval & Delete (hidden when in combine mode) */}
                      {!isCombineMode && (
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCalibratingRun(run);
                            }}
                            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                              run.activeIntervalPaceSecPerKm
                                ? 'text-[#10B981] hover:text-[#0ea372] bg-[#10B981]/10 hover:bg-[#10B981]/20'
                                : 'text-neutral-400 hover:text-[#0593C6] hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
                            }`}
                            title="Calibrate interval sets, aimed pace, and strip rest duration"
                            aria-label={`Calibrate intervals for ${run.title}`}
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteRun(run.id);
                            }}
                            className="p-1.5 rounded-full text-neutral-400 hover:text-rose-500 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                            title="Delete workout"
                            aria-label={`Delete ${run.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Click to display more activities button (when not in search or combine mode) */}
            {filteredRuns.length > 1 && !isCombineMode && !searchQuery.trim() && (
              <div className="pt-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-neutral-100 dark:border-neutral-800/80">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {showAllActivityLogs
                    ? `Showing all ${filteredRuns.length} activities`
                    : `Showing 1 most recent activity (${filteredRuns.length - 1} older activities collapsed)`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllActivityLogs(!showAllActivityLogs)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer"
                >
                  <span>
                    {showAllActivityLogs
                      ? 'Show Most Recent Only'
                      : `Show More (${filteredRuns.length - 1} more)`}
                  </span>
                  {showAllActivityLogs ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
        </div>
      )}

      {/* Interval & Rest Calibration Modal for any existing workout */}
      {calibratingRun && (
        <IntervalCalibrationModal
          isOpen={!!calibratingRun}
          onClose={() => setCalibratingRun(null)}
          run={calibratingRun}
          unit={unit}
          onSaveInterval={handleSaveIntervalForRun}
          savedDefaultInterval={savedDefaultInterval}
          onSaveDefaultInterval={onSaveDefaultInterval}
        />
      )}
    </div>
  );
};
