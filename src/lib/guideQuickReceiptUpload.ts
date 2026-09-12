import { supabase } from '@/lib/supabase'
import { ensureFreshAuthSessionForUpload } from '@/lib/uploadClient'
import {
  EMPTY_RECEIPT_FILE,
  isLikelyReceiptImageFile,
  prepareReceiptImageForUpload,
} from '@/lib/imageUtils'
import { lookupTourOperatorId } from '@/lib/operators/lookupTourOperatorId'
import { TOUR_EXPENSE_RECEIPT_PENDING_PAID_FOR } from '@/lib/tourExpenseConstants'
import { buildReceiptOcrCandidates } from '@/lib/receiptOcrParse'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'

const TOUR_RECEIPT_MAX_STORAGE_BYTES = 10 * 1024 * 1024
const TOUR_RECEIPT_MAX_ORIGINAL_BYTES = 35 * 1024 * 1024

export type GuideQuickReceiptUploadParams = {
  file: File
  tourId: string
  tourDate: string
  productId?: string | null
  uploadedBy: string
  ocrText?: string
  note?: string
}

function receiptNote(ocrText?: string, note?: string): string {
  const lines = [note?.trim() || 'Receipt uploaded from guide camera; hidden from guest photo album.']
  const text = (ocrText || '').trim()
  if (text) {
    const candidates = buildReceiptOcrCandidates(text)
    if (candidates.paid_to) lines.push(`[OCR] Vendor: ${candidates.paid_to.slice(0, 200)}`)
    if (candidates.amount != null && candidates.amount > 0) {
      lines.push(`[OCR] Amount: ${candidates.amount.toFixed(2)}`)
    }
    if (candidates.date) lines.push(`[OCR] Date: ${candidates.date}`)
  }
  return lines.join('\n')
}

export async function uploadGuideQuickReceipt(params: GuideQuickReceiptUploadParams): Promise<void> {
  const { file, tourId, tourDate, productId, uploadedBy, ocrText, note } = params
  if (!isLikelyReceiptImageFile(file) || file.size <= 0) {
    throw new Error(EMPTY_RECEIPT_FILE)
  }

  const prepared = await prepareReceiptImageForUpload(
    file,
    TOUR_RECEIPT_MAX_STORAGE_BYTES,
    TOUR_RECEIPT_MAX_ORIGINAL_BYTES
  )
  if (prepared.size <= 0) throw new Error(EMPTY_RECEIPT_FILE)

  await ensureFreshAuthSessionForUpload()

  const fileExt = prepared.type === 'image/jpeg' ? 'jpg' : prepared.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
  const filePath = `tour-expenses/${tourId}/${fileName}`

  const { error: uploadError } = await supabase.storage.from('tour-expenses').upload(filePath, prepared, {
    contentType: prepared.type || 'image/jpeg',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const {
    data: { publicUrl },
  } = supabase.storage.from('tour-expenses').getPublicUrl(filePath)
  if (!publicUrl) throw new Error('Receipt public URL missing')

  const operatorId = await lookupTourOperatorId(supabase, tourId)
  const candidates = ocrText ? buildReceiptOcrCandidates(ocrText) : null
  const amount =
    candidates?.amount != null && Number.isFinite(candidates.amount) && candidates.amount > 0
      ? candidates.amount
      : 0

  const { error: insertError } = await supabase.from('tour_expenses').insert({
    tour_id: tourId,
    paid_to: candidates?.paid_to?.trim() || null,
    paid_for: TOUR_EXPENSE_RECEIPT_PENDING_PAID_FOR,
    amount,
    payment_method: null,
    note: receiptNote(ocrText, note),
    tour_date: tourDate || todayInLasVegas(),
    product_id: productId || null,
    submitted_by: uploadedBy,
    image_url: publicUrl,
    file_path: filePath,
    status: 'pending',
    operator_id: operatorId,
  })

  if (insertError) {
    await supabase.storage.from('tour-expenses').remove([filePath])
    throw insertError
  }
}
