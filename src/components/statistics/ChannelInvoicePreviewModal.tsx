'use client'

import React, { useRef } from 'react'
import { X, Printer, Download } from 'lucide-react'
import type { ChannelInvoiceItem } from '@/utils/pdfExport'
import { generateChannelInvoicePDF } from '@/utils/pdfExport'

/** 영수증 모달(`CustomerReceiptModal`) 레터헤드와 동일 */
const COMPANY = {
  name: 'LAS VEGAS MANIA TOUR',
  logoUrl:
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_COMPANY_LOGO_URL
      ? process.env.NEXT_PUBLIC_COMPANY_LOGO_URL
      : '/favicon.png',
  address: '3351 S. Highland Dr #202 , Las Vegas, NV 89109 USA',
  lic: 'Lic #: 2002495.056-121',
  email: 'vegasmaniatour@gmail.com',
  website: 'www.maniatour.com',
  phone: '1-702-929-8025 / 1-702-444-5531',
}

const PAYMENT = {
  name: 'TRIP MANIA LLC',
  address: '4525 Spring Mountain Rd #108, Las Vegas, NV 89102',
  swiftCode: 'WFBIUS6SLAS',
  abaNo: '321270742',
  accountNo: '7830554007',
  bankName: 'Wells Fargo Bank',
  bankAddress: '4425 Spring Mountain Rd, Las Vegas, NV 89102',
}

const DEFAULT_TO_LINES = [
  'Taiwanmania.com International Travel Service Co., Ltd. KKDAY',
  '11F., No. 18, Aly. 1, Ln. 768, Sec. 4, Bade Rd.,',
  'Nangang Dist., Taipei City 115, Taiwan (R.O.C.)',
  'Taiwan',
]

/** 모달·인쇄 창 공통 (innerHTML 인쇄 시 Tailwind 미적용 → 클래스 전용 CSS) */
const CHANNEL_INVOICE_DOC_CSS = `
.cinv-root{font-family:Helvetica,Arial,sans-serif;color:#111;font-size:12px;line-height:1.35;max-width:216mm;margin:0 auto;box-sizing:border-box;}
.cinv-header{border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-bottom:8px;}
.cinv-header-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;}
.cinv-logo{width:10.5rem;height:3rem;object-fit:contain;display:block;}
.cinv-addr{font-size:12px;color:#4b5563;line-height:1.25;margin:2px 0 0 0;}
.cinv-meta-right{text-align:right;font-size:12px;color:#4b5563;}
.cinv-meta-right p{margin:2px 0;}
.cinv-web{color:#2563eb;text-decoration:underline;}
.cinv-title{text-align:center;font-weight:bold;font-size:16px;padding:6px 0;margin:0 0 8px 0;border-bottom:1px solid #f3f4f6;text-transform:uppercase;letter-spacing:.05em;color:#111;}
.cinv-to{font-size:12px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;}
.cinv-to p{margin:2px 0;}
.cinv-to-label{font-weight:bold;color:#111;margin-bottom:4px!important;}
.cinv-period{font-size:12px;margin-bottom:8px;}
.cinv-period-grid{display:grid;grid-template-columns:1fr 1fr;column-gap:16px;row-gap:2px;}
.cinv-period-grid p{margin:2px 0;min-width:0;}
.cinv-muted{color:#4b5563;}
.cinv-table-wrap{border-top:1px solid #e5e7eb;padding-top:6px;}
.cinv-table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed;}
.cinv-table th,.cinv-table td{padding:4px 6px;border-bottom:1px solid #e5e7eb;word-wrap:break-word;}
.cinv-table thead th{background:#f3f4f6;font-weight:600;color:#374151;font-size:10px;text-transform:uppercase;}
.cinv-table tbody tr:nth-child(even){background:#fafafa;}
.cinv-table tfoot td{background:#f3f4f6;font-weight:bold;}
.cinv-payment{margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;}
.cinv-payment-title{font-weight:bold;margin-bottom:8px;}
.cinv-payment p{margin:3px 0;}
`

