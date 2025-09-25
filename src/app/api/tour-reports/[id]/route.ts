import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
      .eq('id', params.id)
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
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user owns the report or is admin
    const { data: existingReport, error: fetchError } = await supabase
      .from('tour_reports')
      .select('user_email')
      .eq('id', params.id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: 'Tour report not found' }, { status: 404 })
    }

    // Check if user is admin
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
      .eq('id', params.id)
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
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
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
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting tour report:', error)
      return NextResponse.json({ error: 'Failed to delete tour report' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Tour report deleted successfully' })
  } catch (error) {
    console.error('Error in tour report DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
