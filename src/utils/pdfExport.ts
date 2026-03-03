'use client'

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface TourStatisticsData {
  totalTours: number
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  averageProfitPerTour: number
  tourStats: Array<{
    tourId: string
    tourDate: string
    productName: string
    totalPeople: number
    revenue: number
    expenses: number
    netProfit: number
    vehicleType?: string
    gasCost?: number
  }>
  expenseBreakdown: Array<{
    category: string
    amount: number
    percentage: number
  }>
  vehicleStats: Array<{
    vehicleType: string
    totalTours: number
    totalPeople: number
    averageGasCost: number
    totalGasCost: number
  }>
}

interface PDFExportProps {
  data: TourStatisticsData
  dateRange: { start: string; end: string }
  chartElementId?: string
}

export function generateTourStatisticsPDF({ data, dateRange, chartElementId }: PDFExportProps) {
  const doc = new jsPDF()
  
  // 페이지 설정
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  let yPosition = margin

  // 헤더
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('투어 통계 리포트', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  // 날짜 범위
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`기간: ${new Date(dateRange.start).toLocaleDateString('ko-KR')} ~ ${new Date(dateRange.end).toLocaleDateString('ko-KR')}`, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 20

  // 요약 통계
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('요약 통계', margin, yPosition)
  yPosition += 10

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  
  const summaryData = [
    ['총 투어 수', data.totalTours.toString()],
    ['총 수익', `$${data.totalRevenue.toLocaleString()}`],
    ['총 지출', `$${data.totalExpenses.toLocaleString()}`],
    ['순수익', `$${data.netProfit.toLocaleString()}`],
    ['투어당 평균 수익', `$${data.averageProfitPerTour.toFixed(0)}`]
  ]

  summaryData.forEach(([label, value]) => {
    doc.text(`${label}:`, margin, yPosition)
    doc.text(value, margin + 80, yPosition)
    yPosition += 8
  })

  yPosition += 10

  // 투어별 상세 통계
  if (data.tourStats.length > 0) {
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('투어별 상세 통계', margin, yPosition)
    yPosition += 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    // 테이블 헤더
    const headers = ['투어 날짜', '상품명', '인원', '수익', '지출', '순수익', '수익률']
    const colWidths = [25, 40, 15, 20, 20, 20, 15]
    let xPosition = margin

    headers.forEach((header, index) => {
      doc.setFont('helvetica', 'bold')
      doc.text(header, xPosition, yPosition)
      xPosition += colWidths[index]
    })

    yPosition += 8
    doc.setFont('helvetica', 'normal')

    // 테이블 데이터
    data.tourStats.forEach((tour) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage()
        yPosition = margin
      }

      xPosition = margin
      const rowData = [
        new Date(tour.tourDate).toLocaleDateString('ko-KR'),
        tour.productName,
        `${tour.totalPeople}명`,
        `$${tour.revenue.toLocaleString()}`,
        `$${tour.expenses.toLocaleString()}`,
        `$${tour.netProfit.toLocaleString()}`,
        `${tour.revenue > 0 ? ((tour.netProfit / tour.revenue) * 100).toFixed(1) : 0}%`
      ]

      rowData.forEach((cell, index) => {
        doc.text(cell, xPosition, yPosition)
        xPosition += colWidths[index]
      })

      yPosition += 6
    })

    yPosition += 10
  }

  // 지출 분석
  if (data.expenseBreakdown.length > 0) {
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('지출 분석', margin, yPosition)
    yPosition += 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')

    data.expenseBreakdown.forEach((expense) => {
      if (yPosition > pageHeight - 20) {
        doc.addPage()
        yPosition = margin
      }

      doc.text(`${expense.category}:`, margin, yPosition)
      doc.text(`$${expense.amount.toLocaleString()} (${expense.percentage.toFixed(1)}%)`, margin + 60, yPosition)
      yPosition += 8
    })

    yPosition += 10
  }

  // 차량별 통계
  if (data.vehicleStats.length > 0) {
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('차량별 통계', margin, yPosition)
    yPosition += 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')

    data.vehicleStats.forEach((vehicle) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage()
        yPosition = margin
      }

      doc.setFont('helvetica', 'bold')
      doc.text(vehicle.vehicleType, margin, yPosition)
      yPosition += 8

      doc.setFont('helvetica', 'normal')
      doc.text(`  투어 수: ${vehicle.totalTours}회`, margin, yPosition)
      yPosition += 6
      doc.text(`  총 인원: ${vehicle.totalPeople}명`, margin, yPosition)
      yPosition += 6
      doc.text(`  총 가스비: $${vehicle.totalGasCost.toLocaleString()}`, margin, yPosition)
      yPosition += 6
      doc.text(`  평균 가스비: $${vehicle.averageGasCost.toFixed(0)}`, margin, yPosition)
      yPosition += 6
      doc.text(`  인원당 가스비: $${(vehicle.totalGasCost / vehicle.totalPeople).toFixed(2)}`, margin, yPosition)
      yPosition += 10
    })
  }

  // 푸터
  const footerY = pageHeight - 15
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`리포트 생성일: ${new Date().toLocaleDateString('ko-KR')}`, margin, footerY)
  doc.text('Tour Management System', pageWidth - margin, footerY, { align: 'right' })

  // PDF 다운로드
  const fileName = `투어통계리포트_${dateRange.start}_${dateRange.end}.pdf`
  doc.save(fileName)
}

