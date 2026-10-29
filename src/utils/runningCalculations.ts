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

export function parseDuration(input: string): number {
  if (!input || typeof input !== 'string') return 0;
  const clean = input.trim();

  if (clean.includes(':')) {
    const parts = clean.split(':').map((p) => parseFloat(p.trim()) || 0);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
  }

  const minMatch = clean.match(/(\d+)\s*(?:m|min|minutes)/i);
  const secMatch = clean.match(/(\d+)\s*(?:s|sec|seconds)/i);
  const hrMatch = clean.match(/(\d+)\s*(?:h|hr|hours)/i);

  if (minMatch || secMatch || hrMatch) {
    const h = hrMatch ? parseInt(hrMatch[1], 10) : 0;
    const m = minMatch ? parseInt(minMatch[1], 10) : 0;
    const s = secMatch ? parseInt(secMatch[1], 10) : 0;
    return h * 3600 + m * 60 + s;
  }

  const rawNum = parseFloat(clean);
  return isNaN(rawNum) ? 0 : rawNum;
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

export function calculate6kEquivalent(distanceKm: number, durationSeconds: number): number {
  if (!distanceKm || distanceKm <= 0 || !durationSeconds || durationSeconds <= 0) return 0;
  if (Math.abs(distanceKm - 6.0) < 0.05) {
    return Math.round(durationSeconds * (6.0 / distanceKm));
  }
  const riegelFactor = Math.pow(6.0 / distanceKm, 1.06);
  return Math.round(durationSeconds * riegelFactor);
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

export function getIsoWeekKey(dateStr: string): { key: string; year: number; weekNumber: number; weekStartDate: Date } {
  const d = new Date(dateStr);
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

    return {
      id: actId ? `garmin_tcx_${actId}` : `garmin_tcx_${Date.now()}`,
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
