import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
     
const KEY_FILE_PATH = path.join(process.cwd(), 'keys/sheets-dashboard-bot.json');
const credentials = JSON.parse(fs.readFileSync(KEY_FILE_PATH, 'utf8'));

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

const spreadsheetId = '1Er8Uzixv_X5DAGHZrj72MSdXq-5PUlJH0yrOw2KptnI';
const range = 'Sheet1!A1:E100';

export async function GET() {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });

    const [header, ...rows] = res.data.values || [];
    if (!header || !rows.length) {
      return NextResponse.json({ data: [] });
    }

    const data = rows.map((row) => {
      const obj: Record<string, string> = {};
      header.forEach((key, i) => (obj[key] = row[i]));
      return obj;
    });

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Error fetching sheet data:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