export function generateChartPDF(chartElementId: string, fileName: string = 'chart.pdf') {
  const element = document.getElementById(chartElementId)
  if (!element) {
    console.error('Chart element not found')
    return
  }

  html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true
  }).then((canvas) => {
    const imgData = canvas.toDataURL('image/png')
    const doc = new jsPDF()
    const imgWidth = doc.internal.pageSize.getWidth()
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    doc.save(fileName)
  }).catch((error) => {
    console.error('Error generating chart PDF:', error)
  })
}

// --- 채널 인보이스 PDF (KK DAY Invoice 스타일) ---
export interface ChannelInvoiceItem {
  reservationDate: string
  tourDate: string
  bookingNumber: string
  description: string
  guestName: string
  quantity: number
  commissionPercent: number
  originalPrice: number
  commission: number
  price: number
}

const DEFAULT_TO_LINES = [
  'Taiwanmania.com International Travel Service Co., Ltd. KKDAY',
  '11F., No. 18, Aly. 1, Ln. 768, Sec. 4, Bade Rd.,',
  'Nangang Dist., Taipei City 115, Taiwan (R.O.C.)',
  'Taiwan'
]

const DEFAULT_COMPANY = {
  name: 'Las Vegas Mania',
  address: '4525 Spring Mountain Rd #108, Las Vegas, Nevada 89102, United States',
  license: '2002495.056-121',
  email: 'vegasmaniatour@gmail.com',
  website: 'www.lasvegas-mania.com',
  phone: '1-702-444-5531'
}

const DEFAULT_PAYMENT = {
  name: 'TRIP MANIA LLC',
  address: '4525 Spring Mountain Rd #108, Las Vegas, NV 89102',
  swiftCode: 'WFBIUS6SLAS',
  abaNo: '321270742',
  accountNo: '7830554007',
  bankName: 'Wells Fargo Bank',
  bankAddress: '4425 Spring Mountain Rd, Las Vegas, NV 89102'
}

export interface ChannelInvoiceOptions {
  channelName: string
  dateRange: { start: string; end: string }
  items: ChannelInvoiceItem[]
  company?: typeof DEFAULT_COMPANY
  payment?: typeof DEFAULT_PAYMENT
  toAddress?: string
}

