import fs from 'fs';
import path from 'path';

function runTicker() {
  const policingPath = path.join('nov2026', 'master-data.json');
  let headlines = [];

  if (fs.existsSync(policingPath)) {
    const policeData = JSON.parse(fs.readFileSync(policingPath, 'utf8'));
    if (policeData && Array.isArray(policeData.records)) {
      policeData.records.forEach(rec => {
        const stateName = rec.state || 'State';
        const controlRating = rec.metrics && rec.metrics.controlRating ? rec.metrics.controlRating : 'ACTIVE';
        const headlineText = rec.headline || 'Operational telemetry update compiled.';
        
        headlines.push({
          date: rec.reportingDate || rec.incidenceDate || new Date().toISOString().split('T')[0],
          category: 'POLICING INTELLIGENCE',
          text: `${stateName} Command (${controlRating}): ${headlineText}`,
          url: '/p/state-policing-intelligence.html'
        });
      });
    }
  }

  // Sort descending by date
  headlines.sort((a, b) => new Date(b.date) - new Date(a.date));

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
