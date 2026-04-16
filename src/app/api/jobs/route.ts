import { NextResponse } from 'next/server';
import { listRecentJobRuns } from '@/lib/job-runs';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const rows = listRecentJobRuns(200);
    return NextResponse.json({ success: true, count: rows.length, data: rows });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
