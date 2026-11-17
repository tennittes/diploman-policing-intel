import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  const inputPath = path.join('data', 'incoming-police-raw.txt');
  const promptPath = path.join('prompts', 'policing-extraction-prompt.txt');

  if (!fs.existsSync(inputPath)) {
    console.log('No incoming police raw text file found at data/incoming-police-raw.txt. Skipping.');
    return;
  }

  const rawText = fs.readFileSync(inputPath, 'utf8').trim();
  if (!rawText) {
    console.log('Incoming police raw text file is empty. Skipping.');
    return;
  }

  const promptTemplate = fs.readFileSync(promptPath, 'utf8');
  const finalPrompt = promptTemplate.replace('{{RAW_PRESS_RELEASES_TEXT}}', rawText);

  console.log('Sending raw press releases to Gemini API for policing telemetry extraction...');
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: finalPrompt
  });

  const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
  let newData;
  try {
    newData = JSON.parse(cleanJson);
  } catch (err) {
    console.error('Failed to parse Gemini JSON response:', cleanJson);
    throw err;
  }

  // Dynamically generate current UTC date instead of hardcoding
  const now = new Date();
  const currentReportingDate = now.toISOString().split('T')[0];
  const dayNumber = now.getUTCDate();
  
  // Format display date (e.g., "Tuesday, November 17, 2026")
  const displayDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });

  // Normalize incoming records to match the B4 schema requirements
  let incomingRecords = newData.records || newData.globalCodeData_B4 || [];
  
  incomingRecords = incomingRecords.map(record => {
    // Remove reportingDate if present
    delete record.reportingDate;

    const stateName = record.stateName || record.state || "FCT Abuja";
    const stateKey = record.stateKey || stateName.toUpperCase();

    return {
      dayNumber: record.dayNumber || dayNumber,
      stateKey: stateKey,
      stateName: stateName,
      displayDate: record.displayDate || displayDate,
      command: record.command,
      commandLead: record.commandLead,
      incidenceDate: record.incidenceDate,
      iccsCategory: record.iccsCategory,
      clearanceStatus: record.clearanceStatus,
      latencyHours: record.latencyHours,
      metrics: record.metrics,
      headline: record.headline,
      impactVector: record.impactVector,
      securityAnalysis: record.securityAnalysis
    };
  });

  // Ensure the target directory exists
  const targetDir = path.join('nov2026');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const masterPath = path.join('nov2026', 'master-data.json');
  let masterData = { 
    lastUpdated: currentReportingDate, 
    activeMonth: "November 2026", 
    globalCodeData_B4: [] 
  };
  
  if (fs.existsSync(masterPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
      masterData.globalCodeData_B4 = existing.globalCodeData_B4 || existing.records || [];
    } catch (e) {
      console.warn('Existing master-data.json could not be parsed, initializing fresh container.');
    }
  }

  masterData.lastUpdated = currentReportingDate;
  masterData.activeMonth = "November 2026";

  if (incomingRecords.length > 0) {
    masterData.globalCodeData_B4.unshift(...incomingRecords);
  }

  fs.writeFileSync(masterPath, JSON.stringify(masterData, null, 2));
  console.log('Successfully updated nov2026/master-data.json with dynamic telemetry records (B4 format).');

  // Automatically trigger the ticker feed generator to refresh live-ticker-feed.json
  console.log('Executing ticker feed update script...');
  execSync('node scripts/update-ticker.js', { stdio: 'inherit' });

  // Clear the incoming raw text file for subsequent batches
  fs.writeFileSync(inputPath, '');
  console.log('Cleared data/incoming-police-raw.txt for subsequent batches.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
