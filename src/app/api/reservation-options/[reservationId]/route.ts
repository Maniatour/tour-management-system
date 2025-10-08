import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  try {
    const { reservationId } = await params

    if (!reservationId) {
      return NextResponse.json({ error: 'Reservation ID is required' }, { status: 400 })
    }

    // reservation_options 테이블에서 해당 예약의 옵션들을 가져오기
    const { data: reservationOptions, error } = await supabase
      .from('reservation_options')
      .select(`
        id,
        reservation_id,
        option_id,
        ea,
        price,
        total_price,
        status,
        note,
        created_at,
        updated_at
      `)
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching reservation options:', error)
      return NextResponse.json({ error: 'Failed to fetch reservation options' }, { status: 500 })
    }

    // 옵션 이름을 별도로 조회
    const optionIds = (reservationOptions || []).map(option => option.option_id).filter(Boolean)
    let optionNames: Record<string, string> = {}
    
    if (optionIds.length > 0) {
      const { data: options, error: optionsError } = await supabase
        .from('options')
        .select('id, name')
        .in('id', optionIds)
      
      if (!optionsError && options) {
        optionNames = options.reduce((acc, option) => {
          acc[option.id] = option.name
          return acc
        }, {} as Record<string, string>)
      }
    }

    // 데이터 변환하여 옵션 이름 포함
    const transformedOptions = (reservationOptions || []).map(option => ({
      ...option,
      option_name: optionNames[option.option_id] || option.option_id,
      status: option.status || 'active'
    }))

    return NextResponse.json({ reservationOptions: transformedOptions })
  } catch (error) {
    console.error('Error in reservation options API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  try {
    const { reservationId } = await params
    const body = await request.json()

    if (!reservationId) {
      return NextResponse.json({ error: 'Reservation ID is required' }, { status: 400 })
    }

    const { option_id, ea, price, total_price, status, note } = body

    // 새 reservation_option 생성
    const { data, error } = await supabase
      .from('reservation_options')
      .insert({
        reservation_id: reservationId,
        option_id,
        ea: ea || 1,
        price: price || 0,
        total_price: total_price || (price || 0) * (ea || 1),
        status: status || 'active',
        note: note || null
      })
      .select()

    if (error) {
      console.error('Error creating reservation option:', error)
      return NextResponse.json({ error: 'Failed to create reservation option' }, { status: 500 })
    }

    return NextResponse.json({ reservationOption: data[0] })
  } catch (error) {
    console.error('Error in reservation options POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  try {
    const { reservationId } = await params
    const body = await request.json()

    if (!reservationId) {
      return NextResponse.json({ error: 'Reservation ID is required' }, { status: 400 })
    }

    const { id, option_id, ea, price, total_price, status, note } = body

    if (!id) {
      return NextResponse.json({ error: 'Option ID is required for update' }, { status: 400 })
    }

    // reservation_option 업데이트
    const { data, error } = await supabase
      .from('reservation_options')
      .update({
        option_id,
        ea: ea || 1,
        price: price || 0,
        total_price: total_price || (price || 0) * (ea || 1),
        status: status || 'active',
        note: note || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('reservation_id', reservationId)
      .select()

    if (error) {
      console.error('Error updating reservation option:', error)
      return NextResponse.json({ error: 'Failed to update reservation option' }, { status: 500 })
    }

    return NextResponse.json({ reservationOption: data[0] })
  } catch (error) {
    console.error('Error in reservation options PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  try {
    const { reservationId } = await params
    const { searchParams } = new URL(request.url)
    const optionId = searchParams.get('optionId')

    if (!reservationId || !optionId) {
      return NextResponse.json({ error: 'Reservation ID and Option ID are required' }, { status: 400 })
    }

    // reservation_option 삭제
    const { error } = await supabase
      .from('reservation_options')
      .delete()
      .eq('id', optionId)
      .eq('reservation_id', reservationId)

    if (error) {
      console.error('Error deleting reservation option:', error)
      return NextResponse.json({ error: 'Failed to delete reservation option' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in reservation options DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