export function generateChannelInvoicePDF({ channelName, dateRange, items, company = DEFAULT_COMPANY, payment = DEFAULT_PAYMENT, toAddress = '' }: ChannelInvoiceOptions) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let y = margin

  // Title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(`${channelName} Invoice`, pageWidth / 2, y, { align: 'center' })
  y += 12

  // From / To block
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setFont('helvetica', 'bold')
  doc.text('From:', margin, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  doc.text(company.name, margin, y)
  y += 4
  doc.text(company.address, margin, y)
  y += 4
  doc.text(`License No: ${company.license}`, margin, y)
  y += 4
  doc.text(company.email, margin, y)
  y += 4
  doc.text(company.website, margin, y)
  y += 4
  doc.text(company.phone, margin, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.text('To:', margin, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  const toLines = toAddress ? toAddress.split('\n').filter(Boolean) : DEFAULT_TO_LINES
  toLines.forEach((line) => {
    doc.text(line, margin, y)
    y += 4
  })
  y += 10

  // Table header (purple background) — Reservation DATE, Tour Date만 (Tour Date (Actual) 제외)
  const colWidths = [26, 26, 30, 44, 34, 12, 14, 24, 20, 20]
  const headers = ['Reservation DATE', 'Tour Date', 'Booking #', 'DESCRIPTION', 'Guest Name', 'QUANTITY', 'COMMISION %', 'ORIGINAL PRICE', 'COMMISION', 'PRICE']
  let x = margin
  doc.setFillColor(128, 0, 128) // purple
  doc.rect(margin, y - 4, pageWidth - 2 * margin, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  headers.forEach((h, i) => {
    const w = colWidths[i]
    doc.text(h, x + 2, y + 1)
    x += w
  })
  doc.setTextColor(0, 0, 0)
  y += 8
  doc.setFont('helvetica', 'normal')

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  items.forEach((row) => {
    if (y > pageHeight - 25) {
      doc.addPage()
      y = margin
      doc.setFontSize(8)
    }
    x = margin
    const cells = [
      row.reservationDate,
      row.tourDate,
      row.bookingNumber,
      row.description.length > 28 ? row.description.slice(0, 27) + '…' : row.description,
      row.guestName.length > 22 ? row.guestName.slice(0, 21) + '…' : row.guestName,
      String(row.quantity),
      `${row.commissionPercent}%`,
      fmt(row.originalPrice),
      fmt(row.commission),
      fmt(row.price)
    ]
    cells.forEach((cell, i) => {
      doc.text(cell, x + 2, y + 1)
      x += colWidths[i]
    })
    y += 5
  })

  // SUBTOTAL (align with ORIGINAL PRICE, COMMISION, PRICE columns)
  const subtotalOriginal = items.reduce((s, i) => s + i.originalPrice, 0)
  const subtotalCommission = items.reduce((s, i) => s + i.commission, 0)
  const subtotalPrice = items.reduce((s, i) => s + i.price, 0)
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('SUBTOTAL', margin + 2, y + 1)
  let xCol = margin
  for (let i = 0; i < 7; i++) xCol += colWidths[i]
  doc.text(fmt(subtotalOriginal), xCol + 2, y + 1)
  xCol += colWidths[7]
  doc.text(fmt(subtotalCommission), xCol + 2, y + 1)
  xCol += colWidths[8]
  doc.text(fmt(subtotalPrice), xCol + 2, y + 1)
  doc.setFont('helvetica', 'normal')
  y += 14

  // Payment Info
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Payment Info', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Name: ${payment.name}`, margin, y)
  y += 5
  doc.text(`Address: ${payment.address}`, margin, y)
  y += 5
  doc.text(`Swift Code: ${payment.swiftCode}`, margin, y)
  y += 5
  doc.text(`ABA NO: ${payment.abaNo}`, margin, y)
  y += 5
  doc.text(`Account #: ${payment.accountNo}`, margin, y)
  y += 5
  doc.text(`Bank Name: ${payment.bankName}`, margin, y)
  y += 5
  doc.text(`Bank Address: ${payment.bankAddress}`, margin, y)

  const safeName = channelName.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 30)
  const fileName = `${safeName}_Invoice_${dateRange.start}_${dateRange.end}.pdf`
  doc.save(fileName)
}
