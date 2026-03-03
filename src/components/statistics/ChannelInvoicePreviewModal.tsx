'use client'

import React, { useRef } from 'react'
import { X, Printer, Download } from 'lucide-react'
import type { ChannelInvoiceItem } from '@/utils/pdfExport'
import { generateChannelInvoicePDF } from '@/utils/pdfExport'

const COMPANY = {
  name: 'Las Vegas Mania',
  address: '4525 Spring Mountain Rd #108, Las Vegas, Nevada 89102, United States',
  license: '2002495.056-121',
  email: 'vegasmaniatour@gmail.com',
  website: 'www.lasvegas-mania.com',
  phone: '1-702-444-5531'
}

const PAYMENT = {
  name: 'TRIP MANIA LLC',
  address: '4525 Spring Mountain Rd #108, Las Vegas, NV 89102',
  swiftCode: 'WFBIUS6SLAS',
  abaNo: '321270742',
  accountNo: '7830554007',
  bankName: 'Wells Fargo Bank',
  bankAddress: '4425 Spring Mountain Rd, Las Vegas, NV 89102'
}

const DEFAULT_TO_LINES = [
  'Taiwanmania.com International Travel Service Co., Ltd. KKDAY',
  '11F., No. 18, Aly. 1, Ln. 768, Sec. 4, Bade Rd.,',
  'Nangang Dist., Taipei City 115, Taiwan (R.O.C.)',
  'Taiwan'
]

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
  onClose
}: ChannelInvoicePreviewModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const subtotalOriginal = items.reduce((s, i) => s + i.originalPrice, 0)
  const subtotalCommission = items.reduce((s, i) => s + i.commission, 0)
  const subtotalPrice = items.reduce((s, i) => s + i.price, 0)

  const handlePrint = () => {
    if (!printRef.current) return
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${channelName} Invoice</title>
          <style>
            body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; padding: 20px; color: #111; }
            .invoice-title { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 16px; }
            .from-to { margin-bottom: 16px; }
            .from-to p { margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
            th { background: #800080; color: #fff; padding: 6px 8px; text-align: left; font-weight: bold; }
            td { padding: 4px 8px; border-bottom: 1px solid #eee; }
            .subtotal { font-weight: bold; margin-top: 12px; }
            .payment-info { margin-top: 20px; }
            .payment-info p { margin: 3px 0; }
          </style>
        </head>
        <body>
          <div class="invoice-print">${content}</div>
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => {
      win.print()
      win.close()
    }, 300)
  }

  const handleDownloadPDF = () => {
    generateChannelInvoicePDF({
      channelName,
      dateRange,
      items
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
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
        <div className="flex-1 overflow-auto p-6">
          <div ref={printRef} className="invoice-preview bg-white text-gray-900">
            <h1 className="invoice-title text-center text-xl font-bold mb-4">
              {channelName} Invoice
            </h1>
            <div className="from-to grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6 text-sm">
              <div>
                <p className="font-semibold mb-1">From:</p>
                <p>{COMPANY.name}</p>
                <p>{COMPANY.address}</p>
                <p>License No: {COMPANY.license}</p>
                <p>{COMPANY.email}</p>
                <p>{COMPANY.website}</p>
                <p>{COMPANY.phone}</p>
              </div>
              <div>
                <p className="font-semibold mb-1">To:</p>
                {DEFAULT_TO_LINES.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 text-xs">
                <thead>
                  <tr className="bg-[#800080] text-white">
                    <th className="px-2 py-2 text-left font-semibold">Reservation DATE</th>
                    <th className="px-2 py-2 text-left font-semibold">Tour Date</th>
                    <th className="px-2 py-2 text-left font-semibold">Booking #</th>
                    <th className="px-2 py-2 text-left font-semibold">DESCRIPTION</th>
                    <th className="px-2 py-2 text-left font-semibold">Guest Name</th>
                    <th className="px-2 py-2 text-center font-semibold">QUANTITY</th>
                    <th className="px-2 py-2 text-center font-semibold">COMMISION %</th>
                    <th className="px-2 py-2 text-right font-semibold">ORIGINAL PRICE</th>
                    <th className="px-2 py-2 text-right font-semibold">COMMISION</th>
                    <th className="px-2 py-2 text-right font-semibold">PRICE</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-2 py-4 text-center text-gray-500">
                        내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    items.map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-2 py-1.5 whitespace-nowrap">{row.reservationDate}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{row.tourDate}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{row.bookingNumber}</td>
                        <td className="px-2 py-1.5 max-w-[180px] truncate" title={row.description}>
                          {row.description}
                        </td>
                        <td className="px-2 py-1.5 max-w-[140px] truncate" title={row.guestName}>
                          {row.guestName}
                        </td>
                        <td className="px-2 py-1.5 text-center">{row.quantity}</td>
                        <td className="px-2 py-1.5 text-center">{row.commissionPercent}%</td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {fmt(row.originalPrice)}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {fmt(row.commission)}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {fmt(row.price)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-semibold">
                    <td colSpan={7} className="px-2 py-2">
                      SUBTOTAL
                    </td>
                    <td className="px-2 py-2 text-right">{fmt(subtotalOriginal)}</td>
                    <td className="px-2 py-2 text-right">{fmt(subtotalCommission)}</td>
                    <td className="px-2 py-2 text-right">{fmt(subtotalPrice)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="payment-info mt-6 pt-4 border-t border-gray-200 text-sm">
              <p className="font-semibold mb-2">Payment Info</p>
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
  )
}
