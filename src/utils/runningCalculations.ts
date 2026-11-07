import { RunRecord, UserProfile, WeeklyStat, AdherenceSummary, RunType, DuplicateRunMatch } from '../types/running';

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
  const riegelFactor = Math.pow(targetDistanceKm / distanceKm, 1.06);
  return Math.round(durationSeconds * riegelFactor);
}

export function calculate6kEquivalent(distanceKm: number, durationSeconds: number): number {
  return calculateTargetDistanceEquivalent(distanceKm, durationSeconds, 6.0);
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
  return type === 'Interval Training' || type === 'Intervals';
}

export function is6kQualityRun(type: RunType): boolean {
  return type === '6K Time Trial' || type === 'Race' || type === 'Tempo';
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

export function getIsoWeekKey(dateStr: string): { key: string; year: number; weekNumber: number; weekStartDate: Date } {
  const d = parseDateSafe(dateStr);
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

  const { key: isoWeekKey } = getIsoWeekKey(now.toISOString());

  return { monday, sunday, isoWeekKey, formattedRange, formattedMonday, formattedSunday };
}

export function isRunInCurrentWeek(runDate: string, referenceDate: Date = new Date()): boolean {
  const currentKey = getIsoWeekKey(referenceDate.toISOString()).key;
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

  const currentWeekInfo = getIsoWeekKey(new Date().toISOString());
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
      // 1. Check Garmin Activity ID if both have one
      if (
        incoming.garminActivityId &&
        existing.garminActivityId &&
        incoming.garminActivityId === existing.garminActivityId
      ) {
        return true;
      }
      // 2. Check identical date + distance (within 0.05 km) + duration (within 10 seconds)
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

export function parseGarminCsv(csvText: string, userId: string): RunRecord[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.replace(/["']/g, '').trim().toLowerCase());

  const dateIdx = header.findIndex((h) => h.includes('date'));
  const titleIdx = header.findIndex((h) => h.includes('title') || h.includes('activity name'));
  const distIdx = header.findIndex((h) => h.includes('distance'));
  const timeIdx = header.findIndex((h) => h.includes('time') || h.includes('duration'));
  const hrIdx = header.findIndex((h) => h.includes('avg hr') || h.includes('average heart rate') || h.includes('hr'));
  const maxHrIdx = header.findIndex((h) => h.includes('max hr'));
  const cadIdx = header.findIndex((h) => h.includes('cadence') || h.includes('run cadence'));
  const elevIdx = header.findIndex((h) => h.includes('elevation') || h.includes('elev gain'));
  const idIdx = header.findIndex((h) => h.includes('activity id') || h.includes('activity_id'));

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

    const title = titleIdx >= 0 && tokens[titleIdx] ? tokens[titleIdx] : `Garmin Run ${i}`;
    const rawDate = dateIdx >= 0 ? tokens[dateIdx] : new Date().toISOString();
    const actId = idIdx >= 0 ? tokens[idIdx] : undefined;

    let distKm = 0;
    if (distIdx >= 0 && tokens[distIdx]) {
      const val = parseFloat(tokens[distIdx].replace(/[^0-9.]/g, ''));
      if (!isNaN(val)) distKm = val;
    }
    let durationSec = 0;
    if (timeIdx >= 0 && tokens[timeIdx]) {
      durationSec = parseDuration(tokens[timeIdx]);
    }

    if (distKm <= 0 || durationSec <= 0) continue;

    const avgPace = calculatePaceSecPerKm(distKm, durationSec);
    const best6k = calculate6kEquivalent(distKm, durationSec);
    const runType = inferRunType(title, distKm);

    const avgHr = hrIdx >= 0 && tokens[hrIdx] ? parseInt(tokens[hrIdx].replace(/\D/g, ''), 10) : undefined;
    const maxHr = maxHrIdx >= 0 && tokens[maxHrIdx] ? parseInt(tokens[maxHrIdx].replace(/\D/g, ''), 10) : undefined;
    const cadence = cadIdx >= 0 && tokens[cadIdx] ? parseInt(tokens[cadIdx].replace(/\D/g, ''), 10) : undefined;
    const elevation = elevIdx >= 0 && tokens[elevIdx] ? parseFloat(tokens[elevIdx].replace(/[^0-9.]/g, '')) : undefined;

    records.push({
      id: actId ? `garmin_${actId}` : `garmin_csv_${Date.now()}_${i}`,
      userId,
      date: new Date(rawDate).toISOString().split('T')[0] || rawDate,
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
      source: 'garmin_csv',
      garminActivityId: actId,
      createdAt: new Date().toISOString(),
    });
  }

  return records;
}

export function parseTcx(tcxText: string, userId: string, fileName?: string): RunRecord | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(tcxText, 'application/xml');

    const activity = doc.querySelector('Activity');
    if (!activity) return null;

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
    const defaultTitle = fileName ? fileName.replace(/\.[^/.]+$/, '') : `Garmin XC Run`;
    const runType = inferRunType(defaultTitle, distKm);

    const cleanActId = actId ? actId.replace(/[^a-zA-Z0-9_\-\.:]/g, '_') : null;

    return {
      id: cleanActId ? `garmin_tcx_${cleanActId}` : `garmin_tcx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      date: new Date(dateStr).toISOString().split('T')[0] || dateStr,
      title: defaultTitle,
      distanceKm: Number(distKm.toFixed(2)),
      durationSeconds: Math.round(totalSeconds),
      averagePaceSecPerKm: Math.round(avgPace),
      best6kTimeSeconds: best6k,
      runType,
      avgHeartRate: hrCount > 0 ? Math.round(hrSum / hrCount) : undefined,
      maxHeartRate: maxHr > 0 ? maxHr : undefined,
      avgCadence: cadCount > 0 ? Math.round(cadSum / cadCount) : undefined,
      source: 'garmin_tcx',
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

    const nameElem = doc.querySelector('metadata > name') || doc.querySelector('trk > name');
    const title = nameElem && nameElem.textContent ? nameElem.textContent : (fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Garmin GPX Run');

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
            elevGain += (ele - lastElev);
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
    const runDate = startTime ? new Date(startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    return {
      id: `garmin_gpx_${Date.now()}`,
      userId,
      date: runDate,
      title,
      distanceKm: Number(distKm.toFixed(2)),
      durationSeconds: durationSec,
      averagePaceSecPerKm: Math.round(avgPace),
      best6kTimeSeconds: best6k,
      runType: inferRunType(title, distKm),
      elevationGainMeters: elevGain > 0 ? Math.round(elevGain) : undefined,
      source: 'garmin_gpx',
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
  if (runType === 'Interval Training' || runType === 'Intervals') {
    return 'Interval';
  }
  if (runType === 'Tempo') {
    return 'Tempo';
  }
  if (runType === 'Easy' || runType === 'Aerobic' || runType === 'Long Run') {
    return 'Easy';
  }
  const lower = (title || '').toLowerCase();
  if (lower.includes('race') || lower.includes('time trial')) return 'Race';
  if (lower.includes('interval') || lower.includes('track') || lower.includes('repeat')) return 'Interval';
  if (lower.includes('tempo') || lower.includes('threshold')) return 'Tempo';
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

export type ReadinessState = 'Fully Rested' | 'Optimal' | 'Good' | 'Moderate Fatigue' | 'Deep Recovery';

export interface RecoveryCalculationResult {
  hasRuns: boolean;
  recoveryPercentage: number; // 0 to 100
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
 * Pure mathematical running recovery calculation based on:
 * 1. Elapsed time since the most recent workout
 * 2. Physiological workout load (duration, distance, category multiplier, and HR intensity)
 * 3. Exponential restorative recovery curve
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
      readinessState: 'Fully Rested',
      color: '#30d158',
      hoursSinceLastRun: 0,
      recommendedRecoveryHours: 0,
      remainingRecoveryHours: 0,
      effortScore: 0,
      effortLevel: 'Light',
      trainingStressMultiplier: 1.0,
      explanation: 'No runs recorded yet. Your legs and cardiovascular system are completely rested.',
      nextSessionRecommendation: 'Ready to log your first run, time trial, or fitness tracker sync.',
    };
  }

  // Find the most recent run
  const sortedRuns = [...runs].sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) return timeB - timeA;
    // secondary sort by duration or id if same date
    return (b.durationSeconds || 0) - (a.durationSeconds || 0);
  });

  const lastRun = sortedRuns[0];

  // Calculate elapsed hours since the last run
  let runTimestamp = new Date(lastRun.date).getTime();
  if (isNaN(runTimestamp)) {
    runTimestamp = now.getTime() - 24 * 60 * 60 * 1000;
  } else if (!lastRun.date.includes('T')) {
    // If date string is YYYY-MM-DD, set to 12:00 PM local so runs today have a sensible elapsed time
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
      typeMultiplier = 1.50;
      break;
    case 'Interval Training':
    case 'Intervals':
      typeMultiplier = 1.40;
      break;
    case 'Tempo':
      typeMultiplier = 1.25;
      break;
    case 'Long Run':
      typeMultiplier = 1.20;
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
      hrFactor = 1.35; // Zone 5 / race peak
    } else if (hrRatio >= 0.82) {
      hrFactor = 1.20; // Zone 4 / threshold
    } else if (hrRatio >= 0.72) {
      hrFactor = 1.05; // Zone 3 / moderate
    } else {
      hrFactor = 0.85; // Zone 1-2 / easy aerobic
    }
  }

  // 4. Pace Factor (speed stress)
  let paceFactor = 1.0;
  if (lastRun.averagePaceSecPerKm && lastRun.averagePaceSecPerKm > 0) {
    if (lastRun.averagePaceSecPerKm < 240) {
      paceFactor = 1.15; // sub-4:00/km fast turnover
    } else if (lastRun.averagePaceSecPerKm < 270) {
      paceFactor = 1.08; // sub-4:30/km
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
  // Math: 12h baseline + load scaling, bounded between 12 and 72 hours
  const recommendedRecoveryHours = Math.min(
    72,
    Math.max(12, Math.round(effortScore * 0.46 + 4))
  );

  // 6. Exponential Restorative Recovery Curve
  // Math: recoveryPercentage = Math.min(100, (elapsed / recommended)^0.85 * 100)
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

  // 7. Readiness State, Color, and Scientific Guidance
  let readinessState: ReadinessState;
  let color: string;
  let explanation: string;
  let nextSessionRecommendation: string;

  if (recoveryPercentage >= 90) {
    readinessState = progressRatio >= 1.2 ? 'Fully Rested' : 'Optimal';
    color = '#30d158'; // Emerald green
    explanation = `Your cardiovascular system and glycogen stores are fully recovered after ${hoursSinceLastRun}h since ${lastRun.title}.`;
    nextSessionRecommendation = 'Prime condition for high-intensity intervals, race pace trial, or long endurance run.';
  } else if (recoveryPercentage >= 70) {
    readinessState = 'Good';
    color = '#0a84ff'; // Blue
    explanation = `Substantial recovery achieved (${recoveryPercentage}%). ${remainingRecoveryHours}h until complete cellular recovery from ${lastRun.title}.`;
    nextSessionRecommendation = 'Safe for aerobic base miles, easy recovery running, or moderate tempo work.';
  } else if (recoveryPercentage >= 45) {
    readinessState = 'Moderate Fatigue';
    color = '#0284c7'; // Deep Sky Blue
    explanation = `Moderate residual muscle and metabolic fatigue (${hoursSinceLastRun}h elapsed of ${recommendedRecoveryHours}h recommended window).`;
    nextSessionRecommendation = 'Prioritize light recovery jog, dynamic stretching, cross-training, or rest.';
  } else {
    readinessState = 'Deep Recovery';
    color = '#ff453a'; // Red
    explanation = `High physiological strain detected from ${lastRun.title} (${lastRun.runType}, Load: ${effortScore}). Muscles are repairing.`;
    nextSessionRecommendation = 'Rest day recommended. Focus on hydration, nutrition, and sleep before next quality workout.';
  }

  return {
    hasRuns: true,
    recoveryPercentage,
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
  scenarios: {
    accelerated: { weeks: number; date: string; weeklyRateSec: number };
    expected: { weeks: number; date: string; weeklyRateSec: number };
    conservative: { weeks: number; date: string; weeklyRateSec: number };
  };
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

  if (!targetTimeSeconds || targetTimeSeconds <= 0) {
    return {
      hasTarget: false,
      hasData: Boolean(runs.length > 0),
      isAchieved: false,
      targetDistanceKm: targetDist,
      gapSeconds: 0,
      estimatedWeeks: 0,
      projectedCompletionDate: '',
      weeklyImprovementSeconds: 0,
      confidence: 'Initial Estimate',
      basisDescription: 'Set a goal time to calculate projected completion date and weekly progression milestones.',
      milestones: [],
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

  const currentBest =
    currentBestSeconds && currentBestSeconds > 0
      ? currentBestSeconds
      : runs.length > 0
      ? runs.reduce((min, r) => {
          const eq =
            r.targetEquivalentSeconds ||
            calculateTargetDistanceEquivalent(r.distanceKm, r.durationSeconds, targetDist) ||
            r.best6kTimeSeconds;
          return eq && eq > 0 && eq < min ? eq : min;
        }, 999999)
      : null;

  const effectiveCurrentSec = currentBest && currentBest < 999999 ? currentBest : null;

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
      basisDescription: `You have already surpassed your ${targetDist}K target by ${formatDuration(Math.abs(gapSeconds))}. Maintain conditioning with regular aerobic tempo workouts!`,
      milestones: [
        {
          weekNumber: 0,
          projectedDate: 'Now',
          projectedTimeSeconds: effectiveCurrentSec,
          projectedPaceSecPerKm: effectiveCurrentSec / targetDist,
          notes: 'Current PR / Benchmark (Goal Surpassed)',
        },
      ],
      scenarios: {
        accelerated: { weeks: 0, date: 'Achieved', weeklyRateSec: 0 },
        expected: { weeks: 0, date: 'Achieved', weeklyRateSec: 0 },
        conservative: { weeks: 0, date: 'Achieved', weeklyRateSec: 0 },
      },
    };
  }

  // Calculate improvement rate:
  const runsWithEquivalent = [...runs]
    .map((r) => ({
      date: new Date(r.date).getTime(),
      timeSec:
        r.targetEquivalentSeconds ||
        calculateTargetDistanceEquivalent(r.distanceKm, r.durationSeconds, targetDist) ||
        r.best6kTimeSeconds ||
        0,
    }))
    .filter((r) => r.timeSec > 0 && !isNaN(r.date))
    .sort((a, b) => a.date - b.date);

  let weeklyImprovement = 14; // Default steady cross country adaptation: ~14s/week on 6k
  let confidence: 'High' | 'Moderate' | 'Initial Estimate' = 'Initial Estimate';
  let basisDescription = 'Based on steady cross country training adaptation (3 weekly workouts).';

  if (runsWithEquivalent.length >= 3) {
    const firstPoint = runsWithEquivalent[0];
    const latestPoint = runsWithEquivalent[runsWithEquivalent.length - 1];
    const daysDiff = (latestPoint.date - firstPoint.date) / (1000 * 3600 * 24);

    if (daysDiff >= 10) {
      const weeksDiff = daysDiff / 7;
      const totalImprovement = firstPoint.timeSec - latestPoint.timeSec;
      const empiricalRate = totalImprovement / weeksDiff;

      if (empiricalRate > 2 && empiricalRate < 35) {
        weeklyImprovement = Math.round(empiricalRate);
        confidence = runsWithEquivalent.length >= 6 ? 'High' : 'Moderate';
        basisDescription = `Calculated from your empirical improvement rate of ~${weeklyImprovement}s/week across logged workouts.`;
      } else {
        const streakFactor = Math.min(1.3, 1 + currentWeeklyStreak * 0.05);
        weeklyImprovement = Math.round(14 * streakFactor);
        confidence = 'Moderate';
        basisDescription = `Calibrated from your ${currentWeeklyStreak}-week adherence streak and 3-run weekly consistency.`;
      }
    }
  } else if (currentWeeklyStreak > 0) {
    weeklyImprovement = Math.min(20, Math.round(12 + currentWeeklyStreak * 1.5));
    confidence = 'Moderate';
    basisDescription = `Projected from your ${currentWeeklyStreak}-week training streak and target workout volume.`;
  }

  // Scenarios
  const acceleratedRate = Math.max(8, Math.round(weeklyImprovement * 1.35));
  const expectedRate = Math.max(5, weeklyImprovement);
  const conservativeRate = Math.max(3, Math.round(weeklyImprovement * 0.65));

  const expectedWeeks = Math.max(1, Math.ceil(gapSeconds / expectedRate));
  const acceleratedWeeks = Math.max(1, Math.ceil(gapSeconds / acceleratedRate));
  const conservativeWeeks = Math.max(1, Math.ceil(gapSeconds / conservativeRate));

  const now = new Date();
  const formatDateOffset = (weeks: number): string => {
    const d = new Date(now.getTime() + weeks * 7 * 24 * 3600 * 1000);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const projectedCompletionDate = formatDateOffset(expectedWeeks);

  // Milestone checkpoints: Now, 1/3, 2/3, and Final Goal
  const milestones: GoalMilestone[] = [];

  // Week 0: Baseline
  milestones.push({
    weekNumber: 0,
    projectedDate: 'Current Baseline',
    projectedTimeSeconds: effectiveCurrentSec,
    projectedPaceSecPerKm: effectiveCurrentSec / targetDist,
    notes: 'Starting performance benchmark',
  });

  if (expectedWeeks > 2) {
    const mid1 = Math.max(1, Math.round(expectedWeeks * 0.33));
    const timeMid1 = Math.max(targetTotalSec, Math.round(effectiveCurrentSec - mid1 * expectedRate));
    milestones.push({
      weekNumber: mid1,
      projectedDate: formatDateOffset(mid1),
      projectedTimeSeconds: timeMid1,
      projectedPaceSecPerKm: timeMid1 / targetDist,
      notes: 'Threshold capacity & aerobic expansion',
    });

    const mid2 = Math.max(mid1 + 1, Math.round(expectedWeeks * 0.66));
    if (mid2 < expectedWeeks) {
      const timeMid2 = Math.max(targetTotalSec, Math.round(effectiveCurrentSec - mid2 * expectedRate));
      milestones.push({
        weekNumber: mid2,
        projectedDate: formatDateOffset(mid2),
        projectedTimeSeconds: timeMid2,
        projectedPaceSecPerKm: timeMid2 / targetDist,
        notes: 'Race-pace interval conditioning',
      });
    }
  }

  // Final Target Milestone
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

  const earlyTotalDist = earlySlice.reduce((s, r) => s + r.distanceKm, 0);
  const earlyTotalSec = earlySlice.reduce((s, r) => s + r.durationSeconds, 0);
  const earlyAvgPace = earlyTotalDist > 0 ? earlyTotalSec / earlyTotalDist : 0;

  const lateTotalDist = lateSlice.reduce((s, r) => s + r.distanceKm, 0);
  const lateTotalSec = lateSlice.reduce((s, r) => s + r.durationSeconds, 0);
  const lateAvgPace = lateTotalDist > 0 ? lateTotalSec / lateTotalDist : 0;

  // Pace improvement: early pace minus late pace (positive = getting faster in sec/km)
  const paceDiffSecPerKm = earlyAvgPace - lateAvgPace;
  const weeklyPaceRate = paceDiffSecPerKm / weeksSpan;
  const weekly6kRate = Math.round(weeklyPaceRate * targetGoalDistanceKm);

  const currentPaceBaselineSecPerKm = Math.round(lateAvgPace);
  const intervalPaceSec = Math.max(150, currentPaceBaselineSecPerKm - 20); // ~20s faster than baseline
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


