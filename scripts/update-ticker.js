import fs from 'fs';
import path from 'path';

const MONTH_FOLDERS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
];

function getCurrentMonthFolder(now = new Date()) {
  return `${MONTH_FOLDERS[now.getUTCMonth()]}${now.getUTCFullYear()}`;
}

function formatSps(rawSps) {
  if (rawSps === undefined || rawSps === null || rawSps === '') return '0.0';
  const num = Number(rawSps);
  return Number.isNaN(num) ? String(rawSps) : num.toFixed(1);
}

function safeDateString(rawDate, fallbackIsoDate) {
  if (!rawDate) return fallbackIsoDate;
  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? fallbackIsoDate : String(rawDate);
}

function runTicker() {
  const now = new Date();
  const fallbackIsoDate = now.toISOString().split('T')[0];
  const monthFolder = getCurrentMonthFolder(now);
  const policingPath = path.join(monthFolder, 'master-data.json');
  const headlines = [];

  if (fs.existsSync(policingPath)) {
    const policeData = JSON.parse(fs.readFileSync(policingPath, 'utf8'));

    // Support both the B4 structure and legacy records array
    const records = policeData.globalCodeData_B4 || policeData.records || [];

    if (Array.isArray(records)) {
      records.forEach(rec => {
        const stateName = rec.stateName || rec.state || 'State';
        const controlRating = rec.metrics && rec.metrics.controlRating ? rec.metrics.controlRating : 'ACTIVE';
        const sps = formatSps(rec.metrics ? rec.metrics.sps : undefined);
        const headlineText = rec.headline || 'Operational telemetry update compiled.';
        const itemDate = safeDateString(rec.incidenceDate, fallbackIsoDate);

        headlines.push({
          date: itemDate,
          category: 'POLICING INTELLIGENCE',
          text: `${stateName} Command (${controlRating} - SPS: ${sps}): ${headlineText}`,
          url: '/p/state-policing-intelligence.html'
        });
      });
    }
  }

  // Sort descending by date safely
  headlines.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const tickerOutput = {
    lastUpdated: now.toISOString(),
    items: headlines.slice(0, 20) // Keep top 20 active ticker items
  };

  // Ensure the 'data' directory exists prior to writing output
  const dir = 'data';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const outputPath = path.join(dir, 'live-ticker-feed.json');
  fs.writeFileSync(outputPath, JSON.stringify(tickerOutput, null, 2));
  console.log(`Successfully generated live ticker feed JSON from ${policingPath}.`);
}

runTicker();
