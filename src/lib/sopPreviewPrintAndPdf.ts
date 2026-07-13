'use client'

import { loadHtml2Canvas, loadJsPDF } from '@/lib/lazyPdfLibs'

export type PrintPageFormat = 'a4' | 'letter'

const PAGE_MM: Record<PrintPageFormat, { w: number; h: number; cssSize: string }> = {
  a4: { w: 210, h: 297, cssSize: 'A4' },
  letter: { w: 215.9, h: 279.4, cssSize: 'letter' },
}

function escapeHtmlTitle(title: string): string {
  return title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

/** 연결 메뉴얼 로딩이 끝날 때까지 짧게 대기 (인쇄·PDF 직전) */
async function waitForPrintLinkedReady(root: HTMLElement, timeoutMs = 15_000): Promise<void> {
  if (!root.hasAttribute('data-print-linked-pending')) return
  const start = Date.now()
  while (root.hasAttribute('data-print-linked-pending') && Date.now() - start < timeoutMs) {
    await new Promise((r) => window.setTimeout(r, 120))
  }
}

/**
 * 미리보기와 동일 DOM을 숨은 iframe에서 인쇄.
 * `window.open` 팝업 차단·포커스 이탈로 부모 모달이 닫히는 문제를 피한다.
 */
export function printDomCloneWithStyles(
  root: HTMLElement,
  documentTitle: string,
  options?: { format?: PrintPageFormat }
): void {
  void (async () => {
    await waitForPrintLinkedReady(root)
    printDomCloneWithStylesSync(root, documentTitle, options)
  })()
}

function printDomCloneWithStylesSync(
  root: HTMLElement,
  documentTitle: string,
  options?: { format?: PrintPageFormat }
): void {
  const format = options?.format ?? 'letter'
  const page = PAGE_MM[format]
  const safeTitle = escapeHtmlTitle(documentTitle || 'Print')

  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', safeTitle)
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }

  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => link.outerHTML)
    .join('')

  doc.open()
  doc.write('<!DOCTYPE html><html><head><meta charset="utf-8">')
  doc.write(`<title>${safeTitle}</title>`)
  doc.write(styleLinks)
  doc.write(
    `<style>@page { size: ${page.cssSize}; margin: 12mm; } body { margin: 0; background: #fff; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }</style>`
  )
  doc.write('</head><body>')
  doc.write(root.outerHTML)
  doc.write('</body></html>')
  doc.close()

  const cleanup = () => {
    try {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    } catch {
      /* ignore */
    }
  }

  const run = () => {
    const win = iframe.contentWindow
    if (!win) {
      cleanup()
      return
    }

    win.addEventListener('afterprint', cleanup, { once: true })
    window.setTimeout(cleanup, 60_000)

    const doPrint = () => {
      try {
        win.focus()
      } catch {
        /* ignore */
      }
      try {
        const ret = win.print() as void | Promise<void>
        if (ret != null && typeof (ret as Promise<void>).then === 'function') {
          void (ret as Promise<void>).catch(() => {
            /* Chromium: print preview invalidated — ignore */
          })
        }
      } catch {
        cleanup()
      }
    }

    // document.write 직후 바로 print() 하면 Chromium에서 콜백이 무효화될 수 있음
    window.setTimeout(doPrint, 200)
  }

  if (doc.readyState === 'complete') {
    window.setTimeout(run, 0)
  } else {
    iframe.addEventListener('load', run, { once: true })
  }
}

async function captureDomToPdf(root: HTMLElement, format: PrintPageFormat) {
  await waitForPrintLinkedReady(root)
  const html2canvas = await loadHtml2Canvas()
  const jsPDF = await loadJsPDF()
  const page = PAGE_MM[format]
  const canvas = await html2canvas(root, {
    scale: 2,
    useCORS: true,
    logging: false,
    allowTaint: false,
    backgroundColor: '#ffffff',
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format })
  const pageWidth = page.w
  const pageHeight = page.h
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

  return pdf
}

/** 미리보기 루트를 캡처해 PDF 저장(여러 페이지 자동 분할). 기본 Letter. */
export async function downloadDomAsA4Pdf(
  root: HTMLElement,
  fileBaseName: string,
  options?: { format?: PrintPageFormat }
): Promise<void> {
  const format = options?.format ?? 'letter'
  const pdf = await captureDomToPdf(root, format)
  const safe = fileBaseName.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'document'
  pdf.save(`${safe}.pdf`)
}

async function renderDomToPdfBlob(
  root: HTMLElement,
  format: PrintPageFormat = 'letter'
): Promise<Blob> {
  const pdf = await captureDomToPdf(root, format)
  return pdf.output('blob')
}

/** 미리보기·서명 PDF용 — DOM 캡처 후 Blob 반환 (기본 Letter) */
export async function domElementToPdfBlob(
  root: HTMLElement,
  options?: { format?: PrintPageFormat }
): Promise<Blob> {
  return renderDomToPdfBlob(root, options?.format ?? 'letter')
}

/** 서명 이미지를 넣은 뒤 구조화 본문 DOM을 PDF Blob으로 변환 */
export async function captureSignedStructuredDocPdfBlob(
  root: HTMLElement,
  signatureDataUrl: string,
  signedAtText?: string,
  options?: { format?: PrintPageFormat }
): Promise<Blob> {
  const sigImg = root.querySelector('[data-sop-signature-img]') as HTMLImageElement | null
  if (sigImg) {
    sigImg.src = signatureDataUrl
    await sigImg.decode().catch(() => undefined)
  }
  if (signedAtText) {
    const signedAtEl = root.querySelector('[data-sop-signed-at]')
    if (signedAtEl) signedAtEl.textContent = signedAtText
  }
  return renderDomToPdfBlob(root, options?.format ?? 'letter')
}
