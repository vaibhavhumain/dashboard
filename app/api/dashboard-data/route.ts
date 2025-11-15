import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      throw new Error("Missing Google API environment variables.");
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1!A1:E100",
    });

    const [header, ...rows] = res.data.values || [];

    const data = !header
      ? []
      : rows.map((row) => {
          const obj: Record<string, string> = {};
          header.forEach((key, idx) => (obj[key] = row[idx]));
          return obj;
        });

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("Error fetching sheet data:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
