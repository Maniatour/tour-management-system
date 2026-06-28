/** 고객 예약 카드 DOM을 인쇄한다. */
export function printCustomerReservation(reservationId: string): void {
  try {
    const printElement = document.getElementById(`reservation-${reservationId}`)
    if (!printElement) {
      console.error('프린트 요소를 찾을 수 없습니다:', `reservation-${reservationId}`)
      return
    }

    const printStyle = document.createElement('style')
    printStyle.id = `print-style-${reservationId}`
    printStyle.textContent = `
        @media print {
          body * {
            visibility: hidden;
          }
          #reservation-${reservationId},
          #reservation-${reservationId} * {
            visibility: visible;
          }
          #reservation-${reservationId} {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 20px;
            box-shadow: none;
            border: none;
            margin: 0;
          }
          #reservation-${reservationId} .hidden.print\\:block {
            display: none !important;
          }
          #reservation-${reservationId} img {
            visibility: visible !important;
            display: block !important;
            max-width: 100% !important;
            height: auto !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
            page-break-inside: avoid !important;
          }
          #reservation-${reservationId} .aspect-\\[4\\/3\\] {
            display: block !important;
            visibility: visible !important;
            min-height: 120px !important;
            position: relative !important;
            background-color: #f3f4f6 !important;
          }
          #reservation-${reservationId} .aspect-\\[4\\/3\\] img {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            border-radius: 8px !important;
            border: 1px solid #e5e7eb !important;
          }
          #reservation-${reservationId} .md\\:grid-cols-4 {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          #reservation-${reservationId} .grid.print\\:grid-cols-2 > div:nth-child(1) { order: 1; }
          #reservation-${reservationId} .grid.print\\:grid-cols-2 > div:nth-child(2) { order: 2; }
          #reservation-${reservationId} .grid.print\\:grid-cols-2 > div:nth-child(3) { order: 3; }
          #reservation-${reservationId} .grid.print\\:grid-cols-2 > div:nth-child(4) { order: 4; }
          #reservation-${reservationId} .grid.print\\:grid-cols-2 > div:nth-child(5) { order: 5; }
          #reservation-${reservationId} .grid.print\\:grid-cols-2 > div:nth-child(6) { order: 6; }
          #reservation-${reservationId} .grid.print\\:grid-cols-2 > div:nth-child(7) { order: 7; }
          #reservation-${reservationId} .grid.print\\:grid-cols-2 > div:nth-child(8) { order: 8; }
          #reservation-${reservationId} .print-email-full {
            white-space: normal !important;
            overflow: visible !important;
            text-overflow: clip !important;
            word-break: break-all !important;
          }
          #reservation-${reservationId} .print\\:flex-col {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          #reservation-${reservationId} .print\\:mb-1 {
            margin-bottom: 0.25rem !important;
          }
          #reservation-${reservationId} .print\\:block {
            display: block !important;
          }
        }
      `

    const existingStyle = document.getElementById(`print-style-${reservationId}`)
    if (existingStyle) {
      document.head.removeChild(existingStyle)
    }

    document.head.appendChild(printStyle)

    const nextImages = printElement.querySelectorAll('img')
    nextImages.forEach((nextImg, index) => {
      const container = nextImg.closest('.aspect-\\[4\\/3\\]')
      if (container && nextImg.src) {
        const newImg = document.createElement('img')
        newImg.src = nextImg.src
        newImg.alt = nextImg.alt || `Hotel Media ${index + 1}`
        newImg.style.width = '100%'
        newImg.style.height = '100%'
        newImg.style.objectFit = 'cover'
        newImg.style.borderRadius = '8px'
        newImg.style.border = '1px solid #e5e7eb'
        nextImg.style.display = 'none'
        container.appendChild(newImg)
      }
    })

    setTimeout(() => {
      window.print()
      setTimeout(() => {
        const styleToRemove = document.getElementById(`print-style-${reservationId}`)
        if (styleToRemove) {
          document.head.removeChild(styleToRemove)
        }
      }, 1000)
    }, 200)
  } catch (error) {
    console.error('프린트 중 오류 발생:', error)
    alert('프린트 중 오류가 발생했습니다.')
  }
}
