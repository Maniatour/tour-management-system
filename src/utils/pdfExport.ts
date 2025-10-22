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
