import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reservationId = searchParams.get('reservation_id')
    const status = searchParams.get('status') || 'active'

    let query = supabase
      .from('reservation_options')
      .select(`
        id,
        reservation_id,
        option_id,
        ea,
        price,
        status,
        created_at,
        updated_at
      `)
      .eq('status', status)

    if (reservationId) {
      query = query.eq('reservation_id', reservationId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching reservation options:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in reservation-options API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reservation_id, option_id, ea, price, status = 'active' } = body

    if (!reservation_id || !option_id) {
      return NextResponse.json({ error: 'reservation_id and option_id are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('reservation_options')
      .insert({
        id: crypto.randomUUID(),
        reservation_id,
        option_id,
        ea: ea || 1,
        price: price || 0,
        status
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating reservation option:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in reservation-options POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ea, price, status } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (ea !== undefined) updateData.ea = ea
    if (price !== undefined) updateData.price = price
    if (status !== undefined) updateData.status = status

    const { data, error } = await supabase
      .from('reservation_options')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating reservation option:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in reservation-options PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('reservation_options')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting reservation option:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Reservation option deleted successfully' })
  } catch (error) {
    console.error('Error in reservation-options DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
