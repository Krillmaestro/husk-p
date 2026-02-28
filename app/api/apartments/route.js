import { NextResponse } from 'next/server';

export async function GET() {
  const { getAllApartments } = require('@/lib/db');
  const apartments = getAllApartments();
  return NextResponse.json(apartments);
}
