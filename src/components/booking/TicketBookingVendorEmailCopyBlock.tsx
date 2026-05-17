'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import {
  buildTicketBookingVendorEmailHtmlDocument,
  buildTicketBookingVendorTextHtmlDocument,
  formatTicketBookingVendorEmailPlainClipboard,
  wrapTicketBookingVendorEmailBodyHtml,
} from '@/lib/ticketBookingVendorEmail'
import { resolveTicketBookingVendorRecipient } from '@/lib/ticketBookingVendorEmailConfig'
import { sendTicketBookingVendorEmail } from '@/lib/sendTicketBookingVendorEmail'

export type TicketBookingVendorEmailCopyBlockProps = {
  subject: string
  bodyPlain: string
  bodyHtml: string
  bodyTextHtml: string
  company?: string
  className?: string
  /** true? ???? ??? ????? ?? */
  sendAndSaveEnabled?: boolean
  /** ?? ?? ?? ? ?? (?? ?) */
  onSendAndSave?: () => void | Promise<void>
  /** ?? ? ? ?? ??? */
  saving?: boolean
}

type PreviewTab = 'html' | 'text'

async function fetchSupplierEmailByCompanyName(company: string): Promise<string | null> {
  const name = company.trim()
  if (!name) return null
  const { data, error } = await supabase
    .from('suppliers')
    .select('email')
    .ilike('name', name)
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const em = String((data as { email?: string | null }).email || '').trim()
  return em || null
}

