'use client'

import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

function escapeHtmlTitle(title: string): string {
  return title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

/** 미리보기와 동일 DOM을 새 창에서 인쇄(현재 문서의 stylesheet 링크 복제) */
export function printDomCloneWithStyles(root: HTMLElement, documentTitle: string): void {
  const safeTitle = escapeHtmlTitle(documentTitle || 'Print')
  const w = window.open('', '_blank')
  if (!w) return

  const doc = w.document
  doc.open()
  doc.write('<!DOCTYPE html><html><head><meta charset="utf-8">')
  doc.write(`<title>${safeTitle}</title>`)
  for (const link of Array.from(document.querySelectorAll('link[rel="stylesheet"]'))) {
    doc.write(link.outerHTML)
  }
  doc.write(
    '<style>@page { size: A4; margin: 12mm; } body { margin: 0; background: #fff; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }</style>'
  )
  doc.write('</head><body>')
  doc.write(root.outerHTML)
  doc.write('</body></html>')
  doc.close()

  const run = () => {
    const closeWhenDone = () => {
      try {
        if (!w.closed) w.close()
      } catch {
        /* ignore */
      }
    }
    w.addEventListener('afterprint', closeWhenDone, { once: true })
    window.setTimeout(closeWhenDone, 60_000)

    const doPrint = () => {
      if (!w || w.closed) return
      try {
        w.focus()
      } catch {
        /* ignore */
      }
      try {
        const ret = w.print() as void | Promise<void>
        if (ret != null && typeof (ret as Promise<void>).then === 'function') {
          void (ret as Promise<void>).catch(() => {
            /* Chromium: print preview invalidated — ignore */
          })
        }
      } catch {
        /* ignore */
      }
    }

    // `document.write` 직후 바로 print() 하면 Chromium에서
    // "The provided callback is no longer runnable" (미처리 Promise 거부)이 날 수 있음.
    window.setTimeout(doPrint, 200)
  }

  if (doc.readyState === 'complete') {
    window.setTimeout(run, 0)
  } else {
    w.addEventListener('load', run, { once: true })
  }
}

/** A4 미리보기 루트를 캡처해 PDF 저장(여러 페이지 자동 분할) */
export async function downloadDomAsA4Pdf(root: HTMLElement, fileBaseName: string): Promise<void> {
  const canvas = await html2canvas(root, {
    scale: 2,
    useCORS: true,
    logging: false,
    allowTaint: false,
    backgroundColor: '#ffffff',
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  const imgData = canvas.toDataURL('image/jpeg', 0.92)

  let heightLeft = imgHeight
  let position = 0
  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > 1) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  const safe = fileBaseName.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'document'
  pdf.save(`${safe}.pdf`)
}
