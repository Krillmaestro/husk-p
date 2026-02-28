import { NextResponse } from 'next/server';

export async function GET() {
  const { getAllApartments } = require('@/lib/db');
  const apartments = getAllApartments();
  return NextResponse.json(apartments);
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.addr || !body.addr.trim()) {
      return NextResponse.json({ error: 'Adress krävs' }, { status: 400 });
    }
    const { createApartment } = require('@/lib/db');
    const apt = createApartment(body);
    return NextResponse.json(apt, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
