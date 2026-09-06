import { NextResponse } from 'next/server'

/** Removed GIS helper. Stub kept so Windows Tailwind HMR does not crash on a deleted content file. */
export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
