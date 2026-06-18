'use client'

/** PDF·캡처 라이브러리 — 버튼 클릭·다운로드 시에만 로드 */
export async function loadJsPDF() {
  const mod = await import('jspdf')
  return mod.default
}

export async function loadHtml2Canvas() {
  const mod = await import('html2canvas')
  return mod.default
}

export async function loadHtml2Pdf() {
  const mod = await import('html2pdf.js')
  return mod.default
}

export type Html2PdfFactory = Awaited<ReturnType<typeof loadHtml2Pdf>>
