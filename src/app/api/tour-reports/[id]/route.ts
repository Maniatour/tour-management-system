import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
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
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching tour report:', error)
      return NextResponse.json({ error: 'Tour report not found' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in tour report GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const body = await request.json()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: existingReport, error: fetchError } = await supabase
      .from('tour_reports')
      .select('user_email')
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: 'Tour report not found' }, { status: 404 })
    }

    const { data: teamMember } = await supabase
      .from('team')
      .select('position')
      .eq('email', user.email)
      .single()

    const isAdmin = teamMember?.position === 'admin'
    const isOwner = existingReport.user_email === user.email

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('tour_reports')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating tour report:', error)
      return NextResponse.json({ error: 'Failed to update tour report' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in tour report PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: teamMember } = await supabase
      .from('team')
      .select('position')
      .eq('email', user.email)
      .single()

    if (teamMember?.position !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('tour_reports')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting tour report:', error)
      return NextResponse.json({ error: 'Failed to delete tour report' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in tour report DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
