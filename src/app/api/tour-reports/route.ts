import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tourId = searchParams.get('tourId')
    const userEmail = searchParams.get('userEmail')

    let query = supabase
      .from('tour_reports')
      .select(`
        *,
        tours (
          id,
          tour_date,
          tour_status,
          products (
            name_ko,
            name_en
          )
        )
      `)
      .order('submitted_on', { ascending: false })

    if (tourId) {
      query = query.eq('tour_id', tourId)
    }

    if (userEmail) {
      query = query.eq('user_email', userEmail)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching tour reports:', error)
      return NextResponse.json({ error: 'Failed to fetch tour reports' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in tour reports GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('tour_reports')
      .insert({
        ...body,
        user_email: user.email
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating tour report:', error)
      return NextResponse.json({ error: 'Failed to create tour report' }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Error in tour reports POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
