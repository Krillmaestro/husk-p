import { NextResponse } from 'next/server';

export async function GET() {
  const { getActivityLog } = require('@/lib/db');
  const log = getActivityLog();
  return NextResponse.json(log);
}
