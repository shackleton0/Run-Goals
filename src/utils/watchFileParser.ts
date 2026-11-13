import JSZip from 'jszip';
import { RunRecord } from '../types/running';
import {
  parseWatchCsv,
  parseAppleHealthXml,
  parseAppleWatchJson,
  parseTcx,
  parseGpx,
} from './runningCalculations';

async function parseTextContent(
  text: string,
  fileName: string,
  userId: string
): Promise<RunRecord[]> {
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return parseWatchCsv(text, userId);
  }
  if (ext === 'xml') {
    if (text.includes('<HealthData') || text.includes('<Workout')) {
      return parseAppleHealthXml(text, userId);
    }
    if (text.includes('<TrainingCenterDatabase') || text.includes('<Activity')) {
      const run = parseTcx(text, userId, fileName);
      return run ? [run] : [];
    }
    if (text.includes('<gpx')) {
      const run = parseGpx(text, userId, fileName);
      return run ? [run] : [];
    }
    return [];
  }
  if (ext === 'tcx') {
    const run = parseTcx(text, userId, fileName);
    return run ? [run] : [];
  }
  if (ext === 'gpx') {
    const run = parseGpx(text, userId, fileName);
    return run ? [run] : [];
  }
  if (ext === 'json') {
    return parseAppleWatchJson(text, userId);
  }

  // Fallback content sniffing
  if (text.includes('<HealthData') || text.includes('HKWorkoutActivityType')) {
    return parseAppleHealthXml(text, userId);
  }
  if (text.includes('<TrainingCenterDatabase') || text.includes('<Activity')) {
    const run = parseTcx(text, userId, fileName);
    return run ? [run] : [];
  }
  if (text.includes('<gpx')) {
    const run = parseGpx(text, userId, fileName);
    return run ? [run] : [];
  }
  if (text.includes('Activity Type') || text.includes('Workout Type') || text.includes('Distance')) {
    return parseWatchCsv(text, userId);
  }
  return parseAppleWatchJson(text, userId);
}

export async function parseWatchFile(file: File, userId: string): Promise<RunRecord[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'zip') {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const allEntries = Object.values(zip.files).filter((entry) => !entry.dir);

    // 1. Prioritize Apple Health export.xml (commonly inside apple_health_export/export.xml)
    const exportXmlEntry = allEntries.find((entry) =>
      /(?:^|\/)export\.xml$/i.test(entry.name)
    );

    const results: RunRecord[] = [];

    if (exportXmlEntry) {
      const xmlText = await exportXmlEntry.async('string');
      const xmlRuns = parseAppleHealthXml(xmlText, userId);
      results.push(...xmlRuns);
    }

    // 2. If no workouts came from export.xml, inspect any .gpx / .tcx / .csv / .json inside the zip
    if (results.length === 0) {
      const routeOrActivityFiles = allEntries.filter((entry) =>
        /\.(gpx|tcx|csv|json|xml)$/i.test(entry.name) &&
        !/(?:^|\/)export_cda\.xml$/i.test(entry.name)
      );

      for (const entry of routeOrActivityFiles) {
        const entryText = await entry.async('string');
        const shortName = entry.name.split('/').pop() || entry.name;
        const parsed = await parseTextContent(entryText, shortName, userId);
        results.push(...parsed);
      }
    }

    return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const text = await file.text();
  return parseTextContent(text, file.name, userId);
}

export async function parseWatchFiles(files: FileList | File[], userId: string): Promise<RunRecord[]> {
  const accumulated: RunRecord[] = [];
  for (let i = 0; i < files.length; i++) {
    const fileRuns = await parseWatchFile(files[i], userId);
    accumulated.push(...fileRuns);
  }
  return accumulated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
