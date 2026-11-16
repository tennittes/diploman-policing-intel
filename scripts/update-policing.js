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

  // Umbrella reporting date enforcement (aligns with current operational batch date)
  const umbrellaReportingDate = "2026-11-16";
  if (newData.records && Array.isArray(newData.records)) {
    newData.records = newData.records.map(record => ({
      ...record,
      reportingDate: umbrellaReportingDate
    }));
  }

  const masterPath = path.join('data', 'master-policing-telemetry.json');
  let masterData = { lastUpdated: umbrellaReportingDate, records: [] };
  if (fs.existsSync(masterPath)) {
    masterData = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  }

  masterData.lastUpdated = umbrellaReportingDate;

  if (newData.records && Array.isArray(newData.records)) {
    masterData.records.unshift(...newData.records);
  }

  fs.writeFileSync(masterPath, JSON.stringify(masterData, null, 2));
  console.log('Successfully updated data/master-policing-telemetry.json with incidence and reporting date separation.');

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