interface ChannelInvoicePreviewModalProps {
  channelName: string
  dateRange: { start: string; end: string }
  items: ChannelInvoiceItem[]
  onClose: () => void
}

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ChannelInvoicePreviewModal({
  channelName,
  dateRange,
  items,
  onClose,
}: ChannelInvoicePreviewModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const subtotalOriginal = items.reduce((s, i) => s + i.originalPrice, 0)
  const subtotalCommission = items.reduce((s, i) => s + i.commission, 0)
  const subtotalPrice = items.reduce((s, i) => s + i.price, 0)

  const periodLabel = `${dateRange.start} – ${dateRange.end}`

  const handlePrint = () => {
    if (!printRef.current) return
    const content = printRef.current.innerHTML
    const safeTitle = `${channelName} Invoice`.replace(/</g, '')
    const win = window.open('', '_blank')
    if (!win) return

    const doc = win.document
    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${safeTitle}</title>
          <style>
            body { margin: 0; padding: 16px 20px; background: #fff; color: #111; }
          </style>
        </head>
        <body>
          <div class="invoice-print-root">${content}</div>
        </body>
      </html>
    `)
    doc.close()

    const runPrint = () => {
      try {
        win.focus()
        win.print()
      } catch {
        /* Chromium: 인쇄 직후 창을 닫으면 "callback is no longer runnable" 등 */
      }
      const closeWhenDone = () => {
        try {
          if (!win.closed) win.close()
        } catch {
          /* ignore */
        }
      }
      win.addEventListener('afterprint', closeWhenDone, { once: true })
    }

    if (doc.readyState === 'complete') {
      requestAnimationFrame(() => requestAnimationFrame(runPrint))
    } else {
      win.addEventListener('load', runPrint, { once: true })
    }
  }

  const handleDownloadPDF = () => {
    generateChannelInvoicePDF({
      channelName,
      dateRange,
      items,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-[min(95vw,216mm)] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">{channelName} 인보이스 미리보기</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
              인쇄
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF 다운로드
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 flex flex-col items-center bg-gray-50/80">
          <div ref={printRef} className="bg-white p-4 w-full max-w-[216mm] shadow-sm border border-gray-100 rounded-sm">
            <style>{CHANNEL_INVOICE_DOC_CSS}</style>
            <div className="cinv-root">
              <div className="cinv-header">
                <div className="cinv-header-row">
                  <div>
                    <img src={COMPANY.logoUrl} alt="" className="cinv-logo" />
                    <p className="cinv-addr">{COMPANY.address}</p>
                  </div>
                  <div className="cinv-meta-right">
                    <p>{COMPANY.lic}</p>
                    <p>{COMPANY.email}</p>
                    <p className="cinv-web">{COMPANY.website}</p>
                    <p>{COMPANY.phone}</p>
                  </div>
                </div>
              </div>

              <h1 className="cinv-title">INVOICE</h1>

              <div className="cinv-to">
                <p className="cinv-to-label">To:</p>
                {DEFAULT_TO_LINES.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>

              <div className="cinv-period">
                <div className="cinv-period-grid">
                  <p>
                    <span className="cinv-muted">Channel:</span> {channelName}
                  </p>
                  <p style={{ textAlign: 'right' }}>
                    <span className="cinv-muted">Period:</span> {periodLabel}
                  </p>
                </div>
              </div>

              <div className="cinv-table-wrap">
                <table className="cinv-table">
                  <thead>
                    <tr>
                      <th style={{ width: '7%' }}>Res. DATE</th>
                      <th style={{ width: '7%' }}>Tour Date</th>
                      <th style={{ width: '9%' }}>Booking #</th>
                      <th style={{ width: '18%' }}>DESCRIPTION</th>
                      <th style={{ width: '12%' }}>Guest Name</th>
                      <th style={{ width: '6%', textAlign: 'center' }}>QTY</th>
                      <th style={{ width: '7%', textAlign: 'center' }}>COMM %</th>
                      <th style={{ width: '11%', textAlign: 'right' }}>ORIG. PRICE</th>
                      <th style={{ width: '10%', textAlign: 'right' }}>COMMISION</th>
                      <th style={{ width: '10%', textAlign: 'right' }}>PRICE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', color: '#6b7280', padding: '16px' }}>
                          내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      items.map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.reservationDate}</td>
                          <td>{row.tourDate}</td>
                          <td>{row.bookingNumber}</td>
                          <td title={row.description}>{row.description}</td>
                          <td title={row.guestName}>{row.guestName}</td>
                          <td style={{ textAlign: 'center' }}>{row.quantity}</td>
                          <td style={{ textAlign: 'center' }}>{row.commissionPercent}%</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(row.originalPrice)}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(row.commission)}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(row.price)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={7}>SUBTOTAL</td>
                      <td style={{ textAlign: 'right' }}>{fmt(subtotalOriginal)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(subtotalCommission)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(subtotalPrice)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="cinv-payment">
                <p className="cinv-payment-title">Payment Info</p>
                <p>Name: {PAYMENT.name}</p>
                <p>Address: {PAYMENT.address}</p>
                <p>Swift Code: {PAYMENT.swiftCode}</p>
                <p>ABA NO: {PAYMENT.abaNo}</p>
                <p>Account #: {PAYMENT.accountNo}</p>
                <p>Bank Name: {PAYMENT.bankName}</p>
                <p>Bank Address: {PAYMENT.bankAddress}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
