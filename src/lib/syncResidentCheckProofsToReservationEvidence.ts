import { supabaseAdmin } from '@/lib/supabase'
import { parseResidentCheckProofUrls } from '@/lib/residentCheckProofUrls'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

const GUEST_ID_FILE_NAME = 'resident-check-id'
const GUEST_PASS_FILE_NAME = 'resident-check-pass'

type EvidenceRow = {
  id: string
  image_url: string | null
  file_name: string | null
}

function isGuestEvidenceFileName(fileName: string | null | undefined): boolean {
  const name = String(fileName || '')
  return name === GUEST_ID_FILE_NAME || name === GUEST_PASS_FILE_NAME
}

function storagePathFromPublicUrl(publicUrl: string): string {
  const marker = '/storage/v1/object/public/images/'
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return publicUrl
  const path = publicUrl.slice(idx + marker.length).split('?')[0]
  return path ? decodeURIComponent(path) : publicUrl
}

/** Copy guest resident-check photos into 예약 사진/파일 증빙 so they appear in the edit modal. */
export async function syncResidentCheckProofsToReservationEvidence(
  reservationId: string
): Promise<void> {
  if (!supabaseAdmin || !reservationId) return

  const { data: tokens } = await supabaseAdmin
    .from('resident_check_tokens')
    .select('id')
    .eq('reservation_id', reservationId)

  const tokenIds = (tokens || []).map((row) => (row as { id: string }).id).filter(Boolean)
  const idUrls: string[] = []
  const passUrls: string[] = []

  if (tokenIds.length > 0) {
    const { data: submissions } = await supabaseAdmin
      .from('resident_check_submissions')
      .select('id_proof_url, pass_photo_url')
      .in('token_id', tokenIds)

    for (const row of submissions || []) {
      const s = row as { id_proof_url?: string | null; pass_photo_url?: string | null }
      idUrls.push(...parseResidentCheckProofUrls(s.id_proof_url))
      passUrls.push(...parseResidentCheckProofUrls(s.pass_photo_url))
    }
  }

  const desired: Array<{ url: string; fileName: string }> = []
  const seen = new Set<string>()
  for (const item of [
    ...idUrls.map((url) => ({ url, fileName: GUEST_ID_FILE_NAME })),
    ...passUrls.map((url) => ({ url, fileName: GUEST_PASS_FILE_NAME })),
  ]) {
    if (seen.has(item.url)) continue
    seen.add(item.url)
    desired.push(item)
  }
  const desiredUrls = new Set(desired.map((item) => item.url))

  const { data: existing, error: listErr } = await fromUntypedTable(
    supabaseAdmin,
    'reservation_evidence_attachments'
  )
    .select('id, image_url, file_name')
    .eq('reservation_id', reservationId)

  if (listErr) {
    console.error('resident-check evidence list', listErr)
    return
  }

  const rows = (existing || []) as EvidenceRow[]
  const existingUrls = new Set(
    rows.map((row) => row.image_url).filter((url): url is string => Boolean(url))
  )

  const toInsert = desired.filter((item) => !existingUrls.has(item.url))
  if (toInsert.length > 0) {
    const { error: insertErr } = await fromUntypedTable(
      supabaseAdmin,
      'reservation_evidence_attachments'
    ).insert(
      toInsert.map((item) => ({
        reservation_id: reservationId,
        file_path: storagePathFromPublicUrl(item.url),
        file_name: item.fileName,
        image_url: item.url,
      }))
    )
    if (insertErr) {
      console.error('resident-check evidence insert', insertErr)
    }
  }

  const staleIds = rows
    .filter(
      (row) =>
        isGuestEvidenceFileName(row.file_name) &&
        row.image_url &&
        !desiredUrls.has(row.image_url)
    )
    .map((row) => row.id)

  if (staleIds.length > 0) {
    const { error: deleteErr } = await fromUntypedTable(
      supabaseAdmin,
      'reservation_evidence_attachments'
    )
      .delete()
      .in('id', staleIds)
    if (deleteErr) {
      console.error('resident-check evidence delete', deleteErr)
    }
  }
}
