import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { extractReceiptOcrFromImageBuffer } from '@/lib/receiptOcrExtract'

export const runtime = 'nodejs'
export const maxDuration = 120

function isImageContentType(ct: string | null): boolean {
  if (!ct) return false
  const base = ct.split(';')[0]?.trim().toLowerCase() ?? ''
  return base.startsWith('image/')
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type')

    if (isImageContentType(contentType)) {
      const imageBuffer = Buffer.from(await request.arrayBuffer())
      if (imageBuffer.length === 0) {
        return NextResponse.json({ error: 'Empty image body' }, { status: 400 })
      }
      const { text, candidates } = await extractReceiptOcrFromImageBuffer(imageBuffer)
      return NextResponse.json({ text, candidates })
    }

    const body = await request.json().catch(() => ({}))
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : ''

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Send image/* body (bytes) or JSON { imageUrl }' },
        { status: 400 }
      )
    }

    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: `Could not fetch receipt image (${imageResponse.status})` },
        { status: 400 }
      )
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
    const { text, candidates } = await extractReceiptOcrFromImageBuffer(imageBuffer)

    return NextResponse.json({
      text,
      candidates,
    })
  } catch (error) {
    console.error('Receipt OCR failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Receipt OCR failed' },
      { status: 500 }
    )
  }
}
