import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { createServerSupabase } from '@/lib/supabase-server'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fetchScheduleDisplayData } from '@/lib/scheduleDisplayData'

export const dynamic = 'force-dynamic'

async function resolveAuthenticatedSupabase(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (token) {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      },
    )
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return supabase
  }

  const serverSupabase = await createServerSupabase()
  const {
    data: { session },
  } = await serverSupabase.auth.getSession()
  if (!session?.user) return null
  return serverSupabase
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await resolveAuthenticatedSupabase(request)
    if (!supabase) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const displayDayCount = Math.max(1, Number(searchParams.get('displayDayCount') || 15) || 15)
    const operatorId = resolveOperatorId(searchParams.get('operatorId'))

    const data = await fetchScheduleDisplayData(supabase, operatorId, displayDayCount)

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    })
  } catch (error) {
    console.error('schedule-display API error:', error)
    return NextResponse.json({ error: '스케줄 디스플레이 데이터를 불러오지 못했습니다.' }, { status: 500 })
  }
}
