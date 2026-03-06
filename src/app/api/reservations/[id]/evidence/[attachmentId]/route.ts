import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/** DELETE: 증거 첨부 삭제 (DB 행 삭제, 스토리지 삭제는 선택) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id: reservationId, attachmentId } = await params
    if (!reservationId || !attachmentId) {
      return NextResponse.json({ error: 'reservation id and attachment id required' }, { status: 400 })
    }

    const { data: row, error: fetchError } = await supabase
      .from('reservation_evidence_attachments')
      .select('file_path')
      .eq('id', attachmentId)
      .eq('reservation_id', reservationId)
      .single()

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from('reservation_evidence_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('reservation_id', reservationId)

    if (deleteError) {
      console.error('Evidence delete error:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    if (row.file_path && row.file_path.startsWith('reservation-evidence/')) {
      await supabase.storage.from('images').remove([row.file_path])
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Evidence DELETE error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
