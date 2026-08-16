import type { SupabaseClient } from '@supabase/supabase-js'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { zelleConfirmationTokens } from '@/lib/zellePaymentEmail'

export const ZELLE_EMAIL_ATTACHMENT_PREFIX = 'zelle-email:'

export function zelleEmailAttachmentUrl(importId: string): string {
  return `${ZELLE_EMAIL_ATTACHMENT_PREFIX}${importId}`
}

export function parseZelleEmailImportId(url: string | null | undefined): string | null {
  const s = String(url ?? '').trim()
  if (!s.startsWith(ZELLE_EMAIL_ATTACHMENT_PREFIX)) return null
  const id = s.slice(ZELLE_EMAIL_ATTACHMENT_PREFIX.length).trim()
  return id || null
}

export function isZelleEmailAttachmentUrl(url: string | null | undefined): boolean {
  return parseZelleEmailImportId(url) != null
}

export function ticketZelleAttachmentKey(company: string, invoiceNumber: string): string {
  return `${company.trim()}\u0000${invoiceNumber.trim()}`
}

export function bookingHasZelleAttachment(
  booking: {
    company?: string | null
    invoice_number?: string | null
    rn_number?: string | null
  },
  map: Map<string, string[]> | undefined
): boolean {
  if (!map || map.size === 0) return false
  const company = String(booking.company ?? '').trim()
  const candidates = [booking.invoice_number, booking.rn_number]
    .map((raw) => String(raw ?? '').trim())
    .filter(Boolean)
  for (const inv of candidates) {
    const stripped = inv.replace(/^#+/, '')
    for (const key of [ticketZelleAttachmentKey(company, inv), ticketZelleAttachmentKey(company, stripped)]) {
      if ((map.get(key)?.length ?? 0) > 0) return true
    }
  }
  return false
}

/** 부킹에 Zelle Conf#가 있으면 이메일 연결·송금 처리가 된 것으로 본다 */
export function bookingHasZelleConfirmationNumber(booking: {
  zelle_confirmation_number?: string | null
}): boolean {
  return zelleConfirmationTokens(booking.zelle_confirmation_number).length > 0
}

/** 스크린샷/메일 첨부 또는 Conf# — 달력 ‘Zelle 미연결’ 강조용 */
export function bookingHasZelleConnection(
  booking: {
    company?: string | null
    invoice_number?: string | null
    rn_number?: string | null
    zelle_confirmation_number?: string | null
  },
  map?: Map<string, string[]>
): boolean {
  if (bookingHasZelleConfirmationNumber(booking)) return true
  return bookingHasZelleAttachment(booking, map)
}

function normalizeUrlList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((u): u is string => typeof u === 'string' && u.trim() !== '')
}

/** Invoice# 단위 Zelle 첨부에 송금 메일 링크를 넣는다. */
export async function attachZelleEmailToBookings(
  client: SupabaseClient,
  importId: string,
  bookings: Array<{
    id: string
    company: string | null
    invoice_number?: string | null
    rn_number?: string | null
  }>
): Promise<number> {
  const emailUrl = zelleEmailAttachmentUrl(importId)
  let attached = 0
  for (const booking of bookings) {
    const company = String(booking.company ?? '').trim()
    let invoice = String(booking.invoice_number ?? '').trim()
    if (!invoice) {
      invoice = String(booking.rn_number ?? '').trim().replace(/^#+/, '')
      if (invoice) {
        await client.from('ticket_bookings').update({ invoice_number: invoice }).eq('id', booking.id)
      }
    }
    if (!company || !invoice) continue

    const { data: row, error: fetchErr } = await fromUntypedTable(client, 'ticket_invoice_attachments')
      .select('file_urls, zelle_file_urls')
      .eq('company', company)
      .eq('invoice_number', invoice)
      .maybeSingle()
    if (fetchErr) {
      console.error('[zelle-email] attach lookup', booking.id, fetchErr.message)
      continue
    }

    const fileUrls = normalizeUrlList(row?.file_urls)
    const zelleUrls = normalizeUrlList(row?.zelle_file_urls)
    if (zelleUrls.includes(emailUrl)) {
      attached += 1
      continue
    }
    const nextZelle = [...zelleUrls, emailUrl]
    const payload = {
      company,
      invoice_number: invoice,
      file_urls: fileUrls,
      zelle_file_urls: nextZelle,
      updated_at: new Date().toISOString(),
    }
    const { error: upErr } = await fromUntypedTable(client, 'ticket_invoice_attachments').upsert(payload, {
      onConflict: 'company,invoice_number',
    })
    if (upErr) {
      console.error('[zelle-email] attach upsert', booking.id, upErr.message)
      continue
    }
    attached += 1
  }
  return attached
}
