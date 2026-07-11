import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

/** GET: 예약별 증거 첨부 목록 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sbOrErr = await getSupabaseForApiRoute(request)
    if (sbOrErr instanceof NextResponse) return sbOrErr

    const { id: reservationId } = await params
    if (!reservationId) {
      return NextResponse.json({ error: 'reservation id required' }, { status: 400 })
    }

    const { data, error } = await fromUntypedTable(sbOrErr, 'reservation_evidence_attachments')
      .select('id, file_path, file_name, image_url, created_at')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Evidence list error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (e) {
    console.error('Evidence GET error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST: 증거 첨부 추가 (이미 업로드된 imageUrl + filePath 저장) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sbOrErr = await getSupabaseForApiRoute(request)
    if (sbOrErr instanceof NextResponse) return sbOrErr

    const { id: reservationId } = await params
    if (!reservationId) {
      return NextResponse.json({ error: 'reservation id required' }, { status: 400 })
    }

    const body = await request.json()
    const { imageUrl, filePath, fileName } = body as { imageUrl: string; filePath?: string; fileName?: string }
    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })
    }

    const { data, error } = await fromUntypedTable(sbOrErr, 'reservation_evidence_attachments')
      .insert({
        reservation_id: reservationId,
        file_path: filePath || imageUrl,
        file_name: fileName || null,
        image_url: imageUrl,
      } as never)
      .select('id, file_path, file_name, image_url, created_at')
      .single()

    if (error) {
      console.error('Evidence insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error('Evidence POST error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