export default function TicketBookingVendorEmailCopyBlock({
  subject,
  bodyPlain,
  bodyHtml,
  bodyTextHtml,
  company,
  className = '',
  sendAndSaveEnabled = false,
  onSendAndSave,
  saving = false,
}: TicketBookingVendorEmailCopyBlockProps) {
  const t = useTranslations('booking.ticketBooking')
  const [supplierEmailFromDb, setSupplierEmailFromDb] = useState<string | null>(null)
  const [tab, setTab] = useState<PreviewTab>('html')
  const [copiedHtml, setCopiedHtml] = useState(false)
  const [copiedText, setCopiedText] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    let cancelled = false
    const c = String(company || '').trim()
    if (!c) {
      setSupplierEmailFromDb(null)
      return
    }
    void fetchSupplierEmailByCompanyName(c).then((em) => {
      if (!cancelled) setSupplierEmailFromDb(em)
    })
    return () => {
      cancelled = true
    }
  }, [company])

  const vendorEmail = useMemo(
    () => resolveTicketBookingVendorRecipient(String(company || ''), supplierEmailFromDb),
    [company, supplierEmailFromDb]
  )

  const previewHtml = useMemo(() => wrapTicketBookingVendorEmailBodyHtml(bodyHtml), [bodyHtml])
  const previewTextHtml = useMemo(
    () => wrapTicketBookingVendorEmailBodyHtml(bodyTextHtml),
    [bodyTextHtml]
  )
  const htmlDocument = useMemo(() => buildTicketBookingVendorEmailHtmlDocument(bodyHtml), [bodyHtml])
  const textHtmlDocument = useMemo(
    () => buildTicketBookingVendorTextHtmlDocument(bodyTextHtml),
    [bodyTextHtml]
  )
  const plainClipboard = useMemo(
    () => formatTicketBookingVendorEmailPlainClipboard(subject, bodyPlain),
    [subject, bodyPlain]
  )

  const copyRichToClipboard = useCallback(
    async (htmlDoc: string, onDone: () => void) => {
      try {
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([htmlDoc], { type: 'text/html' }),
              'text/plain': new Blob([plainClipboard], { type: 'text/plain' }),
            }),
          ])
          onDone()
          return
        }
      } catch {
        /* fallback */
      }

      try {
        await navigator.clipboard.writeText(plainClipboard)
        onDone()
        return
      } catch {
        /* textarea fallback */
      }

      const textArea = document.createElement('textarea')
      textArea.value = plainClipboard
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        onDone()
      } catch {
        alert(t('vendorEmailCopyFailed'))
      }
      document.body.removeChild(textArea)
    },
    [plainClipboard, t]
  )

  const copyToClipboard = useCallback(
    async (mode: 'html' | 'text', onDone: () => void) => {
      const doc = mode === 'html' ? htmlDocument : textHtmlDocument
      await copyRichToClipboard(doc, onDone)
    },
    [htmlDocument, textHtmlDocument, copyRichToClipboard]
  )

  const handleCopyHtml = useCallback(() => {
    void copyToClipboard('html', () => {
      setCopiedHtml(true)
      setTimeout(() => setCopiedHtml(false), 2000)
    })
  }, [copyToClipboard])

  const handleCopyText = useCallback(() => {
    void copyToClipboard('text', () => {
      setCopiedText(true)
      setTimeout(() => setCopiedText(false), 2000)
    })
  }, [copyToClipboard])

  const handleSendAndSave = useCallback(async () => {
    if (!vendorEmail || !onSendAndSave) return
    setSendingEmail(true)
    try {
      await sendTicketBookingVendorEmail({
        to: vendorEmail,
        subject,
        bodyHtml,
      })
      await onSendAndSave()
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('vendorEmailSendFailed')
      alert(msg)
    } finally {
      setSendingEmail(false)
    }
  }, [vendorEmail, onSendAndSave, subject, bodyHtml, t])

  const mailtoHref =
    vendorEmail ?
      `mailto:${encodeURIComponent(vendorEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyPlain)}`
    : null

  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 p-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-800">{t('vendorEmailBlockTitle')}</div>
        <div className="flex flex-wrap items-center gap-2">
          {vendorEmail ?
            <span className="text-[10px] text-slate-600">
              {t('vendorEmailTo')}:{' '}
              <span className="font-mono text-slate-800">{vendorEmail}</span>
            </span>
          : company ?
            <span className="text-[10px] text-amber-700">{t('vendorEmailNoEmail')}</span>
          : null}
          {mailtoHref ?
            <a
              href={mailtoHref}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              {t('vendorEmailMailApp')}
            </a>
          : null}
        </div>
      </div>

      <p className="mt-1 text-[10px] text-slate-500">{t('vendorEmailBlockHint')}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setTab('html')}
            className={`rounded px-2.5 py-1 font-medium ${
              tab === 'html' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            HTML
          </button>
          <button
            type="button"
            onClick={() => setTab('text')}
            className={`rounded px-2.5 py-1 font-medium ${
              tab === 'text' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Text
          </button>
        </div>
        {tab === 'html' ?
          <button
            type="button"
            onClick={() => void handleCopyHtml()}
            className="inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-900"
          >
            {copiedHtml ?
              <>
                <Check className="h-3.5 w-3.5" aria-hidden />
                {t('vendorEmailCopyHtmlDone')}
              </>
            : <>
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {t('vendorEmailCopyHtml')}
              </>
            }
          </button>
        : <button
            type="button"
            onClick={() => void handleCopyText()}
            className="inline-flex items-center gap-1 rounded border border-slate-400 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-100"
          >
            {copiedText ?
              <>
                <Check className="h-3.5 w-3.5" aria-hidden />
                {t('vendorEmailCopyTextDone')}
              </>
            : <>
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {t('vendorEmailCopyText')}
              </>
            }
          </button>
        }
      </div>

      <p className="mt-2 text-[10px] font-medium text-slate-600">
        {t('vendorEmailSubject')}: <span className="font-normal text-slate-800">{subject}</span>
      </p>

      {tab === 'html' ?
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-300 bg-slate-200/80 p-4">
          <div
            className="mx-auto min-w-[280px] max-w-full [&_table]:w-full"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      : <div className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div
            className="text-sm leading-relaxed text-slate-900"
            dangerouslySetInnerHTML={{ __html: previewTextHtml }}
          />
          <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
            {t('vendorEmailTextRichHint')}
          </p>
        </div>
      }

      {sendAndSaveEnabled && onSendAndSave ?
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3">
          <p className="mr-auto text-[10px] text-slate-500">{t('vendorEmailSendAndSaveHint')}</p>
          <button
            type="button"
            disabled={!vendorEmail || saving || sendingEmail}
            onClick={() => void handleSendAndSave()}
            className="rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving || sendingEmail ? t('vendorEmailSendAndSaveBusy') : t('vendorEmailSendAndSave')}
          </button>
        </div>
      : null}
    </div>
  )
}
