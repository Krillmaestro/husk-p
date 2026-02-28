import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const { id } = await params;
  const { getApartment } = require('@/lib/db');
  const apt = getApartment(Number(id));
  if (!apt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(apt);
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  const { updateApartment } = require('@/lib/db');
  const updated = updateApartment(Number(id), body);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { deleteApartment } = require('@/lib/db');
  const deleted = deleteApartment(Number(id));
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
