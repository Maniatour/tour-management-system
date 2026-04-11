import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

const db = supabaseAdmin ?? supabase

/** GET ?q= — paid_for autocomplete from reservation_expenses (recent, deduped) */
export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get('q') ?? '').trim()

    let query = db
      .from('reservation_expenses')
      .select('paid_for')
      .not('paid_for', 'is', null)
      .neq('paid_for', '')

    if (q) {
      query = query.ilike('paid_for', `%${q}%`)
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(120)

    if (error) {
      console.error('suggestions paid_for:', error)
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      )
    }

    const seen = new Set<string>()
    const values: string[] = []
    for (const row of data || []) {
      const v = String((row as { paid_for: string }).paid_for).trim()
      if (!v || seen.has(v)) continue
      seen.add(v)
      values.push(v)
      if (values.length >= 30) break
    }

    return NextResponse.json({ success: true, values })
  } catch (e) {
    console.error('GET /api/reservation-expenses/suggestions', e)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
