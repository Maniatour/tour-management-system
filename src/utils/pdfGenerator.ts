import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export interface ReservationPDFData {
  id: string
  customerName: string
  productName: string
  tourDate: string
  tourTime?: string
  duration?: number
  adults: number
  child: number
  infant: number
  totalPeople: number
  status: string
  pickupHotel?: string
  pickupTime?: string
  totalPrice?: number
  choices?: Array<{
    name: string
    quantity: number
    price: number
  }>
  tourSchedule?: Array<{
    startTime: string
    endTime?: string
    title: string
    description?: string
  }>
  pickupSchedule?: Array<{
    pickupTime: string
    hotelName: string
    location: string
    address?: string
  }>
}

export const generateReservationPDF = async (
  reservationData: ReservationPDFData,
  locale: string = 'ko'
) => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let yPosition = 20

  // 헤더
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('MANIA TOUR', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  doc.setFontSize(16)
  doc.setFont('helvetica', 'normal')
  doc.text(
    locale === 'ko' ? '예약 상세 정보' : 'Reservation Details',
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  )
  yPosition += 20

  // 예약 기본 정보
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(
    locale === 'ko' ? '예약 정보' : 'Reservation Information',
    20,
    yPosition
  )
  yPosition += 10

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  
  const basicInfo = [
    {
      label: locale === 'ko' ? '예약 번호' : 'Reservation ID',
      value: reservationData.id
    },
    {
      label: locale === 'ko' ? '고객명' : 'Customer Name',
      value: reservationData.customerName
    },
    {
      label: locale === 'ko' ? '상품명' : 'Product Name',
      value: reservationData.productName
    },
    {
      label: locale === 'ko' ? '투어 날짜' : 'Tour Date',
      value: reservationData.tourDate
    },
    {
      label: locale === 'ko' ? '투어 시간' : 'Tour Time',
      value: reservationData.tourTime || '-'
    },
    {
      label: locale === 'ko' ? '소요시간' : 'Duration',
      value: reservationData.duration ? `${reservationData.duration}시간` : '-'
    },
    {
      label: locale === 'ko' ? '성인' : 'Adults',
      value: reservationData.adults.toString()
    },
    {
      label: locale === 'ko' ? '아동' : 'Children',
      value: reservationData.child.toString()
    },
    {
      label: locale === 'ko' ? '유아' : 'Infants',
      value: reservationData.infant.toString()
    },
    {
      label: locale === 'ko' ? '총 인원' : 'Total People',
      value: reservationData.totalPeople.toString()
    },
    {
      label: locale === 'ko' ? '상태' : 'Status',
      value: reservationData.status
    }
  ]

  basicInfo.forEach((info, index) => {
    if (yPosition > pageHeight - 30) {
      doc.addPage()
      yPosition = 20
    }
    
    doc.text(`${info.label}:`, 20, yPosition)
    doc.text(info.value, 80, yPosition)
    yPosition += 8
  })

  yPosition += 10

  // 픽업 정보
  if (reservationData.pickupHotel || reservationData.pickupTime) {
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(
      locale === 'ko' ? '픽업 정보' : 'Pickup Information',
      20,
      yPosition
    )
    yPosition += 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    
    if (reservationData.pickupHotel) {
      doc.text(
        `${locale === 'ko' ? '픽업 호텔' : 'Pickup Hotel'}:`,
        20,
        yPosition
      )
      doc.text(reservationData.pickupHotel, 80, yPosition)
      yPosition += 8
    }
    
    if (reservationData.pickupTime) {
      doc.text(
        `${locale === 'ko' ? '픽업 시간' : 'Pickup Time'}:`,
        20,
        yPosition
      )
      doc.text(reservationData.pickupTime, 80, yPosition)
      yPosition += 8
    }
    
    yPosition += 10
  }

  // 선택 옵션
  if (reservationData.choices && reservationData.choices.length > 0) {
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(
      locale === 'ko' ? '선택 옵션' : 'Selected Options',
      20,
      yPosition
    )
    yPosition += 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    
    reservationData.choices.forEach((choice) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage()
        yPosition = 20
      }
      
      doc.text(`${choice.name} (${choice.quantity}개)`, 20, yPosition)
      doc.text(`$${choice.price}`, pageWidth - 30, yPosition, { align: 'right' })
      yPosition += 8
    })
    
    yPosition += 10
  }

  // 투어 스케줄
  if (reservationData.tourSchedule && reservationData.tourSchedule.length > 0) {
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(
      locale === 'ko' ? '투어 스케줄' : 'Tour Schedule',
      20,
      yPosition
    )
    yPosition += 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    
    reservationData.tourSchedule.forEach((schedule) => {
      if (yPosition > pageHeight - 40) {
        doc.addPage()
        yPosition = 20
      }
      
      doc.setFont('helvetica', 'bold')
      doc.text(
        `${schedule.startTime}${schedule.endTime ? ` - ${schedule.endTime}` : ''}`,
        20,
        yPosition
      )
      yPosition += 8
      
      doc.setFont('helvetica', 'normal')
      doc.text(schedule.title, 20, yPosition)
      yPosition += 8
      
      if (schedule.description) {
        doc.setFontSize(10)
        doc.text(schedule.description, 20, yPosition)
        yPosition += 8
        doc.setFontSize(12)
      }
      
      yPosition += 5
    })
    
    yPosition += 10
  }

  // 픽업 스케줄
  if (reservationData.pickupSchedule && reservationData.pickupSchedule.length > 0) {
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(
      locale === 'ko' ? '픽업 스케줄' : 'Pickup Schedule',
      20,
      yPosition
    )
    yPosition += 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    
    reservationData.pickupSchedule.forEach((pickup) => {
      if (yPosition > pageHeight - 40) {
        doc.addPage()
        yPosition = 20
      }
      
      doc.setFont('helvetica', 'bold')
      doc.text(pickup.pickupTime, 20, yPosition)
      yPosition += 8
      
      doc.setFont('helvetica', 'normal')
      doc.text(pickup.hotelName, 20, yPosition)
      yPosition += 8
      
      doc.text(pickup.location, 20, yPosition)
      yPosition += 8
      
      if (pickup.address) {
        doc.text(pickup.address, 20, yPosition)
        yPosition += 8
      }
      
      yPosition += 5
    })
  }

  // 총 가격
  if (reservationData.totalPrice) {
    yPosition += 10
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(
      `${locale === 'ko' ? '총 가격' : 'Total Price'}: $${reservationData.totalPrice}`,
      pageWidth / 2,
      yPosition,
      { align: 'center' }
    )
  }

  // 푸터
  const footerY = pageHeight - 20
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Generated on ${new Date().toLocaleDateString()}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  )

  return doc
}

export const downloadReservationPDF = async (
  reservationData: ReservationPDFData,
  locale: string = 'ko'
) => {
  try {
    const doc = await generateReservationPDF(reservationData, locale)
    const fileName = `reservation_${reservationData.id}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
  } catch (error) {
    console.error('PDF 생성 중 오류 발생:', error)
    throw error
  }
}
