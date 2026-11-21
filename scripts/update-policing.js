import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MONTH_FOLDERS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getIsoWeekNumber(date) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
}

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

  const now = new Date();
  const year = now.getUTCFullYear();
  const monthIdx = now.getUTCMonth();
  const dayNumber = now.getUTCDate();
  const weekNumber = getIsoWeekNumber(now);
  const folderName = `${MONTH_FOLDERS[monthIdx]}${year}`;
  const activeMonthLabel = `${MONTH_NAMES[monthIdx]} ${year}`;

  const displayDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });

  let incomingRecords = newData.records || newData.globalCodeData_B4 || [];

  incomingRecords = incomingRecords.map((record, idx) => {
    delete record.reportingDate;

    const stateName = record.stateName || record.state || 'FCT Abuja';
    const stateKey = record.stateKey || stateName.toUpperCase();

    return {
      weekNumber: record.weekNumber ?? weekNumber,
      dayNumber: record.dayNumber ?? dayNumber,
      rankingNumber: record.rankingNumber ?? (idx + 1),
      stateKey,
      stateName,
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

  const targetDir = path.join(folderName);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const masterPath = path.join(targetDir, 'master-data.json');
  let masterData = {
    activeMonth: activeMonthLabel,
    globalCodeData_B4: []
  };

  if (fs.existsSync(masterPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
      masterData.activeMonth = activeMonthLabel;
      masterData.globalCodeData_B4 = existing.globalCodeData_B4 || existing.records || [];
    } catch (e) {
      console.warn('Existing master-data.json could not be parsed, initializing fresh container.');
    }
  }

  if (incomingRecords.length > 0) {
    masterData.globalCodeData_B4.unshift(...incomingRecords);
  }

  fs.writeFileSync(masterPath, JSON.stringify(masterData, null, 2));
  console.log(`Successfully updated ${folderName}/master-data.json with telemetry records (B4 format).`);

  console.log('Executing ticker feed update script...');
  execSync('node scripts/update-ticker.js', { stdio: 'inherit' });

  fs.writeFileSync(inputPath, '');
  console.log('Cleared data/incoming-police-raw.txt for subsequent batches.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
