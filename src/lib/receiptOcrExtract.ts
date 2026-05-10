import path from 'node:path'
import { createRequire } from 'node:module'
import { createWorker } from 'tesseract.js'
import { buildReceiptOcrCandidates, type ReceiptOcrCandidates, type ReceiptOcrParseOptions } from '@/lib/receiptOcrParse'

export type { ReceiptOcrCandidates } from '@/lib/receiptOcrParse'
export { buildReceiptOcrCandidates } from '@/lib/receiptOcrParse'

/** 번들된 청크 위치와 무관하게 패키지 실제 경로로 worker 스크립트 탐색 */
function tesseractNodeWorkerPath(): string {
  try {
    const require = createRequire(import.meta.url)
    const pkgDir = path.dirname(require.resolve('tesseract.js/package.json'))
    return path.join(pkgDir, 'src', 'worker-script', 'node', 'index.js')
  } catch {
    return path.join(
      process.cwd(),
      'node_modules',
      'tesseract.js',
      'src',
      'worker-script',
      'node',
      'index.js'
    )
  }
}

function tesseractNodeWorkerOptions(): { workerPath: string; workerBlobURL: boolean } {
  return {
    workerPath: tesseractNodeWorkerPath(),
    workerBlobURL: false,
  }
}

/** Tesseract(eng)로 버퍼에서 영수증 텍스트·후보 필드를 추출합니다. (API 라우트·서버 전용) */
export async function extractReceiptOcrFromImageBuffer(
  imageBuffer: Buffer,
  parseOptions?: ReceiptOcrParseOptions
): Promise<{ text: string; candidates: ReceiptOcrCandidates }> {
  const worker = await createWorker('eng', 1, tesseractNodeWorkerOptions())
  try {
    const result = await worker.recognize(imageBuffer)
    const text = result.data.text || ''
    return { text, candidates: buildReceiptOcrCandidates(text, parseOptions) }
  } finally {
    await worker.terminate()
  }
}

export type PaymentMethodOcrOption = {
  id: string
  name: string
  method: string
  status: string | null
}

/** `TourExpenseManager`의 OCR 결제수단 매칭과 동일 규칙 */
export function resolvePaymentMethodIdFromOcrCandidates(
  candidates: ReceiptOcrCandidates,
  options: PaymentMethodOcrOption[]
): string | null {
  const active = options.filter((o) => String(o.status || 'active').toLowerCase() === 'active')
  const forced = (candidates.payment_method_id ?? '').trim()
  if (forced) {
    const byId = active.find((o) => o.id === forced)
    if (byId) return byId.id
  }
  const last4 = candidates.card_last4.trim()
  const paymentText = candidates.payment_method_text.trim().toLowerCase()

  if (last4) {
    const byLast4 = active.find((o) => {
      const m = String(o.method ?? '')
      return o.name.includes(last4) || m.toLowerCase().includes(last4)
    })
    if (byLast4) return byLast4.id
  }

  if (paymentText) {
    const byText = active.find((o) => {
      const m = String(o.method ?? '').toLowerCase()
      return o.name.toLowerCase().includes(paymentText) || m.includes(paymentText)
    })
    if (byText) return byText.id
  }

  return null
}
