import fs from 'fs';
import path from 'path';

function runTicker() {
  const policingPath = path.join('nov2026', 'master-data.json');
  let headlines = [];

  if (fs.existsSync(policingPath)) {
    const policeData = JSON.parse(fs.readFileSync(policingPath, 'utf8'));
    
    // Support both the new B4 structure and legacy records array
    const records = policeData.globalCodeData_B4 || policeData.records || [];

    if (Array.isArray(records)) {
      records.forEach(rec => {
        const stateName = rec.stateName || rec.state || 'State';
        const controlRating = rec.metrics && rec.metrics.controlRating ? rec.metrics.controlRating : 'ACTIVE';
        const sps = rec.metrics && rec.metrics.sps !== undefined ? rec.metrics.sps : '0.0';
        const headlineText = rec.headline || 'Operational telemetry update compiled.';
        
        headlines.push({
          date: rec.incidenceDate || new Date().toISOString().split('T')[0],
          category: 'POLICING INTELLIGENCE',
          text: `${stateName} Command (${controlRating} - SPS: ${sps}): ${headlineText}`,
          url: '/p/state-policing-intelligence.html'
        });
      });
    }
  }

  // Sort descending by date
  headlines.sort((a, b) => new Date(b.date) - new Date(b.date === a.date ? 0 : b.date));

  const tickerOutput = {
    lastUpdated: new Date().toISOString(),
    items: headlines.slice(0, 20) // Keep top 20 active ticker items
  };

  // Ensure the 'data' directory exists prior to writing output
  const dir = 'data';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const outputPath = path.join(dir, 'live-ticker-feed.json');
  fs.writeFileSync(outputPath, JSON.stringify(tickerOutput, null, 2));
  console.log('Successfully generated live ticker feed JSON.');
}

runTicker();
