import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const status = searchParams.get('status') || 'active'

    // reservation_options 데이터 가져오기
    const { data: optionsData, error: optionsError } = await supabase
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
      .order('created_at', { ascending: false })

    if (optionsError) {
      console.error('Error fetching reservation options:', optionsError)
      return NextResponse.json({ error: optionsError.message }, { status: 500 })
    }

    if (format === 'csv') {
      // CSV 형식으로 변환
      const csvHeader = 'id,reservation_id,option_id,ea,price,status,created_at,updated_at\n'
      const csvRows = optionsData?.map(option => 
        `${option.id},${option.reservation_id},${option.option_id},${option.ea},${option.price},${option.status},${option.created_at},${option.updated_at}`
      ).join('\n') || ''

      const csvContent = csvHeader + csvRows

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="reservation_options.csv"'
        }
      })
    } else {
      // JSON 형식으로 반환
      return NextResponse.json({ data: optionsData })
    }
  } catch (error) {
    console.error('Error in reservation-options export API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
