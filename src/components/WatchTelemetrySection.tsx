import React, { useState, useMemo } from 'react';
import { RunRecord } from '../types/running';
import { formatDuration, formatPace, MILES_TO_KM, KM_TO_MILES } from '../utils/runningCalculations';
import {
  Watch,
  Heart,
  Zap,
  Flame,
  Activity,
  Gauge,
  Trophy,
  Sliders,
  ChevronDown,
  ChevronUp,
  Info,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

interface WatchTelemetrySectionProps {
  runs: RunRecord[];
  unit: 'km' | 'miles';
  customMaxHr?: number;
  onUpdateMaxHr?: (maxHr: number) => void;
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
    color: '#ff9f0a', // amber/orange
    bgLight: 'bg-amber-50',
    bgDark: 'dark:bg-amber-950/30',
    borderLight: 'border-amber-200',
    borderDark: 'dark:border-amber-800/60',
    textColor: 'text-amber-600 dark:text-amber-400',
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
    description: 'Hard, rhythmic effort (6K race velocity). The highest intensity you can maintain before rapid lactic buildup.',
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

export const WatchTelemetrySection: React.FC<WatchTelemetrySectionProps> = ({
  runs,
  unit,
  customMaxHr,
  onUpdateMaxHr,
}) => {
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<number | 'all'>('all');
  const [isEditingMaxHr, setIsEditingMaxHr] = useState(false);
  const [tempMaxHr, setTempMaxHr] = useState<number>(195);
  const [showZoneDetails, setShowZoneDetails] = useState(false);

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

    // 1. Fastest Pace Ran Before
    const runsWithValidPace = [...runs].filter(
      (r) => r.averagePaceSecPerKm && r.averagePaceSecPerKm > 60 && r.averagePaceSecPerKm < 900
    );

    const sortedByPace = [...runsWithValidPace].sort(
      (a, b) => a.averagePaceSecPerKm - b.averagePaceSecPerKm
    );

    const fastestRun = sortedByPace[0] || null;
    const fastestPaceSec = fastestRun ? fastestRun.averagePaceSecPerKm : 0;
    const topPaces = sortedByPace.slice(0, 3);

    // 2. Heart Rate Highs
    let peakHeartRate = 0;
    let peakHeartRateRun: RunRecord | null = null;
    let highestAvgHeartRate = 0;
    let highestAvgHeartRateRun: RunRecord | null = null;
    let hrSum = 0;
    let hrCount = 0;

    runs.forEach((r) => {
      // Check max heart rate
      if (r.maxHeartRate && r.maxHeartRate > peakHeartRate) {
        peakHeartRate = r.maxHeartRate;
        peakHeartRateRun = r;
      }
      // If no maxHeartRate was provided but avgHeartRate is high, also compare
      if (r.avgHeartRate && r.avgHeartRate > peakHeartRate) {
        // peak might be at least average
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

    // 3. Cadence & Elevation
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

    // Calculated baseline Max HR (use highest recorded max HR, or 195 default)
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

  // Helper to determine which Zone a specific heart rate falls into
  const getZoneForHr = (hr: number, maxHr: number): HrZoneDefinition => {
    const pct = (hr / maxHr) * 100;
    if (pct < 60) return HR_ZONES[0];
    if (pct < 70) return HR_ZONES[1];
    if (pct < 80) return HR_ZONES[2];
    if (pct < 90) return HR_ZONES[3];
    return HR_ZONES[4];
  };

  // Group activities by their primary training zone
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

  // Filtered runs for the watch telemetry list
  const filteredWatchRuns = useMemo(() => {
    if (selectedZoneFilter === 'all') return runs;
    return zoneDistribution.zoneRunsMap[selectedZoneFilter] || [];
  }, [runs, selectedZoneFilter, zoneDistribution]);

  // Speed calculation for fastest pace (km/h and mph)
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

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-neutral-800/80 shadow-xs p-5 sm:p-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#0a84ff]/10 text-[#0a84ff] flex items-center justify-center">
              <Watch className="w-4 h-4" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
              Fitness Tracker Data
            </h2>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Fastest historical pace, peak heartbeat, and 5-zone cardiovascular training distribution
          </p>
        </div>

        {/* Max HR Baseline Setting */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
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
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#30d158] text-black cursor-pointer"
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
              onClick={() => {
                setTempMaxHr(maxHrToUse);
                setIsEditingMaxHr(true);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
              title="Calibrate your physiological Max Heart Rate"
            >
              <Sliders className="w-3.5 h-3.5 text-[#ff375f]" />
              <span>Max HR: <strong className="font-bold text-neutral-900 dark:text-white tabular-nums">{maxHrToUse} bpm</strong></span>
            </button>
          )}

          <button
            onClick={() => setShowZoneDetails(!showZoneDetails)}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Toggle Zone Details"
            aria-label="Toggle Zone Details"
          >
            <Info className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Top 3 Key Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Card 1: Fastest Pace Ever Ran */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-neutral-50 to-neutral-100/60 dark:from-neutral-900/80 dark:to-neutral-900/30 border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#30d158]/5 dark:bg-[#30d158]/10 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
              <span>Fastest Pace Ran Before</span>
              <Trophy className="w-4 h-4 text-[#30d158]" />
            </div>

            <div className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight tabular-nums mt-1">
              {metrics.fastestPaceSec > 0 ? formatPace(metrics.fastestPaceSec, unit) : '--:--'}
            </div>

            <div className="flex items-center space-x-2 text-xs text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
              <span>{unit === 'miles' ? `${speedMph} mph` : `${speedKmh} km/h`}</span>
              <span>·</span>
              <span>
                {metrics.fastestRun ? metrics.fastestRun.date : 'No runs logged yet'}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-200/70 dark:border-neutral-800/70">
            {metrics.fastestRun ? (
              <div className="text-[11px] text-neutral-600 dark:text-neutral-300 truncate">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {metrics.fastestRun.title}
                </span>{' '}
                ({metrics.fastestRun.distanceKm} km in {formatDuration(metrics.fastestRun.durationSeconds)})
              </div>
            ) : (
              <div className="text-[11px] text-neutral-400">
                Log a workout or sync your fitness tracker to find your fastest velocity.
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Highest Heart Rate Recorded */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-neutral-50 to-neutral-100/60 dark:from-neutral-900/80 dark:to-neutral-900/30 border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#ff375f]/5 dark:bg-[#ff375f]/10 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
              <span>Peak Heartbeat Recorded</span>
              <Heart className="w-4 h-4 text-[#ff375f] fill-[#ff375f]/30" />
            </div>

            <div className="text-3xl font-bold text-[#ff375f] tracking-tight tabular-nums mt-1 flex items-baseline space-x-1.5">
              <span>{metrics.peakHeartRate > 0 ? metrics.peakHeartRate : '--'}</span>
              <span className="text-sm font-semibold text-neutral-500">BPM</span>
            </div>

            <div className="flex items-center space-x-2 text-xs text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
              <span>
                {metrics.peakHeartRate > 0
                  ? `${Math.round((metrics.peakHeartRate / maxHrToUse) * 100)}% of Max HR`
                  : 'Heart rate sensor ready'}
              </span>
              <span>·</span>
              <span>
                {metrics.peakHeartRateRun ? metrics.peakHeartRateRun.date : '--'}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-200/70 dark:border-neutral-800/70 flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-300">
            <span>Overall Avg HR:</span>
            <span className="font-semibold text-neutral-900 dark:text-white tabular-nums">
              {metrics.overallAvgHeartRate > 0 ? `${metrics.overallAvgHeartRate} bpm` : '--'}
            </span>
          </div>
        </div>

        {/* Card 3: Fitness Tracker Biometrics Summary */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-neutral-50 to-neutral-100/60 dark:from-neutral-900/80 dark:to-neutral-900/30 border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
              <span>Fitness Tracker Telemetry</span>
              <Gauge className="w-4 h-4 text-[#0a84ff]" />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-medium">Avg Cadence</span>
                <div className="text-xl font-bold text-neutral-900 dark:text-white tabular-nums">
                  {metrics.overallAvgCadence > 0 ? `${metrics.overallAvgCadence} spm` : '--'}
                </div>
                <span className="text-[10px] text-neutral-500">
                  {metrics.overallAvgCadence >= 170 ? 'Optimal turnover' : 'Steps per minute'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-medium">Elevation Climb</span>
                <div className="text-xl font-bold text-neutral-900 dark:text-white tabular-nums">
                  {metrics.totalElevationMeters > 0 ? `${metrics.totalElevationMeters} m` : '--'}
                </div>
                <span className="text-[10px] text-neutral-500">Total vertical gain</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-200/70 dark:border-neutral-800/70 flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-300">
            <span>Tracker Activities:</span>
            <span className="font-semibold text-[#0a84ff] tabular-nums">
              {watchRuns.length} workouts synced
            </span>
          </div>
        </div>
      </div>

      {/* Heart Rate Training Zones Breakdown */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight flex items-center space-x-1.5">
              <Activity className="w-4 h-4 text-[#ff375f]" />
              <span>Heart Rate Training Zones (Based on {maxHrToUse} BPM Max)</span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Tap any zone to filter your activities or explore physiological targets
            </p>
          </div>

          {selectedZoneFilter !== 'all' && (
            <button
              onClick={() => setSelectedZoneFilter('all')}
              className="text-xs font-semibold text-[#0a84ff] hover:underline cursor-pointer"
            >
              Show All Zones
            </button>
          )}
        </div>

        {/* 5-Zone Distribution Bar */}
        <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-xl h-3.5 flex overflow-hidden p-0.5 gap-0.5 mb-3 shadow-inner">
          {HR_ZONES.map((zoneDef) => {
            const count = zoneDistribution.counts[zoneDef.zone as keyof typeof zoneDistribution.counts];
            const pct = totalZoneRuns > 0 ? (count / totalZoneRuns) * 100 : 20;

            return (
              <div
                key={zoneDef.zone}
                style={{ width: `${Math.max(5, pct)}%`, backgroundColor: zoneDef.color }}
                className="h-full rounded-sm transition-all duration-300 relative group cursor-pointer hover:opacity-90"
                onClick={() => setSelectedZoneFilter(zoneDef.zone)}
                title={`Zone ${zoneDef.zone}: ${zoneDef.name} (${count} runs, ${Math.round(pct)}%)`}
              />
            );
          })}
        </div>

        {/* Interactive Zone Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {HR_ZONES.map((zoneDef) => {
            const minBpm = Math.round((zoneDef.minPct / 100) * maxHrToUse);
            const maxBpm = Math.round((zoneDef.maxPct / 100) * maxHrToUse);
            const count = zoneDistribution.counts[zoneDef.zone as keyof typeof zoneDistribution.counts];
            const isSelected = selectedZoneFilter === zoneDef.zone;

            return (
              <button
                key={zoneDef.zone}
                onClick={() => setSelectedZoneFilter(isSelected ? 'all' : zoneDef.zone)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? `${zoneDef.bgLight} ${zoneDef.bgDark} ring-2 ring-[${zoneDef.color}] border-transparent shadow-xs`
                    : 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="w-full">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: zoneDef.color }}
                    >
                      Z{zoneDef.zone}
                    </span>
                    <span className="text-[11px] font-bold text-neutral-900 dark:text-white tabular-nums">
                      {count} {count === 1 ? 'run' : 'runs'}
                    </span>
                  </div>

                  <div className="font-bold text-xs text-neutral-900 dark:text-white leading-tight truncate">
                    {zoneDef.name}
                  </div>

                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mt-1 tabular-nums">
                    {minBpm} – {maxBpm} <span className="text-[10px] font-normal text-neutral-500">bpm</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 tabular-nums">
                    {zoneDef.minPct}% – {zoneDef.maxPct}% of Max
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-neutral-200/60 dark:border-neutral-800 text-[10px] text-neutral-500 line-clamp-2">
                  {zoneDef.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* Expandable Deep Physiological Zone Guide */}
        {showZoneDetails && (
          <div className="mt-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
              <span className="font-bold text-neutral-900 dark:text-white">
                How to Train Across Heart Rate Zones for 6K Cross Country
              </span>
              <span className="text-[11px] text-neutral-400">Cardiovascular Physiology</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-neutral-600 dark:text-neutral-300">
              <div className="space-y-1">
                <strong className="text-neutral-900 dark:text-white block">
                  Zones 1 & 2 (Aerobic Foundation):
                </strong>
                <p className="text-[11px]">
                  Builds capillary pathways around fast-twitch and slow-twitch muscle fibers. 70-80% of weekly mileage should be here so you can absorb high-intensity workouts without injury.
                </p>
              </div>

              <div className="space-y-1">
                <strong className="text-neutral-900 dark:text-white block">
                  Zones 4 & 5 (Threshold & Race Pace):
                </strong>
                <p className="text-[11px]">
                  Zone 4 teaches your body to buffer hydrogen ions at 6K race velocity. Zone 5 develops top-end sprint mechanics and VO2 max for track intervals and race kicks.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filtered Activities Table / List for Watch Telemetry */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight">
              Fitness Tracker Activity Logs
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 tabular-nums">
              {filteredWatchRuns.length}
            </span>
          </div>

          {selectedZoneFilter !== 'all' && (
            <span className="text-xs text-neutral-500">
              Filtered by Zone {selectedZoneFilter}
            </span>
          )}
        </div>

        {filteredWatchRuns.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-400 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
            No activities recorded in this heart rate training zone.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filteredWatchRuns.map((run) => {
              const repHr = run.avgHeartRate || (run.maxHeartRate ? Math.round(run.maxHeartRate * 0.88) : null);
              const zoneDef = repHr ? getZoneForHr(repHr, maxHrToUse) : null;
              const isFastestRun = metrics.fastestRun?.id === run.id;
              const isPeakHrRun = metrics.peakHeartRateRun?.id === run.id;

              return (
                <div
                  key={run.id}
                  className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs"
                >
                  {/* Left: Title & Date & Badges */}
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

                      {/* Fastest Pace Badge */}
                      {isFastestRun && (
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#30d158]/15 text-[#30d158]">
                          <Trophy className="w-2.5 h-2.5" />
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
                    </div>

                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center space-x-2">
                      <span>{run.date}</span>
                      <span>·</span>
                      <span>{run.runType}</span>
                      {run.source.startsWith('garmin') && (
                        <>
                          <span>·</span>
                          <span className="text-[#0a84ff] font-medium">Tracker Synced</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Watch Telemetry Stats */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 tabular-nums border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-200 dark:border-neutral-800">
                    {/* Distance & Time */}
                    <div className="text-left sm:text-right">
                      <div className="font-bold text-neutral-900 dark:text-white">
                        {run.distanceKm} km
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {formatDuration(run.durationSeconds)}
                      </div>
                    </div>

                    {/* Pace */}
                    <div className="text-left sm:text-right">
                      <div className="font-semibold text-neutral-900 dark:text-white">
                        {formatPace(run.averagePaceSecPerKm, unit)}
                      </div>
                      <div className="text-[10px] text-neutral-400 uppercase">Avg Pace</div>
                    </div>

                    {/* Heart Rate */}
                    <div className="text-left sm:text-right min-w-[70px]">
                      {run.avgHeartRate || run.maxHeartRate ? (
                        <>
                          <div className="font-bold text-[#ff375f] flex items-center justify-start sm:justify-end space-x-1">
                            <Heart className="w-3 h-3 fill-[#ff375f]" />
                            <span>{run.avgHeartRate || '--'} bpm</span>
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            Max: {run.maxHeartRate ? `${run.maxHeartRate} bpm` : '--'}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] text-neutral-400">No HR</div>
                      )}
                    </div>

                    {/* Cadence */}
                    <div className="hidden md:block text-right min-w-[60px]">
                      <div className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {run.avgCadence ? `${run.avgCadence} spm` : '--'}
                      </div>
                      <div className="text-[10px] text-neutral-400 uppercase">Cadence</div>
                    </div>

                    {/* Elevation */}
                    {run.elevationGainMeters !== undefined && (
                      <div className="hidden lg:block text-right min-w-[50px]">
                        <div className="font-semibold text-neutral-800 dark:text-neutral-200">
                          +{run.elevationGainMeters}m
                        </div>
                        <div className="text-[10px] text-neutral-400 uppercase">Climb</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
