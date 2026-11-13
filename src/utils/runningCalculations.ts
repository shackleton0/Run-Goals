import { RunRecord, UserProfile, WeeklyStat, AdherenceSummary, RunType, DuplicateRunMatch } from '../types/running';
import { YRAA_DIVISIONS, YraaDivisionData, YraaDivisionId } from '../data/yraaBenchmarks';

export const KM_TO_MILES = 0.621371;
export const MILES_TO_KM = 1.60934;

export function formatDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) return '--:--';
  if (seconds === 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const formattedMins = mins.toString().padStart(2, '0');
  const formattedSecs = secs.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${formattedMins}:${formattedSecs}`;
  }
  return `${formattedMins}:${formattedSecs}`;
}

export function parseDuration(input: string, assumeMinutesForBareNumber: boolean = true): number {
  if (!input || typeof input !== 'string') return 0;
  const clean = input.trim();
  if (!clean) return 0;

  if (clean.includes(':')) {
    const parts = clean.split(':').map((p) => parseFloat(p.trim()) || 0);
    if (parts.length === 3) {
      return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
    } else if (parts.length === 2) {
      return Math.round(parts[0] * 60 + parts[1]);
    }
  }

  const minMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes)/i);
  const secMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds)/i);
  const hrMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours)/i);

  if (minMatch || secMatch || hrMatch) {
    const h = hrMatch ? parseFloat(hrMatch[1]) : 0;
    const m = minMatch ? parseFloat(minMatch[1]) : 0;
    const s = secMatch ? parseFloat(secMatch[1]) : 0;
    return Math.round(h * 3600 + m * 60 + s);
  }

  const rawNum = parseFloat(clean);
  if (isNaN(rawNum) || rawNum <= 0) return 0;

  // When a runner enters a bare number like 24 or 24.5, assume it is minutes (e.g. 24 min = 1440 sec)
  if (assumeMinutesForBareNumber && rawNum < 600) {
    return Math.round(rawNum * 60);
  }

  return Math.round(rawNum);
}

export function calculatePaceSecPerKm(distanceKm: number, durationSeconds: number): number {
  if (!distanceKm || distanceKm <= 0 || !durationSeconds || durationSeconds <= 0) return 0;
  return durationSeconds / distanceKm;
}

export function formatPace(secPerKm: number, unit: 'km' | 'miles' = 'km'): string {
  if (!secPerKm || secPerKm <= 0 || !isFinite(secPerKm)) return '--:--';
  const pace = unit === 'miles' ? secPerKm * MILES_TO_KM : secPerKm;
  const mins = Math.floor(pace / 60);
  const secs = Math.floor(pace % 60);
  const unitSuffix = unit === 'miles' ? '/mi' : '/km';
  return `${mins}:${secs.toString().padStart(2, '0')} ${unitSuffix}`;
}

export function parsePace(input: string, unit: 'km' | 'miles' = 'km'): number {
  if (!input || typeof input !== 'string') return 0;
  const clean = input.trim().toLowerCase();
  if (!clean) return 0;

  const isMiles = clean.includes('/mi') || clean.includes('mi') || (unit === 'miles' && !clean.includes('km'));

  const stripped = clean
    .replace(/\/km|\/mi|km|mi|min\/km|min\/mi|mins\/km|mins\/mi/gi, '')
    .trim();

  let seconds = 0;

  if (stripped.includes(':')) {
    const parts = stripped.split(':').map((p) => parseFloat(p.trim()) || 0);
    if (parts.length === 2) {
      seconds = Math.round(parts[0] * 60 + parts[1]);
    } else if (parts.length === 3) {
      seconds = Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
    }
  } else {
    const rawNum = parseFloat(stripped);
    if (!isNaN(rawNum) && rawNum > 0) {
      if (rawNum < 30) {
        seconds = Math.round(rawNum * 60);
      } else {
        seconds = Math.round(rawNum);
      }
    }
  }

  if (seconds <= 0) return 0;

  if (isMiles) {
    return Math.round(seconds / MILES_TO_KM);
  }

  return seconds;
}

export function calculateTargetDistanceEquivalent(
  distanceKm: number,
  durationSeconds: number,
  targetDistanceKm: number = 6.0
): number {
  if (!distanceKm || distanceKm <= 0 || !durationSeconds || durationSeconds <= 0 || !targetDistanceKm || targetDistanceKm <= 0) return 0;
  if (Math.abs(distanceKm - targetDistanceKm) < 0.05) {
    return Math.round(durationSeconds * (targetDistanceKm / distanceKm));
  }
  // Extrapolating upward from short efforts (< 3.5 km, e.g., 1 km in 3:56) requires a
  // steeper anaerobic-to-aerobic fatigue exponent than standard 1.06 Riegel so short sprints
  // never over-predict 5K/6K+ continuous race pace.
  let exponent = 1.06;
  if (distanceKm < 3.5 && targetDistanceKm > distanceKm) {
    const clampedDist = Math.max(0.4, distanceKm);
    const shortDistanceBoost = ((3.5 - clampedDist) / 2.5) * 0.08; // +0.08 at 1.0 km -> 1.14 exponent
    exponent = Math.min(1.16, 1.06 + shortDistanceBoost);
  }
  const riegelFactor = Math.pow(targetDistanceKm / distanceKm, exponent);
  return Math.round(durationSeconds * riegelFactor);
}

export function calculate6kEquivalent(distanceKm: number, durationSeconds: number): number {
  return calculateTargetDistanceEquivalent(distanceKm, durationSeconds, 6.0);
}

/**
 * Selects the best target-distance time estimate across logged runs.
 * Always recomputes dynamically from distance & duration and prioritizes
 * continuous multi-kilometer efforts (>= 2.5 km) over short sprints/intervals when available.
 */
export function selectBestTargetEquivalent(
  runs: RunRecord[],
  targetDistanceKm: number = 6.0
): { bestSeconds?: number; basisRun?: RunRecord; isShortDistanceEstimate: boolean } {
  if (!runs || runs.length === 0) {
    return { bestSeconds: undefined, basisRun: undefined, isShortDistanceEstimate: false };
  }

  const qualifyingRuns = runs.filter(
    (r) =>
      r.distanceKm >= 2.5 &&
      r.durationSeconds > 0 &&
      r.runType !== 'Intervals' &&
      r.runType !== 'Interval Training' &&
      r.runType !== 'Hill Repeats'
  );

  const pool = qualifyingRuns.length > 0 ? qualifyingRuns : runs;
  let bestSeconds: number | undefined;
  let basisRun: RunRecord | undefined;

  pool.forEach((run) => {
    const eq =
      run.distanceKm > 0 && run.durationSeconds > 0
        ? calculateTargetDistanceEquivalent(run.distanceKm, run.durationSeconds, targetDistanceKm)
        : run.targetEquivalentSeconds || run.best6kTimeSeconds || 0;

    if (eq > 0 && (bestSeconds === undefined || eq < bestSeconds)) {
      bestSeconds = eq;
      basisRun = run;
    }
  });

  const isShortDistanceEstimate = Boolean(basisRun && basisRun.distanceKm < 2.5 && targetDistanceKm >= 4.0);
  return { bestSeconds, basisRun, isShortDistanceEstimate };
}

export interface TargetCutoffResult {
  paceCutoffSeconds: number; // e.g. 23 seconds cut off
  totalTimeCutoffSeconds: number; // e.g. 138s total across the distance
  currentPaceSecPerKm: number; // e.g. 283 (4:43/km)
  targetPaceSecPerKm: number; // e.g. 260 (4:20/km)
  currentTotalSec: number;
  targetTotalSec: number;
  targetDistanceKm: number;
  isAchieved: boolean;
}

export function calculateTargetCutoff(
  targetSec?: number | null,
  currentSec?: number | null,
  targetDistanceKm: number = 6.0
): TargetCutoffResult | null {
  if (!targetSec || targetSec <= 0 || !currentSec || currentSec <= 0 || !targetDistanceKm || targetDistanceKm <= 0) {
    return null;
  }

  // If targetSec is under 600 (under 10 minutes), user entered pace (e.g. 260s = 4:20 /km)
  let targetPacePerKm: number;
  let targetTotalSec: number;

  if (targetSec < 600) {
    targetPacePerKm = targetSec;
    targetTotalSec = Math.round(targetSec * targetDistanceKm);
  } else {
    targetTotalSec = targetSec;
    targetPacePerKm = targetSec / targetDistanceKm;
  }

  const currentTotalSec = currentSec;
  const currentPacePerKm = currentSec / targetDistanceKm;

  // Pace difference in seconds (e.g. 283 - 260 = 23 seconds)
  const paceCutoffSeconds = Math.round(currentPacePerKm - targetPacePerKm);
  const totalTimeCutoffSeconds = Math.round(currentTotalSec - targetTotalSec);
  const isAchieved = paceCutoffSeconds <= 0;

  return {
    paceCutoffSeconds,
    totalTimeCutoffSeconds,
    currentPaceSecPerKm: currentPacePerKm,
    targetPaceSecPerKm: targetPacePerKm,
    currentTotalSec,
    targetTotalSec,
    targetDistanceKm,
    isAchieved,
  };
}

export function isAerobicRun(type: RunType): boolean {
  return type === 'Aerobic' || type === 'Easy' || type === 'Long Run';
}

export function isIntervalRun(type: RunType): boolean {
  return type === 'Interval Training' || type === 'Intervals' || type === 'Hill Repeats';
}

export function isHillRun(type: RunType, _title?: string): boolean {
  return type === 'Hill Repeats' || type === 'Hill Run';
}

export function is6kQualityRun(type: RunType): boolean {
  return type === '6K Time Trial' || type === 'Race' || type === 'Tempo' || type === 'Hill Repeats';
}

export function parseDateSafe(dateInput: string | Date): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? new Date() : dateInput;
  const trimmed = String(dateInput).trim();
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10) - 1;
    const d = parseInt(ymdMatch[3], 10);
    return new Date(y, m, d, 12, 0, 0);
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function formatLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getIsoWeekKey(dateInput: string | Date): { key: string; year: number; weekNumber: number; weekStartDate: Date } {
  const d = dateInput instanceof Date ? dateInput : parseDateSafe(dateInput);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return { key: 'unknown', year: now.getFullYear(), weekNumber: 1, weekStartDate: now };
  }

  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getFullYear();

  const monday = new Date(d);
  monday.setDate(d.getDate() - dayNr);
  monday.setHours(0, 0, 0, 0);

  return {
    key: `${year}-W${weekNumber.toString().padStart(2, '0')}`,
    year,
    weekNumber,
    weekStartDate: monday,
  };
}

export function getCurrentWeekRange(referenceDate: Date = new Date()): {
  monday: Date;
  sunday: Date;
  isoWeekKey: string;
  formattedRange: string;
  formattedMonday: string;
  formattedSunday: string;
} {
  const now = referenceDate;
  const dayNr = (now.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayNr);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const formattedMonday = `${monthNames[monday.getMonth()]} ${monday.getDate()}`;
  const formattedSunday = `${monthNames[sunday.getMonth()]} ${sunday.getDate()}`;
  const formattedRange = `Mon ${formattedMonday} – Sun ${formattedSunday}`;

  const { key: isoWeekKey } = getIsoWeekKey(now);

  return { monday, sunday, isoWeekKey, formattedRange, formattedMonday, formattedSunday };
}

export function isRunInCurrentWeek(runDate: string, referenceDate: Date = new Date()): boolean {
  const currentKey = getIsoWeekKey(referenceDate).key;
  const runKey = getIsoWeekKey(runDate).key;
  return currentKey === runKey;
}

export function groupRunsByWeek(
  runs: RunRecord[],
  weeklyGoal: number = 3
): { weeklyStats: WeeklyStat[]; adherence: AdherenceSummary } {
  const map: Record<string, { weekStartDate: Date; runs: RunRecord[] }> = {};
  const sortedRuns = [...runs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  sortedRuns.forEach((run) => {
    const { key, weekStartDate } = getIsoWeekKey(run.date);
    if (!map[key]) {
      map[key] = { weekStartDate, runs: [] };
    }
    map[key].runs.push(run);
  });

  const weekKeys = Object.keys(map).sort().reverse();
  const weeklyStats: WeeklyStat[] = weekKeys.map((key) => {
    const item = map[key];
    const totalDist = item.runs.reduce((sum, r) => sum + r.distanceKm, 0);
    const totalDur = item.runs.reduce((sum, r) => sum + r.durationSeconds, 0);

    const sixKRuns = item.runs
      .map((r) => r.best6kTimeSeconds || calculate6kEquivalent(r.distanceKm, r.durationSeconds))
      .filter((t): t is number => typeof t === 'number' && t > 0);

    const best6k = sixKRuns.length > 0 ? Math.min(...sixKRuns) : undefined;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekStartLabel = `${monthNames[item.weekStartDate.getMonth()]} ${item.weekStartDate.getDate()}`;

    return {
      weekKey: key,
      weekStart: weekStartLabel,
      runsCount: item.runs.length,
      goalMet: item.runs.length >= weeklyGoal,
      totalDistanceKm: Number(totalDist.toFixed(2)),
      totalDurationSeconds: totalDur,
      best6kInWeek: best6k,
      runs: item.runs,
    };
  });

  const currentWeekInfo = getIsoWeekKey(new Date());
  const currentWeekStat = weeklyStats.find((w) => w.weekKey === currentWeekInfo.key);
  const currentWeekRuns = currentWeekStat ? currentWeekStat.runsCount : 0;
  const currentWeekGoalMet = currentWeekRuns >= weeklyGoal;

  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  const chronological = [...weeklyStats].reverse();
  chronological.forEach((stat) => {
    if (stat.goalMet) {
      tempStreak += 1;
      if (tempStreak > bestStreak) {
        bestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  });

  for (let i = 0; i < weeklyStats.length; i++) {
    const s = weeklyStats[i];
    if (s.weekKey === currentWeekInfo.key) {
      if (s.goalMet) currentStreak += 1;
    } else {
      if (s.goalMet) {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  const metCount = weeklyStats.filter((w) => w.goalMet).length;
  const adherencePct = weeklyStats.length > 0 ? Math.round((metCount / weeklyStats.length) * 100) : 0;

  const adherence: AdherenceSummary = {
    weeklyGoal,
    currentWeekRuns,
    currentWeekGoalMet,
    currentStreakWeeks: currentStreak,
    bestStreakWeeks: Math.max(bestStreak, currentStreak),
    totalWeeksTracked: weeklyStats.length,
    metGoalWeeksCount: metCount,
    adherencePercentage: adherencePct,
  };

  return { weeklyStats, adherence };
}

export function inferRunType(title: string, distanceKm: number): RunType {
  const lower = (title || '').toLowerCase();
  if (lower.includes('race') || lower.includes('xc race') || lower.includes('championship') || lower.includes('invitational')) {
    return 'Race';
  }
  if (lower.includes('trial') || lower.includes('time trial')) {
    return '6K Time Trial';
  }
  if (lower.includes('interval') || lower.includes('track') || lower.includes('repeat') || lower.includes('400') || lower.includes('1000') || lower.includes('1200')) {
    return 'Interval Training';
  }
  if (lower.includes('tempo') || lower.includes('threshold') || lower.includes('lactate')) {
    return 'Tempo';
  }
  if (distanceKm >= 9.0 || lower.includes('long run') || lower.includes('sunday')) {
    return 'Long Run';
  }
  if (Math.abs(distanceKm - 6.0) <= 0.2 && (lower.includes('6k') || lower.includes('test'))) {
    return '6K Time Trial';
  }
  return 'Aerobic';
}

/**
 * Detect duplicate runs between uploaded and existing training runs
 */
export function findDuplicateRuns(
  incomingRuns: RunRecord[],
  existingRuns: RunRecord[]
): { uniqueRuns: RunRecord[]; duplicateMatches: DuplicateRunMatch[] } {
  const duplicateMatches: DuplicateRunMatch[] = [];
  const uniqueRuns: RunRecord[] = [];

  incomingRuns.forEach((incoming) => {
    const match = existingRuns.find((existing) => {
      // 1. Check exact ID match (e.g. re-importing same Apple Health export.xml workout)
      if (incoming.id && existing.id && incoming.id === existing.id) {
        return true;
      }
      // 2. Check Garmin/Tracker Activity ID if both have one
      if (
        incoming.garminActivityId &&
        existing.garminActivityId &&
        incoming.garminActivityId === existing.garminActivityId
      ) {
        return true;
      }
      // 3. Check identical date + distance (within 0.05 km) + duration (within 10 seconds)
      const sameDate = incoming.date === existing.date;
      const sameDist = Math.abs(incoming.distanceKm - existing.distanceKm) <= 0.05;
      const sameDur = Math.abs(incoming.durationSeconds - existing.durationSeconds) <= 10;
      return sameDate && sameDist && sameDur;
    });

    if (match) {
      duplicateMatches.push({ incoming, existing: match });
    } else {
      uniqueRuns.push(incoming);
    }
  });

  return { uniqueRuns, duplicateMatches };
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractXmlAttr(tagText: string, attrName: string): string | undefined {
  const regex = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = tagText.match(regex);
  if (!match) return undefined;
  return decodeXmlEntities((match[1] ?? match[2] ?? '').trim());
}

function parseAppleDateToYmd(rawDate?: string): string {
  if (!rawDate) return formatLocalDateString(new Date());
  const ymdMatch = rawDate.match(/(\d{4}-\d{2}-\d{2})/);
  if (ymdMatch) return ymdMatch[1];
  const parsed = new Date(rawDate);
  if (!isNaN(parsed.getTime())) {
    return formatLocalDateString(parsed);
  }
  return formatLocalDateString(new Date());
}

function parseAppleTimestampMs(rawDate?: string): number | null {
  if (!rawDate) return null;
  // Convert "2026-11-10 07:04:00 -0800" -> "2026-11-10T07:04:00-08:00"
  const normalized = rawDate
    .trim()
    .replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s*([+-]\d{2})(\d{2})$/, '$1T$2$3:$4');
  const t = new Date(normalized).getTime();
  return isNaN(t) ? null : t;
}

function parseElevationStringToMeters(rawValue?: string): number | undefined {
  if (!rawValue) return undefined;
  const num = parseFloat(rawValue.replace(/[^0-9.-]/g, ''));
  if (isNaN(num) || num <= 0) return undefined;
  const lower = rawValue.toLowerCase();
  if (lower.includes('cm')) return Math.round(num / 100);
  if (lower.includes('ft') || lower.includes('feet')) return Math.round(num * 0.3048);
  return Math.round(num);
}

export function parseGarminCsv(csvText: string, userId: string): RunRecord[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerRaw = lines[0].split(',').map((h) => h.replace(/["']/g, '').trim());
  const header = headerRaw.map((h) => h.toLowerCase());

  const isAppleCsv =
    header.some(
      (h) =>
        h.includes('workout type') ||
        h.includes('active energy') ||
        h.includes('apple') ||
        h.includes('healthfit') ||
        h.includes('elevation ascended')
    ) ||
    csvText.includes('HKWorkoutActivityType') ||
    csvText.includes('Apple Watch');

  const typeIdx = header.findIndex((h) => h.includes('activity type') || h.includes('workout type') || h === 'type');
  const dateIdx = header.findIndex((h) => h.includes('date') || h === 'start' || h.includes('start time'));
  const titleIdx = header.findIndex((h) => h.includes('title') || h.includes('activity name') || h.includes('workout name'));
  const distIdx = header.findIndex((h) => h.includes('distance'));
  const timeIdx = header.findIndex((h) => h.includes('elapsed time') || h.includes('duration') || h.includes('time'));
  const hrIdx = header.findIndex((h) => h.includes('avg hr') || h.includes('average heart rate') || h.includes('heart rate (avg') || h === 'hr');
  const maxHrIdx = header.findIndex((h) => h.includes('max hr') || h.includes('maximum heart rate') || h.includes('heart rate (max'));
  const cadIdx = header.findIndex((h) => h.includes('cadence') || h.includes('run cadence'));
  const elevIdx = header.findIndex((h) => h.includes('elevation') || h.includes('elev gain') || h.includes('ascended'));
  const idIdx = header.findIndex((h) => h.includes('activity id') || h.includes('activity_id') || h.includes('uuid'));
  const distHeader = distIdx >= 0 ? header[distIdx] : '';
  const timeHeader = timeIdx >= 0 ? header[timeIdx] : '';

  const records: RunRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim()) continue;

    const tokens: string[] = [];
    let insideQuotes = false;
    let currentToken = '';

    for (let c = 0; c < rawLine.length; c++) {
      const char = rawLine[c];
      if (char === '"' || char === "'") {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        tokens.push(currentToken.trim());
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
    tokens.push(currentToken.trim());

    // Skip non-running activities if a workout/activity type column is present
    if (typeIdx >= 0 && tokens[typeIdx]) {
      const actType = tokens[typeIdx].toLowerCase();
      if (
        actType &&
        !actType.includes('run') &&
        !actType.includes('jog') &&
        !actType.includes('track') &&
        !actType.includes('treadmill')
      ) {
        continue;
      }
    }

    const fallbackPrefix = isAppleCsv ? 'Apple Watch Run' : 'Garmin Run';
    const rawTypeLabel = typeIdx >= 0 && tokens[typeIdx] ? tokens[typeIdx].replace(/^HKWorkoutActivityType/, '') : '';
    const title =
      titleIdx >= 0 && tokens[titleIdx]
        ? tokens[titleIdx]
        : rawTypeLabel
        ? `${isAppleCsv ? 'Apple Watch ' : ''}${rawTypeLabel}`
        : `${fallbackPrefix} ${i}`;
    const rawDate = dateIdx >= 0 && tokens[dateIdx] ? tokens[dateIdx] : new Date().toISOString();
    const actId = idIdx >= 0 && tokens[idIdx] ? tokens[idIdx] : undefined;

    let distKm = 0;
    if (distIdx >= 0 && tokens[distIdx]) {
      const rawCell = tokens[distIdx].toLowerCase();
      const val = parseFloat(rawCell.replace(/[^0-9.]/g, ''));
      if (!isNaN(val)) {
        if (rawCell.includes('mi') || distHeader.includes('(mi') || distHeader.includes('mile')) {
          distKm = val * MILES_TO_KM;
        } else if (distHeader.includes('(m)') || distHeader.includes('meter')) {
          distKm = val / 1000;
        } else {
          distKm = val;
        }
      }
    }

    let durationSec = 0;
    if (timeIdx >= 0 && tokens[timeIdx]) {
      const rawTime = tokens[timeIdx].trim();
      if (rawTime.includes(':')) {
        durationSec = parseDuration(rawTime);
      } else {
        const numericVal = parseFloat(rawTime.replace(/[^0-9.]/g, ''));
        if (!isNaN(numericVal) && numericVal > 0) {
          if (timeHeader.includes('min') || rawTime.toLowerCase().includes('min')) {
            durationSec = Math.round(numericVal * 60);
          } else if (timeHeader.includes('hr') || timeHeader.includes('hour')) {
            durationSec = Math.round(numericVal * 3600);
          } else {
            durationSec = Math.round(numericVal);
          }
        }
      }
    }

    if (distKm <= 0 || durationSec <= 0) continue;

    const avgPace = calculatePaceSecPerKm(distKm, durationSec);
    const best6k = calculate6kEquivalent(distKm, durationSec);
    const runType = inferRunType(title, distKm);

    const avgHr = hrIdx >= 0 && tokens[hrIdx] ? parseInt(tokens[hrIdx].replace(/\D/g, ''), 10) : undefined;
    const maxHr = maxHrIdx >= 0 && tokens[maxHrIdx] ? parseInt(tokens[maxHrIdx].replace(/\D/g, ''), 10) : undefined;
    const cadence = cadIdx >= 0 && tokens[cadIdx] ? parseInt(tokens[cadIdx].replace(/\D/g, ''), 10) : undefined;
    const elevation = elevIdx >= 0 && tokens[elevIdx] ? parseFloat(tokens[elevIdx].replace(/[^0-9.]/g, '')) : undefined;

    const source: RunRecord['source'] = isAppleCsv ? 'apple_watch_csv' : 'garmin_csv';
    const idPrefix = isAppleCsv ? 'apple_csv' : 'garmin_csv';

    records.push({
      id: actId ? `${isAppleCsv ? 'apple' : 'garmin'}_${actId.replace(/[^a-zA-Z0-9_\-\.:]/g, '_')}` : `${idPrefix}_${Date.now()}_${i}`,
      userId,
      date: parseAppleDateToYmd(rawDate),
      title,
      distanceKm: Number(distKm.toFixed(2)),
      durationSeconds: Math.round(durationSec),
      averagePaceSecPerKm: Math.round(avgPace),
      best6kTimeSeconds: best6k,
      runType,
      avgHeartRate: avgHr && avgHr > 50 && avgHr < 240 ? avgHr : undefined,
      maxHeartRate: maxHr && maxHr > 60 && maxHr < 250 ? maxHr : undefined,
      avgCadence: cadence && cadence > 100 && cadence < 250 ? cadence : undefined,
      elevationGainMeters: elevation && elevation >= 0 ? Math.round(elevation) : undefined,
      source,
      garminActivityId: actId,
      createdAt: new Date().toISOString(),
    });
  }

  return records;
}

export const parseWatchCsv = parseGarminCsv;

export function parseAppleHealthXml(xmlText: string, userId: string): RunRecord[] {
  if (!xmlText || !xmlText.includes('<Workout')) return [];

  const records: RunRecord[] = [];
  const workoutRegex = /<Workout\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Workout>)/g;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = workoutRegex.exec(xmlText)) !== null) {
    const attrs = match[1] || '';
    const innerBody = match[2] || '';

    const activityType = extractXmlAttr(attrs, 'workoutActivityType') || '';
    const isRunning =
      activityType === 'HKWorkoutActivityTypeRunning' ||
      /\brunning\b/i.test(activityType);

    if (!isRunning) continue;

    const sourceName = extractXmlAttr(attrs, 'sourceName') || 'Apple Watch';
    const startDateRaw = extractXmlAttr(attrs, 'startDate') || extractXmlAttr(attrs, 'creationDate');
    const endDateRaw = extractXmlAttr(attrs, 'endDate');
    const runDate = parseAppleDateToYmd(startDateRaw);

    // Duration parsing
    let durationSec = 0;
    const rawDuration = extractXmlAttr(attrs, 'duration');
    const durationUnit = (extractXmlAttr(attrs, 'durationUnit') || 'min').toLowerCase();
    if (rawDuration) {
      const val = parseFloat(rawDuration);
      if (!isNaN(val) && val > 0) {
        if (durationUnit.startsWith('s')) durationSec = Math.round(val);
        else if (durationUnit.startsWith('h')) durationSec = Math.round(val * 3600);
        else durationSec = Math.round(val * 60);
      }
    }
    if (durationSec <= 0 && startDateRaw && endDateRaw) {
      const startMs = parseAppleTimestampMs(startDateRaw);
      const endMs = parseAppleTimestampMs(endDateRaw);
      if (startMs && endMs && endMs > startMs) {
        durationSec = Math.round((endMs - startMs) / 1000);
      }
    }

    // Distance parsing (attribute first, then WorkoutStatistics fallback)
    let distKm = 0;
    const rawDist = extractXmlAttr(attrs, 'totalDistance');
    const distUnit = (extractXmlAttr(attrs, 'totalDistanceUnit') || 'km').toLowerCase();
    if (rawDist) {
      const val = parseFloat(rawDist);
      if (!isNaN(val) && val > 0) {
        if (distUnit === 'mi' || distUnit.includes('mile')) distKm = val * MILES_TO_KM;
        else if (distUnit === 'm') distKm = val / 1000;
        else distKm = val;
      }
    }

    // Parse inner <WorkoutStatistics> and <MetadataEntry>
    let avgHeartRate: number | undefined;
    let maxHeartRate: number | undefined;
    let avgCadence: number | undefined;
    let elevationGainMeters: number | undefined;
    let isIndoor = false;

    if (innerBody) {
      const statsRegex = /<WorkoutStatistics\b([^>]*?)\/?>/g;
      let statMatch: RegExpExecArray | null;
      while ((statMatch = statsRegex.exec(innerBody)) !== null) {
        const sAttrs = statMatch[1] || '';
        const statType = extractXmlAttr(sAttrs, 'type') || '';

        if (statType === 'HKQuantityTypeIdentifierDistanceWalkingRunning' && distKm <= 0) {
          const sumVal = parseFloat(extractXmlAttr(sAttrs, 'sum') || '0');
          const sUnit = (extractXmlAttr(sAttrs, 'unit') || 'km').toLowerCase();
          if (!isNaN(sumVal) && sumVal > 0) {
            if (sUnit === 'mi') distKm = sumVal * MILES_TO_KM;
            else if (sUnit === 'm') distKm = sumVal / 1000;
            else distKm = sumVal;
          }
        } else if (statType === 'HKQuantityTypeIdentifierHeartRate') {
          const avg = parseFloat(extractXmlAttr(sAttrs, 'average') || '0');
          const max = parseFloat(extractXmlAttr(sAttrs, 'maximum') || '0');
          if (!isNaN(avg) && avg > 40 && avg < 240) avgHeartRate = Math.round(avg);
          if (!isNaN(max) && max > 50 && max < 250) maxHeartRate = Math.round(max);
        } else if (statType === 'HKQuantityTypeIdentifierStepCount' && durationSec > 0) {
          const steps = parseFloat(extractXmlAttr(sAttrs, 'sum') || '0');
          if (!isNaN(steps) && steps > 0) {
            const spm = Math.round((steps / durationSec) * 60);
            if (spm >= 120 && spm <= 240) avgCadence = spm;
          }
        }
      }

      const metaRegex = /<MetadataEntry\b([^>]*?)\/?>/g;
      let metaMatch: RegExpExecArray | null;
      while ((metaMatch = metaRegex.exec(innerBody)) !== null) {
        const mAttrs = metaMatch[1] || '';
        const key = extractXmlAttr(mAttrs, 'key') || '';
        const val = extractXmlAttr(mAttrs, 'value') || '';
        if (key === 'HKElevationAscended') {
          elevationGainMeters = parseElevationStringToMeters(val);
        } else if (key === 'HKIndoorWorkout' && (val === '1' || val.toLowerCase() === 'true')) {
          isIndoor = true;
        }
      }
    }

    if (distKm <= 0 || durationSec <= 0) continue;

    const avgPace = calculatePaceSecPerKm(distKm, durationSec);
    const best6k = calculate6kEquivalent(distKm, durationSec);

    const roundedDistLabel = distKm >= 5.8 && distKm <= 6.2 ? '6K' : `${distKm.toFixed(1)}K`;
    const title = isIndoor
      ? `Apple Watch Indoor Run (${roundedDistLabel})`
      : `Apple Watch Run (${roundedDistLabel})`;
    const runType = inferRunType(title, distKm);

    const startKey = (startDateRaw || `${runDate}_${idx}`)
      .replace(/[^a-zA-Z0-9_\-\.:]/g, '_')
      .slice(0, 60);

    records.push({
      id: `apple_xml_${startKey}_${idx}`,
      userId,
      date: runDate,
      title,
      distanceKm: Number(distKm.toFixed(2)),
      durationSeconds: durationSec,
      averagePaceSecPerKm: Math.round(avgPace),
      best6kTimeSeconds: best6k,
      runType,
      avgHeartRate,
      maxHeartRate,
      avgCadence,
      elevationGainMeters,
      source: 'apple_health_xml',
      notes: sourceName && sourceName !== 'Apple Watch' ? `Synced from ${sourceName}` : undefined,
      createdAt: new Date().toISOString(),
    });

    idx++;
  }

  return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function parseAppleWatchJson(jsonText: string, userId: string): RunRecord[] {
  try {
    const raw = JSON.parse(jsonText);
    // Support Health Auto Export `{ data: { workouts: [...] } }`, Shortcuts `{ workouts: [...] }`, or array `[...]`
    const candidateItems: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data?.workouts)
      ? raw.data.workouts
      : Array.isArray(raw?.workouts)
      ? raw.workouts
      : [raw];

    const isExplicitApplePayload = Boolean(
      raw?.data?.workouts ||
        raw?.workouts ||
        candidateItems.some(
          (item) =>
            item &&
            (typeof item.name === 'string' ||
              item.source === 'apple_watch' ||
              String(item.workoutActivityType || '').includes('HKWorkout') ||
              String(item.sourceName || '').toLowerCase().includes('apple'))
        )
    );

    const parsed: RunRecord[] = [];

    candidateItems.forEach((item: any, idx: number) => {
      if (!item || typeof item !== 'object') return;

      const activityName = String(item.name || item.workoutActivityType || item.activityType || item.type || '');
      if (
        activityName &&
        !isExplicitApplePayload &&
        !item.distanceKm &&
        !item.distance &&
        !item.totalDistance
      ) {
        return;
      }

      if (
        activityName &&
        !/run|jog|track|treadmill|trail|race|tempo|interval/i.test(activityName) &&
        (item.name || item.workoutActivityType)
      ) {
        // Non-running workout in multi-sport Apple Health export
        return;
      }

      // Distance resolution (supports number, or Health Auto Export `{ qty, units }`)
      let distKm = 0;
      const distObj = item.distance && typeof item.distance === 'object' ? item.distance : item.totalDistance;
      if (distObj && typeof distObj === 'object' && typeof distObj.qty === 'number') {
        const u = String(distObj.units || distObj.unit || 'km').toLowerCase();
        distKm = u === 'mi' || u.includes('mile') ? distObj.qty * MILES_TO_KM : u === 'm' ? distObj.qty / 1000 : distObj.qty;
      } else if (typeof item.distanceKm === 'number') {
        distKm = item.distanceKm;
      } else if (typeof item.distance === 'number') {
        const u = String(item.distanceUnit || item.totalDistanceUnit || '').toLowerCase();
        if (u === 'mi' || u.includes('mile')) distKm = item.distance * MILES_TO_KM;
        else if (u === 'km') distKm = item.distance;
        else if (u === 'm' || item.distance > 150) distKm = item.distance / 1000;
        else distKm = item.distance;
      } else if (typeof item.totalDistance === 'number') {
        const u = String(item.totalDistanceUnit || 'km').toLowerCase();
        distKm = u === 'mi' ? item.totalDistance * MILES_TO_KM : u === 'm' ? item.totalDistance / 1000 : item.totalDistance;
      }

      // Duration resolution
      let durationSeconds = 0;
      if (typeof item.durationSeconds === 'number') {
        durationSeconds = item.durationSeconds;
      } else if (typeof item.duration === 'number') {
        const dUnit = String(item.durationUnit || '').toLowerCase();
        if (dUnit.startsWith('min')) durationSeconds = Math.round(item.duration * 60);
        else durationSeconds = Math.round(item.duration);
      } else if (item.start && item.end) {
        const s = new Date(item.start).getTime();
        const e = new Date(item.end).getTime();
        if (!isNaN(s) && !isNaN(e) && e > s) durationSeconds = Math.round((e - s) / 1000);
      }

      if (distKm <= 0 || durationSeconds <= 0) return;

      const avgPace = item.averagePaceSecPerKm
        ? Number(item.averagePaceSecPerKm)
        : calculatePaceSecPerKm(distKm, durationSeconds);
      const best6k = calculate6kEquivalent(distKm, durationSeconds);

      const rawDate = item.date || item.start || item.startDate || item.createdAt;
      const runDate = parseAppleDateToYmd(typeof rawDate === 'string' ? rawDate : undefined);

      // Heart rate extraction (Health Auto Export `heartRate` or arrays or direct fields)
      let avgHr = Number(item.avgHeartRate || item.averageHeartRate || item.heartRate?.avg?.qty || item.heartRate?.avg || 0) || undefined;
      let maxHr = Number(item.maxHeartRate || item.maximumHeartRate || item.heartRate?.max?.qty || item.heartRate?.max || 0) || undefined;

      if (!avgHr && Array.isArray(item.heartRateData) && item.heartRateData.length > 0) {
        const hrVals = item.heartRateData
          .map((h: any) => Number(h.Avg ?? h.qty ?? h.value ?? 0))
          .filter((v: number) => v > 40 && v < 240);
        if (hrVals.length > 0) {
          avgHr = Math.round(hrVals.reduce((a: number, b: number) => a + b, 0) / hrVals.length);
          maxHr = maxHr || Math.round(Math.max(...hrVals));
        }
      }

      // Elevation extraction
      let elevMeters: number | undefined;
      if (item.elevationUp?.qty !== undefined) {
        const u = String(item.elevationUp.units || 'm').toLowerCase();
        elevMeters = Math.round(u === 'cm' ? item.elevationUp.qty / 100 : item.elevationUp.qty);
      } else if (item.elevationGainMeters !== undefined || item.elevationGain !== undefined) {
        elevMeters = Math.round(Number(item.elevationGainMeters ?? item.elevationGain));
      }

      const cadence = Number(item.avgCadence || item.cadence || 0) || undefined;
      const isApple =
        isExplicitApplePayload ||
        item.source === 'apple_watch' ||
        String(item.sourceName || '').toLowerCase().includes('apple');

      const title =
        item.title ||
        (activityName && !activityName.startsWith('HKWorkout') ? activityName : null) ||
        (isApple ? `Apple Watch Run (${distKm.toFixed(1)}K)` : 'Garmin Run');

      parsed.push({
        id: item.id
          ? String(item.id).replace(/[^a-zA-Z0-9_\-\.:]/g, '_')
          : `${isApple ? 'apple_json' : 'garmin_json'}_${Date.now()}_${idx}`,
        userId,
        date: runDate,
        title,
        distanceKm: Number(distKm.toFixed(2)),
        durationSeconds: Math.round(durationSeconds),
        averagePaceSecPerKm: Math.round(avgPace),
        best6kTimeSeconds: best6k,
        runType: item.runType || inferRunType(title, distKm),
        avgHeartRate: avgHr && avgHr > 40 ? Math.round(avgHr) : undefined,
        maxHeartRate: maxHr && maxHr > 50 ? Math.round(maxHr) : undefined,
        avgCadence: cadence && cadence > 100 ? Math.round(cadence) : undefined,
        elevationGainMeters: elevMeters && elevMeters > 0 ? elevMeters : undefined,
        source: isApple ? 'apple_watch' : 'garmin',
        garminActivityId: item.garminActivityId || item.activityId,
        createdAt: new Date().toISOString(),
      });
    });

    return parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export function parseTcx(tcxText: string, userId: string, fileName?: string): RunRecord | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(tcxText, 'application/xml');

    const activity = doc.querySelector('Activity');
    if (!activity) return null;

    const creatorText = activity.querySelector('Creator Name')?.textContent || '';
    const isAppleWatch =
      /apple|healthfit|workoutdoors|watchletic|health/i.test(creatorText) ||
      /apple|healthfit|workoutdoors/i.test(fileName || '');

    const idElem = activity.querySelector('Id');
    const dateStr = idElem ? idElem.textContent || '' : new Date().toISOString();
    const actId = idElem ? idElem.textContent?.trim() : undefined;

    const laps = Array.from(activity.querySelectorAll('Lap'));
    let totalSeconds = 0;
    let totalMeters = 0;
    let hrSum = 0;
    let hrCount = 0;
    let maxHr = 0;
    let cadSum = 0;
    let cadCount = 0;

    laps.forEach((lap) => {
      const totalTimeElem = lap.querySelector('TotalTimeSeconds');
      if (totalTimeElem) totalSeconds += parseFloat(totalTimeElem.textContent || '0');

      const distMetersElem = lap.querySelector('DistanceMeters');
      if (distMetersElem) totalMeters += parseFloat(distMetersElem.textContent || '0');

      const avgHrElem = lap.querySelector('AverageHeartRateBpm Value');
      if (avgHrElem) {
        const val = parseInt(avgHrElem.textContent || '0', 10);
        if (val > 0) {
          hrSum += val;
          hrCount += 1;
        }
      }

      const maxHrElem = lap.querySelector('MaximumHeartRateBpm Value');
      if (maxHrElem) {
        const val = parseInt(maxHrElem.textContent || '0', 10);
        if (val > maxHr) maxHr = val;
      }

      const cadenceElem = lap.querySelector('Cadence');
      if (cadenceElem) {
        const val = parseInt(cadenceElem.textContent || '0', 10);
        if (val > 0) {
          const spm = val < 110 ? val * 2 : val;
          cadSum += spm;
          cadCount += 1;
        }
      }
    });

    const distKm = totalMeters / 1000;
    if (distKm <= 0 || totalSeconds <= 0) return null;

    const avgPace = calculatePaceSecPerKm(distKm, totalSeconds);
    const best6k = calculate6kEquivalent(distKm, totalSeconds);
    const defaultTitle = fileName
      ? fileName.replace(/\.[^/.]+$/, '')
      : isAppleWatch
      ? 'Apple Watch XC Run'
      : 'Garmin XC Run';
    const runType = inferRunType(defaultTitle, distKm);

    const cleanActId = actId ? actId.replace(/[^a-zA-Z0-9_\-\.:]/g, '_') : null;
    const prefix = isAppleWatch ? 'apple_tcx' : 'garmin_tcx';

    return {
      id: cleanActId ? `${prefix}_${cleanActId}` : `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      date: parseAppleDateToYmd(dateStr),
      title: defaultTitle,
      distanceKm: Number(distKm.toFixed(2)),
      durationSeconds: Math.round(totalSeconds),
      averagePaceSecPerKm: Math.round(avgPace),
      best6kTimeSeconds: best6k,
      runType,
      avgHeartRate: hrCount > 0 ? Math.round(hrSum / hrCount) : undefined,
      maxHeartRate: maxHr > 0 ? maxHr : undefined,
      avgCadence: cadCount > 0 ? Math.round(cadSum / cadCount) : undefined,
      source: isAppleWatch ? 'apple_watch_tcx' : 'garmin_tcx',
      garminActivityId: actId,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function parseGpx(gpxText: string, userId: string, fileName?: string): RunRecord | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxText, 'application/xml');

    const trkpts = Array.from(doc.querySelectorAll('trkpt'));
    if (trkpts.length < 2) return null;

    const creatorAttr = doc.documentElement?.getAttribute('creator') || '';
    const isAppleWatch =
      /apple|healthfit|workoutdoors|watchletic|health/i.test(creatorAttr) ||
      /route_|apple|healthfit|workoutdoors/i.test(fileName || '');

    const nameElem = doc.querySelector('metadata > name') || doc.querySelector('trk > name');
    const title =
      nameElem && nameElem.textContent
        ? nameElem.textContent
        : fileName
        ? fileName.replace(/\.[^/.]+$/, '')
        : isAppleWatch
        ? 'Apple Watch GPX Run'
        : 'Garmin GPX Run';

    let totalDistMeters = 0;
    let startTime: number | null = null;
    let endTime: number | null = null;
    let elevGain = 0;
    let lastElev: number | null = null;

    const toRad = (x: number) => (x * Math.PI) / 180;
    let prevLat: number | null = null;
    let prevLon: number | null = null;

    trkpts.forEach((pt) => {
      const lat = parseFloat(pt.getAttribute('lat') || '');
      const lon = parseFloat(pt.getAttribute('lon') || '');
      const timeElem = pt.querySelector('time');
      const eleElem = pt.querySelector('ele');

      if (!isNaN(lat) && !isNaN(lon)) {
        if (prevLat !== null && prevLon !== null) {
          const R = 6371e3;
          const phi1 = toRad(prevLat);
          const phi2 = toRad(lat);
          const deltaPhi = toRad(lat - prevLat);
          const deltaLambda = toRad(lon - prevLon);

          const a =
            Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          totalDistMeters += R * c;
        }
        prevLat = lat;
        prevLon = lon;
      }

      if (timeElem && timeElem.textContent) {
        const t = new Date(timeElem.textContent).getTime();
        if (!isNaN(t)) {
          if (startTime === null || t < startTime) startTime = t;
          if (endTime === null || t > endTime) endTime = t;
        }
      }

      if (eleElem && eleElem.textContent) {
        const ele = parseFloat(eleElem.textContent);
        if (!isNaN(ele)) {
          if (lastElev !== null && ele > lastElev) {
            elevGain += ele - lastElev;
          }
          lastElev = ele;
        }
      }
    });

    const durationSec = startTime && endTime ? Math.max(1, Math.round((endTime - startTime) / 1000)) : 0;
    const distKm = totalDistMeters / 1000;

    if (distKm <= 0 || durationSec <= 0) return null;

    const avgPace = calculatePaceSecPerKm(distKm, durationSec);
    const best6k = calculate6kEquivalent(distKm, durationSec);
    const runDate = startTime ? formatLocalDateString(new Date(startTime)) : formatLocalDateString(new Date());

    return {
      id: `${isAppleWatch ? 'apple_gpx' : 'garmin_gpx'}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      date: runDate,
      title,
      distanceKm: Number(distKm.toFixed(2)),
      durationSeconds: durationSec,
      averagePaceSecPerKm: Math.round(avgPace),
      best6kTimeSeconds: best6k,
      runType: inferRunType(title, distKm),
      elevationGainMeters: elevGain > 0 ? Math.round(elevGain) : undefined,
      source: isAppleWatch ? 'apple_watch_gpx' : 'garmin_gpx',
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function generateAiExportText(
  profile: UserProfile,
  runs: RunRecord[],
  adherence: AdherenceSummary
): string {
  const sortedRuns = [...runs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const sixKRuns = runs
    .map((r) => ({
      ...r,
      calc6k: r.best6kTimeSeconds || calculate6kEquivalent(r.distanceKm, r.durationSeconds),
    }))
    .filter((r) => r.calc6k > 0)
    .sort((a, b) => a.calc6k - b.calc6k);

  const best6k = sixKRuns[0];
  const target6kFormatted = profile.target6kTimeSeconds ? formatDuration(profile.target6kTimeSeconds) : 'Not specified';
  const target6kPace = profile.target6kTimeSeconds ? formatPace(profile.target6kTimeSeconds / 6.0, profile.unitPreference) : 'N/A';
  const currentBestFormatted = best6k ? formatDuration(best6k.calc6k) : 'No 6k recorded yet';
  const currentBestPace = best6k ? formatPace(best6k.calc6k / 6.0, profile.unitPreference) : '--';

  const timeDiffSec = best6k && profile.target6kTimeSeconds ? best6k.calc6k - profile.target6kTimeSeconds : null;
  let gapSummary = '';
  if (timeDiffSec !== null) {
    if (timeDiffSec <= 0) {
      gapSummary = `Goal already met by ${Math.abs(timeDiffSec)} seconds!`;
    } else {
      gapSummary = `${timeDiffSec} seconds (${formatDuration(timeDiffSec)}) to shave off to reach goal.`;
    }
  } else if (!profile.target6kTimeSeconds) {
    gapSummary = 'No specific 6K time target set yet.';
  }

  const typeCounts: Record<string, number> = {};
  runs.forEach((r) => {
    typeCounts[r.runType] = (typeCounts[r.runType] || 0) + 1;
  });

  const runRows = sortedRuns.slice(0, 30).map((r, i) => {
    const paceStr = formatPace(r.averagePaceSecPerKm, profile.unitPreference);
    const durationStr = formatDuration(r.durationSeconds);
    const eq6kStr = r.best6kTimeSeconds ? formatDuration(r.best6kTimeSeconds) : '--';
    const hrStr = r.avgHeartRate ? `${r.avgHeartRate} bpm` : 'N/A';
    const cadStr = r.avgCadence ? `${r.avgCadence} spm` : 'N/A';
    return `| ${i + 1} | ${r.date} | ${r.title} | ${r.runType} | ${r.distanceKm} km | ${durationStr} | ${paceStr} | ${eq6kStr} | ${hrStr} | ${cadStr} |`;
  }).join('\n');

  return `# Cross Country 6K Training & Progress Dossier

## 1. Athlete Objective & Profile
- **Primary Goal**: Improve Cross Country 6K Race Time to **${target6kFormatted}** (Target Pace: ${target6kPace})
- **Current 6K Best**: **${currentBestFormatted}** (Pace: ${currentBestPace})
- **Goal Gap**: ${gapSummary || 'In progress'}
- **Weekly Schedule Target**: **3 Runs Per Week**
- **Units**: ${profile.unitPreference}

## 2. Weekly Consistency & 3-Run Goal Adherence
- **Target Adherence**: ${adherence.adherencePercentage}% (${adherence.metGoalWeeksCount} out of ${adherence.totalWeeksTracked} recorded weeks met the 3-run goal)
- **Current 3-Run Week Streak**: **${adherence.currentStreakWeeks} consecutive weeks**
- **Longest 3-Run Streak**: **${adherence.bestStreakWeeks} consecutive weeks**
- **Current Week Count**: ${adherence.currentWeekRuns} / ${profile.weeklyRunGoal} runs completed
- **Workout Type Distribution**:
${Object.entries(typeCounts).map(([type, count]) => `  - ${type}: ${count} runs (${Math.round((count / (runs.length || 1)) * 100)}%)`).join('\n')}

## 3. Training Log (Garmin Activities & Time Trials)
| # | Date | Title | Type | Distance | Time | Pace | 6K Equiv | Avg HR | Cadence |
|---|------|-------|------|----------|------|------|----------|--------|---------|
${runRows || '| - | No runs logged yet | - | - | - | - | - | - | - |'}

## 4. Suggested Questions to Ask Your AI Coach:
1. "Given my goal of running a 6K in ${target6kFormatted} on a 3-day/week schedule, how should I balance my Aerobic vs Interval training sessions?"
2. "Analyze my heart rate and pace progression across my recent Interval training workouts versus my Aerobic runs."
3. "What specific 6K Cross Country peaking workouts should I perform 3-4 weeks before my target race?"
4. "How can I improve my cadence and finish faster over the final 2 kilometers of a hilly 6K cross country course?"
`;
}

export type TrainingCategory = 'Easy' | 'Interval' | 'Tempo' | 'Race';

export function getTrainingCategory(runType: RunType, title?: string): TrainingCategory {
  if (runType === 'Race' || runType === '6K Time Trial') {
    return 'Race';
  }
  if (runType === 'Interval Training' || runType === 'Intervals' || runType === 'Hill Repeats') {
    return 'Interval';
  }
  if (runType === 'Tempo' || runType === 'Hill Run') {
    return 'Tempo';
  }
  if (runType === 'Easy' || runType === 'Aerobic' || runType === 'Long Run' || runType === 'Recovery') {
    return 'Easy';
  }
  const lower = (title || '').toLowerCase();
  if (lower.includes('race') || lower.includes('time trial')) return 'Race';
  if (lower.includes('hill repeat') || lower.includes('hill sprint') || lower.includes('interval') || lower.includes('track') || lower.includes('repeat')) return 'Interval';
  if (lower.includes('hill run') || lower.includes('tempo') || lower.includes('threshold')) return 'Tempo';
  return 'Easy';
}

export interface CategoryBreakdownItem {
  category: TrainingCategory;
  name: string;
  description: string;
  runCount: number;
  totalDistanceKm: number;
  totalDurationSeconds: number;
  percentageDistance: number;
  percentageCount: number;
  avgPaceSecPerKm: number;
  color: string;
  darkColor: string;
  badgeBg: string;
}

export interface TrainingBreakdownResult {
  items: CategoryBreakdownItem[];
  totalRuns: number;
  totalDistanceKm: number;
  totalDurationSeconds: number;
  avgPaceSecPerKm: number;
  periodDays: number;
}

export function calculateCategoryBreakdown(
  runs: RunRecord[],
  days: number = 30,
  referenceDate: Date = new Date()
): TrainingBreakdownResult {
  const cutoffTime = referenceDate.getTime() - days * 24 * 60 * 60 * 1000;

  const windowRuns = runs.filter((r) => {
    const d = new Date(r.date).getTime();
    return !isNaN(d) && d >= cutoffTime;
  });

  const categoryMeta: Record<TrainingCategory, { name: string; description: string; color: string; darkColor: string; badgeBg: string }> = {
    Easy: {
      name: 'Easy & Base',
      description: 'Aerobic foundation, recovery, and long runs (Zone 2)',
      color: '#10B981', // Emerald Green
      darkColor: '#34d399',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    },
    Interval: {
      name: 'Intervals',
      description: 'Track repeats, VO2 max speed, and race turnover',
      color: '#F59E0B', // Amber Gold
      darkColor: '#fbbf24',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    },
    Tempo: {
      name: 'Tempo',
      description: 'Lactate threshold and sustained tempo rhythm',
      color: '#8B5CF6', // Royal Purple
      darkColor: '#a78bfa',
      badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
    },
    Race: {
      name: 'Race & Trials',
      description: 'Cross country races and goal distance time trials',
      color: '#EF4444', // Vibrant Crimson
      darkColor: '#f87171',
      badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
    },
  };

  const buckets: Record<TrainingCategory, { runs: RunRecord[]; distance: number; duration: number }> = {
    Easy: { runs: [], distance: 0, duration: 0 },
    Interval: { runs: [], distance: 0, duration: 0 },
    Tempo: { runs: [], distance: 0, duration: 0 },
    Race: { runs: [], distance: 0, duration: 0 },
  };

  windowRuns.forEach((r) => {
    const cat = getTrainingCategory(r.runType, r.title);
    buckets[cat].runs.push(r);
    buckets[cat].distance += r.distanceKm;
    buckets[cat].duration += r.durationSeconds;
  });

  const totalDistanceKm = Number(windowRuns.reduce((sum, r) => sum + r.distanceKm, 0).toFixed(2));
  const totalDurationSeconds = windowRuns.reduce((sum, r) => sum + r.durationSeconds, 0);
  const totalRuns = windowRuns.length;
  const avgPaceSecPerKm = totalDistanceKm > 0 ? Math.round(totalDurationSeconds / totalDistanceKm) : 0;

  const categories: TrainingCategory[] = ['Easy', 'Interval', 'Tempo', 'Race'];

  const items: CategoryBreakdownItem[] = categories.map((cat) => {
    const b = buckets[cat];
    const catDist = Number(b.distance.toFixed(2));
    const catPace = catDist > 0 ? Math.round(b.duration / catDist) : 0;
    const pctDist = totalDistanceKm > 0 ? Math.round((catDist / totalDistanceKm) * 100) : 0;
    const pctCount = totalRuns > 0 ? Math.round((b.runs.length / totalRuns) * 100) : 0;
    const meta = categoryMeta[cat];

    return {
      category: cat,
      name: meta.name,
      description: meta.description,
      runCount: b.runs.length,
      totalDistanceKm: catDist,
      totalDurationSeconds: b.duration,
      percentageDistance: pctDist,
      percentageCount: pctCount,
      avgPaceSecPerKm: catPace,
      color: meta.color,
      darkColor: meta.darkColor,
      badgeBg: meta.badgeBg,
    };
  });

  return {
    items,
    totalRuns,
    totalDistanceKm,
    totalDurationSeconds,
    avgPaceSecPerKm,
    periodDays: days,
  };
}

export type EffortLevel = 'Light' | 'Moderate' | 'Hard' | 'Extreme';

export type ReadinessState =
  | 'Fully Rested'
  | 'Optimal'
  | 'Good'
  | 'Moderate Fatigue'
  | 'Deep Recovery';

export type BodyBatteryStatus =
  | 'Prime Charge'
  | 'Charged'
  | 'Moderate Reserve'
  | 'Low Reserve'
  | 'Drained';

export interface BodyBatteryPoint {
  label: string;
  score: number;
  phase: 'baseline' | 'drain' | 'recharge' | 'now';
}

export interface RecoveryCalculationResult {
  hasRuns: boolean;
  recoveryPercentage: number; // 0 to 100
  bodyBatteryScore: number; // 5 to 100 Garmin Body Battery reserve
  batteryStatusLabel: BodyBatteryStatus;
  drainedPoints: number;
  chargedPoints: number;
  batteryLowAfterRun: number;
  rechargeRatePerHour: number;
  batteryTimeline: BodyBatteryPoint[];
  readinessState: ReadinessState;
  color: string;
  hoursSinceLastRun: number;
  recommendedRecoveryHours: number;
  remainingRecoveryHours: number;
  lastRun?: RunRecord;
  effortScore: number;
  effortLevel: EffortLevel;
  trainingStressMultiplier: number;
  explanation: string;
  nextSessionRecommendation: string;
}

/**
 * Pure mathematical running recovery & Garmin-style Body Battery calculation based on:
 * 1. Elapsed time since the most recent workout
 * 2. Physiological workout load (duration, distance, category multiplier, and HR intensity)
 * 3. Exponential restorative recharge curve from post-workout drain
 */
export function calculateRecoveryStatus(
  runs: RunRecord[],
  now: Date = new Date(),
  maxHeartRate: number = 190
): RecoveryCalculationResult {
  if (!runs || runs.length === 0) {
    return {
      hasRuns: false,
      recoveryPercentage: 100,
      bodyBatteryScore: 100,
      batteryStatusLabel: 'Prime Charge',
      drainedPoints: 0,
      chargedPoints: 0,
      batteryLowAfterRun: 100,
      rechargeRatePerHour: 0,
      batteryTimeline: [
        { label: '-24h', score: 92, phase: 'baseline' },
        { label: '-18h', score: 95, phase: 'recharge' },
        { label: '-12h', score: 97, phase: 'recharge' },
        { label: '-6h', score: 99, phase: 'recharge' },
        { label: 'Now', score: 100, phase: 'now' },
      ],
      readinessState: 'Fully Rested',
      color: '#10B981',
      hoursSinceLastRun: 0,
      recommendedRecoveryHours: 0,
      remainingRecoveryHours: 0,
      effortScore: 0,
      effortLevel: 'Light',
      trainingStressMultiplier: 1.0,
      explanation: 'No runs recorded yet. Your legs and cardiovascular system are completely charged.',
      nextSessionRecommendation: 'Ready to log your first run, time trial, or fitness tracker sync.',
    };
  }

  // Find the most recent run
  const sortedRuns = [...runs].sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return (b.durationSeconds || 0) - (a.durationSeconds || 0);
  });

  const lastRun = sortedRuns[0];

  // Calculate elapsed hours since the last run
  let runTimestamp = new Date(lastRun.date).getTime();
  if (isNaN(runTimestamp)) {
    runTimestamp = now.getTime() - 24 * 60 * 60 * 1000;
  } else if (!lastRun.date.includes('T')) {
    const parsed = new Date(lastRun.date + 'T12:00:00');
    if (!isNaN(parsed.getTime())) {
      runTimestamp = parsed.getTime();
    }
  }

  const rawElapsedMs = now.getTime() - runTimestamp;
  const hoursSinceLastRun = Math.max(0.5, Math.round((rawElapsedMs / (1000 * 60 * 60)) * 10) / 10);

  // 1. Base Duration & Distance Load
  const durationMin = (lastRun.durationSeconds || 0) / 60;
  const distanceKm = lastRun.distanceKm || 0;

  // 2. Run Type Intensity Multiplier
  let typeMultiplier = 1.0;
  switch (lastRun.runType) {
    case 'Race':
      typeMultiplier = 1.55;
      break;
    case '6K Time Trial':
    case 'Time Trial':
      typeMultiplier = 1.50;
      break;
    case 'Interval Training':
    case 'Intervals':
      typeMultiplier = 1.40;
      break;
    case 'Hill Repeats':
      typeMultiplier = 1.38;
      break;
    case 'Tempo':
      typeMultiplier = 1.25;
      break;
    case 'Long Run':
      typeMultiplier = 1.20;
      break;
    case 'Hill Run':
      typeMultiplier = 1.18;
      break;
    case 'Recovery':
      typeMultiplier = 0.75;
      break;
    case 'Easy':
    case 'Aerobic':
    default:
      typeMultiplier = 0.90;
      break;
  }

  // 3. Heart Rate Intensity Factor
  let hrFactor = 1.0;
  if (lastRun.avgHeartRate && lastRun.avgHeartRate > 50) {
    const hrRatio = lastRun.avgHeartRate / maxHeartRate;
    if (hrRatio >= 0.90) {
      hrFactor = 1.35;
    } else if (hrRatio >= 0.82) {
      hrFactor = 1.20;
    } else if (hrRatio >= 0.72) {
      hrFactor = 1.05;
    } else {
      hrFactor = 0.85;
    }
  }

  // 4. Pace Factor (speed stress)
  let paceFactor = 1.0;
  if (lastRun.averagePaceSecPerKm && lastRun.averagePaceSecPerKm > 0) {
    if (lastRun.averagePaceSecPerKm < 240) {
      paceFactor = 1.15;
    } else if (lastRun.averagePaceSecPerKm < 270) {
      paceFactor = 1.08;
    }
  }

  // Composite Training Stress Score (Math calculation)
  const trainingStressMultiplier = Number((typeMultiplier * hrFactor * paceFactor).toFixed(2));
  const rawLoad = (durationMin * 0.85 + distanceKm * 2.6) * trainingStressMultiplier;
  const effortScore = Math.max(10, Math.round(rawLoad));

  // Effort Classification
  let effortLevel: EffortLevel = 'Moderate';
  if (effortScore < 35) {
    effortLevel = 'Light';
  } else if (effortScore <= 65) {
    effortLevel = 'Moderate';
  } else if (effortScore <= 95) {
    effortLevel = 'Hard';
  } else {
    effortLevel = 'Extreme';
  }

  // 5. Recommended Recovery Hours Formula:
  const recommendedRecoveryHours = Math.min(
    72,
    Math.max(12, Math.round(effortScore * 0.46 + 4))
  );

  // 6. Exponential Restorative Recovery Curve
  const progressRatio = hoursSinceLastRun / recommendedRecoveryHours;
  let recoveryPercentage = 100;
  let remainingRecoveryHours = 0;

  if (progressRatio < 1.0) {
    recoveryPercentage = Math.min(
      99,
      Math.max(5, Math.round(Math.pow(progressRatio, 0.85) * 100))
    );
    remainingRecoveryHours = Math.max(
      0.5,
      Math.round((recommendedRecoveryHours - hoursSinceLastRun) * 10) / 10
    );
  }

  // 7. Garmin Body Battery Modeling (5-100 Energy Reserve Scale)
  const drainedPoints = Math.min(85, Math.max(15, Math.round(effortScore * 0.72)));
  const preRunReserve = 90;
  const batteryLowAfterRun = Math.max(5, preRunReserve - drainedPoints);
  const rechargeProgress = Math.min(1, Math.pow(Math.max(0, progressRatio), 0.85));
  const bodyBatteryScore =
    progressRatio >= 1.0
      ? 100
      : Math.min(
          99,
          Math.max(5, Math.round(batteryLowAfterRun + (100 - batteryLowAfterRun) * rechargeProgress))
        );
  const chargedPoints = Math.max(0, bodyBatteryScore - batteryLowAfterRun);
  const rechargeRatePerHour =
    recommendedRecoveryHours > 0
      ? Number(((100 - batteryLowAfterRun) / recommendedRecoveryHours).toFixed(1))
      : 0;

  let batteryStatusLabel: BodyBatteryStatus;
  if (bodyBatteryScore >= 85) {
    batteryStatusLabel = 'Prime Charge';
  } else if (bodyBatteryScore >= 65) {
    batteryStatusLabel = 'Charged';
  } else if (bodyBatteryScore >= 45) {
    batteryStatusLabel = 'Moderate Reserve';
  } else if (bodyBatteryScore >= 25) {
    batteryStatusLabel = 'Low Reserve';
  } else {
    batteryStatusLabel = 'Drained';
  }

  // Build deterministic 6-point Body Battery Energy Timeline
  const quarterSpan = Math.max(1, Math.round((hoursSinceLastRun * 0.25) * 10) / 10);
  const halfSpan = Math.max(1, Math.round((hoursSinceLastRun * 0.5) * 10) / 10);
  const threeQuarterSpan = Math.max(1, Math.round((hoursSinceLastRun * 0.75) * 10) / 10);

  const scoreAtFraction = (frac: number) => {
    const elapsedAtPoint = hoursSinceLastRun * frac;
    const pr = Math.min(1, Math.pow(Math.max(0, elapsedAtPoint / recommendedRecoveryHours), 0.85));
    return Math.min(100, Math.max(5, Math.round(batteryLowAfterRun + (100 - batteryLowAfterRun) * pr)));
  };

  const batteryTimeline: BodyBatteryPoint[] = [
    { label: 'Pre-Run', score: preRunReserve, phase: 'baseline' },
    { label: 'Post-Run', score: batteryLowAfterRun, phase: 'drain' },
    { label: `+${quarterSpan}h`, score: scoreAtFraction(0.25), phase: 'recharge' },
    { label: `+${halfSpan}h`, score: scoreAtFraction(0.5), phase: 'recharge' },
    { label: `+${threeQuarterSpan}h`, score: scoreAtFraction(0.75), phase: 'recharge' },
    { label: 'Now', score: bodyBatteryScore, phase: 'now' },
  ];

  // 8. Readiness State, Color, and Scientific Guidance
  let readinessState: ReadinessState;
  let color: string;
  let explanation: string;
  let nextSessionRecommendation: string;

  if (bodyBatteryScore >= 80 && recoveryPercentage >= 75) {
    readinessState = progressRatio >= 1.2 ? 'Fully Rested' : 'Optimal';
    color = '#10B981'; // Emerald green
    explanation = `Your Body Battery (${bodyBatteryScore}/100) and cardiovascular stores are charged after ${hoursSinceLastRun}h since ${lastRun.title}.`;
    nextSessionRecommendation = 'Prime energy reserve for high-intensity intervals, 6K trial, or long endurance run.';
  } else if (bodyBatteryScore >= 55) {
    readinessState = 'Good';
    color = '#0EA5E9'; // Electric Sky Blue
    explanation = `Body Battery recharging steadily (${bodyBatteryScore}/100, +${chargedPoints} charged). ${remainingRecoveryHours}h until 100% peak reserve.`;
    nextSessionRecommendation = 'Solid energy for aerobic base miles, easy recovery running, or controlled tempo work.';
  } else if (bodyBatteryScore >= 35) {
    readinessState = 'Moderate Fatigue';
    color = '#F59E0B'; // Warm Amber
    explanation = `Body Battery is in moderate reserve (${bodyBatteryScore}/100 after -${drainedPoints} drain from ${lastRun.title}).`;
    nextSessionRecommendation = 'Prioritize light recovery jog, mobility work, or extra sleep to accelerate recharge.';
  } else {
    readinessState = 'Deep Recovery';
    color = '#EF4444'; // Coral Crimson
    explanation = `High physiological strain drained Body Battery to ${batteryLowAfterRun} (Load: ${effortScore}). Active restoration underway.`;
    nextSessionRecommendation = 'Rest day recommended. Focus on hydration, carbohydrate/protein fueling, and sleep.';
  }

  // Keep existing test semantics when recoveryPercentage < 40 shortly after an extreme race
  if (recoveryPercentage < 40 && hoursSinceLastRun <= 6 && effortScore > 50) {
    readinessState = 'Deep Recovery';
    color = '#EF4444';
  }

  return {
    hasRuns: true,
    recoveryPercentage,
    bodyBatteryScore,
    batteryStatusLabel,
    drainedPoints,
    chargedPoints,
    batteryLowAfterRun,
    rechargeRatePerHour,
    batteryTimeline,
    readinessState,
    color,
    hoursSinceLastRun,
    recommendedRecoveryHours,
    remainingRecoveryHours,
    lastRun,
    effortScore,
    effortLevel,
    trainingStressMultiplier,
    explanation,
    nextSessionRecommendation,
  };
}

export interface GoalMilestone {
  weekNumber: number;
  projectedDate: string;
  projectedTimeSeconds: number;
  projectedPaceSecPerKm: number;
  notes: string;
}

export interface ProjectionHistoryPoint {
  runId: string;
  date: string;
  title: string;
  runType: RunType;
  distanceKm: number;
  actualDurationSeconds: number;
  equivalentTimeSeconds: number;
  equivalentPaceSecPerKm: number;
  isQualityBenchmark: boolean;
  weeksFromBaseline: number;
}

export interface ProjectionCurvePoint {
  weekOffset: number;
  dateLabel: string;
  expectedSec: number;
  acceleratedSec: number;
  conservativeSec: number;
}

export interface ImprovementSummary {
  hasHistory: boolean;
  spanWeeks: number;
  baselineSeconds: number;
  baselineDate: string;
  baselineTitle: string;
  currentBenchmarkSeconds: number;
  currentBenchmarkDate: string;
  totalDroppedSeconds: number; // positive = got faster
  paceDroppedSecPerKm: number;
  improvementPercent: number;
  empiricalWeeklyRateSec: number | null;
  trendStatus: 'accelerating' | 'improving' | 'steady' | 'plateau' | 'insufficient';
  benchmarkCount: number;
  seriesLabel: string;
}

export interface GoalProjectionResult {
  hasTarget: boolean;
  hasData: boolean;
  isAchieved: boolean;
  targetDistanceKm: number;
  targetTimeSeconds?: number;
  currentBestSeconds?: number;
  gapSeconds: number;
  estimatedWeeks: number;
  projectedCompletionDate: string;
  weeklyImprovementSeconds: number;
  confidence: 'High' | 'Moderate' | 'Initial Estimate';
  basisDescription: string;
  milestones: GoalMilestone[];
  historyPoints: ProjectionHistoryPoint[];
  allRunsHistoryPoints: ProjectionHistoryPoint[];
  projectedCurve: ProjectionCurvePoint[];
  improvementSummary: ImprovementSummary;
  recentRunsPerWeek: number;
  scenarios: {
    accelerated: { weeks: number; date: string; weeklyRateSec: number };
    expected: { weeks: number; date: string; weeklyRateSec: number };
    conservative: { weeks: number; date: string; weeklyRateSec: number };
  };
}

function getRunEquivalentForProjection(run: RunRecord, targetDist: number): {
  equivalentSec: number;
  isQualityBenchmark: boolean;
  isContinuousEligible: boolean;
  weight: number;
} {
  const distKm = run.distanceKm || 0;
  const durSec = run.durationSeconds || 0;

  if (distKm <= 0 || durSec <= 0) {
    const fallbackEq = run.targetEquivalentSeconds || run.best6kTimeSeconds || 0;
    return {
      equivalentSec: fallbackEq,
      isQualityBenchmark: false,
      isContinuousEligible: false,
      weight: 0.6,
    };
  }

  // Calibrated intervals: use active interval work pace + fatigue factor so rest breaks don't distort fitness
  if (
    (run.runType === 'Intervals' || run.runType === 'Interval Training') &&
    run.activeIntervalPaceSecPerKm &&
    run.activeIntervalPaceSecPerKm > 0
  ) {
    const workDist = run.repCount && run.repDistanceMeters
      ? (run.repCount * run.repDistanceMeters) / 1000
      : Math.max(1.5, distKm * 0.8);
    const continuousAdjustedDur = Math.round(workDist * run.activeIntervalPaceSecPerKm * 1.045);
    return {
      equivalentSec: calculateTargetDistanceEquivalent(workDist, continuousAdjustedDur, targetDist),
      isQualityBenchmark: false,
      isContinuousEligible: false,
      weight: 0.75,
    };
  }

  const eq = calculateTargetDistanceEquivalent(distKm, durSec, targetDist);
  const isRaceOrTT =
    run.runType === 'Race' ||
    run.runType === '6K Time Trial' ||
    run.runType === 'Time Trial';
  const isTempoOrHill = run.runType === 'Tempo' || run.runType === 'Hill Run';
  const isQualityBenchmark = distKm >= 2.5 && (isRaceOrTT || isTempoOrHill);
  const isContinuousEligible =
    distKm >= 2.5 &&
    !isIntervalRun(run.runType) &&
    run.runType !== 'Recovery' &&
    run.runType !== 'Easy';

  const weight = isRaceOrTT ? 1.65 : isTempoOrHill ? 1.25 : isContinuousEligible ? 0.9 : 0.65;

  return {
    equivalentSec: eq,
    isQualityBenchmark,
    isContinuousEligible,
    weight,
  };
}

function simulateDiminishingReturnsProjection(
  startSec: number,
  targetSec: number,
  initialWeeklyRateSec: number,
  maxWeeks: number = 104
): { weeks: number; curveSeconds: number[] } {
  if (startSec <= targetSec) {
    return { weeks: 0, curveSeconds: [startSec] };
  }
  const safeRate = Math.max(2, initialWeeklyRateSec);
  const curveSeconds: number[] = [startSec];
  let cur = startSec;
  let weeks = 0;

  while (cur > targetSec && weeks < maxWeeks) {
    weeks += 1;
    const progressRatio = Math.min(1, Math.max(0, (startSec - cur) / Math.max(1, startSec - targetSec)));
    // Gentle diminishing returns: gains taper ~16% as runner nears peak target fitness
    const taperMultiplier = 1 - 0.16 * progressRatio;
    const step = Math.max(1.5, safeRate * taperMultiplier);
    cur = Math.max(targetSec, cur - step);
    curveSeconds.push(Math.round(cur));
  }

  return { weeks: Math.max(1, weeks), curveSeconds };
}

export function calculateGoalProjection(
  runs: RunRecord[],
  targetDistanceKm: number = 6.0,
  targetTimeSeconds?: number | null,
  currentBestSeconds?: number | null,
  weeklyRunGoal: number = 3,
  currentWeeklyStreak: number = 0
): GoalProjectionResult {
  const targetDist = targetDistanceKm || 6.0;

  // Prepare chronological history points regardless of whether a target is set
  const rawDatedRuns = [...runs]
    .map((r) => {
      const parsedDate = parseDateSafe(r.date);
      const evalInfo = getRunEquivalentForProjection(r, targetDist);
      return {
        run: r,
        timestamp: parsedDate.getTime(),
        ...evalInfo,
      };
    })
    .filter((item) => item.equivalentSec > 0 && !isNaN(item.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  const firstAllTs = rawDatedRuns.length > 0 ? rawDatedRuns[0].timestamp : Date.now();
  const allRunsHistoryPoints: ProjectionHistoryPoint[] = rawDatedRuns.map((item) => ({
    runId: item.run.id,
    date: item.run.date,
    title: item.run.title,
    runType: item.run.runType,
    distanceKm: item.run.distanceKm,
    actualDurationSeconds: item.run.durationSeconds,
    equivalentTimeSeconds: item.equivalentSec,
    equivalentPaceSecPerKm: item.equivalentSec / targetDist,
    isQualityBenchmark: item.isQualityBenchmark,
    weeksFromBaseline: Math.round(((item.timestamp - firstAllTs) / (7 * 86400_000)) * 10) / 10,
  }));

  // Select clean benchmark series so slow recovery jogs never distort the runner's progression trend
  const qualityCandidates = rawDatedRuns.filter((r) => r.isQualityBenchmark);
  const continuousCandidates = rawDatedRuns.filter((r) => r.isContinuousEligible);
  const nonRecoveryCandidates = rawDatedRuns.filter(
    (r) => r.run.runType !== 'Recovery' && r.run.distanceKm >= 1.0
  );

  const qualitySpanDays =
    qualityCandidates.length >= 2
      ? (qualityCandidates[qualityCandidates.length - 1].timestamp - qualityCandidates[0].timestamp) / 86400_000
      : 0;
  const continuousSpanDays =
    continuousCandidates.length >= 2
      ? (continuousCandidates[continuousCandidates.length - 1].timestamp - continuousCandidates[0].timestamp) / 86400_000
      : 0;

  let selectedSeries = rawDatedRuns;
  let seriesLabel = 'All Distance-Adjusted Runs';

  if (qualityCandidates.length >= 2 && qualitySpanDays >= 3) {
    selectedSeries = qualityCandidates;
    seriesLabel = 'Quality Benchmarks (Races, Time Trials & Tempo)';
  } else if (continuousCandidates.length >= 2 && continuousSpanDays >= 3) {
    selectedSeries = continuousCandidates;
    seriesLabel = 'Continuous Effort Runs (>= 2.5 km)';
  } else if (nonRecoveryCandidates.length >= 2) {
    selectedSeries = nonRecoveryCandidates;
    seriesLabel = 'Training Runs';
  }

  const firstSeriesTs = selectedSeries.length > 0 ? selectedSeries[0].timestamp : firstAllTs;
  const historyPoints: ProjectionHistoryPoint[] = selectedSeries.map((item) => ({
    runId: item.run.id,
    date: item.run.date,
    title: item.run.title,
    runType: item.run.runType,
    distanceKm: item.run.distanceKm,
    actualDurationSeconds: item.run.durationSeconds,
    equivalentTimeSeconds: item.equivalentSec,
    equivalentPaceSecPerKm: item.equivalentSec / targetDist,
    isQualityBenchmark: item.isQualityBenchmark,
    weeksFromBaseline: Math.round(((item.timestamp - firstSeriesTs) / (7 * 86400_000)) * 10) / 10,
  }));

  // Weighted linear regression across selectedSeries
  let empiricalRate: number | null = null;
  let spanWeeks = 0;

  if (selectedSeries.length >= 2) {
    const firstTs = selectedSeries[0].timestamp;
    const lastTs = selectedSeries[selectedSeries.length - 1].timestamp;
    const spanDays = (lastTs - firstTs) / 86400_000;
    spanWeeks = Math.round((spanDays / 7) * 10) / 10;

    if (spanDays >= 5) {
      let sumW = 0;
      let sumWX = 0;
      let sumWY = 0;
      let sumWXX = 0;
      let sumWXY = 0;

      selectedSeries.forEach((pt, idx) => {
        const x = (pt.timestamp - firstTs) / (7 * 86400_000);
        const y = pt.equivalentSec;
        const recencyWeight = 0.75 + 0.55 * (idx / Math.max(1, selectedSeries.length - 1));
        const w = pt.weight * recencyWeight;
        sumW += w;
        sumWX += w * x;
        sumWY += w * y;
        sumWXX += w * x * x;
        sumWXY += w * x * y;
      });

      const meanX = sumWX / sumW;
      const meanY = sumWY / sumW;
      const denom = sumWXX - sumW * meanX * meanX;
      if (denom > 0.01) {
        const slopeSecPerWeek = (sumWXY - sumW * meanX * meanY) / denom;
        // Negative slope means equivalent race time dropped -> positive improvement rate
        empiricalRate = Math.round(-slopeSecPerWeek * 10) / 10;
      }
    }
  }

  // Recent 28-day weekly frequency relative to reference date
  const now = new Date();
  const latestRunTs = rawDatedRuns.length > 0 ? rawDatedRuns[rawDatedRuns.length - 1].timestamp : now.getTime();
  const freqAnchorTs = Math.max(now.getTime(), latestRunTs);
  const runsLast28Days = rawDatedRuns.filter(
    (item) => freqAnchorTs - item.timestamp <= 28 * 86400_000
  ).length;
  const recentRunsPerWeek = Math.round((runsLast28Days / 4) * 10) / 10;

  const bestSelection = selectBestTargetEquivalent(runs, targetDist);
  const effectiveCurrentSec =
    currentBestSeconds && currentBestSeconds > 0
      ? currentBestSeconds
      : bestSelection.bestSeconds || null;

  // Summarize actual improvement achieved over recorded history
  const baselinePoint = historyPoints[0];
  const latestPoint = historyPoints[historyPoints.length - 1];
  const hasImprovementHistory = Boolean(
    baselinePoint &&
      latestPoint &&
      historyPoints.length >= 2 &&
      spanWeeks >= 0.5
  );
  const currentRefSec =
    effectiveCurrentSec || (latestPoint ? latestPoint.equivalentTimeSeconds : 0);
  const totalDroppedSeconds =
    hasImprovementHistory && baselinePoint && currentRefSec > 0
      ? Math.round(baselinePoint.equivalentTimeSeconds - currentRefSec)
      : 0;
  const paceDroppedSecPerKm =
    hasImprovementHistory && targetDist > 0
      ? Math.round((totalDroppedSeconds / targetDist) * 10) / 10
      : 0;
  const improvementPercent =
    hasImprovementHistory && baselinePoint && baselinePoint.equivalentTimeSeconds > 0
      ? Math.round((totalDroppedSeconds / baselinePoint.equivalentTimeSeconds) * 1000) / 10
      : 0;

  let trendStatus: ImprovementSummary['trendStatus'] = 'insufficient';
  if (hasImprovementHistory) {
    if (empiricalRate !== null && empiricalRate >= 12) {
      trendStatus = 'accelerating';
    } else if ((empiricalRate !== null && empiricalRate > 2) || totalDroppedSeconds >= 10) {
      trendStatus = 'improving';
    } else if (empiricalRate !== null && empiricalRate >= -3) {
      trendStatus = 'steady';
    } else {
      trendStatus = 'plateau';
    }
  }

  const improvementSummary: ImprovementSummary = {
    hasHistory: hasImprovementHistory,
    spanWeeks,
    baselineSeconds: baselinePoint ? baselinePoint.equivalentTimeSeconds : currentRefSec,
    baselineDate: baselinePoint ? baselinePoint.date : '',
    baselineTitle: baselinePoint ? baselinePoint.title : '',
    currentBenchmarkSeconds: currentRefSec,
    currentBenchmarkDate: bestSelection.basisRun?.date || (latestPoint ? latestPoint.date : ''),
    totalDroppedSeconds,
    paceDroppedSecPerKm,
    improvementPercent,
    empiricalWeeklyRateSec: empiricalRate,
    trendStatus,
    benchmarkCount: historyPoints.length,
    seriesLabel,
  };

  if (!targetTimeSeconds || targetTimeSeconds <= 0) {
    return {
      hasTarget: false,
      hasData: Boolean(runs.length > 0),
      isAchieved: false,
      targetDistanceKm: targetDist,
      currentBestSeconds: effectiveCurrentSec || undefined,
      gapSeconds: 0,
      estimatedWeeks: 0,
      projectedCompletionDate: '',
      weeklyImprovementSeconds: 0,
      confidence: 'Initial Estimate',
      basisDescription: 'Set a goal time to calculate your projected completion date and weekly progression curve.',
      milestones: [],
      historyPoints,
      allRunsHistoryPoints,
      projectedCurve: [],
      improvementSummary,
      recentRunsPerWeek,
      scenarios: {
        accelerated: { weeks: 0, date: '', weeklyRateSec: 0 },
        expected: { weeks: 0, date: '', weeklyRateSec: 0 },
        conservative: { weeks: 0, date: '', weeklyRateSec: 0 },
      },
    };
  }

  // Handle if target was entered as pace per km (< 600s)
  const targetTotalSec =
    targetTimeSeconds < 600
      ? Math.round(targetTimeSeconds * targetDist)
      : targetTimeSeconds;

  if (!effectiveCurrentSec) {
    return {
      hasTarget: true,
      hasData: false,
      isAchieved: false,
      targetDistanceKm: targetDist,
      targetTimeSeconds: targetTotalSec,
      gapSeconds: 0,
      estimatedWeeks: 0,
      projectedCompletionDate: '',
      weeklyImprovementSeconds: 0,
      confidence: 'Initial Estimate',
      basisDescription: 'Log or sync your first workout to establish baseline performance and compute projection.',
      milestones: [],
      historyPoints,
      allRunsHistoryPoints,
      projectedCurve: [],
      improvementSummary,
      recentRunsPerWeek,
      scenarios: {
        accelerated: { weeks: 0, date: '', weeklyRateSec: 0 },
        expected: { weeks: 0, date: '', weeklyRateSec: 0 },
        conservative: { weeks: 0, date: '', weeklyRateSec: 0 },
      },
    };
  }

  const gapSeconds = effectiveCurrentSec - targetTotalSec;
  const isAchieved = gapSeconds <= 0;

  if (isAchieved) {
    return {
      hasTarget: true,
      hasData: true,
      isAchieved: true,
      targetDistanceKm: targetDist,
      targetTimeSeconds: targetTotalSec,
      currentBestSeconds: effectiveCurrentSec,
      gapSeconds: 0,
      estimatedWeeks: 0,
      projectedCompletionDate: 'Goal Achieved',
      weeklyImprovementSeconds: 0,
      confidence: 'High',
      basisDescription: `You have surpassed your ${targetDist}K target by ${formatDuration(Math.abs(gapSeconds))}. Maintain conditioning with regular aerobic tempo workouts!`,
      milestones: [
        {
          weekNumber: 0,
          projectedDate: 'Now',
          projectedTimeSeconds: effectiveCurrentSec,
          projectedPaceSecPerKm: effectiveCurrentSec / targetDist,
          notes: 'Current PR / Benchmark (Goal Surpassed)',
        },
      ],
      historyPoints,
      allRunsHistoryPoints,
      projectedCurve: [
        {
          weekOffset: 0,
          dateLabel: 'Now',
          expectedSec: effectiveCurrentSec,
          acceleratedSec: effectiveCurrentSec,
          conservativeSec: effectiveCurrentSec,
        },
      ],
      improvementSummary,
      recentRunsPerWeek,
      scenarios: {
        accelerated: { weeks: 0, date: 'Achieved', weeklyRateSec: 0 },
        expected: { weeks: 0, date: 'Achieved', weeklyRateSec: 0 },
        conservative: { weeks: 0, date: 'Achieved', weeklyRateSec: 0 },
      },
    };
  }

  // Compute pace-aware physiological baseline rate (faster runners gain fewer raw sec/wk than beginners)
  const currentPaceSecPerKm = effectiveCurrentSec / targetDist;
  const paceFitnessMult = Math.min(1.35, Math.max(0.5, 0.55 + (currentPaceSecPerKm - 190) / 170));
  const effectiveFreq = runsLast28Days >= 2 ? 0.65 * recentRunsPerWeek + 0.35 * weeklyRunGoal : weeklyRunGoal;
  const freqMult = Math.min(1.25, Math.max(0.72, effectiveFreq / 3));
  const streakMult = Math.min(1.15, 1 + currentWeeklyStreak * 0.03);

  const physiologicalRateSec = Math.max(
    4,
    effectiveCurrentSec * 0.012 * paceFitnessMult * freqMult * streakMult
  );

  let weeklyImprovement = Math.round(physiologicalRateSec);
  let confidence: 'High' | 'Moderate' | 'Initial Estimate' = 'Initial Estimate';
  let basisDescription = `Calibrated to your current ${formatPace(currentPaceSecPerKm, 'km')} fitness and ${weeklyRunGoal}x/week plan.`;

  if (selectedSeries.length >= 2 && spanWeeks >= 0.7 && empiricalRate !== null) {
    const empiricalWeight = Math.min(
      0.72,
      0.32 + (selectedSeries.length - 2) * 0.08 + Math.min(0.2, spanWeeks * 0.03)
    );

    if (empiricalRate > 0.5) {
      const minRealistic = Math.max(3, physiologicalRateSec * 0.45);
      const maxRealistic = Math.min(42, physiologicalRateSec * 2.1);
      const boundedEmpirical = Math.min(maxRealistic, Math.max(minRealistic, empiricalRate));

      weeklyImprovement = Math.max(
        4,
        Math.round(physiologicalRateSec * (1 - empiricalWeight) + boundedEmpirical * empiricalWeight)
      );
      confidence = selectedSeries.length >= 4 && spanWeeks >= 2 ? 'High' : 'Moderate';
      basisDescription = `Weighted regression across ${selectedSeries.length} ${seriesLabel.toLowerCase()} over ${spanWeeks} wks (${empiricalRate.toFixed(1)}s/wk earned slope) blended with diminishing-returns adaptation.`;
    } else {
      weeklyImprovement = Math.max(4, Math.round(physiologicalRateSec * 0.8));
      confidence = selectedSeries.length >= 4 ? 'Moderate' : 'Initial Estimate';
      basisDescription = `Recent benchmarks held steady — model projects a conservative ${weeklyImprovement}s/wk build as consistent training resumes.`;
    }
  } else if (currentWeeklyStreak > 0) {
    confidence = 'Moderate';
    basisDescription = `Calibrated from your ${currentWeeklyStreak}-week training streak (~${weeklyImprovement}s/wk expected at current pace).`;
  }

  // Scenarios with diminishing-returns non-linear curves
  const acceleratedRate = Math.max(6, Math.round(weeklyImprovement * 1.32));
  const expectedRate = Math.max(4, weeklyImprovement);
  const conservativeRate = Math.max(3, Math.round(weeklyImprovement * 0.65));

  const expectedSim = simulateDiminishingReturnsProjection(effectiveCurrentSec, targetTotalSec, expectedRate);
  const acceleratedSim = simulateDiminishingReturnsProjection(effectiveCurrentSec, targetTotalSec, acceleratedRate);
  const conservativeSim = simulateDiminishingReturnsProjection(effectiveCurrentSec, targetTotalSec, conservativeRate);

  const expectedWeeks = expectedSim.weeks;
  const acceleratedWeeks = acceleratedSim.weeks;
  const conservativeWeeks = conservativeSim.weeks;

  const formatDateOffset = (weeks: number): string => {
    const d = new Date(now.getTime() + weeks * 7 * 24 * 3600 * 1000);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatShortDateOffset = (weeks: number): string => {
    if (weeks === 0) return 'Now';
    const d = new Date(now.getTime() + weeks * 7 * 24 * 3600 * 1000);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const projectedCompletionDate = formatDateOffset(expectedWeeks);

  // Build synchronized future curve points out to conservativeWeeks (capped neatly)
  const maxCurveWeek = Math.min(52, Math.max(expectedWeeks, acceleratedWeeks, Math.min(conservativeWeeks, expectedWeeks + 4)));
  const projectedCurve: ProjectionCurvePoint[] = [];
  const stepWeeks = maxCurveWeek <= 14 ? 1 : maxCurveWeek <= 28 ? 2 : 3;

  for (let w = 0; w <= maxCurveWeek; w += stepWeeks) {
    const expVal = expectedSim.curveSeconds[Math.min(w, expectedSim.curveSeconds.length - 1)] ?? targetTotalSec;
    const accVal = acceleratedSim.curveSeconds[Math.min(w, acceleratedSim.curveSeconds.length - 1)] ?? targetTotalSec;
    const conVal = conservativeSim.curveSeconds[Math.min(w, conservativeSim.curveSeconds.length - 1)] ?? targetTotalSec;
    projectedCurve.push({
      weekOffset: w,
      dateLabel: formatShortDateOffset(w),
      expectedSec: expVal,
      acceleratedSec: accVal,
      conservativeSec: conVal,
    });
  }
  if (projectedCurve[projectedCurve.length - 1]?.weekOffset !== expectedWeeks && expectedWeeks <= 52) {
    projectedCurve.push({
      weekOffset: expectedWeeks,
      dateLabel: formatShortDateOffset(expectedWeeks),
      expectedSec: targetTotalSec,
      acceleratedSec: targetTotalSec,
      conservativeSec: conservativeSim.curveSeconds[Math.min(expectedWeeks, conservativeSim.curveSeconds.length - 1)] ?? targetTotalSec,
    });
    projectedCurve.sort((a, b) => a.weekOffset - b.weekOffset);
  }

  // Milestone checkpoints: Now, 1/3, 2/3, and Final Goal directly from non-linear curve
  const milestones: GoalMilestone[] = [
    {
      weekNumber: 0,
      projectedDate: 'Current Benchmark',
      projectedTimeSeconds: effectiveCurrentSec,
      projectedPaceSecPerKm: effectiveCurrentSec / targetDist,
      notes: bestSelection.basisRun
        ? `Based on ${bestSelection.basisRun.title}`
        : 'Starting performance benchmark',
    },
  ];

  if (expectedWeeks > 2) {
    const mid1 = Math.max(1, Math.round(expectedWeeks * 0.33));
    const timeMid1 = Math.max(
      targetTotalSec,
      expectedSim.curveSeconds[Math.min(mid1, expectedSim.curveSeconds.length - 1)] || effectiveCurrentSec
    );
    milestones.push({
      weekNumber: mid1,
      projectedDate: formatDateOffset(mid1),
      projectedTimeSeconds: timeMid1,
      projectedPaceSecPerKm: timeMid1 / targetDist,
      notes: 'Threshold capacity & aerobic adaptation',
    });

    const mid2 = Math.max(mid1 + 1, Math.round(expectedWeeks * 0.66));
    if (mid2 < expectedWeeks) {
      const timeMid2 = Math.max(
        targetTotalSec,
        expectedSim.curveSeconds[Math.min(mid2, expectedSim.curveSeconds.length - 1)] || effectiveCurrentSec
      );
      milestones.push({
        weekNumber: mid2,
        projectedDate: formatDateOffset(mid2),
        projectedTimeSeconds: timeMid2,
        projectedPaceSecPerKm: timeMid2 / targetDist,
        notes: 'Race-pace interval conditioning',
      });
    }
  }

  milestones.push({
    weekNumber: expectedWeeks,
    projectedDate: projectedCompletionDate,
    projectedTimeSeconds: targetTotalSec,
    projectedPaceSecPerKm: targetTotalSec / targetDist,
    notes: `Projected ${targetDist}K Target Hit!`,
  });

  return {
    hasTarget: true,
    hasData: true,
    isAchieved: false,
    targetDistanceKm: targetDist,
    targetTimeSeconds: targetTotalSec,
    currentBestSeconds: effectiveCurrentSec,
    gapSeconds,
    estimatedWeeks: expectedWeeks,
    projectedCompletionDate,
    weeklyImprovementSeconds: expectedRate,
    confidence,
    basisDescription,
    milestones,
    historyPoints,
    allRunsHistoryPoints,
    projectedCurve,
    improvementSummary,
    recentRunsPerWeek,
    scenarios: {
      accelerated: {
        weeks: acceleratedWeeks,
        date: formatDateOffset(acceleratedWeeks),
        weeklyRateSec: acceleratedRate,
      },
      expected: {
        weeks: expectedWeeks,
        date: projectedCompletionDate,
        weeklyRateSec: expectedRate,
      },
      conservative: {
        weeks: conservativeWeeks,
        date: formatDateOffset(conservativeWeeks),
        weeklyRateSec: conservativeRate,
      },
    },
  };
}

export interface IntervalCalculationParams {
  totalDurationSeconds: number;
  totalDistanceKm?: number;
  repCount: number;
  repDistanceMeters: number;
  restDurationSeconds?: number;
  totalRestSeconds?: number;
  targetPaceSecPerKm?: number;
}

export interface IntervalCalculationResult {
  workDistanceKm: number;
  totalRestSeconds: number;
  activeWorkDurationSeconds: number;
  activeIntervalPaceSecPerKm: number;
  targetPaceSecPerKm?: number;
  paceDifferenceSeconds?: number;
  isPaceMet?: boolean;
  restDeductionFormatted: string;
  activePaceFormatted: string;
  targetPaceFormatted: string;
  summaryText: string;
}

export function calculateIntervalMetrics(params: IntervalCalculationParams, unit: 'km' | 'miles' = 'km'): IntervalCalculationResult {
  const {
    totalDurationSeconds,
    repCount,
    repDistanceMeters,
    restDurationSeconds = 0,
    targetPaceSecPerKm,
  } = params;

  const validRepCount = Math.max(1, repCount || 1);
  const validRepDistance = Math.max(50, repDistanceMeters || 1000);
  const workDistanceKm = (validRepCount * validRepDistance) / 1000;

  // Calculate total rest seconds: either user explicit total rest or restDuration * (reps - 1)
  const calcTotalRest = params.totalRestSeconds !== undefined
    ? Math.max(0, params.totalRestSeconds)
    : Math.max(0, (validRepCount > 1 ? validRepCount - 1 : 1) * (restDurationSeconds || 0));

  // Active duration stripping rest out, bounded by total duration
  const activeWorkDurationSeconds = Math.max(10, Math.min(totalDurationSeconds, totalDurationSeconds - calcTotalRest));
  const activeIntervalPaceSecPerKm = Math.round(activeWorkDurationSeconds / workDistanceKm);

  let paceDifferenceSeconds: number | undefined = undefined;
  let isPaceMet: boolean | undefined = undefined;

  if (targetPaceSecPerKm && targetPaceSecPerKm > 0) {
    paceDifferenceSeconds = Math.round(activeIntervalPaceSecPerKm - targetPaceSecPerKm);
    isPaceMet = paceDifferenceSeconds <= 0;
  }

  const restDeductionFormatted = formatDuration(calcTotalRest);
  const activePaceFormatted = formatPace(activeIntervalPaceSecPerKm, unit);
  const targetPaceFormatted = targetPaceSecPerKm ? formatPace(targetPaceSecPerKm, unit) : '--:--';

  const summaryText = `${validRepCount} × ${validRepDistance >= 1000 ? `${(validRepDistance / 1000).toFixed(1)}k` : `${validRepDistance}m`} (${formatDuration(restDurationSeconds)} rest)`;

  return {
    workDistanceKm: Number(workDistanceKm.toFixed(2)),
    totalRestSeconds: calcTotalRest,
    activeWorkDurationSeconds,
    activeIntervalPaceSecPerKm,
    targetPaceSecPerKm,
    paceDifferenceSeconds,
    isPaceMet,
    restDeductionFormatted,
    activePaceFormatted,
    targetPaceFormatted,
    summaryText,
  };
}

export interface RealImprovementMetrics {
  hasEnoughData: boolean;
  statusText: string;
  totalRunsAnalyzed: number;
  distinctDaysCount: number;
  daysSpan: number;
  weeklyImprovementSeconds?: number;
  paceImprovementSecPerKm?: number;
  currentPaceBaselineSecPerKm?: number;
  basisDescription: string;
  trend: 'improving' | 'steady' | 'building' | 'insufficient';
  suggestedIntervalPaceFormatted?: string;
  suggestedTempoPaceFormatted?: string;
  suggestedLongRunPaceFormatted?: string;
}

export interface SuggestedSlotSchedule {
  id: 'interval' | 'tempo' | 'long_run' | 'recovery';
  slotNumber: number;
  name: string;
  category: string;
  suggestedDistanceKm: number;
  suggestedDistanceFormatted: string;
  percentageOfWeekly: number;
  structure: string;
  purpose: string;
  suggestedPaceFormatted?: string;
}

export interface SuggestedWeeklySchedulePlan {
  weeklyDistanceKm: number;
  weeklyDistanceFormatted: string;
  weeklyRunGoal: number;
  slots: SuggestedSlotSchedule[];
  totalSuggestedKm: number;
  improvement: RealImprovementMetrics;
}

export function calculateRealImprovement(
  runs: RunRecord[] = [],
  unit: 'km' | 'miles' = 'km',
  targetGoalDistanceKm: number = 6.0
): RealImprovementMetrics {
  const validRuns = runs
    .filter((r) => r.distanceKm >= 0.5 && r.durationSeconds >= 60 && !isNaN(new Date(r.date).getTime()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const distinctDays = new Set(validRuns.map((r) => r.date));

  // If there is not real data from at least 2 distinct days, explicitly state 'Not enough data yet'
  if (validRuns.length < 2 || distinctDays.size < 2) {
    return {
      hasEnoughData: false,
      statusText: 'Not enough data yet',
      totalRunsAnalyzed: validRuns.length,
      distinctDaysCount: distinctDays.size,
      daysSpan: 0,
      basisDescription: 'Requires at least 2 recorded workouts across separate days to measure real pace and performance improvement.',
      trend: 'insufficient',
    };
  }

  const firstDate = new Date(validRuns[0].date).getTime();
  const lastDate = new Date(validRuns[validRuns.length - 1].date).getTime();
  const daysSpan = Math.max(1, Math.round((lastDate - firstDate) / (1000 * 3600 * 24)));
  const weeksSpan = Math.max(0.5, daysSpan / 7);

  // Divide into earliest half and latest half to compute empirical pace adaptation
  const midPoint = Math.max(1, Math.floor(validRuns.length / 2));
  const earlySlice = validRuns.slice(0, midPoint);
  const lateSlice = validRuns.slice(midPoint);

  const equivalentPaceOfRun = (r: RunRecord) => {
    const eqTotal = calculateTargetDistanceEquivalent(r.distanceKm, r.durationSeconds, targetGoalDistanceKm);
    return eqTotal > 0 ? eqTotal / targetGoalDistanceKm : r.durationSeconds / Math.max(0.1, r.distanceKm);
  };

  const earlyTotalDist = earlySlice.reduce((s, r) => s + r.distanceKm, 0);
  const earlyWeightedSec = earlySlice.reduce((s, r) => s + equivalentPaceOfRun(r) * r.distanceKm, 0);
  const earlyAvgPace = earlyTotalDist > 0 ? earlyWeightedSec / earlyTotalDist : 0;

  const lateTotalDist = lateSlice.reduce((s, r) => s + r.distanceKm, 0);
  const lateWeightedSec = lateSlice.reduce((s, r) => s + equivalentPaceOfRun(r) * r.distanceKm, 0);
  const lateAvgPace = lateTotalDist > 0 ? lateWeightedSec / lateTotalDist : 0;

  // Pace improvement: early pace minus late pace (positive = getting faster in sec/km)
  const paceDiffSecPerKm = earlyAvgPace - lateAvgPace;
  const weeklyPaceRate = paceDiffSecPerKm / weeksSpan;
  const weekly6kRate = Math.round(weeklyPaceRate * targetGoalDistanceKm);

  const currentPaceBaselineSecPerKm = Math.round(lateAvgPace);
  const intervalPaceSec = Math.max(150, currentPaceBaselineSecPerKm - 20); // ~20s faster than projected race pace
  const tempoPaceSec = Math.max(160, currentPaceBaselineSecPerKm + 5);    // ~threshold effort
  const longRunPaceSec = Math.max(180, currentPaceBaselineSecPerKm + 50); // ~aerobic Zone 2

  let trend: 'improving' | 'steady' | 'building' = 'steady';
  let statusText = 'Pacing consistent across logged runs';

  if (weeklyPaceRate >= 0.5) {
    trend = 'improving';
    const rateFormatted = Math.abs(weeklyPaceRate).toFixed(1);
    statusText = `Improving ~${rateFormatted}s/km per week across ${validRuns.length} workouts`;
  } else if (weeklyPaceRate <= -0.5) {
    trend = 'building';
    const rateFormatted = Math.abs(weeklyPaceRate).toFixed(1);
    statusText = `Volume building (+${rateFormatted}s/km endurance base) across ${validRuns.length} workouts`;
  } else {
    trend = 'steady';
    statusText = `Consistent benchmark pace (${formatPace(currentPaceBaselineSecPerKm, unit)}) across ${validRuns.length} workouts`;
  }

  return {
    hasEnoughData: true,
    statusText,
    totalRunsAnalyzed: validRuns.length,
    distinctDaysCount: distinctDays.size,
    daysSpan,
    weeklyImprovementSeconds: weekly6kRate,
    paceImprovementSecPerKm: Number(weeklyPaceRate.toFixed(1)),
    currentPaceBaselineSecPerKm,
    basisDescription: `Calibrated from ${validRuns.length} real workouts logged over ${daysSpan} days (${weeksSpan.toFixed(1)} weeks).`,
    trend,
    suggestedIntervalPaceFormatted: formatPace(intervalPaceSec, unit),
    suggestedTempoPaceFormatted: formatPace(tempoPaceSec, unit),
    suggestedLongRunPaceFormatted: formatPace(longRunPaceSec, unit),
  };
}

export function getSuggestedWeeklySchedule(
  weeklyDistanceGoalKm?: number | null,
  weeklyRunGoal: number = 3,
  unit: 'km' | 'miles' = 'km',
  targetGoalDistanceKm: number = 6.0,
  runs?: RunRecord[]
): SuggestedWeeklySchedulePlan {
  const improvement = calculateRealImprovement(runs || [], unit, targetGoalDistanceKm);

  // If no weekly distance goal is set, suggest a baseline: 25 km (~15.5 mi) for 3 runs, or 8 km per run
  const effectiveWeeklyKm = Math.max(
    5,
    weeklyDistanceGoalKm && weeklyDistanceGoalKm > 0
      ? weeklyDistanceGoalKm
      : Math.max(15, weeklyRunGoal * 8)
  );

  const runsCount = Math.max(1, Math.min(14, weeklyRunGoal));
  const slots: SuggestedSlotSchedule[] = [];

  if (runsCount <= 3) {
    // Standard 3-Session Cross Country Microcycle:
    // Slot 1: Intervals (~24% of weekly volume)
    // Slot 2: Lactate Threshold Tempo (~30% of weekly volume)
    // Slot 3: Aerobic Long Run (~46% of weekly volume, balancing to exact 100%)
    const intervalKm = Number(Math.max(3.0, Number((effectiveWeeklyKm * 0.24).toFixed(1))));
    const tempoKm = Number(Math.max(4.0, Number((effectiveWeeklyKm * 0.30).toFixed(1))));
    const longRunKm = Number(Math.max(5.0, Number((effectiveWeeklyKm - intervalKm - tempoKm).toFixed(1))));

    // Interval workout structure based on volume:
    const intervalReps =
      intervalKm >= 10
        ? '6 × 1000m'
        : intervalKm >= 7
        ? '5 × 1000m'
        : intervalKm >= 5
        ? '5 × 800m'
        : '4 × 600m';
    const intervalStructure = `1.5 km warm-up + ${intervalReps} @ 6K pace + 1.5 km cool-down`;

    const tempoWorkDist = Math.max(3.0, tempoKm - 2.0);
    const tempoStructure = `1.0 km warm-up + ${tempoWorkDist.toFixed(1)} km continuous tempo + 1.0 km cool-down`;

    slots.push({
      id: 'interval',
      slotNumber: 1,
      name: 'Interval Workout',
      category: 'Speed & VO2 Max',
      suggestedDistanceKm: intervalKm,
      suggestedDistanceFormatted:
        unit === 'miles' ? `${(intervalKm * KM_TO_MILES).toFixed(1)} mi` : `${intervalKm.toFixed(1)} km`,
      percentageOfWeekly: Math.round((intervalKm / effectiveWeeklyKm) * 100),
      structure: intervalStructure,
      purpose: 'Develops biomechanical stride efficiency and maximum aerobic oxygen uptake (VO2 max)',
      suggestedPaceFormatted: improvement.hasEnoughData ? improvement.suggestedIntervalPaceFormatted : undefined,
    });

    slots.push({
      id: 'tempo',
      slotNumber: 2,
      name: 'Threshold Tempo',
      category: 'Lactate Clearance',
      suggestedDistanceKm: tempoKm,
      suggestedDistanceFormatted:
        unit === 'miles' ? `${(tempoKm * KM_TO_MILES).toFixed(1)} mi` : `${tempoKm.toFixed(1)} km`,
      percentageOfWeekly: Math.round((tempoKm / effectiveWeeklyKm) * 100),
      structure: tempoStructure,
      purpose: 'Raises anaerobic lactate threshold to eliminate late-race muscular fatigue',
      suggestedPaceFormatted: improvement.hasEnoughData ? improvement.suggestedTempoPaceFormatted : undefined,
    });

    slots.push({
      id: 'long_run',
      slotNumber: 3,
      name: 'Aerobic Long Run',
      category: 'Endurance Base',
      suggestedDistanceKm: longRunKm,
      suggestedDistanceFormatted:
        unit === 'miles' ? `${(longRunKm * KM_TO_MILES).toFixed(1)} mi` : `${longRunKm.toFixed(1)} km`,
      percentageOfWeekly: Math.round((longRunKm / effectiveWeeklyKm) * 100),
      structure: 'Continuous relaxed conversational effort over rolling trails, grass, or turf',
      purpose: 'Builds cardiac stroke volume, mitochondrial density, and mental race grit',
      suggestedPaceFormatted: improvement.hasEnoughData ? improvement.suggestedLongRunPaceFormatted : undefined,
    });
  } else {
    // 4+ runs per week: includes recovery / easy runs
    const intervalKm = Number(Math.max(3.0, Number((effectiveWeeklyKm * 0.20).toFixed(1))));
    const tempoKm = Number(Math.max(4.0, Number((effectiveWeeklyKm * 0.25).toFixed(1))));
    const longRunKm = Number(Math.max(6.0, Number((effectiveWeeklyKm * 0.35).toFixed(1))));
    const remainingKm = Number(
      Math.max(2.0, Number((effectiveWeeklyKm - intervalKm - tempoKm - longRunKm).toFixed(1)))
    );
    const easyDaysCount = runsCount - 3;
    const easyPerDayKm = Number((remainingKm / easyDaysCount).toFixed(1));

    slots.push({
      id: 'interval',
      slotNumber: 1,
      name: 'Interval Workout',
      category: 'Speed & VO2 Max',
      suggestedDistanceKm: intervalKm,
      suggestedDistanceFormatted:
        unit === 'miles' ? `${(intervalKm * KM_TO_MILES).toFixed(1)} mi` : `${intervalKm.toFixed(1)} km`,
      percentageOfWeekly: Math.round((intervalKm / effectiveWeeklyKm) * 100),
      structure: `1.5 km warm-up + 5 × 800m–1000m @ goal pace + 1.5 km cool-down`,
      purpose: 'Develops biomechanical turnover and top aerobic power',
      suggestedPaceFormatted: improvement.hasEnoughData ? improvement.suggestedIntervalPaceFormatted : undefined,
    });

    slots.push({
      id: 'tempo',
      slotNumber: 2,
      name: 'Threshold Tempo',
      category: 'Lactate Clearance',
      suggestedDistanceKm: tempoKm,
      suggestedDistanceFormatted:
        unit === 'miles' ? `${(tempoKm * KM_TO_MILES).toFixed(1)} mi` : `${tempoKm.toFixed(1)} km`,
      percentageOfWeekly: Math.round((tempoKm / effectiveWeeklyKm) * 100),
      structure: `1.0 km warm-up + ${(tempoKm - 2).toFixed(1)} km tempo + 1.0 km cool-down`,
      purpose: 'Elevates lactate threshold capacity for sustained pacing',
      suggestedPaceFormatted: improvement.hasEnoughData ? improvement.suggestedTempoPaceFormatted : undefined,
    });

    slots.push({
      id: 'long_run',
      slotNumber: 3,
      name: 'Aerobic Long Run',
      category: 'Endurance Base',
      suggestedDistanceKm: longRunKm,
      suggestedDistanceFormatted:
        unit === 'miles' ? `${(longRunKm * KM_TO_MILES).toFixed(1)} mi` : `${longRunKm.toFixed(1)} km`,
      percentageOfWeekly: Math.round((longRunKm / effectiveWeeklyKm) * 100),
      structure: 'Steady aerobic endurance run over natural terrain',
      purpose: 'Builds cellular capillary bed density and stamina',
      suggestedPaceFormatted: improvement.hasEnoughData ? improvement.suggestedLongRunPaceFormatted : undefined,
    });

    for (let i = 0; i < easyDaysCount; i++) {
      slots.push({
        id: 'recovery',
        slotNumber: 4 + i,
        name: `Easy Recovery Run ${i + 1}`,
        category: 'Active Recovery',
        suggestedDistanceKm: easyPerDayKm,
        suggestedDistanceFormatted:
          unit === 'miles' ? `${(easyPerDayKm * KM_TO_MILES).toFixed(1)} mi` : `${easyPerDayKm.toFixed(1)} km`,
        percentageOfWeekly: Math.round((easyPerDayKm / effectiveWeeklyKm) * 100),
        structure: 'Very relaxed conversational jog to promote blood flow and tissue recovery',
        purpose: 'Facilitates musculoskeletal repair without adding neural fatigue',
        suggestedPaceFormatted: improvement.hasEnoughData ? improvement.suggestedLongRunPaceFormatted : undefined,
      });
    }
  }

  const totalSuggested = Number(slots.reduce((sum, s) => sum + s.suggestedDistanceKm, 0).toFixed(1));

  return {
    weeklyDistanceKm: effectiveWeeklyKm,
    weeklyDistanceFormatted:
      unit === 'miles' ? `${(effectiveWeeklyKm * KM_TO_MILES).toFixed(1)} mi` : `${effectiveWeeklyKm.toFixed(1)} km`,
    weeklyRunGoal: runsCount,
    slots,
    totalSuggestedKm: totalSuggested,
    improvement,
  };
}

export interface MonthWeekSummary {
  weekKey: string;
  weekIndex: number;
  weekLabel: string;
  dateRangeLabel: string;
  startDate: string;
  endDate: string;
  totalDistanceKm: number;
  targetDistanceKm: number;
  runsCount: number;
  targetRuns: number;
  goalMet: boolean;
  distanceMet: boolean;
  hillRunsCount: number;
  elevationGainMeters: number;
  runs: RunRecord[];
}

export interface MonthlyConsistencySummary {
  monthKey: string;
  monthName: string;
  year: number;
  monthTitle: string;
  totalDistanceKm: number;
  monthlyDistanceGoalKm: number;
  distanceProgressPct: number;
  totalRuns: number;
  monthlyRunsGoal: number;
  runsProgressPct: number;
  avgPaceSecPerKm: number;
  totalDurationSeconds: number;
  totalElevationGainMeters: number;
  hillRunsCount: number;
  hillWorkouts: RunRecord[];
  weeks: MonthWeekSummary[];
  weeksMetCount: number;
  totalWeeksInMonth: number;
  consistencyPercentage: number;
  consistencyGrade: 'Elite Consistency' | 'High Consistency' | 'Solid Consistency' | 'Building Consistency';
  consistencyMessage: string;
  runs: RunRecord[];
}

export function calculateMonthlyConsistency(
  runs: RunRecord[],
  effectiveWeeklyGoalKm: number = 25,
  weeklyRunGoal: number = 3,
  referenceDate: Date = new Date(),
  monthOffset: number = 0
): MonthlyConsistencySummary {
  const target = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + monthOffset, 1);
  const year = target.getFullYear();
  const monthIdx = target.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[monthIdx];
  const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  const monthTitle = `${monthName} ${year}`;

  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, monthIdx, 1);
  const lastDayOfMonth = new Date(year, monthIdx, daysInMonth, 23, 59, 59, 999);

  const monthRuns = runs.filter((r) => {
    const d = parseDateSafe(r.date);
    return d.getFullYear() === year && d.getMonth() === monthIdx;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalDistanceKm = Number(monthRuns.reduce((sum, r) => sum + r.distanceKm, 0).toFixed(1));
  const totalDurationSeconds = monthRuns.reduce((sum, r) => sum + r.durationSeconds, 0);
  const totalRuns = monthRuns.length;
  const avgPaceSecPerKm = totalDistanceKm > 0 ? Math.round(totalDurationSeconds / totalDistanceKm) : 0;

  const weeksCountFactor = daysInMonth / 7;
  const monthlyDistanceGoalKm = Math.round(effectiveWeeklyGoalKm * weeksCountFactor);
  const monthlyRunsGoal = Math.round(weeklyRunGoal * weeksCountFactor);
  const distanceProgressPct = monthlyDistanceGoalKm > 0
    ? Math.min(100, Math.round((totalDistanceKm / monthlyDistanceGoalKm) * 100))
    : 0;
  const runsProgressPct = monthlyRunsGoal > 0
    ? Math.min(100, Math.round((totalRuns / monthlyRunsGoal) * 100))
    : 0;

  const hillWorkouts = monthRuns.filter((r) => isHillRun(r.runType, r.title));
  const hillRunsCount = hillWorkouts.length;
  const totalElevationGainMeters = monthRuns.reduce((sum, r) => sum + (r.elevationGainMeters || 0), 0);

  const weeks: MonthWeekSummary[] = [];
  const shortMonth = monthNames[monthIdx].slice(0, 3);

  // 4 actual calendar weeks in the month (eliminating single-day Nov 1-1 / Nov 30-30 glitches):
  // Week 1: Days 1 – 7
  // Week 2: Days 8 – 14
  // Week 3: Days 15 – 21
  // Week 4: Days 22 – end of month
  const weekRanges = [
    { startDay: 1, endDay: 7 },
    { startDay: 8, endDay: 14 },
    { startDay: 15, endDay: 21 },
    { startDay: 22, endDay: daysInMonth },
  ];

  weekRanges.forEach((range, idx) => {
    const weekIndex = idx + 1;
    const startDay = range.startDay;
    const endDay = range.endDay;

    const startStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const endStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    const dateRangeLabel = `${shortMonth} ${startDay} – ${shortMonth} ${endDay}`;

    const weekRuns = monthRuns.filter((r) => {
      const d = parseDateSafe(r.date);
      const day = d.getDate();
      return day >= startDay && day <= endDay;
    });

    const weekDist = Number(weekRuns.reduce((s, r) => s + r.distanceKm, 0).toFixed(1));
    const weekHills = weekRuns.filter((r) => isHillRun(r.runType, r.title)).length;
    const weekElev = weekRuns.reduce((s, r) => s + (r.elevationGainMeters || 0), 0);

    const goalMet = weekRuns.length >= weeklyRunGoal;
    const distanceMet = weekDist >= effectiveWeeklyGoalKm;

    weeks.push({
      weekKey: `${year}-M${monthIdx + 1}-W${weekIndex}`,
      weekIndex,
      weekLabel: `Week ${weekIndex}`,
      dateRangeLabel,
      startDate: startStr,
      endDate: endStr,
      totalDistanceKm: weekDist,
      targetDistanceKm: effectiveWeeklyGoalKm,
      runsCount: weekRuns.length,
      targetRuns: weeklyRunGoal,
      goalMet,
      distanceMet,
      hillRunsCount: weekHills,
      elevationGainMeters: weekElev,
      runs: weekRuns,
    });
  });

  const weeksMetCount = weeks.filter((w) => w.goalMet).length;
  const totalWeeksInMonth = weeks.length;
  const consistencyPercentage = totalWeeksInMonth > 0 ? Math.round((weeksMetCount / totalWeeksInMonth) * 100) : 0;

  let consistencyGrade: 'Elite Consistency' | 'High Consistency' | 'Solid Consistency' | 'Building Consistency' = 'Building Consistency';
  let consistencyMessage = 'Building weekly microcycle foundation toward monthly mileage';

  if (consistencyPercentage === 100 && totalRuns >= monthlyRunsGoal) {
    consistencyGrade = 'Elite Consistency';
    consistencyMessage = 'Flawless execution! Goal met every single week of the month';
  } else if (consistencyPercentage >= 75) {
    consistencyGrade = 'High Consistency';
    consistencyMessage = 'Strong regular microcycles with dependable weekly volume';
  } else if (consistencyPercentage >= 50) {
    consistencyGrade = 'Solid Consistency';
    consistencyMessage = 'Good aerobic base building with regular training sessions';
  } else {
    consistencyGrade = 'Building Consistency';
    consistencyMessage = 'Early microcycle momentum. Stay consistent to hit monthly targets';
  }

  return {
    monthKey,
    monthName,
    year,
    monthTitle,
    totalDistanceKm,
    monthlyDistanceGoalKm,
    distanceProgressPct,
    totalRuns,
    monthlyRunsGoal,
    runsProgressPct,
    avgPaceSecPerKm,
    totalDurationSeconds,
    totalElevationGainMeters,
    hillRunsCount,
    hillWorkouts,
    weeks,
    weeksMetCount,
    totalWeeksInMonth,
    consistencyPercentage,
    consistencyGrade,
    consistencyMessage,
    runs: monthRuns,
  };
}

export type CardioLoadPhase =
  | 'Calibrating'
  | 'Detraining'
  | 'Maintaining'
  | 'Improving'
  | 'Overtraining';

export interface CardioLoadDayPoint {
  date: string; // YYYY-MM-DD
  shortLabel: string; // e.g., "Nov 12"
  dailyLoad: number;
  acuteLoad: number;
  chronicLoad: number;
  acwrRatio: number;
  targetMin: number;
  targetMax: number;
  overtrainingThreshold: number;
  improvingThreshold: number;
  detrainingThreshold: number;
  phase: CardioLoadPhase;
  runsCount: number;
  runTitles: string[];
}

export interface CardioLoadAnalysis {
  hasRuns: boolean;
  currentPhase: CardioLoadPhase;
  todayLoad: number;
  acuteLoad: number;
  chronicLoad: number;
  acwrRatio: number;
  targetRangeMin: number;
  targetRangeMax: number;
  calibrationDaysLogged: number;
  calibrationDaysRequired: number;
  totalWindowRuns: number;
  guidanceText: string;
  phaseCounts: Record<CardioLoadPhase, number>;
  points: CardioLoadDayPoint[];
}

/**
 * Computes single-session Cardio Load aligned with duration, distance, heart rate, and run intensity.
 */
export function calculateRunCardioLoad(
  run: RunRecord,
  maxHeartRate: number = 190
): number {
  const durationMin = (run.durationSeconds || 0) / 60;
  const distanceKm = run.distanceKm || 0;
  if (durationMin <= 0 && distanceKm <= 0) return 0;

  let typeMultiplier = 1.0;
  switch (run.runType) {
    case 'Race':
      typeMultiplier = 1.55;
      break;
    case '6K Time Trial':
    case 'Time Trial':
      typeMultiplier = 1.50;
      break;
    case 'Interval Training':
    case 'Intervals':
      typeMultiplier = 1.40;
      break;
    case 'Hill Repeats':
      typeMultiplier = 1.38;
      break;
    case 'Tempo':
      typeMultiplier = 1.25;
      break;
    case 'Long Run':
      typeMultiplier = 1.20;
      break;
    case 'Hill Run':
      typeMultiplier = 1.18;
      break;
    case 'Recovery':
      typeMultiplier = 0.75;
      break;
    case 'Easy':
    case 'Aerobic':
    default:
      typeMultiplier = 0.90;
      break;
  }

  let hrFactor = 1.0;
  if (run.avgHeartRate && run.avgHeartRate > 50) {
    const hrRatio = run.avgHeartRate / Math.max(120, maxHeartRate);
    if (hrRatio >= 0.90) hrFactor = 1.35;
    else if (hrRatio >= 0.82) hrFactor = 1.20;
    else if (hrRatio >= 0.72) hrFactor = 1.05;
    else hrFactor = 0.85;
  }

  let paceFactor = 1.0;
  if (run.averagePaceSecPerKm && run.averagePaceSecPerKm > 0) {
    if (run.averagePaceSecPerKm < 240) paceFactor = 1.15;
    else if (run.averagePaceSecPerKm < 270) paceFactor = 1.08;
  }

  const rawLoad = (durationMin * 0.85 + distanceKm * 2.6) * (typeMultiplier * hrFactor * paceFactor);
  return Math.max(8, Math.round(rawLoad));
}

/**
 * Computes Fitbit-style rolling Cardio Load across a time window (14/28/42 days),
 * mapping Acute vs. Chronic Training Load into Calibrating, Detraining, Maintaining,
 * Improving, and Overtraining phases.
 */
export function calculateCardioLoadAnalysis(
  runs: RunRecord[] = [],
  windowDays: number = 28,
  referenceDate: Date = new Date(),
  maxHeartRate: number = 190
): CardioLoadAnalysis {
  const CALIBRATION_DAYS_REQUIRED = 7;
  const CALIBRATION_MIN_RUNS = 3;
  const effectiveWindowDays = Math.max(7, Math.min(60, windowDays));

  const endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 12, 0, 0);
  const endYmd = formatLocalDateString(endDate);

  const emptyPhaseCounts: Record<CardioLoadPhase, number> = {
    Calibrating: 0,
    Detraining: 0,
    Maintaining: 0,
    Improving: 0,
    Overtraining: 0,
  };

  if (!runs || runs.length === 0) {
    const emptyPoints: CardioLoadDayPoint[] = [];
    for (let i = effectiveWindowDays - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      emptyPoints.push({
        date: formatLocalDateString(d),
        shortLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dailyLoad: 0,
        acuteLoad: 0,
        chronicLoad: 0,
        acwrRatio: 1,
        targetMin: 0,
        targetMax: 0,
        overtrainingThreshold: 0,
        improvingThreshold: 0,
        detrainingThreshold: 0,
        phase: 'Calibrating',
        runsCount: 0,
        runTitles: [],
      });
      emptyPhaseCounts.Calibrating++;
    }

    return {
      hasRuns: false,
      currentPhase: 'Calibrating',
      todayLoad: 0,
      acuteLoad: 0,
      chronicLoad: 0,
      acwrRatio: 1,
      targetRangeMin: 0,
      targetRangeMax: 0,
      calibrationDaysLogged: 0,
      calibrationDaysRequired: CALIBRATION_DAYS_REQUIRED,
      totalWindowRuns: 0,
      guidanceText: 'Log at least 3 runs across 7+ days to finish calibrating your personal Cardio Load baseline.',
      phaseCounts: emptyPhaseCounts,
      points: emptyPoints,
    };
  }

  // Group runs by YYYY-MM-DD up to endDate
  const runsByDay = new Map<string, { load: number; titles: string[]; count: number }>();
  let earliestRunDate: Date | null = null;

  for (const r of runs) {
    const parsed = parseDateSafe(r.date);
    const dayDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0);
    if (dayDate.getTime() > endDate.getTime()) continue;

    const ymd = formatLocalDateString(dayDate);
    if (!earliestRunDate || dayDate.getTime() < earliestRunDate.getTime()) {
      earliestRunDate = dayDate;
    }

    const load = calculateRunCardioLoad(r, maxHeartRate);
    const existing = runsByDay.get(ymd) || { load: 0, titles: [], count: 0 };
    existing.load += load;
    existing.count += 1;
    if (r.title) existing.titles.push(r.title);
    runsByDay.set(ymd, existing);
  }

  if (!earliestRunDate) {
    return calculateCardioLoadAnalysis([], windowDays, referenceDate, maxHeartRate);
  }

  // Simulate daily EWMA starting from earliest run (up to 60 days prior to endDate for warm baseline)
  const maxLookbackDate = new Date(endDate);
  maxLookbackDate.setDate(maxLookbackDate.getDate() - (effectiveWindowDays + 35));
  const simStart = earliestRunDate.getTime() < maxLookbackDate.getTime() ? maxLookbackDate : earliestRunDate;

  const windowStartDate = new Date(endDate);
  windowStartDate.setDate(windowStartDate.getDate() - (effectiveWindowDays - 1));
  const windowStartMs = windowStartDate.getTime();

  const alphaAcute = 2 / (7 + 1); // 0.25 (7-day acute load)
  const alphaChronic = 2 / (28 + 1); // ~0.069 (28-day chronic baseline)

  let ewmaAcute = 0;
  let ewmaChronic = 0;
  let cumulativeRuns = 0;
  let initialized = false;

  const points: CardioLoadDayPoint[] = [];
  const phaseCounts: Record<CardioLoadPhase, number> = { ...emptyPhaseCounts };
  let totalWindowRuns = 0;

  // Also ensure the full window [windowStartDate .. endDate] has points even if earliestRunDate is inside the window
  const iterStart = simStart.getTime() < windowStartMs ? simStart : windowStartDate;
  const iterDays = Math.max(
    1,
    Math.round((endDate.getTime() - iterStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  for (let idx = 0; idx < iterDays; idx++) {
    const d = new Date(iterStart);
    d.setDate(d.getDate() + idx);
    const ymd = formatLocalDateString(d);
    const dayEntry = runsByDay.get(ymd);
    const dailyLoad = dayEntry ? dayEntry.load : 0;

    if (dayEntry) {
      cumulativeRuns += dayEntry.count;
    }

    const daysSinceFirstRun = Math.floor((d.getTime() - earliestRunDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (daysSinceFirstRun <= 0) {
      // Day precedes athlete's first logged workout
      if (d.getTime() >= windowStartMs) {
        points.push({
          date: ymd,
          shortLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          dailyLoad: 0,
          acuteLoad: 0,
          chronicLoad: 0,
          acwrRatio: 1,
          targetMin: 0,
          targetMax: 0,
          overtrainingThreshold: 0,
          improvingThreshold: 0,
          detrainingThreshold: 0,
          phase: 'Calibrating',
          runsCount: 0,
          runTitles: [],
        });
        phaseCounts.Calibrating++;
      }
      continue;
    }

    if (!initialized) {
      // Seed baseline smoothly on first run day so day-1 does not trigger false Overtraining
      ewmaAcute = dailyLoad;
      ewmaChronic = Math.max(20, dailyLoad * 0.9);
      initialized = true;
    } else {
      ewmaAcute = dailyLoad * alphaAcute + ewmaAcute * (1 - alphaAcute);
      ewmaChronic = dailyLoad * alphaChronic + ewmaChronic * (1 - alphaChronic);
    }

    const effectiveChronic = Math.max(12, ewmaChronic);
    const acwrRatio = Number((ewmaAcute / effectiveChronic).toFixed(2));
    const isCalibrating = daysSinceFirstRun < CALIBRATION_DAYS_REQUIRED || cumulativeRuns < CALIBRATION_MIN_RUNS;

    let phase: CardioLoadPhase;
    if (isCalibrating) {
      phase = 'Calibrating';
    } else if (acwrRatio < 0.78) {
      phase = 'Detraining';
    } else if (acwrRatio <= 1.05) {
      phase = 'Maintaining';
    } else if (acwrRatio <= 1.32) {
      phase = 'Improving';
    } else {
      phase = 'Overtraining';
    }

    const detrainingThreshold = Math.round(effectiveChronic * 0.78);
    const improvingThreshold = Math.round(effectiveChronic * 1.05);
    const overtrainingThreshold = Math.round(effectiveChronic * 1.32);

    if (d.getTime() >= windowStartMs) {
      if (dayEntry) totalWindowRuns += dayEntry.count;
      phaseCounts[phase]++;
      points.push({
        date: ymd,
        shortLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dailyLoad: Math.round(dailyLoad),
        acuteLoad: Math.round(ewmaAcute),
        chronicLoad: Math.round(effectiveChronic),
        acwrRatio,
        targetMin: detrainingThreshold,
        targetMax: overtrainingThreshold,
        overtrainingThreshold,
        improvingThreshold,
        detrainingThreshold,
        phase,
        runsCount: dayEntry ? dayEntry.count : 0,
        runTitles: dayEntry ? dayEntry.titles : [],
      });
    }
  }

  const latestPoint = points[points.length - 1] || {
    date: endYmd,
    dailyLoad: 0,
    acuteLoad: 0,
    chronicLoad: 0,
    acwrRatio: 1,
    targetMin: 0,
    targetMax: 0,
    phase: 'Calibrating' as CardioLoadPhase,
  };

  const spanDaysTotal = Math.max(
    1,
    Math.floor((endDate.getTime() - earliestRunDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const calibrationDaysLogged = Math.min(CALIBRATION_DAYS_REQUIRED, spanDaysTotal);

  let guidanceText = '';
  switch (latestPoint.phase) {
    case 'Calibrating':
      guidanceText = `Learning your personal cardiovascular baseline (${calibrationDaysLogged}/${CALIBRATION_DAYS_REQUIRED} days, ${runs.length}/${CALIBRATION_MIN_RUNS} runs). Keep logging steady sessions.`;
      break;
    case 'Detraining':
      guidanceText = 'Recent training load has dipped below 78% of your 28-day fitness baseline. Add a steady aerobic or tempo session to avoid fitness loss.';
      break;
    case 'Maintaining':
      guidanceText = 'Your acute load matches your 4-week fitness baseline (0.78x–1.05x). Ideal zone for holding current race fitness steady.';
      break;
    case 'Improving':
      guidanceText = 'Optimal progressive overload (1.05x–1.32x baseline). Building aerobic capacity and race speed safely without excessive strain.';
      break;
    case 'Overtraining':
      guidanceText = 'Acute spike exceeds 1.32x your chronic baseline. Schedule a recovery day or light shakeout to absorb training and avoid overreaching.';
      break;
  }

  return {
    hasRuns: true,
    currentPhase: latestPoint.phase,
    todayLoad: latestPoint.acuteLoad,
    acuteLoad: latestPoint.acuteLoad,
    chronicLoad: latestPoint.chronicLoad,
    acwrRatio: latestPoint.acwrRatio,
    targetRangeMin: latestPoint.targetMin,
    targetRangeMax: latestPoint.targetMax,
    calibrationDaysLogged,
    calibrationDaysRequired: CALIBRATION_DAYS_REQUIRED,
    totalWindowRuns,
    guidanceText,
    phaseCounts,
    points,
  };
}

export interface YraaPlacementEstimate {
  division: YraaDivisionData;
  sourceTimeSeconds: number;
  sourceDistanceKm: number;
  equivalentDivisionTimeSeconds: number;
  wasDistanceConverted: boolean;
  estimatedPlace: number;
  finishersCount: number;
  percentileTop: number; // e.g., 18 means Top 18%
  tierLabel: string;
  nextMilestoneHint: string;
  checkpoints: {
    firstPlaceSec: number;
    top5Sec: number;
    top10Sec: number;
    top25Sec: number;
    medianSec: number;
    lastPlaceSec: number;
  };
}

export function formatOrdinalPlace(place: number): string {
  const n = Math.max(1, Math.round(place));
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function inferDefaultYraaDivision(targetDistanceKm: number = 6.0): YraaDivisionId {
  if (targetDistanceKm <= 4.3) return 'novice_men';
  if (targetDistanceKm <= 5.4) return 'junior_men';
  return 'senior_men';
}

export function estimateYraaPlacement(
  timeSeconds: number,
  sourceDistanceKm: number,
  divisionId: YraaDivisionId
): YraaPlacementEstimate | null {
  const division = YRAA_DIVISIONS[divisionId];
  if (!division || !timeSeconds || timeSeconds <= 0 || !sourceDistanceKm || sourceDistanceKm <= 0) {
    return null;
  }

  const wasDistanceConverted = Math.abs(sourceDistanceKm - division.distanceKm) >= 0.08;
  const equivalentDivisionTimeSeconds = wasDistanceConverted
    ? calculateTargetDistanceEquivalent(sourceDistanceKm, timeSeconds, division.distanceKm)
    : Math.round(timeSeconds);

  const times = division.timesSec;
  const count = times.length;
  let fasterCount = 0;
  for (let i = 0; i < count; i++) {
    if (times[i] < equivalentDivisionTimeSeconds) {
      fasterCount += 1;
    } else {
      break;
    }
  }

  const estimatedPlace = Math.min(count + 1, fasterCount + 1);
  const percentileTop = Math.min(100, Math.max(1, Math.round((estimatedPlace / count) * 100)));

  let tierLabel = 'Finisher Pack';
  if (estimatedPlace === 1) {
    tierLabel = 'Champion Pace (1st)';
  } else if (estimatedPlace <= 3) {
    tierLabel = 'Podium Contender (Top 3)';
  } else if (estimatedPlace <= 10) {
    tierLabel = 'Top 10 Finish';
  } else if (estimatedPlace <= 25 && count >= 40) {
    tierLabel = 'Top 25 Finish';
  } else if (percentileTop <= 25) {
    tierLabel = 'Top Quarter';
  } else if (percentileTop <= 50) {
    tierLabel = 'Top Half';
  } else if (percentileTop <= 75) {
    tierLabel = 'Mid-Pack';
  }

  const firstPlaceSec = times[0];
  const top5Sec = times[Math.min(4, count - 1)];
  const top10Sec = times[Math.min(9, count - 1)];
  const top25Sec = times[Math.min(24, count - 1)];
  const medianSec = times[Math.floor((count - 1) / 2)];
  const lastPlaceSec = times[count - 1];

  let nextMilestoneHint = '';
  if (estimatedPlace === 1) {
    const leadSec = Math.max(0, firstPlaceSec - equivalentDivisionTimeSeconds);
    nextMilestoneHint = leadSec > 0
      ? `${formatDuration(leadSec)} faster than the meet winner (${formatDuration(firstPlaceSec)})`
      : `Matches winning championship pace (${formatDuration(firstPlaceSec)})`;
  } else if (estimatedPlace <= 5) {
    nextMilestoneHint = `${formatDuration(equivalentDivisionTimeSeconds - firstPlaceSec)} off 1st place (${formatDuration(firstPlaceSec)})`;
  } else if (estimatedPlace <= 10) {
    nextMilestoneHint = `${formatDuration(equivalentDivisionTimeSeconds - top5Sec)} away from Top 5`;
  } else if (estimatedPlace <= 25 && count >= 40) {
    nextMilestoneHint = `${formatDuration(equivalentDivisionTimeSeconds - top10Sec)} away from Top 10`;
  } else if (equivalentDivisionTimeSeconds > medianSec) {
    nextMilestoneHint = `${formatDuration(equivalentDivisionTimeSeconds - medianSec)} away from Top 50% (Median)`;
  } else if (count >= 40) {
    nextMilestoneHint = `${formatDuration(equivalentDivisionTimeSeconds - top25Sec)} away from Top 25`;
  } else {
    nextMilestoneHint = `${formatDuration(equivalentDivisionTimeSeconds - firstPlaceSec)} behind 1st place`;
  }

  return {
    division,
    sourceTimeSeconds: Math.round(timeSeconds),
    sourceDistanceKm,
    equivalentDivisionTimeSeconds,
    wasDistanceConverted,
    estimatedPlace,
    finishersCount: count,
    percentileTop,
    tierLabel,
    nextMilestoneHint,
    checkpoints: {
      firstPlaceSec,
      top5Sec,
      top10Sec,
      top25Sec,
      medianSec,
      lastPlaceSec,
    },
  };
}

export interface DistancePredictionItem {
  id: '3k' | '5k' | '6k' | '8k' | '10k' | 'half';
  label: string;
  distanceKm: number;
  predictedSeconds: number;
  predictedPaceSecPerKm: number;
  measuredPredictedSeconds: number;
  goalEquivalentSeconds: number | null;
  exponentUsed: number;
  recommendedWeeklyKm: number;
  readiness: 'Race Ready' | 'Strong Base' | 'Building Base' | 'Needs Mileage';
  isGoalDistance: boolean;
}

export interface MultiDistancePredictionResult {
  hasData: boolean;
  anchorLabel: string;
  anchorDistanceKm: number;
  anchorTimeSeconds: number;
  measuredWeeklyKm: number;
  effectiveWeeklyKm: number;
  measuredRunsPerWeek: number;
  longestRecentRunKm: number;
  enduranceExponent: number;
  volumeTierLabel: string;
  volumeAdjustmentSummary: string;
  predictions: DistancePredictionItem[];
}

function computeVolumeEnduranceExponent(weeklyKm: number): number {
  const km = Math.max(0, weeklyKm);
  if (km <= 15) {
    return Number((1.105 - (km / 15) * 0.013).toFixed(4));
  }
  if (km <= 35) {
    return Number((1.092 - ((km - 15) / 20) * 0.024).toFixed(4));
  }
  if (km <= 60) {
    return Number((1.068 - ((km - 35) / 25) * 0.02).toFixed(4));
  }
  return Number(Math.max(1.04, 1.048 - ((km - 60) / 40) * 0.008).toFixed(4));
}

function predictTimeBetweenDistances(
  sourceDistKm: number,
  sourceSec: number,
  targetDistKm: number,
  weeklyKm: number,
  longestRecentRunKm: number,
  useLongestRunFactor: boolean
): { predictedSec: number; exponentUsed: number } {
  if (sourceDistKm <= 0 || sourceSec <= 0 || targetDistKm <= 0) {
    return { predictedSec: 0, exponentUsed: 1.06 };
  }
  if (Math.abs(targetDistKm - sourceDistKm) < 0.05) {
    return {
      predictedSec: Math.round(sourceSec * (targetDistKm / sourceDistKm)),
      exponentUsed: 1.0,
    };
  }

  let exponent = 1.06;
  if (targetDistKm > sourceDistKm) {
    exponent = computeVolumeEnduranceExponent(weeklyKm);

    if (useLongestRunFactor && longestRecentRunKm > 0) {
      if (targetDistKm >= 15 && longestRecentRunKm < 12) {
        exponent += 0.015;
      } else if (targetDistKm >= 8 && longestRecentRunKm >= 10) {
        exponent -= 0.003;
      }
    }

    if (sourceDistKm < 3.5) {
      const clampedDist = Math.max(0.4, sourceDistKm);
      const shortDistFloor = 1.06 + ((3.5 - clampedDist) / 2.5) * 0.08;
      exponent = Math.max(exponent, shortDistFloor);
    }

    exponent = Math.min(1.16, Math.max(1.038, exponent));
  } else {
    // Predicting shorter speed races (e.g., 3K/5K from 6K): keep standard Riegel speed curve
    exponent = weeklyKm >= 45 ? 1.055 : 1.06;
  }

  const predictedSec = Math.round(sourceSec * Math.pow(targetDistKm / sourceDistKm, exponent));
  return {
    predictedSec,
    exponentUsed: Number(exponent.toFixed(3)),
  };
}

export function calculateMultiDistancePredictions(
  runs: RunRecord[],
  targetDistanceKm: number = 6.0,
  currentPrSeconds?: number | null,
  goalTimeSeconds?: number | null,
  volumeOverrideKmPerWeek?: number | null
): MultiDistancePredictionResult {
  const safeTargetDist = targetDistanceKm > 0 ? targetDistanceKm : 6.0;
  const bestSelection = selectBestTargetEquivalent(runs, safeTargetDist);

  // Determine the cleanest PR anchor (prefer explicit PR or matching qualifying run)
  let anchorDistanceKm = safeTargetDist;
  let anchorTimeSeconds = 0;
  let anchorLabel = '';

  const basisRun = bestSelection.basisRun;
  if (
    basisRun &&
    basisRun.distanceKm > 0 &&
    basisRun.durationSeconds > 0 &&
    (!currentPrSeconds ||
      currentPrSeconds <= 0 ||
      (bestSelection.bestSeconds !== undefined &&
        Math.abs(bestSelection.bestSeconds - currentPrSeconds) <= 3) ||
      (bestSelection.bestSeconds !== undefined && bestSelection.bestSeconds < currentPrSeconds))
  ) {
    anchorDistanceKm = basisRun.distanceKm;
    anchorTimeSeconds = basisRun.durationSeconds;
    anchorLabel = `${basisRun.title || 'Best Effort'} (${basisRun.distanceKm.toFixed(1)}K in ${formatDuration(
      basisRun.durationSeconds
    )})`;
  } else if (currentPrSeconds && currentPrSeconds > 0) {
    anchorDistanceKm = safeTargetDist;
    anchorTimeSeconds = Math.round(currentPrSeconds);
    anchorLabel = `${safeTargetDist.toFixed(1)}K PR (${formatDuration(anchorTimeSeconds)})`;
  } else if (basisRun && basisRun.distanceKm > 0 && basisRun.durationSeconds > 0) {
    anchorDistanceKm = basisRun.distanceKm;
    anchorTimeSeconds = basisRun.durationSeconds;
    anchorLabel = `${basisRun.title || 'Best Effort'} (${basisRun.distanceKm.toFixed(1)}K in ${formatDuration(
      basisRun.durationSeconds
    )})`;
  }

  // Compute recent 28-day training volume & longest run
  const datedRuns = [...runs]
    .map((r) => ({ run: r, ts: parseDateSafe(r.date).getTime() }))
    .filter((x) => !isNaN(x.ts) && x.run.distanceKm > 0)
    .sort((a, b) => a.ts - b.ts);

  let measuredWeeklyKm = 0;
  let measuredRunsPerWeek = 0;
  let longestRecentRunKm = 0;

  if (datedRuns.length > 0) {
    const earliestTs = datedRuns[0].ts;
    const latestTs = datedRuns[datedRuns.length - 1].ts;
    const anchorTs = Math.max(Date.now(), latestTs);
    const recent28d = datedRuns.filter((x) => anchorTs - x.ts <= 28 * 86400_000);
    const recent35d = datedRuns.filter((x) => anchorTs - x.ts <= 35 * 86400_000);

    const activePool = recent28d.length > 0 ? recent28d : datedRuns.slice(-6);
    const totalKm = activePool.reduce((sum, x) => sum + (x.run.distanceKm || 0), 0);
    const spanDays = Math.max(1, (anchorTs - earliestTs) / 86400_000);
    const activeWindowWeeks =
      recent28d.length > 0
        ? spanDays >= 21
          ? 4
          : Math.max(1, Math.min(4, Math.ceil(spanDays / 7)))
        : Math.max(1, Math.ceil((activePool[activePool.length - 1].ts - activePool[0].ts) / (7 * 86400_000)));

    measuredWeeklyKm = Math.round((totalKm / activeWindowWeeks) * 10) / 10;
    measuredRunsPerWeek = Math.round((activePool.length / activeWindowWeeks) * 10) / 10;

    const longPool = recent35d.length > 0 ? recent35d : datedRuns;
    longestRecentRunKm = Math.round(
      Math.max(...longPool.map((x) => x.run.distanceKm || 0)) * 10
    ) / 10;
  }

  const hasOverride =
    volumeOverrideKmPerWeek !== null &&
    volumeOverrideKmPerWeek !== undefined &&
    !isNaN(volumeOverrideKmPerWeek);
  const effectiveWeeklyKm = hasOverride
    ? Math.max(0, Math.round(volumeOverrideKmPerWeek * 10) / 10)
    : measuredWeeklyKm;

  const enduranceExponent = computeVolumeEnduranceExponent(effectiveWeeklyKm);

  let volumeTierLabel = 'Building Base (<20 km/wk)';
  if (effectiveWeeklyKm >= 55) {
    volumeTierLabel = 'High Aerobic Volume (55+ km/wk)';
  } else if (effectiveWeeklyKm >= 38) {
    volumeTierLabel = 'Strong XC/Road Volume (38–54 km/wk)';
  } else if (effectiveWeeklyKm >= 20) {
    volumeTierLabel = 'Moderate Volume (20–37 km/wk)';
  }

  let volumeAdjustmentSummary = '';
  if (effectiveWeeklyKm >= 40) {
    volumeAdjustmentSummary =
      'High weekly mileage lowers your fatigue exponent, protecting pace over 8K, 10K, and Half Marathon distances.';
  } else if (effectiveWeeklyKm >= 22) {
    volumeAdjustmentSummary =
      'Moderate weekly volume tracks standard Riegel scaling for 5K–6K with mild late-race drift at 10K+.';
  } else {
    volumeAdjustmentSummary =
      'Lower recent weekly mileage increases aerobic fade on 8K–21.1K predictions—raising weekly volume will tighten longer race times.';
  }

  if (!anchorTimeSeconds || anchorTimeSeconds <= 0) {
    return {
      hasData: false,
      anchorLabel: '',
      anchorDistanceKm: safeTargetDist,
      anchorTimeSeconds: 0,
      measuredWeeklyKm,
      effectiveWeeklyKm,
      measuredRunsPerWeek,
      longestRecentRunKm,
      enduranceExponent,
      volumeTierLabel,
      volumeAdjustmentSummary,
      predictions: [],
    };
  }

  const normalizedGoalSec =
    goalTimeSeconds && goalTimeSeconds > 0
      ? goalTimeSeconds < 600
        ? Math.round(goalTimeSeconds * safeTargetDist)
        : Math.round(goalTimeSeconds)
      : null;

  const targetDistances: Array<{
    id: DistancePredictionItem['id'];
    label: string;
    distanceKm: number;
    recommendedWeeklyKm: number;
  }> = [
    { id: '3k', label: '3K', distanceKm: 3.0, recommendedWeeklyKm: 15 },
    { id: '5k', label: '5K', distanceKm: 5.0, recommendedWeeklyKm: 22 },
    { id: '6k', label: '6K', distanceKm: 6.0, recommendedWeeklyKm: 28 },
    { id: '8k', label: '8K', distanceKm: 8.0, recommendedWeeklyKm: 36 },
    { id: '10k', label: '10K', distanceKm: 10.0, recommendedWeeklyKm: 42 },
    { id: 'half', label: 'Half (21.1K)', distanceKm: 21.1, recommendedWeeklyKm: 58 },
  ];

  const predictions: DistancePredictionItem[] = targetDistances.map((item) => {
    const sim = predictTimeBetweenDistances(
      anchorDistanceKm,
      anchorTimeSeconds,
      item.distanceKm,
      effectiveWeeklyKm,
      longestRecentRunKm,
      !hasOverride
    );

    const measuredSim = predictTimeBetweenDistances(
      anchorDistanceKm,
      anchorTimeSeconds,
      item.distanceKm,
      measuredWeeklyKm,
      longestRecentRunKm,
      true
    );

    const goalSim =
      normalizedGoalSec !== null
        ? predictTimeBetweenDistances(
            safeTargetDist,
            normalizedGoalSec,
            item.distanceKm,
            effectiveWeeklyKm,
            longestRecentRunKm,
            !hasOverride
          ).predictedSec
        : null;

    const volRatio = effectiveWeeklyKm / Math.max(1, item.recommendedWeeklyKm);
    let readiness: DistancePredictionItem['readiness'] = 'Needs Mileage';
    if (volRatio >= 1.05) {
      readiness = 'Race Ready';
    } else if (volRatio >= 0.78) {
      readiness = 'Strong Base';
    } else if (volRatio >= 0.5) {
      readiness = 'Building Base';
    }

    return {
      id: item.id,
      label: item.label,
      distanceKm: item.distanceKm,
      predictedSeconds: sim.predictedSec,
      predictedPaceSecPerKm: Math.round(sim.predictedSec / item.distanceKm),
      measuredPredictedSeconds: measuredSim.predictedSec,
      goalEquivalentSeconds: goalSim,
      exponentUsed: sim.exponentUsed,
      recommendedWeeklyKm: item.recommendedWeeklyKm,
      readiness,
      isGoalDistance: Math.abs(item.distanceKm - safeTargetDist) < 0.15,
    };
  });

  return {
    hasData: true,
    anchorLabel,
    anchorDistanceKm,
    anchorTimeSeconds,
    measuredWeeklyKm,
    effectiveWeeklyKm,
    measuredRunsPerWeek,
    longestRecentRunKm,
    enduranceExponent,
    volumeTierLabel,
    volumeAdjustmentSummary,
    predictions,
  };
}





