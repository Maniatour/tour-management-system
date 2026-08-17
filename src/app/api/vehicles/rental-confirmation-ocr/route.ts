import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { createClient } from '@/lib/supabase/server'
import {
  mergeRentalConfirmationOcr,
  parseRentalConfirmationOcr,
  rentalConfirmationOcrIsUsable,
} from '@/lib/rentalConfirmationOcrParse'
import { extractRentalConfirmationViaOpenAiVision } from '@/lib/rentalConfirmationOcrVision'

export const runtime = 'nodejs'
export const maxDuration = 60

function isImageContentType(ct: string | null): boolean {
  if (!ct) return false
  const base = ct.split(';')[0]?.trim().toLowerCase() ?? ''
  return base.startsWith('image/')
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type')
    let imageBuffer: Buffer | null = null
    let mimeType = 'image/jpeg'

    if (isImageContentType(contentType)) {
      imageBuffer = Buffer.from(await request.arrayBuffer())
      mimeType = contentType?.split(';')[0]?.trim() || mimeType
    } else if (contentType?.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      if (file instanceof File) {
        imageBuffer = Buffer.from(await file.arrayBuffer())
        mimeType = file.type || mimeType
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return NextResponse.json({ error: 'Send an image file' }, { status: 400 })
    }

    const vision = await extractRentalConfirmationViaOpenAiVision(imageBuffer, mimeType)
    const fields = vision ?? parseRentalConfirmationOcr('')
    const merged = mergeRentalConfirmationOcr(parseRentalConfirmationOcr(''), fields)

    return NextResponse.json({
      fields: merged,
      usable: rentalConfirmationOcrIsUsable(merged),
    })
  } catch (error) {
    console.error('Rental confirmation OCR failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Rental confirmation OCR failed' },
      { status: 500 },
    )
  }
}
