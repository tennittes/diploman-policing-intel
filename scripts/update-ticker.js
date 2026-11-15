import fs from 'fs';
import path from 'path';

function runTicker() {
  const policingPath = path.join('data', 'master-policing-telemetry.json');
  let headlines = [];

  if (fs.existsSync(policingPath)) {
    const policeData = JSON.parse(fs.readFileSync(policingPath, 'utf8'));
    policeData.records.forEach(rec => {
      headlines.push({
        date: rec.reportDate,
        category: 'POLICING INTELLIGENCE',
        text: `${rec.state} Command (${rec.metrics.controlRating}): ${rec.headline}`,
        url: '/p/state-policing-intelligence.html'
      });
    });
  }

  // Sort descending by date
  headlines.sort((a, b) => new Date(b.date) - new Date(a.date));

  const tickerOutput = {
    lastUpdated: new Date().toISOString(),
    items: headlines.slice(0, 20) // Keep top 20 active ticker items
  };

  const outputPath = path.join('data', 'live-ticker-feed.json');
  fs.writeFileSync(outputPath, JSON.stringify(tickerOutput, null, 2));
  console.log('Successfully generated live ticker feed JSON.');
}

runTicker();
